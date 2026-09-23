# -*- coding: utf-8 -*-
"""补跑 S3（涂改样本）：V1 ×2 + V2 ×1，重点看「转录是否保留涂改痕迹」（临时）。"""
import io, json, os, sys, types, time

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

if sys.platform == 'win32':
    _m = types.ModuleType('resource')
    _m.RUSAGE_SELF = 0; _m.RLIMIT_NOFILE = 7
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
s3 = [s for s in samples if s['id'] == 'S3'][0]
res = {'sample': 'S3', 'desc': s3['desc'], 'v1': [], 'v2': []}

print(f"S3 · {s3['desc']}", flush=True)

# V1 ×2
for i in range(2):
    try:
        r = AB.v1_grade(s3['b64'], s3['mime'], content, reference)
        b = AB.brief(r)
        res['v1'].append({**b, 'transcript': r['transcript'][:2000], 'full': r['result']})
        print(f"[v1 #{i+1}] 分数={b['score']} · 转录={b['transcript_chars']}字 · 耗时={b['t_total']}s", flush=True)
        print(f"  转录：{r['transcript'][:400]}", flush=True)
        print(f"  评语：{b['overall'][:240]}", flush=True)
    except Exception as e:
        res['v1'].append({'error': str(e)[:200]})
        print(f"[v1 #{i+1}] 失败：{str(e)[:150]}", flush=True)
    io.open(os.path.join(OUT, 'ab_s3.json'), 'w', encoding='utf-8').write(json.dumps(res, ensure_ascii=False, indent=1))

# V2 ×1（单次上限明确：240s 且不重试，避免拖成 400s+）
try:
    ref_block = ('\n【参考答案 / 评分要点】\n' + reference) if reference else ''
    prompt = AB.V2_PROMPT.replace('{content}', content[:4000]).replace('{reference_block}', ref_block[:2000])
    t0 = time.time()
    text = service._recognize_one(s3['b64'], s3['mime'], timeout=240, retries=0, prompt=prompt)
    dt = round(time.time() - t0, 1)
    r = service.extract_json(text or '')
    b = AB.brief({'calls': 1, 't_total': dt, 'transcript': str(r.get('transcript') or ''), 'result': r})
    res['v2'].append({**b, 'transcript': str(r.get('transcript') or '')[:2000], 'full': r})
    print(f"[v2 #1] 分数={b['score']} · 转录={b['transcript_chars']}字 · 耗时={dt}s", flush=True)
    print(f"  转录：{str(r.get('transcript') or '')[:400]}", flush=True)
    print(f"  评语：{b['overall'][:240]}", flush=True)
except Exception as e:
    res['v2'].append({'error': str(e)[:200]})
    print(f"[v2 #1] 失败：{str(e)[:150]}", flush=True)

io.open(os.path.join(OUT, 'ab_s3.json'), 'w', encoding='utf-8').write(json.dumps(res, ensure_ascii=False, indent=1))
print('S3 完成，已写入 _ab/ab_s3.json', flush=True)
