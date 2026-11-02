"""Offline test isolation. Import before any application module.

Every test gets a new database even if the shell points ZHIYI_DB at production.
Network connections and reads of .env / repository data are forbidden.
"""
import ast
import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMP = tempfile.TemporaryDirectory(prefix='zhiyi-offline-')
os.environ.update(MOCK='1', PYTHON_DOTENV_DISABLED='1',
                  ZHIYI_DB=str(Path(TEMP.name) / 'test.db'))
for name in list(os.environ):
    if 'API_KEY' in name:
        os.environ.pop(name)


def _guard(event, args):
    if event == 'socket.connect':
        address = args[1]
        # Windows asyncio implements socketpair with a loopback TCP connection.
        if not isinstance(address, tuple) or address[0] not in ('127.0.0.1', '::1', 'localhost'):
            raise RuntimeError('Offline regression attempted an external network connection')
    if event in ('open', 'sqlite3.connect') and args and isinstance(args[0], (str, bytes, os.PathLike)):
        path = Path(os.fsdecode(args[0])).resolve()
        if path.name == '.env' or path.name.startswith('.env.') or (ROOT / 'data') in path.parents:
            raise PermissionError('Offline regression cannot access application data or .env')


sys.addaudithook(_guard)


def public_bank_fixture(database, include_seeds=False):
    """Build only public questions, never copy a user's accounts or submissions."""
    rows = json.loads((ROOT / 'bank.json').read_text(encoding='utf-8-sig'))
    if include_seeds:
        seen = {r['question'] for r in rows}
        next_id = max(r['id'] for r in rows) + 1
        for seed in sorted(ROOT.glob('seed_*.py')):
            for node in ast.parse(seed.read_text(encoding='utf-8-sig')).body:
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'SEED' for t in node.targets):
                    for q in ast.literal_eval(node.value):
                        if q['question'] in seen:
                            continue
                        seen.add(q['question'])
                        rows.append(dict(id=next_id, question=q['question'], normalized=q['question'],
                                         subject=q.get('subject', ''), knowledge_points=q.get('knowledge_points', []),
                                         answer=q.get('answer', ''), result=q))
                        next_id += 1
    conn = sqlite3.connect(database)
    try:
        conn.execute('CREATE TABLE question_bank(id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, normalized TEXT NOT NULL, subject TEXT DEFAULT "", knowledge_points TEXT DEFAULT "[]", answer TEXT DEFAULT "", result TEXT NOT NULL, hit_count INTEGER DEFAULT 0, created_at INTEGER DEFAULT 0)')
        conn.executemany('INSERT INTO question_bank VALUES (?,?,?,?,?,?,?,?,?)', [
            (r['id'], r['question'], r['normalized'], r.get('subject', ''),
             json.dumps(r.get('knowledge_points', []), ensure_ascii=False), r.get('answer', ''),
             json.dumps(r.get('result', {}), ensure_ascii=False), 0, 0) for r in rows])
        conn.commit()
    finally:
        conn.close()
