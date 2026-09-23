/**
 * 精简版：上传作答图 → 转录 → 判分 → 滚动到结果 → 截图（线上真实模型）
 * 用法：QA_BASE=http://193.112.28.51:3300 node _qa_prphoto_shot.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9600 + (process.pid % 500)
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const OUT = path.resolve('.learnbuddy/_qa_imgs')
const B64 = fs.readFileSync(path.join(OUT, 'qa_answer.b64'), 'utf8').trim()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, seq = 0
const pending = new Map()
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
async function waitFor(expr, timeout) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev(expr)) return true } catch { /* retry */ }
    await sleep(1000)
  }
  return false
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_prshot_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })

  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.home__body, #app')
  await ev(`(() => {
    const now = new Date().toISOString()
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify([
      { id: 'qa1', question: '1+1 等于几？', answer: '2', subject: '高等数学', knowledgePoints: ['算术'],
        quizCount: 1, correctCount: 0, mastered: false, reviewAt: 0, courseId: '', createdAt: now },
    ]))
    return true
  })()`)
  await send('Page.navigate', { url: BASE + '/practice/original' })
  await waitSel('.pr__config')
  await ev(`[...document.querySelectorAll('.pr__config button')].find((x) => x.textContent.includes('开始练习')).click()`)
  await waitSel('.pr__answer')
  await ev(`(() => new Promise((resolve) => {
    const bin = atob("${B64}")
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i)
    const dt = new DataTransfer()
    dt.items.add(new File([arr], 'answer.png', { type: 'image/png' }))
    const input = document.querySelectorAll('.pr__answer input[type=file]')[1]
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    resolve(true)
  }))()`)
  await waitFor(`(() => { const ta = document.querySelector('.pr__input'); return ta && ta.value.length > 0 })()`, 90000)
  await sleep(500)
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'prphoto-filled2.png'), Buffer.from(shot1.data, 'base64'))

  await ev(`[...document.querySelectorAll('.pr__answer button')].find((x) => x.textContent.includes('AI 判分')).click()`)
  await waitFor(`!!document.querySelector('.pr__verdict')`, 150000)
  await sleep(800)
  await ev(`document.querySelector('.pr__verdict').scrollIntoView({ block: 'center' })`)
  await sleep(900)
  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'prphoto-verdict2.png'), Buffer.from(shot2.data, 'base64'))
  console.log('shots done')
  try { chrome.kill() } catch { /* noop */ }
  process.exit(0)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
