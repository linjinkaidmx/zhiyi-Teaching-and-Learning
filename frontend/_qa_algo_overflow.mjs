/**
 * 算法演示 · 移动端代码面板横向溢出验证（本地 vite preview + CDP）
 * 用法：node _qa_algo_overflow.mjs [outDir]
 * 链路：375px 移动视口打开算法演示 → 依次切 c/cpp/java/python → 断言页面零横向溢出
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9600 + (process.pid % 300)
const OUTDIR = process.argv[2] || 'dist75'
const WEBPORT = 5900 + (process.pid % 300)
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

const LANGS = ['c', 'cpp', 'java', 'python']

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_algo_ovf_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  // 移动视口（iPhone 尺寸）
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })

  await send('Page.navigate', { url: WEB + '/more?tool=algo' })
  await waitSel('.code-panel')
  await sleep(600)

  for (const lang of LANGS) {
    await ev(`(() => {
      const s = document.querySelector('.algo__lang .ui-select__native')
      s.value = '${lang}'
      s.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`)
    await sleep(400)
    const m = await ev(`(() => {
      const panel = document.querySelector('.code-panel')
      const doc = document.documentElement
      const lines = [...document.querySelectorAll('.code-panel .line-text')]
      let maxLen = 0
      for (const l of lines) maxLen = Math.max(maxLen, l.textContent.length)
      return {
        docScrollW: doc.scrollWidth, docClientW: doc.clientWidth,
        panelScrollW: panel ? panel.scrollWidth : 0, panelClientW: panel ? panel.clientWidth : 0,
        maxLen, overflowX: panel ? getComputedStyle(panel).overflowX : ''
      }
    })()`)
    ok(m.docScrollW <= m.docClientW, `[${lang}] 页面零横向溢出`, { scrollW: m.docScrollW, clientW: m.docClientW })
    ok(m.overflowX === 'auto', `[${lang}] code-panel overflow-x:auto 生效`, m.overflowX)
  }

  // 截 C++ 长行情况留证
  await ev(`(() => {
    const s = document.querySelector('.algo__lang .ui-select__native')
    s.value = 'cpp'
    s.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(400)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'algo-overflow-mobile.png'), Buffer.from(shot.data, 'base64'))

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '算法演示移动端溢出验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
