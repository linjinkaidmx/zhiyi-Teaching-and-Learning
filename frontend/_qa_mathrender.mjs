/**
 * LaTeX 渲染修复回归（本地 uvicorn(MOCK) + CDP）。
 * 覆盖：错题本笔记卡/题目卡/抽屉无 LaTeX 源码残留且公式 KaTeX 渲染。
 * 前置：dist111 已拷入 backend/static。用法：node _qa_mathrender.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PY = 'C:/Users/ASUS/.workbuddy/binaries/python/envs/zhiyi/Scripts/python.exe'
const BACKEND_DIR = path.resolve(__dirname, '../backend')
const PORT = 9780 + ((process.pid % 50) + 10)
const CDP_PORT = PORT + 100
const WEB = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

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
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* retry */ } await sleep(400) }
  console.log('  · timeout: ' + label)
  return false
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
}

const NOTE = {
  id: 'note_math_1',
  kind: 'note',
  title: '定积分三大方法',
  content: '换元法：$\\int f(g(x))g\'(x)\\,dx = \\int f(u)\\,du$，其中 $u=g(x)$。\n分部积分：$\\int u\\,dv = uv - \\int v\\,du$。',
  question: '换元法与分部积分',
  subject: '数学',
  knowledgePoints: ['定积分', '换元法'],
  source: '班级笔记',
  streak: 0, quizCount: 0, correctCount: 0, mastered: false, reviewAt: 0, interval: 1, repetitions: 0,
  createdAt: new Date().toISOString(),
}
const Q = {
  id: 'q_math_1',
  question: '求 $\\lim_{x\\to0} \\frac{3-\\sqrt{9+xy}}{xy}$ 的值',
  subject: '数学', knowledgePoints: ['极限'], mastered: false, streak: 0, quizCount: 1, correctCount: 0,
  reviewAt: 0, createdAt: new Date().toISOString(),
}

const SCAN = `(() => {
  const visible = (el) => { const c = el.cloneNode(true); c.querySelectorAll('.katex-mathml').forEach((x) => x.remove()); return c.textContent }
  const cards = [...document.querySelectorAll('.wb__card')].map((c) => ({ text: visible(c), katex: c.querySelectorAll('.katex').length }))
  const bad = cards.filter((c) => c.text.includes('$') || c.text.includes('\\\\') )
  return { bad: bad.map((c) => c.text.slice(0, 100)), katex: cards.reduce((s, c) => s + c.katex, 0), n: cards.length }
})()`

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_math_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })

  console.log('\n1. 错题本：笔记卡与题目卡（KaTeX 渲染）')
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitFor(`!!document.querySelector('.zy-page')`, 15000, '页面')
  await ev(`localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify([${JSON.stringify(NOTE)}, ${JSON.stringify(Q)}])); 'ok'`)
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitFor(`!!document.querySelector('.wb__group-title')`, 10000, '分组标题')
  await sleep(1200)
  const scan = await ev(SCAN)
  ok(scan.n === 2, '两张卡片渲染（题目 + 笔记）', scan.n)
  ok(scan.bad.length === 0, '卡片文本零 LaTeX 源码残留（无 $ 无反斜杠命令）', scan.bad)
  ok(scan.katex >= 1, '题目卡公式 KaTeX 渲染', scan.katex)
  await shot('math_01_wrongbook.png')

  console.log('\n2. 笔记详情抽屉')
  await ev(`[...document.querySelectorAll('.wb__card--note')][0].click()`)
  await waitFor(`!!document.querySelector('.wb__note-content .katex')`, 8000, '抽屉渲染')
  await sleep(600)
  const drawerScan = await ev(`(() => {
    const body = document.querySelector('.wb__drawer-body')
    const visible = (el) => { const c = el.cloneNode(true); c.querySelectorAll('.katex-mathml').forEach((x) => x.remove()); return c.textContent }
    const t = body ? visible(body) : ''
    return { dollar: t.includes('$'), katex: body ? body.querySelectorAll('.katex').length : 0 }
  })()`)
  ok(!drawerScan.dollar, '笔记抽屉正文零 $ 残留', drawerScan.dollar)
  ok(drawerScan.katex >= 2, '抽屉公式 KaTeX 渲染（≥2 处）', drawerScan.katex)
  await shot('math_02_drawer.png')

  ok(errors.length === 0, '无运行时异常', errors.slice(0, 3))
  console.log(`\n==============================================\n${fail === 0 ? '全部通过' : '存在失败'}（${pass} 项断言，失败 ${fail}）`)
  try { chrome.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

const dbTmp = path.join(os.tmpdir(), 'zhiyi_math_qa_' + process.pid + '.db')
const BOOT = [
  'import types, sys',
  "m = types.ModuleType('resource')",
  'm.RLIMIT_CPU = 0; m.RLIMIT_AS = 1; m.RLIMIT_CORE = 2',
  'm.setrlimit = lambda *a, **k: None',
  "sys.modules['resource'] = m",
  `import uvicorn; uvicorn.run('main:app', host='127.0.0.1', port=${PORT})`,
].join('; ')
const backend = spawn(PY, ['-c', BOOT], { cwd: BACKEND_DIR, stdio: 'ignore', env: { ...process.env, MOCK: '1', ZHIYI_DB: dbTmp } })

main().catch((e) => { console.error('E2E 异常:', e); process.exitCode = 1 }).finally(() => { try { backend.kill() } catch { /* ignore */ } })
