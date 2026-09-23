/**
 * 验证：教师端导出成绩单（CSV）+ 权限校验
 * 用法：node _qa_export_scores.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

async function main() {
  const list = await post('/api/homework/list', { token: ACC.teacher.token, class_id: ACC.class_id })
  const hw = (list.items || []).find((h) => (h.submitted || 0) > 0) || (list.items || [])[0]
  console.log('目标作业:', hw ? hw.title : '(无)')

  // ① 老师导出
  const r = await post('/api/class/export-scores', { token: ACC.teacher.token, homework_id: hw.id })
  ok(r.ok, '老师可导出', r.error || 'ok')
  if (r.ok) {
    fs.writeFileSync(path.join(OUT, r.filename || 'scores.csv'), r.csv, 'utf-8')
    const lines = r.csv.split('\r\n')
    console.log('  · 文件名:', r.filename, '| 行数:', lines.length)
    console.log('  · 表头:', lines[0].replace('\ufeff', ''))
    lines.slice(1, 4).forEach((l) => console.log('  · 数据:', l))
    ok(r.csv.startsWith('\ufeff'), '带 UTF-8 BOM（Excel 中文不乱码）')
    const head = lines[0].replace('\ufeff', '')
    ok(head.includes('学生') && head.includes('得分') && head.includes('提交时间'), '表头字段完整', head)
    ok(/汇总/.test(r.csv), '含末尾汇总行')
    ok(r.count >= 1, '统计到学生数', { count: r.count, graded: r.graded })
    ok(lines.length >= 3, '至少「表头 + 学生行 + 汇总行」', lines.length)
    ok(r.filename.endsWith('.csv'), '文件名带 .csv 后缀', r.filename)
  }

  // ② 权限：学生不能导出
  const stu = await post('/api/class/export-scores', { token: ACC.student.token, homework_id: hw.id })
  ok(!stu.ok && /老师/.test(stu.error || ''), '学生无权导出（被拦）', stu.error)

  // ③ 无 token
  const anon = await post('/api/class/export-scores', { token: '', homework_id: hw.id })
  ok(!anon.ok, '未登录被拦', anon.error)

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('CSV 落盘: ' + OUT)
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
