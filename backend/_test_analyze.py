# -*- coding: utf-8 -*-
"""批次4 测试：/api/analyze/errorbook（含 24h 缓存与 TTL）
用法：python _test_analyze.py
"""
import json
import os
import sys
import tempfile
import time
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_b4_%d.db" % os.getpid()))

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


SUMMARY = {
    "total": 12,
    "mastered": 3,
    "points": [
        {"name": "定积分", "total": 6, "quiz": 9, "correct": 3, "mastered": 1},
        {"name": "极限", "total": 3, "quiz": 4, "correct": 3, "mastered": 2},
    ],
    "reasons": [{"type": "计算失误", "count": 5}, {"type": "方法选择错误", "count": 3}],
}
SAMPLES = ["计算定积分 ∫0^1 x^2 dx", "求极限 lim(x→0) sin x / x"]

print("\n1. 基本分析")
r = client.post("/api/analyze/errorbook", json={"summary": SUMMARY, "sample_questions": SAMPLES})
d = r.json()
ok(r.status_code == 200 and d.get("ok"), "返回 ok", r.text[:120])
ok(d.get("cached") is False, "首次调用非缓存")
data = d.get("data", {})
ok(isinstance(data.get("weak_points"), list) and len(data["weak_points"]) >= 1, "含薄弱点列表")
wp = data["weak_points"][0]
ok(bool(wp.get("name")) and bool(wp.get("advice")), "薄弱点含 name/advice", wp)
ok(isinstance(data.get("reason_advice"), list) and bool(data["reason_advice"][0].get("advice")), "含错因建议")
ok(bool(data.get("summary")), "含总结")

print("\n2. 缓存：同摘要 24h 内命中")
r2 = client.post("/api/analyze/errorbook", json={"summary": SUMMARY, "sample_questions": SAMPLES})
ok(r2.json().get("cached") is True, "第二次命中缓存")
ok(r2.json()["data"].get("generatedAt") == d["data"].get("generatedAt"), "缓存内容与首次一致")
ok(r2.json()["data"].get("cached") is True, "缓存结果里也带 cached 标记（前端好展示）")

print("\n3. 摘要变化 → 重新分析")
changed = json.loads(json.dumps(SUMMARY))
changed["points"][0]["correct"] = 4
r3 = client.post("/api/analyze/errorbook", json={"summary": changed, "sample_questions": SAMPLES})
ok(r3.json().get("cached") is False, "摘要变了就不复用缓存")

print("\n4. 样例题变化也算变化")
r4 = client.post("/api/analyze/errorbook", json={"summary": SUMMARY, "sample_questions": SAMPLES + ["新题"]})
ok(r4.json().get("cached") is False, "样例题不同 → 新缓存键")

print("\n5. TTL 过期后失效")
key = main._analysis_cache_key(SUMMARY, SAMPLES)
ok(db.get_analysis_cache(key) is not None, "缓存当前有效")
ok(db.get_analysis_cache(key, ttl_ms=0) is None, "TTL=0 视为过期 → 不命中")
# 过期读取会顺手删除
ok(db.get_analysis_cache(key) is None, "过期项已被清理")

print("\n6. 参数校验")
r5 = client.post("/api/analyze/errorbook", json={"summary": {}, "sample_questions": []})
ok(r5.json().get("ok") is False, "空摘要被拒绝", r5.text[:80])
r6 = client.post("/api/analyze/errorbook", json={"summary": {"total": 2}, "sample_questions": []})
ok(r6.status_code == 200, "只有 total 也能跑（不报错）")

print("\n7. 提示词与截断（省 token）")
prompt_src = service.ANALYZE_PROMPT
ok("不要编造" in prompt_src or "不要编造" in prompt_src, "提示词含「不要编造」约束")
ok("最多 5 个" in prompt_src and "最多 4 类" in prompt_src, "提示词限制数量")
# 超量输入应被裁剪
many = {"total": 99, "mastered": 1,
        "points": [{"name": "p%d" % i, "total": 1, "quiz": 1, "correct": 0, "mastered": 0} for i in range(40)],
        "reasons": [{"type": "r%d" % i, "count": 1} for i in range(20)]}
r7 = client.post("/api/analyze/errorbook", json={"summary": many, "sample_questions": ["q%d" % i for i in range(20)]})
ok(r7.status_code == 200 and r7.json().get("ok"), "超量输入不报错")
key2 = main._analysis_cache_key(many, ["q%d" % i for i in range(20)])
ok(db.get_analysis_cache(key2) is not None, "超量输入也能正常缓存")

print("\n8. 非法数据结构防护")
r8 = client.post("/api/analyze/errorbook", json={"summary": {"points": ["bad", 5, {"name": "ok"}], "total": 3}})
ok(r8.status_code == 200 and r8.json().get("ok"), "points 里有脏数据不报错")
r9 = client.post("/api/analyze/errorbook", json={"summary": "不是对象", "sample_questions": "不是数组"})
ok(r9.status_code in (200, 422), "类型错误被安全处理（422 也可接受）")

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项断言）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
