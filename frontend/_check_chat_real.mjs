/**
 * 聚焦检查：/chat 真实流式回答能否完整落地（1 次模型调用）
 * 用法：node _check_chat_real.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9411
const BASE = 'http://193.112.28.51:3300'
const userDir = path.join(os.tmpdir(), 'chat_check_' + process.pid)
fs.mkdirSync(userDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'], { stdio: 'ignore' })

let ws
let seq = 0
const pending = new Map()
const errors = []
const send = (method, params = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value

async function waitDevtools() {
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return } catch { /* retry */ }
    await sleep(250)
  }
  throw new Error('devtools 未就绪')
}

async function main() {
  await waitDevtools()
  const t = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((res) => ws.addEventListener('open', res, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(m.error.message)) : resolve(m.result)
      return
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params?.exceptionDetails?.text || 'exception')
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 120))
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/chat?v=40' })
  await sleep(4500)

  await ev(`(() => {
    const ta = document.querySelector('.chat__textarea')
    if (!ta) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, '用一句话说明什么是时间复杂度')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(300)
  const clicked = await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '发送')
    if (b) b.click(); return !!b
  })()`)
  console.log('发送按钮点击:', clicked)

  // 轮询直到流式结束（最多 60s）
  let final = { len: 0, streaming: true, text: '' }
  for (let i = 0; i < 60; i += 1) {
    await sleep(1000)
    final = await ev(`(() => {
      const a = document.querySelector('.chat__msg[data-role="assistant"]')
      return {
        len: a ? a.innerText.trim().length : 0,
        streaming: !!document.querySelector('.ai-caret'),
        text: a ? a.innerText.trim().slice(0, 80) : '',
      }
    })()`)
    if (final.len > 0 && !final.streaming) break
  }
  console.log('等待结果:', JSON.stringify(final, null, 2))
  console.log('控制台错误:', errors.length ? errors.slice(0, 3) : '无')

  await sleep(1500)   // 等画面稳定再截图，避免拍到未绘制的帧
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const out = 'E:/知一2.0/.learnbuddy/_p9_shots2/chat-real.png'
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log('截图:', out)
  console.log(final.len > 20 && !final.streaming ? '\n结论：真实对话流式链路 OK' : '\n结论：仍有问题（见上方）')
}

main()
  .catch((e) => console.error('脚本异常:', e.message))
  .finally(() => {
    try { ws?.close() } catch { /* 忽略 */ }
    chrome.kill()
  })
