/**
 * 首屏加载基线/复测：记录资源清单、传输量、DOMContentLoaded、首页可用时刻
 * 用法：node _qa_firstpaint.mjs [标签]     （默认打线上）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const TAG = process.argv[2] || 'run'
const CDP = 9220 + (process.pid % 60)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_fp_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))

  const reqs = new Map()
  const sizes = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, m.params.request.url)
    if (m.method === 'Network.loadingFinished') {
      const url = reqs.get(m.params.requestId) || ''
      if (url) sizes.set(url, (sizes.get(url) || 0) + (m.params.encodedDataLength || 0))
    }
  })
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true })   // 冷启动，模拟首次访问
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('zhiyi_setup_dismissed','1')}catch(e){}" })

  const t0 = Date.now()
  await send('Page.navigate', { url: BASE + '/' })
  // 首页可用时刻：.zy-page 出现
  let usable = 0
  for (let i = 0; i < 200; i++) {
    const has = await ev(`!!document.querySelector('.zy-page, .home')`).catch(() => false)
    if (has) { usable = Date.now() - t0; break }
    await sleep(50)
  }
  const perf = await ev(`(() => { const n = performance.getEntriesByType('navigation')[0] || {}; return { dcl: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0) } })()`)
  await sleep(1200)

  const rows = [...sizes.entries()].map(([u, s]) => ({ u: u.replace(BASE, ''), kb: Math.round(s / 1024) })).sort((a, b) => b.kb - a.kb)
  const total = rows.reduce((s, r) => s + r.kb, 0)
  console.log(`\n===== 首屏加载（${TAG}）=====`)
  console.log(`首页可用: ${usable}ms · DOMContentLoaded: ${perf.dcl}ms · load: ${perf.load}ms`)
  console.log(`请求数: ${rows.length} · 传输总量: ${total}KB`)
  console.log('—— 体积前 12 ——')
  rows.slice(0, 12).forEach((r) => console.log(`  ${String(r.kb).padStart(5)}KB  ${r.u}`))
  const heavy = rows.filter((r) => /chart\.umd|highlight\.min|cm\//.test(r.u))
  console.log(`重库合计: ${heavy.reduce((s, r) => s + r.kb, 0)}KB（${heavy.map((r) => r.u.split('/').pop()).join(', ')}）`)
  fs.writeFileSync(path.join(OUT, `firstpaint-${TAG}.json`), JSON.stringify({ tag: TAG, usable, dcl: perf.dcl, total, rows }, null, 1))
  console.log('明细: ' + OUT)
  chrome.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
