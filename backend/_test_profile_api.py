# -*- coding: utf-8 -*-
"""个人主页后端接口测试（本地 TestClient，无需联网）：
- resource 模块打桩（Windows 上 main.py 需要）
- 覆盖：资料读写 / 改昵称（含数据迁移与重签 token）/ 重置备份码（含用它找回密码）/ 反馈 / 注销账号
用法：python _test_profile_api.py
"""
import os
import sys
import tempfile
import types

# 使用独立测试库，避免污染本地开发数据（db.DB_FILE 支持 ZHIYI_DB 覆盖）
os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_profile_%d.db" % os.getpid()))

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

os.environ.setdefault("MOCK", "1")

import main  # noqa: E402
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
        print("  ✗ " + label + (f"  → {extra}" if extra is not None else ""))


def post(path, body):
    return client.post(path, json=body).json()


NICK = "pf_test_%d" % (os.getpid() % 100000)
NEW_NICK = NICK + "_new"
PW = "test123456"

print(f"测试账号：{NICK}")

# --- 注册
r = post("/api/account/register", {"nickname": NICK, "password": PW, "password_confirm": PW})
ok(r.get("ok") is True, "注册测试账号", r)
token = r.get("token", "")

# --- 资料读写
r = post("/api/account/profile", {"token": token})
ok(r.get("ok") is True and r.get("profile") == {}, "新账号资料为空")
ok(bool(r.get("registeredAt")), "返回加入时间")
uid = r.get("userId")
ok(uid is not None, "返回知一 ID（数据库自增 id）")

profile = {
    "avatar": "data:image/jpeg;base64,AAAA",
    "bio": "期末周把高数错题清一遍",
    "school": "××大学",
    "major": "计算机科学与技术",
    "grade": "大三",
    "prefs": {"defaultMode": "fast", "renderMath": False, "fontScale": "lg", "subject": "高等数学"},
}
r = post("/api/account/profile/save", {"token": token, "profile": profile})
ok(r.get("ok") is True, "保存资料", r)
r = post("/api/account/profile", {"token": token})
saved = r.get("profile") or {}
ok(saved.get("bio") == profile["bio"], "签名已保存")
ok(saved.get("prefs", {}).get("renderMath") is False, "偏好已保存（公式渲染关闭）")
ok(saved.get("prefs", {}).get("fontScale") == "lg", "偏好已保存（字号）")

r = post("/api/account/profile/save", {"token": token, "profile": {"avatar": "x" * 400_001}})
ok(r.get("ok") is False, "超大头像被拒绝")

# --- 先写入一份错题本与统计（用于验证改名迁移）
r = post("/api/sync/push", {
    "token": token,
    "items": [{"id": 1, "question": "迁移测试题", "mastered": False}],
    "stats": {"streak": {"current": 3, "lastCheckin": "2026-09-19"}},
})
ok(r.get("ok") is True, "改造名前先推一份云端数据", r)

# --- 改昵称
r = post("/api/account/rename", {"token": token, "password": "wrong-password", "new_nickname": NEW_NICK})
ok(r.get("ok") is False, "密码错误时拒绝改名")

r = post("/api/account/register", {"nickname": "occupy_%d" % (os.getpid() % 100000), "password": PW, "password_confirm": PW})
taken = "occupy_%d" % (os.getpid() % 100000)
r = post("/api/account/rename", {"token": token, "password": PW, "new_nickname": taken})
ok(r.get("ok") is False, "昵称被占用时拒绝改名")

r = post("/api/account/rename", {"token": token, "password": PW, "new_nickname": "x"})
ok(r.get("ok") is False, "昵称过短被拒绝")

r = post("/api/account/rename", {"token": token, "password": PW, "new_nickname": NEW_NICK})
ok(r.get("ok") is True, "改名成功并返回新 token", r)
new_token = r.get("token", "")
ok(new_token and new_token != token, "返回的是新 token（token 里编码昵称）")

r = post("/api/account/verify", {"token": new_token})
ok(r.get("ok") is True, "新 token 可正常使用")

r = post("/api/sync/pull", {"token": new_token})
ok(len(r.get("items") or []) == 1, "错题本随昵称迁移（新 token 能拉到）", r.get("items"))
ok((r.get("stats") or {}).get("streak", {}).get("current") == 3, "打卡统计随昵称迁移")
r2 = post("/api/account/profile", {"token": new_token})
ok((r2.get("profile") or {}).get("school") == "××大学", "个人资料随昵称迁移")

r = post("/api/account/login", {"nickname": NICK, "password": PW})
ok(r.get("ok") is False, "旧昵称已不能登录")
r = post("/api/account/login", {"nickname": NEW_NICK, "password": PW})
ok(r.get("ok") is True, "新昵称可以登录")

