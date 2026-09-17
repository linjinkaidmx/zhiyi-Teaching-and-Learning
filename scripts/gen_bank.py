# -*- coding: utf-8 -*-
"""离线批量生成题库（计算机类为主 + 数学类）

工程要点：
- 一次 API 调用只生成 1 道题（实测 3 题会因输出过长超时，单题 60-120s）
- 线程并发跑，单次调用控制在数分钟内
- 断点续跑：结果落盘 bank_generated.json，重启后已生成的自动跳过
- 失败重试 1 次；仍失败则记录在 pending 里，下轮补
- 全程不 print 中文（规避 Windows 控制台编码问题），进度用 ASCII
"""
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, "zhiyi/backend")
from openai import OpenAI  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

load_dotenv("zhiyi/backend/.env")

ARK_API_KEY = os.getenv("ARK_API_KEY", "")
ARK_BASE_URL = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
ARK_MODEL = os.getenv("ARK_MODEL", "doubao-seed-2-1-pro-260915")

OUT = "bank_generated.json"

ERROR_TYPES = ["概念理解错误", "计算失误", "审题偏差", "方法错误", "知识盲区"]
DIFFS = ["基础", "进阶", "挑战"]

# (学科, 标准知识点, 出题时给 AI 的补充语境)
TOPICS = [
    # ---- 计算机类 ----
    ("数据结构", "栈与队列", "出入栈顺序合法性、循环队列判满、中缀转后缀"),
    ("数据结构", "二叉树遍历", "前中后序、层序、由两种遍历还原树"),
    ("数据结构", "二叉搜索树", "插入删除、中序有序性、查找复杂度"),
    ("数据结构", "哈希表", "哈希函数、冲突处理、装载因子、链地址法"),
    ("数据结构", "图的遍历", "BFS/DFS 序列、连通性、拓扑排序"),
    ("数据结构", "排序算法", "各排序的复杂度、稳定性、快排 partition 过程"),
    ("算法", "二分查找", "边界条件、变体（左边界/右边界/旋转数组）"),
    ("算法", "递归与分治", "递归式求解、主定理、分治思想"),
    ("算法", "动态规划", "状态设计、转移方程、背包/最长公共子序列类"),
    ("算法", "贪心算法", "贪心选择性质、区间调度、Huffman"),
    ("操作系统", "进程调度算法", "FCFS/SJF/RR/优先级，周转时间与带权周转时间计算"),
    ("操作系统", "死锁", "四个必要条件、资源分配图、安全序列判定"),
    ("操作系统", "内存分页与虚拟内存", "页表、逻辑地址转物理地址、TLB"),
    ("操作系统", "页面置换算法", "FIFO/LRU/OPT 的缺页次数计算、Belady 异常"),
    ("操作系统", "信号量与同步互斥", "P/V 操作、生产者消费者、经典同步问题"),
    ("计算机网络", "IP 地址与子网划分", "子网掩码计算、可用主机数、CIDR"),
    ("计算机网络", "TCP 拥塞控制", "慢启动、拥塞避免、快重传时 cwnd 变化"),
    ("计算机网络", "HTTP 与 HTTPS", "状态码、HTTP 版本差异、TLS 握手过程"),
    # ---- 数学类 ----
    ("高等数学", "极限计算", "等价无穷小替换、重要极限、未定式转化"),
    ("高等数学", "洛必达法则", "0/0 与 ∞/∞ 型、适用条件、失效情形"),
    ("高等数学", "复合函数求导", "链式法则、多层复合、隐函数求导"),
    ("高等数学", "不定积分", "换元法、分部积分、有理函数积分"),
    ("高等数学", "定积分应用", "平面图形面积、旋转体体积、物理应用"),
    ("高等数学", "级数敛散性", "比较判别法、比值判别法、交错级数"),
    ("线性代数", "行列式计算", "按行列展开、初等变换、范德蒙德"),
    ("线性代数", "矩阵运算", "矩阵乘法、逆矩阵、秩"),
    ("线性代数", "特征值与特征向量", "特征多项式求根、不同类型矩阵的特征值性质"),
    ("线性代数", "线性方程组求解", "高斯消元、解的结构判定、基础解系"),
    ("概率论与数理统计", "条件概率与全概率", "全概率公式、贝叶斯公式的实际应用题"),
    ("概率论与数理统计", "期望与方差", "常见分布的期望方差、性质、协方差"),
]

