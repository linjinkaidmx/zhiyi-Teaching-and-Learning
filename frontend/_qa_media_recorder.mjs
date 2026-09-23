/**
 * 测试：Chrome 能否在页面内用 MediaRecorder 直接录出 MP4（决定视频能否全自动生成）
 * 用法：node _qa_media_recorder.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const CDP = 9560 + (process.pid % 20)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
    '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_mr_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const ver = await fetch('http://127.0.0.1:' + CDP + '/json/version').then((r) => r.json())
  console.log('浏览器:', ver.Browser)
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')

  console.log('\n=== 支持的录制格式 ===')
  const types = await ev(`(() => {
    const cands = ['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']
    const out = {}
    for (const c of cands) out[c] = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)
    return { hasMR: typeof MediaRecorder !== 'undefined', hasCS: typeof HTMLCanvasElement.prototype.captureStream === 'function', types: out }
  })()`)
  console.log(JSON.stringify(types, null, 1))

  console.log('\n=== 实测录制 3 秒（canvas 动画）===')
  const rec = await ev(`(async () => {
    const c = document.createElement('canvas')
    c.width = 1280; c.height = 720
    const ctx = c.getContext('2d')
    document.body.appendChild(c)
    const stream = c.captureStream(30)
    const mt = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9'].find((x) => MediaRecorder.isTypeSupported(x)) || ''
    const mr = new MediaRecorder(stream, mt ? { mimeType: mt, videoBitsPerSecond: 4_000_000 } : {})
    const chunks = []
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    const done = new Promise((res) => { mr.onstop = () => res(true) })
    mr.start(500)
    const t0 = performance.now()
    await new Promise((res) => {
      function frame() {
        const el = (performance.now() - t0) / 1000
        ctx.fillStyle = '#1B2334'; ctx.fillRect(0, 0, 1280, 720)
        ctx.fillStyle = '#6F57F0'; ctx.fillRect(80, 80 + Math.sin(el * 2) * 40, 300, 60)
        ctx.fillStyle = '#fff'; ctx.font = '48px sans-serif'
        ctx.fillText('测试帧 ' + el.toFixed(1) + 's', 100, 200)
        if (el < 3) requestAnimationFrame(frame); else res(true)
      }
      frame()
    })
    mr.stop()
    await done
    const blob = new Blob(chunks, { type: mr.mimeType })
    const buf = await blob.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return { mimeType: mr.mimeType, size: bytes.length, b64: btoa(bin) }
  })()`)

  if (rec && rec.b64) {
    const ext = /mp4/.test(rec.mimeType) ? 'mp4' : 'webm'
    const out = path.join('E:/知一2.0/参赛素材', 'recorder-test.' + ext)
    fs.writeFileSync(out, Buffer.from(rec.b64, 'base64'))
    console.log('mimeType:', rec.mimeType)
    console.log('体积:', Math.round(rec.size / 1024), 'KB →', out)
    console.log(/mp4/.test(rec.mimeType) ? '✓ 可直接产出 MP4（符合官方格式要求）' : '△ 只能产出 WebM（需转码，官方要求 mp4/mov）')
  } else {
    console.log('✗ 录制失败:', JSON.stringify(rec).slice(0, 200))
  }

  chrome.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
