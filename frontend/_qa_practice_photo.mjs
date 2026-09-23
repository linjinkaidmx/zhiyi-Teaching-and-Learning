/**
 * 自测拍照作答 · 端到端验证（走线上真实模型：转录 + 批改）
 * 用法：QA_BASE=http://193.112.28.51:3300 node _qa_practice_photo.mjs
 * 链路：guest 注入错题 → 原题复习 → 相册上传作答图 → 自动转录填入 → AI 判分
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9500 + (process.pid % 500)
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })
const B64 = fs.readFileSync(path.join(OUT, 'qa_answer.b64'), 'utf8').trim()

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

/** 轮询直到 expression 为真值 */
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev(expr)) return true } catch { /* retry */ }
    await sleep(1000)
  }
  console.log('  · timeout waiting: ' + label)
  return false
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_prphoto_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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

  section('1. guest 注入 1 道错题（1+1=2）')
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

  section('2. 进入原题复习，开始练习')
  await send('Page.navigate', { url: BASE + '/practice/original' })
  await waitSel('.pr__config')
  const startOk = await ev(`(() => {
    const btns = [...document.querySelectorAll('.pr__config button')]
    const b = btns.find((x) => x.textContent.includes('开始练习'))
    if (!b) return false
    b.click()
    return true
  })()`)
  ok(startOk, '点击「开始练习」')
  await waitSel('.pr__answer')

  section('3. 上传手写作答图 → 自动转录')
  const uploaded = await ev(`(() => new Promise((resolve) => {
    const b64 = "${B64}"
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i)
    const file = new File([arr], 'answer.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const inputs = document.querySelectorAll('.pr__answer input[type=file]')
    if (inputs.length < 2) { resolve('no-inputs'); return }
    const input = inputs[1] // 第二个是相册上传
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    resolve('ok')
  }))()`)
  ok(uploaded === 'ok', '塞入图片并触发 change', uploaded)

  // 真实转录（识别位 turbo 实测 ~14s，放宽到 90s）
  const filled = await waitFor(
    `(() => { const ta = document.querySelector('.pr__input'); return ta && ta.value.length > 0 })()`,
    90000, 'textarea 被转录填入',
  )
  const state = await ev(`(() => {
    const ta = document.querySelector('.pr__input')
    return { text: ta ? ta.value : '', hasShot: !!document.querySelector('.pr__shot img'),
      status: (document.querySelector('.pr__shot-status') || {}).textContent || '' }
  })()`)
  console.log('  · 转录文本 → ' + JSON.stringify(state.text))
  ok(filled, '转录结果自动填入作答框')
  ok(state.hasShot, '作答照片缩略图显示')
  ok((state.status || '').includes('已识别'), '状态提示「已识别填入」', state.status)
  ok(state.text.includes('2'), '转录内容含答案 2', state.text)
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'practice-photo-filled.png'), Buffer.from(shot1.data, 'base64'))

  section('4. AI 判分（真实批改位）')
  const clicked = await ev(`(() => {
    const btns = [...document.querySelectorAll('.pr__answer button')]
    const b = btns.find((x) => x.textContent.includes('AI 判分'))
    if (!b || b.disabled) return 'btn-missing-or-disabled'
    b.click()
    return 'clicked'
  })()`)
  ok(clicked === 'clicked', '点击「AI 判分」', clicked)
  const judged = await waitFor(
    `!!document.querySelector('.pr__verdict')`,
    150000, '批改结果区出现',
  )
  const verdict = await ev(`(() => {
    const v = document.querySelector('.pr__verdict')
    const head = (v && v.querySelector('.t-h3')) || {}
    return { ok: !!v, verdict: head.textContent || '', body: v ? v.textContent.slice(0, 80) : '' }
  })()`)
  ok(judged && verdict.ok, '批改结果区出现', verdict.body)
  ok(['回答正确', '部分正确', '回答错误'].includes(verdict.verdict), 'verdict 文案合法', verdict.verdict)
  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'practice-photo-verdict.png'), Buffer.from(shot2.data, 'base64'))

  section('5. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '自测拍照作答验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
