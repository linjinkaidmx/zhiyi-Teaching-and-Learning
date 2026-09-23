/**
 * 验证 ④ 后台批改任务：学生重交造待批 → 老师启动 → 轮询进度 → 完成
 * 用法：node _qa_gradetask.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

async function main() {
  const list = await post('/api/homework/list', { token: ACC.teacher.token, class_id: ACC.class_id })
  const hw = (list.items || [])[0]
  console.log('目标作业:', hw.title)
  const T = ACC.teacher.token
  const S = ACC.student.token

  console.log('\n===== 权限与空态 =====')
  const byStudent = await post('/api/homework/grade-start', { token: S, homework_id: hw.id })
  ok(!byStudent.ok && /老师/.test(before(byStudent)), '学生不能启动批改', before(byStudent))
  const st0 = await post('/api/homework/grade-status', { token: T, homework_id: hw.id })
  ok(st0.ok && st0.task === null, '尚无任务时 status 返回 null', st0.task)

  console.log('\n===== 造一份待批（学生重交） =====')
  const sub = await post('/api/homework/submit', {
    token: S, homework_id: hw.id, note: '后台批改任务验证：栈的特点是后进先出，队列是先进先出。',
  })
  ok(sub.ok, '学生重新提交成功（提交状态应回到待批）', sub.error || 'ok')
  const subs = await post('/api/homework/submissions', { token: T, homework_id: hw.id })
  const mine = (subs.items || []).find((s) => s.user_id === ACC.student.nickname)
  const pending = (subs.items || []).filter((s) => (s.graded_at || 0) <= 0).length
  ok(pending >= 1, '存在待批提交', { pending, score: mine ? mine.score : null })

  console.log('\n===== 启动任务并轮询 =====')
  const started = await post('/api/homework/grade-start', { token: T, homework_id: hw.id })
  ok(started.ok, '老师启动批改任务', started.error || 'ok')
  if (!started.ok) { console.log(`\n结果：通过 ${pass}，失败 ${fail}`); process.exit(1) }
  const t0 = Date.now()
  console.log('  · 初始任务:', JSON.stringify(started.task))
  ok(started.task.total >= 1 && !started.task.finished, '任务含总数且未完成', { total: started.task.total })

  // 立刻再启动一次 → 应复用同一任务
  const again = await post('/api/homework/grade-start', { token: T, homework_id: hw.id })
  ok(again.ok && again.reused === true && again.task.id === started.task.id, '重复启动会复用进行中的任务', { reused: again.reused })

  let last = null
  const timeline = []
  for (let i = 0; i < 150; i++) {
    const r = await post('/api/homework/grade-status', { token: T, homework_id: hw.id })
    last = r.task
    const secs = Math.round((Date.now() - t0) / 1000)
    if (i % 5 === 0) timeline.push(`${secs}s:${last ? `${last.done + last.failed.length}/${last.total}` : 'null'}`)
    if (last && last.finished) break
    await sleep(2000)
  }
  console.log('  · 进度时间线:', timeline.join(' → '))
  console.log('  · 最终:', JSON.stringify(last))
  ok(!!last && last.finished, '任务在 5 分钟内完成', last && last.finished)
  ok(!!last && last.done >= 1, '至少 1 份批改成功', last && last.done)
  ok(!!last && last.failed.length + last.done === last.total, '成功数 + 失败数 = 总数', last && { done: last.done, failed: last.failed.length, total: last.total })

  console.log('\n===== 完成后再查 =====')
  const r2 = await post('/api/homework/grade-status', { token: T, homework_id: hw.id })
  ok(r2.ok && r2.task && r2.task.finished, '已完成的任务仍可查（离开页面回来能看到结果）', r2.task && r2.task.finished)
  const subs2 = await post('/api/homework/submissions', { token: T, homework_id: hw.id })
  const after = (subs2.items || []).find((s) => s.user_id === ACC.student.nickname)
  ok(after && (after.graded_at || 0) > 0, '结果已落库（提交变为已批改）', after && { score: after.score })

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}
function before(r) { return r.error || '' }
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
