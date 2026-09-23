# -*- coding: utf-8 -*-
"""批次2 测试：③ AI 对话流式
用法：python _test_chat_stream.py
"""
import json
import os
import sys
import tempfile
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_b2c_%d.db" % os.getpid()))

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
    """解析 SSE，返回 (deltas, done, error)"""
    deltas, done, error = [], False, ""
    for line in resp.iter_lines():
        if not line:
            continue
        if isinstance(line, bytes):
            line = line.decode("utf-8")
        if not line.startswith("data: "):
            continue
        payload = json.loads(line[6:])
        if "delta" in payload:
            deltas.append(payload["delta"])
        if payload.get("done"):
            done = True
        if payload.get("error"):
            error = payload["error"]
    return deltas, done, error


print("\n1. 流式返回（Mock 模式）")
r = client.post("/api/chat/stream", json={"messages": [{"role": "user", "text": "什么是时间复杂度？"}], "context": []})
ok(r.status_code == 200, "HTTP 200")
ok(r.headers.get("content-type", "").startswith("text/event-stream"), "content-type 为 event-stream", r.headers.get("content-type"))
ok("no" == r.headers.get("x-accel-buffering", "no"), "带 X-Accel-Buffering: no（防代理缓冲）", r.headers.get("x-accel-buffering"))
deltas, done, error = read_sse(r)
text = "".join(deltas)
ok(len(deltas) >= 3, f"收到多片增量（{len(deltas)} 片）")
ok(done is True, "以 done 事件结束")
ok(error == "", "无错误事件")
ok(len(text) > 60, "拼接后的回答有实际内容", len(text))

print("\n2. 引用学习内容进入上下文（直接测消息构造）")
msgs = service.chat_messages(
    [{"role": "user", "text": "这道题为什么用换元？"}],
    [{"title": "定积分换元法错题", "brief": "高数"}, {"title": "分部积分"}],
)
system = msgs[0]
ok(system["role"] == "system", "第一条是 system 提示词")
ok("定积分换元法错题" in system["content"] and "分部积分" in system["content"], "引用内容注入 system 提示")
ok("不得编造" in system["content"], "提示词包含「不得编造引用里的信息」约束")
ok(msgs[-1]["content"] == "这道题为什么用换元？", "用户问题在最后")

print("\n3. 历史长度上限（防超长输入刷 token）")
long_history = [{"role": "user", "text": "第%d问" % i} for i in range(20)]
msgs = service.chat_messages(long_history, [])
ok(len(msgs) == 1 + 12, f"只取最近 12 条（实际 {len(msgs) - 1} 条）", len(msgs) - 1)
ok(msgs[-1]["content"] == "第19问", "保留的是最新的消息")

print("\n4. 单条长度截断")
msgs = service.chat_messages([{"role": "user", "text": "x" * 9000}], [])
ok(len(msgs[-1]["content"]) == 4000, f"单条截断到 4000 字（实际 {len(msgs[-1]['content'])}）")

print("\n5. 角色规范化与空消息过滤")
msgs = service.chat_messages(
    [{"role": "assistant", "text": "上轮回答"}, {"role": "怪角色", "text": "提问"}, {"role": "user", "text": "   "}],
    [],
)
roles = [m["role"] for m in msgs]
ok(roles[1] == "assistant", "assistant 保留")
ok(roles[2] == "user", "未知角色被当作 user")
ok(len(msgs) == 3, "空白消息被过滤（system + 2 条）", len(msgs))

print("\n6. 参数校验")
r = client.post("/api/chat/stream", json={"messages": [], "context": []})
ok(r.status_code == 200 and r.json().get("ok") is False, "空对话被拒绝", r.text[:80])
msgs = service.chat_messages([], [])
ok(msgs[-1]["role"] == "user", "无消息时补一条占位 user（避免模型报错）")

print("\n7. 异常输入不炸")
ok(len(service.chat_messages(None, None)) == 2, "None 入参安全")
ok(len(service.chat_messages([{"role": "user", "text": "hi"}], [None, 5, {"title": ""}])) == 2, "非法 context 项被跳过")

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项断言）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
