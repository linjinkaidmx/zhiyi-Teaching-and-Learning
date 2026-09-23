/**
 * 错题课程归类 · 端到端验证（离线自包含：本地 vite preview + CDP）
 * 用法：node _qa_course.mjs [outDir]
 * 链路：造课程表 + 错题 → 错题页按课程筛选 → 卡片显示课程名/未归类
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9500
const OUTDIR = process.argv[2] || 'dist69'
const WEBPORT = 5700 + (process.pid % 300)
const WEB = 'http://127.0.0.1:' + WEBPORT
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

let ws
let seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function waitSel(sel, timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev('!!document.querySelector("' + sel + '")')) return true } catch { /* retry */ }
    await sleep(300)
  }
  return false
}

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_course_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch('http://127.0.0.1:' + PORT + '/json/version')).ok) break } catch { /* retry */ }
    await sleep(250)
  }
  const t = await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) p.reject(new Error(m.error.message))
      else p.resolve(m.result)
      return
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

  section('1. 造课程表 + 错题（含 courseId）')
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.home__body')
  await ev(`(() => {
    const now = new Date().toISOString()
    // 课程表（courseStore v2 结构）
    localStorage.setItem('zhiyi_schedule_v2', JSON.stringify({
      courses: [
        { id: 'c1', name: '概率论与数理统计', teacher: '', location: '', color: '#6f57f0', chapters: [] },
        { id: 'c2', name: '数据结构与算法', teacher: '', location: '', color: '#46b26f', chapters: [] },
      ],
      timetable: [], exams: [], term: { startDate: '2026-09-07', totalWeeks: 20, updatedAt: Date.now() },
      deletedIds: [], deletedSlotIds: [], deletedExamIds: [],
    }))
    // 错题：一道归到概率论(c1)、一道归到数据结构(c2)、一道未归类
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify([
      { id: 'q1', question: '求 P(B|A)', subject: '概率论', knowledgePoints: ['条件概率'],
        quizCount: 1, correctCount: 0, mastered: false, reviewAt: 0, courseId: 'c1', createdAt: now },
      { id: 'q2', question: '求链表反转', subject: '数据结构', knowledgePoints: ['链表'],
        quizCount: 1, correctCount: 0, mastered: false, reviewAt: 0, courseId: 'c2', createdAt: now },
      { id: 'q3', question: '求极限', subject: '高等数学', knowledgePoints: ['极限'],
        quizCount: 1, correctCount: 0, mastered: false, reviewAt: 0, courseId: '', createdAt: now },
    ]))
    return true
  })()`)

  section('2. 错题页：卡片显示课程名/未归类')
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.wb__card')
  await sleep(1200)
  const cards = await ev(`(() => {
    const tags = [...document.querySelectorAll('.wb__card')].map((c) => {
      const t = c.querySelector('.wb__card-top .ui-tag')
      return t ? t.textContent.trim() : ''
    })
    const opts = [...document.querySelectorAll('.wb__select')][0]
    return { tags, options: opts ? [...opts.options].map((o) => o.textContent.trim()) : [] }
  })()`)
  console.log('  · 卡片标签 → ' + JSON.stringify(cards.tags))
  console.log('  · 课程筛选选项 → ' + JSON.stringify(cards.options))
  ok(cards.tags.includes('概率论与数理统计'), '已归类题显示课程名（概率论与数理统计）')
  ok(cards.tags.includes('数据结构与算法'), '已归类题显示课程名（数据结构与算法）')
  ok(cards.tags.includes('高等数学'), '未归类题显示 AI subject（高等数学）')
  ok(cards.options.includes('概率论与数理统计') && cards.options.includes('数据结构与算法'), '筛选选项来自课程表')
  ok(cards.options.includes('未归类'), '筛选有「未归类」项', cards.options)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'wrongbook-course.png'), Buffer.from(shot.data, 'base64'))

  section('3. 按课程筛选')
  const filtered = await ev(`(() => {
    const sel = document.querySelectorAll('.wb__select')[0]
    sel.value = 'c1'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(800)
  const after = await ev(`(() => {
    const tags = [...document.querySelectorAll('.wb__card .wb__card-top .ui-tag')].map((t) => t.textContent.trim())
    return { count: document.querySelectorAll('.wb__card').length, tags }
  })()`)
  ok(after.count === 1 && after.tags.includes('概率论与数理统计'), '筛选 c1 后只剩概率论那题', after)

  section('4. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '错题课程归类验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('脚本异常：', e); process.exit(1) })
