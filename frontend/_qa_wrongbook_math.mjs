/**
 * 错题列表公式渲染 · 端到端验证（离线自包含：本地 vite preview + CDP）
 * 用法：node _qa_wrongbook_math.mjs [outDir]
 * 注入含 $...$ 公式的错题，确认列表卡片渲染出 KaTeX 且不再露 $ 定界符。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9498
const OUTDIR = process.argv[2] || 'dist65'
const WEBPORT = 5500 + (process.pid % 300)
const WEB = 'http://127.0.0.1:' + WEBPORT
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

let ws
let seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function waitSel(sel, timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev('!!document.querySelector("' + sel + '")')) return true } catch { /* retry */ }
    await sleep(300)
  }
  return false
}

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_wb_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch('http://127.0.0.1:' + PORT + '/json/version')).ok) break } catch { /* retry */ }
    await sleep(250)
  }
  const t = await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      if (m.error) p.reject(new Error(m.error.message))
      else p.resolve(m.result)
      return
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

  section('1. 注入含公式的错题（游客空间）')
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.home__body')
  await ev(`(() => {
    const now = new Date().toISOString()
    const book = [{
      id: 'm1',
      question: '已知 $P(\\\\overline{A})=0.3$，$P(B)=0.4$，$P(A\\\\overline{B})=0.5$，求条件概率 $P(B|A\\\\cup\\\\overline{B})$',
      subject: '概率论', knowledgePoints: ['条件概率'],
      quizCount: 2, correctCount: 0, mastered: false, reviewAt: 0, createdAt: now,
      diagnosis: '错在 $P(A\\\\cup B)$ 展开时漏了交集项',
    }, {
      id: 'm2',
      question: '求极限 $\\\\lim_{x \\\\to 0} \\\\frac{\\\\sin x}{x}$，并说明 $\\\\sum_{i=1}^{n} i^2$ 的闭式',
      subject: '高等数学', knowledgePoints: ['极限'],
      quizCount: 1, correctCount: 0, mastered: false, reviewAt: 0, createdAt: now,
    }]
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify(book))
    return true
  })()`)

  section('2. 错题学习页：列表卡片应渲染 KaTeX')
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.wb__card')
  await sleep(1500)
  const res = await ev(`(() => {
    const cards = [...document.querySelectorAll('.wb__card')]
    const q = cards.map((c) => {
      const el = c.querySelector('.wb__card-q')
      return {
        text: (el ? el.textContent : '').replace(/\\s+/g, ' ').trim().slice(0, 90),
        katex: el ? el.querySelectorAll('.katex').length : 0,
        height: el ? Math.round(el.getBoundingClientRect().height) : 0,
      }
    })
    const reason = [...document.querySelectorAll('.wb__card-reason')].map((el) => ({
      text: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60),
      katex: el.querySelectorAll('.katex').length,
    }))
    return {
      cards: cards.length,
      q,
      reason,
      anyDollar: (document.body.textContent || '').includes('$'),
      overflow: cards.some((c) => c.scrollWidth > c.clientWidth + 2),
    }
  })()`)
  console.log('  · 实际渲染 → ' + JSON.stringify(res, null, 1))

  ok(res.cards === 2, '渲染出 2 张错题卡', res.cards)
  ok(res.q.every((x) => x.katex > 0), '每张卡题干都渲染了 KaTeX 节点', res.q.map((x) => x.katex))
  ok(res.anyDollar === false, '页面不再出现 $ 定界符')
  ok(res.q[0].katex === 4, '第 1 题的 4 个公式全部渲染（未被截断成半截公式）', res.q[0].katex)
  ok(res.q[1].katex === 2, '第 2 题的 2 个公式全部渲染', res.q[1].katex)
  ok(res.reason.length === 1 && res.reason[0].katex > 0, '诊断摘要也渲染了公式', res.reason)
  ok(res.q.every((x) => x.height > 0 && x.height <= 110), '题干高度受 3 行限制（未撑破卡片）', res.q.map((x) => x.height))
  ok(res.overflow === false, '卡片无横向溢出')
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'wrongbook-math.png'), Buffer.from(shot.data, 'base64'))

  section('3. 关掉「公式渲染」偏好后降级为可读文本')
  await ev(`(() => {
    const raw = localStorage.getItem('zhiyi_profile_v1') || '{}'
    const p = JSON.parse(raw)
    p.prefs = Object.assign({}, p.prefs, { renderMath: false })
    localStorage.setItem('zhiyi_profile_v1', JSON.stringify(p))
    return true
  })()`)
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.wb__card')
  await sleep(1200)
  const off = await ev(`(() => {
    const el = document.querySelector('.wb__card-q')
    return {
      katex: el ? el.querySelectorAll('.katex').length : -1,
      text: el ? el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70) : '',
      dollar: (el ? el.textContent : '').includes('$'),
    }
  })()`)
  ok(off.katex === 0, '偏好关闭时不再渲染 KaTeX（翻页更快）', off)
  ok(off.dollar === false, '降级文本里也没有 $ 定界符', off.text)

  section('4. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '错题列表公式渲染验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('脚本异常：', e); process.exit(1) })
