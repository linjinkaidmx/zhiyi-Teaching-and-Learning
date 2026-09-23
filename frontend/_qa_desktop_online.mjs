/**
 * 线上桌面端验证（打 193.112.28.51:3300）
 * 覆盖：双形态渲染 + 登录态页面 + 班级测试答题页（答题卡）
 * 用法：node _qa_desktop_online.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP = 9760 + (process.pid % 60)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
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
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* */ } await sleep(500) }
  console.log('  · timeout: ' + label); return false
}
const waitSel = (sel, t = 20000) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, t, sel)
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64')) }

const PAGES = [['/', 'home'], ['/capture', 'capture'], ['/wrongbook', 'wrongbook'], ['/class', 'class'],
  ['/records', 'records'], ['/data', 'data'], ['/community', 'community'], ['/timetable', 'timetable'],
  ['/tools', 'tools'], ['/me', 'mine'], ['/exam', 'exam'], ['/exams', 'exams']]

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_on_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 120))
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('zhiyi_setup_dismissed','1') } catch(e) {}` })

  // 登录态注入（学生账号）
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.zy-page', 25000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});'ok'`)

  console.log('\n===== 线上桌面 1440（登录态） =====')
  for (const [url, name] of (process.env.QA_SKIP_PAGES === '1' ? [] : PAGES)) {
    errors.length = 0
    await send('Page.navigate', { url: BASE + url })
    await waitSel('.zy-page', 25000)
    await sleep(1800)
    const chk = await ev(`(() => {
      const side = document.querySelector('.ui-sidenav')
      const bar = document.querySelector('.ui-topbar')
      const nav = document.querySelector('.ui-topnav')
      return {
        side: !!side && getComputedStyle(side).display !== 'none' ? Math.round(side.getBoundingClientRect().width) : 0,
        bar: !!bar && getComputedStyle(bar).display !== 'none',
        navHidden: !nav || getComputedStyle(nav).display === 'none',
        ovf: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        len: document.body.innerText.replace(/\\s/g, '').length,
        err: ${JSON.stringify(errors)}.length
      }
    })()`)
    await shot(`on_${name}.png`)
    const bad = !chk.side || !chk.bar || !chk.navHidden || chk.ovf || chk.len < 30
    console.log(`  ${bad ? '✗' : '✓'} ${name.padEnd(10)} 侧栏=${chk.side || '—'} 工具条=${chk.bar} 溢出=${chk.ovf} 文本=${chk.len}${chk.err ? ' 错误=' + chk.err : ''}`)
  }

  // 班级测试答题页（桌面答题卡）
  console.log('\n===== 线上班级测试答题页（桌面） =====')
  const tlRaw = await ev(`fetch('${BASE}/api/class/test/list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:${JSON.stringify(ACC.student.token)},class_id:${JSON.stringify(ACC.class_id)}})}).then(r=>r.json()).then(j=>JSON.stringify(j))`)
  let tests = []
  try { tests = JSON.parse(tlRaw).tests || [] } catch { /* */ }
  const target = tests.find((x) => !x.my_score && x.my_score !== 0) || tests[0]
  if (!target) {
    console.log('  · 无可进入的测试（可能都已作答），跳过答题卡验证')
  } else {
    await send('Page.navigate', { url: BASE + '/class/' + ACC.class_id + '/test/' + target.id })
    await sleep(3000)
    // 介绍页 → 点「开始答题」进入答题界面（答题卡只在此状态显示）
    await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('开始答题')); if (b) { b.click(); return true } return false })()`)
    await sleep(2500)
    const sheet = await ev(`(() => {
      const a = document.querySelector('.trun__sheet')
      const cells = document.querySelectorAll('.trun__cell')
      const qs = document.querySelectorAll('.trun__card')
      return { shown: !!a && getComputedStyle(a).display !== 'none', cells: cells.length, qs: qs.length, text: document.body.innerText.replace(/\\s/g,'').slice(0, 60) }
    })()`)
    console.log('  · 页面状态:', JSON.stringify(sheet))
    if (sheet.cells > 0) {
      ok(sheet.shown, '答题卡显示（桌面）')
      ok(sheet.cells >= 1, '答题卡题号格数量', sheet.cells)
      ok(sheet.qs >= 1, '试卷题目卡渲染', sheet.qs)
      // 答题卡跳题：点第 2 格 → 第 2 题进入视口
      await ev(`(() => { const c = document.querySelectorAll('.trun__cell')[1]; if (c) c.click(); return true })()`)
      await sleep(1200)
      const jumped = await ev(`(() => { const el = document.getElementById('trun-q-1'); if (!el) return 'no-el'; const r = el.getBoundingClientRect(); return (r.top > -50 && r.top < window.innerHeight) ? 'in-view' : 'top=' + Math.round(r.top) })()`)
      ok(jumped === 'in-view', '答题卡点击跳题到视口', jumped)
      await shot('on_testrun.png')
    } else {
      console.log('  · 该测试已作答/无可答题（页面：' + sheet.text + '）')
    }
  }

  // 移动端回归（线上）
  console.log('\n===== 线上移动 390（回归） =====')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  for (const [url, name] of [['/', 'home'], ['/wrongbook', 'wrongbook'], ['/class', 'class']]) {
    await send('Page.navigate', { url: BASE + url })
    await waitSel('.zy-page', 25000)
    await sleep(1600)
    const chk = await ev(`(() => {
      const side = document.querySelector('.ui-sidenav')
      const bar = document.querySelector('.ui-topbar')
      const nav = document.querySelector('.ui-topnav')
      return {
        sideHidden: !side || getComputedStyle(side).display === 'none',
        barHidden: !bar || getComputedStyle(bar).display === 'none',
        navShown: !!nav && getComputedStyle(nav).display !== 'none',
        ovf: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      }
    })()`)
    await shot(`onm_${name}.png`)
    ok(chk.sideHidden && chk.barHidden && chk.navShown && !chk.ovf, `移动 ${name} 保持原样`, chk)
  }

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图目录: ' + OUT)
  chrome.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
