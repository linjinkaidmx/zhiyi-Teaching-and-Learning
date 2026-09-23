# -*- coding: utf-8 -*-
"""通过线上 /api/run 接口验证速查里的 C 模板（与用户点「试跑」走同一条链路）。

自包含：先从 frontend/src/ref/code.js 抽出各模板为 .c，再逐个提交线上沙箱编译运行。
（本地 gcc 在部分环境不可用，故以线上沙箱为准）
用法：python _verify_tpl_remote.py
"""
import json
import os
import shutil
import subprocess
import urllib.request

HOST = 'http://193.112.28.51:3300'
FRONT = r'E:\知一2.0\frontend'
REF = os.path.join(FRONT, 'src', 'ref')
TPL = os.path.join(FRONT, '_tpl')

EXPECT = {
    'quicksort': ['-3 1 2 5 5 6 8 9'],
    'mergesort': ['1 2 5 5 6 9', '逆序对 = 6'],
    'binarysearch': ['find(5) = 3, find(4) = -1', '第一个 >= 3 的位置 = 1', '第一个 > 3 的位置 = 3', '最后一个 <= 3 的位置 = 2'],
    'binaryanswer': ['最大长度 = 7', 'sqrt(2) ≈ 1.414'],
    'prefixdiff': ['a[2..4] 的和 = 6', '1 9 12 11 5'],
    'slidewindow': ['最长无重复子串长度 = 3'],
    'dfs-backtrack': ['123', '321'],
    'bfs': ['最短步数 = 6'],
    'dsu': ['1 和 3 同集合? 是', '1 和 5 同集合? 否', '集合个数 = 3'],
    'dijkstra': ['1 -> 2 : 2', '1 -> 3 : 3', '1 -> 4 : 4', '1 -> 5 : 7'],
    'toposort': ['1 3 2 6 4 5', '是 DAG，排序完成'],
    'knapsack': ['0-1 背包最大价值 = 13', '完全背包最大价值 = 15', '恰好装满最大价值 = 13'],
    'lis': ['最长上升子序列长度 = 4'],
    'lcs': ['最长公共子序列长度 = 4'],
    'editdist': ['编辑距离 = 3'],
    'kmp': ['首次出现在下标 5', 'baa 的结果 = -1'],
    'fastpow': ['2^10 = 1024', '3^0 mod 1000 = 1'],
    'monostack': ['a[0] = 3，右边第一个更大的是 4', 'a[4] = 5，右边第一个更大的是 -1'],
    'travtree': ['前序：1 2 4 5 3 6 7', '中序：4 2 5 1 6 3 7', '后序：4 5 2 6 7 3 1', '层序：1 2 3 4 5 6 7'],
    'trie': ['前缀 app  的单词数 = 3', '前缀 appl 的单词数 = 2', '前缀 cat  的单词数 = 0'],
    'numbertheory': ['gcd(12,8) = 4', '3 在模 7 下的逆元 = 5', '100 以内素数个数 = 25'],
}


def run_remote(code, lang='c'):
    body = json.dumps({'language': lang, 'code': code, 'stdin': ''}).encode('utf-8')
    req = urllib.request.Request(HOST + '/api/run', data=body,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode('utf-8'))


def dump_templates():
    """用 Node 把 code.js（ESM）里的模板逐个写成 .c 文件。"""
    with open(os.path.join(REF, 'code.js'), encoding='utf-8') as f:
        src = f.read()
    with open(os.path.join(FRONT, '_code_tmp.mjs'), 'w', encoding='utf-8') as f:
        f.write(src)
    dumper = os.path.join(FRONT, '_dump_templates.mjs')
    with open(dumper, 'w', encoding='utf-8') as f:
        f.write("""import { CODE_TEMPLATES } from './_code_tmp.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
mkdirSync('_tpl', { recursive: true })
for (const t of CODE_TEMPLATES) writeFileSync(`_tpl/${t.key}.c`, t.code)
console.log('抽出模板 ' + CODE_TEMPLATES.length + ' 个')
""")
    r = subprocess.run(['node', '_dump_templates.mjs'], cwd=FRONT, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr[-500:])


shutil.rmtree(TPL, ignore_errors=True)
dump_templates()

fail = 0
for key in sorted(EXPECT.keys()):
    path = os.path.join(TPL, key + '.c')
    if not os.path.exists(path):
        print(f'[缺失] {key}.c（先在 frontend 跑一次 _verify_templates.py 抽模板）')
        fail += 1
        continue
    with open(path, encoding='utf-8') as f:
        code = f.read()
    try:
        r = run_remote(code)
    except Exception as e:
        print(f'[请求失败] {key}: {e}')
        fail += 1
        continue
    if not r.get('ok'):
        print(f'[编译/运行失败] {key}: {r.get("error")}\n{(r.get("stderr") or "")[:500]}')
        fail += 1
        continue
    out = (r.get('stdout') or '') + (r.get('stderr') or '')
    missing = [e for e in EXPECT[key] if e not in out]
    if missing:
        print(f'[输出不符] {key} 缺失={missing}\n{out[:500]}')
        fail += 1
    else:
        print(f'[OK] {key}  ✓ {len(EXPECT[key])} 项')

print()
print('线上沙箱验证：全部通过' if fail == 0 else f'线上沙箱验证：{fail} 个模板未通过')
