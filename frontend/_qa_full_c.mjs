/**
 * 全站深度 QA · 模块 C：测试 UI 答题 / 自测 / 社区 / 游客 / 移动端（线上 + CDP）
 * 用法：node _qa_full_c.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP_PORT = 9900 + ((process.pid % 60) + Date.now() % 200)
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
const setId = async (id, val) => ev(`(() => { const e=document.getElementById(${JSON.stringify(id)}); if(!e) return 'no-el'; const d=Object.getOwnPropertyDescriptor(e.constructor.prototype,'value').set; d.call(e,${JSON.stringify(val)}); e.dispatchEvent(new Event('input',{bubbles:true})); return e.value.length })()`)
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64')) }
const api = (p, body) => ev(`fetch(${JSON.stringify(BASE + p)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(body)})}).then(r=>r.json()).then(j=>JSON.stringify(j)).catch(e=>'ERR:'+e.message)`)

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_c_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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

  const login = async (role) => {
    const a = ACC[role]
    await send('Page.navigate', { url: BASE + '/' }); await waitSel('.zy-page', 20000)
    await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(a.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(a.nickname)});'ok'`)
    return a
  }
  const logout = async () => { await send('Page.navigate', { url: BASE + '/' }); await waitSel('.zy-page', 20000); await ev(`localStorage.removeItem('zhiyi_account_token');localStorage.removeItem('zhiyi_account_user');'ok'`) }
  const goto = async (p, sel = '.zy-page') => { await send('Page.navigate', { url: BASE + p }); await waitSel(sel, 20000); await sleep(1200) }

  console.log('\n===== 模块 C：测试 UI / 自测 / 社区 / 游客 / 移动端 =====')

  // ---- C1 班级测试 UI 答题 ----
  console.log('\n[C1] 班级测试 UI（第二场测试，学生 UI 答题）')
  await login('teacher')
  const mk = JSON.parse(await api('/api/class/test/create', {
    token: ACC.teacher.token, class_id: ACC.class_id, title: 'QA UI 答题测', duration_sec: 600,
    items: [
      { type: 'choice', question: '归并排序最坏时间复杂度？', options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(1)'], answer: 'A', score: 10 },
      { type: 'blank', question: '快速排序平均空间复杂度为 O(log n)？（填 对/错）', answer: '对', score: 10 },
    ],
  }))
  const tid2 = mk.test?.id
  ok(!!tid2, 'C1-1 老师可创建第二场测试')
  await login('student')
  await goto('/class/' + ACC.class_id)
  await waitFor(`!!document.querySelector('.clsd')`, 15000)
  await ev(`(() => { const b=[...document.querySelectorAll('.ui-seg__btn')].find(x=>x.textContent.trim()==='测试'); if(b) b.click(); return 1 })()`)
  await sleep(1400)
  const row = await ev(`(() => { const r=[...document.querySelectorAll('.clsd__item,button')].find(x=>x.textContent.includes('QA UI 答题测')); if(r){r.click(); return true} return false })()`)
  ok(row, 'C1-2 学生可从列表进入测试')
  await waitFor(`!!document.querySelector('.zy-page')`, 15000)
  await sleep(1500)
  const introTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  ok(/开始|限时|共 \d+ 题|10 分/.test(introTxt), 'C1-3 测试介绍页正常', introTxt.slice(-80))
  await shot('C1_intro.png')
  const startBtn = await clickText('开始')
  ok(startBtn, 'C1-4 点击开始')
  await sleep(1800)
  const runTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  ok(/归并排序/.test(runTxt), 'C1-5 题干渲染')
  const bare = (runTxt.match(/\$[^$\n]{1,60}\$/g) || [])
  ok(bare.length === 0, 'C1-6 答题页无裸 $ 公式', bare.slice(0, 4))
  const hasTimer = await ev(`/\\d{1,2}:\\d{2}/.test(document.body.textContent) || /剩余|倒计时/.test(document.body.textContent)`)
  ok(hasTimer, 'C1-7 倒计时显示')
  // 选择 A
  await ev(`(() => { const b=[...document.querySelectorAll('button')].filter(x=>x.textContent.trim()==='A'||x.textContent.trim().startsWith('O(n log n)')); if(b.length){b[0].click(); return true} return false })()`)
  await sleep(400)
  await setId && await ev(`(() => { const inp=[...document.querySelectorAll('input[type=text]')].find(i=>!i.value); if(inp){const d=Object.getOwnPropertyDescriptor(inp.constructor.prototype,'value').set; d.call(inp,'对'); inp.dispatchEvent(new Event('input',{bubbles:true})); return true} return false })()`)
  await sleep(500)
  const submit = await clickText('一键提交') || await clickText('交卷') || await clickText('提交')
  ok(submit, 'C1-8 一键提交')
  await sleep(3000)
  const scoreTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  ok(/20|得分|分数/.test(scoreTxt), 'C1-9 出分', scoreTxt.match(/.{0,30}(20|得分).{0,30}/)?.[0])
  ok(/第 ?1|排名|榜首|gold/.test(scoreTxt) || !!document.querySelector('.rank'), 'C1-10 排名展示')
  await shot('C1_result.png')

  // ---- C2 AI 自测（注入错题 → 纯前端判分） ----
  console.log('\n[C2] 错题自测（SRS 判分）')
  await goto('/wrongbook')
  await ev(`(() => {
    const item = { id: 'qaitem1', question: '快速排序平均时间复杂度是什么？', attempt: '', subject: '计算机', questionType: '简答',
      answer: 'O(n log n)', steps: [], keyBreakthrough: '', knowledgePoints: ['排序'], knowledgeReview: '', extensions: [], diagnosis: '',
      followups: [], reteach: [], streak: 0, quizCount: 0, correctCount: 0, mastered: false, reviewAt: 0, interval: 1, repetitions: 0, courseId: '', createdAt: new Date().toISOString() }
    for (const k of ['zhiyi_errorbook_account_v1','zhiyi_errorbook_v1']) {
      const raw = localStorage.getItem(k); if (!raw) continue
      try { const d = JSON.parse(raw); if (Array.isArray(d)) { d.unshift(item); localStorage.setItem(k, JSON.stringify(d)) } } catch {}
    }
    return 'ok'
  })()`)
  await send('Page.navigate', { url: BASE + '/wrongbook' })
  await waitSel('.zy-page', 20000)
  await sleep(1500)
  const seen = await ev(`document.body.textContent.includes('快速排序平均时间复杂度')`)
  ok(seen, 'C2-1 注入的错题出现在错题本')
  const quizEntry = await clickText('自测练习') || await clickText('开始')
  await sleep(1800)
  const quizTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  ok(/快速排序/.test(quizTxt), 'C2-2 自测出题含错题', quizTxt.slice(0, 80))
  await shot('C2_quiz.png')

  // ---- C3 社区发帖（含公式） ----
  console.log('\n[C3] 社区发帖与公式渲染')
  await goto('/community')
  await waitSel('.comm', 15000)
  await clickText('发帖')
  await sleep(1200)
  const hasEditor = await ev(`!!document.querySelector('textarea')`)
  ok(hasEditor, 'C3-1 发帖编辑器打开')
  await ev(`(() => { const t=document.querySelector('textarea'); if(!t) return false; const d=Object.getOwnPropertyDescriptor(t.constructor.prototype,'value').set; d.call(t,'已知 $P(A)=0.3$，求 $P(\\\\overline{A})$。'); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)
  await sleep(400)
  const pub = await clickText('发布') || await clickText('提交')
  await sleep(2500)
  const postTxt = await ev(`(() => { const p=[...document.querySelectorAll('.comm__post-q, .comm__post')].find(x=>x.textContent.includes('已知')); return p ? p.innerHTML.includes('katex') : 'no-post' })()`)
  ok(postMsg(postTxt), 'C3-2 帖子公式渲染为 KaTeX', postTxt)
  function postMsg(v) { return v === true }

  // ---- C4 游客权限 ----
  console.log('\n[C4] 游客访问受保护页面')
  await logout()
  for (const p of ['/records', '/wrongbook', '/class', '/community', '/data']) {
    await send('Page.navigate', { url: BASE + p })
    await waitSel('.zy-page', 15000)
    await sleep(900)
    const txt = await ev(`(() => (${VISIBLE})(document.body))()`)
    const blocked = /登录|注册|游客|请先|先登录|去登录/.test(txt)
    console.log(`  · ${p} → ${blocked ? '有登录引导' : '直接展示(需人工确认是否合理)'} | ${txt.slice(0, 60)}`)
    if (!blocked && ['/records', '/wrongbook', '/class'].includes(p)) bug('P2', '游客权限', `游客可直接打开 ${p}`, '未跳转登录，游客可见功能页（需确认是否设计如此）')
  }

  // ---- C5 移动端视口 ----
  console.log('\n[C5] 移动端视口（390×844）')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await login('student')
  await goto('/')
  await sleep(1500)
  const hOverflow = await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 2`)
  ok(!hOverflow, 'C5-1 首页无横向滚动')
  await goto('/wrongbook')
  const wbOverflow = await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 2`)
  ok(!wbOverflow, 'C5-2 错题本无横向滚动')
  await goto('/class/' + ACC.class_id)
  const clsOverflow = await ev(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 2`)
  ok(!clsOverflow, 'C5-3 班级页无横向滚动')
  await shot('C5_mobile.png')
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false })

  console.log('\n[C6] 运行时错误: ' + JSON.stringify(errors.slice(0, 8)))
  console.log(`\n===== 模块 C 结果：通过 ${pass}，失败 ${fail} =====`)
  console.log('ISSUES=' + JSON.stringify(issues))
  chrome.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
