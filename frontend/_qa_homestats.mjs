/**
 * 首页真实数据 · 端到端验证（离线自包含：本地 vite preview + CDP）
 * 用法：node _qa_homestats.mjs [outDir]
 * 做法：注册真实账号 → 注入真实错题与学习记录 → 刷新，核对首页数字与数据源一致。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9497
const OUTDIR = process.argv[2] || 'dist63'
const WEBPORT = 5400 + (process.pid % 300)
const REMOTE = process.env.QA_BASE || ''
const WEB = 'http://127.0.0.1:' + WEBPORT
const BASE = REMOTE || WEB
const OUT = path.resolve('.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = REMOTE ? null : spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })

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
  if (!REMOTE) {
    for (let i = 0; i < 60; i += 1) {
      try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
      await sleep(400)
    }
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_hs_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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

  section('1. 注册真实账号（走生产构建的真实接口）')
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.home__body')
  const reg = await ev(`(async () => {
    const nick = 'hs' + Math.random().toString(36).slice(2, 8)
    let resp
    try {
      resp = await fetch('/api/account/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nick, password: 'Test12345', password_confirm: 'Test12345', client_id: 'qa' }),
      })
    } catch (e) { return { ok: false, stage: 'fetch', err: String(e) } }
    const text = await resp.text()
    let r = null
    try { r = JSON.parse(text) } catch (e) { r = null }
    if (!r) return { ok: false, stage: 'json', status: resp.status, head: String(text).slice(0, 160) }
    if (!r.ok) return { ok: false, stage: 'api', status: resp.status, err: String(r.error || '').slice(0, 120), nick }
    localStorage.setItem('zhiyi_account_token', (r.data && r.data.token) || r.token)
    localStorage.setItem('zhiyi_account_user', nick)
    return { ok: true, nick }
  })()`)
  ok(reg.ok, '注册成功并写入会话', reg)

  section('2. 注入真实错题与学习记录（账号空间）')
  const seed = await ev(`(() => {
    const now = Date.now()
    const start = new Date(); start.setHours(0,0,0,0)
    const noon = start.getTime() + 12 * 3600 * 1000
    const book = [
      { id: 'qa1', question: '指针数组是什么', subject: '数据结构', knowledgePoints: ['指针与数组'],
        quizCount: 4, correctCount: 1, mastered: false, reviewAt: 0, createdAt: new Date(now).toISOString() },
      { id: 'qa2', question: 'int *p[3]', subject: '数据结构', knowledgePoints: ['指针与数组'],
        quizCount: 2, correctCount: 0, mastered: false, reviewAt: 0, createdAt: new Date(now).toISOString() },
      { id: 'qa3', question: '换元积分', subject: '高等数学', knowledgePoints: ['定积分换元'],
        quizCount: 3, correctCount: 2, mastered: false, reviewAt: now + 86400000, createdAt: new Date(now).toISOString() },
    ]
    const records = [
      { id: 'r1', type: 'explain', title: '指针数组', minutes: 7, createdAt: noon },
      { id: 'r2', type: 'quiz', title: '自测', minutes: 3, createdAt: noon },
      { id: 'r3', type: 'followup', title: '追问', minutes: 1, createdAt: noon },
      { id: 'r4', type: 'explain', title: '昨天的题', minutes: 30, createdAt: start.getTime() - 3600 * 1000 },
    ]
    localStorage.setItem('zhiyi_errorbook_account_v1', JSON.stringify(book))
    localStorage.setItem('zhiyi_records_account_v1', JSON.stringify(records))
    return { book: book.length, records: records.length }
  })()`)
  ok(seed.book === 3 && seed.records === 4, '已注入 3 道错题 / 4 条记录', seed)

  section('3. 刷新后核对首页数字')
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.home__body')
  await sleep(1200)
  const shown = await ev(`(() => {
    const txt = (document.body.textContent || '')
    const num = (label) => {
      const i = txt.indexOf(label)
      if (i < 0) return null
      const m = txt.slice(Math.max(0, i - 30), i).match(/(\\d+)\\s*$/) || txt.slice(i, i + 20).match(/(\\d+)/)
      return m ? Number(m[1]) : null
    }
    const nums = [...document.querySelectorAll('.home__metric')].map((el) => el.textContent.replace(/\\s+/g, ' ').trim())
    return {
      metrics: nums,
      hasRecommend: txt.includes('指针与数组'),
      summary: (document.querySelector('.home__summary-text') || {}).textContent || '',
      reviewTitle: (document.querySelector('.review .ui-card__title') || {}).textContent || '',
      bye: !!document.querySelector('.zy-bye'),
    }
  })()`)
  console.log('  · 首页实际渲染 → ' + JSON.stringify(shown, null, 1))

  const nums = (shown.metrics || []).join(' ')
  ok(/11/.test(nums), '今日时长 = 11 分钟（7+3+1，昨天的 30 分钟不计入）', shown.metrics)
  ok(/2 题|2题/.test(nums), '完成题目 = 2（explain + quiz，追问不算）', shown.metrics)
  ok(/3 题|3题/.test(nums), '待复习 = 3（未掌握即在复习池，与自测页同口径）', shown.metrics)
  ok(shown.hasRecommend, '推荐知识点取自真实薄弱点「指针与数组」')
  ok(/错题 3 道/.test(shown.summary), '学习总结用真实统计', shown.summary)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'mobile-home-real.png'), Buffer.from(shot.data, 'base64'))

  section('4. 空账号（新用户）不显示假数据')
  await ev(`(() => { localStorage.removeItem('zhiyi_errorbook_account_v1'); localStorage.removeItem('zhiyi_records_account_v1'); return true })()`)
  await send('Page.navigate', { url: BASE + '/' })
  await waitSel('.home__body')
  await sleep(1200)
  const emptyState = await ev(`(() => {
    const txt = document.body.textContent || ''
    return {
      metrics: [...document.querySelectorAll('.home__metric')].map((el) => el.textContent.replace(/\\s+/g, ' ').trim()),
      hasSummary: !!document.querySelector('.home__summary-text'),
      hasRecommend: txt.includes('AI 推荐知识点'),
    }
  })()`)
  console.log('  · 空账号渲染 → ' + JSON.stringify(emptyState))
  ok(emptyState.metrics.every((m) => /^0/.test(m)), '三项全为 0（不是 42/6/9）', emptyState.metrics)
  ok(emptyState.hasSummary === false, '无错题时不显示总结')
  ok(emptyState.hasRecommend === false, '无错题时不显示推荐')

  section('5. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '首页真实数据验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('脚本异常：', e); process.exit(1) })
