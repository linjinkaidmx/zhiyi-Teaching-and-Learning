# -*- coding: utf-8 -*-
"""AI 造角色·编辑与彻底删除 接口离线回归（2026-10-09，MOCK=1 不连网不花钱）
覆盖：ai-update 原地更新（char_id 不变/聊天保留/换图与不换图两路）+ delete 彻底清五表 + 权限边界。
用法：python _test_aichar_edit.py   （zhiyi 环境）
"""
import base64
import os
import sys
import tempfile

os.environ["MOCK"] = "1"
os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_aicharedit_%d.db" % os.getpid()))

if sys.platform == "win32":
    import types
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0; stub.RLIMIT_AS = 1; stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import aichar  # noqa: E402
_TMP = tempfile.mkdtemp(prefix="aichar_edit_")
aichar._QUOTA_PATH = os.path.join(_TMP, "quota.json")
aichar._STASH_PATH = os.path.join(_TMP, "stash.json")
aichar._stash = {}

import main  # noqa: E402
import db  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app)
pass_n = fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  ✓ " + label)
    else:
        fail_n += 1
        print("  ✗ " + label + ("  → " + repr(extra) if extra is not None else ""))


nick = "qa_aichar_edit"
reg = client.post("/api/account/register", json={
    "nickname": nick, "password": "QaPass1234", "password_confirm": "QaPass1234", "client_id": "t"}).json()
token = reg.get("token") or ""
ok(bool(token), "注册拿 token")

photo_url = "data:image/png;base64," + base64.b64encode(aichar._mock_char_art()).decode()

# 建角色
r1 = client.post("/api/companion/custom/ai-gen", json={"token": token, "image": photo_url, "mime": "image/png"}).json()
s1 = client.post("/api/companion/custom/ai-save", json={
    "token": token, "gen_id": r1.get("gen_id"), "name": "小知", "template": "cheerful"}).json()
cid = (s1.get("char") or {}).get("id") or ""
ok(cid.startswith("cu_"), "建角色", cid)

# 造聊天/亲密度/会话/讲解链数据（模拟真实使用痕迹）
with db._lock:
    c = db._conn_checked()
    c.execute("INSERT INTO companion_msgs (user_id, character_id, role, kind, content, meta, created_at) "
              "VALUES (?, ?, 'user', 'chat', '你好呀', '', 1)", (nick, cid))
    c.execute("INSERT INTO companion_msgs (user_id, character_id, role, kind, content, meta, created_at) "
              "VALUES (?, ?, 'assistant', 'chat', '嗨！一起学习吧', '', 2)", (nick, cid))
    c.execute("INSERT INTO companion_intimacy (user_id, character_id, exp, updated_at) VALUES (?, ?, 88, 3)", (nick, cid))
    c.execute("INSERT INTO companion_sessions (id, user_id, character_id, title, msg_count, created_at, updated_at) "
              "VALUES ('sess_1', ?, ?, '闲聊', 2, 4, 5)", (nick, cid))
    c.execute("INSERT INTO study_session (id, uid, character_id, question_id, layers, created_at) "
              "VALUES ('chain_1', ?, ?, 'q1', 3, 6)", (nick, cid))
    c.commit()
msgs_before = c.execute("SELECT COUNT(*) FROM companion_msgs WHERE character_id=?", (cid,)).fetchone()[0]
ok(msgs_before == 2, "造了 2 条聊天记录", msgs_before)

print("== 1. ai-update 不换形象（gen_id 空，不扣次数） ==")
left_before = aichar.ai_char_left(nick)
u1 = client.post("/api/companion/custom/ai-update", json={
    "token": token, "char_id": cid, "gen_id": "", "name": "小知二号", "template": "gentle",
    "extra": "说话轻声细语"}).json()
