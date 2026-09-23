/**
 * 手机端课表网格验证（本地 vite preview + CDP）
 * 375px 移动视口打开课程表（注入学期 + 两门课连排），断言网格渲染、7 列可见、无横向溢出
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9950 + (process.pid % 150)
const OUTDIR = process.argv[2] || 'dist82'
const WEBPORT = 5995 + (process.pid % 150)
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

const seed = {
  courses: [
    { id: 'c1', name: '数据结构', teacher: '', location: '教三302', chapters: [], updatedAt: 1 },
    { id: 'c2', name: '高等数学', teacher: '', location: '教五101', chapters: [], updatedAt: 1 },
  ],
  timetable: [
    { id: 's1', courseId: 'c1', day: 1, slot: 3, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
    { id: 's2', courseId: 'c1', day: 1, slot: 4, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
    { id: 's3', courseId: 'c1', day: 1, slot: 5, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
    { id: 's4', courseId: 'c2', day: 3, slot: 1, location: '教五101', weeks: { type: 'every' }, updatedAt: 1 },
    { id: 's5', courseId: 'c2', day: 5, slot: 2, location: '教五101', weeks: { type: 'every' }, updatedAt: 1 },
  ],
  exams: [],
  term: { startDate: '2026-09-01', totalWeeks: 20, updatedAt: 1 },
  deletedIds: [], deletedSlotIds: [], deletedExamIds: [],
}

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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ttmobile_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  // iPhone 尺寸
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })

  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.zy-page')
  await ev(`localStorage.setItem('zhiyi_schedule_v2', ${JSON.stringify(JSON.stringify(seed))})`)
  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.tt__grid')
  await sleep(900)

  const g = await ev(`(() => {
    const grid = document.querySelector('.tt__grid')
    const days = [...document.querySelectorAll('.tt__day')].map((d) => d.textContent.trim())
    const courseCells = document.querySelectorAll('.tt__cell.has-course').length
    const spanRows = [...document.querySelectorAll('.tt__cell.is-span')].map((c) => getComputedStyle(c).gridRow)
    const courses = [...document.querySelectorAll('.tt__cell .tt__course')].map((c) => c.textContent.trim())
    const metas = [...document.querySelectorAll('.tt__cell .tt__cell-meta')].map((e) => e.textContent.trim())
    const doc = document.documentElement
    const firstCourse = document.querySelector('.tt__cell .tt__course')
    const cs = firstCourse ? getComputedStyle(firstCourse) : null
    return {
      hasGrid: !!grid,
      noDayList: document.querySelectorAll('.tt__days').length === 0,
      days,
      courseCells, spanRows, courses, metas,
      docScrollW: doc.scrollWidth, docClientW: doc.clientWidth,
      courseFontSize: cs ? cs.fontSize : '',
    }
  })()`)
  console.log('  · 网格 →', JSON.stringify({ courseCells: g.courseCells, spanRows: g.spanRows, courses: g.courses, metas: g.metas }))

  ok(g.hasGrid, '移动端渲染网格（不再是按天列表）')
  ok(g.noDayList, '旧的按天卡片列表已移除')
  ok(g.days.length === 7, '7 个星期表头都在', g.days)
  ok(g.courseCells === 3, '连排 3 节只渲染 1 个格子（+2 个单节块）', g.courseCells)
  ok(g.spanRows.length === 1 && /span 3/.test(g.spanRows[0]), '跨行块跨 3 行', g.spanRows)
  ok(g.courses.length === 3, '每块只出现一次课名（无重复碎片）', g.courses)
  ok(g.metas.includes('教三302'), '跨行块内显示教室', g.metas)
  ok(g.docScrollW <= g.docClientW, '无横向溢出（7 列一屏放下）', { scrollW: g.docScrollW, clientW: g.docClientW })
  ok(g.courseFontSize === '10px', '移动端课名维持小字号', g.courseFontSize)

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'timetable-mobile.png'), Buffer.from(shot.data, 'base64'))

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '手机端课表网格验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
