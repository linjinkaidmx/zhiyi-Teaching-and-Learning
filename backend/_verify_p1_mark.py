# -*- coding: utf-8 -*-
"""验证 P1 生效：用有涂改的样本图（S3）跑转录，确认 {涂改} 标注真的出现在输出里（临时）。"""
import base64, io, json, os, sys, types

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

img_path = os.path.join('_ab', 'sample3.png')
b64 = base64.b64encode(open(img_path, 'rb').read()).decode()
print('样本：S3（有涂改 + 符号潦草的合成作业图）', flush=True)

t0 = time.time() if (time := __import__('time')) else 0
data = service.analyze_image(b64, 'image/png', mode='answer')
tx = str(data.get('question') or '')
print(f'耗时约 {__import__("time").time() - t0:.0f}s，转录 {len(tx)} 字：', flush=True)
print('-' * 70, flush=True)
print(tx, flush=True)
print('-' * 70, flush=True)

marked = ('涂改' in tx) or ('划掉' in tx) or ('{空白}' in tx)
print('结论：', '✓ 涂改/空白标注已出现在转录里（P1 生效）' if marked
      else '✗ 转录里没有出现涂改标注 —— 提示词措辞需要加强', flush=True)

io.open(os.path.join('_ab', 'p1_verify.json'), 'w', encoding='utf-8').write(
    json.dumps({'transcript': tx, 'marked': marked}, ensure_ascii=False, indent=1))
