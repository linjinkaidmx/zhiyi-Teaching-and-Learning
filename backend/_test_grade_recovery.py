"""Offline: restart persistence, explicit retry, deduplicated grading, mock generation."""

import test_support  # isolated database, no credentials or network
import os
import tempfile
import time
import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

tmp = tempfile.TemporaryDirectory(prefix='zhiyi-grade-recovery-')
os.environ.update(MOCK='1', PYTHON_DOTENV_DISABLED='1', ZHIYI_DB=str(Path(tmp.name) / 'test.db'))
import main
import db
import service
from grade_jobs import GradeJobs
from fastapi.testclient import TestClient

client = TestClient(main.app)
def post(path, **kw):
    return client.post(path, json=kw).json()
def reg(nick):
    return post('/api/account/register', nickname=nick, password='Test123456', password_confirm='Test123456')['token']

teacher = reg('grade_teacher')
s1, s2 = reg('grade_student1'), reg('grade_student2')
post('/api/teacher/apply', token=teacher, name='测试老师', school='测试学校')
cls = post('/api/class/create', token=teacher, name='测试班')['class']
for token in (s1, s2):
    assert post('/api/class/join', token=token, code=cls['invite_code'])['ok']
hw = post('/api/homework/create', token=teacher, class_id=cls['id'], title='恢复测试', content='1+1')['homework']
for token in (s1, s2):
    assert post('/api/homework/submit', token=token, homework_id=hw['id'], image_base64='aGVsbG8=', note='2')['ok']

# Capture a persisted task without running its worker; simulate commit before crash.
with patch.object(main, '_run_grade_task'):
    task = post('/api/homework/grade-start', token=teacher, homework_id=hw['id'])['task']
    duplicate = post('/api/homework/grade-start', token=teacher, homework_id=hw['id'])
    assert duplicate['reused'] and duplicate['task']['id'] == task['id']
first_id = db.find_submission_id(hw['id'], 'grade_student1')
db.save_grade(first_id, 93, {'items': [], 'overall': 'saved before restart'}, 'saved')

recovered = json.loads(subprocess.check_output(
    [sys.executable, '-c', 'import json,sys; from grade_jobs import GradeJobs; print(json.dumps(GradeJobs(sys.argv[1]).recover()))', db.DB_FILE],
    cwd=Path(__file__).resolve().parent, encoding='utf-8'))
assert len(recovered) == 1 and recovered[0]['status'] == 'interrupted'
assert recovered[0]['finished'] and recovered[0]['error']
main._GRADE_TASKS = {t['id']: t for t in recovered}
main._GRADE_TASK_BY_HW = {t['homework_id']: t['id'] for t in recovered}
assert post('/api/homework/grade-status', token=teacher, homework_id=hw['id'])['task']['status'] == 'interrupted'
assert not post('/api/homework/grade-status', token=s1, homework_id=hw['id'])['ok']
with patch.object(main, '_mock_grade_one', wraps=main._mock_grade_one) as grade:
    restarted = post('/api/homework/grade-start', token=teacher, homework_id=hw['id'])['task']
    assert restarted['total'] == 1
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        result = post('/api/homework/grade-status', token=teacher, homework_id=hw['id'])['task']
        if result['finished']:
            break
        time.sleep(.02)
    assert result['status'] == 'completed' and result['done'] == 1, result
    assert grade.call_count == 1
assert db.get_submission(hw['id'], 'grade_student1')['score'] == 93
assert not post('/api/homework/grade-start', token=teacher, homework_id=hw['id'])['ok']
assert GradeJobs(db.DB_FILE).recover()[-1]['status'] == 'completed'
print('PASS: restart persisted, explicit retry, no regrading committed scores, teacher-only status')

args = dict(token=teacher, class_id=cls['id'], choice_count=2, blank_count=1)
with patch.object(service, 'chat_text', side_effect=AssertionError('Mock must not call model')):
    draft = post('/api/class/test/generate', **args)
    assert draft['ok'] and len(draft['items']) == 3, draft
with patch.object(service, 'MOCK', False), patch.object(service, 'chat_text', side_effect=TimeoutError('secret detail')):
    draft = post('/api/class/test/generate', **args)
    assert not draft['ok'] and 'secret detail' not in draft['error']
print('PASS: Mock generation offline, model failure returns friendly error')
main._GRADE_POOL.shutdown(wait=True)
client.close()
db._conn.close()
tmp.cleanup()

