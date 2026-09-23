/**
 * 移动端成就入口验证：首页次入口第二面 + 我的页可点击跳转
 * 用法：node _qa_ach_entry.mjs   （QA_DIST 默认 dist129）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const DIST = process.env.QA_DIST || 'dist129'
const PORT = 9900 + (process.pid % 60)
const CDP = 9800 + (process.pid % 60)
const BASE = process.env.QA_BASE || ""
const WEB = BASE || `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const waitSel = async (sel, t = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true } catch { /* */ } await sleep(400) } return false }
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.data, 'base64')) }

async function main() {
  const prev = BASE ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: path.resolve(__dirname), stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(WEB)).ok) break } catch { /* */ } await sleep(300) }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ent_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('zhiyi_setup_dismissed','1')}catch(e){}" })
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

  console.log('\n===== 移动端首页次入口 =====')
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.zy-page', 25000)
  await sleep(1800)
  const quick = await ev(`(() => {
    const pages = [...document.querySelectorAll('.home__quick-page')]
    const labels = pages.map((p) => [...p.querySelectorAll('.home__ico')].map((b) => b.textContent.trim()))
    const dots = document.querySelectorAll('.home__dot').length
    return { pages: pages.length, labels, dots, ovf: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 }
  })()`)
  console.log('  · P1:', JSON.stringify(quick.labels[0]))
  console.log('  · P2:', JSON.stringify(quick.labels[1]))
  ok(quick.pages === 2, '次入口仍是两页', quick.pages)
  ok((quick.labels[0] || []).length === 5 && (quick.labels[1] || []).length === 5, '两页各 5 项（对齐）', [quick.labels[0]?.length, quick.labels[1]?.length])
  ok((quick.labels[1] || [])[1] === '成就殿堂', '第二面第 2 项是「成就殿堂」', (quick.labels[1] || [])[1])
  ok(!quick.ovf, '首页无横向溢出')
  await shot('entry_home_p1.png')
  // 滑到第二面截图
  await ev(`(() => { const t = document.querySelector('.home__quick-track'); if (t) t.scrollLeft = t.clientWidth; return t ? t.scrollLeft : -1 })()`)
  await sleep(900)
  await shot('entry_home_p2.png')

  console.log('\n===== 点击跳转 =====')
  const clicked = await ev(`(() => {
    const pages = [...document.querySelectorAll('.home__quick-page')]
    const btn = [...(pages[1] || document).querySelectorAll('.home__ico')].find((b) => b.textContent.includes('成就殿堂'))
    if (!btn) return false
    btn.click()
    return true
  })()`)
  await sleep(1600)
  const p1 = await ev('location.pathname')
  ok(clicked && p1 === '/achievements', '点击「成就殿堂」跳转成功', p1)

  console.log('\n===== 我的页成就可点击 =====')
  await send('Page.navigate', { url: WEB + '/me' })
  await waitSel('.zy-page', 25000)
  await sleep(1800)
  const mine = await ev(`(() => {
    const cells = [...document.querySelectorAll('.mine__metric')]
    const ach = cells.find((c) => c.textContent.includes('成就'))
    return {
      found: !!ach,
      isLink: ach ? ach.classList.contains('is-link') : false,
      text: ach ? ach.textContent.replace(/\\s+/g, ' ').trim() : '',
      hasArrow: ach ? !!ach.querySelector('.mine__metric-go') : false,
    }
  })()`)
  ok(mine.found && mine.isLink && mine.hasArrow, '「成就」指标可点击且有箭头', mine)
  await shot('entry_mine.png')
  await ev(`(() => { const c = [...document.querySelectorAll('.mine__metric')].find((x) => x.textContent.includes('成就')); if (c) c.click(); return true })()`)
  await sleep(1600)
  const p2 = await ev('location.pathname')
  ok(p2 === '/achievements', '我的页点成就 → 跳转成就殿堂', p2)

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图: ' + OUT)
  chrome.kill(); if (prev) prev.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
