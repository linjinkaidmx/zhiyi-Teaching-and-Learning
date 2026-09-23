# -*- coding: utf-8 -*-
"""SSE 接口层测试：用桩模块替代 Unix 专有 resource 模块，本地跑通 HTTP/SSE 全链路。

用法：python _test_sse.py
说明：默认 MOCK=1（不调模型，只验证协议层）；加 --real 则真实调用快答档。
"""
import json
import os
import sys
import types

if sys.platform == "win32":
    # main.py 依赖 Unix 专有的 resource（生产在 Linux 上跑）；本地用空实现顶替
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

REAL = "--real" in sys.argv
os.environ["MOCK"] = "0" if REAL else "1"

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app)

BODY = {
    "question": r"计算定积分：$\int_0^1 x^2\,dx$",
    "result": {
        "answer": r"$\frac{1}{3}$",
        "steps": [{"title": "求原函数", "detail": r"$\int x^2dx = \frac{x^3}{3}+C$"}],
        "knowledge_points": ["定积分"],
    },
    "history": [{"q": "这里为什么要用公式？", "a": "因为被积函数连续。"}],
    "followup": "第三步为什么要减 F(a)？",
    "mode": "fast",
}


def check(path, body, label):
    deltas, done, err = 0, False, None
    chars = 0
    with client.stream("POST", path, json=body) as r:
        print(f"[{label}] status={r.status_code} content-type={r.headers.get('content-type')}")
        assert r.status_code == 200, f"状态码异常 {r.status_code}"
        assert "text/event-stream" in r.headers.get("content-type", ""), "content-type 不是 SSE"
        for line in r.iter_lines():
            if not line:
                continue
            assert line.startswith("data: "), f"非法帧：{line[:60]}"
            evt = json.loads(line[5:])
            if "delta" in evt:
                deltas += 1
                chars += len(evt["delta"])
            if evt.get("done"):
                done = True
            if "error" in evt:
                err = evt["error"]
    print(f"[{label}] delta 帧 {deltas} 个 · 正文 {chars} 字 · done={done} · error={err}")
    assert not err, f"流式返回错误：{err}"
    assert deltas > 0 and done, "未收到正文或未收到 done 帧"
    print(f"[{label}] OK\n")


check("/api/follow-up/stream", BODY, "追问 SSE")
check("/api/reteach/stream", {"question": BODY["question"], "result": BODY["result"], "angle": "visual"}, "换个讲法 SSE")

# 空问题应被拒绝（非流式返回）
r = client.post("/api/follow-up/stream", json={**BODY, "followup": "  "})
print("[空问题]", r.status_code, r.json())
assert r.status_code == 200 and r.json().get("ok") is False

# 真流式（非 MOCK）下也要拿到完整分片
print("全部通过。")