ok(u1.get("ok") is True, "更新成功", u1)
ok((u1.get("char") or {}).get("id") == cid, "char_id 不变（原地更新）", (u1.get("char") or {}).get("id"))
ok((u1.get("char") or {}).get("name") == "小知二号", "名字已改", (u1.get("char") or {}).get("name"))
ok(aichar.ai_char_left(nick) == left_before, "不换形象不扣生图次数", aichar.ai_char_left(nick))
with db._lock:
    msgs_now = db._conn_checked().execute(
        "SELECT COUNT(*) FROM companion_msgs WHERE character_id=?", (cid,)).fetchone()[0]
ok(msgs_now == 2, "聊天记录保留", msgs_now)

print("== 2. ai-update 换形象（gen_id 非空，走同额度池） ==")
r2 = client.post("/api/companion/custom/ai-gen", json={"token": token, "image": photo_url, "mime": "image/png"}).json()
ok(r2.get("ok") is True and r2.get("left") == left_before - 1, "重画扣同额度池", r2.get("left"))
u2 = client.post("/api/companion/custom/ai-update", json={
    "token": token, "char_id": cid, "gen_id": r2.get("gen_id"), "name": "小知三号", "template": "cool"}).json()
ok(u2.get("ok") is True and (u2.get("char") or {}).get("id") == cid, "换图更新 id 仍不变", u2.get("ok"))
with db._lock:
    img_row = db._conn_checked().execute(
        "SELECT image FROM custom_companion WHERE char_id=?", (cid,)).fetchone()
ok(img_row is not None and len(img_row[0]) > 0, "新形象 BLOB 已落库", img_row and len(img_row[0]))

print("== 3. 边界 ==")
u_bad = client.post("/api/companion/custom/ai-update", json={
    "token": token, "char_id": "chibi_girl", "name": "X", "template": "cool"}).json()
ok(u_bad.get("ok") is False and "内置" in (u_bad.get("error") or ""), "内置角色拒绝编辑", u_bad.get("error"))
u_none = client.post("/api/companion/custom/ai-update", json={
    "token": token, "char_id": "cu_notexist0", "name": "X", "template": "cool"}).json()
ok(u_none.get("ok") is False, "不存在角色拒绝", u_none.get("error"))
u_stale = client.post("/api/companion/custom/ai-update", json={
    "token": token, "char_id": cid, "gen_id": "ag_expired000", "name": "X", "template": "cool"}).json()
ok(u_stale.get("ok") is False and "过期" in (u_stale.get("error") or ""), "过期 gen_id 拒绝", u_stale.get("error"))

print("== 4. 彻底删除（五表全清） ==")
d1 = client.post("/api/companion/custom/delete", json={"token": token, "char_id": cid}).json()
ok(d1.get("ok") is True, "删除成功", d1)
with db._lock:
    c2 = db._conn_checked()
    n_msgs = c2.execute("SELECT COUNT(*) FROM companion_msgs WHERE character_id=?", (cid,)).fetchone()[0]
    n_intim = c2.execute("SELECT COUNT(*) FROM companion_intimacy WHERE character_id=?", (cid,)).fetchone()[0]
    n_sess = c2.execute("SELECT COUNT(*) FROM companion_sessions WHERE character_id=?", (cid,)).fetchone()[0]
    n_chain = c2.execute("SELECT COUNT(*) FROM study_session WHERE character_id=?", (cid,)).fetchone()[0]
    n_char = c2.execute("SELECT COUNT(*) FROM custom_companion WHERE char_id=?", (cid,)).fetchone()[0]
ok(n_msgs == 0, "聊天记录已清", n_msgs)
ok(n_intim == 0, "亲密度已清", n_intim)
ok(n_sess == 0, "会话已清", n_sess)
ok(n_chain == 0, "讲解链已清", n_chain)
ok(n_char == 0, "角色行已删", n_char)
lst = client.post("/api/companion/custom/list", json={"token": token}).json()
ok(len(lst.get("chars") or []) == 0, "列表为空", lst.get("chars"))

print("\n编辑与删除回归: %d 通过 / %d 失败" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
