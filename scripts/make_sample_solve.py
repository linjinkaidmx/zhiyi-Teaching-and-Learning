# -*- coding: utf-8 -*-
"""生成一张【只有题目、没有任何作答痕迹】的图片，用于测试 solve（解答）模式"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_solve.png")
W, H = 900, 380
FONT_PATH = "C:/Windows/Fonts/simhei.ttf"


def load(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:
        return ImageFont.load_default()


img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

f_title = load(25)
f_text = load(23)
f_small = load(18)

d.rectangle([0, 0, W, 56], fill="#E6F1FB")
d.text((26, 14), "线性代数 · 第五章 特征值与特征向量", font=f_title, fill="#2C2C2A")

d.text((34, 92), "习题 5-3", font=f_small, fill="#888780")
d.text(
    (34, 130),
    "设矩阵  A = [[1, 2], [2, 1]]，求 A 的全部特征值",
    font=f_text,
    fill="#2C2C2A",
)
d.text((66, 172), "与对应的特征向量。", font=f_text, fill="#2C2C2A")

d.text((34, 246), "（请在草稿纸上写出完整推导过程）", font=f_small, fill="#B4B2A9")

d.line([34, 300, W - 34, 300], fill="#D3D1C7", width=1)
d.text((34, 318), "教材 P128  难度：进阶", font=f_small, fill="#888780")

img.save(OUT)
print("saved:", OUT)
