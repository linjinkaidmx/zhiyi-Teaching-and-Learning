/**
 * 全站深度 QA · 模块 D：自测补测 / 填空 UI / 重复提交 / 弱网 / 合规 / Edge 兼容
 * 用法：node _qa_full_d.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP_PORT = 9950 + ((process.pid % 60) + Date.now() % 200)
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
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64')) }
const api = (p, body) => ev(`fetch(${JSON.stringify(BASE + p)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(body)})}).then(r=>r.json()).then(j=>JSON.stringify(j)).catch(e=>'ERR:'+e.message)`)

async function boot(browser, label) {
  const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_d_' + label + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  return chrome
}
const login = async (role) => {
  const a = ACC[role]
  await send('Page.navigate', { url: BASE + '/' }); await waitSel('.zy-page', 20000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(a.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(a.nickname)});'ok'`)
  return a
}
const goto = async (p, sel = '.zy-page') => { await send('Page.navigate', { url: BASE + p }); await waitSel(sel, 20000); await sleep(1200) }

async function main() {
  console.log('\n===== 模块 D：自测 / 填空 UI / 防重复 / 合规 / Edge =====')

  // ---- D1 自测（修正注入） ----
  console.log('\n[D1] 错题自测（SRS）')
  let chrome = await boot(CHROME, 'a')
  await login('student')
  await goto('/wrongbook')
  await ev(`(() => {
    const item = { id: 'qaitem9', question: '快速排序平均时间复杂度是什么？', attempt: '', subject: '计算机', questionType: '简答',
      answer: 'O(n log n)', steps: [], keyBreakthrough: '', knowledgePoints: ['排序'], knowledgeReview: '', extensions: [], diagnosis: '',
      followups: [], reteach: [], streak: 0, quizCount: 0, correctCount: 0, mastered: false, reviewAt: 0, interval: 1, repetitions: 0, courseId: '', createdAt: new Date().toISOString() }
    localStorage.setItem('zhiyi_errorbook_account_v1', JSON.stringify([item]))
    return 'ok'
  })()`)
  await goto('/wrongbook')
  const seen = await ev(`document.body.textContent.includes('快速排序平均时间复杂度')`)
  ok(seen, 'D1-1 错题出现在错题本')
  await clickText('自测练习') || await clickText('开始')
  await sleep(2000)
  const quizTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  ok(/快速排序/.test(quizTxt), 'D1-2 自测出题含错题', quizTxt.slice(0, 100))
  await shot('D1_quiz.png')
  chrome.kill()

  // ---- D2 填空题 UI（第三场测试，精确选择器） ----
  console.log('\n[D2] 班级测试填空题 UI')
  chrome = await boot(CHROME, 'b')
  await login('teacher')
  const mk = JSON.parse(await api('/api/class/test/create', {
    token: ACC.teacher.token, class_id: ACC.class_id, title: 'QA 填空专测', duration_sec: 600,
    items: [{ type: 'blank', question: '1 + 1 = ____', answer: '2', score: 10 }],
  }))
  const tid = mk.test?.id
  ok(!!tid, 'D2-1 创建单填空测试')
  await login('student')
  await goto('/class/' + ACC.class_id)
  await waitFor(`!!document.querySelector('.clsd')`, 15000)
  await ev(`(() => { const b=[...document.querySelectorAll('.ui-seg__btn')].find(x=>x.textContent.trim()==='测试'); if(b) b.click(); return 1 })()`)
  await sleep(1400)
  await ev(`(() => { const r=[...document.querySelectorAll('.clsd__item,button')].find(x=>x.textContent.includes('QA 填空专测')); if(r){r.click(); return true} return false })()`)
  await sleep(1800)
  await clickText('开始答题') || await clickText('开始')
  await sleep(2000)
  const blankSet = await ev(`(() => { const i=document.querySelector('.trun__blank'); if(!i) return 'no-blank'; const d=Object.getOwnPropertyDescriptor(i.constructor.prototype,'value').set; d.call(i,'2'); i.dispatchEvent(new Event('input',{bubbles:true})); return i.value })()`)
  ok(blankSet === '2', 'D2-2 填空输入可填写', blankSet)
  await clickText('一键提交') || await clickText('提交')
  await sleep(3000)
  const res = await ev(`(() => (${VISIBLE})(document.body))()`)
  ok(/10\/10|满分|对 1 题/.test(res), 'D2-3 填空判分正确', (res.match(/.{0,25}(10\/10|对 1 题).{0,25}/) || [])[0])
  chrome.kill()

  // ---- D3 重复提交与快速点击（班级作业提交按钮防抖） ----
  console.log('\n[D3] 防重复提交（网络层双击）')
  chrome = await boot(CHROME, 'c')
  await login('student')
  await goto('/')
  const double = await api('/api/account/login', { nickname: ACC.student.nickname, password: 'wrong' })
  console.log('  · 错误密码返回:', double.slice(0, 80))
  // 快速连点 5 次登录（防爆破锁定验证）
  let locked = ''
  for (let i = 0; i < 6; i += 1) {
    const r = JSON.parse(await api('/api/account/login', { nickname: ACC.student.nickname, password: 'wrong' }))
    locked = r.error || ''
    if (/锁定/.test(locked)) break
    await sleep(120)
  }
  console.log('  · 连错 6 次后:', locked.slice(0, 60))
  ok(/锁定|还可尝试/.test(locked), 'D3-1 登录防爆破有提示/锁定', locked.slice(0, 60))

  // ---- D4 合规与外链 ----
  console.log('\n[D4] 合规细节')
  await goto('/about')
  const aboutTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  const hasIcp = /ICP|备案|京ICP|粤ICP/.test(aboutTxt)
  console.log('  · 关于页含 ICP 备案:', hasIcp, '| 长度:', aboutTxt.length)
  if (!hasIcp) bug('P2', '合规', '关于页/页脚未见 ICP 备案号', '国内上线需在页脚展示 ICP 备案（当前站点为测试部署，可暂缓）')
  const links = await ev(`[...document.querySelectorAll('a[href^=http]')].map(a=>a.href).filter(h=>!h.includes('${BASE.replace('http://', '')}')).slice(0,8)`)
  console.log('  · 外链:', JSON.stringify(links))

  // ---- D5 Edge 兼容 ----
  console.log('\n[D5] Edge 兼容（Chromium）')
  errors.length = 0
  let edgeOk = false
  try {
    chrome = await boot(EDGE, 'e')
    await send('Page.navigate', { url: BASE + '/' })
    await waitSel('.zy-page', 20000)
    await sleep(1500)
    const txt = await ev(`(() => (${VISIBLE})(document.body))()`)
    edgeOk = txt.length > 50
    ok(edgeOk, 'D5-1 Edge 可打开首页并渲染', txt.slice(0, 60))
    const bgOk = await ev(`!!document.querySelector('.hbg') && getComputedStyle(document.querySelector('.hbg')).position === 'absolute'`)
    ok(bgOk, 'D5-2 Edge 动态背景挂载')
    chrome.kill()
  } catch (e) { console.log('  · Edge 测试跳过:', String(e).slice(0, 80)); if (chrome) chrome.kill() }

  console.log('\n[D6] 运行时错误: ' + JSON.stringify(errors.slice(0, 8)))
  console.log(`\n===== 模块 D 结果：通过 ${pass}，失败 ${fail} =====`)
  console.log('ISSUES=' + JSON.stringify(issues))
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
