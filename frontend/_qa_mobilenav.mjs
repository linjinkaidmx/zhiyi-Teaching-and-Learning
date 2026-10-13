/**
 * 移动端导航验证：底部「更多」+ 更多页「我的」入口
 * 用法：node _qa_mobilenav.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9492
const BASE = 'http://193.112.28.51:3300'
const userDir = path.join(os.tmpdir(), 'qa_nav_' + process.pid)
fs.mkdirSync(userDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'], { stdio: 'ignore' })
let ws; let seq = 0; const pending = new Map(); const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value
let pass = 0; let fail = 0
const ok = (c, label, extra) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }

async function main() {
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* retry */ } await sleep(250) }
  const t = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable'); await send('Runtime.enable')
  // 移动视口
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await send('Page.navigate', { url: BASE + '/?v=54' })
  await sleep(3500)

  const r1 = await ev(`(() => {
    const nav = document.querySelector('.ui-bottomnav')
    const labels = nav ? [...nav.querySelectorAll('.ui-bottomnav__item, button')].map((b) => b.textContent.trim()).filter(Boolean) : []
    return { hasBottom: !!nav, labels, hasMore: labels.includes('更多'), hasMine: labels.includes('我的') }
  })()`)
  ok(r1.hasBottom, '移动端显示底部导航')
  ok(r1.hasMore, '底部导航有「更多」', r1.labels)
  ok(!r1.hasMine, '底部导航不再有「我的」（入口收进更多页）', r1.labels)

  // 点底部「更多」
  await ev(`(() => { const nav = document.querySelector('.ui-bottomnav'); const b = [...nav.querySelectorAll('button')].find((x) => x.textContent.trim() === '更多'); if (b) b.click(); return !!b })()`)
  await sleep(1500)
  const r2 = await ev(`(() => ({
    path: location.pathname,
    hasTools: (document.body.textContent || '').includes('算法演示'),
    hasRef: (document.body.textContent || '').includes('考前速查'),
    hasMineRow: (document.body.textContent || '').includes('我的（未登录）') || (document.body.textContent || '').includes('我的（'),
  }))()`)
  ok(r2.path === '/more', '点「更多」进入 /more', r2.path)
  ok(r2.hasTools && r2.hasRef, '更多页能看到算法演示/考前速查等功能', r2)
  ok(r2.hasMineRow, '更多页有「我的」入口')

  // 点更多页「我的」→ 进 /me
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('我的（')); if (b) b.click(); return !!b })()`)
  await sleep(1500)
  const r3 = await ev(`(() => ({ path: location.pathname, hasMineTitle: (document.body.textContent || '').includes('账号') || (document.body.textContent || '').includes('我的') }))()`)
  ok(r3.path === '/me', '更多页「我的」入口可进 /me', r3.path)

  // 回到 /more 截图（展示底部导航 + 账号入口）
  await send('Page.navigate', { url: BASE + '/more?v=54' })
  await sleep(2200)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('E:/知一2.0/.learnbuddy/_qa_imgs/mobile-more.png', Buffer.from(shot.data, 'base64'))
  console.log('（已截图 mobile-more.png）')
  ok(errors.length === 0, '无未捕获异常', errors.slice(0, 2))

  console.log('\n' + '='.repeat(46))
  console.log(fail === 0 ? `移动端导航验证通过（${pass} 项）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
  process.exitCode = fail === 0 ? 0 : 1
}
main().catch((e) => console.error('异常:', e.message)).finally(() => { try { ws?.close() } catch {} chrome.kill() })
