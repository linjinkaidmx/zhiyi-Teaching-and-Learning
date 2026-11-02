"""Isolated security regressions: no credentials, model calls or host code execution."""

import test_support  # isolated database, no credentials or network
import hashlib
import hmac
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace

_tmp = tempfile.TemporaryDirectory(prefix='zhiyi_security_')
os.environ.update(MOCK='1', PYTHON_DOTENV_DISABLED='1', ZHIYI_DB=str(Path(_tmp.name) / 'test.db'),
                  ZHIYI_TOKEN_KEY_FILE=str(Path(_tmp.name) / 'key.json'), ZHIYI_CODE_RUNNER='disabled')
os.environ.pop('ZHIYI_TOKEN_SECRET', None)
import auth
import db
import main
import code_runner
from request_security import client_ip, BodyLimitMiddleware
from fastapi.testclient import TestClient


class SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)
        def register(nick):
            return cls.client.post('/api/account/register', json={'nickname':nick,'password':'Audit12345','password_confirm':'Audit12345'}).json()['token']
        cls.t, cls.s = register('security_teacher'), register('security_student')
        cls.post('/api/teacher/apply', token=cls.t, name='测试教师', school='测试学校')
        cls.group = cls.post('/api/class/create', token=cls.t, name='测试班')['class']
        cls.post('/api/class/join', token=cls.s, code=cls.group['invite_code'])

    @classmethod
    def post(cls, path, **data):
        return cls.client.post(path,json=data).json()

    def test_01_runner_disabled_does_not_execute(self):
        with patch('code_runner.subprocess.run') as run:
            r = self.post('/api/run',token=self.s,language='python',code='raise Exception()')
            self.assertFalse(r['ok'])
            run.assert_not_called()

    def test_02_docker_has_no_host_mounts_and_hard_limits(self):
        with patch.dict(os.environ, ZHIYI_CODE_RUNNER='docker', ZHIYI_RUNNER_IMAGE='audit-runner:local'):
            with patch('code_runner._invoke_docker', return_value=SimpleNamespace(returncode=0, stdout='{"ok":true}')) as run, patch('code_runner.subprocess.run'):
                self.assertTrue(code_runner.run_code('python','print(1)')['ok'])
                cmd = run.call_args_list[0].args[0]
                for flag in ['--network=none','--read-only','--user=65534:65534','--pids-limit=32','--cap-drop=ALL','--memory=256m','--pull=never']:
                    self.assertIn(flag,cmd)
                self.assertNotIn('-v',cmd)
                self.assertNotIn('--mount',cmd)

    def test_03_untrusted_forwarded_ip(self):
        with patch.dict(os.environ,ZHIYI_TRUSTED_PROXIES=''):
            self.assertEqual(client_ip({'client':('192.0.2.1',1),'headers':[(b'x-forwarded-for',b'1.2.3.4')]}),'192.0.2.1')
        with patch.dict(os.environ,ZHIYI_TRUSTED_PROXIES='127.0.0.1/32'):
            self.assertEqual(client_ip({'client':('127.0.0.1',1),'headers':[(b'x-forwarded-for',b'1.2.3.4, 192.0.2.5')]}),'192.0.2.5')

    def test_04_body_limits_declared_and_chunked(self):
        import asyncio
        async def probe(declared):
            messages=iter([{'type':'http.request','body':b'12345','more_body':True},{'type':'http.request','body':b'67890','more_body':False}])
            sent=[]
            async def receive(): return next(messages)
            async def send(msg): sent.append(msg)
            async def downstream(*args): self.fail('oversize request reached app')
            await BodyLimitMiddleware(downstream,max_bytes=8)({'type':'http','headers':[(b'content-length',b'10')] if declared else []},receive,send)
            self.assertEqual(sent[0]['status'],413)
        asyncio.run(probe(True)); asyncio.run(probe(False))

    def test_05_csv_formula_is_text(self):
        for value in ['=1+1','+1','-1','@SUM(A1)',' \t=1+1']:
            self.assertIn("'",main._csv_cell(value))
        self.assertEqual(main._csv_cell('学生'), '学生')

    def test_06_secret_persists_and_legacy_window_is_bounded(self):
        self.assertIsNone(auth.parse_token('a.9999999999.' + '字' * 64))
        profile=auth.parse_token(self.s)
        key, until=auth._signing_config()
        self.assertEqual(key,auth._signing_config()[0])
        self.assertNotEqual(key,auth._LEGACY_KEY)
        name=self.s.split('.')[0]
        exp=int(time.time())+300
        body=f"security_student::{profile['auth_nonce']}::{exp}"
        sig=hmac.new(auth._LEGACY_KEY.encode(),body.encode(),hashlib.sha256).hexdigest()
        legacy=f'{name}.{exp}.{sig}'
        self.assertIsNotNone(auth.parse_token(legacy))
        with patch('auth._signing_config',return_value=(key,int(time.time())-1)):
            self.assertIsNone(auth.parse_token(legacy))
            self.assertIsNotNone(auth.parse_token(self.s))

    def test_07_recovery_has_limit(self):
        args={'nickname':'security_student','backup_code':'WRONGCODE','new_password':'Other12345','password_confirm':'Other12345'}
        for _ in range(5): self.post('/api/account/recover',**args)
        with patch('auth.verify_password') as verify:
            r=self.post('/api/account/recover',**args)
            self.assertIn('频繁',r['error']); verify.assert_not_called()

    def test_08_expired_test_and_removed_member_cannot_submit(self):
        paper=[{'type':'choice','question':'1+1?','options':['1','2'],'answer':'B','score':100}]
        def exam():
            t=self.post('/api/class/test/create',token=self.t,class_id=self.group['id'],title='隔离测验',duration_sec=60,items=paper)['test']
            self.post('/api/class/test/start',token=self.s,test_id=t['id'])
            return t
        late=exam()
        db._conn.execute('UPDATE class_test_attempts SET started_at=started_at-120000 WHERE test_id=?',(late['id'],));db._conn.commit()
        r=self.post('/api/class/test/submit',token=self.s,test_id=late['id'],answers={'0':'B'})
        self.assertFalse(r['ok']);self.assertTrue(r['is_timeout']);self.assertEqual(db.list_attempts(late['id']),[])
        removed=exam(); db.remove_group_member(self.group['id'],'security_teacher','security_student')
        r=self.post('/api/class/test/submit',token=self.s,test_id=removed['id'],answers={'0':'B'})
        self.assertFalse(r['ok']);self.assertEqual(db.list_attempts(removed['id']),[])


if __name__ == '__main__':
    try:
        unittest.main()
    finally:
        if db._conn is not None: db._conn.close(); db._conn=None
        _tmp.cleanup()
