/**
 * 诊断：① 深色模式星球不可见（是否被 slice 裁掉）② 四卡图标显示不全（bbox 是否越界 / fill 覆盖）
 * 用法：node _probe_art_bug.mjs   （可用 QA_BASE 打线上）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9780 + ((process.pid % 50) + 10)
const CDP_PORT = PORT + 100
const WEB = process.env.QA_BASE || `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, t, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < t) { try { if (await ev(expr)) return true } catch { /* retry */ } await sleep(400) }
  console.log('  · timeout:', label)
  return false
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'probe_art_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* retry */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 4, mobile: true })

  await send('Page.navigate', { url: WEB + '/' })
  await waitFor(`!!document.querySelector('.home__cards')`, 15000, '首页')
  await ev(`try { localStorage.setItem('zhiyi_setup_dismissed','1') } catch {}`)
  await send('Page.navigate', { url: WEB + '/' })
  await waitFor(`!!document.querySelector('.home__cards')`, 15000, '首页2')

  console.log('\n【图标 bbox 诊断】（viewBox 应为 0..40，越界即被裁）')
  const bbox = await ev(`(() => {
    const out = []
    document.querySelectorAll('.home__card .card-art').forEach((svg, i) => {
      const g = svg.querySelector('g')
      const b = g.getBBox()
      out.push(i + ': x=' + b.x.toFixed(1) + ' y=' + b.y.toFixed(1) + ' w=' + b.width.toFixed(1) + ' h=' + b.height.toFixed(1))
    })
    return out.join(' | ')
  })()`)
  console.log('  bbox:', bbox)
  const fills = await ev(`(() => {
    const out = []
    document.querySelectorAll('.home__card .card-art').forEach((svg, i) => {
      const bad = []
      svg.querySelectorAll('path').forEach((p) => {
        const cs = getComputedStyle(p)
        if (!p.hasAttribute('fill') && cs.fill !== 'none' && p.getAttribute('d') && p.getAttribute('d').includes('M')) {
          bad.push((p.getAttribute('d') || '').slice(0, 18) + ' fill=' + cs.fill)
        }
      })
      out.push(i + ':[' + bad.join(';') + ']')
    })
    return out.join(' || ')
  })()`)
  console.log('  疑似缺 fill=none 的 path:', fills)
  const rect = await ev(`(() => { const c = document.querySelector('.home__cards'); const r = c.getBoundingClientRect(); return JSON.stringify({ x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height }) })()`)
  console.log('  cards rect:', rect)
  const box = JSON.parse(rect)
  const shotRes = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 3 } })
  fs.writeFileSync(path.join(OUT, 'probe_cards.png'), Buffer.from(shotRes.data, 'base64'))
  console.log('  已截图 probe_cards.png')

  console.log('\n【深色星球诊断】')
  await send('Page.navigate', { url: WEB + '/?theme=dark' })
  await waitFor(`!!document.querySelector('.home__cards')`, 15000, '首页dark')
  await ev(`try { localStorage.setItem('zhiyi_setup_dismissed','1') } catch {}`)
  await send('Page.navigate', { url: WEB + '/?theme=dark' })
  await waitFor(`!!document.querySelector('.hbg__nightsky')`, 15000, 'nightsky')
  const planet = await ev(`(() => {
    const svg = document.querySelector('.hbg__nightsky')
    const host = svg.getBoundingClientRect()
    const gs = [...svg.querySelectorAll('g')].filter((g) => g.getAttribute('transform') && g.getAttribute('transform').includes('168'))
    if (!gs.length) return 'planet group not found'
    const g = gs[0]
    const r = g.getBoundingClientRect()
    return JSON.stringify({
      svgHost: { w: Math.round(host.width), h: Math.round(host.height), top: Math.round(host.top + window.scrollY) },
      planetRect: { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      viewBox: svg.getAttribute('viewBox'), par: svg.getAttribute('preserveAspectRatio'),
      inViewport: r.width > 0 && r.x > -50 && r.x < window.innerWidth,
    })
  })()`)
  console.log('  planet:', planet)
  const pageH = await ev(`document.querySelector('.home').getBoundingClientRect().height`)
  console.log('  首页容器高度:', pageH, ' 视口宽:', await ev('window.innerWidth'))
  const darkShot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'probe_dark_full.png'), Buffer.from(darkShot.data, 'base64'))
  console.log('  已截图 probe_dark_full.png')

  try { chrome.kill() } catch { /* noop */ }
}

const server = process.env.QA_BASE ? null : spawn('npx', ['vite', 'preview', '--outDir', 'dist106', '--port', String(PORT), '--strictPort'], { cwd: __dirname, stdio: 'ignore', shell: true })
if (server) { for (let i = 0; i < 40; i += 1) { try { if ((await fetch(WEB)).ok) break } catch { /* retry */ } await sleep(250) } }
main().catch((e) => { console.error('异常:', e); process.exitCode = 1 }).finally(() => { try { if (server) server.kill() } catch { /* ignore */ } })
