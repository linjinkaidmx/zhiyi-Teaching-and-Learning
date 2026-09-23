/**
 * 学习记录 · LaTeX 乱码修复验证（本地 vite preview + CDP）
 * 注入一条「旧格式」记录（title/brief 带原始 LaTeX 源码）→ 断言 /records 页无反斜杠与 $ 残留
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9800 + (process.pid % 300)
const OUTDIR = process.argv[2] || 'dist78'
const WEBPORT = 5970 + (process.pid % 300)
const WEB = 'http://127.0.0.1:' + WEBPORT

const OLD_RECORD = {
  id: 1758450000000001,
  type: 'explain',
  questionId: '',
  title: 'AI 讲解 · 计算 $\\int_0^1 x^2 dx$ 与 $\\frac{1}{3}$ 的关系',
  brief: '计算 \\int_0^1 x^2 dx = \\frac{1}{3}',
  correct: null,
  minutes: 2,
  createdAt: Date.now(),
  synced: false,
}

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}

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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_rec_math_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 2, mobile: false })

  // 注入旧格式记录（带原始 LaTeX 源码，模拟修复前的存量数据）
  await send('Page.navigate', { url: WEB + '/records' })
  await waitSel('.rec__item, .zy-page')
  await ev(`localStorage.setItem('zhiyi_records_v1', JSON.stringify([${JSON.stringify(OLD_RECORD)}]))`)
  await send('Page.navigate', { url: WEB + '/records' })
  await waitSel('.rec__item')
  await sleep(800)

  const check = await ev(`(() => {
    const items = [...document.querySelectorAll('.rec__item')]
    const rec = items[0]
    // 用户可见文本 = 克隆后移除 KaTeX 的隐藏 MathML 注释（其 annotation 天然含原始 TeX，但视觉不可见）
    const visible = (() => {
      if (!rec) return ''
      const clone = rec.cloneNode(true)
      clone.querySelectorAll('.katex-mathml').forEach((n) => n.remove())
      return clone.textContent
    })()
    return {
      count: items.length,
      text: visible.slice(0, 120),
      hasBackslash: visible.includes(String.fromCharCode(92)),
      hasDollar: visible.includes('$'),
      hasKaTeX: !!rec?.querySelector('.katex'),
    }
  })()`)
  console.log('  · 条目内容 →', JSON.stringify(check.text))
  ok(check.count >= 1, '记录条目渲染')
  ok(!check.hasBackslash, '无反斜杠/LaTeX 命令残留', { hasBackslash: check.hasBackslash })
  ok(!check.hasDollar, '无 $ 定界符残留')

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '学习记录乱码修复验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
