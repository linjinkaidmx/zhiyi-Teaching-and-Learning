/** 奖章样图渲染自检 + 截图（临时）。用法：node _qa_badge.mjs */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE = 'file:///' + path.resolve(__dirname, '../docs/成就奖章-样图.html').replace(/\\/g, '/')
const CDP = 9820 + (process.pid % 60)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(expr)) return true } catch { /* */ } await sleep(300) } console.log('  · timeout: ' + l); return false }

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_badge_' + process.pid), '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FILE })
  await waitFor(`document.querySelectorAll('.badge').length > 30`, 12000, '奖章渲染')

  const info = await ev(`(() => {
    const b = [...document.querySelectorAll('.badge')]
    return {
      total: b.length,
      ladder: document.querySelectorAll('#ladder .badge').length,
      totems: document.querySelectorAll('#totems .badge').length,
      wall: document.querySelectorAll('#wall .badge').length,
      locked: document.querySelectorAll('.badge.locked').length,
      sizes: document.querySelectorAll('#sz1 .badge, #sz2 .badge, #sz3 .badge, #sz4 .badge').length,
      dark: document.querySelectorAll('#dark .badge').length,
      // 检查图腾是否真的画出来了（每个 badge 内应有 path/rect/circle）
      empty: b.filter((x) => x.querySelectorAll('path,rect,circle,line').length < 3).length,
      h: document.documentElement.scrollHeight
    }
  })()`)
  console.log(JSON.stringify(info, null, 1))
  const ok = info.total >= 40 && info.empty === 0
  console.log(ok ? '✓ 渲染正常' : '✗ 有奖章未正确渲染')

  // 分区截图
  const secs = await ev(`[...document.querySelectorAll('.sec')].map(s => { const r = s.getBoundingClientRect(); return { y: r.y + scrollY, h: r.height } })`)
  for (let i = 0; i < secs.length; i++) {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: secs[i].y, width: 1280, height: Math.min(secs[i].h, 1400), scale: 1 } })
    fs.writeFileSync(path.join(OUT, `sec${i + 1}.png`), Buffer.from(r.data, 'base64'))
  }
  console.log('截图:', OUT, '共', secs.length, '张')
  chrome.kill(); process.exit(ok ? 0 : 1)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
