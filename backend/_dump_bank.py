# -*- coding: utf-8 -*-
"""把线上题库的讲解结果导出到本地 JSON，供 Node 侧用真实 KaTeX 逐条校验渲染是否失败。
密码走环境变量 ZHIYI_PW，用完即删。
"""
import json
import os
import sys

import paramiko

pw = os.environ.get('ZHIYI_PW')
if not pw:
    print('缺少 ZHIYI_PW')
    sys.exit(1)

cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect('193.112.28.51', username='root', password=pw, timeout=20)

# 用 python3 读库并输出 JSON（避免手工拼 SQL 的转义问题）
remote = r'''cd /opt/zhiyi/backend && python3 -c "
import json, sqlite3
conn = sqlite3.connect('data/zhiyi.db')
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT id, question, result FROM question_bank').fetchall()
out = []
for r in rows:
    try:
        data = json.loads(r['result'])
    except Exception:
        continue
    out.append({'id': r['id'], 'question': r['question'], 'data': data})
print(json.dumps(out, ensure_ascii=False))
"'''
stdin, stdout, stderr = cli.exec_command(remote, timeout=180)
raw = stdout.read().decode('utf-8', 'replace')
err = stderr.read().decode()
cli.close()
if err.strip():
    print('远端 stderr:', err[:400])
try:
    rows = json.loads(raw)
except Exception as e:
    print('解析远端输出失败:', e, raw[:300])
    sys.exit(1)

with open(r'E:\知一2.0\frontend\_bank_dump.json', 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False)
print('已导出题库条目:', len(rows), '→ frontend/_bank_dump.json')
