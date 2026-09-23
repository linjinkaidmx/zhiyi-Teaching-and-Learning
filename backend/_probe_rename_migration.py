# -*- coding: utf-8 -*-
"""改昵称的「三表迁移 + 重签 token」端到端验证（真实线上）

为什么单独验这条：
  改昵称是唯一会**动数据归属**的操作 —— errorbook / user_stats / user_profile 三张表都以昵称为 user_id，
  改名必须：验密码 → 唯一性校验 → 三表迁移 → 重签 token → 前端换会话。
  后端有 `_test_profile_api.py` 覆盖，但**真实线上 + 改完之后旧数据能否被新 token 取回**从未验过。

用法：python _probe_rename_migration.py
"""
import json
import random
import sys
import time
import urllib.error
import urllib.request

BASE = 'http://193.112.28.51:3300'
OLD = 'rn%d' % random.randint(100000, 999999)
NEW = OLD + 'x'
PW = 'rename123456'

pass_n = 0
fail_n = 0


def ok(cond, label, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print('  ✓ ' + label)
    else:
        fail_n += 1
        print('  ✗ ' + label + ('  → ' + repr(extra) if extra is not None else ''))


def post(path, body, timeout=60):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'}, method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode('utf-8'))


print('改昵称三表迁移 · 端到端验证')
print('账号: %s → %s\n' % (OLD, NEW))

print('1. 建号并写入四类数据')
r = post('/api/account/register', {'nickname': OLD, 'password': PW, 'password_confirm': PW})
ok(r.get('ok') is True, '注册成功', r)
tok_old = r.get('token', '')
r = post('/api/sync/push', {
    'token': tok_old,
    'items': [{'id': 'e1', 'question': '改名迁移测试题', 'answer': '1', 'mastered': False}],
    'stats': {'days': [20260920], 'totals': {'explain': 1}, 'achievements': []},
    'courses': {'courses': [{'id': 'c1', 'name': '改名迁移课程'}], 'timetable': [], 'deletedIds': []},
    'sessions': [{'id': 's1', 'type': 'explain', 'title': '改名迁移记录', 'minutes': 1,
                  'createdAt': int(time.time() * 1000)}],
})
ok(r.get('ok') is True, '推送错题/统计/课程/学习记录', r)

print('\n2. 改昵称（要验密码 + 唯一性）')
r = post('/api/account/rename', {'token': tok_old, 'password': '错密码', 'new_nickname': NEW})
ok(r.get('ok') is False, '密码错误被拒绝', r.get('error'))
r = post('/api/account/rename', {'token': tok_old, 'password': PW, 'new_nickname': OLD})
ok(r.get('ok') is False, '改成同名被拒绝（唯一性校验）', r.get('error'))
r = post('/api/account/rename', {'token': tok_old, 'password': PW, 'new_nickname': NEW})
ok(r.get('ok') is True, '改名成功', r)
tok_new = r.get('token', '')
ok(bool(tok_new) and tok_new != tok_old, '返回了**新的** token（重签）')

print('\n3. 关键：用新 token 能否取回改名前写入的四类数据（= 三表迁移真的生效）')
d = post('/api/sync/pull', {'token': tok_new})
ok(d.get('ok') is True, '新 token 拉取成功', d)
ok(any(it.get('id') == 'e1' for it in (d.get('items') or [])), '错题本数据跟着走')
ok(bool((d.get('stats') or {}).get('days')), '打卡统计跟着走')
ok((d.get('courses') or {}).get('courses', [{}])[0].get('name') == '改名迁移课程', '课程跟着走')
ok((d.get('sessions') or [{}])[0].get('id') == 's1', '学习记录跟着走')
p = post('/api/account/profile', {'token': tok_new})
ok(p.get('ok') is True, '个人资料用新 token 可读', p.get('error'))

print('\n4. 旧 token 应失效（避免两套身份并存）')
d_old = post('/api/sync/pull', {'token': tok_old})
ok(d_old.get('ok') is False, '旧 token 已失效', d_old.get('error'))

print('\n5. 新昵称可登录、旧昵称不可登录')
r = post('/api/account/login', {'nickname': NEW, 'password': PW})
ok(r.get('ok') is True, '新昵称能登录')
r_old = post('/api/account/login', {'nickname': OLD, 'password': PW})
ok(r_old.get('ok') is False, '旧昵称已不能登录')

print('\n6. 清理')
r = post('/api/account/delete', {'token': tok_new, 'password': PW})
ok(r.get('ok') is True, '测试账号已注销', r)

print('\n' + '=' * 46)
print(f'全部通过（{pass_n} 项）' if fail_n == 0 else f'有 {fail_n} 项未通过（通过 {pass_n} 项）')
sys.exit(0 if fail_n == 0 else 1)
