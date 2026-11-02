# -*- coding: utf-8 -*-
"""AI 造角色 接口全链路离线回归（2026-10-09，MOCK=1 不连网不花钱）
覆盖：ai-gen 扣次/暂存 → ai-save 落库/替换旧角色 → 配额耗尽拒绝 → 过期 gen_id → 图片下发。
用法：python _test_aichar_api.py   （zhiyi 环境）
"""

import test_support  # isolated database, no credentials or network
import base64
import os
import sys
import tempfile

os.environ["MOCK"] = "1"
os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_aichar_%d.db" % os.getpid()))

if sys.platform == "win32":
    import types
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0; stub.RLIMIT_AS = 1; stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import aichar  # noqa: E402  （重定向持久化，绝不碰真实 data/）
_TMP = tempfile.mkdtemp(prefix="aichar_api_")
aichar._QUOTA_PATH = os.path.join(_TMP, "quota.json")
aichar._STASH_PATH = os.path.join(_TMP, "stash.json")
aichar._stash = {}

import main  # noqa: E402
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


nick = "qa_aichar_api"
reg = client.post("/api/account/register", json={
    "nickname": nick, "password": "QaPass1234", "password_confirm": "QaPass1234", "client_id": "t"}).json()
token = reg.get("token") or ""
ok(bool(token), "注册拿 token", reg)

photo_b = aichar._mock_char_art()
photo_url = "data:image/png;base64," + base64.b64encode(photo_b).decode()

print("== 1. ai-gen 第一发 ==")
r1 = client.post("/api/companion/custom/ai-gen", json={
    "token": token, "image": photo_url, "mime": "image/png", "hint": "戴红领巾"}).json()
ok(r1.get("ok") is True, "生成成功", {k: r1.get(k) for k in ("ok", "left", "mock")})
ok(r1.get("mock") is True, "MOCK 路径", r1.get("mock"))
ok(str(r1.get("gen_id", "")).startswith("ag_"), "gen_id", r1.get("gen_id"))
ok(r1.get("left") == 2, "扣 1 次剩 2", r1.get("left"))
ok(str(r1.get("preview", "")).startswith("data:image/png;base64,"), "预览 dataURL")

print("== 2. ai-save 落库 ==")
s1 = client.post("/api/companion/custom/ai-save", json={
    "token": token, "gen_id": r1.get("gen_id"), "name": "小 AI",
    "template": "cheerful", "extra": "喜欢用游戏术语讲题"}).json()
ok(s1.get("ok") is True, "保存成功", {k: s1.get(k) for k in ("ok", "replaced")})
char1 = s1.get("char") or {}
ok(str(char1.get("id", "")).startswith("cu_"), "cu_ 前缀", char1.get("id"))
ok(char1.get("name") == "小 AI", "名字", char1.get("name"))
ok(bool(char1.get("src")), "图片地址", char1.get("src"))
ok(s1.get("replaced") == 0, "首次无替换", s1.get("replaced"))

img = client.get(char1.get("src") or "/api/companion/custom/image/none")
ok(img.status_code == 200 and img.headers.get("content-type", "").startswith("image/png"),
   "图片下发 PNG", (img.status_code, img.headers.get("content-type")))

print("== 3. 替换旧角色（每账号至多 1 个） ==")
r2 = client.post("/api/companion/custom/ai-gen", json={
    "token": token, "image": photo_url, "mime": "image/png"}).json()
ok(r2.get("ok") is True and r2.get("left") == 1, "第二发生成剩 1", r2.get("left"))
s2 = client.post("/api/companion/custom/ai-save", json={
    "token": token, "gen_id": r2.get("gen_id"), "name": "新 AI", "template": "gentle"}).json()
ok(s2.get("ok") is True and s2.get("replaced") == 1, "替换旧角色", {k: s2.get(k) for k in ("ok", "replaced")})
lst = client.post("/api/companion/custom/list", json={"token": token}).json()
chars = lst.get("chars") or []
ok(len(chars) == 1, "列表只剩 1 个", len(chars))
ok((chars[0] or {}).get("name") == "新 AI", "新角色名", (chars[0] or {}).get("name"))

print("== 4. 边界 ==")
bad_save = client.post("/api/companion/custom/ai-save", json={
    "token": token, "gen_id": "ag_expired_id", "name": "X", "template": "cool"}).json()
ok(bad_save.get("ok") is False and "过期" in (bad_save.get("error") or ""), "过期 gen_id 拒绝", bad_save.get("error"))
bad_name = client.post("/api/companion/custom/ai-save", json={
    "token": token, "gen_id": "ag_x", "name": "", "template": "cool"}).json()
ok(bad_name.get("ok") is False, "空名字拒绝", bad_name.get("error"))

r3 = client.post("/api/companion/custom/ai-gen", json={
    "token": token, "image": photo_url, "mime": "image/png"}).json()
ok(r3.get("ok") is True and r3.get("left") == 0, "第三发生成剩 0", r3.get("left"))
r4 = client.post("/api/companion/custom/ai-gen", json={
    "token": token, "image": photo_url, "mime": "image/png"}).json()
ok(r4.get("ok") is False and r4.get("left") == 0, "第 4 次拒绝", r4.get("error"))

guest = client.post("/api/companion/custom/ai-gen", json={"image": photo_url}).json()
ok(guest.get("ok") is False, "游客拒绝", guest.get("error"))

print("\nAI造角色接口回归: %d 通过 / %d 失败" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
