# -*- coding: utf-8 -*-
"""补充实验：只跑 V1，覆盖 S2（跳步）/ S3（涂改）样本，看纯转录判分能否识别纸面问题（临时）。"""
import io, json, os, sys, time, types

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

if sys.platform == 'win32':
    _m = types.ModuleType('resource')
    _m.RUSAGE_SELF = 0
    _m.RLIMIT_NOFILE = 7
    _m.getrusage = lambda *a: (0,) * 16
    _m.getrlimit = lambda *a: (1024, 4096)
    _m.setrlimit = lambda *a: None
    sys.modules['resource'] = _m

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import service  # noqa: E402
import main  # noqa: E402
import _verify_grade_ab as AB  # noqa: E402

OUT = '_ab'
m, samples = AB.load_samples()
content, reference = m.get('hw_content') or '', m.get('hw_reference') or ''
targets = [s for s in samples if s['id'] in ('S2', 'S3')]

res = {}
for s in targets:
    print('=' * 76)
    print(f"{s['id']} · {s['desc']} —— 仅 V1（视觉转录 + 文本判分）", flush=True)
    print('=' * 76)
    runs = []
    for i in range(2):
        try:
            r = AB.v1_grade(s['b64'], s['mime'], content, reference)
            b = AB.brief(r)
            runs.append({**b, 'full': r['result'], 'transcript': r['transcript'][:2000]})
            print(f"  [v1 #{i + 1}] 分数={b['score']} · 转录={b['transcript_chars']}字 · 耗时={b['t_total']}s", flush=True)
            print(f"    转录内容：{(r['transcript'] or '')[:220].replace(chr(10), ' / ')}", flush=True)
            print(f"    评语：{b['overall'][:220]}", flush=True)
        except Exception as e:
            runs.append({'error': str(e)[:200]})
            print(f"  [v1 #{i + 1}] 失败：{str(e)[:150]}", flush=True)
    res[s['id']] = runs

io.open(os.path.join(OUT, 'ab_v1_extra.json'), 'w', encoding='utf-8').write(
    json.dumps(res, ensure_ascii=False, indent=1))
print('\n已写入 _ab/ab_v1_extra.json')
