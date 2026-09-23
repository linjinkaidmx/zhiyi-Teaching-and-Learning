# -*- coding: utf-8 -*-
"""批次1 后端测试：课程 / 学习记录的云端同步
用法：python _test_sync_courses_sessions.py
"""
import os
import sys
import tempfile
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_b1_%d.db" % os.getpid()))

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

os.environ.setdefault("MOCK", "1")

import main  # noqa: E402
import db  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app)

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


NICK = "b1t%d" % (os.getpid() % 1000000)   # 昵称上限 20 字符

print("\n0. 准备账号")
r = client.post("/api/account/register", json={"nickname": NICK, "password": "test123456", "password_confirm": "test123456"})
ok(r.status_code == 200 and r.json().get("ok"), "注册测试账号", r.text[:120])
TOKEN = r.json().get("token", "")

print("\n1. 课程 push → pull 往返")
courses_payload = {
    "courses": [
        {"id": "c1", "name": "数据结构", "color": "#3d5a8a",
         "chapters": [{"id": "ch1", "name": "树", "points": [{"id": "p1", "name": "红黑树"}]}]},
        {"id": "c2", "name": "高等数学", "chapters": []},
    ],
    "timetable": [{"id": "s1", "courseId": "c1", "day": 1, "slot": 2, "room": "教三302"}],
    "deletedIds": ["c9"],
}
r = client.post("/api/sync/push", json={"token": TOKEN, "items": [], "courses": courses_payload})
ok(r.status_code == 200 and r.json().get("ok"), "推送课程成功", r.text[:120])

d = client.post("/api/sync/pull", json={"token": TOKEN}).json()
ok(d.get("courses", {}).get("courses", [{}])[0].get("name") == "数据结构", "课程名回读正确")
ok(len(d["courses"]["courses"]) == 2, "课程数量正确")
ok(d["courses"]["courses"][0]["chapters"][0]["points"][0]["name"] == "红黑树", "章节/知识点嵌套保留")
ok(d["courses"]["deletedIds"] == ["c9"], "删除墓碑保留")
ok(d["courses"]["timetable"][0]["room"] == "教三302", "课表保留")

print("\n2. 学习记录 push → pull（排序 + 截断）")
sessions = [{"id": "s%d" % i, "type": "quiz", "title": "题%d" % i, "correct": i % 2 == 0,
             "minutes": 2, "createdAt": 1000 + i} for i in range(305)]
r = client.post("/api/sync/push", json={"token": TOKEN, "items": [], "sessions": sessions})
ok(r.status_code == 200 and r.json().get("ok"), "推送学习记录成功")
d = client.post("/api/sync/pull", json={"token": TOKEN}).json()
got = d.get("sessions", [])
ok(len(got) == db.MAX_SESSIONS, f"截断到上限 {db.MAX_SESSIONS} 条（实际 {len(got)}）")
ok(got[0]["createdAt"] > got[-1]["createdAt"], "按 createdAt 倒序")

print("\n3. 向后兼容：不传 courses/sessions 不能清空云端")
r = client.post("/api/sync/push", json={"token": TOKEN, "items": []})
ok(r.status_code == 200 and r.json().get("ok"), "老客户端式 push（只带 items）成功")
d = client.post("/api/sync/pull", json={"token": TOKEN}).json()
ok(len(d.get("courses", {}).get("courses", [])) == 2, "课程未被清空")
ok(len(d.get("sessions", [])) == db.MAX_SESSIONS, "学习记录未被清空")

print("\n4. 空对象/空数组同样不覆盖（只有非空才写）")
client.post("/api/sync/push", json={"token": TOKEN, "items": [], "courses": {}, "sessions": []})
d = client.post("/api/sync/pull", json={"token": TOKEN}).json()
ok(d["courses"]["courses"][0]["name"] == "数据结构", "空 courses 未覆盖")
ok(len(d["sessions"]) == db.MAX_SESSIONS, "空 sessions 未覆盖")

print("\n5. 账号隔离")
r2 = client.post("/api/account/register", json={"nickname": NICK + "b", "password": "test123456", "password_confirm": "test123456"})
TOKEN2 = r2.json().get("token", "")
d2 = client.post("/api/sync/pull", json={"token": TOKEN2}).json()
ok(d2.get("courses") == {} and d2.get("sessions") == [], "另一账号看不到别人的课程与记录")

print("\n6. 非法数据防护")
r = client.post("/api/sync/push", json={"token": TOKEN, "items": [], "sessions": ["bad", 123, {"id": "ok"}]})
ok(r.status_code == 200, "非法 sessions 项被过滤而不是报错")
d = client.post("/api/sync/pull", json={"token": TOKEN}).json()
ok(all(isinstance(x, dict) for x in d["sessions"]), "回读全部为对象")
ok(db.load_sessions(NICK)[0]["id"] == "ok", "非法项已丢弃，合法项保留")

print("\n7. token 失效处理")
r = client.post("/api/sync/push", json={"token": "bad-token", "items": [], "courses": {"courses": [{"id": "x"}]}})
ok(r.json().get("ok") is False, "无效 token 被拒绝")
r = client.post("/api/sync/pull", json={"token": "bad-token"})
ok(r.json().get("ok") is False, "pull 无效 token 被拒绝")

print("\n8. 清理测试账号")
r = client.post("/api/account/delete", json={"token": TOKEN, "password": "test123456"})
ok(r.status_code == 200, "测试账号已注销（释放云端数据）")

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项断言）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
