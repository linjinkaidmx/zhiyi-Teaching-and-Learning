/**
 * 批改并发能力实测：同一份提交并发 3 次 vs 串行 3 次，对比总耗时。
 * 用法：node _qa_grade_parallel.mjs
 */
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))

const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

async function main() {
  const list = await post('/api/homework/list', { token: ACC.teacher.token, class_id: ACC.class_id })
  // 找一份有图片提交的作业（批改耗时最能体现并发收益）
  let hid = ''
  let uid = ''
  for (const hw of list.items || []) {
    const subs = await post('/api/homework/submissions', { token: ACC.teacher.token, homework_id: hw.id }).catch(() => null)
    const arr = (subs && subs.items) || []
    const pick = arr.find((s) => s.has_image) || arr[0]
    if (pick) { hid = hw.id; uid = pick.user_id; break }
  }
  if (!hid) { console.log('没找到带图片的提交，跳过（需要至少一份图片提交才能测出并发收益）'); process.exit(0) }
  console.log('目标：作业', hid.slice(0, 8), '学生', uid)

  // ① 串行 2 次（第一次全量、第二次命中转录缓存）
  let t0 = Date.now()
  await post('/api/homework/grade', { token: ACC.teacher.token, homework_id: hid, user_id: uid })
  const serialOne = (Date.now() - t0) / 1000
  t0 = Date.now()
  await post('/api/homework/grade', { token: ACC.teacher.token, homework_id: hid, user_id: uid })
  const serialTwo = (Date.now() - t0) / 1000
  console.log(`串行：第 1 次 ${serialOne.toFixed(1)}s，第 2 次（命中转录缓存）${serialTwo.toFixed(1)}s`)

  // ② 并发 3 次（同一份，验证后端可并行处理、互不阻塞）
  t0 = Date.now()
  const rs = await Promise.all([1, 2, 3].map(() => post('/api/homework/grade', { token: ACC.teacher.token, homework_id: hid, user_id: uid })))
  const parallel = (Date.now() - t0) / 1000
  const okAll = rs.every((r) => r.ok)
  console.log(`并发 3 次总耗时 ${parallel.toFixed(1)}s（全部成功=${okAll}）`)
  console.log(`对比：若真串行需约 ${(serialTwo * 3).toFixed(1)}s`)
  console.log(parallel < serialTwo * 2 ? '✓ 并发有效（后端可并行处理，无串行阻塞）' : '✗ 未体现并发收益，需检查')
  process.exit(okAll ? 0 : 1)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
