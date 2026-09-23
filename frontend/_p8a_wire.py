# -*- coding: utf-8 -*-
"""P8-A 接线：学习记录埋点 + recordsStore 随空间初始化"""
import io
import os

SRC = r'E:\知一2.0\frontend\src'
done, failed = [], []


def patch(rel, pairs, must=True):
    p = os.path.join(SRC, rel)
    s = io.open(p, encoding='utf-8').read()
    hits = 0
    for a, b in pairs:
        if a in s:
            s = s.replace(a, b, 1)
            hits += 1
        elif must:
            failed.append(f'{rel}: 未命中 → {a[:50]}')
    try:
        io.open(p, 'w', encoding='utf-8').write(s)
        done.append(f'{rel}（{hits} 处）')
    except PermissionError:
        failed.append(f'{rel}: 文件被锁')


# 1) flowStore：讲解完成 → 学习记录
patch('stores/flowStore.js', [(
    "      recordAction('explain') // 打卡埋点：完成一次讲解",
    "      recordAction('explain') // 打卡埋点：完成一次讲解\n"
    "      logLearning('explain', { title: item.text, brief: (item.result && item.result.subject) || '' })",
), (
    "import { recordAction } from './statsStore'",
    "import { recordAction } from './statsStore'\nimport { logLearning } from './recordsStore'",
)])

# 2) bookStore：存入错题本 → 学习记录
patch('stores/bookStore.js', [(
    "  recordAction('save')",
    "  recordAction('save')\n  logLearning('save', { title: item.text, brief: (item.result && item.result.subject) || '' })",
), (
    "import { evaluateNow, recordAction } from './statsStore'",
    "import { evaluateNow, recordAction } from './statsStore'\nimport { logLearning } from './recordsStore'",
)])

# 3) CodeDebug：诊断完成 → 学习记录
patch('components/CodeDebug.vue', [(
    "    recordAction('debug') // 打卡埋点：完成一次代码诊断",
    "    recordAction('debug') // 打卡埋点：完成一次代码诊断\n    logLearning('debug', { title: description.value || '代码诊断', brief: lang.value || '自动识别' })",
), (
    "import { recordAction } from '../statsStore'",
    "import { recordAction } from '../statsStore'\nimport { logLearning } from '../stores/recordsStore'",
)])

# 4) PracticePage：自测作答 → 学习记录
patch('pages/PracticePage.vue', [(
    "  recordAction('quiz', { correct: ok })",
    "  recordAction('quiz', { correct: ok })\n  logLearning('quiz', { title: (current.value && current.value.text) || '', correct: ok, brief: mode.value === 'original' ? '原题复习' : mode.value === 'variation' ? '变式题' : 'AI 新出题' })",
), (
    "import { recordAction } from '../stores/statsStore'",
    "import { recordAction } from '../stores/statsStore'\nimport { logLearning } from '../stores/recordsStore'",
)])

# 5) ExplainPage：追问成功率埋点（P5 迁移时漏了 recordAction('followup')）+ 学习记录
patch('pages/ExplainPage.vue', [(
    "      msg.streaming = false\n      // 追问记录随题保存（存入错题本时一并带走）",
    "      msg.streaming = false\n      recordAction('followup')\n      logLearning('followup', { title: q, brief: '追问' })\n      // 追问记录随题保存（存入错题本时一并带走）",
), (
    "import { generateVariants } from '../lib/mock/variants.js'",
    "import { generateVariants } from '../lib/mock/variants.js'\nimport { recordAction } from '../stores/statsStore'\nimport { logLearning } from '../stores/recordsStore'",
)])

# 6) sessionStore：recordsStore 随空间切换初始化
p = os.path.join(SRC, 'stores', 'sessionStore.js')
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { initChat } from './chatStore'", "import { initChat } from './chatStore'\nimport { initRecords } from './recordsStore'")
for sp in ['account', 'guest']:
    s = s.replace(f"    initChat('{sp}')", f"    initChat('{sp}')\n    initRecords('{sp}')")
    s = s.replace(f"  initChat('{sp}')\n  initStats", f"  initChat('{sp}')\n  initRecords('{sp}')\n  initStats")
s = s.replace("  initChat(session.space)\n  initProfile(session.space)", "  initChat(session.space)\n  initRecords(session.space)\n  initProfile(session.space)")
try:
    io.open(p, 'w', encoding='utf-8').write(s)
    done.append('stores/sessionStore.js')
except PermissionError:
    failed.append('stores/sessionStore.js: 文件被锁')

print('已改:', done)
print('未完成:', failed if failed else '无')
print('sessionStore initRecords 次数:', s.count('initRecords('))
