/**
 * 首页「今日课程」卡片尺寸探测（需起服务）：
 * 测量有课/无课 × 桌面/移动 四种情况下的卡片高度与内部分块尺寸，为「瘦身」方案提供依据。
 * 用法：node _probe_home_card.mjs [outDir]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9200 + (process.pid % 150)
const OUTDIR = process.argv[2] || 'dist94'
const WEBPORT = 5600 + (process.pid % 150)
const WEB = 'http://127.0.0.1:' + WEBPORT

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 今天周一（2026-09-21）→ 分别放周一（今天有课）/周三（今天没课）
const mk = (day) => ({
  courses: [{ id: 'c' + day, name: '数据结构', teacher: '王老师', location: '教三302', color: '#3d5a8a', updatedAt: 1 }],
  timetable: [
    { id: 'a' + day, courseId: 'c' + day, day, slot: 3, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
    { id: 'b' + day, courseId: 'c' + day, day, slot: 4, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
  ],
  exams: [], term: { startDate: '2026-09-01', totalWeeks: 20, updatedAt: 1 },
  deletedIds: [], deletedSlotIds: [], deletedExamIds: [],
})

let ws
let seq = 0
const pending = new Map()
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitSel(sel, timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev('!!document.querySelector("' + sel + '")')) return true } catch { }
    await sleep(300)
  }
  return false
}

const measure = () => ev(`(() => {
  const card = document.querySelector('.today-row')
  if (!card) return null
  const cs = getComputedStyle(card)
  const r = card.getBoundingClientRect()
  const head = card.querySelector('.ui-card__head')
  const hr = head ? head.getBoundingClientRect() : null
  const item = card.querySelector('.today-pill')
  const ir = item ? item.getBoundingClientRect() : null
  const empty = card.querySelector('.today-row__empty')
  const er = empty ? empty.getBoundingClientRect() : null
  return {
    cardH: Math.round(r.height),
    cardW: Math.round(r.width),
    padding: cs.padding,
    headH: hr ? Math.round(hr.height) : 0,
    headMB: head ? getComputedStyle(head).marginBottom : '',
    itemH: ir ? Math.round(ir.height) : 0,
    itemCount: card.querySelectorAll('.today-pill').length,
    emptyH: er ? Math.round(er.height) : 0,
    titleSize: (() => { const t = card.querySelector('.today-row__title'); return t ? getComputedStyle(t).fontSize : '' })(),
  }
})()`)

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'probe_homecard_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch('http://127.0.0.1:' + PORT + '/json/version')).ok) break } catch { }
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
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')

  const sizes = [
    { name: '桌面 1400', w: 1400, h: 1000, mobile: false },
    { name: '手机 375', w: 375, h: 812, mobile: true },
  ]
  for (const s of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: s.mobile })
    for (const kind of [{ k: '今天有课', day: 1 }, { k: '今天没课', day: 3 }]) {
      await send('Page.navigate', { url: WEB + '/' })
      await waitSel('.zy-page')
      await ev(`localStorage.setItem('zhiyi_schedule_v2', ${JSON.stringify(JSON.stringify(mk(kind.day)))})`)
      await send('Page.navigate', { url: WEB + '/' })
      await waitSel('.today-row')
      await sleep(800)
      const m = await measure()
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      fs.mkdirSync(path.resolve('.learnbuddy/_qa_imgs'), { recursive: true })
      fs.writeFileSync(path.resolve('.learnbuddy/_qa_imgs', 'home-card-' + (s.mobile ? 'mobile' : 'desktop') + '-' + kind.k + '.png'), Buffer.from(shot.data, 'base64'))
      console.log(`${s.name} · ${kind.k} → 卡片高 ${m.cardH}px | 宽 ${m.cardW}px | 内边距 ${m.padding} | 头部 ${m.headH}px(下边距${m.headMB}) | 列表项 ${m.itemH}px x${m.itemCount} | 空态 ${m.emptyH}px | 标题字号 ${m.titleSize}`)
    }
  }

  try { chrome.kill() } catch { }
  try { preview.kill() } catch { }
  process.exit(0)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
