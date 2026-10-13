"""流式统一回归：伴学流式 + 课堂讲义流式（MOCK 模式）。

用法：python _test_stream_unify.py
要点：SSE 帧序列、伴学配额/落库副作用、课堂首次生成 vs 幂等回放、降级链。
"""
import json
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

os.environ.setdefault("MOCK", "1")
_tmp = tempfile.mkdtemp(prefix="zhiyi_stream_test_")
os.environ["ZHIYI_DB"] = os.path.join(_tmp, "test.db")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    print(("[PASS] " if cond else "[FAIL] ") + name + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


client = TestClient(main.app)
PW = "pass123456"
reg = client.post("/api/account/register", json={"nickname": "stream_tester", "password": PW, "password_confirm": PW}).json()
check("注册账号", reg.get("ok") is True)
tok = reg["token"]


def sse_frames(text):
    out = []
    for block in text.split("\n\n"):
        line = [l for l in block.split("\n") if l.startswith("data:")]
        if not line:
            continue
        try:
            out.append(json.loads(line[0][5:].strip()))
        except Exception:
            pass
    return out


# ---------------- 伴学流式 ----------------
r = client.post("/api/companion/chat/stream", json={"token": tok, "message": "在吗？", "character": "default", "session_id": "s1"})
check("伴学流式 HTTP 200", r.status_code == 200, str(r.status_code))
check("伴学流式 Content-Type", "text/event-stream" in (r.headers.get("content-type") or ""), r.headers.get("content-type"))
frames = sse_frames(r.text)
deltas = [f for f in frames if "delta" in f]
done = [f for f in frames if f.get("done")]
check("伴学流式有 delta 帧", len(deltas) > 0, f"{len(deltas)} 帧")
check("伴学流式有 done 帧", len(done) == 1, str(len(done)))
if done:
    reply = done[0].get("reply") or ""
    check("done 带完整 reply", len(reply) > 5, repr(reply[:40]))
    joined = "".join(f.get("delta") or "" for f in deltas)
    check("delta 拼接 == done.reply（内容一致）", joined.strip() == reply.strip(), f"{joined[:30]!r} vs {reply[:30]!r}")

h = client.post("/api/companion/history", json={"token": tok, "character": "default", "session_id": "s1"}).json()
msgs = h.get("msgs") or []
check("伴学流式后消息已落库（≥2 条：问 + 答）", len(msgs) >= 2, f"{len(msgs)} 条")

r2 = client.post("/api/companion/chat/stream", json={"token": "", "message": "hi"}).json()
check("未登录伴学流式被拒", r2.get("ok") is False, str(r2)[:80])

# ---------------- 课堂讲义流式 ----------------
r = client.post("/api/teach/syllabus", json={"token": tok, "subject": "高等数学"}).json()
check("创建课程（teach/syllabus）", r.get("ok") is True, str(r)[:120])
sid = r.get("syllabus_id") or (r.get("syllabus") or {}).get("id")
check("拿到 syllabus_id", bool(sid), str(r)[:80])

# 首次：该知识点还没讲义 → 真生成
r = client.post("/api/teach/stream", json={"token": tok, "syllabus_id": sid, "kp_index": 0, "minutes": 30})
check("课堂流式 HTTP 200", r.status_code == 200, str(r.status_code))
frames = sse_frames(r.text)
done = [f for f in frames if f.get("done")]
check("课堂流式（首次生成）有 done", len(done) == 1, str(len(frames)))
if done:
    lec = done[0].get("lecture") or {}
    check("首次讲义含 kp/exam", bool(lec.get("kp") and lec.get("exam")), str(list(lec.keys()))[:80])
    check("首次讲义带 session_id", bool(done[0].get("session_id")), str(done[0].get("session_id"))[:40])
    check("首次不是回放（reused 不为 True）", not done[0].get("reused"), str(done[0].get("reused")))

# 第二次同一知识点：应命中幂等回放（不花额度）
r = client.post("/api/teach/stream", json={"token": tok, "syllabus_id": sid, "kp_index": 0, "minutes": 30})
frames = sse_frames(r.text)
done = [f for f in frames if f.get("done")]
check("幂等回放有 done", len(done) == 1, str(len(frames)))
if done:
    check("幂等回放标记 reused", done[0].get("reused") is True, str(done[0])[:100])
    check("回放带完整讲义", bool((done[0].get("lecture") or {}).get("exam")), str(done[0])[:100])

# 另一个知识点：新生成
r = client.post("/api/teach/stream", json={"token": tok, "syllabus_id": sid, "kp_index": 1, "minutes": 30})
frames = sse_frames(r.text)
done = [f for f in frames if f.get("done")]
check("课堂流式（新知识点）有 done", len(done) == 1, str(len(frames)))

r2 = client.post("/api/teach/stream", json={"token": tok, "syllabus_id": "nope", "kp_index": 0}).json()
check("非法课程被拒", r2.get("ok") is False, str(r2)[:80])

print()
if FAILS:
    print(f"FAILED: {len(FAILS)} -> {FAILS}")
    sys.exit(1)
print("ALL PASS")
