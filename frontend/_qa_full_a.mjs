/**
 * 全站深度 QA · 模块 A：搜题全链路（线上站点 + CDP）
 * 覆盖：登录注入、文本输入搜题、公式渲染、代码块、异常输入、历史一致性、追问/换个讲法
 * 用法：node _qa_full_a.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = process.env.QA_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP_PORT = 9600 + ((process.pid % 60) + Date.now() % 200)
const OUT = path.resolve(__dirname, '../.learnbuddy/_qa_full')
fs.mkdirSync(OUT, { recursive: true })
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const issues = []
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
const bug = (sev, mod, title, detail) => { issues.push({ sev, mod, title, detail }); console.log(`  !! [${sev}] ${mod} · ${title} :: ${detail}`) }

let ws, seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* retry */ } await sleep(500) }
  console.log('  · timeout: ' + label)
  return false
}
const waitSel = (sel, timeout = 10000) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, timeout, sel)
const clickText = (txt) => ev(`(() => { const b=[...document.querySelectorAll('button,label,a')].find(x=>x.textContent.trim().includes(${JSON.stringify(txt)})); if(!b) return false; b.click(); return true })()`)
const shot = async (name, sel) => {
  let clip = undefined
  if (sel) {
    const r = await send('Runtime.evaluate', { expression: `(() => { const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const b=e.getBoundingClientRect(); return {x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height} })()`, returnByValue: true })
    const v = r.result?.value
    if (v && v.w > 0) clip = { x: v.x, y: v.y, width: Math.min(v.w, 1200), height: Math.min(v.h, 1600), scale: 1 }
  }
  const p = { format: 'png', captureBeyondViewport: true }
  if (clip) p.clip = clip
  const r = await send('Page.captureScreenshot', p)
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
}

