# -*- coding: utf-8 -*-
"""班级笔记 / 知识点接口回归（老师发布→学生浏览→保存格式→删除权限→级联）。MOCK 离线跑。
用法：zhiyi 环境 python _test_class_notes.py
"""
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("MOCK", "1")
_tmp = tempfile.mkdtemp(prefix="zhiyi_notes_test_")
os.environ["ZHIYI_DB"] = os.path.join(_tmp, "test.db")

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402

client = TestClient(main.app)
PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"[PASS] {name}")
    else:
        FAIL += 1
        print(f"[FAIL] {name}  {extra}")


def make_img(tag):
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" + tag * 8


r = client.post("/api/account/register", json={"nickname": "notes_t", "password": "pw123456", "password_confirm": "pw123456"}).json()
check("注册老师", r.get("ok"), r)
ttok = r["token"]
r = client.post("/api/account/register", json={"nickname": "notes_s", "password": "pw123456", "password_confirm": "pw123456"}).json()
stok = r["token"]
r = client.post("/api/teacher/apply", json={"token": ttok, "name": "笔记老师", "school": "测试中学"}).json()
check("老师认证", r.get("ok"), r)
r = client.post("/api/class/create", json={"token": ttok, "name": "笔记班"}).json()
check("建班", r.get("ok"), r)
cid = r["class"]["id"]
code = r["class"]["invite_code"]
r = client.post("/api/class/join", json={"token": stok, "code": code}).json()
check("学生进班", r.get("ok"), r)

# ---------- 发布 ----------
r = client.post("/api/class/note/create", json={"token": ttok, "class_id": cid, "title": "定积分技巧", "content": "换元 + 分部", "images": [make_img("a"), make_img("b")]}).json()
check("老师发图文笔记", r.get("ok"), r)
nid = r["note"]["id"] if r.get("ok") else ""

r = client.post("/api/class/note/create", json={"token": ttok, "class_id": cid, "title": "纯图笔记", "content": "", "images": [make_img("c")]}).json()
check("纯图笔记可发布", r.get("ok"), r)

r = client.post("/api/class/note/create", json={"token": ttok, "class_id": cid, "title": "", "content": "x"}).json()
check("空标题拒绝", not r.get("ok"), r)

r = client.post("/api/class/note/create", json={"token": ttok, "class_id": cid, "title": "空内容", "content": "", "images": []}).json()
check("无图无文拒绝", not r.get("ok"), r)

r = client.post("/api/class/note/create", json={"token": ttok, "class_id": cid, "title": "超", "content": "x", "images": [make_img(str(i)) for i in range(10)]}).json()
check("10 图拒绝", not r.get("ok"), r)

r = client.post("/api/class/note/create", json={"token": stok, "class_id": cid, "title": "学生发", "content": "x"}).json()
check("学生发布被拒", not r.get("ok"), r)

# ---------- 浏览与拉图 ----------
r = client.post("/api/class/note/list", json={"token": stok, "class_id": cid}).json()
notes = r.get("notes", [])
check("学生拉笔记列表", r.get("ok") and len(notes) == 2, str(len(notes)))
check("列表带 images_count", notes and sum(n.get("images_count") or 0 for n in notes) == 3, str([n.get("images_count") for n in notes]))
check("列表不带图本体", notes and "images" not in notes[0])

r = client.post("/api/class/note/images", json={"token": stok, "note_id": nid}).json()
check("学生拉笔记配图", r.get("images") == [make_img("a"), make_img("b")], str(r)[:80])

r = client.post("/api/class/note/images", json={"token": stok, "note_id": "nonexistent"}).json()
check("不存在笔记拒绝", not r.get("ok"), r)

# ---------- 删除权限 ----------
r = client.post("/api/class/note/delete", json={"token": stok, "note_id": nid}).json()
check("学生删除被拒", not r.get("ok"), r)
r = client.post("/api/class/note/delete", json={"token": ttok, "note_id": nid}).json()
check("老师删除成功", r.get("ok"), r)
r = client.post("/api/class/note/list", json={"token": ttok, "class_id": cid}).json()
check("删除后列表减少", len(r.get("notes", [])) == 1)

# ---------- 群聊通知 ----------
r = client.post("/api/group/messages", json={"token": stok, "group_id": cid}).json()
msgs = r.get("items", [])
check("群聊有笔记系统通知", any("发布了新笔记" in (m.get("content") or "") for m in msgs), str(msgs)[:120])

print(f"\n{'全部通过' if FAIL == 0 else '存在失败'}（{PASS} 项，失败 {FAIL}）")
sys.exit(0 if FAIL == 0 else 1)
