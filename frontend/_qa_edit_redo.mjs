/**
 * 错题本「编辑 / 重做此题」迁移 · 端到端验证（本地 vite preview + CDP）
 * 链路：guest 注入一条错题 → 详情抽屉 → 编辑弹窗保存 → 重做此题自动进答题
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9750 + (process.pid % 300)
const OUTDIR = process.argv[2] || 'dist77'
const WEBPORT = 5960 + (process.pid % 300)
const WEB = 'http://127.0.0.1:' + WEBPORT

const ITEM = {
  id: 1758400000000001,
  question: '计算定积分 $\\int_0^1 x^2 dx$',
  attempt: '',
  subject: '高等数学',
  questionType: '计算题',
  answer: '$\\frac{1}{3}$',
  steps: [],
  keyBreakthrough: '',
  knowledgePoints: ['定积分'],
  knowledgeReview: '',
  extensions: [],
  diagnosis: '',
  streak: 0, quizCount: 0, correctCount: 0, mastered: false,
  reviewAt: 0, interval: 1, repetitions: 0,
  createdAt: new Date().toISOString(),
}

const viteBin = path.resolve('node_modules/vite/bin/vite.js')
const preview = spawn(process.execPath, [viteBin, 'preview', '--outDir', OUTDIR, '--port', String(WEBPORT), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}

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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_migrate_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 2, mobile: false })

  // 预注入一条错题（guest 空间）
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.wb__head')
  await ev(`localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify([${JSON.stringify(ITEM)}]))`)
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.wb__head')
  await sleep(600)

  // 1. 打开详情抽屉
  await ev(`document.querySelector('.wb__item, [class*=wb__] button, .zy-page')?.click?.()`)
  // 直接点第一个详情按钮/卡片
  const opened = await ev(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '详情')
    if (btn) { btn.click(); return 'btn' }
    return 'none'
  })()`)
  if (opened === 'none') {
    // 兜底：点列表卡片
    await ev(`document.querySelector('.wb__card, .wb__list > *')?.click?.()`)
  }
  await sleep(600)
  ok(await ev(`!!document.querySelector('.wb__drawer-panel')`), '详情抽屉打开')

  // 2. 抽屉 footer 有编辑/重做此题
  const foot = await ev(`(() => {
    const f = document.querySelector('.wb__drawer-foot')
    const labels = f ? [...f.querySelectorAll('button')].map((b) => b.textContent.trim()) : []
    return labels
  })()`)
  ok(foot.includes('编辑'), '抽屉有「编辑」按钮', foot)
  ok(foot.includes('重做此题'), '抽屉有「重做此题」按钮')

  // 3. 编辑弹窗：改知识点后保存
  await ev(`[...document.querySelectorAll('.wb__drawer-foot button')].find((b) => b.textContent.trim() === '编辑').click()`)
  await sleep(500)
  ok(await ev(`!!document.querySelector('.wb__edit-form')`), '编辑弹窗打开')
  await ev(`(() => {
    const inputs = document.querySelectorAll('.wb__edit-form input, .wb__edit-form textarea')
    // 顺序：题干 textarea / 答案 textarea / 知识点 input（最后一个是普通 input）
    const kp = [...inputs].find((i) => i.type === 'text' && i.value.includes('定积分'))
    if (kp) {
      kp.value = '定积分, 牛顿-莱布尼茨公式'
      kp.dispatchEvent(new Event('input', { bubbles: true }))
    }
    return true
  })()`)
  await ev(`[...document.querySelectorAll('.ui-modal button, [class*=modal] button')].find((b) => b.textContent.trim() === '保存').click()`)
  await sleep(500)
  const saved = await ev(`JSON.parse(localStorage.getItem('zhiyi_errorbook_v1'))[0].knowledgePoints`)
  ok(saved.includes('牛顿-莱布尼茨公式'), '编辑已写回错题本', saved)

  // 4. 重做此题：跳自测并自动进答题
  await ev(`[...document.querySelectorAll('.wb__drawer-foot button')].find((b) => b.textContent.trim() === '重做此题').click()`)
  await sleep(800)
  const quiz = await ev(`(() => ({
    url: location.pathname + location.search,
    answering: !!document.querySelector('.pr__input'),
    questionShown: document.body.textContent.includes('定积分'),
  }))()`)
  ok(quiz.url.includes('/practice/original') && quiz.url.includes('focus='), '跳转自测并带 focus 参数', quiz.url)
  ok(quiz.answering && quiz.questionShown, '自动进入答题且显示该题', quiz)

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '编辑/重做迁移验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