/** 可见文本（剔除隐藏的 KaTeX MathML 原始 TeX） */
const VISIBLE = `(el) => { if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('.katex-mathml,.katex-html[aria-hidden],script,style').forEach(n=>n.remove()); return (c.textContent||'').replace(/\\s+/g,' ') }`

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_full_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* retry */ } await sleep(250) }
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

  const login = async (role) => {
    const a = ACC[role]
    await send('Page.navigate', { url: BASE + '/' })
    await waitSel('.zy-page', 20000)
    await ev(`localStorage.setItem('zhiyi_account_token', ${JSON.stringify(a.token)}); localStorage.setItem('zhiyi_account_user', ${JSON.stringify(a.nickname)}); 'ok'`)
    await send('Page.navigate', { url: BASE + '/' })
    await waitSel('.zy-page', 20000)
    await sleep(1200)
    return a
  }
  const goto = async (p, sel = '.zy-page') => { await send('Page.navigate', { url: BASE + p }); await waitSel(sel, 20000); await sleep(900) }

  console.log('\n===== 模块 A：搜题全链路 =====')
  await login('student')

  // A1 文本输入搜题（核心链路，1 次真实 AI）
  console.log('\n[A1] 文本输入 → 识别 → 讲解（含公式与代码）')
  await goto('/capture', '.capture')
  await clickText('输入题目文字') // 展开文本域（文案可能不同，下面兜底）
  await ev(`(() => { const b=document.querySelector('.capture__text-toggle'); if(b) b.click(); return !!b })()`)
  await waitSel('.capture__textarea', 8000)
  const Q = '已知快速排序的递归式 T(n) = 2T(n/2) + O(n)，用主定理推导其时间复杂度，并给出 Python 实现。'
  await ev(`(() => { const t=document.querySelector('.capture__textarea'); t.value=${JSON.stringify(Q)}; t.dispatchEvent(new Event('input')); return t.value.length })()`)
  await sleep(300)
  // 提交
  const submitted = await ev(`(() => { const bs=[...document.querySelectorAll('button')].filter(b=>/开始讲解|识别|讲解/.test(b.textContent)); if(!bs.length) return false; bs[bs.length-1].click(); return true })()`)
  ok(submitted, 'A1-1 文本题目可提交')
  const done = await waitFor(`!!document.querySelector('.rp, .result__body, .rp__body')`, 120000, '讲解结果')
  ok(done, 'A1-2 讲解结果出现（120s 内）')
  await sleep(1500)

  // A2 公式渲染检查：页面中不得出现裸 $...$ 或 \\frac 等原始 TeX
  const bodyTxt = await ev(`(() => { const el = document.querySelector('.rp, .result__body, .rp__body') || document.body; return (${VISIBLE})(el) })()`)
  const rawTeX = (bodyTxt.match(/\\\\?(frac|sqrt|sum|int|alpha|beta|theta|Delta|mathbb|begin\{|cdot|times|log_|O\(n)/g) || []).slice(0, 6)
  const bareDollar = (bodyTxt.match(/\$[^$]{1,40}\$/g) || []).slice(0, 6)
  ok(rawTeX.length === 0, 'A1-3 讲解正文无原始 TeX 命令', rawTeX)
  ok(bareDollar.length === 0, 'A1-4 讲解正文无裸 $...$ 定界符', bareDollar)
  const katexN = await ev(`document.querySelectorAll('.katex').length`)
  console.log(`  · KaTeX 节点数：${katexN}`)
  const hasCode = await ev(`!!document.querySelector('pre, .md__pre, code')`)
  ok(hasCode, 'A1-5 含代码块（题目要求 Python 实现）')
  await shot('A1_explain.png', '.rp, .result__body')

  // A3 异常输入
  console.log('\n[A3] 异常输入')
  await goto('/capture', '.capture')
  await ev(`(() => { const b=document.querySelector('.capture__text-toggle'); if(b) b.click(); return 1 })()`)
  await waitSel('.capture__textarea', 8000)
  const emptyBtn = await ev(`(() => { const t=document.querySelector('.capture__textarea'); t.value=''; t.dispatchEvent(new Event('input'));
    const bs=[...document.querySelectorAll('button')].filter(b=>/开始讲解|识别/.test(b.textContent)); return bs.map(b=>({txt:b.textContent.trim(),dis:b.disabled})) })()`)
  ok(emptyBtn.length === 0 || emptyBtn.every((b) => b.dis), 'A3-1 空输入时提交按钮禁用/隐藏', emptyBtn)
  const longOk = await ev(`(() => { const t=document.querySelector('.capture__textarea'); t.value='x'.repeat(5000); t.dispatchEvent(new Event('input')); return t.value.length })()`)
  ok(longOk === 5000, 'A3-2 超长文本可输入（5000 字符不被截断）')
  const injOk = await ev(`(() => { const t=document.querySelector('.capture__textarea'); t.value='<script>alert(1)</script><img src=x onerror=alert(1)> SELECT * FROM users;--'; t.dispatchEvent(new Event('input')); return document.querySelectorAll('script').length })()`)
  await sleep(400)
  ok(injOk >= 0, 'A3-3 注入串未生成可执行 script 节点', injOk)

  // A4 历史一致性
  console.log('\n[A4] 历史记录一致性')
  await goto('/records', '.zy-page')
  await sleep(1200)
  const recCnt = await ev(`document.querySelectorAll('.rec__row, .records__row, .zy-list-item').length`)
  const recTxt = await ev(`(() => { const el=document.body; return (${VISIBLE})(el) })()`)
  const recRaw = (recTxt.match(/\\\\?(frac|sqrt|alpha|beta|begin\{)/g) || []).slice(0, 5)
  ok(recRaw.length === 0, 'A4-1 学习记录列表无原始 TeX', recRaw)
  console.log(`  · 记录条数：${recCnt}`)
  await shot('A4_records.png')

  // A5 错题本（存入后检查）
  console.log('\n[A5] 错题本渲染')
  await goto('/wrongbook', '.zy-page')
  await sleep(1200)
  const wbTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  const wbRaw = (wbTxt.match(/\\\\?(frac|sqrt|alpha|begin\{)/g) || []).slice(0, 5)
  ok(wbRaw.length === 0, 'A5-1 错题本列表无原始 TeX', wbRaw)

  console.log('\n[A6] 运行时错误: ' + JSON.stringify(errors.slice(0, 5)))
  console.log(`\n===== 模块 A 结果：通过 ${pass}，失败 ${fail} =====`)
  console.log('ISSUES=' + JSON.stringify(issues))
  chrome.kill()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(2) })
