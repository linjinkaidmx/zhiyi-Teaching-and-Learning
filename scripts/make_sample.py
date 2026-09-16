# -*- coding: utf-8 -*-
"""生成一张模拟的高校数学错题图片，用于测试多模态识别链路"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample.png")
W, H = 920, 660
FONT_PATH = "C:/Windows/Fonts/simhei.ttf"


def load(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:
        return ImageFont.load_default()


img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

f_title = load(27)
f_text = load(22)
f_small = load(18)

d.rectangle([0, 0, W, 62], fill="#EEEDFE")
d.text((28, 16), "高等数学 · 第二章 微分方程", font=f_title, fill="#2C2C2A")

y = 96
d.text((36, y), "题目：求微分方程  y'' - 3y' + 2y = 0  的通解", font=f_text, fill="#2C2C2A")
y += 62

d.text((36, y), "【学生作答】", font=f_text, fill="#534AB7")
y += 48

steps = [
    "解：特征方程为  r² - 3r + 2 = 0",
    "因式分解得  (r - 1)(r - 2) = 0",
    "解得  r₁ = -1，r₂ = -2",
    "故通解为  y = C₁e^(-x) + C₂e^(-2x)",
]
for i, s in enumerate(steps, 1):
    color = "#E24B4A" if i == 3 else "#2C2C2A"
    d.text((56, y), f"{i}. {s}", font=f_text, fill=color)
    if i == 3:
        d.text((620, y), "✗ 符号错误", font=f_small, fill="#E24B4A")
    y += 44

y += 22
d.line([36, y, W - 36, y], fill="#D3D1C7", width=1)
y += 20
d.text((36, y), "教师批注：第 3 步有误，请注意符号。正确答案应代入检验。",
       font=f_small, fill="#5F5E5A")

img.save(OUT)
print("saved:", OUT)
