/**
 * 全站深度 QA · 模块 E：自测出题补测 + 全页面遍历（崩溃/报错/溢出/主题切换）
 * 用法：node _qa_full_e.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP_PORT = 9060 + ((process.pid % 60) + Date.now() % 200)
const OUT = path.resolve(__dirname, '../.learnbuddy/_qa_full')
fs.mkdirSync(OUT, { recursive: true })
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const issues = []
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
const bug = (sev, mod, title, detail) => { issues.push({ sev, mod, title, detail }); console.log(`  !! [${sev}] ${mod} · ${title} :: ${detail}`) }

let ws, seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* */ } await sleep(500) }
  console.log('  · timeout: ' + label); return false
}
const waitSel = (sel, t = 15000) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, t, sel)
const clickText = (txt) => ev(`(() => { const b=[...document.querySelectorAll('button,label,a')].find(x=>x.textContent.trim().includes(${JSON.stringify(txt)})); if(!b) return false; b.click(); return true })()`)
const VISIBLE = `(el) => { const c = el.cloneNode(true); c.querySelectorAll('.katex-mathml,script,style').forEach(n=>n.remove()); return (c.textContent||'').replace(/\\s+/g,' ') }`

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_e_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 160))
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false })

  const goto = async (p, sel = '.zy-page') => {
    errors.length = 0
    await send('Page.navigate', { url: BASE + p }); await waitSel(sel, 20000); await sleep(1300)
  }

  console.log('\n===== 模块 E：自测补测 + 全页遍历 =====')

  // ---- E1 自测出题完整链路 ----
  console.log('\n[E1] 自测：原题复习 → 作答 → 判分')
  await send('Page.navigate', { url: BASE + '/' }); await waitSel('.zy-page', 20000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});'ok'`)
  await ev(`(() => {
    const item = { id: 'qaitemE', question: '栈的特点是____（先入后出/先入先出）', attempt: '', subject: '计算机', questionType: '简答',
      answer: '先入后出', steps: [], keyBreakthrough: '', knowledgePoints: ['栈'], knowledgeReview: '', extensions: [], diagnosis: '',
      followups: [], reteach: [], streak: 0, quizCount: 0, correctCount: 0, mastered: false, reviewAt: 0, interval: 1, repetitions: 0, courseId: '', createdAt: new Date().toISOString() }
    localStorage.setItem('zhiyi_errorbook_account_v1', JSON.stringify([item])); return 'ok'
  })()`)
  await goto('/wrongbook')
  await clickText('自测练习')
  await sleep(1800)
  await clickText('原题复习')
  await sleep(800)
  await clickText('开始练习')
  await sleep(2200)
  let txt = await ev(`(() => (${VISIBLE})(document.body))()`)
  ok(/栈的特点/.test(txt), 'E1-1 原题出题', txt.slice(0, 90))
  await ev(`(() => { const i=document.querySelector('textarea,input[type=text]:not([readonly])'); if(!i) return false; const d=Object.getOwnPropertyDescriptor(i.constructor.prototype,'value').set; d.call(i,'先入后出'); i.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)
  await sleep(400)
  await clickText('提交') || await clickText('下一题') || await clickText('检查')
  await sleep(1800)
  txt = await ev(`(() => (${VISIBLE})(document.body))()`)
  ok(/正确|答对|掌握|√|✓/.test(txt), 'E1-2 判分为正确', txt.match(/.{0,30}(正确|答对|掌握).{0,30}/)?.[0])

  // ---- E2 全页面遍历 ----
  console.log('\n[E2] 全页面遍历（桌面 1366）')
  const PAGES = [
    ['/', '首页'], ['/capture', '拍题'], ['/records', '学习记录'], ['/wrongbook', '错题学习'],
    ['/data', '学习数据'], ['/community', '社区'], ['/class', '班级'], ['/tools', '工具箱'],
    ['/course', '课程表'], ['/timetable', '课表'], ['/exams', '考试安排'], ['/exam', '模拟考试'],
    ['/chat', 'AI 对话'], ['/about', '关于'], ['/help', '帮助'], ['/me', '我的'], ['/no-such-page', '404页'],
  ]
  for (const [p, name] of PAGES) {
    await goto(p)
    const txt = await ev(`(() => (${VISIBLE})(document.body))()`)
    const overflow = await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 2`)
    const blank = txt.replace(/\s/g, '').length < 20
    const err = errors.filter((e) => /error|exception|failed/i.test(e)).slice(0, 2)
    const bad = blank || overflow || err.length
    if (bad) console.log(`  ✗ ${name}(${p}) blank=${blank} overflow=${overflow} err=${JSON.stringify(err)}`)
    else console.log(`  ✓ ${name}(${p})`)
    if (bad && !blank) bug(overflow ? 'P1' : 'P2', '页面遍历', `${name} ${p}`, JSON.stringify({ blank, overflow, err }))
    if (blank && p !== '/no-such-page') bug('P1', '页面遍历', `${name} ${p} 内容为空`, txt.slice(0, 60))
  }

  // ---- E3 暗色模式 ----
  console.log('\n[E3] 暗色模式')
  await goto('/')
  await ev(`document.documentElement.setAttribute('data-theme','dark'); localStorage.setItem('zhiyi_theme','dark'); 'ok'`)
  await sleep(1200)
  const bg = await ev(`getComputedStyle(document.body).backgroundColor`)
  const txtColor = await ev(`getComputedStyle(document.body).color`)
  console.log('  · dark 背景:', bg, '文字:', txtColor)
  const planet = await ev(`(() => { const p=document.querySelector('.hbg__planet'); if(!p) return 'no-el'; const s=getComputedStyle(p); return s.display })()`)
  ok(planet !== 'none' && planet !== 'no-el', 'E3-1 暗色星球可见', planet)
  await goto('/wrongbook')
  const wbBg = await ev(`getComputedStyle(document.body).backgroundColor`)
  console.log('  · dark 错题本背景:', wbBg)
  await ev(`document.documentElement.setAttribute('data-theme','light'); localStorage.setItem('zhiyi_theme','light'); 'ok'`)

  // ---- E4 弱网模拟（慢速） ----
  console.log('\n[E4] 弱网加载')
  await send('Network.enable')
  await send('Network.emulateNetworkConditions', { offline: false, latency: 800, downloadThroughput: 60 * 1024, uploadThroughput: 40 * 1024 })
  const t0 = Date.now()
  await goto('/')
  const loadMs = Date.now() - t0
  const okLoad = await ev(`document.body.textContent.length > 50`)
  ok(okLoad, `E4-1 弱网(60KB/s)首页可用，加载 ${loadMs}ms`)
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })

  console.log('\n[E5] 运行时错误汇总: ' + JSON.stringify(errors.slice(0, 8)))
  console.log(`\n===== 模块 E 结果：通过 ${pass}，失败 ${fail} =====`)
  console.log('ISSUES=' + JSON.stringify(issues))
  chrome.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
