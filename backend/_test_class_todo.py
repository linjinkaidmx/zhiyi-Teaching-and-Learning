"""班级待办统计回归（class/my 的 pending_grade / pending_submit）。

流程：老师认证→建班→学生加入→布置作业→学生未交/已交→老师批改，逐段核对待办数。
独立临时库，默认 MOCK=1。
"""
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

os.environ.setdefault("MOCK", "1")
_tmp = tempfile.mkdtemp(prefix="zhiyi_class_todo_")
os.environ["ZHIYI_DB"] = os.path.join(_tmp, "test.db")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    print(("[PASS] " if cond else "[FAIL] ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


client = TestClient(main.app)
PW = "pass123456"


def reg(nick):
    return client.post("/api/account/register", json={"nickname": nick, "password": PW, "password_confirm": PW}).json()


def my_classes(tok):
    r = client.post("/api/class/my", json={"token": tok}).json()
    return {c["name"]: c for c in (r.get("classes") or [])}


T = reg("cls_teacher")
S = reg("cls_student")
check("注册老师/学生", T.get("ok") and S.get("ok"))
tt, st = T["token"], S["token"]

r = client.post("/api/teacher/apply", json={"token": tt, "name": "陈砺", "school": "深圳大学", "subject": "高等数学"}).json()
check("老师认证", r.get("ok") is True, str(r)[:120])

r = client.post("/api/class/create", json={"token": tt, "name": "高数2班", "subject": "高等数学", "grade": "大一"}).json()
check("创建班级", r.get("ok") is True, str(r)[:120])
cid, code = r["class"]["id"], r["class"]["invite_code"]

r = client.post("/api/class/join", json={"token": st, "code": code}).json()
check("学生加入", r.get("ok") is True, str(r)[:120])

# 无作业时：待办都应为 0
t0 = my_classes(tt)["高数2班"]
s0 = my_classes(st)["高数2班"]
check("初始 老师待批=0", t0.get("pending_grade") == 0, str(t0.get("pending_grade")))
check("初始 学生待交=0", s0.get("pending_submit") == 0, str(s0.get("pending_submit")))

# 布置作业
r = client.post("/api/homework/create", json={
    "token": tt, "class_id": cid, "title": "第一章 习题", "content": "做 1-5 题", "reference": "", "due_at": 0, "images": [],
}).json()
check("布置作业", r.get("ok") is True, str(r)[:160])
hid = r["homework"]["id"]

s1 = my_classes(st)["高数2班"]
check("布置后 学生待交=1", s1.get("pending_submit") == 1, str(s1.get("pending_submit")))
t1 = my_classes(tt)["高数2班"]
check("布置后 老师待批=0（还没交）", t1.get("pending_grade") == 0, str(t1.get("pending_grade")))

# 学生提交
r = client.post("/api/homework/submit", json={
    "token": st, "homework_id": hid, "image_base64": "", "note": "老师我交了", "images": [],
}).json()
check("学生提交", r.get("ok") is True, str(r)[:160])

s2 = my_classes(st)["高数2班"]
check("提交后 学生待交=0", s2.get("pending_submit") == 0, str(s2.get("pending_submit")))
t2 = my_classes(tt)["高数2班"]
check("提交后 老师待批=1", t2.get("pending_grade") == 1, str(t2.get("pending_grade")))

# 老师批改（MOCK 模式）
r = client.post("/api/homework/grade", json={"token": tt, "homework_id": hid, "user_id": "cls_student"}).json()
check("老师批改", r.get("ok") is True, str(r)[:160])

t3 = my_classes(tt)["高数2班"]
check("批改后 老师待批=0", t3.get("pending_grade") == 0, str(t3.get("pending_grade")))

# 再布置一份，学生不交
client.post("/api/homework/create", json={
    "token": tt, "class_id": cid, "title": "第二章 习题", "content": "做 6-10 题", "reference": "", "due_at": 0, "images": [],
})
s4 = my_classes(st)["高数2班"]
check("第二份布置后 学生待交=1", s4.get("pending_submit") == 1, str(s4.get("pending_submit")))

# 老师自己看（老师不会被算作待交）
t4 = my_classes(tt)["高数2班"]
check("老师不计入待交", t4.get("pending_submit") == 0, str(t4.get("pending_submit")))

print()
if FAILS:
    print(f"FAILED: {len(FAILS)} -> {FAILS}")
    sys.exit(1)
print("ALL PASS")
