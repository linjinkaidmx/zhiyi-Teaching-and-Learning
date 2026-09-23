/**
 * 批次3 真实链路验证：讲解流式（真模型 → 服务端增量解析 → 前端逐字段上屏 → 最终结构化）
 * 用法：node _check_explain_stream.mjs
 * 注意：会真实调用一次讲解模型（线上配了 Key）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9422
const BASE = 'http://193.112.28.51:3300'
const userDir = path.join(os.tmpdir(), 'exp_check_' + process.pid)
fs.mkdirSync(userDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'], { stdio: 'ignore' })

let ws
let seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (expr, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise })
  return r.result?.value
}

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
    if (m.method === 'Runtime.exceptionThrown') errors.push('异常: ' + (m.params?.exceptionDetails?.exception?.description || '').slice(0, 160))
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      errors.push('console.error: ' + (m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 160))
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })

  // 1) 先到首页设 localStorage（注入一条待讲解错题）
  await send('Page.navigate', { url: BASE + '/?v=43' })
  await sleep(4500)
  const seeded = await ev(`(() => {
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify([{
      id: 900001, question: '计算定积分 $\\\\int_0^1 x^2\\\\,dx$', answer: '$\\\\frac{1}{3}$',
      result: null, mastered: false, quizCount: 0, correctCount: 0, createdAt: Date.now(),
      subject: '高等数学', questionType: '计算题', knowledgePoints: ['定积分']
    }]))
    return true
  })()`)
  console.log('注入错题:', seeded)

  // 2) 打开讲解页（flowStore 为空 → 从错题本找回并重新讲解 → 触发流式）
  await send('Page.navigate', { url: BASE + '/q/900001?v=43' })
  await sleep(4000)

  let sawStreamRows = 0
  let sawStreamText = ''
  let streamSamples = 0
  let finalDoc = false
  let finalInfo = null
  for (let i = 1; i <= 150; i += 1) {
    await sleep(1500)
    const s = await ev(`(() => {
      const rows = [...document.querySelectorAll('.explain__stream-row')]
      const doc = document.querySelector('.explain__doc')
      const loading = document.querySelector('.explain__loading')
      const err = document.querySelector('.explain__loading, main')?.innerText || ''
      const first = rows[0]
      return {
        rows: rows.length,
        firstLabel: first ? (first.querySelector('.explain__stream-label')?.innerText || '') : '',
        firstLen: first ? (first.querySelector('.explain__stream-text')?.innerText || '').length : 0,
        caret: !!document.querySelector('.ai-caret'),
        doc: !!doc,
        loading: !!loading,
        answer: doc ? (doc.innerText || '').slice(0, 60) : '',
        errText: /失败|错误/.test(err) ? err.slice(0, 120) : '',
      }
    })()`)
    if (s.rows > 0) {
      streamSamples += 1
      if (s.rows > sawStreamRows) sawStreamRows = s.rows
      if (s.firstLen > sawStreamText.length) sawStreamText = 'x'.repeat(s.firstLen)
      if (streamSamples <= 3 || s.rows > sawStreamRows) {
        console.log(`  t+${(i * 1.5).toFixed(1)}s 行数=${s.rows} 首行="${s.firstLabel}"(${s.firstLen}字) caret=${s.caret} 成品=${s.doc}`)
      }
    }
    if (s.doc) {
      finalDoc = true
      finalInfo = s
      break
    }
    if (!s.loading && !s.rows && i > 6) {
      console.log('  页面既没在加载也没有流式行:', s.errText || '(无错误文案)')
      break
    }
  }

  console.log('\n=== 结论 ===')
  console.log('流式阶段是否出现逐字段内容：', sawStreamRows > 0 ? `是（最多 ${sawStreamRows} 行）` : '否')
  console.log('采样到流式的轮次：', streamSamples)
  console.log('最终结构化稿是否渲染：', finalDoc ? '是' : '否')
  if (finalInfo) console.log('成品开头:', finalInfo.answer.replace(/\s+/g, ' '))
  console.log('控制台错误:', errors.length ? errors.slice(0, 3) : '无')

  await sleep(1200)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const out = 'E:/知一2.0/.learnbuddy/_p9_shots2/explain-stream.png'
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log('截图:', out)
}

main()
  .catch((e) => console.error('脚本异常:', e.message))
  .finally(() => {
    try { ws?.close() } catch { /* 忽略 */ }
    chrome.kill()
  })
