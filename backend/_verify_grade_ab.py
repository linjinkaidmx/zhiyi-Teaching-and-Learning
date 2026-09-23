# -*- coding: utf-8 -*-
"""批改 V1 vs V2 的 A/B 实测（临时脚本，不动产品逻辑）。

V1（现状）：视觉转录（doubao）→ 文本判分（JUDGE_MODEL，线上为 deepseek-chat）
V2（候选）：一次视觉调用同时完成「转录 + 判分」（doubao）

样本：S1 线上真实手写作业图、S2 合成图（只写答案不写步骤）、S3 合成图（有涂改 + 符号潦草）
每样本每版跑 2 次，用于观察同版稳定性。
"""
import io, json, os, sys, time, types

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# Windows 上 resource 模块缺失（service 里做进程限制用）→ 打桩
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

RUNS = 2
OUT = '_ab'

V2_PROMPT = """你是大学理工科的老师，正在批改一名学生**手写在纸上、拍照提交**的作业。

【作业要求】
{content}
{reference_block}

请**先看清照片**（这是关键：照片里有纸面信息，转录会丢掉它们），然后一次完成两件事：

第一步 · 转录：逐字转录学生写在纸上的全部内容（题号、公式、计算步骤、结论），保留学生的原始写法，
**不要替他改正**；字迹不清处标 [不清]；若纸上有涂改、划掉、涂黑，用 {{涂改}} 标注其位置。

第二步 · 批改：严格对照作业要求逐题判对错。除了答案本身，还必须依据**照片里的纸面信息**判断：
  · 步骤是否完整（有没有跳步、只写答案不写过程）
  · 书写是否规范（涂改多、字迹潦草、公式排列混乱、单位/量纲缺失）
  · 是否有作图、表格、标注的缺失
判分规则：
1. 等价表达算对（1/2 与 0.5、x^2 与 x² 等）。
2. 只写了一部分题就只批那部分；没写的题记「未作答」，得分按 0 计但 comment 说明。
3. 若转录内容与作业要求完全无关 → 总分 0 并在 overall 说明。
4. 评语像老师讲评：指出错在哪一步、缺什么概念，一两句话，不要空话。
5. 若因「跳步 / 过程缺失 / 书写潦草」影响可读性或严谨性，要在对应题的 comment 或 overall 里明确说出来。

只输出 JSON（不要任何解释文字）：
{{"transcript": "第一步的转录全文（用 \\n 分段）",
 "score": 得分（0~100 的整数）,
 "items": [{{"question": "题目或要求的关键词", "verdict": "正确|部分正确|错误|未作答", "comment": "该题评语"}}],
 "overall": "总体评价（两三句话：主要问题 + 下一步建议）"}}"""


def load_samples():
    m = json.load(io.open(os.path.join(OUT, 'material.json'), encoding='utf-8'))
    samples = []
    if m.get('image'):
        samples.append({'id': 'S1', 'desc': '线上真实手写作业图', 'b64': m['image'].split(',')[-1], 'mime': 'image/jpeg'})
    for sid, desc in [('S2', '合成图：只写答案不写步骤'), ('S3', '合成图：有涂改 + 符号潦草')]:
        p = os.path.join(OUT, f'sample{sid[1]}.png')
        if os.path.exists(p):
            import base64
            samples.append({'id': sid, 'desc': desc, 'b64': base64.b64encode(open(p, 'rb').read()).decode(), 'mime': 'image/png'})
    return m, samples


def v1_grade(b64, mime, content, reference):
    """现状：视觉转录 → 文本判分（两次调用）"""
    t0 = time.time()
    tx = service.analyze_image(b64, mime, mode='answer')
    transcript = str(tx.get('question') or '')
    t1 = time.time()
    ref_block = ('\n【参考答案 / 评分要点】\n' + reference) if reference else ''
    prompt = (main.GRADE_HOMEWORK_PROMPT
              .replace('{content}', str(content)[:4000])
              .replace('{reference_block}', ref_block[:2000])
              .replace('{transcript}', transcript[:6000]))
    text = service.chat_text([{'role': 'user', 'content': prompt}], temperature=0.2,
                             slot=service.JUDGE_SLOT, timeout=180)
    res = service.extract_json(text)
    t2 = time.time()
    return {'calls': 2, 't_vision': round(t1 - t0, 1), 't_judge': round(t2 - t1, 1),
            't_total': round(t2 - t0, 1), 'transcript': transcript, 'result': res}


