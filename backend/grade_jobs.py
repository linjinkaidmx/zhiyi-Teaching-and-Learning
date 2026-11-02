"""Durable grading progress. Restarted jobs require an explicit teacher retry.

The application runs one worker process. Grades stay in the main database;
this sidecar only records progress and never automatically repeats model calls.
"""
import json
import sqlite3
import time
import tempfile
from contextlib import contextmanager
from pathlib import Path


class GradeJobs:
    def __init__(self, database):
        self._temporary = tempfile.TemporaryDirectory(prefix='grade-jobs-') if database == ':memory:' else None
        if self._temporary:
            database = str(Path(self._temporary.name) / 'memory.db')
        self.path = str(Path(database).with_suffix('.grade-jobs.db'))
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, data TEXT NOT NULL)')

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.path, timeout=10)
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def save(self, task):
        with self._connect() as conn:
            conn.execute('INSERT OR REPLACE INTO jobs VALUES (?,?)',
                         (task['id'], json.dumps(task, ensure_ascii=False)))

    def recover(self):
        with self._connect() as conn:
            tasks = [json.loads(row[0]) for row in conn.execute('SELECT data FROM jobs')]
        for task in tasks:
            if not task.get('finished'):
                completed = set(task.get('completed_ids', []))
                task.update(finished=True, status='interrupted',
                            error='服务重启中断了批改，已保存的成绩保留。请重新发起批改以处理剩余提交。',
                            finished_at=int(time.time() * 1000),
                            failed=[u for u in task.get('user_ids', []) if u not in completed])
                self.save(task)
        return sorted(tasks, key=lambda t: t.get('started_at', 0))
