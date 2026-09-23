"""班级模块真实模型验证（_verify_ 前缀 = 需真实模型，手动跑）。

链路：注册 → 教师认证 → 建班 → 布置作业 → 学生提交（PIL 生成"手写"图）→ /api/homework/grade
      （方舟视觉转录 + deepseek 判分）→ /api/homework/report。
耗时约 1~2 分钟。用法：python _verify_class_grade.py
"""
import base64
import io
import json
import os
import sys
import tempfile
import types

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

_tmp = tempfile.mkdtemp(prefix="zhiyi_class_verify_")
os.environ["ZHIYI_DB"] = os.path.join(_tmp, "verify.db")
os.environ.pop("MOCK", None)  # 强制真实模型
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def make_hw_image() -> str:
    """生成一张"学生手写作业"图（白底黑字，两个小题的解答）。"""
    img = Image.new("RGB", (760, 520), "white")
    draw = ImageDraw.Draw(img)
    font = None
    for fp in ("C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/simhei.ttf", "C:/Windows/Fonts/simsun.ttc"):
        try:
            font = ImageFont.truetype(fp, 26)
            break
        except Exception:
            continue
    lines = [
        "1. 解：lim(x→0) sinx/x",
        "    = lim(x→0) 1 / cosx = 1",
        "    所以极限为 1。",
        "2. 证明：对任意 x∈R，",
        "    f(x+Δx)-f(x) = (x+Δx)²-x²",
        "    = Δx(2x+Δx) → 0 (Δx→0)",
        "    所以 f(x)=x² 在 R 连续。",
    ]
    y = 40
    for line in lines:
        draw.text((60, y), line, fill="black", font=font)
        y += 62
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    return base64.b64encode(buf.getvalue()).decode()


client = TestClient(main.app)
PW = "pass123456"


def reg(nick):
    r = client.post("/api/account/register", json={
        "nickname": nick, "password": PW, "password_confirm": PW,
    }).json()
    assert r.get("ok"), r
    return r["token"]


T_TEA = reg("vf_tea")
T_STU = reg("vf_stu")

r = client.post("/api/teacher/apply",
                json={"token": T_TEA, "name": "王老师", "school": "某某大学", "subject": "高等数学"}).json()
check("教师认证", r.get("ok"), json.dumps(r, ensure_ascii=False)[:120])

r = client.post("/api/class/create",
                json={"token": T_TEA, "name": "验证班", "subject": "高等数学", "grade": "大一"}).json()
check("建班", r.get("ok"))
CLS = r["class"]

r = client.post("/api/class/join", json={"token": T_STU, "code": CLS["invite_code"]}).json()
check("学生加入", r.get("ok"))

r = client.post("/api/homework/create", json={
    "token": T_TEA, "class_id": CLS["id"],
    "title": "极限与连续性作业",
    "content": "1. 求 lim(x→0) sin x / x\n2. 证明 f(x) = x² 在 R 上连续",
    "reference": "1. 极限为 1（夹逼或等价无穷小）；2. 用 ε-Δ 定义或增量趋零证明",
}).json()
check("布置作业", r.get("ok"))
HW = r["homework"]

img = make_hw_image()
r = client.post("/api/homework/submit",
                json={"token": T_STU, "homework_id": HW["id"], "image_base64": img, "note": ""}).json()
check("提交作业", r.get("ok"), json.dumps(r, ensure_ascii=False)[:120])

print("\n--- 真实批改中（方舟转录 + deepseek 判分，约 30~60s）---")
r = client.post("/api/homework/grade",
                json={"token": T_TEA, "homework_id": HW["id"], "user_id": "vf_stu"}).json()
check("真实批改成功", r.get("ok"), json.dumps(r, ensure_ascii=False)[:200])
if r.get("ok"):
    sub = r["submission"]
    fb = sub.get("feedback") or {}
    print(f"  转录片段: {(fb.get('transcript') or '')[:80] if isinstance(fb, dict) else ''}")
    print(f"  得分: {sub['score']}/100")
    print(f"  总评: {fb.get('overall', '')[:120]}")
    for it in (fb.get("items") or [])[:4]:
        print(f"  - {it.get('question', '')[:24]} [{it.get('verdict')}] {it.get('comment', '')[:60]}")
    check("得分在 0~100", isinstance(sub["score"], (int, float)) and 0 <= sub["score"] <= 100)
    check("逐题评语非空", bool(fb.get("items")))
    check("总评非空", bool(fb.get("overall")))

print("\n--- 生成班级报告（约 20~40s）---")
r = client.post("/api/homework/report", json={"token": T_TEA, "homework_id": HW["id"]}).json()
check("报告生成", r.get("ok"), json.dumps(r, ensure_ascii=False)[:200])
if r.get("ok"):
    rep = r["report"]
    print(f"  stats: {json.dumps(rep.get('stats'), ensure_ascii=False)}")
    for a in (rep.get("teaching_advice") or [])[:3]:
        print(f"  建议: {a[:70]}")
    check("报告含统计", isinstance(rep.get("stats"), dict) and rep["stats"].get("graded") == 1)
    check("报告含教学建议", bool(rep.get("teaching_advice")))

r = client.post("/api/homework/push", json={"token": T_TEA, "homework_id": HW["id"], "kind": "report"}).json()
check("报告推送群", r.get("ok"))

print()
if FAILS:
    print(f"失败 {len(FAILS)} 项：{FAILS}")
    sys.exit(1)
print("真实模型验证全部通过")
