/**
 * 信息架构调整 · 冒烟验证（本地 vite preview + CDP）
 * 验证：更多页分组（社区独立组/考试安排入口）、自测页与错题本的复习设置入口
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9700 + (process.pid % 300)
const OUTDIR = process.argv[2] || 'dist76'
const WEBPORT = 5950 + (process.pid % 300)
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

async function main() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(WEB + '/')).ok) break } catch { /* retry */ }
    await sleep(400)
  }
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_ia_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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

  // ---- 1. 更多页分组
  await send('Page.navigate', { url: WEB + '/more' })
  await waitSel('.more__section-title')
  await sleep(500)
  const more = await ev(`(() => {
    const titles = [...document.querySelectorAll('.more__section-title')].map((h) => h.textContent.trim())
    const idxCommunity = titles.indexOf('社区')
    const idxAbout = titles.indexOf('关于')
    const rows = [...document.querySelectorAll('.more__row-label')].map((s) => s.textContent.trim())
    return {
      titles,
      communityBeforeAbout: idxCommunity >= 0 && idxAbout > idxCommunity,
      communityStandalone: idxCommunity >= 0 && [...document.querySelectorAll('.more__section')][idxCommunity].querySelectorAll('.more__row').length === 1,
      hasExams: rows.includes('考试安排'),
      orderOk: rows.indexOf('学习数据') < rows.indexOf('学习记录') && rows.indexOf('学习记录') < rows.indexOf('我的课程') && rows.indexOf('课程表') < rows.indexOf('考试安排'),
    }
  })()`)
  ok(more.titles.includes('社区') && more.titles.includes('关于'), '「更多」有社区与关于分组', more.titles)
  ok(more.communityBeforeAbout, '社区组排在关于组之前')
  ok(more.communityStandalone, '社区为独立单条目组')
  ok(more.hasExams, '考试安排已补进课程与数据组')
  ok(more.orderOk, '课程与数据组内排序正确')

  // ---- 2. 自测页复习设置入口
  await send('Page.navigate', { url: WEB + '/practice/original' })
  await waitSel('.pr__head')
  await sleep(500)
  const pr = await ev(`(() => {
    const btn = [...document.querySelectorAll('.pr__head-ops button')].find((b) => b.textContent.includes('复习设置'))
    if (!btn) return { found: false }
    btn.click()
    return { found: true }
  })()`)
  ok(pr.found, '自测页有「复习设置」入口')
  if (pr.found) {
    await sleep(500)
    const dlg = await ev(`(() => {
      const modal = [...document.querySelectorAll('.ui-modal, [class*=modal]')].find((m) => m.textContent.includes('复习设置') || m.textContent.includes('开启间隔复习'))
      return { open: !!modal, hasSwitch: !!modal?.querySelector('input[type=checkbox], button[class*=switch], [role=switch]') }
    })()`)
    ok(dlg.open, '点击后复习设置对话框打开')
  }

  // ---- 3. 错题本复习设置入口
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.wb__head')
  await sleep(500)
  const wb = await ev(`(() => {
    const btn = [...document.querySelectorAll('.wb__head-ops button')].find((b) => b.textContent.includes('复习设置'))
    return { found: !!btn }
  })()`)
  ok(wb.found, '错题本有「复习设置」入口')

  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '信息架构调整验证通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); try { process.exit(1) } catch { /* noop */ } })
