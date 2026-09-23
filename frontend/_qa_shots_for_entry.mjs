/**
 * 参赛素材：批量截取关键页面（桌面 1440 宽 + 移动 390 宽）
 * 用法：node _qa_shots_for_entry.mjs
 * 输出：E:/知一2.0/参赛素材/screenshots/*.png
 *
 * 说明：尽量复用已有数据（错题本里的讲解记录）来展示"讲解渲染"效果，
 * 避免为了截图而额外产生大量模型调用。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const OUT = 'E:/知一2.0/参赛素材/screenshots'
const CDP = 9440 + (process.pid % 40)
fs.mkdirSync(OUT, { recursive: true })
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const waitSel = async (sel, t = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true } catch { /* */ } await sleep(400) } return false }
const clickText = (t, scope = '') => ev(`(() => {
  const root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document'}
  if (!root) return false
  const b = [...root.querySelectorAll('button, [role=tab], a')].find((x) => (x.textContent || '').includes(${JSON.stringify(t)}) && !x.disabled)
  if (b) { b.click(); return true }
  return false
})()`)

let shotCount = 0
async function shot(name, { mobile = false, full = false } = {}) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: mobile ? 390 : 1440, height: mobile ? 844 : 1000,
    deviceScaleFactor: mobile ? 2 : 2, mobile,
  })
  await sleep(700)
  const params = { format: 'png', captureBeyondViewport: full }
  const r = await send('Page.captureScreenshot', params)
  const p = path.join(OUT, name + '.png')
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'))
  shotCount += 1
  console.log(`  [${String(shotCount).padStart(2, '0')}] ${name}.png  ${Math.round(fs.statSync(p).size / 1024)}KB`)
}

const goto = async (route) => {
  await send('Page.navigate', { url: BASE + route })
  await waitSel('.zy-page', 25000)
  await sleep(2600)
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_shot_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')

  // 以学生身份登录（数据最全：错题、班级、成就）
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.zy-page', 25000)
  await sleep(3000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});localStorage.setItem('zhiyi_setup_dismissed','1');localStorage.setItem('zhiyi_theme','light');'ok'`)

  console.log('\n=== 桌面端 ===')
  await goto('/'); await shot('01-home-desktop')
  await goto('/capture'); await shot('02-capture')
  await goto('/wrongbook'); await shot('03-wrongbook-list')
  // 错题详情（含 AI 讲解渲染）——列表里点第一个"详情"
  await clickText('详情')
  await sleep(3000); await shot('04-explain-rendered')
  await goto('/practice/quick'); await shot('05-practice-quiz')
  await goto('/data'); await shot('06-data-overview')
  await ev(`window.scrollTo(0, document.body.scrollHeight * 0.55)`); await sleep(900)
  await shot('07-data-weakpoints')
  // 成长报告弹窗
  await clickText('成长报告'); await sleep(2200); await shot('08-growth-report')
  await clickText('关闭', '.ui-modal'); await sleep(900)
  // 薄弱点「练一组」弹窗（截到出题完成即可，避免额外模型调用）
  await ev(`window.scrollTo(0, document.body.scrollHeight * 0.55)`); await sleep(600)
  await clickText('练一组'); await sleep(1500); await shot('09-weakpoint-generating')
  for (let i = 0; i < 30; i++) { await sleep(1500); if (await ev(`/提交这一题/.test(document.body.innerText)`)) break }
  await shot('10-weakpoint-quiz')
  await ev(`(() => { const b=[...document.querySelectorAll('.ui-modal button')].find(x=>(x.textContent||'').includes('关闭')); return !!b })()`)
  await goto('/achievements'); await shot('11-achievements')
  await goto('/tools'); await shot('12-tools')
  await goto('/tools?tool=algo'); await sleep(2500); await shot('13-algo-demo')
  await goto('/tools?tool=code'); await sleep(2500); await shot('14-code-judge')
  await goto('/tools?tool=ref'); await sleep(2000); await shot('15-cheatsheet')
  await goto('/exam'); await shot('16-exam-list')
  await goto('/community'); await shot('17-community')
  await goto('/records'); await shot('18-records')

  console.log('\n=== 移动端 ===')
  await goto('/'); await shot('19-home-mobile', { mobile: true })
  await goto('/wrongbook'); await shot('20-wrongbook-mobile', { mobile: true })
  await goto('/data'); await shot('21-data-mobile', { mobile: true })

  console.log('\n=== 教师端（班级）===')
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.teacher.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.teacher.nickname)});'ok'`)
  const list = await fetch(BASE + '/api/homework/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ACC.teacher.token, class_id: ACC.class_id }) }).then((r) => r.json())
  const hw = (list.items || [])[0]
  await goto('/class/' + ACC.class_id); await shot('22-class-chat')
  if (hw) {
    await goto('/class/' + ACC.class_id + '/hw/' + hw.id); await sleep(1500)
    await shot('23-homework-teacher')
    await clickText('导出成绩表'); await sleep(2500); await shot('24-export-scores')
  }

  console.log(`\n共 ${shotCount} 张 → ${OUT}`)
  chrome.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
