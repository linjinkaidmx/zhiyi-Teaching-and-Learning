/**
 * 知识点快捷提问 · 端到端验证（离线自包含：本地 vite preview + CDP）
 * 用法：node _qa_kpchat.mjs [outDir]
 * 链路：首页推荐 pill → /chat?kp= → 候选问题 chips → 点一条填入输入框并挂引用 → 发送
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9499
const OUTDIR = process.argv[2] || 'dist66'
const WEBPORT = 5600 + (process.pid % 300)
const WEB = 'http://127.0.0.1:' + WEBPORT
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

let ws
let seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => {
  const id = ++seq
  ws.send(JSON.stringify({ id, method: m, params: p }))
  return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }))
}
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value

async function waitSel(sel, timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev('!!document.querySelector("' + sel + '")')) return true } catch { /* retry */ }
    await sleep(300)
  }
  return false
}

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_kp_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })

  section('1. 造真实错题（含知识点「条件概率」）')
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.home__body')
  await ev(`(() => {
    const now = new Date().toISOString()
    const book = [
      { id: 'w1', question: '袋中有 3 红 2 白，不放回取两次，求第二次取到红球的概率', subject: '概率论',
        knowledgePoints: ['条件概率'], quizCount: 3, correctCount: 0, mastered: false, reviewAt: 0, createdAt: now },
      { id: 'w2', question: '已知 P(A)=0.5，P(B|A)=0.4，求 P(AB)', subject: '概率论',
        knowledgePoints: ['条件概率'], quizCount: 2, correctCount: 0, mastered: false, reviewAt: 0, createdAt: now },
      { id: 'w3', question: '求 int *p[3] 的含义', subject: '数据结构',
        knowledgePoints: ['指针与数组'], quizCount: 1, correctCount: 0, mastered: false, reviewAt: 0, createdAt: now },
    ]
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify(book))
    return true
  })()`)

  section('2. 直接带 kp 进对话页（模拟首页点击）')
  await send('Page.navigate', { url: WEB + '/chat?kp=' + encodeURIComponent('条件概率') })
  await waitSel('.chat__suggests')
  await sleep(1500)
  const s1 = await ev(`(() => {
    const box = document.querySelector('.chat__suggests')
    const chips = [...document.querySelectorAll('.chat__suggests-list .ui-tag')]
    return {
      visible: !!box,
      count: chips.length,
      texts: chips.map((c) => c.textContent.trim()),
      head: (document.querySelector('.chat__suggests-head') || {}).textContent || '',
      detailVisible: !!document.querySelector('.chat__foot'),
      path: location.pathname + location.search,
    }
  })()`)
  console.log('  · 实际渲染 → ' + JSON.stringify(s1, null, 1))
  ok(s1.visible, '候选问题区出现（移动端也进详情区）')
  ok(s1.detailVisible, '输入区可见（不再只显示会话列表）')
  ok(s1.count >= 4, '至少 4 条候选问题', s1.count)
  ok(s1.head.includes('条件概率'), '标题点名该知识点', s1.head.slice(0, 40))
  ok(s1.texts.some((t) => t.includes('错了 2 次')), '含基于真实错题的诊断条', s1.texts)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'kpchat-suggests.png'), Buffer.from(shot.data, 'base64'))

  section('3. 点一条：填入输入框 + 挂上错题引用 + 收起')
  await ev(`document.querySelectorAll('.chat__suggests-list .ui-tag')[0].click()`)
  await sleep(700)
  const s2 = await ev(`(() => ({
    draft: (document.querySelector('.chat__textarea') || {}).value || '',
    pending: [...document.querySelectorAll('.chat__pending .ui-tag')].map((t) => t.textContent.trim()),
    suggestsGone: !document.querySelector('.chat__suggests'),
    search: location.search,
  }))()`)
  console.log('  · 点击后 → ' + JSON.stringify(s2, null, 1))
  ok(s2.draft.length > 0, '问题已填入输入框（可再编辑）', s2.draft)
  ok(s2.pending.length === 1, '自动挂了 1 道错题作为引用', s2.pending)
  ok(s2.suggestsGone === true, '候选问题已收起')
  ok(!s2.search.includes('kp='), 'URL 上的 kp 已清掉（刷新不再冒出）', s2.search)

  section('4. 发送后进入会话（本地无后端，只看消息是否落地）')
  await ev(`document.querySelector('.chat__input .ui-btn').click()`)
  await sleep(1500)
  const s3 = await ev(`(() => ({
    path: location.pathname,
    msgs: [...document.querySelectorAll('.chat__msg')].map((m) => m.getAttribute('data-role')),
    firstUser: (document.querySelector('.chat__msg[data-role="user"] .chat__plain') || {}).textContent || '',
    title: (document.querySelector('.chat__main-title') || {}).textContent || '',
  }))()`)
  console.log('  · 发送后 → ' + JSON.stringify(s3, null, 1))
  ok(s3.path.startsWith('/chat/'), '已创建并跳进会话', s3.path)
  ok(s3.msgs.includes('user'), '用户消息已落地', s3.msgs)
  ok(s3.firstUser.includes('条件概率'), '发出的问题就是候选的那条', s3.firstUser.slice(0, 30))
  ok(s3.title.includes('条件概率'), '会话标题用知识点名', s3.title)

  section('5. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '知识点快捷提问验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('脚本异常：', e); process.exit(1) })
