/**
 * 原型页渲染验证：截取局部与整页，确认 33 个样机正常渲染
 * 用法：node _probe_proto_shot.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9880 + (process.pid % 90)
const FILE = 'file:///' + path.resolve('../docs/首页改版-全站界面原型.html').replace(/\\/g, '/')
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'proto_shot_' + process.pid), '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1340, height: 1000, deviceScaleFactor: 1, mobile: false })
  console.log('打开:', FILE)
  await send('Page.navigate', { url: FILE })
  await sleep(2500)

  const info = await ev(`(() => ({
    title: document.title,
    devs: document.querySelectorAll('figure.dev').length,
    screens: document.querySelectorAll('.screen').length,
    height: document.documentElement.scrollHeight,
    spec: !!document.querySelector('.spec'),
    mapRows: document.querySelectorAll('table.map tbody tr').length,
    groups: [...document.querySelectorAll('h2.sec')].map((h) => h.textContent.trim().slice(0, 28)),
  }))()`)
  console.log('页面信息:', JSON.stringify(info, null, 1))

  // 顶部区域（标题 + 规范 + 映射表）
  await send('Page.captureScreenshot', { format: 'png' }).then((r) => fs.writeFileSync(path.join(OUT, 'proto-top.png'), Buffer.from(r.data, 'base64')))
  // A 组（首页那批）：滚到 gA
  await ev(`document.getElementById('gA').scrollIntoView()`)
  await sleep(700)
  await send('Page.captureScreenshot', { format: 'png' }).then((r) => fs.writeFileSync(path.join(OUT, 'proto-groupA.png'), Buffer.from(r.data, 'base64')))
  // 首页样机特写
  await ev(`document.querySelectorAll('figure.dev')[0].scrollIntoView({block:'start'})`)
  await sleep(700)
  await send('Page.captureScreenshot', { format: 'png' }).then((r) => fs.writeFileSync(path.join(OUT, 'proto-home.png'), Buffer.from(r.data, 'base64')))
  // B 组开头（提醒中心）
  await ev(`document.getElementById('gB').scrollIntoView()`)
  await sleep(700)
  await send('Page.captureScreenshot', { format: 'png' }).then((r) => fs.writeFileSync(path.join(OUT, 'proto-groupB.png'), Buffer.from(r.data, 'base64')))

  try { chrome.kill() } catch { /* noop */ }
  process.exit(0)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
