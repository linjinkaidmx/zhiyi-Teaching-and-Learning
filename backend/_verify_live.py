# -*- coding: utf-8 -*-
"""线上端到端验证：讲解返回内容是否干净（无控制字符），并保存供渲染扫描器复扫。"""
import json
import urllib.request

HOST = 'http://193.112.28.51:3300'
CASES = [
    'Python 的 list 为什么能用 for 循环遍历？请解释 __len__、__getitem__、__iter__ 的作用。',
    '正则表达式 1[3-9]\\d{9} 能匹配什么？请逐段解释，并说明 ^ 和 $ 的作用。',
    '计算 ∫₀¹ x²/√(1-x²) dx，用 \\frac \\sqrt \\theta \\times 说明。',
]

out = []
bad_total = 0
for i, q in enumerate(CASES, 1):
    body = json.dumps({'question': q, 'attempt': ''}).encode('utf-8')
    req = urllib.request.Request(HOST + '/api/explain', data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r:
        resp = json.loads(r.read().decode('utf-8'))
    if not resp.get('ok'):
        print(f'[失败] 第 {i} 题: {resp.get("error")}')
        continue
    data = resp['data']
    out.append({'id': i, 'question': q, 'data': data})

    ctrl = []
    def walk(node, path=''):
        if isinstance(node, str):
            for c in node:
                if ord(c) < 32 and c != '\n':
                    ctrl.append((path, hex(ord(c))))
        elif isinstance(node, dict):
            for k, v in node.items():
                walk(v, f'{path}.{k}')
        elif isinstance(node, list):
            for j, v in enumerate(node):
                walk(v, f'{path}[{j}]')
    walk(data)
    bad_total += len(ctrl)
    print(f'[第 {i} 题] 控制字符: {len(ctrl)} 处 {ctrl[:4]}')
    print(f'   answer = {str(data.get("answer"))[:110]!r}')

print()
print('控制字符总数:', bad_total, '（应为 0）')
with open(r'E:\知一2.0\frontend\_verify_cases.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False)
print('已保存', len(out), '条 → frontend/_verify_cases.json')
