/**
 * 清理后冒烟：逐页打开主要路由，断言页面渲染正常且无 JS 错误
 * 用法：node _qa_smoke.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP = 9420 + (process.pid % 40)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

const ROUTES = [
  ['/', '首页'],
  ['/wrongbook', '错题学习'],
  ['/practice/quick', '自测练习'],
  ['/data', '学习数据'],
  ['/records', '学习记录'],
  ['/achievements', '成就殿堂'],
  ['/tools', '学习工具'],
  ['/tools?tool=debug', '代码诊断'],
  ['/timetable', '课程表'],
  ['/exam', '模拟考试'],
  ['/exams', '考试安排'],
  ['/community', '知一社区'],
  ['/me', '我的'],
  ['/more', '旧「更多」页路由'],
  ['/capture', '拍照搜题'],
  ['/chat', 'AI 讲题对话'],
  ['/class', '班级课堂'],
  ['/help', '帮助与反馈'],
  ['/about', '产品介绍'],
]

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_sm_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  const errors = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {}
      errors.push(String((d.exception && (d.exception.description || d.exception.value)) || d.text || '').split('\n')[0].slice(0, 120))
    }
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: BASE + '/' })
  await sleep(3500)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});localStorage.setItem('zhiyi_setup_dismissed','1');'ok'`)

  console.log('\n===== 逐页冒烟 =====')
  for (const [route, name] of ROUTES) {
    errors.length = 0
    await send('Page.navigate', { url: BASE + route })
    await sleep(2600)
    const st = await ev(`(() => {
      const app = document.querySelector('.zy-page, .zy-shell, #app > *')
      const txt = document.body.innerText.replace(/\\s+/g, ' ').trim()
      return {
        mounted: !!app,
        len: txt.length,
        blank: txt.length < 30,
        is404: /页面不存在/.test(txt),
        title: txt.slice(0, 40),
      }
    })()`)
    const clean = st.mounted && !st.blank && !st.is404 && errors.length === 0
    ok(clean, `${route}  ${name}`, { mounted: st.mounted, len: st.len, is404: st.is404, err: errors.slice(0, 1) })
    if (route === '/data' || route === '/wrongbook') {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(OUT, 'smoke_' + route.replace(/[/?=]/g, '_') + '.png'), Buffer.from(r.data, 'base64'))
    }
  }

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图: ' + OUT)
  chrome.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
