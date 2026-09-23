# -*- coding: utf-8 -*-
"""识别守卫（S1/S2 修复）回归：纯函数离线测试
用法：python _test_extract_guard.py
"""
import base64
import io
import os
import sys
import types

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

os.environ.setdefault("MOCK", "1")

from PIL import Image, ImageFilter  # noqa: E402
import service  # noqa: E402

pass_n = 0
fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  ✓ " + label)
    else:
        fail_n += 1
        print("  ✗ " + label + ("  → " + repr(extra) if extra is not None else ""))


def b64_of(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


# 纯白空白图
blank = Image.new("RGB", (400, 400), (255, 255, 255))
# 带文字的"题目"图
qimg = Image.new("RGB", (400, 120), (255, 255, 255))
from PIL import ImageDraw  # noqa: E402
d = ImageDraw.Draw(qimg)
try:
    from PIL import ImageFont
    f = ImageFont.load_default(size=24)
except Exception:
    f = None
d.text((10, 40), "Compute lim sin(x)/x", fill=(0, 0, 0), font=f)
# 纯黑图（也是"无内容"）
dark = Image.new("RGB", (400, 400), (0, 0, 0))

print("\n1. 模型自述/道歉句式识别为「无题目」")
for t in ["图像过于模糊，无法识别其中的文字内容。",
          "抱歉，这张图片太模糊，我看不清楚。",
          "无法读取图片中的文字。",
          "I cannot read the text in this image.",
          "The image is too blurry."]:
    ok(service._looks_like_no_question(t) is True, "判为无题目: " + t[:24], t)
for t in ["求极限 lim(x→0) sin(x)/x", "计算定积分 ∫0^1 x^2 dx", "设 f(x)=x^2，求 f'(x)"]:
    ok(service._looks_like_no_question(t) is False, "判为题目: " + t[:20], t)
ok(service._looks_like_no_question("") is True, "空文本判为无题目")
ok(service._looks_like_no_question("  ") is True, "纯空白判为无题目")
ok(service._looks_like_no_question("12") is True, "过短（≤3 字）判为无题目")
ok(service._looks_like_no_question("1234") is False, "4 字普通内容不误判", "1234")

print("\n2. 空白/纯色/无效图快速预检")
ok(service._image_is_blank_or_invalid(b64_of(blank)) is True, "纯白图判为无内容")
ok(service._image_is_blank_or_invalid(b64_of(dark)) is True, "纯黑图判为无内容")
ok(service._image_is_blank_or_invalid(b64_of(qimg)) is False, "带文字图不误判")
ok(service._image_is_blank_or_invalid("") is True, "空字节判为无内容")
ok(service._image_is_blank_or_invalid("bm90IGFuIGltYWdl") is True, "非图片字节判为无内容")
ok(service._image_is_blank_or_invalid(base64.b64encode(b"NOT_A_REAL_IMAGE" * 50).decode()) is True, "非图片字节判为无内容")

# 模糊图（对文字图做重度高斯模糊）应被快速预检拦下
blurry = qimg.filter(ImageFilter.GaussianBlur(14))
ok(service._image_is_too_blurry(b64_of(blurry)) is True, "重度模糊图判为不可读")
ok(service._image_is_too_blurry(b64_of(qimg)) is False, "清晰文字图不误判")
ok(service._image_is_too_blurry(b64_of(blank)) is True, "空白图同样判为不可读（双保险）")

print("\n3. Mock 识别路径不受影响")
r = service.analyze_image("fake-b64", "image/png")
ok(bool(r.get("question")), "MOCK 下 analyze_image 仍正常返回", r)

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项断言）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
