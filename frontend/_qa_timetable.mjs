/**
 * 课程表重做版 · CDP 验证（修正：先设学期→排课→再查 14 节网格）
 * 用法：node _qa_timetable.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9489
const BASE = 'http://193.112.28.51:3300'
const userDir = path.join(os.tmpdir(), 'qa_tt_' + process.pid)
fs.mkdirSync(userDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'], { stdio: 'ignore' })
let ws; let seq = 0; const pending = new Map(); const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value
let pass = 0; let fail = 0
const ok = (c, label, extra) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }
const sec = (t) => console.log('\n' + t)

async function waitDevtools() {
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return } catch { /* retry */ } await sleep(250) }
  throw new Error('devtools 未就绪')
}

async function main() {
  await waitDevtools()
  const t = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || 'exception').slice(0, 140))
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') errors.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 140))
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })

  sec('1. 未设学期 → 引导 + 设置按钮')
  await send('Page.navigate', { url: BASE + '/timetable?v=51' })
  await sleep(3500)
  const r1 = await ev(`(() => ({
    hasGuide: document.body.textContent.includes('先设置学期'),
    hasSetTermBtn: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('设置学期')),
  }))()`)
  ok(r1.hasGuide, '未设学期时显示引导')
  ok(r1.hasSetTermBtn, '有「设置学期」按钮')

  sec('2. 设置学期 → 显示第几周')
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('设置学期')); if (b) b.click(); return !!b })()`)
  await sleep(600)
  await ev(`(() => {
    const d = document.querySelector('input[type=date]')
    const n = document.querySelector('input[type=number]')
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    if (d) { s.call(d, '2026-09-07'); d.dispatchEvent(new Event('input', { bubbles: true })) }
    if (n) { s.call(n, '20'); n.dispatchEvent(new Event('input', { bubbles: true })) }
    return !!d
  })()`)
  await sleep(400)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '保存'); if (b) b.click(); return !!b })()`)
  await sleep(800)
  const head = await ev(`(() => (document.querySelector('.tt__head')?.textContent || '').replace(/\\s+/g, ' '))()`)
  ok(head.includes('本周第') && head.includes('周'), '设置后显示「本周第 X 周」', head)

  sec('3. 排第一节课（内联建课）')
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('排第一节课')); if (b) b.click(); return !!b })()`)
  await sleep(600)
  const modalOk = await ev(`(() => ({
    inputs: document.querySelectorAll('.tt__form input').length,
    hasTeacher: document.body.textContent.includes('老师'),
    hasLocation: document.body.textContent.includes('教室'),
    hasWeeks: document.body.textContent.includes('上课周数'),
  }))()`)
  ok(modalOk.inputs >= 3, '排课弹窗有课程名/老师/教室三个输入框', modalOk.inputs)
  ok(modalOk.hasWeeks, '排课弹窗含「上课周数」选择')
  await ev(`(() => {
    const inputs = [...document.querySelectorAll('.tt__form input')]
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    if (inputs[0]) { s.call(inputs[0], '高等数学'); inputs[0].dispatchEvent(new Event('input', { bubbles: true })) }
    if (inputs[1]) { s.call(inputs[1], '王老师'); inputs[1].dispatchEvent(new Event('input', { bubbles: true })) }
    if (inputs[2]) { s.call(inputs[2], '教三 302'); inputs[2].dispatchEvent(new Event('input', { bubbles: true })) }
    return inputs.length
  })()`)
  await sleep(400)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '添加'); if (b) b.click(); return !!b })()`)
  await sleep(1000)

  sec('4. 排课后：14 节网格 + 课程上格')
  const r4 = await ev(`(() => ({
    slots: document.querySelectorAll('.tt__slot').length,
    days: [...document.querySelectorAll('.tt__day')].map((d) => d.textContent).join(','),
    cells: document.querySelectorAll('.tt__cell.has-course').length,
    hasCourse: document.body.textContent.includes('高等数学'),
    hasTeacher: document.body.textContent.includes('王老师'),
    hasLocation: document.body.textContent.includes('教三 302'),
  }))()`)
  ok(r4.slots === 14, '渲染 14 个节次', r4.slots)
  ok(r4.days.includes('周六') && r4.days.includes('周日'), '含周六周日表头', r4.days)
  ok(r4.cells >= 1 && r4.hasCourse, '排课成功，格子显示课程', r4)
  ok(r4.hasLocation, '格子显示教室')

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('E:/知一2.0/.learnbuddy/_qa_imgs/tt-grid.png', Buffer.from(shot.data, 'base64'))
  console.log('  （已截图 tt-grid.png）')

  sec('5. 课程页：无 AI 推荐、有教室字段')
  await send('Page.navigate', { url: BASE + '/course?v=51' })
  await sleep(2500)
  const r5 = await ev(`(() => ({ hasAi: document.body.textContent.includes('AI 推荐课程') }))()`)
  ok(!r5.hasAi, '课程页已移除 AI 推荐')
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('新增课程')); if (b) b.click(); return !!b })()`)
  await sleep(500)
  const r5b = await ev(`(() => ({ hasLocation: document.body.textContent.includes('教室'), hasTerm: document.body.textContent.includes('学期') }))()`)
  ok(r5b.hasLocation && !r5b.hasTerm, '新增课程弹窗含教室、无学期', r5b)

  sec('6. 考试页渲染')
  await send('Page.navigate', { url: BASE + '/exams?v=51' })
  await sleep(2500)
  const r6 = await ev(`(() => ({
    hasTitle: document.body.textContent.includes('考试安排'),
    hasAdd: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('新增考试')),
  }))()`)
  ok(r6.hasTitle && r6.hasAdd, '考试页渲染 + 新增考试按钮', r6)

  sec('7. 控制台错误')
  ok(errors.length === 0, '全程无未捕获异常/console.error', errors.slice(0, 3))

  console.log('\n' + '='.repeat(46))
  console.log(fail === 0 ? `课程表重做版验证通过（${pass} 项）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
  process.exitCode = fail === 0 ? 0 : 1
}

main().catch((e) => console.error('脚本异常:', e.message)).finally(() => { try { ws?.close() } catch {} chrome.kill() })
