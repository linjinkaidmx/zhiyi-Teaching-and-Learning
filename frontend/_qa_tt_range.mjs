/**
 * 课表「节次范围排课 + 合并显示」验证（本地 vite preview + CDP）
 * 链路：空课表 → 「排第一节课」→ 选起止节次 1~3 → 保存 → 断言生成 3 格、仅首格有课名；
 *       再排 1~2 节（第 1 节已占）→ 断言被阻止并给出冲突提示
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9900 + (process.pid % 200)
const OUTDIR = process.argv[2] || 'dist80'
const WEBPORT = 5990 + (process.pid % 200)
const WEB = 'http://127.0.0.1:' + WEBPORT

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

/** 填课程名（UiInput → .ui-field__input） */
const fillName = (name) => ev(`(() => {
  const inp = document.querySelector('.tt__form .ui-field__input')
  if (!inp) return false
  inp.value = '${name}'
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`)

/** 设起止节次（UiSelect → .ui-select__native） */
const setRange = (a, b) => ev(`(() => {
  const ss = [...document.querySelectorAll('.tt__slot-range .ui-select__native')]
  if (ss.length < 2) return false
  ss[0].value = '${a}'; ss[0].dispatchEvent(new Event('change', { bubbles: true }))
  ss[1].value = '${b}'; ss[1].dispatchEvent(new Event('change', { bubbles: true }))
  return true
})()`)

const clickAdd = () => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '添加')
  if (!b) return false
  b.click(); return true
})()`)

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_tt_range_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false })

  // 注入「已设置学期、无课程」的课表数据（跳过学期设置交互）
  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.zy-page')
  await ev(`(() => {
    Object.keys(localStorage).filter((k) => k.startsWith('zhiyi_schedule') || k.startsWith('zhiyi_timetable')).forEach((k) => localStorage.removeItem(k))
    localStorage.setItem('zhiyi_schedule_v2', JSON.stringify({
      courses: [], timetable: [], exams: [],
      term: { startDate: '2026-09-01', totalWeeks: 20, updatedAt: Date.now() },
      deletedIds: { courses: [], timetable: [], exams: [] },
    }))
    return true
  })()`)
  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.zy-page')
  await sleep(900)

  // 空态 → 点「排第一节课」
  const opened = await ev(`(() => {
    const cell = [...document.querySelectorAll('.tt__cell')].find((c) => !c.classList.contains('has-course'))
    if (cell) { cell.click(); return 'cell' }
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('排第一节课'))
    if (btn) { btn.click(); return 'empty-cta' }
    return 'none'
  })()`)
  ok(opened !== 'none', '打开排课弹窗', opened)
  await sleep(700)

  const modal = await ev(`(() => {
    const box = document.querySelector('.tt__slot-range')
    const sels = box ? box.querySelectorAll('.ui-select__native') : []
    return { hasRange: !!box, selCount: sels.length }
  })()`)
  ok(modal.hasRange && modal.selCount === 2, '弹窗有起止节次两个下拉', modal)

  await fillName('数据结构')
  await setRange(1, 3)
  await sleep(400)
  const countText = await ev(`document.querySelector('.tt__range-count')?.textContent.trim() || ''`)
  ok(countText.includes('3'), '「共 N 节」实时显示 3 节', countText)

  await clickAdd()
  await sleep(900)
  const grid = await ev(`(() => {
    const names = [...document.querySelectorAll('.tt__cell .tt__course')].map((e) => e.textContent.trim())
    return {
      courseCells: document.querySelectorAll('.tt__cell.has-course').length,
      names,
      contCards: document.querySelectorAll('.tt__cell .tt__course-cont').length,
      contCells: document.querySelectorAll('.tt__cell.is-cont').length,
      contStart: document.querySelectorAll('.tt__cell.is-cont-start').length,
      modalClosed: !document.querySelector('.tt__slot-range'),
    }
  })()`)
  console.log('  · 网格 →', JSON.stringify(grid))
  ok(grid.courseCells === 3, '一次生成 3 个有课格子', grid.courseCells)
  ok(grid.names.length === 1 && grid.names[0] === '数据结构', '课名只显示一次（合并显示）', grid.names)
  ok(grid.contCells === 2 && grid.contCards === 2, '后两格为延续格（只画色块）', { contCells: grid.contCells, contCards: grid.contCards })
  ok(grid.contStart === 2, '块内格子去掉分割线（第1、2节下方均有延续）', grid.contStart)

  // 冲突：点「周一第 4 节」（与已排的周一 1~3 节同一天），再排 1~2 节 → 应被阻止
  await ev(`(() => {
    const cells = [...document.querySelectorAll('.tt__cell')]
    const target = cells[21] // 周一 第4节 = (4-1)*7 + 0
    if (!target) return false
    target.click(); return true
  })()`)
  await sleep(700)
  await fillName('高等数学')
  await setRange(1, 2)
  await sleep(300)
  await clickAdd()
  await sleep(800)
  const after = await ev(`(() => {
    const t = document.querySelector('.ui-toast, [class*=toast], [class*=Toast]')
    return {
      modalOpen: !!document.querySelector('.tt__slot-range'),
      courseCells: document.querySelectorAll('.tt__cell.has-course').length,
      toast: t ? t.textContent.trim() : '',
    }
  })()`)
  ok(after.modalOpen && after.courseCells === 3, '冲突时阻止保存（弹窗保留、网格未变）', after)
  ok(after.toast.includes('已有课') || after.toast.includes('第 1 节'), '给出冲突节次提示', after.toast)

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '节次范围排课验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