PROMPT = """你是高校理工科命题老师。请命制 1 道练习题。

学科：{subject}
知识点：{kp}（可涉及：{extra}）
难度：{diff}
考察的典型失误：{weak}（题目设计要让容易犯这种失误的学生暴露问题，但题目本身必须严谨正当）

【硬性要求】
- 题目可独立作答，数据自洽，不需要看图
- 涉及计算的，数字要设计得干净（结果为整数或简单分数），你必须在心里完整验算一遍
- answer 给出最终结果（若是计算题附最简过程）
- hint 一句话切入思路，不剧透答案
- 数学表达式一律用 $...$ 包裹的 LaTeX 书写，如 $y = C_1 e^{{2x}}$、$\\frac{{a}}{{b}}$
- 禁止 Unicode 数学字母与 Unicode 上下标（C₁ e²），下标写 C_1，上标写 e^{{2x}}
- 纯中文叙述不加 $

严格输出 JSON，不要任何多余文字：
{{"question": "题干", "hint": "思路", "answer": "标准答案"}}"""


def gen_one(client, subject, kp, extra, diff, weak):
    prompt = PROMPT.format(subject=subject, kp=kp, extra=extra, diff=diff, weak=weak)
    resp = client.chat.completions.create(
        model=ARK_MODEL,
        messages=[{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        temperature=0.8,
        timeout=170,
    )
    text = resp.choices[0].message.content or ""
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("no json")
    d = json.loads(m.group())
    for k in ("question", "hint", "answer"):
        if not str(d.get(k, "")).strip():
            raise ValueError(f"missing {k}")
    return d


def main():
    max_n = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    workers = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    done = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            done = json.load(f)

    # 任务池：(subject, kp, extra, diff, weak, key)
    tasks = []
    for si, (subject, kp, extra) in enumerate(TOPICS):
        for di, diff in enumerate(DIFFS):
            key = f"{kp}|{diff}"
            if key in done:
                continue
            weak = ERROR_TYPES[(si + di) % len(ERROR_TYPES)]
            tasks.append((subject, kp, extra, diff, weak, key))

    if not tasks:
        print(f"ALL_DONE total={len(done)}")
        return

    batch = tasks[:max_n]
    print(f"todo={len(tasks)} batch={len(batch)} have={len(done)}")

    client = OpenAI(api_key=ARK_API_KEY, base_url=ARK_BASE_URL, timeout=180)
    ok = fail = 0

    def run(t):
        subject, kp, extra, diff, weak, key = t
        last_err = None
        for attempt in range(2):
            try:
                d = gen_one(client, subject, kp, extra, diff, weak)
                return (
                    key,
                    {
                        "subject": subject,
                        "knowledge_points": [kp],
                        "difficulty": diff,
                        "question": d["question"].strip(),
                        "hint": d["hint"].strip(),
                        "answer": d["answer"].strip(),
                        "target_errors": [weak],
                    },
                )
            except Exception as e:
                last_err = repr(e)[:120]
                time.sleep(2)
        return key, last_err

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(run, t): t for t in batch}
        for fut in as_completed(futs):
            key, val = fut.result()
            if isinstance(val, dict):
                done[key] = val
                ok += 1
                print(f"OK   [{len(done)}] {key}")
            else:
                fail += 1
                print(f"FAIL {key} :: {val}")
            # 每完成一个就落盘，保证断点安全
            with open(OUT, "w", encoding="utf-8") as f:
                json.dump(done, f, ensure_ascii=False, indent=1)

    print(f"BATCH_DONE ok={ok} fail={fail} total_saved={len(done)}")


if __name__ == "__main__":
    main()
