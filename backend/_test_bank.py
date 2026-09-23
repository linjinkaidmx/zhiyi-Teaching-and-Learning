# -*- coding: utf-8 -*-
"""离线回归：题库归一化与命中判定（不依赖 DB / 网络）

核心场景：**同一道题**被不同方式写出来（拍照识别的空格、标点、题号、LaTeX 差异）
应判为同题；**不同的题**（哪怕只差一个数字）不能误判。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bank  # noqa: E402

pass_n = 0
fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
    else:
        fail_n += 1
    tail = ('  → ' + repr(extra)) if extra is not None else ''
    print(('  ✓ ' if cond else '  ✗ ') + label + tail)


def sim(a, b):
    return bank.similarity(bank.normalize(a), bank.normalize(b))


print('\n===== 同一道题的多种写法应判同题（阈值 %.2f）=====' % bank.MATCH_THRESHOLD)
BASE = "计算 ∫₀¹ x²/√(1-x²) dx，并说明与 ∑(1/n²) 的关系。"
VARIANTS = [
    ("带题号 + 无空格 + 半角标点", "21. 计算∫₀¹x²/√(1-x²)dx, 并说明与∑(1/n²)的关系"),
    ("LaTeX 写法", r"计算 $\int_0^1 \frac{x^2}{\sqrt{1-x^2}} dx$，并说明与 $\sum \frac{1}{n^2}$ 的关系。"),
    ("开头「第 3 题」", "第 3 题 计算 ∫₀¹ x²/√(1-x²) dx，并说明与 ∑(1/n²) 的关系。"),
    ("多余换行与空格", "计算 ∫₀¹ x²/√(1-x²) dx，\n\n  并说明与 ∑(1/n²) 的关系。"),
]
for label, variant in VARIANTS:
    sc = sim(BASE, variant)
    ok(sc >= bank.MATCH_THRESHOLD, f'{label} → 判定为同题（{sc:.3f}）', None)

print('\n===== 不同的题不能误判 =====')
NEG = [
    ("数值不同（3 vs 5）", "求 2x+3=0 的解", "求 2x+5=0 的解"),
    ("指数不同（会由数字指纹兜住）", "求 x^2 的导数", "求 x^3 的导数"),
    ("完全无关", "计算 ∫₀¹ x²/√(1-x²) dx，并说明与 ∑(1/n²) 的关系。", "Python 中 list 为什么支持 for 循环？"),
]
for label, a, b in NEG:
    sc = sim(a, b)
    digits_same = bank.digit_fingerprint(a) == bank.digit_fingerprint(b)
    # 判为不同题 = 相似度低于阈值 或 数字指纹不一致（find_match 的实际逻辑）
    judged_same = sc >= bank.MATCH_THRESHOLD and digits_same
    ok(not judged_same, f'{label} → 不判为同题（相似度 {sc:.3f}，指纹一致={digits_same}）')

print('\n===== 数字指纹忽略题号 =====')
ok(bank.digit_fingerprint("21. 求 2x+3=0 的解") == bank.digit_fingerprint("求 2x+3=0 的解"),
   '题号 21 不参与数值身份')
ok(bank.digit_fingerprint("求 2x+3=0 的解") != bank.digit_fingerprint("求 2x+5=0 的解"),
   '题目里的 3 与 5 仍是不同身份')

print('\n===== 归一化细节 =====')
ok(bank.normalize("  第 3 题  ") == '', '只有题号的输入归一为空（避免空指纹入库）', bank.normalize("  第 3 题  "))
n1 = bank.normalize(r"\frac{1}{2}")
n2 = bank.normalize("1/2")
ok('frac' not in n1, 'LaTeX 命令 \\frac 已剥离', n1)
ok(bank.normalize("？!，。") == '', '纯标点归一为空')

print(f'\n结果：通过 {pass_n}，失败 {fail_n}')
sys.exit(1 if fail_n else 0)
