/**
 * 课程颜色（课表色块按课程上色 + 可编辑）验证（本地 vite preview + CDP）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9450 + (process.pid % 120)
const OUTDIR = process.argv[2] || 'dist88'
const WEBPORT = 5850 + (process.pid % 120)
const WEB = 'http://127.0.0.1:' + WEBPORT
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const seed = {
  courses: [
    { id: 'c1', name: '数据结构', teacher: '', location: '教三302', color: '#3d5a8a', chapters: [], updatedAt: 1 },
    { id: 'c2', name: '高等数学', teacher: '', location: '教五101', color: '#4a7a63', chapters: [], updatedAt: 1 },
  ],
  timetable: [
    { id: 's1', courseId: 'c1', day: 1, slot: 1, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
    { id: 's2', courseId: 'c2', day: 3, slot: 1, location: '教五101', weeks: { type: 'every' }, updatedAt: 1 },
  ],
  exams: [],
  term: { startDate: '2026-09-01', totalWeeks: 20, updatedAt: 1 },
  deletedIds: [], deletedSlotIds: [], deletedExamIds: [],
}

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ccolor_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false })

  // 注入两门不同颜色的课 + 各一节排课
  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.zy-page')
  await ev(`localStorage.setItem('zhiyi_schedule_v2', ${JSON.stringify(JSON.stringify(seed))})`)
  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.tt__grid')
  await sleep(900)

  const bg = await ev(`(() => {
    const blocks = [...document.querySelectorAll('.tt__cell .tt__course')]
    return blocks.map((b) => ({
      name: b.textContent.trim(),
      bg: getComputedStyle(b).backgroundColor,
      border: getComputedStyle(b).borderLeftColor,
    }))
  })()`)
  console.log('  · 色块 →', JSON.stringify(bg))
  ok(bg.length === 2, '两个课块渲染', bg.length)
  ok(bg[0].bg !== bg[1].bg, '不同课程的背景色不同', [bg[0].bg, bg[1].bg])
  ok(bg[0].border !== bg[1].border, '左侧色条同样按课程色区分', [bg[0].border, bg[1].border])
  ok(!/rgba\(0, 0, 0, 0\)/.test(bg[0].bg) && bg[0].bg !== 'rgb(255, 255, 255)', '背景不是透明/纯白（确实按课程上色）', bg[0].bg)

  // 编辑弹窗的颜色选择器
  await send('Page.navigate', { url: WEB + '/course' })
  await waitSel('.co__list')
  await sleep(700)
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '编辑').click()`)
  await sleep(700)
  const sw = await ev(`(() => {
    const all = document.querySelectorAll('.co__swatch')
    const custom = document.querySelector('.co__swatch--custom input[type=color]')
    return { count: all.length, hasCustom: !!custom, activeIdx: [...all].findIndex((s) => s.classList.contains('is-active')) }
  })()`)
  console.log('  · 色板 →', JSON.stringify(sw))
  ok(sw.count === 7, '色板 6 个预设 + 1 个自定义', sw.count)
  ok(sw.hasCustom, '有自定义取色器（input[type=color]）')
  ok(sw.activeIdx === 0, '打开时高亮当前课程色（第 1 个预设）', sw.activeIdx)

  // 改选第 5 个预设色并保存
  await ev(`(() => {
    const all = document.querySelectorAll('.co__swatch')
    all[4].click()
    return true
  })()`)
  await sleep(400)
  const active5 = await ev(`[...document.querySelectorAll('.co__swatch')].findIndex((s) => s.classList.contains('is-active'))`)
  ok(active5 === 4, '点选后高亮跟到第 5 个色', active5)

  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '保存').click()`)
  await sleep(900)
  const savedColor = await ev(`(() => {
    const st = JSON.parse(localStorage.getItem('zhiyi_schedule_v2') || '{}')
    const c = (st.courses || []).find((x) => x.id === 'c1')
    return c ? c.color : ''
  })()`)
  ok(savedColor && savedColor.toLowerCase() === '#3d6a7a', '颜色写入课程（第 5 个预设色）', savedColor)

  // 回课表：色块背景应随之变化
  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.tt__grid')
  await sleep(900)
  const after = await ev(`(() => {
    const blocks = [...document.querySelectorAll('.tt__cell .tt__course')]
    const target = blocks.find((b) => b.textContent.includes('数据结构'))
    return target ? { bg: getComputedStyle(target).backgroundColor, border: getComputedStyle(target).borderLeftColor } : null
  })()`)
  console.log('  · 改色后 →', JSON.stringify(after))
  ok(after && after.bg !== bg[0].bg, '课表色块背景随课程色改变', { before: bg[0].bg, after: after && after.bg })

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'tt-course-color.png'), Buffer.from(shot.data, 'base64'))

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '课程颜色验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
