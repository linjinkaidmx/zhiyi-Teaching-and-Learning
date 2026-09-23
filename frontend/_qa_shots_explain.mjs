/**
 * 补截：真实跑步讲解流程，截"流式讲解 + 公式渲染"画面（PPT 核心素材）
 * 用法：node _qa_shots_explain.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const OUT = 'E:/知一2.0/参赛素材/screenshots'
const CDP = 9490 + (process.pid % 20)
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const waitSel = async (sel, t = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true } catch { /* */ } await sleep(400) } return false }
const shot = async (name, { mobile = false } = {}) => {
  await send('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000, deviceScaleFactor: 2, mobile })
  await sleep(600)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  const p = path.join(OUT, name + '.png')
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'))
  console.log('  ✓', name + '.png', Math.round(fs.statSync(p).size / 1024) + 'KB')
}

const QUESTION = '用主定理求 T(n) = 2T(n/2) + O(n) 的时间复杂度，写出推导过程。'

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ex_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false })

  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.zy-page', 30000); await sleep(3000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});localStorage.setItem('zhiyi_setup_dismissed','1');localStorage.setItem('zhiyi_theme','light');'ok'`)

  // 拍照搜题页：填文字题目并提交
  await send('Page.navigate', { url: BASE + '/capture' })
  await waitSel('.zy-page', 30000); await sleep(2500)
  await shot('02b-capture-input')

  // 先展开「手动输入题目文字」，再填题干
  await ev(`(() => { const t=[...document.querySelectorAll('button')].find(x=>/手动输入题目文字/.test(x.textContent||'')); if(t) t.click(); return !!t })()`)
  await sleep(1000)
  const filled = await ev(`(() => {
    const ta = [...document.querySelectorAll('textarea, input[type=text]')].find((x) => x.offsetParent)
    if (!ta) return false
    const setter = Object.getOwnPropertyDescriptor(ta.constructor.prototype, 'value').set
    setter.call(ta, ${JSON.stringify(QUESTION)})
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  console.log('  · 填入题目:', filled)
  await sleep(700)
  await shot('02c-capture-filled')

  // 点提交/讲解
  const submitted = await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /开始识别|识别整图/.test(x.textContent || '') && !x.disabled)
    if (b) { b.click(); return b.textContent.trim() }
    return ''
  })()`)
  console.log('  · 点击按钮:', JSON.stringify(submitted))

  // 等讲解渲染出来（流式进行中先截一张，完成后另截）
  let streaming = false
  for (let i = 0; i < 24; i++) {
    await sleep(1200)
    streaming = await ev(`/正在|生成中|思考中/.test(document.body.innerText)`)
    if (streaming) break
  }
  await shot('04a-explain-streaming')

  // 等讲解完成（出现"换个讲法/追问"这类控件，或正文变长）
  let done = false
  const t0 = Date.now()
  while (Date.now() - t0 < 150000) {
    await sleep(2500)
    done = await ev(`(() => {
      const txt = document.body.innerText
      return /换个讲法|追问|知识点|解题步骤|思路/.test(txt) && txt.length > 900
    })()`)
    if (done) break
  }
  console.log('  · 讲解完成:', done)
  await sleep(1800)
  await shot('04-explain-top')
  await ev(`window.scrollTo(0, 700)`); await sleep(1200)
  await shot('04b-explain-formula')
  await ev(`window.scrollTo(0, document.body.scrollHeight * 0.55)`); await sleep(1200)
  await shot('04c-explain-steps')

  chrome.kill()
  console.log('\n讲解截图完成')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
