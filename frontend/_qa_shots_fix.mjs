/**
 * 补截：①真正的错题详情（AI 讲解渲染，含公式与追问面板） ②导出成绩时的提示反馈
 * 用法：node _qa_shots_fix.mjs
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
const CDP = 9460 + (process.pid % 30)
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const waitSel = async (sel, t = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true } catch { /* */ } await sleep(400) } return false }
const shot = async (name, { mobile = false } = {}) => {
  await send('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000, deviceScaleFactor: 2, mobile })
  await sleep(700)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'))
  console.log('  ✓', name + '.png')
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_fx_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')

  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.zy-page', 25000)
  await sleep(3000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});localStorage.setItem('zhiyi_setup_dismissed','1');localStorage.setItem('zhiyi_theme','light');'ok'`)

  // 从本地错题本取出真实条目（含讲解），用路由直达详情
  await send('Page.navigate', { url: BASE + '/wrongbook' })
  await waitSel('.zy-page', 25000); await sleep(2500)
  const item = await ev(`(() => {
    try {
      const raw = localStorage.getItem('zhiyi_errorbook_v1') || localStorage.getItem('zhiyi_errorbook_account_v1') || '[]'
      const arr = JSON.parse(raw)
      const list = Array.isArray(arr) ? arr : (arr.items || [])
      const withAnswer = list.filter((x) => x && x.question && (x.answer || x.result))
      const pick = withAnswer[0] || list[0]
      return pick ? { id: pick.id, q: String(pick.question || '').slice(0, 30), hasAnswer: !!(pick.answer || pick.result) } : null
    } catch (e) { return { err: String(e).slice(0, 60) } }
  })()`)
  console.log('  · 本地错题取样:', JSON.stringify(item))

  if (item && item.id) {
    for (const [route, name] of [
      ['/wrongbook/' + item.id, '04-wrongbook-detail'],
    ]) {
      await send('Page.navigate', { url: BASE + route })
      await waitSel('.zy-page', 25000)
      await sleep(3500)
      await shot(name)
      // 往下滚，拍到讲解正文（公式渲染区）
      await ev(`window.scrollTo(0, 520)`); await sleep(1200)
      await shot('04b-wrongbook-explain-body')
      await ev(`window.scrollTo(0, document.body.scrollHeight * 0.5)`); await sleep(1200)
      await shot('04c-wrongbook-explain-bottom')
    }
  }

  // 教师端：导出成绩时的 toast 反馈
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.teacher.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.teacher.nickname)});'ok'`)
  const list = await fetch(BASE + '/api/homework/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ACC.teacher.token, class_id: ACC.class_id }) }).then((r) => r.json())
  const hw = (list.items || [])[0]
  if (hw) {
    await send('Page.navigate', { url: BASE + '/class/' + ACC.class_id + '/hw/' + hw.id })
    await waitSel('.zy-page', 25000); await sleep(2600)
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false })
    await sleep(500)
    // 点导出后立刻截图（抓 toast）
    await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('导出成绩表')); if(b) b.click(); return !!b })()`)
    await sleep(1200)
    await shot('24-export-scores-toast')
    // 打印报告（抓打印预览 DOM 的可见态不易，改为点班级报告后截图）
    await sleep(600)
    await shot('25-homework-after-export')
  }

  chrome.kill()
  console.log('\n补截完成')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
