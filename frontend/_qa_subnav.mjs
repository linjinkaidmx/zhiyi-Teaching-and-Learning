/**
 * 课程与数据子页面导航验证（本地 vite preview + CDP）
 * 验证：5 页都有「← 返回更多」；从更多进入后点返回回到更多；深链打开时回落到更多；组内互跳入口存在
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9850 + (process.pid % 250)
const OUTDIR = process.argv[2] || 'dist79'
const WEBPORT = 5980 + (process.pid % 250)
const WEB = 'http://127.0.0.1:' + WEBPORT

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

const PAGES = [
  { route: '/course', name: '我的课程' },
  { route: '/timetable', name: '课程表' },
  { route: '/exams', name: '考试安排' },
  { route: '/data', name: '学习数据' },
  { route: '/records', name: '学习记录' },
]

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_subnav_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 2, mobile: false })

  // 1. 每个页面都有返回按钮
  for (const p of PAGES) {
    await send('Page.navigate', { url: WEB + p.route })
    await waitSel('.zy-page')
    await sleep(600)
    const hasBack = await ev(`(() => {
      const b = document.querySelector('.zy-back')
      return { exists: !!b, text: b ? b.textContent.trim() : '' }
    })()`)
    ok(hasBack.exists && hasBack.text.includes('返回更多'), `${p.name} 有「← 返回更多」`, hasBack.text)
  }

  // 2. 从「更多」点进子页 → 点返回 → 回到「更多」
  await send('Page.navigate', { url: WEB + '/more' })
  await waitSel('.more__row')
  await sleep(600)
  await ev(`[...document.querySelectorAll('.more__row')].find((b) => b.textContent.includes('我的课程')).click()`)
  await sleep(900)
  const atCourse = await ev(`location.pathname`)
  ok(atCourse === '/course', '从更多进入我的课程', atCourse)
  await ev(`document.querySelector('.zy-back').click()`)
  await sleep(900)
  const backTo = await ev(`location.pathname`)
  ok(backTo === '/more', '点返回回到「更多」', backTo)

  // 3. 深链直接打开（无站内历史）→ 点返回 → 回落「更多」
  await send('Page.navigate', { url: WEB + '/data' })
  await waitSel('.zy-back')
  await sleep(800)
  const deepState = await ev(`({ path: location.pathname, back: window.history.state && window.history.state.back })`)
  await ev(`document.querySelector('.zy-back').click()`)
  await sleep(900)
  const deepBackTo = await ev(`location.pathname`)
  ok(deepBackTo === '/more', '深链打开时返回回落到「更多」', { from: deepState.path, back: deepState.back, to: deepBackTo })

  // 4. 组内互跳入口
  await send('Page.navigate', { url: WEB + '/course' })
  await waitSel('.co__head-ops')
  await sleep(500)
  const courseOps = await ev(`[...document.querySelectorAll('.co__head-ops button')].map((b) => b.textContent.trim())`)
  ok(courseOps.includes('课程表') && courseOps.includes('考试安排'), '我的课程 → 课程表/考试安排', courseOps)
  await send('Page.navigate', { url: WEB + '/data' })
  await waitSel('.data__head-ops')
  await sleep(500)
  const dataOps = await ev(`[...document.querySelectorAll('.data__head-ops button')].map((b) => b.textContent.trim())`)
  ok(dataOps.includes('学习记录'), '学习数据 → 学习记录', dataOps)
  await send('Page.navigate', { url: WEB + '/records' })
  await waitSel('.rec__head-ops')
  await sleep(500)
  const recOps = await ev(`[...document.querySelectorAll('.rec__head-ops button')].map((b) => b.textContent.trim())`)
  ok(recOps.includes('学习数据'), '学习记录 → 学习数据', recOps)
  await send('Page.navigate', { url: WEB + '/exams' })
  await waitSel('.ex__head-ops')
  await sleep(500)
  const exOps = await ev(`[...document.querySelectorAll('.ex__head-ops button')].map((b) => b.textContent.trim())`)
  ok(exOps.includes('课程表'), '考试安排 → 课程表', exOps)

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '子页面导航验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
