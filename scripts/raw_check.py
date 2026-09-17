# -*- coding: utf-8 -*-
"""抓一次线上 diagnose 的原始返回，检查文本里的数学符号记号到底是什么形态。

只关心：question / correct_answer / solution_steps / key_insight 这些字段的原文，
判断乱码是 LaTeX 记号（\\frac、$...$）还是特殊 Unicode（𝑥、ℝ、C₁）。
"""
import json
import time
import urllib.request
import uuid

BASE = "http://193.112.28.51:3300"

b = uuid.uuid4().hex
img = open("zhiyi/scripts/sample.png", "rb").read()
body = (
    f'--{b}\r\nContent-Disposition: form-data; name="file"; '
    f'filename="t.png"\r\nContent-Type: image/png\r\n\r\n'
).encode()
body += img + f"\r\n--{b}--\r\n".encode()
req = urllib.request.Request(
    BASE + "/api/diagnose",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={b}"},
)
t0 = time.time()
r = urllib.request.urlopen(req, timeout=180)
d = json.loads(r.read().decode("utf-8"))
cost = time.time() - t0

lines = [f"HTTP {r.status}  success={d.get('success')}  耗时 {cost:.1f}s"]
x = d.get("data") or {}
for k in ["question", "correct_answer", "key_insight", "error_analysis"]:
    lines.append(f"\n[{k}]")
    lines.append(repr(x.get(k, "")))
steps = x.get("solution_steps") or []
lines.append(f"\n[solution_steps] {len(steps)} 步")
for i, s in enumerate(steps, 1):
    lines.append(f"{i}. {repr(s)}")

# 符号统计
import re

full = json.dumps(x, ensure_ascii=False)
checks = {
    "LaTeX $ 包裹": full.count("$"),
    "\\frac": full.count("\\frac"),
    "\\sqrt": full.count("\\sqrt"),
    "\\boxed": full.count("\\boxed"),
    "^ 上标记号": full.count("^"),
    "Unicode 下标(₁₂₃)": len(re.findall("[₁₂₃₄₅₆₇₈₉₀]", full)),
    "数学字母(𝑥𝑦ℝ)": len(re.findall("[\U0001D400-\U0001D7FFℝℂℕℤ]", full)),
    "λ π Δ 等": len(re.findall("[λπΔΣ∑∫∂≈≤≥≠±·]", full)),
}
lines.append("\n=== 符号统计 ===")
for k, v in checks.items():
    lines.append(f"{k}: {v}")

with open("raw_check.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("done", cost)
