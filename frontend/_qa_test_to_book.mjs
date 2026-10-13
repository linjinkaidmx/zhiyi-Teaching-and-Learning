/**
 * 验证：班级测试答错的题 → 勾选沉淀进个人错题本
 * 用法：node _qa_test_to_book.mjs   （打线上）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.QA_BASE || 'http://193.112.28.51:3300'
const CDP = 9240 + (process.pid % 60)
const OUT = path.resolve(__dirname, '../.learnbuddy/shots_' + Date.now())
fs.mkdirSync(OUT, { recursive: true })
const ACC = JSON.parse(fs.readFileSync(path.resolve(__dirname, '_qa_accounts.json'), 'utf-8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
const waitSel = async (sel, t = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return true } catch { /* */ } await sleep(400) } return false }
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.data, 'base64')) }

const api = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

async function main() {
  // 1) 造一场 3 题测试（2 选择 + 1 填空）
  const title = 'QA 错题沉淀验证-' + Date.now()
  const created = await api('/api/class/test/create', {
    token: ACC.teacher.token,
    class_id: ACC.class_id,
    title,
    duration_sec: 600,
    items: [
      { type: 'choice', question: '归并排序最坏时间复杂度是？', options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(log n)'], answer: 'A', score: 10 },
      { type: 'choice', question: '栈的存取特点是？', options: ['先进先出', '后进先出', '随机存取', '双端插入'], answer: 'B', score: 10 },
      { type: 'blank', question: '主定理中 a=2,b=2 时 n^{log_b a} = ____', answer: 'n', score: 10 },
    ],
  })
  if (!created.ok) { console.log('创建测试失败:', created); process.exit(1) }
  const tid = created.test.id
  console.log('测试已建:', title)

  // 2) 学生 UI 走一遍
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_t2b_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP + '/json/version')).ok) break } catch { /* */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.zy-page', 25000)
  await ev(`localStorage.setItem('zhiyi_account_token',${JSON.stringify(ACC.student.token)});localStorage.setItem('zhiyi_account_user',${JSON.stringify(ACC.student.nickname)});localStorage.setItem('zhiyi_setup_dismissed','1');'ok'`)
  // 清空错题本基线，便于断言本次新增
  await ev(`localStorage.setItem('zhiyi_errorbook_account_v1','[]');'ok'`)

  await send('Page.navigate', { url: `${BASE}/class/${ACC.class_id}/test/${tid}` })
  await waitSel('.zy-page', 25000)
  await sleep(1500)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('开始答题')); if(b) b.click(); return !!b })()`)
  await sleep(1800)

  // 第 1 题答对（A）、第 2 题答错（选 A，正确 B）、第 3 题答错（填 x）
  await ev(`(() => {
    const cards = [...document.querySelectorAll('.trun__card')].filter(c => c.querySelector('.trun__q'))
    if (cards[0]) { const o = cards[0].querySelectorAll('.trun__opt'); if (o[0]) o[0].click() }
    if (cards[1]) { const o = cards[1].querySelectorAll('.trun__opt'); if (o[0]) o[0].click() }
    if (cards[2]) { const inp = cards[2].querySelector('.trun__blank'); if (inp) { const d=Object.getOwnPropertyDescriptor(inp.constructor.prototype,'value').set; d.call(inp,'x'); inp.dispatchEvent(new Event('input',{bubbles:true})) } }
    return cards.length
  })()`)
  await sleep(800)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('一键提交')); if(b) b.click(); return !!b })()`)
  await sleep(1200)
  // 可能弹出「还有未作答」确认
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/确定|确认/.test(x.textContent)); if(b) b.click(); return !!b })()`)
  await sleep(2500)

  const panel = await ev(`(() => {
    const head = [...document.querySelectorAll('.t-h3')].find(x => x.textContent.includes('答错的'))
    const rows = document.querySelectorAll('.trun__wrong-row')
    const cbs = [...document.querySelectorAll('.trun__wrong-cb')]
    const btn = [...document.querySelectorAll('button')].find(x => x.textContent.includes('加入错题本'))
    return {
      hasPanel: !!head,
      headText: head ? head.textContent.trim() : '',
      rows: rows.length,
      checked: cbs.filter(c => c.checked).length,
      btnText: btn ? btn.textContent.trim() : '',
      firstRow: rows[0] ? rows[0].textContent.replace(/\\s+/g, ' ').trim().slice(0, 80) : '',
    }
  })()`)
  console.log('  ·', JSON.stringify(panel))
  ok(panel.hasPanel, '出现「答错的题」面板', panel.headText)
  ok(panel.rows === 2, '列出 2 道错题', panel.rows)
  ok(panel.checked === 2, '默认全选', panel.checked)
  ok(/我的答案/.test(panel.firstRow) && /正确答案/.test(panel.firstRow), '展示我的答案与正确答案', panel.firstRow)
  await shot('t2b_panel.png')

  // 3) 加入错题本
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('加入错题本')); if(b) b.click(); return !!b })()`)
  await sleep(1500)
  const after = await ev(`(() => {
    const book = JSON.parse(localStorage.getItem('zhiyi_errorbook_account_v1') || '[]')
    const done = [...document.querySelectorAll('.t-h3')].some(x => x.textContent.includes('已加入错题本'))
    return { book, bookCount: book.length, titles: book.map(b => (b.question || '').slice(0, 24)), sources: book.map(b => b.source), done }
  })()`)
  console.log('  ·', JSON.stringify(after))
  // 学生账号登录后云端同步会把已有错题拉回来，所以只断言「本次新增的部分」
  const added = after.book.filter((b) => b.source === '班级测试')
  ok(added.length >= 2, '本次新增 2 道（来源=班级测试）', { total: after.bookCount, added: added.length })
  ok(added.some((b) => /栈的存取特点/.test(b.question)) && added.some((b) => /主定理/.test(b.question)), '新增的两道正是答错的题', added.map((b) => b.question.slice(0, 18)))
  ok(after.done, '面板切换为「已加入错题本」')
  await shot('t2b_done.png')

  // 4) 错题本页面能看到（渲染 + 可复习）
  await send('Page.navigate', { url: BASE + '/wrongbook' })
  await waitSel('.zy-page', 25000)
  await sleep(1800)
  const wb = await ev(`(() => ({
    cards: document.querySelectorAll('.wb__card').length,
    text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 120),
  }))()`)
  ok(wb.cards >= 2, '错题本页面显示这两道题', wb.cards)
  await shot('t2b_wrongbook.png')


  // 5) 重复入本去重：新建同题测试，再答错同一题 → 不应产生重复条目
  console.log('\n===== 重复入本去重 =====')
  const t2 = await api('/api/class/test/create', {
    token: ACC.teacher.token, class_id: ACC.class_id, title: 'QA 去重验证-' + Date.now(), duration_sec: 600,
    items: [{ type: 'choice', question: '栈的存取特点是？', options: ['先进先出', '后进先出', '随机存取', '双端插入'], answer: 'B', score: 10 }],
  })
  const before = await ev(`JSON.parse(localStorage.getItem('zhiyi_errorbook_account_v1') || '[]').length`)
  await send('Page.navigate', { url: BASE + '/class/' + ACC.class_id + '/test/' + t2.test.id })
  await waitSel('.zy-page', 25000)
  await sleep(1500)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('开始答题')); if(b) b.click(); return !!b })()`)
  await sleep(1600)
  await ev(`(() => { const o=document.querySelectorAll('.trun__opt'); if(o[0]) o[0].click(); return !!o.length })()`)
  await sleep(600)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('一键提交')); if(b) b.click(); return !!b })()`)
  await sleep(1000)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/确定|确认/.test(x.textContent)); if(b) b.click(); return !!b })()`)
  await sleep(2200)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('加入错题本')); if(b) b.click(); return !!b })()`)
  await sleep(1500)
  const dedup = await ev(`(() => {
    const book = JSON.parse(localStorage.getItem('zhiyi_errorbook_account_v1') || '[]')
    const same = book.filter((b) => (b.question || '').includes('栈的存取特点'))
    return { total: book.length, sameTitle: same.length, attempt: same[0] ? same[0].attempt : '' }
  })()`)
  console.log('  ·', JSON.stringify({ before, ...dedup }))
  ok(dedup.total === before, '总数未增加（未产生重复条目）', { before, after: dedup.total })
  ok(dedup.sameTitle === 1, '同题干在错题本里只有一条', dedup.sameTitle)
  ok(dedup.attempt === 'A', '条目已更新为最新作答', dedup.attempt)

  console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
  console.log('截图: ' + OUT)
  chrome.kill()
  process.exit(fail > 0 ? 1 : 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(2) })
