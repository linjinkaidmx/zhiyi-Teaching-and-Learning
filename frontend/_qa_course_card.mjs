/**
 * 「我的课程」移除章节入口验证（本地 vite preview + CDP）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9550 + (process.pid % 100)
const OUTDIR = process.argv[2] || 'dist89'
const WEBPORT = 5890 + (process.pid % 100)
const WEB = 'http://127.0.0.1:' + WEBPORT

const seed = {
  courses: [{ id: 'c1', name: '数据结构', teacher: '王老师', location: '教三302', color: '#3d5a8a', chapters: [], updatedAt: 1 }],
  timetable: [], exams: [], term: { startDate: '2026-09-01', totalWeeks: 20, updatedAt: 1 },
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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ccard_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false })

  await send('Page.navigate', { url: WEB + '/course' })
  await waitSel('.zy-page')
  await ev(`localStorage.setItem('zhiyi_schedule_v2', ${JSON.stringify(JSON.stringify(seed))})`)
  await send('Page.navigate', { url: WEB + '/course' })
  await waitSel('.co__card')
  await sleep(800)

  const card = await ev(`(() => {
    const head = document.querySelector('.co__card-head')
    const btns = [...head.querySelectorAll('button')].map((b) => (b.className.includes('co__del') ? '删除×' : b.textContent.trim()))
    const allText = document.body.textContent
    return {
      btns,
      hasChapterText: allText.includes('章节'),
      hasChapterBody: document.querySelectorAll('.co__body, .co__chapter').length,
      courseNameShown: allText.includes('数据结构'),
    }
  })()`)
  console.log('  · 卡片按钮 →', JSON.stringify(card.btns))
  ok(card.courseNameShown, '课程卡片正常显示')
  ok(card.btns.includes('编辑'), '卡片保留「编辑」按钮', card.btns)
  ok(!card.btns.some((b) => b.includes('章节')), '卡片已无「章节」按钮', card.btns)
  ok(!card.hasChapterText, '页面已无「章节」字样')
  ok(card.hasChapterBody === 0, '章节展开区已移除', card.hasChapterBody)

  // 编辑仍可用
  await ev(`[...document.querySelectorAll('.co__card-head button')].find((b) => b.textContent.trim() === '编辑').click()`)
  await sleep(700)
  const modal = await ev(`(() => ({
    open: !!document.querySelector('.co__form'),
    hasPeriods: !!document.querySelector('.co__periods'),
    hasColor: !!document.querySelector('.co__color-field'),
  }))()`)
  ok(modal.open && modal.hasPeriods && modal.hasColor, '编辑弹窗仍可用（含时段与颜色）', modal)

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '章节入口移除验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
