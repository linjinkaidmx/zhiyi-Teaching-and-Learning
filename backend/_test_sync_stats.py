# -*- coding: utf-8 -*-
"""打卡/成就云同步接口测试（本地跑，无需联网）：
- 先给 Unix 专有的 resource 模块打桩（main.py 需要），再用 FastAPI TestClient 直打接口
- 验证：push 带 stats → pull 能读回；push 不带 stats → 不覆盖云端统计（老客户端兼容）

用法：python _test_sync_stats.py
"""
import os
import sys
import tempfile
import types

# 使用独立测试库，避免污染本地开发数据（db.DB_FILE 支持 ZHIYI_DB 覆盖）
os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_sync_%d.db" % os.getpid()))

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


NICK = "stats_test_%d" % (os.getpid() % 100000)
STATS = {
    "version": 1,
    "days": {"2026-09-19": {"count": 3, "actions": {"quiz": 3}, "checked": True, "goalMet": False, "shield": False}},
    "streak": {"current": 2, "longest": 5, "lastCheckin": "2026-09-19", "shields": 1, "nextShieldIn": 5},
    "totals": {"explain": 1, "quiz": 3, "correct": 2},
    "achievements": {"first_explain": {"at": "2026-09-19T02:00:00.000Z"}},
    "settings": {"goalEnabled": True, "goalQuestions": 5},
    "refSeen": ["calc"],
}

print(f"测试账号：{NICK}")

# 1) 注册
r = client.post("/api/account/register", json={"nickname": NICK, "password": "test123456", "password_confirm": "test123456"})
body = r.json()
ok(body.get("ok") is True, "注册测试账号", body)
token = body.get("token", "")

# 2) push（带错题本与统计）
r = client.post("/api/sync/push", json={"token": token, "items": [{"id": 1, "question": "测试题", "mastered": False}], "stats": STATS})
body = r.json()
ok(body.get("ok") is True, "push 带 stats 成功", body)

# 3) pull 回读
r = client.post("/api/sync/pull", json={"token": token})
body = r.json()
ok(body.get("ok") is True, "pull 成功", body)
ok(len(body.get("items") or []) == 1, "错题本回读 1 条")
st = body.get("stats") or {}
ok(st.get("streak", {}).get("current") == 2, "连续天数回读正确", st.get("streak"))
ok(st.get("totals", {}).get("quiz") == 3, "统计总量回读正确", st.get("totals"))
ok(st.get("achievements", {}).get("first_explain") is not None, "成就记录回读正确")
ok(st.get("days", {}).get("2026-09-19", {}).get("checked") is True, "每日记录回读正确")

# 4) 老客户端：push 不带 stats → 不覆盖云端统计
r = client.post("/api/sync/push", json={"token": token, "items": [{"id": 1, "question": "测试题", "mastered": True}]})
body = r.json()
ok(body.get("ok") is True, "push 不带 stats 仍成功（老客户端兼容）", body)
r = client.post("/api/sync/pull", json={"token": token})
st2 = (r.json().get("stats") or {})
ok(st2.get("streak", {}).get("current") == 2, "云端统计未被空 stats 清空")
ok(len(r.json().get("items") or []) == 1, "错题本仍为 1 条")

# 5) 鉴权：错误 token 应被拒绝
r = client.post("/api/sync/pull", json={"token": "bad-token"})
body = r.json()
ok(body.get("ok") is False, "无效 token 被拒绝", body)

# 6) 直接查库确认落了 user_stats 表
raw = main.db.load_stats(NICK)
ok(raw.get("settings", {}).get("goalQuestions") == 5, "db.load_stats 直读正确", raw.get("settings"))
ok(main.db.load_stats("__not_exist__") == {}, "不存在的用户返回空统计")

print()
print("=" * 46)
print(f"全部通过（{pass_n} 项）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