# --- 重置备份码 + 用它找回密码
r = post("/api/account/reset-backup", {"token": new_token, "password": "wrong"})
ok(r.get("ok") is False, "密码错误时拒绝重置备份码")

r = post("/api/account/reset-backup", {"token": new_token, "password": PW})
ok(r.get("ok") is True and len(str(r.get("backup"))) >= 6, "重置备份码成功", r)
backup = r.get("backup")

r = post("/api/account/recover", {"nickname": NEW_NICK, "backup_code": backup,
                                  "new_password": "newpass123456", "password_confirm": "newpass123456"})
ok(r.get("ok") is True, "用新备份码可找回密码", r)
r = post("/api/account/login", {"nickname": NEW_NICK, "password": "newpass123456"})
ok(r.get("ok") is True, "新密码可登录")
token = r.get("token", "")
PW2 = "newpass123456"

# --- 意见反馈
r = post("/api/feedback", {"token": token, "content": "短"})
ok(r.get("ok") is False, "过短的反馈被拒绝")
r = post("/api/feedback", {"token": token, "content": "希望增加自定义头像框，另外速查页想加个搜索联想。", "contact": "", "version": "v2.0"})
ok(r.get("ok") is True, "反馈提交成功", r)
ok(main.db.load_stats(NEW_NICK) is not None, "反馈写入不影响其他数据")

# --- 注销账号
r = post("/api/account/delete", {"token": token, "password": "wrong"})
ok(r.get("ok") is False, "密码错误时拒绝注销")
r = post("/api/account/delete", {"token": token, "password": PW2})
ok(r.get("ok") is True, "注销成功", r)
ok(main.db.find_profile_by_nickname(NEW_NICK) is None, "账号记录已删除")
ok(main.db.load_errorbook(NEW_NICK) == [], "云端错题本已清空")
ok(main.db.load_stats(NEW_NICK) == {}, "云端统计已清空")
ok(main.db.load_profile_data(NEW_NICK) == {}, "云端资料已清空")
r = post("/api/sync/pull", {"token": token})
ok(r.get("ok") is False, "注销后旧 token 失效")

# ---------------------------------------------------------------- 回归：改昵称 / 注销必须覆盖所有带 user_id 的表
# 背景：批次1 新增 user_courses / user_sessions 后，rename_user 与 delete_user 仍硬编码三张表，
#       导致改昵称后课程与学习记录变成孤儿数据（线上实测抓到）。这里锁死行为。

print("\n[回归] 改昵称迁移与注销清理要覆盖课程 / 学习记录")
NICK2 = "pf_reg_%d" % (os.getpid() % 100000)
NEW2 = NICK2 + "n"
r = post("/api/account/register", {"nickname": NICK2, "password": PW, "password_confirm": PW})
ok(r.get("ok") is True, "建回归专用账号", r)
tok2 = r.get("token", "")

r = post("/api/sync/push", {
    "token": tok2,
    "items": [{"id": "reg-e1", "question": "回归题", "answer": "1"}],
    "stats": {"days": [20260920], "totals": {}, "achievements": []},
    "courses": {"courses": [{"id": "reg-c1", "name": "回归课程"}], "timetable": [], "deletedIds": []},
    "sessions": [{"id": "reg-s1", "type": "explain", "title": "回归记录", "minutes": 1, "createdAt": 1}],
})
ok(r.get("ok") is True, "写入四类数据", r)

r = post("/api/account/rename", {"token": tok2, "password": PW, "new_nickname": NEW2})
ok(r.get("ok") is True, "改名成功", r)
tok2b = r.get("token", "")
d = post("/api/sync/pull", {"token": tok2b})
ok((d.get("courses") or {}).get("courses", [{}])[0].get("name") == "回归课程",
   "改昵称后课程跟着迁移（曾经丢失）", (d.get("courses") or {}).get("courses"))
ok((d.get("sessions") or [{}])[0].get("id") == "reg-s1",
   "改昵称后学习记录跟着迁移（曾经丢失）", d.get("sessions"))
ok(main.db.load_courses(NICK2) == {}, "旧昵称下已无课程数据（不是复制而是迁移）")
ok(main.db.load_sessions(NICK2) == [], "旧昵称下已无学习记录")

r = post("/api/account/delete", {"token": tok2b, "password": PW})
ok(r.get("ok") is True, "注销成功", r)
ok(main.db.load_courses(NEW2) == {}, "注销后课程已清空（曾经残留孤儿数据）", main.db.load_courses(NEW2))
ok(main.db.load_sessions(NEW2) == [], "注销后学习记录已清空", main.db.load_sessions(NEW2))
ok(len(main.db.USER_SCOPED_TABLES) >= 5, "USER_SCOPED_TABLES 清单包含 5 张表", list(main.db.USER_SCOPED_TABLES))

print()
print("=" * 46)
print(f"全部通过（{pass_n} 项）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
