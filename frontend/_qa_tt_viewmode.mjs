/**
 * 课表查看/编辑双模式 + 首页课程小窗口 验证（本地 vite preview + CDP）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9350 + (process.pid % 120)
const OUTDIR = process.argv[2] || 'dist92'
const WEBPORT = 5750 + (process.pid % 120)
const WEB = 'http://127.0.0.1:' + WEBPORT

// 排课放在周三（今天周一，用于验证首页「今天没课」仍常驻）
const seed = {
  courses: [{ id: 'c1', name: '数据结构', teacher: '王老师', location: '教三302', color: '#3d5a8a', updatedAt: 1 }],
  timetable: [
    { id: 's1', courseId: 'c1', day: 3, slot: 3, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
    { id: 's2', courseId: 'c1', day: 3, slot: 4, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
    { id: 's3', courseId: 'c1', day: 3, slot: 5, location: '教三302', weeks: { type: 'every' }, updatedAt: 1 },
  ],
  exams: [], term: { startDate: '2026-09-01', totalWeeks: 20, updatedAt: 1 },
  deletedIds: [], deletedSlotIds: [], deletedExamIds: [],
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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ttmode_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })

  // ---------- 首页：小窗口常驻 + 可点
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.zy-page')
  await ev(`localStorage.setItem('zhiyi_schedule_v2', ${JSON.stringify(JSON.stringify(seed))})`)
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.today-row')
  await sleep(900)
  const home = await ev(`(() => {
    const card = document.querySelector('.today-row')
    return {
      exists: !!card,
      text: card ? card.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40) : '',
      emptyTip: !!document.querySelector('.today-row__empty'),
      hasViewBtn: !!(card && card.querySelector('.today-row__more')),
      pills: card ? card.querySelectorAll('.today-pill').length : 0,
      height: card ? Math.round(card.getBoundingClientRect().height) : 0,
    }
  })()`)
  console.log('  · 首页卡片 →', JSON.stringify(home))
  ok(home.exists, '「今日课程」卡片常驻显示（今天没课也在）')
  ok(home.emptyTip || home.text.includes('没课'), '今天没课时显示占位文案', home.text)
  ok(home.hasViewBtn, '卡片内有「查看课表」入口')
  ok(home.height > 0 && home.height <= 60, '卡片已瘦身为紧凑单行（高度 ≤ 60px）', home.height)

  // 移动端：卡片必须可见（此前沿用 .schedule 类被媒体查询 display:none 隐藏 —— bug 回归点）
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.today-row')
  await sleep(900)
  const mobileCard = await ev(`(() => {
    const c = document.querySelector('.today-row')
    if (!c) return { exists: false }
    const cs = getComputedStyle(c)
    const r = c.getBoundingClientRect()
    return { exists: true, display: cs.display, h: Math.round(r.height), w: Math.round(r.width) }
  })()`)
  console.log('  · 移动端卡片 →', JSON.stringify(mobileCard))
  ok(mobileCard.exists && mobileCard.display !== 'none' && mobileCard.h > 0, '【bug回归】移动端首页卡片可见（不再被隐藏）', mobileCard)

  // 切回桌面视口继续
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: WEB + '/' })
  await waitSel('.today-row')
  await sleep(700)

  await ev(`document.querySelector('.today-row').click()`)
  await sleep(900)
  ok((await ev(`location.pathname`)) === '/timetable', '点击卡片跳转课程表', await ev(`location.pathname`))

  // ---------- 课表：默认查看模式
  await waitSel('.tt__grid')
  await sleep(800)
  const view = await ev(`(() => ({
    plus: document.querySelectorAll('.tt__plus').length,
    cells: document.querySelectorAll('.tt__cell.has-course').length,
    editBtn: [...document.querySelectorAll('.tt__head-ops button')].map((b) => b.textContent.trim())[0],
    gridEditing: document.querySelector('.tt__grid').classList.contains('is-editing'),
  }))()`)
  console.log('  · 查看模式 →', JSON.stringify(view))
  ok(view.plus === 0, '查看模式：空格子不显示「＋」', view.plus)
  ok(view.cells >= 1, '课块正常显示', view.cells)
  ok(view.editBtn === '编辑', '头部有「编辑」按钮', view.editBtn)
  ok(!view.gridEditing, '默认不在编辑模式')

  // 点课块 → 详情弹窗
  await ev(`document.querySelector('.tt__cell.has-course').click()`)
  await sleep(700)
  const detail = await ev(`(() => {
    const d = document.querySelector('.tt__detail')
    return {
      open: !!d,
      text: d ? d.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120) : '',
      hasPeriods: !!document.querySelector('.tt__detail-list'),
      periods: [...document.querySelectorAll('.tt__detail-list li')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim()),
    }
  })()`)
  console.log('  · 详情 →', JSON.stringify({ text: detail.text, periods: detail.periods }))
  ok(detail.open, '查看模式点课块 → 弹出课程详情')
  ok(detail.text.includes('数据结构') && detail.text.includes('王老师') && detail.text.includes('教三302'), '详情含课程名/教师/教室')
  ok(!detail.text.includes('本节课'), '详情已移除「本节课」栏', detail.text)
  ok(detail.hasPeriods && detail.periods.length === 1, '详情列出全部上课时段（连续 3 节合并为 1 段）', detail.periods)
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '知道了').click()`)
  await sleep(500)

  // ---------- 切到编辑模式
  await ev(`[...document.querySelectorAll('.tt__head-ops button')].find((b) => b.textContent.trim() === '编辑').click()`)
  await sleep(700)
  const edit = await ev(`(() => ({
    plus: document.querySelectorAll('.tt__plus').length,
    btn: [...document.querySelectorAll('.tt__head-ops button')].map((b) => b.textContent.trim())[0],
    gridEditing: document.querySelector('.tt__grid').classList.contains('is-editing'),
  }))()`)
  console.log('  · 编辑模式 →', JSON.stringify(edit))
  ok(edit.plus > 0, '编辑模式：空格子显示「＋」', edit.plus)
  ok(edit.btn === '完成', '按钮变为「完成」', edit.btn)
  ok(edit.gridEditing, '网格标记为编辑态（课块虚线）')

  // 编辑模式点空格 → 排课弹窗
  await ev(`[...document.querySelectorAll('.tt__cell')].find((c) => !c.classList.contains('has-course')).click()`)
  await sleep(700)
  const addOpen = await ev(`!!document.querySelector('.tt__slot-range')`)
  ok(addOpen, '编辑模式点空格 → 打开排课弹窗')
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消').click()`)
  await sleep(500)

  // 完成 → 回查看模式
  await ev(`[...document.querySelectorAll('.tt__head-ops button')].find((b) => b.textContent.trim() === '完成').click()`)
  await sleep(700)
  const back = await ev(`(() => ({
    plus: document.querySelectorAll('.tt__plus').length,
    btn: [...document.querySelectorAll('.tt__head-ops button')].map((b) => b.textContent.trim())[0],
  }))()`)
  ok(back.plus === 0 && back.btn === '编辑', '点「完成」回到查看模式（＋ 消失）', back)

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '查看/编辑双模式验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
