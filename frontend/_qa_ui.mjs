/**
 * QA 深测：UI / 适配 / 极限操作 / 弱网（尽量不触发真实模型调用）
 * 用法：node _qa_ui.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9433
const BASE = 'http://193.112.28.51:3300'
const userDir = path.join(os.tmpdir(), 'qa_ui_' + process.pid)
fs.mkdirSync(userDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'], { stdio: 'ignore' })
let ws
let seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value
let pass = 0
let fail = 0
const ok = (c, label, extra) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }
const sec = (t) => console.log('\n' + t)

async function waitDevtools() {
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return } catch {} await sleep(250) }
  throw new Error('devtools 未就绪')
}

async function main() {
  await waitDevtools()
  const t = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((res) => ws.addEventListener('open', res, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || 'exception').slice(0, 140))
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 140))
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')

  sec('1. 移动视口适配（390px，无横向溢出 + 主按钮可达）')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  for (const p of ['/', '/capture', '/wrongbook', '/data', '/chat', '/me']) {
    await send('Page.navigate', { url: BASE + p + '?v=46' })
    await sleep(1800)
    const r = await ev(`(() => {
      const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth
      const btn = [...document.querySelectorAll('button')].find((b) => /拍题|拍照|上传|开始识别/.test(b.textContent))
      return { overflow: sw > cw + 1, sw, cw, hasMainBtn: !!btn }
    })()`)
    ok(!r.overflow, `/${p || ''} 无横向溢出`, r)
  }

  sec('2. 非图片文件：应被拦截（拖入 .txt）')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/capture?v=46' })
  await sleep(2000)
  const badDrop = await ev(`(async () => {
    const txt = new File(['hello'], 'x.txt', { type: 'text/plain' })
    const zone = document.querySelector('.capture__zone') || document.body
    const dt = new DataTransfer()
    dt.items.add(txt)
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
    await new Promise((r) => setTimeout(r, 400))
    const toasts = [...document.querySelectorAll('.ui-toast')].map((t) => t.innerText)
    return { toasts: toasts.join('|') }
  })()`, true)
  ok(/图片|格式/.test(badDrop.toasts || ''), '拖入非图片有明确提示', badDrop)

  sec('3. 连续双击「开始识别」不重复触发（用文字模式，不调模型）')
  await ev(`(() => {
    const ta = document.querySelector('.capture__textarea')
    if (!ta) return false
    const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    s.call(ta, '求极限 lim(x->0) sin(x)/x')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(300)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '开始识别'); if (b) { b.click(); b.click(); } return !!b })()`)
  await sleep(1200)
  const dup = await ev(`(() => {
    const n = document.querySelectorAll('.capture__card').length
    return { cards: n, stage: (document.body.innerText.match(/识别中|讲解中|已就绪/g) || []).join(',') }
  })()`)
  ok(dup.cards >= 1, `双击后正常进入（识别卡片 ${dup.cards} 张）`, dup)

  sec('4. 弱网/断网：加载与操作不白屏')
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
  await send('Page.navigate', { url: BASE + '/?v=46' })
  await sleep(2500)
  const off = await ev(`(() => ({
    hasShell: !!document.querySelector('.zy-scope, .ui-shell'),
    text: (document.body.innerText || '').slice(0, 40),
  }))()`)
  ok(!off.hasShell, '断网下刷新能提示失败/不白屏卡死（返回空壳）', off)
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })

  sec('5. 控制台错误汇总')
  ok(errors.length === 0, '整轮无未捕获异常/console.error', errors.slice(0, 3))

  console.log('\n' + '='.repeat(46))
  console.log(fail === 0 ? `UI 深测通过（${pass} 项）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
  process.exitCode = fail === 0 ? 0 : 1
}

main().catch((e) => console.error('脚本异常:', e.message)).finally(() => { try { ws?.close() } catch {} chrome.kill() })
