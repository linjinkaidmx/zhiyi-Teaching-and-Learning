"""Isolated migration, ownership, stale-sync and tombstone regression. No real DB/model."""

import test_support  # isolated database, no credentials or network
import os
import sqlite3
import tempfile
import json
from pathlib import Path

tmp = tempfile.TemporaryDirectory(prefix='zhiyi_sync_regression_')
db_path = str(Path(tmp.name) / 'test.db')
os.environ.update(ZHIYI_DB=db_path, MOCK='1', PYTHON_DOTENV_DISABLED='1')
# Exercise an actual old-schema upgrade, including a preserved legacy row.
with sqlite3.connect(db_path) as c:
    c.execute('CREATE TABLE errorbook(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,data TEXT NOT NULL,updated_at INTEGER DEFAULT 0)')
    c.execute('INSERT INTO errorbook VALUES(?,?,?,?)', ('legacy','legacy-user',json.dumps({'id':'legacy','question':'keep me'}),123))
c.close()
import main
import db
from fastapi.testclient import TestClient

client = TestClient(main.app)
assert db.load_errorbook('legacy-user')[0]['question'] == 'keep me'
assert db.load_errorbook('legacy-user')[0]['updatedAt'] == 123
pk = [r['name'] for r in sorted(db._conn.execute('PRAGMA table_info(errorbook)'),key=lambda r:r['pk']) if r['pk']]
assert pk == ['user_id','id'], pk

def post(path, **body):
    return client.post(path,json=body).json()

def register(nick):
    r=post('/api/account/register',nickname=nick,password='Audit123456',password_confirm='Audit123456')
    assert r['ok'] and isinstance(r['account_id'],int), r
    return r

a,b=register('sync_A'),register('sync_B')
ta,tb=a['token'],b['token']
assert a['account_id'] != b['account_id']
def push(t,items,deleted_ids=None):
    r=post('/api/sync/push',token=t,items=items,deleted_ids=deleted_ids or [])
    assert r['ok'],r
    return r
def pull(t):
    return post('/api/sync/pull',token=t)

push(ta,[{'id':'same','question':'A private'}])
push(tb,[{'id':'same','question':'B private'}])
assert pull(ta)['items'][0]['question']=='A private'
assert pull(tb)['items'][0]['question']=='B private'
old=pull(ta)['items']
db.save_exams('sync_A', [{'id': 'private-exam'}])
db.save_syllabus({'id':'private-syllabus','user_id':'sync_A','subject':'math','items':[]})
db.save_errorbook('sync_A',[{'id':'teach-new','question':'classroom new'}])
push(ta,old)
assert {it['id'] for it in pull(ta)['items']} == {'same','teach-new'}
# An old client lacking timestamps must not replace newer server content.
db.save_errorbook('sync_A',[{'id':'same','question':'server revision'}])
push(ta,[{'id':'same','question':'stale unversioned'}])
assert next(it for it in pull(ta)['items'] if it['id']=='same')['question']=='server revision'
# Deletion is explicit and wins even when a second device later sends its old snapshot.
push(ta,[],['same'])
push(ta,old)
assert [it['id'] for it in pull(ta)['items']]==['teach-new']
assert pull(ta)['deleted_ids']==['same']
assert pull(tb)['items'][0]['id']=='same'
push(ta,[])
assert len(pull(ta)['items'])==1, 'missing items must never imply deletion'
# Account identity and deletion state survive a nickname change.
r=post('/api/account/rename',token=ta,password='Audit123456',new_nickname='sync_A_renamed')
assert r['ok'] and r['account_id']==a['account_id'],r
assert pull(r['token'])['deleted_ids']==['same']
assert pull(r['token'])['account_id']==a['account_id']
assert db.load_exams('sync_A_renamed')[0]['id']=='private-exam'
assert db.get_syllabus('sync_A_renamed','private-syllabus') is not None
assert pull('invalid')['code']=='AUTH_INVALID'
assert post('/api/account/verify',token=r['token'])['account_id']==a['account_id']
assert post('/api/account/profile',token=r['token'])['account_id']==a['account_id']
# New version may update within the user's own namespace.
db.save_errorbook('sync_B',[{'id':'versioned','question':'initial','updatedAt':1}],from_client=True)
push(tb,[{'id':'versioned','question':'new','updatedAt':2}])
push(tb,[{'id':'versioned','question':'old','updatedAt':1}])
assert next(it for it in pull(tb)['items'] if it['id']=='versioned')['question']=='new'
assert post('/api/account/delete',token=r['token'],password='Audit123456')['ok']
reborn=register('sync_A_renamed')
assert reborn['account_id']!=a['account_id']
assert pull(reborn['token'])['items']==[]
assert pull(reborn['token'])['exams']==[]
assert db.get_syllabus('sync_A_renamed','private-syllabus') is None
client.close()
db._conn.close()
db._conn=None
tmp.cleanup()
print('PASS: legacy migration, account identity, cross-user isolation, stale merge, explicit deletion, rename and timestamp conflicts')
