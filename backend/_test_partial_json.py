# -*- coding: utf-8 -*-
"""批次3 测试：增量 JSON 字段解析器（讲解流式的核心）
用法：python _test_partial_json.py
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
os.environ.setdefault("ZHIYI_DB", ":memory:")

import service  # noqa: E402

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


def scan(text):
    return service.scan_json_strings(text)


def decode(raw):
    return service._decode_partial(raw)[0]


print("\n1. 完整 JSON：字段与路径")
r = scan('{"answer": "1/3", "key_breakthrough": "看原函数"}')
ok(len(r) == 2, "两个字符串字段", r)
ok(r[0][0] == "answer" and r[0][1] == "1/3" and r[0][2] is True, "answer 完整且路径正确", r[0])
ok(r[1][0] == "key_breakthrough", "第二个字段路径正确", r[1][0])

print("\n2. 嵌套：数组里的对象 / 字符串数组")
r = scan('{"steps": [{"title": "化简", "detail": "由公式得"}, {"title": "代入"}], "knowledge_points": ["定积分", "牛顿-莱布尼茨"]}')
paths = [x[0] for x in r]
ok("steps[0].title" in paths and "steps[0].detail" in paths, "steps[0] 的字段路径正确", paths)
ok("steps[1].title" in paths, "steps[1] 也正确", paths)
ok("knowledge_points[0]" in paths and "knowledge_points[1]" in paths, "字符串数组路径正确", paths)

print("\n3. 截断的字符串（流式最关键的场景）")
r = scan('{"answer": "x = 1')
ok(len(r) == 1 and r[0][0] == "answer" and r[0][1] == "x = 1" and r[0][2] is False, "未闭合的字符串被识别为「进行中」", r)

r = scan('{"answer": "1/3", "steps": [{"title": "化简')
ok(r[0][2] is True and r[-1][2] is False, "前一个已闭合、当前未闭合", r)
ok(r[-1][0] == "steps[0].title", "未闭合字段路径正确", r[-1][0])

print("\n4. 转义处理（不能把转义拆坏）")
ok(decode("a\\nb") == "a\nb", "\\n 解码为换行")
ok(decode('he said \\"hi\\"') == 'he said "hi"', "\\\" 解码为引号")
ok(decode("a\\\\b") == "a\\b", "\\\\ 解码为反斜杠")
ok(decode("\\u4e2d\\u6587") == "中文", "\\uXXXX 解码")
# 结尾是半个转义 → 只解码到安全位置
ok(decode("abc\\") == "abc", "结尾半个反斜杠被挂起（不显示成怪字符）", decode("abc\\"))
ok(decode("abc\\u4e2d\\u") == "abc中", "半个 \\u 被挂起（不吞掉已有内容）", decode("abc\\u4e2d\\u"))
ok(decode("abc\\u12") == "abc", "半个 \\u 序列整体挂起", decode("abc\\u12"))

print("\n5. 非字符串值不受影响")
r = scan('{"quiz": 3, "ok": true, "x": null, "answer": "1"}')
ok(len(r) == 1 and r[0][0] == "answer", "数字/布尔/null 被忽略", r)

print("\n6. 增量 diff：分片喂入，拼接结果必须等于最终值")
FULL = ('{"answer": "x = \\\\frac{1}{3}", "steps": [{"title": "化简", "detail": "由 \\\\int x^2 dx 得"}],'
        ' "knowledge_points": ["定积分"], "diagnosis": ""}')
emitted = {}
done = set()
assembled = {}
events = 0
for i in range(0, len(FULL), 7):
    buffer = FULL[:i + 7]
    for ev in service._diff_field_events(buffer, emitted, done):
        events += 1
        if "delta" in ev:
            assembled[ev["field"]] = assembled.get(ev["field"], "") + ev["delta"]
ok(events > 0, f"分片产出了 {events} 个事件")
final = service.extract_json(FULL)
expect = dict(service.flatten_explain_fields(final))
bad = {k: (assembled.get(k), v) for k, v in expect.items() if assembled.get(k) != v}
ok(not bad, "逐片拼接的文本与最终解析结果完全一致", bad)
ok("diagnosis" not in assembled, "空字符串字段不产出 delta（避免空提示）")
ok("answer" in done and "steps[0].detail" in done, "字段完成事件都发过", sorted(done))

print("\n7. 不重复发送（同一 buffer 再跑一遍应当没有新事件）")
again = service._diff_field_events(FULL, emitted, done)
ok(again == [], "重复扫描不产生重复内容（增量语义正确）", again)

print("\n8. 摊平函数与 Mock 讲解对象")
data = service._mock_explain_for("", "standard")
flat = service.flatten_explain_fields(data)
paths = [p for p, _ in flat]
ok("answer" in paths and "key_breakthrough" in paths, "标准档含主要字段", paths[:6])
ok(any(p.startswith("steps[") for p in paths), "含步骤字段")
brief = service._mock_explain_for("", "brief")
bp = [p for p, _ in service.flatten_explain_fields(brief)]
ok(len(bp) < len(paths), f"基础档字段更少（{len(bp)} < {len(paths)}）")

print("\n9. 深度归一化")
ok(service.normalize_depth("brief") == "brief", "brief 保留")
ok(service.normalize_depth("DEEP") == "deep", "大小写归一")
ok(service.normalize_depth("乱写") == "standard", "非法值兜底 standard")
ok(service.normalize_depth(None) == "standard", "None 兜底 standard")
slot, timeout = service._depth_slot("brief")
ok(slot.get("thinking") == 0, "基础档关闭思考（更快更省）")
slot2, t2 = service._depth_slot("deep")
ok(slot2.get("thinking") == 1, "深入档强制开思考")
ok(timeout < t2, f"基础档超时更短（{timeout} < {t2}）")

print("\n10. explain_stream（Mock 路径）")
evs = list(service.explain_stream(r"计算 $\\int_0^1 x^2 dx$", "", "standard"))
kinds = [list(e.keys())[0] for e in evs]
ok("done" in [k for k in kinds], "以 done 结束")
ok(kinds.count("done") == 1, "done 只出现一次")
deltas = [e for e in evs if "delta" in e]
dones = [e for e in evs if "field_done" in e]
ok(len(deltas) >= 5 and len(dones) >= 5, f"产出 {len(deltas)} 个增量与 {len(dones)} 个完成事件")
ok(all("result" in e for e in evs if "done" in e), "done 事件带完整 result")
res = [e["result"] for e in evs if "done" in e][0]
ok(bool(res.get("answer")) and isinstance(res.get("steps"), list), "result 结构完整")

print("\n" + "=" * 46)
print(f"全部通过（{pass_n} 项断言）" if fail_n == 0 else f"有 {fail_n} 项未通过（通过 {pass_n} 项）")
sys.exit(0 if fail_n == 0 else 1)
