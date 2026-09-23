"""answer 转录模式（/api/extract mode=answer）接口层测试：MOCK 下验证分支与回归兼容。

用法：python _test_extract_mode.py
说明：Windows 下打桩 resource 模块；默认 MOCK=1，不调真实模型。
"""
import os
import sys
import types

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

os.environ.setdefault("MOCK", "1")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402
import main  # noqa: E402
import service  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f"  ({detail})" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


client = TestClient(main.app)

# 1) 默认 mode=question（不传 mode 也应照常工作，向后兼容）
r = client.post("/api/extract", json={"image_base64": "aGVsbG8=", "mime": "image/png"})
check("默认 mode=question 返回 ok", r.status_code == 200 and r.json().get("ok") is True)
check("question 模式返回题目文本", "定积分" in (r.json().get("data") or {}).get("question", ""))

# 2) 显式 mode=question
r = client.post("/api/extract", json={"image_base64": "aGVsbG8=", "mime": "image/png", "mode": "question"})
check("显式 question 模式 ok", r.status_code == 200 and r.json().get("ok") is True)

# 3) mode=answer：MOCK 返回手写作答转录
r = client.post("/api/extract", json={"image_base64": "aGVsbG8=", "mime": "image/jpeg", "mode": "answer"})
check("answer 模式 ok", r.status_code == 200 and r.json().get("ok") is True)
q = (r.json().get("data") or {}).get("question", "")
check("answer 模式返回手写转录内容", "手写作答转录" in q, q[:40])

# 4) service 层 prompt 选择逻辑
check("answer -> ANSWER_TRANSCRIBE_PROMPT",
      service.analyze_image("aGVsbG8=", "image/png", "answer")["question"] != "")
import inspect  # noqa: E402
sig = inspect.signature(service.analyze_image)
check("analyze_image 签名含 mode 参数", "mode" in sig.parameters)

# 5) _recognize_one prompt 参数
sig2 = inspect.signature(service._recognize_one)
check("_recognize_one 签名含 prompt 参数", "prompt" in sig2.parameters)

# 6) 非法 mode 视作 question（宽容处理，不报错）
r = client.post("/api/extract", json={"image_base64": "aGVsbG8=", "mime": "image/png", "mode": "weird"})
check("非法 mode 不炸、按 question 处理", r.status_code == 200 and r.json().get("ok") is True)

print()
if FAILS:
    print(f"FAILED: {len(FAILS)} -> {FAILS}")
    sys.exit(1)
print("ALL PASS")
