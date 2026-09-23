/**
 * 全站深度 QA · 模块 B：班级 / 作业 / 笔记 / 测试 / 权限（线上 + CDP）
 * 用法：node _qa_full_b.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP_PORT = 9800 + ((process.pid % 60) + Date.now() % 200)
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
const setId = async (id, val) => ev(`(() => { const e=document.getElementById(${JSON.stringify(id)}); if(!e) return false; const d=Object.getOwnPropertyDescriptor(e.constructor.prototype,'value').set; d.call(e,${JSON.stringify(val)}); e.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64')) }
const api = (p, body) => ev(`fetch(${JSON.stringify(BASE + p)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(body)})}).then(r=>r.json()).then(j=>JSON.stringify(j)).catch(e=>'ERR:'+e.message)`)

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_fullb_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  const goto = async (p, sel = '.zy-page') => { await send('Page.navigate', { url: BASE + p }); await waitSel(sel, 20000); await sleep(1100) }
  const enterClass = async () => {
    await goto('/class')
    await waitSel('.clsp', 15000)
    await ev(`(() => { const c=[...document.querySelectorAll('.clsp__item,.clsp__card,.clsp__row,.clsp__class')].find(x=>x.textContent.includes('QA 测试班')); if(c) c.click(); return !!c })()`)
    await waitFor(`!!document.querySelector('.clsd')`, 15000, '班级详情')
    await sleep(900)
  }
  const tab = async (name) => { await ev(`(() => { const b=[...document.querySelectorAll('.ui-segmented button,.ui-seg button,button')].find(x=>x.textContent.trim()===${JSON.stringify(name)}); if(b){b.click(); return true} return false })()`); await sleep(1000) }

  console.log('\n===== 模块 B：班级 / 作业 / 笔记 / 测试 =====')
  // ---- B2 老师布置作业 ----
  console.log('\n[B2] 老师布置作业（表单校验 + 含公式内容）')
  await login('teacher')
  await enterClass()
  await tab('作业')
  await clickText('布置作业')
  await waitSel('#hw-title', 10000)
  // 校验：空标题时按钮应禁用
  const dis0 = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().includes('发布作业')); return b ? b.disabled : 'no-btn' })()`)
  ok(dis0 === true, 'B2-1 空标题时「发布作业」按钮禁用', dis0)
  await setId('hw-title', 'QA 作业：主定理与递推式')
  const dis1 = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().includes('发布作业')); return b ? b.disabled : 'no-btn' })()`)
  ok(dis1 === true, 'B2-2 仅标题无内容时仍禁用', dis1)
  await setId('hw-content', '用主定理求 T(n)=2T(n/2)+O(n) 的时间复杂度，写出推导过程。')
  await setId('hw-ref', '采分点：写出 a=2,b=2，n^{log_b a}=n，比较 f(n)=O(n)，结论 Θ(n log n)。')
  await sleep(400)
  const dis2 = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().includes('发布作业')); return b ? b.disabled : 'no-btn' })()`)
  ok(dis2 === false, 'B2-3 标题+内容齐全后可发布', dis2)
  await clickText('发布作业')
  await sleep(3000)
  const hwList = JSON.parse(await api('/api/homework/list', { token: ACC.teacher.token, class_id: ACC.class_id }))
  const hw = (hwList.homeworks || [])[0]
  ok(!!hw?.id, 'B2-4 作业创建成功', hw?.title)
  const HWID = hw?.id

  // ---- B3 学生提交 ----
  console.log('\n[B3] 学生提交作业')
  await login('student')
  await enterClass()
  await tab('作业')
  const opened = await ev(`(() => { const r=[...document.querySelectorAll('.clsd__item')].find(x=>x.textContent.includes('QA 作业')); if(!r) return false; r.click(); return true })()`)
  ok(opened, 'B3-1 学生可打开作业')
  await waitFor(`!!document.querySelector('.hwd')`, 15000, '作业详情页')
  await sleep(1200)
  const ta = await ev(`[...document.querySelectorAll('.hwd textarea')].map(e=>e.placeholder).slice(0,5)`)
  console.log('  · 作答框:', JSON.stringify(ta))
  await ev(`(() => { const t=document.querySelector('.hwd textarea'); if(!t) return false; const d=Object.getOwnPropertyDescriptor(t.constructor.prototype,'value').set; d.call(t,'由主定理，a=2,b=2，n^{log_b a}=n，f(n)=O(n)，故 T(n)=Θ(n log n)。'); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)
  await sleep(400)
  const subBtn = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/提交作业|提交/.test(x.textContent)&&!x.disabled); return b?b.textContent.trim():'none' })()`)
  console.log('  · 提交按钮:', subBtn)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/提交作业/.test(x.textContent)&&!x.disabled); if(b){b.click(); return true} return false })()`)
  await sleep(3500)
  const st = await ev(`document.body.textContent.includes('已提交') || document.body.textContent.includes('待批改')`)
  ok(st, 'B3-2 提交后状态更新为已提交/待批改')

  // ---- B4 老师批改 ----
  console.log('\n[B4] AI 批改（真实 1 次）')
  await login('teacher')
  await goto('/class/' + ACC.class_id + '/homework/' + HWID)
  await waitFor(`!!document.querySelector('.hwd')`, 20000, '作业详情')
  await sleep(1500)
  const gc = await clickText('AI 批改')
  ok(gc, 'B4-1 点击 AI 批改')
  const graded = await waitFor(`/优秀|良好|及格|需加强/.test(document.body.textContent) && /重新批改/.test(document.body.textContent)`, 150000, '批改完成')
  ok(graded, 'B4-2 批改完成并出等级')
  await sleep(2000)
  const fbTxt = await ev(`(() => (${VISIBLE})(document.body))()`)
  const fbBare = (fbTxt.match(/\$[^$\n]{1,60}\$/g) || [])
  ok(fbBare.length === 0, 'B4-3 批改反馈区无裸 $ 公式', fbBare.slice(0, 5))
  const fbTex = (fbTxt.match(/\\(frac|sqrt|alpha|beta|cdot|Theta)/g) || [])
  ok(fbTex.length === 0, 'B4-4 批改反馈区无原始 TeX', fbTex.slice(0, 5))
  await shot('B4_grade.png')
  // 学生侧查看分数
  await login('student')
  await goto('/class/' + ACC.class_id)
  await waitFor(`!!document.querySelector('.clsd')`, 15000)
  await tab('作业')
  await sleep(1000)
  const stuScore = await ev(`(() => { const r=[...document.querySelectorAll('.clsd__item')].find(x=>x.textContent.includes('QA 作业')); return r ? r.textContent.replace(/\\s+/g,' ').trim().slice(0,80) : 'none' })()`)
  console.log('  · 学生侧作业行:', stuScore)
  ok(/已批|分/.test(stuScore), 'B4-5 学生侧可见批改分数', stuScore)

  // ---- B5 班级笔记 ----
  console.log('\n[B5] 班级笔记 → 学生存错题')
  await login('teacher')
  await enterClass()
  await tab('笔记')
  await clickText('发布笔记')
  await waitSel('#note-title', 10000)
  await setId('note-title', '主定理速记')
  await setId('note-content', '对 T(n)=aT(n/b)+f(n)，比较 f(n) 与 n^{log_b a}：若 f(n)=O(n^{log_b a-ε})，则 T(n)=Θ(n^{log_b a})。')
  await sleep(400)
  await clickText('发布笔记')
  await sleep(3000)
  ok(await ev(`document.body.textContent.includes('主定理速记')`), 'B5-1 笔记发布成功')

  await login('student')
  await enterClass()
  await tab('笔记')
  await sleep(1200)
  ok(await ev(`document.body.textContent.includes('主定理速记')`), 'B5-2 学生可见笔记')
  await ev(`(() => { const r=[...document.querySelectorAll('.clsd__item')].find(x=>x.textContent.includes('主定理速记')); if(r){r.click(); return true} return false })()`)
  await sleep(1800)
  const hasSave = await ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('保存到错题学习'))`)
  ok(hasSave, 'B5-3 笔记详情含「保存到错题学习」')
  await clickText('保存到错题学习')
  await sleep(2500)
  await goto('/wrongbook')
  await sleep(1600)
  ok(await ev(`document.body.textContent.includes('主定理速记')`), 'B5-4 笔记出现在错题本')
  const wbBare = await ev(`(() => { const t=(${VISIBLE})(document.body); return (t.match(/\\$[^$\\n]{1,60}\\$/g)||[]) })()`)
  ok((wbBare || []).length === 0, 'B5-5 错题本无裸 $ 公式', wbBare)
  await shot('B5_wrongbook.png')

  console.log('\n[B6] 运行时错误: ' + JSON.stringify(errors.slice(0, 6)))
  console.log(`\n===== 模块 B 结果：通过 ${pass}，失败 ${fail} =====`)
  console.log('ISSUES=' + JSON.stringify(issues))
  chrome.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
