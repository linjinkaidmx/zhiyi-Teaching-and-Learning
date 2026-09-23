/**
 * 评测专项探测：游客权限 / 合规信息 / 主题（正确key）/ 首页布局 / 移动端
 * 用法：node _probe_review.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://193.112.28.51:3300'
const CDP_PORT = 8700 + ((process.pid % 50) + Date.now() % 100)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
let ws, seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* */ } await sleep(400) }
  console.log('  · timeout: ' + label); return false
}
const waitSel = (sel, t = 15000) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, t, sel)
const VISIBLE = `(el) => { const c = el.cloneNode(true); c.querySelectorAll('.katex-mathml,script,style').forEach(n=>n.remove()); return (c.textContent||'').replace(/\\s+/g,' ') }`

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'probe_review_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 160))
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false })
  const goto = async (p, sel = '.zy-page') => { await send('Page.navigate', { url: BASE + p }); await waitSel(sel, 20000); await sleep(1000) }

  console.log('\n===== 1. 游客权限 =====')
  await goto('/')
  await ev(`localStorage.clear(); 'ok'`)   // 确保游客态
  for (const p of ['/records', '/wrongbook', '/class', '/community', '/data', '/me', '/capture', '/chat']) {
    await goto(p)
    const txt = await ev(`(() => (${VISIBLE})(document.body))()`)
    const blocked = /登录|注册|游客|请先|去登录|请登录/.test(txt)
    console.log(`  · ${p} → ${blocked ? '有登录引导' : '可直接浏览(无拦截)'}`)
    if (blocked) ok(true, `游客访问 ${p} 有登录引导`)
    else ok(false, `游客访问 ${p} 无登录引导`, txt.slice(0, 50))
  }

  console.log('\n===== 2. 合规信息 =====')
  await goto('/about')
  let txt = await ev(`(() => (${VISIBLE})(document.body))()`)
  const hasIcp = /ICP|备案/.test(txt)
  const hasPrivacy = /隐私|个人信息|隐私政策/.test(txt)
  const hasCopyright = /版权|Copyright|©/.test(txt)
  ok(hasIcp, '关于页含 ICP 备案号', hasIcp ? '有' : '无')
  ok(hasPrivacy, '关于页含隐私政策说明', hasPrivacy ? '有' : '无')
  ok(hasCopyright, '关于页含版权声明', hasCopyright ? '有' : '无')
  console.log('  · 关于页文本摘要:', txt.replace(/\s+/g, ' ').slice(0, 150))
  await goto('/help')
  txt = await ev(`(() => (${VISIBLE})(document.body))()`)
  console.log('  · 帮助页文本摘要:', txt.replace(/\s+/g, ' ').slice(0, 120))
  // 页脚（首页底部）
  await goto('/')
  const footer = await ev(`(() => { const f=document.querySelector('footer'); return f ? f.textContent.replace(/\\s+/g,' ').slice(0,200) : 'no-footer' })()`)
  console.log('  · 首页页脚:', footer)

  console.log('\n===== 3. 主题持久化（正确 key: zy_theme）=====')
  await goto('/')
  await ev(`localStorage.setItem('zy_theme','dark'); document.documentElement.dataset.theme='dark'; 'ok'`)
  await goto('/wrongbook')
  await sleep(1000)
  const wbBg = await ev(`getComputedStyle(document.body).backgroundColor`)
  const wbTxt = await ev(`getComputedStyle(document.body).color`)
  console.log('  · dark 错题本 body:', wbBg, '文字:', wbTxt)
  ok(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/.test(wbBg) && +RegExp.$1 < 60, '暗色模式下错题本背景为深色', wbBg)
  await ev(`localStorage.setItem('zy_theme','light'); document.documentElement.dataset.theme='light'; 'ok'`)

  console.log('\n===== 4. 首页布局（改版后）=====')
  await goto('/')
  const homeTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  const tabs = /学习|我的/.test(homeTxt)
  const cards = /拍题|错题|自测|AI|工具|社区|课程|考试|记录/.test(homeTxt)
  console.log('  · 首页可见文本:', homeTxt.replace(/\s+/g, ' ').slice(0, 220))
  ok(tabs, '首页顶部双 Tab（学习/我的）', tabs)
  ok(cards, '首页含功能入口', cards)

  console.log('\n===== 5. 移动端首页/详情抽查 =====')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await goto('/')
  const mOverflow = await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 2`)
  ok(!mOverflow, '移动端首页无横向溢出', mOverflow)
  await goto('/community')
  const mOverflow2 = await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 2`)
  ok(!mOverflow2, '移动端社区页无横向溢出', mOverflow2)
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false })

  console.log('\n===== 6. 运行时错误 =====')
  console.log('  · errors:', JSON.stringify(errors.slice(0, 6)))
  ok(errors.length === 0, '本次探测零运行时异常', errors.slice(0, 3))

  console.log(`\n===== 结果：通过 ${pass}，失败 ${fail} =====`)
  chrome.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
