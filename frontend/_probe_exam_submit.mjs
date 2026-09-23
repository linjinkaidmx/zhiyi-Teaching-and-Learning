/**
 * 模拟考试·交卷环节诊断（线上环境）：组卷 → 作答 → 交卷 → 打印各阶段 DOM 与错误
 * 用法：QA_BASE=http://193.112.28.51:3300 node _probe_exam_submit.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9750 + (process.pid % 90)
const WEB = (process.env.QA_BASE || 'http://193.112.28.51:3300').replace(/\/$/, '')
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
let seq = 0
const pending = new Map()
const errors = []
const consoleMsgs = []
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev(expr)) return true } catch { /* retry */ }
    await sleep(700)
  }
  return false
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'probe_esub_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push((m.params?.exceptionDetails?.exception?.description || JSON.stringify(m.params)).slice(0, 300))
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      consoleMsgs.push((m.params.args || []).map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 200))
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })

  console.log('目标:', WEB)
  await send('Page.navigate', { url: WEB + '/more' })
  await sleep(1500)
  await ev(`(() => {
    localStorage.removeItem('zhiyi_exam_v1')
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify([{ id: 1, question: '错题', subject: '高等数学', answer: 'x', knowledgePoints: ['洛必达法则'], streak: 0, quizCount: 0, correctCount: 0, mastered: false, reviewAt: 0, interval: 1, repetitions: 0, createdAt: new Date().toISOString() }]))
    return true
  })()`)
  await send('Page.navigate', { url: WEB + '/exam/run?mode=choice' })
  await waitFor(`!!document.querySelector('.er__mode')`, 20000)
  await sleep(800)
  console.log('① 配置页就绪')

  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始考试')).click()`)
  console.log('② 已点开始考试，等组卷…')
  const gen = await waitFor(`!!document.querySelector('.er__option')`, 150000)
  console.log('   组卷完成:', gen)
  if (!gen) {
    console.log('   ERRORS:', errors)
    process.exit(1)
  }
  console.log('③ 答题页就绪，题干:', (await ev(`(document.querySelector('.er__q-text') || {}).textContent || ''`).then((s) => String(s).slice(0, 50))))

  // 覆盖 confirm（headless 下 window.confirm 会阻塞/返回 false）
  await ev(`window.confirm = () => true; window.alert = () => {}; true`)
  await ev(`(() => {
    const st = JSON.parse(localStorage.getItem('zhiyi_exam_v1') || '{}')
    const p = (st.papers || [])[0]
    p.answers = {}
    p.questions.forEach((q, i) => { if (i < p.questions.length - 3) p.answers[q.id] = 'A' })
    localStorage.setItem('zhiyi_exam_v1', JSON.stringify(st))
    return true
  })()`)
  const pid = await ev(`(() => { const st = JSON.parse(localStorage.getItem('zhiyi_exam_v1') || '{}'); return ((st.papers || [])[0] || {}).id })()`)
  await send('Page.navigate', { url: WEB + '/exam/run?paper=' + pid })
  await waitFor(`!!document.querySelector('.er__option')`, 30000)
  await sleep(900)
  await ev(`window.confirm = () => true; true`)
  console.log('④ 恢复作答，已答:', await ev(`document.querySelectorAll('.er__navdot.is-done').length`))

  const btnText = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('交卷')); return b ? b.textContent.trim() : '(找不到交卷按钮)' })()`)
  console.log('   交卷按钮:', btnText)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('交卷')); if (b) b.click(); return !!b })()`)
  console.log('⑤ 已点交卷')

  for (const stepName of ['grading', 'result']) {
    await sleep(2500)
    const st = await ev(`(() => ({
      loading: !!document.querySelector('.er__loading'),
      score: !!(document.querySelector('.er__score-num')),
      bar: !!document.querySelector('.er__bar'),
      toast: (document.querySelector('[class*=toast], .ui-toast') || {}).textContent || '',
      bodyTail: document.body.textContent.replace(/\\s+/g, ' ').slice(-120),
    }))()`)
    console.log(`   [${stepName}]`, JSON.stringify(st))
    if (st.score) break
  }
  await sleep(2000)
  const final = await ev(`(() => ({
    score: !!(document.querySelector('.er__score-num')),
    total: (document.querySelector('.er__score-num') || {}).textContent || '',
  }))()`)
  console.log('⑥ 最终:', JSON.stringify(final))
  if (errors.length) console.log('!! JS 错误:', errors)
  if (consoleMsgs.length) console.log('!! console:', consoleMsgs.slice(-8))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'exam-probe.png'), Buffer.from(shot.data, 'base64'))
  try { chrome.kill() } catch { /* noop */ }
  process.exit(0)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
