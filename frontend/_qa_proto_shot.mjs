/**
 * 原型文档截图：截 A1b（次入口第 2 页）与 B9（课程表）
 * 用法：node _shot_proto.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const CDP_PORT = 9900 + (process.pid % 60)
const OUT = path.resolve(__dirname, '../.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })
const FILE = 'file:///E:/%E7%9F%A5%E4%B8%802.0/docs/%E9%A6%96%E9%A1%B5%E6%94%B9%E7%89%88-%E5%85%A8%E7%AB%99%E7%95%8C%E9%9D%A2%E5%8E%9F%E5%9E%8B.html'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'shot_proto_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* retry */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FILE })
  await sleep(1200)

  for (const [no, name] of [['A1', 'proto-A1'], ['A1b', 'proto-A1b'], ['B9', 'proto-B9'], ['SPEC', 'proto-spec']]) {
    const finder = no === 'SPEC'
      ? `document.querySelector('.spec')`
      : `[...document.querySelectorAll('figure.dev')].find((f) => (f.querySelector('.dev__no') || {}).textContent === '${no}')`
    const ok = await ev(`(() => { const fig = ${finder}; if (!fig) return false; fig.scrollIntoView({ block: 'center' }); return true })()`)
    if (!ok) { console.log('未找到', no); continue }
    await sleep(400)
    const rect = await ev(`(() => { const fig = ${finder}; const r = fig.getBoundingClientRect(); return { x: Math.max(0, r.left + window.scrollX - 12), y: Math.max(0, r.top + window.scrollY - 12), w: r.width + 24, h: r.height + 24 } })()`)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 } })
    const out = path.join(OUT, name + '.png')
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
    console.log('已截图:', out)
  }
  try { chrome.kill() } catch { /* noop */ }
  process.exit(0)
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
