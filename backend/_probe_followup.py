# -*- coding: utf-8 -*-
"""追问 / 换个讲法 后端直调测试（MOCK 与真实模型两种）。

用法：
  python _test_followup.py mock     # 不调模型，验证 Generator 逻辑与分片
  python _test_followup.py fast     # 快答档（deepseek-chat）
  python _test_followup.py deep     # 深思档（deepseek-reasoner，较慢）
  python _test_followup.py reteach  # 换个讲法
"""
import os
import sys
import time

MODE = (sys.argv[1] if len(sys.argv) > 1 else "mock").lower()
if MODE == "mock":
    os.environ["MOCK"] = "1"

import service  # noqa: E402

QUESTION = r"计算定积分：$\int_0^1 x^2\,dx$。"
RESULT = {
    "answer": r"$\frac{1}{3}$",
    "steps": [
        {"title": "识别题型", "detail": r"被积函数 $x^2$ 在 $[0,1]$ 上连续，可用牛顿-莱布尼茨公式。"},
        {"title": "求原函数", "detail": r"$\int x^2 dx = \frac{x^3}{3} + C$。"},
        {"title": "代入上下限", "detail": r"$\left.\frac{x^3}{3}\right|_0^1 = \frac{1}{3}$。"},
    ],
    "key_breakthrough": "多项式在闭区间上积分，直接找原函数代入上下限。",
    "knowledge_points": ["定积分", "牛顿-莱布尼茨公式"],
    "knowledge_review": r"定积分的几何意义是曲线下的代数面积；牛顿-莱布尼茨公式把面积计算转化为原函数的差。",
    "diagnosis": "",
}
HISTORY = [{"q": "第一步为什么能直接套公式？", "a": "因为被积函数在闭区间连续，满足公式的使用条件。"}]


def collect(gen, label):
    t0 = time.time()
    text = ""
    n = 0
    first_at = None
    for piece in gen:
        if first_at is None:
            first_at = round(time.time() - t0, 2)
        text += piece
        n += 1
    print(f"[{label}] 分片 {n} 个 · 首字 {first_at}s · 总耗时 {round(time.time() - t0, 1)}s · 长度 {len(text)}")
    print("--- 前 200 字 ---")
    print(text[:200])
    print("--- 末尾 80 字 ---")
    print(text[-80:])
    print()
    return text


if MODE == "mock":
    print("MOCK =", service.MOCK)
    collect(service.follow_up_stream(QUESTION, RESULT, HISTORY, "为什么第三步可以直接代上下限？", "deep"), "mock/追问")
    collect(service.reteach_stream(QUESTION, RESULT, "visual"), "mock/换个讲法")
    # 空问题应抛错
    try:
        list(service.follow_up_stream(QUESTION, RESULT, [], "   ", "deep"))
        print("!! 空问题未报错")
    except ValueError as e:
        print("空问题正确报错:", e)
elif MODE == "fast":
    print("MOCK =", service.MOCK, "| slot =", service.JUDGE_SLOT)
    collect(service.follow_up_stream(QUESTION, RESULT, HISTORY, "为什么第三步可以直接代上下限？", "fast"), "fast/追问")
elif MODE == "deep":
    print("MOCK =", service.MOCK, "| slot =", service.EXPLAIN_SLOT)
    collect(service.follow_up_stream(QUESTION, RESULT, HISTORY, "换一种方法能不能不用原函数？", "deep"), "deep/追问")
elif MODE == "reteach":
    print("MOCK =", service.MOCK, "| slot =", service.EXPLAIN_SLOT)
    collect(service.reteach_stream(QUESTION, RESULT, "another"), "real/换个方法讲")
else:
    print("未知模式:", MODE)
