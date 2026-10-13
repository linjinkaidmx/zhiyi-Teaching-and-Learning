/**
 * 开场动画验证：首次播放 / 刷新不播 / 深链不播 / 点击跳过 / 减少动效 / 站内跳转不播
 * 用法：node _qa_boot.mjs   （QA_DIST 默认 dist131；QA_BASE 可打线上）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const DIST = process.env.QA_DIST || 'dist131'
const BASE = process.env.QA_BASE || ''
const PORT = 9940 + (process.pid % 50)
const CDP = 9840 + (process.pid % 50)
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
const waitSel = async (sel, t = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true } catch { /* */ } await sleep(200) } return false }
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.data, 'base64')) }

/** 采集当前开场状态 */
const STATE = `(() => {
  const el = document.getElementById('zyBoot')
  const root = document.documentElement
  return {
    boot: !!el,
    bootVisible: !!el && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.05,
    bootOpacity: el ? Number(getComputedStyle(el).opacity).toFixed(2) : 'gone',
    play: !!document.querySelector('.zy-page'),
    done: root.classList.contains('zy-boot-done'),
    skip: root.classList.contains('zy-boot-skip'),
    enter: root.classList.contains('is-enter'),
    marker: (() => { try { return sessionStorage.getItem('zy_boot_played') || '' } catch { return 'ERR' } })(),
  }
})()`

async function main() {
  const prev = BASE ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], { cwd: path.resolve(__dirname), stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(WEB)).ok) break } catch { /* */ } await sleep(300) }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_bootrun_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

  console.log('\n===== ① 首次打开首页：应播放 =====')
  await send('Page.navigate', { url: WEB + '/' })
  await sleep(140)
  const s1 = await ev(STATE)
  await sleep(120)
  const s2 = await ev(STATE)
  await shot('boot_early.png')          // ≈0.25s：开屏层正在播
  await shot('boot_mid.png')
  // 等交接真正完成（本地约 1s，线上首次可能 3s+），最多 12s
  const tw = Date.now()
  let s3 = await ev(STATE)
  while (Date.now() - tw < 12000) { s3 = await ev(STATE); if (s3.done) break; await sleep(300) }
  await sleep(600)
  const s4 = await ev(STATE)
  await shot('boot_done.png')
  console.log('  · 0.14s', JSON.stringify(s1))
  console.log('  · 1.6s ', JSON.stringify(s3))
  console.log('  · 2.7s ', JSON.stringify(s4))
  ok(s1.boot || s2.boot, '打开瞬间开屏层存在（盖住白屏）', { a: s1.boot, b: s2.boot })
  ok(s2.bootVisible, '开屏层可见（未提前隐藏）', s2.bootOpacity)
  // 线上首帧采样可能早于内联脚本执行完，取后续采样判断
  ok(s2.marker === '1' || s3.marker === '1', '会话标记已写入', { s2: s2.marker, s3: s3.marker })
  ok(s3.done && !s3.skip, '交接完成且未被跳过', { done: s3.done, skip: s3.skip })
  ok(s3.enter, '内容级联已启动（html.is-enter）', s3.enter)
  ok(!s4.boot, '开屏层已从 DOM 移除', s4.boot)

  console.log('\n===== ② 刷新：应不播 =====')
  await send('Page.reload')
  await sleep(500)
  const r1 = await ev(STATE)
  console.log('  ·', JSON.stringify(r1))
  ok(!r1.boot, '刷新后没有开屏层', r1.boot)
  ok(r1.skip && !r1.enter, '直接呈现（skip 标记，无级联）', { skip: r1.skip, enter: r1.enter })

  console.log('\n===== ③ 站内跳转回首页：应不播 =====')
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.zy-page')
  await sleep(900)
  await ev(`(() => { const a = document.querySelector('a[href="/"]'); if (a) a.click(); return true })()`)
  await send('Page.navigate', { url: WEB + '/' })
  await sleep(700)
  const n1 = await ev(STATE)
  ok(!n1.boot && !n1.enter, '返回首页不播（会话内已标记）', { boot: n1.boot, enter: n1.enter })

  console.log('\n===== ④ 深链直接打开错题本：应不播 =====')
  await ev('sessionStorage.clear()')
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.zy-page')
  await sleep(600)
  const d1 = await ev(STATE)
  console.log('  ·', JSON.stringify(d1))
  ok(!d1.boot, '深链页没有开屏层', d1.boot)
  ok(d1.skip, '深链直接呈现', d1.skip)

  console.log('\n===== ⑤ 点击跳过：应立即结束且不级联 =====')
  await ev('sessionStorage.clear()')
  await send('Page.navigate', { url: WEB + '/' })
  await sleep(420)
  const k0 = await ev(STATE)
  await ev(`(() => { const el = document.getElementById('zyBoot'); if (el) el.click(); return !!el })()`)
  await sleep(420)
  const k1 = await ev(STATE)
  await shot('boot_skip.png')
  ok(k0.boot, '跳过前开屏层还在', k0.boot)
  ok(!k1.boot && k1.skip, '点击后立即收起且标记跳过', { boot: k1.boot, skip: k1.skip })
  ok(!k1.enter, '跳过时不播内容级联', k1.enter)

  console.log('\n===== ⑥ 系统「减少动效」：应不播 =====')
  await ev('sessionStorage.clear()')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await send('Page.navigate', { url: WEB + '/' })
  await sleep(700)
  const m1 = await ev(STATE)
  console.log('  ·', JSON.stringify(m1))
  ok(!m1.boot && m1.skip, '减少动效时直接呈现', { boot: m1.boot, skip: m1.skip })
  await send('Emulation.setEmulatedMedia', { features: [] })

  console.log('\n===== ⑦ 桌面 1440 首次打开 =====')
  await ev('sessionStorage.clear()')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: WEB + '/' })
  await sleep(320)
  const w1 = await ev(STATE)
  await shot('boot_desktop.png')
  await sleep(2600)
  const w2 = await ev(STATE)
  ok(w1.boot, '桌面首屏有开屏层', w1.boot)
  ok(w2.done && !w2.skip, '桌面交接正常', { done: w2.done, skip: w2.skip })
  const ovf = await ev('document.documentElement.scrollWidth > document.documentElement.clientWidth + 2')
  ok(!ovf, '桌面无横向溢出')

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图: ' + OUT)
  chrome.kill(); if (prev) prev.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