def v2_grade(b64, mime, content, reference):
    """候选：一次视觉调用同时转录 + 判分"""
    ref_block = ('\n【参考答案 / 评分要点】\n' + reference) if reference else ''
    prompt = (V2_PROMPT
              .replace('{content}', str(content)[:4000])
              .replace('{reference_block}', ref_block[:2000]))
    t0 = time.time()
    text = service._recognize_one(b64, mime, timeout=180, retries=1, prompt=prompt)
    t1 = time.time()
    res = service.extract_json(text or '')
    return {'calls': 1, 't_total': round(t1 - t0, 1),
            'transcript': str(res.get('transcript') or ''), 'result': res}


def brief(rec):
    r = rec.get('result') or {}
    items = r.get('items') if isinstance(r.get('items'), list) else []
    verdicts = {}
    for it in items:
        if isinstance(it, dict):
            verdicts[str(it.get('verdict'))] = verdicts.get(str(it.get('verdict')), 0) + 1
    return {
        'score': r.get('score'),
        'items': len(items),
        'verdicts': verdicts,
        'transcript_chars': len(rec.get('transcript') or ''),
        'calls': rec['calls'],
        't_total': rec['t_total'],
        'overall': str(r.get('overall') or '')[:260],
    }


def main_ab():
    m, samples = load_samples()
    content = m.get('hw_content') or ''
    reference = m.get('hw_reference') or ''
    print(f'作业要求：{content[:60]}')
    print(f'评分要点：{reference[:60]}')
    print(f'样本数：{len(samples)}，每版每样本跑 {RUNS} 次\n')

    all_out = []
    for s in samples:
        print('=' * 78)
        print(f"{s['id']} · {s['desc']}")
        print('=' * 78)
        rec = {'sample': s['id'], 'desc': s['desc'], 'v1': [], 'v2': []}
        for run in range(RUNS):
            for tag, fn in (('v1', v1_grade), ('v2', v2_grade)):
                try:
                    r = fn(s['b64'], s['mime'], content, reference)
                    b = brief(r)
                    rec[tag].append(b)
                    print(f"  [{tag} #{run + 1}] 分数={b['score']} · items={b['items']} · "
                          f"转录={b['transcript_chars']}字 · 调用={b['calls']}次 · 耗时={b['t_total']}s")
                    print(f"           评语：{b['overall'][:150]}")
                    rec[tag][-1]['full'] = r['result']
                    rec[tag][-1]['transcript'] = r['transcript'][:1500]
                except Exception as e:
                    print(f"  [{tag} #{run + 1}] 失败：{str(e)[:160]}")
                    rec[tag].append({'error': str(e)[:200]})
                finally:
                    # 增量落盘：任何一步中断都不丢已完成的结果
                    io.open(os.path.join(OUT, 'ab_result.json'), 'w', encoding='utf-8').write(
                        json.dumps(all_out + [rec], ensure_ascii=False, indent=1))
                    try:
                        sys.stdout.flush()
                    except Exception:
                        pass
        all_out.append(rec)
        print()

    io.open(os.path.join(OUT, 'ab_result.json'), 'w', encoding='utf-8').write(
        json.dumps(all_out, ensure_ascii=False, indent=1))

    print('=' * 78)
    print('汇总')
    print('=' * 78)
    print(f"{'样本':<6}{'版本':<6}{'分数':<14}{'转录字数':<10}{'调用':<6}{'耗时':<10}")
    for rec in all_out:
        for tag in ('v1', 'v2'):
            scores = [x.get('score') for x in rec[tag] if x.get('score') is not None]
            chars = [x.get('transcript_chars') for x in rec[tag] if x.get('transcript_chars')]
            times = [x.get('t_total') for x in rec[tag] if x.get('t_total')]
            calls = [x.get('calls') for x in rec[tag] if x.get('calls')]
            s_txt = '/'.join(str(x) for x in scores) if scores else '—'
            print(f"{rec['sample']:<6}{tag:<6}{s_txt:<14}"
                  f"{(str(chars[0]) if chars else '—'):<10}"
                  f"{(str(calls[0]) if calls else '—'):<6}"
                  f"{(str(times[0]) if times else '—'):<10}")
    print('\n明细已写入 _ab/ab_result.json')


if __name__ == '__main__':
    main_ab()
