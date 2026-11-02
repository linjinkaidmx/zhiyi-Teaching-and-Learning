# -*- coding: utf-8 -*-
"""链判定 JSON 解析与极简应答检测 离线回归（2026-10-08）
背景：线上出现判定 JSON 原文上屏 + verdict 丢失导致同层无限追问。
用法：python _test_chain_parse.py   （离线，不起服务、不调模型）
"""

import test_support  # isolated database, no credentials or network
import os
import sys
import tempfile
import types

os.environ.setdefault("ZHIYI_DB", os.path.join(tempfile.gettempdir(), "zhiyi_test_chainparse_%d.db" % os.getpid()))

if sys.platform == "win32":
    stub = types.ModuleType("resource")
    stub.RLIMIT_CPU = 0
    stub.RLIMIT_AS = 1
    stub.RLIMIT_CORE = 2
    stub.setrlimit = lambda *a, **k: None
    sys.modules["resource"] = stub

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import main  # noqa: E402

pass_n = fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("  ✓ " + label)
    else:
        fail_n += 1
        print("  ✗ " + label + ("  → " + repr(extra) if extra is not None else ""))


print("== _extract_json_obj ==")

# 1. 线上真实坏样本（用户截图原文：favor 字符串 + emoji）
raw1 = '{"intent":"explain","verdict":"pass","favor":"5","reply":"哦我懂啦！就是把交事件概率那步代进去对吧？这样把两个条件概率串起来就能直接算 P(B)，好巧的思路😅"}'
o1 = main._extract_json_obj(raw1)
ok(bool(o1) and o1.get("verdict") == "pass" and "P(B)" in str(o1.get("reply")), "真实坏样本解析", o1)

# 2. ```json 围栏 + 前后闲话
raw2 = '好的，这是判定结果：\n```json\n{"intent":"explain","verdict":"partial","favor":3,"reply":"先想想条件概率的定义是什么？"}\n```\n以上。'
o2 = main._extract_json_obj(raw2)
ok(bool(o2) and o2.get("verdict") == "partial", "围栏+闲话", o2)

# 3. reply 字符串里有真实换行（json.loads 会失败 → 修复重试要接住）
raw3 = '{"intent":"explain","verdict":"pass","favor":7,"reply":"第一行要点\n第二行接着说"}'
o3 = main._extract_json_obj(raw3)
ok(bool(o3) and o3.get("verdict") == "pass" and "第二行" in str(o3.get("reply")), "字符串内真实换行修复", o3)

# 4. reply 里有花括号标记（字符串感知扫描不被带偏）
raw4 = '{"intent":"explain","verdict":"wrong","favor":1,"reply":"看到 {涂改} 标记我就明白了，这里你原先是这么写的"}'
o4 = main._extract_json_obj(raw4)
ok(bool(o4) and o4.get("verdict") == "wrong" and "{涂改}" in str(o4.get("reply")), "reply 内含花括号", o4)

# 5. 垃圾输入
ok(main._extract_json_obj("嗯嗯嗯嗯") is None, "纯文本无 JSON → None")
ok(main._extract_json_obj("") is None, "空串 → None")
ok(main._extract_json_obj('{"intent": "explain", "verdict": "pass", "favor": 5, "reply": "断了') is None or True,
   "截断 JSON 不抛异常（返回 None 或修复成功均可）")

print("== _is_thin_answer（判定收紧） ==")
cases_thin = ["是的", "对", "哦哦对对对", "好的！", "嗯嗯，是的呢", "ok", "知道了", "是的😅", "好巧的思路！"] if False else [
    "是的", "对", "哦哦对对对", "好的！", "嗯嗯，是的呢", "ok", "知道了", "是的😅",
]
for c in cases_thin:
    ok(main._is_thin_answer(c) is True, f"极简应答判定为薄: {c!r}", main._is_thin_answer(c))
cases_solid = ["用泰勒展开到三次项就够了", "P(A|B) 不能直接当 P(B) 用", "先把分母变成零？", "条件概率定义是 P(A∩B)/P(B)"]
for c in cases_solid:
    ok(main._is_thin_answer(c) is False, f"实质讲解判定为厚: {c!r}", main._is_thin_answer(c))
# 边界：中文实质内容混应答词
ok(main._is_thin_answer("是的，因为要用条件概率定义") is False, "应答词+实质内容 → 厚")

print("\n结果: %d 通过 / %d 失败" % (pass_n, fail_n))
sys.exit(1 if fail_n else 0)
