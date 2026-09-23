/**
 * 全站深度 QA · 模块 B2：笔记 / 测试 / 权限 / 游客（线上 + CDP，带诊断输出）
 * 用法：node _qa_full_b2.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP_PORT = 9850 + ((process.pid % 60) + Date.now() % 200)
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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_b2_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  const goto = async (p, sel = '.zy-page') => { await send('Page.navigate', { url: BASE + p }); await waitSel(sel, 20000); await sleep(1200) }
  const enterClass = async () => {
    await goto('/class')
    await waitSel('.clsp', 15000)
    const c = await ev(`(() => { const c=[...document.querySelectorAll('.clsp__item,.clsp__card,.clsp__row,.clsp__class')].find(x=>x.textContent.includes('QA 测试班')); if(c){c.click(); return true} return false })()`)
    if (!c) console.log('  · 未找到班级卡片')
    await waitFor(`!!document.querySelector('.clsd')`, 15000, '班级详情')
    await sleep(1000)
  }
  const tab = async (name) => {
    const r = await ev(`(() => { const b=[...document.querySelectorAll('.ui-seg__btn')].find(x=>x.textContent.trim()===${JSON.stringify(name)}); if(b){b.click(); return true} return [...document.querySelectorAll('.ui-seg__btn')].map(x=>x.textContent.trim()) })()`)
    if (r !== true) console.log('  · tab 未命中，可用项:', JSON.stringify(r))
    await sleep(1200)
    return r === true
  }

  console.log('\n===== 模块 B2：笔记 / 测试 / 权限 / 游客 =====')

  // ---- B5 班级笔记 ----
  console.log('\n[B5] 班级笔记 → 学生存错题')
  await login('teacher')
  await enterClass()
  console.log('  · 当前 tab 项:', JSON.stringify(await ev(`[...document.querySelectorAll('.ui-seg__btn')].map(x=>x.textContent.trim())`)))
  await tab('笔记')
  const noteBtn = await clickText('发布笔记')
  console.log('  · 点发布笔记:', noteBtn)
  await waitSel('#note-title', 10000)
  console.log('  · 填标题:', await setId('note-title', '主定理速记'))
  console.log('  · 填内容:', await setId('note-content', '对 T(n)=aT(n/b)+f(n)，比较 f(n) 与 n^{log_b a}：若 f(n)=O(n^{log_b a-ε})，则 T(n)=Θ(n^{log_b a})。'))
  await sleep(500)
  const dis = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='发布笔记'); return b?b.disabled:'no-btn' })()`)
  console.log('  · 发布按钮 disabled:', dis)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='发布笔记'); if(b&&!b.disabled){b.click(); return true} return false })()`)
  await sleep(3000)
  const n1 = await ev(`document.body.textContent.includes('主定理速记')`)
  ok(n1, 'B5-1 笔记发布成功')
  const noteApi = JSON.parse(await api('/api/class/note/list', { token: ACC.teacher.token, class_id: ACC.class_id }))
  console.log('  · 笔记接口:', JSON.stringify(noteApi).slice(0, 160))
  await shot('B5_note_teacher.png')

  await login('student')
  await enterClass()
  await tab('笔记')
  await sleep(1200)
  ok(await ev(`document.body.textContent.includes('主定理速记')`), 'B5-2 学生可见笔记')
  const openedNote = await ev(`(() => { const r=[...document.querySelectorAll('.clsd__item')].find(x=>x.textContent.includes('主定理速记')); if(r){r.click(); return true} return false })()`)
  console.log('  · 打开笔记:', openedNote)
  await sleep(2000)
  const hasSave = await ev(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('保存到错题学习'))`)
  ok(hasSave, 'B5-3 笔记详情含「保存到错题学习」')
  await shot('B5_note_student.png')
  if (hasSave) {
    await clickText('保存到错题学习')
    await sleep(2500)
    await goto('/wrongbook')
    await sleep(1800)
    const inBook = await ev(`document.body.textContent.includes('主定理速记')`)
    ok(inBook, 'B5-4 笔记出现在错题本')
    const wbBare = await ev(`(() => { const t=(${VISIBLE})(document.body); return (t.match(/\\$[^$\\n]{1,60}\\$/g)||[]) })()`)
    ok((wbBare || []).length === 0, 'B5-5 错题本无裸 $ 公式', wbBare)
    await shot('B5_wrongbook.png')
  }

  // ---- B7 班级测试（老师自己出题，避免 AI 消耗） ----
  console.log('\n[B7] 班级测试（手动出题 → 学生答题 → 排名）')
  await login('teacher')
  await enterClass()
  await tab('测试')
  await clickText('发布测试')
  await waitSel('#t-title', 10000)
  console.log('  · 测试标题:', await setId('t-title', 'QA 小测：主定理'))
  await ev(`(() => { const b=[...document.querySelectorAll('.ui-seg__btn')].find(x=>x.textContent.trim()==='自己出题'); if(b){b.click(); return true} return false })()`)
  await sleep(800)
  // 添加一题
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/添加|新增|\\+/.test(x.textContent)); if(b){b.click(); return b.textContent.trim()} return 'none' })()`)
  await sleep(900)
  const qFields = await ev(`[...document.querySelectorAll('input,textarea')].map(e=>({id:e.id,ph:(e.placeholder||'').slice(0,24)}))`)
  console.log('  · 题目表单:', JSON.stringify(qFields.slice(0, 10)))
  await setId('q-stem', 'T(n)=2T(n/2)+O(n) 的时间复杂度是？')
  await setId('q-a', 'O(n log n)')
  await setId('q-b', 'O(n)')
  await setId('q-c', 'O(n^2)')
  await setId('q-d', 'O(log n)')
  await sleep(400)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='发布测试'); if(b&&!b.disabled){b.click(); return true} return false })()`)
  await sleep(3000)
  const tApi = JSON.parse(await api('/api/class/test/list', { token: ACC.teacher.token, class_id: ACC.class_id }))
  const tt = (tApi.tests || tApi.items || [])[0]
  ok(!!tt?.id, 'B7-1 测试发布成功', tt?.title)
  console.log('  · 测试接口:', JSON.stringify(tApi).slice(0, 200))

  console.log('\n[B8] 运行时错误: ' + JSON.stringify(errors.slice(0, 6)))
  console.log(`\n===== 模块 B2 结果：通过 ${pass}，失败 ${fail} =====`)
  console.log('ISSUES=' + JSON.stringify(issues))
  chrome.kill()
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
