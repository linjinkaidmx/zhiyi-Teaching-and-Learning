/** 开场动画样图渲染自检 + 截图（临时）。用法：node _qa_boot_sample.mjs */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FILE = 'file:///' + path.resolve(__dirname, '../docs/开场动画-样图.html').replace(/\\/g, '/')
const CDP = 9920 + (process.pid % 60)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const shot = async (n, clip) => { const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.data, 'base64')) }

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_boot_' + process.pid), '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: FILE })
  await sleep(2600)

  const info = await ev(`(() => {
    const phones = document.querySelectorAll('.phone')
    const frames = [...document.querySelectorAll('#keyframes .stage')]
    const bootOp = frames.map((f) => { const b = f.querySelector('.boot'); return b ? Number(getComputedStyle(b).opacity).toFixed(2) : 'none' })
    const markOp = frames.map((f) => { const m = f.querySelector('.boot__mark'); return m ? Number(getComputedStyle(m).opacity).toFixed(2) : 'none' })
    const sloganOp = frames.map((f) => { const s = f.querySelector('.boot__slogan'); return s ? Number(getComputedStyle(s).opacity).toFixed(2) : 'none' })
    return {
      phones: phones.length,
      frames: frames.length,
      boot: bootOp, mark: markOp, slogan: sloganOp,
      hasStruct: frames.every((f) => f.querySelector('.boot') && f.querySelector('.scene') && f.querySelector('.home') && f.querySelector('.scene__boat')),
      cardCount: frames[0] ? frames[0].querySelectorAll('.home__card').length : 0,
      sloganText: (document.querySelector('.lockup__slogan') || {}).textContent || '',
      h: document.documentElement.scrollHeight,
    }
  })()`)
  console.log(JSON.stringify(info, null, 1))
  ok(info.phones === 7, '1 个播放器 + 6 个关键帧', info.phones)
  ok(info.frames === 6 && info.hasStruct, '每帧结构完整（开屏/场景/首页/小船）', { frames: info.frames, struct: info.hasStruct })
  ok(info.cardCount === 4, '首页骨架四卡', info.cardCount)
  ok(info.sloganText === '知理于一，笃学前行', '标语文案正确', info.sloganText)
  // 定格应随时间推进：图标透明度递增、开屏层最终消失
  const marks = info.mark.map(Number)
  ok(marks[0] < 1 && marks[0] > 0.5 && marks[1] > 0.99, '图标在 0.15s 已大幅淡入（ease-out）、0.45s 完全就位', marks)
  ok(Number(info.boot[5]) === 0, '1.80s 时开屏层已完全淡出', info.boot)
  ok(Number(info.slogan[1]) < 1 && Number(info.slogan[2]) > 0.95, '标语在 0.45s 尚未完全落位、0.80s 已就位', info.slogan)

  // 分区截图
  const secs = await ev(`[...document.querySelectorAll('.sec')].map((s) => { const r = s.getBoundingClientRect(); return { y: r.y + scrollY, h: r.height } })`)
  for (let i = 0; i < secs.length; i++) {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: secs[i].y, width: 1280, height: Math.min(secs[i].h, 1500), scale: 1 } })
    fs.writeFileSync(path.join(OUT, `sec${i + 1}.png`), Buffer.from(r.data, 'base64'))
  }
  console.log('截图:', OUT, '共', secs.length, '张')
  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  chrome.kill(); process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
