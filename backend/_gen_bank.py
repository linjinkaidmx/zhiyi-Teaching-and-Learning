"""批量生成 100 道大学理工科种子题库（含完整私教式讲解），写入本地 db 并导出 bank.json。

用法：python _gen_bank.py
- 用 DeepSeek-V3（deepseek-chat）分学科分批生成，成本极低
- 解析后走 bank.add_to_bank 入库（按归一化去重，可安全重跑）
- 最后导出 bank.json 供服务器导入
"""
import json
import os
import re
import sys
import time

from dotenv import load_dotenv
from openai import OpenAI

import bank
import db

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY", ""),
    base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
)

# (学科, 覆盖知识点, 生成批数) —— 每批 10 道
PLAN = [
    ("高等数学", "极限与连续、导数与微分、中值定理、不定积分、定积分与反常积分、微分方程、多元函数微分、多元积分、无穷级数", 4),
    ("线性代数", "行列式、矩阵运算、向量组的线性相关性、线性方程组、特征值与特征向量、二次型", 3),
    ("大学物理", "质点运动学、牛顿定律、刚体转动、振动与波、静电场、稳恒磁场、电磁感应", 3),
]

_BARE_BACKSLASH_RE = re.compile(r'(?<!\\)\\(?![\\"/bfnrtu])')


def repair_json(text: str) -> str:
    text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text.strip(), flags=re.M).strip()
    try:
        json.loads(text)
        return text
    except Exception:
        return _BARE_BACKSLASH_RE.sub(r"\\\\", text)


def extract_array(text: str):
    candidates = [text.strip(), repair_json(text)]
    for cand in candidates:
        s = cand.find("[")
        e = cand.rfind("]")
        if s == -1 or e == -1 or e <= s:
            continue
        for body in (cand[s:e + 1], repair_json(cand[s:e + 1])):
            try:
                data = json.loads(body)
                if isinstance(data, list):
                    return data
            except Exception:
                continue
    return None


def gen_batch(subject: str, topics: str, count: int = 10):
    prompt = (
        f"你是大学理工科资深教师。请生成 {count} 道「{subject}」的典型考试题"
        f"（覆盖：{topics}），难度为大学本科期末考试水平，以计算题为主。\n\n"
        "每道题必须包含完整的私教式讲解。严格只输出 JSON 数组，每项格式：\n"
        '{"question": "题目原文（公式用 LaTeX，行内 $...$）",\n'
        ' "answer": "最终答案（LaTeX）",\n'
        ' "steps": [{"title": "步骤标题", "detail": "该步推理与为什么这么做，含 LaTeX"}],\n'
        ' "key_breakthrough": "这道题的题眼与突破口",\n'
        ' "knowledge_points": ["知识点1", "知识点2"],\n'
        ' "knowledge_review": "知识点的系统讲解（定义/定理/适用条件/易错点）",\n'
        ' "extensions": ["变式题1", "变式题2"]}\n\n'
        "要求：题目具体、可计算、彼此不重复；步骤逐步展开讲清「为什么」；"
        "knowledge_review 是系统性讲解而非复述步骤。只输出 JSON 数组，不要任何其他文字或解释。"
    )
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                timeout=180,
            )
            text = resp.choices[0].message.content or ""
            arr = extract_array(text)
            if arr:
                return arr
            print(f"  第 {attempt + 1} 次解析失败，重试... 返回片段: {text[:120]}")
        except Exception as e:
            print(f"  第 {attempt + 1} 次调用异常: {e}")
            time.sleep(2)
    return []


def main():
    db.init_db()
    total_ok = 0
    total_skip = 0
    for subject, topics, batches in PLAN:
        print(f"\n=== 生成《{subject}》 {batches * 10} 道 ===")
        for b in range(batches):
            arr = gen_batch(subject, topics, 10)
            ok = 0
            for item in arr:
                q = (item.get("question") or "").strip()
                if not q or not item.get("answer"):
                    continue
                result = {
                    "subject": subject,
                    "question_type": "计算题",
                    "answer": item.get("answer", ""),
                    "steps": item.get("steps", []) or [],
                    "key_breakthrough": item.get("key_breakthrough", "") or "",
                    "knowledge_points": item.get("knowledge_points", []) or [],
                    "knowledge_review": item.get("knowledge_review", "") or "",
                    "extensions": item.get("extensions", []) or [],
                    "diagnosis": "",
                }
                bank.add_to_bank(q, result)
                ok += 1
            total_ok += ok
            print(f"  第 {b + 1} 批：生成 {len(arr)} 道，入库 {ok} 道（累计 {total_ok}）")
            time.sleep(1)

    print(f"\n=== 完成：题库共 {db.bank_count()} 道 ===")

    # 导出 bank.json 供服务器导入
    items = db.load_all_bank()
    out_path = os.path.join(os.path.dirname(__file__), "bank.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)
    print(f"已导出 {out_path}（{len(items)} 道）")


if __name__ == "__main__":
    main()
