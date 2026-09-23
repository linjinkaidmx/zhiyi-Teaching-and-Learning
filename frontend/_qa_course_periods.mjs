/**
 * 课程「上课时段」端到端验证（本地 vite preview + CDP）
 * 链路：新增课程 → 添加两个时段（周三3-5节 + 周五6-8节，均在 2,5,6 周）→ 保存
 *       → 断言课表生成 6 个格子 → 再开编辑断言时段被正确回填 → 移动端节次列显示时间
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9990 + (process.pid % 100)
const OUTDIR = process.argv[2] || 'dist84'
const WEBPORT = 5999 + (process.pid % 100)
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

/** 设置第 idx 个时段的第 selIdx 个下拉（逐个设置 + 回读，避免 Vue 重渲染导致引用失效） */
const setSel = (idx, selIdx, val) => ev(`(() => {
  const p = document.querySelectorAll('.co__period')[${idx}]
  if (!p) return { ok: false, reason: 'no-period' }
  const sels = p.querySelectorAll('.ui-select__native')
  const el = sels[${selIdx}]
  if (!el) return { ok: false, reason: 'no-select', count: sels.length }
  el.value = '${val}'
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true, value: el.value, count: sels.length }
})()`)

const setRanges = (idx, text) => ev(`(() => {
  const p = document.querySelectorAll('.co__period')[${idx}]
  const inp = p && p.querySelector('.ui-field__input')
  if (!inp) return false
  inp.value = ${JSON.stringify(text)}
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`)

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_cperiods_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

  // 清空课表数据
  await send('Page.navigate', { url: WEB + '/course' })
  await waitSel('.zy-page')
  await ev(`Object.keys(localStorage).filter((k) => k.startsWith('zhiyi_schedule')).forEach((k) => localStorage.removeItem(k))`)
  await send('Page.navigate', { url: WEB + '/course' })
  await waitSel('.zy-page')
  await sleep(800)

  // 打开「新增课程」
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('新增课程')).click()`)
  await sleep(700)
  const hasPeriods = await ev(`!!document.querySelector('.co__periods')`)
  ok(hasPeriods, '新增课程弹窗有「上课时段」区')

  // 填课程名
  await ev(`(() => {
    const inp = document.querySelector('.co__form .ui-field__input')
    inp.value = '数据结构'
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)

  // 添加两个时段
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('添加时段')).click()`)
  await sleep(300)
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('添加时段')).click()`)
  await sleep(400)
  const cnt = await ev(`document.querySelectorAll('.co__period').length`)
  ok(cnt === 2, '可添加多个时段', cnt)

  // 逐项设置两个时段（每步回读，便于定位失效点）
  const r1 = await setSel(0, 0, '3'); await sleep(200)
  const r2 = await setSel(0, 1, '3'); await sleep(200)
  const r3 = await setSel(0, 2, '5'); await sleep(200)
  const r4 = await setSel(0, 3, 'custom'); await sleep(350)
  console.log('  · 时段1 各步 →', JSON.stringify([r1, r2, r3, r4]))
  await setRanges(0, '2,5,6'); await sleep(350)
  const r5 = await setSel(1, 0, '5'); await sleep(200)
  const r6 = await setSel(1, 1, '6'); await sleep(200)
  const r7 = await setSel(1, 2, '8'); await sleep(200)
  const r8 = await setSel(1, 3, 'custom'); await sleep(350)
  console.log('  · 时段2 各步 →', JSON.stringify([r5, r6, r7, r8]))
  await setRanges(1, '2,5,6'); await sleep(500)

  const previews = await ev(`[...document.querySelectorAll('.co__period-preview')].map((e) => e.textContent.trim())`)
  ok(previews.length === 2 && previews.every((p) => p.includes('第 2 周') && p.includes('第 5 周') && p.includes('第 6 周')), '周次实时预览显示第 2、5、6 周', previews)

  // 保存
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '添加').click()`)
  await sleep(1000)

  const saved = await ev(`(() => {
    const st = JSON.parse(localStorage.getItem('zhiyi_schedule_v2') || '{}')
    return (st.timetable || []).map((s) => ({ day: s.day, slot: s.slot, weeks: s.weeks }))
  })()`)
  console.log('  · 生成格子 →', JSON.stringify(saved))
  ok(saved.length === 6, '按 2 个时段生成 6 个格子', saved.length)
  const expect = [[3, 3], [3, 4], [3, 5], [5, 6], [5, 7], [5, 8]]
  const got = saved.map((s) => [s.day, s.slot]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  ok(JSON.stringify(got) === JSON.stringify(expect), '格子位置正确（周三3-5 / 周五6-8）', got)
  ok(saved.every((s) => s.weeks && s.weeks.type === 'custom' && JSON.stringify(s.weeks.ranges) === JSON.stringify([[2, 2], [5, 5], [6, 6]])), '周次写入为自定义 2,5,6', saved[0].weeks)

  // 重新打开「编辑」→ 时段应被回填
  await sleep(400)
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '编辑').click()`)
  await sleep(800)
  const back = await ev(`(() => {
    const ps = [...document.querySelectorAll('.co__period')]
    return ps.map((p) => {
      const sels = p.querySelectorAll('.ui-select__native')
      const inp = p.querySelector('.ui-field__input')
      return {
        day: sels[0] ? sels[0].value : '',
        s1: sels[1] ? sels[1].value : '',
        s2: sels[2] ? sels[2].value : '',
        weeksType: sels[3] ? sels[3].value : '',
        ranges: inp ? inp.value : '',
      }
    })
  })()`)
  console.log('  · 编辑回填 →', JSON.stringify(back))
  ok(back.length === 2, '编辑打开后回填 2 个时段（不碎片化）', back.length)
  ok(back[0] && back[0].day === '3' && back[0].s1 === '3' && back[0].s2 === '5', '时段1 回填 周三 3~5 节', back[0])
  ok(back[1] && back[1].day === '5' && back[1].s1 === '6' && back[1].s2 === '8', '时段2 回填 周五 6~8 节', back[1])
  ok(back.every((b) => b.weeksType === 'custom' && b.ranges === '2,5,6'), '周次回填为 2,5,6', back.map((b) => b.ranges))

  // 移动端：节次列显示节次与时间（课表需要先有学期基准，否则显示空态）
  await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消').click()`)
  await sleep(400)
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.zy-page')
  await ev(`(() => {
    const st = JSON.parse(localStorage.getItem('zhiyi_schedule_v2') || '{}')
    st.term = { startDate: '2026-09-01', totalWeeks: 20, updatedAt: Date.now() }
    localStorage.setItem('zhiyi_schedule_v2', JSON.stringify(st))
    return true
  })()`)
  await send('Page.navigate', { url: WEB + '/timetable' })
  await waitSel('.tt__grid')
  await sleep(900)
  const slot = await ev(`(() => {
    const slots = [...document.querySelectorAll('.tt__slot')].slice(0, 3)
    const doc = document.documentElement
    return {
      texts: slots.map((s) => s.textContent.replace(/\\s+/g, ' ').trim()),
      timeVisible: (() => {
        const t = document.querySelector('.tt__slot-time')
        return t ? getComputedStyle(t).display !== 'none' : false
      })(),
      docScrollW: doc.scrollWidth, docClientW: doc.clientWidth,
    }
  })()`)
  console.log('  · 节次列 →', JSON.stringify(slot.texts))
  ok(slot.texts[0].includes('第 1 节') && slot.texts[0].includes(':'), '节次列显示「第 N 节 + 时间」', slot.texts[0])
  ok(slot.timeVisible, '时间段在移动端可见')
  ok(slot.docScrollW <= slot.docClientW, '移动端仍无横向溢出', { scrollW: slot.docScrollW, clientW: slot.docClientW })

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '课程上课时段验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
