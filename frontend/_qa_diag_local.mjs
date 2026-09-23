/**
 * 诊断：找出错题本的 localStorage key + 错题卡片的可点击结构
 * 用法：node _qa_diag_local.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP = 9480 + (process.pid % 20)
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const waitSel = async (sel, t = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true } catch { /* */ } await sleep(400) } return false }

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_dl_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.zy-page', 25000); await sleep(3000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});localStorage.setItem('zhiyi_setup_dismissed','1');'ok'`)

  await send('Page.navigate', { url: BASE + '/wrongbook' })
  await waitSel('.zy-page', 25000); await sleep(3000)

  const keys = await ev(`Object.keys(localStorage).filter(k => /book|error/i.test(k))`)
  console.log('=== 相关 localStorage keys ===')
  console.log(' ', JSON.stringify(keys))
  const sizes = await ev(`(() => { const o = {}; Object.keys(localStorage).filter(k=>/book|error/i.test(k)).forEach(k => o[k] = (localStorage.getItem(k)||'').length); return o })()`)
  console.log(' ', JSON.stringify(sizes))

  const card = await ev(`(() => {
    const cands = ['[class*=card]', '[class*=row]', 'article', 'li', 'a']
    const out = {}
    for (const c of cands) out[c] = document.querySelectorAll(c).length
    const firstCard = document.querySelector('[class*=card]')
    return {
      counts: out,
      firstCardCls: firstCard ? firstCard.className : null,
      firstCardText: firstCard ? (firstCard.innerText || '').replace(/\\s+/g, ' ').slice(0, 80) : null,
      links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(Boolean).slice(0, 6),
    }
  })()`)
  console.log('\n=== 卡片结构 ===')
  console.log(' ', JSON.stringify(card, null, 1).slice(0, 900))

  chrome.kill(); process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
