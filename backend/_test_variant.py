# -*- coding: utf-8 -*-
"""批次2 测试：⑥ 变式题生成（含缓存）
用法：python _test_variant.py
"""
import json
import os
import sys
import tempfile
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_b2v_%d.db" % os.getpid()))

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
import service  # noqa: E402
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


def variant(**kw):
    body = {"question": r"计算定积分 $\int_0^1 x^2\,dx$"}
    body.update(kw)
    return client.post("/api/variant", json=body).json()


print("\n1. 基本生成（Mock 模式）")
r = variant()
ok(r.get("ok") is True, "返回 ok", r)
ok(isinstance(r.get("items"), list) and len(r["items"]) >= 1, "items 非空")
it = r["items"][0]
ok(bool(it.get("question")) and bool(it.get("answer")), "题目与答案齐全")
ok("analysis" in it and "knowledge_points" in it, "含解析与知识点字段")
ok(r.get("cached") is False, "首次调用不是缓存")

print("\n2. 缓存命中（同题同策略同数量）")
r2 = variant()
ok(r2.get("ok") is True and r2.get("cached") is True, "第二次调用命中缓存", r2.get("cached"))
ok(r2["items"] == r["items"], "缓存返回内容与首次一致")
stats = db.variant_cache_stats()
ok(stats["entries"] >= 1 and stats["hits"] >= 1, "缓存表有记录且命中数已累加", stats)

print("\n3. 换策略 = 换缓存键（应当重新生成）")
r3 = variant(strategy="change_data")
ok(r3.get("ok") is True and r3.get("cached") is False, "换策略不命中缓存", r3.get("cached"))

print("\n4. 非法策略退化为默认（不报错）")
r4 = variant(strategy="不存在的策略")
ok(r4.get("ok") is True, "非法策略被兜底为 same_point")
ok(r4.get("cached") is True, "退化后与 same_point 共用缓存")

print("\n5. 数量上限保护")
r5 = variant(count=99, strategy="change_angle")
ok(r5.get("ok") is True and len(r5["items"]) <= 3, f"count 被限制到 ≤3（实际 {len(r5.get('items', []))}）")
r6 = variant(count=0, strategy="change_type")
ok(r6.get("ok") is True and len(r6["items"]) >= 1, "count=0 被兜底为 1")

print("\n6. 参数校验")
r7 = client.post("/api/variant", json={"question": "   "}).json()
ok(r7.get("ok") is False, "空题被拒绝")
ok("缺少原题" in str(r7.get("error", "")), "错误信息可读", r7.get("error"))

print("\n7. 策略表完整性")
ok(set(service.VARIANT_STRATEGIES.keys()) == {"same_point", "change_data", "change_angle", "change_type"},
   "四种策略齐全", list(service.VARIANT_STRATEGIES.keys()))

print("\n8. 真实模式下的输出规范化（不联网，直接测函数约定）")
ok(service.VARIANT_PROMPT.count("{" ) >= 1, "提示词含 JSON 契约示例")
ok("items" in service.VARIANT_PROMPT, "提示词要求 items 数组")

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项断言）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
