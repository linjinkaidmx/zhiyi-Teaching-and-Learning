# -*- coding: utf-8 -*-
"""今日学习建议接口离线回归（2026-10-10）：MOCK 模式 TestClient，不连网不花钱。

覆盖：空上下文拒绝 / 正常生成 / 24h 缓存命中 / 数据不足引导文案。
用法：cd backend && python _test_analyze_daily.py（zhiyi 环境的 python）
"""

import test_support  # isolated database, no credentials or network
import os
import sys

os.environ["MOCK"] = "1"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)
PASS = 0
FAIL = 0


def ok(cond, name, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  OK  " + name)
    else:
        FAIL += 1
        print("  FAIL " + name + "  " + str(extra))


print("\n== 1. 空上下文直接拒绝（不进模型） ==")
r = client.post("/api/analyze/daily", json={"summary": {}})
ok(r.status_code == 200 and r.json().get("ok") is False, "空 summary 拒绝", r.json())

print("\n== 2. 正常生成（MOCK） ==")
payload = {
    "summary": {
        "date": "2026-10-10",
        "lessons": [{"start": "10:15", "end": "10:55", "name": "数据结构"}],
        "due": 3,
        "weak_points": [{"name": "动态规划", "errorRate": "68%"}],
        "next_chapter": {"subject": "数据结构", "current": "第 3 章 栈与队列", "name": "第 4 章 树与二叉树"},
    }
}
r = client.post("/api/analyze/daily", json=payload)
d = r.json()
ok(d.get("ok") is True, "ok=true", d)
items = (d.get("data") or {}).get("items") or []
ok(len(items) >= 1 and all(i.get("title") for i in items), "items 非空且带 title", items)
ok(bool((d.get("data") or {}).get("summary")), "summary 存在")

print("\n== 3. 相同上下文命中缓存 ==")
r2 = client.post("/api/analyze/daily", json=payload)
d2 = r2.json()
ok(d2.get("cached") is True, "cached=true", d2)
ok((d2.get("data") or {}).get("items") == items, "缓存内容一致")

print("\n== 4. 上下文变化 → 不命中旧缓存（重新生成） ==")
payload2 = {"summary": dict(payload["summary"], due=5)}
r3 = client.post("/api/analyze/daily", json=payload2)
ok(r3.json().get("cached") is False, "due 变化重新生成", r3.json())

print("\n== 5. 只有课表也能生成 ==")
r4 = client.post("/api/analyze/daily", json={"summary": {"date": "2026-10-10", "lessons": [{"start": "08:30", "end": "09:15", "name": "高数"}]}})
ok(r4.json().get("ok") is True, "仅课表可生成", r4.json())

print("\n结果：%d 通过 / %d 失败" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
