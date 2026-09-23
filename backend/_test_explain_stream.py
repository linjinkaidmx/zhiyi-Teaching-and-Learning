# -*- coding: utf-8 -*-
"""批次3 测试：/api/explain/stream 端点 + depth 参数
用法：python _test_explain_stream.py
"""
import json
import os
import sys
import tempfile
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_b3_%d.db" % os.getpid()))

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

os.environ.setdefault("MOCK", "1")

import main  # noqa: E402
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


def read_sse(resp):
    events = []
    for line in resp.iter_lines():
        if isinstance(line, bytes):
            line = line.decode("utf-8")
        if line and line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


QUESTION = r"计算定积分 $\int_0^1 x^2\,dx$"

print("\n1. 流式端点基本行为")
r = client.post("/api/explain/stream", json={"question": QUESTION, "attempt": "", "depth": "standard"})
ok(r.status_code == 200, "HTTP 200")
ok(r.headers.get("content-type", "").startswith("text/event-stream"), "content-type 为 event-stream")
ok(r.headers.get("x-accel-buffering") == "no", "带 X-Accel-Buffering: no")
evs = read_sse(r)
kinds = [k for e in evs for k in e.keys()]
ok("delta" in kinds and "field_done" in kinds and "done" in kinds, "事件类型齐全", sorted(set(kinds)))
ok(kinds.count("done") == 1, "done 只出现一次")

print("\n2. 事件能拼回完整结果")
assembled = {}
for e in evs:
    if "delta" in e:
        assembled[e["field"]] = assembled.get(e["field"], "") + e["delta"]
final = [e["result"] for e in evs if "done" in e][0]
expect = dict(service.flatten_explain_fields(final))
bad = {k: (assembled.get(k), v) for k, v in expect.items() if assembled.get(k) != v}
ok(not bad, "增量拼接结果 == done 事件里的 result", bad)
ok(assembled.get("answer") == final.get("answer"), "answer 字段一致")
ok(any(k.startswith("steps[") for k in assembled), "含步骤字段增量")

print("\n3. 每个增量事件都带 field（前端要按字段路由）")
ok(all(isinstance(e.get("field"), str) and e["field"] for e in evs if "delta" in e), "delta 事件都有 field")
ok(all(isinstance(e.get("field_done"), str) for e in evs if "field_done" in e), "field_done 事件都有路径")

print("\n4. 深度参数生效（Mock 下字段数量不同）")


def count_fields(depth):
    resp = client.post("/api/explain/stream", json={"question": QUESTION, "attempt": "", "depth": depth})
    d = [e["result"] for e in read_sse(resp) if "done" in e][0]
    return len(service.flatten_explain_fields(d))


n_brief, n_std, n_deep = count_fields("brief"), count_fields("standard"), count_fields("deep")
ok(n_brief < n_std, f"基础档字段更少（{n_brief} < {n_std}）")
ok(n_deep >= n_std, f"深入档不少于标准档（{n_deep} >= {n_std}）")

print("\n5. 非流式端点也接受 depth")
r = client.post("/api/explain", json={"question": QUESTION, "attempt": "", "depth": "brief"})
ok(r.status_code == 200 and r.json().get("ok"), "非流式 explain 接受 depth 且成功", r.text[:80])
r2 = client.post("/api/explain", json={"question": QUESTION, "attempt": "", "depth": "乱写"})
ok(r2.status_code == 200 and r2.json().get("ok"), "非法 depth 兜底不报错")

print("\n6. 参数校验")
r = client.post("/api/explain/stream", json={"question": "   ", "attempt": ""})
ok(r.status_code == 200 and r.json().get("ok") is False, "空题被拒绝（返回 JSON 而非 SSE）", r.text[:60])

print("\n7. 作答痕迹（带 attempt 时走诊断路径）")
r = client.post("/api/explain/stream", json={"question": QUESTION, "attempt": "我算成了 1/2", "depth": "standard"})
evs2 = read_sse(r)
d2 = [e["result"] for e in evs2 if "done" in e][0]
ok(bool(d2.get("diagnosis")), "带作答痕迹时给出错因诊断")
ok(any(e.get("field") == "diagnosis" for e in evs2 if "delta" in e), "diagnosis 也被流式下发")

print("\n8. 降级路径（首 token 前失败 → 非流式兜底）")
# 注意：MOCK=1 时 explain_stream 走 Mock 分支，不会碰 _stream_chat，
# 所以这段必须临时把 MOCK 关掉，并把 explain_question 换成 Mock 数据以保持离线。
orig_stream = service._stream_chat
orig_explain = service.explain_question
orig_mock = service.MOCK


def boom(*a, **k):
    raise RuntimeError("模拟首 token 失败")
    yield ""  # noqa: 让它成为生成器


service.MOCK = False
service._stream_chat = boom
service.explain_question = lambda q, a="", d="standard": service._mock_explain_for(a, d)
try:
    evs3 = list(service.explain_stream(QUESTION, "", "standard"))
finally:
    service._stream_chat = orig_stream
    service.explain_question = orig_explain
    service.MOCK = orig_mock
d3 = [e for e in evs3 if "done" in e]
ok(bool(d3), "降级后仍返回 done（用户能拿到讲解）")
if d3:
    ok(d3[0].get("fallback") is True, "标出 fallback=True 便于前端提示")
    ok(bool(d3[0]["result"].get("answer")), "降级结果里有答案")
ok(not [e for e in evs3 if "error" in e], "降级成功时不报错")

print("\n9. 已出字后失败 → 报错（不降级，避免内容错乱）")


def boom_mid(*a, **k):
    yield '{"answer": "1/3'
    raise RuntimeError("模拟中途断开")


service.MOCK = False
service._stream_chat = boom_mid
try:
    evs4 = list(service.explain_stream(QUESTION, "", "standard"))
finally:
    service._stream_chat = orig_stream
    service.MOCK = orig_mock
ok(any("error" in e for e in evs4), "中途失败会给出 error 事件")
ok(any("delta" in e for e in evs4), "失败前已出的内容照常下发")
ok(not [e for e in evs4 if "done" in e], "中途失败不发 done（前端据此报错）")

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项断言）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
