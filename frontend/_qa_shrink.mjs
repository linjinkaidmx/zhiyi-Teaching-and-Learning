/**
 * 验证 shrinkIfNeeded 多轮降质：造一张 >260KB 的图，断言压到目标内且分辨率合理。
 * 用法：node _qa_shrink.mjs（起临时 vite dev）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9300 + (process.pid % 40)
const CDP = 9200 + (process.pid % 60)
const WEB = `http://127.0.0.1:${PORT}`
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function main() {
  const dev = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { cwd: path.resolve(__dirname), stdio: 'ignore' })
  for (let i = 0; i < 60; i += 1) { try { if ((await fetch(WEB)).ok) break } catch { /* */ } await sleep(300) }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_shr_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: WEB + '/' })
  await sleep(2500)

  const r = await ev(`(async () => {
    const { shrinkIfNeeded } = await import('/src/lib/imageFile.js')
    // 造一张 2400×3200 的噪点+文字图（接近手机随手拍），质量 0.92 → 体积会很大
    const c = document.createElement('canvas')
    c.width = 2400; c.height = 3200
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fdfbf3'; ctx.fillRect(0, 0, 2400, 3200)
    for (let i = 0; i < 40000; i++) {
      ctx.fillStyle = 'rgba(' + (i % 200) + ',' + ((i * 7) % 200) + ',180,0.06)'
      ctx.fillRect((i * 97) % 2400, (i * 53) % 3200, 6, 6)
    }
    ctx.fillStyle = '#16202e'; ctx.font = '60px serif'
    for (let y = 100; y < 3100; y += 90) ctx.fillText('用主定理求 T(n)=2T(n/2)+O(n) 的时间复杂度，写出推导过程。', 60, y)
    const big = c.toDataURL('image/jpeg', 0.92)
    const out = await shrinkIfNeeded(big)
    const sizeOf = (d) => Math.round((d.length - d.indexOf(',') - 1) * 3 / 4 / 1024)
    const dim = await new Promise((res) => { const el = new Image(); el.onload = () => res(el.width + 'x' + el.height); el.onerror = () => res('?'); el.src = out })
    return { beforeKB: sizeOf(big), afterKB: sizeOf(out), dim, prefix: out.slice(0, 22) }
  })()`)
  console.log('  ·', JSON.stringify(r))
  ok(r.beforeKB > 260, '构造的原图超过 260KB 阈值', r.beforeKB + 'KB')
  ok(r.afterKB <= 260, '多轮降质后 ≤260KB', r.afterKB + 'KB')
  ok(r.afterKB >= 60, '没有过度压缩（仍 ≥60KB，保住文字可辨识度）', r.afterKB + 'KB')
  const dims = String(r.dim).split('x').map(Number)
  ok(Math.max(dims[0], dims[1]) >= 1000, '最长边仍在 ~1000-1200px（文字识别所需分辨率）', r.dim)

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  chrome.kill(); dev.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
