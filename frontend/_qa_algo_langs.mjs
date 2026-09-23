/**
 * 算法演示多语言切换 · 端到端验证（本地 vite preview + CDP）
 * 用法：node _qa_algo_langs.mjs [outDir]
 * 链路：打开算法演示 → 默认 C → 切 Python → 切 Java → 断言代码面板标题与首行
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9500 + (process.pid % 400)
const OUTDIR = process.argv[2] || 'dist71'
const WEBPORT = 5800 + (process.pid % 300)
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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_algo_langs_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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

  section('1. 打开算法演示，默认 C 语言')
  await send('Page.navigate', { url: WEB + '/more?tool=algo' })
  await waitSel('.algo-player')
  await sleep(600)
  const def = await ev(`(() => {
    const title = document.querySelector('.code-panel .panel-title')?.textContent || ''
    const first = document.querySelector('.code-panel .line-text')?.textContent || ''
    const langSel = document.querySelector('.algo__lang .ui-select__native')
    return { title, first, lang: langSel ? langSel.value : '' }
  })()`)
  console.log('  · 默认 →', JSON.stringify(def))
  ok(def.lang === 'c', '语言选择器默认 C', def.lang)
  ok(def.title.includes('C'), '标题显示「· C」', def.title)
  ok(def.first.includes('void bubbleSort'), '首行是 C 代码', def.first)

  section('2. 切到 Python')
  await ev(`(() => {
    const s = document.querySelector('.algo__lang .ui-select__native')
    s.value = 'python'
    s.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(500)
  const py = await ev(`(() => ({
    title: document.querySelector('.code-panel .panel-title')?.textContent || '',
    first: document.querySelector('.code-panel .line-text')?.textContent || '',
  }))()`)
  ok(py.title.includes('Python'), '标题显示「· Python」', py.title)
  ok(py.first.trim() === 'def bubble_sort(a):', '首行是 Python 代码', py.first)

  section('3. 切到 Java')
  await ev(`(() => {
    const s = document.querySelector('.algo__lang .ui-select__native')
    s.value = 'java'
    s.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(500)
  const java = await ev(`(() => ({
    title: document.querySelector('.code-panel .panel-title')?.textContent || '',
    first: document.querySelector('.code-panel .line-text')?.textContent || '',
  }))()`)
  ok(java.title.includes('Java'), '标题显示「· Java」', java.title)
  ok(java.first.trim() === 'void bubbleSort(int[] a) {', '首行是 Java 代码', java.first)

  section('4. 切到 C++ 并播放一步，验证高亮映射')
  await ev(`(() => {
    const s = document.querySelector('.algo__lang .ui-select__native')
    s.value = 'cpp'
    s.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(400)
  await ev(`[...document.querySelectorAll('.controls button')].find((b) => b.textContent.includes('下一步')).click()`)
  await sleep(300)
  const active = await ev(`(() => {
    const lines = [...document.querySelectorAll('.code-line')]
    const idx = lines.findIndex((l) => l.classList.contains('active'))
    return idx >= 0 ? lines[idx].querySelector('.line-text')?.textContent : ''
  })()`)
  console.log('  · 高亮行 →', JSON.stringify(active))
  ok(active.length > 0, '播放后有代码行高亮', active)

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'algo-langs.png'), Buffer.from(shot.data, 'base64'))

  section('5. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '算法多语言切换验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
