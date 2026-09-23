/**
 * 社区 · 端到端 UI 冒烟（本地 vite preview + CDP；后端逻辑已由 _test_community.py 覆盖）
 * 用法：node _qa_community.mjs [outDir]
 * 覆盖：社区页 tab 切换 / 论坛空状态 / 错题详情分享弹窗 / 更多页社区入口
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9500 + (process.pid % 400)
const OUTDIR = process.argv[2] || 'dist73'
const WEBPORT = 5900 + (process.pid % 300)
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
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_comm_' + process.pid), 'about:blank'], { stdio: 'ignore' })
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

  section('1. 社区页：论坛 tab + 空状态')
  await send('Page.navigate', { url: WEB + '/community' })
  await waitSel('.comm__head')
  await sleep(500)
  const head = await ev(`(() => ({
    h1: document.querySelector('.comm__head h1')?.textContent || '',
    hasSeg: !!document.querySelector('.ui-seg'),
    emptyTitle: document.querySelector('.comm__posts') ? '' : (document.querySelector('.comm .ui-empty-state') ? '空状态' : ''),
  }))()`)
  ok(head.h1 === '知一社区', '社区页标题', head.h1)
  ok(head.hasSeg, '有板块切换（论坛/我的小组）')

  section('2. 切到「我的小组」tab')
  await ev(`[...document.querySelectorAll('.ui-seg button')].find((b) => b.textContent.includes('我的小组')).click()`)
  await sleep(400)
  const gtab = await ev(`(() => ({
    hasGroupToolbar: document.body.textContent.includes('创建小组'),
    hasEmpty: document.body.textContent.includes('还没有加入任何小组'),
  }))()`)
  ok(gtab.hasGroupToolbar, '小组 tab 有「创建小组」按钮')
  ok(gtab.hasEmpty, '未登录显示小组空状态', gtab)

  section('3. 切回论坛 tab')
  await ev(`[...document.querySelectorAll('.ui-seg button')].find((b) => b.textContent.includes('论坛')).click()`)
  await sleep(300)

  section('4. 错题详情分享弹窗（guest 注入错题）')
  await ev(`(() => {
    const now = new Date().toISOString()
    localStorage.setItem('zhiyi_errorbook_v1', JSON.stringify([
      { id: 'qa_share1', question: '求 P(B|A)', answer: 'P(AB)/P(A)', subject: '概率论', knowledgePoints: ['条件概率'],
        steps: [{ title: '定义', detail: 'P(B|A)=P(AB)/P(A)' }], quizCount: 1, correctCount: 0, mastered: false, reviewAt: 0, courseId: '', createdAt: now },
    ]))
    return true
  })()`)
  await send('Page.navigate', { url: WEB + '/wrongbook' })
  await waitSel('.wb__card')
  await sleep(600)
  await ev(`document.querySelector('.wb__card').click()`)
  await waitSel('.wb__drawer')
  await sleep(300)
  await ev(`[...document.querySelectorAll('.wb__drawer-foot button')].find((b) => b.textContent.includes('分享')).click()`)
  await waitSel('.ui-modal')
  await sleep(300)
  const share = await ev(`(() => ({
    title: document.querySelector('.ui-modal__panel h3')?.textContent || '',
    privacy: document.body.textContent.includes('不会公开') || document.body.textContent.includes('不公开'),
    hasSeg: !!document.querySelector('.ui-modal .ui-seg'),
  }))()`)
  ok(share.title === '分享这道题', '分享弹窗标题', share.title)
  ok(share.privacy, '有隐私提示')
  ok(share.hasSeg, '有论坛/小组目标切换')
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'community-share.png'), Buffer.from(shot.data, 'base64'))
  await ev(`[...document.querySelectorAll('.ui-modal button')].find((b) => b.textContent.includes('关闭') || b.getAttribute('aria-label') === '关闭')?.click()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(300)

  section('5. 更多页社区入口（无「即将上线」badge）')
  await send('Page.navigate', { url: WEB + '/more' })
  await waitSel('.more__section')
  await sleep(400)
  const more = await ev(`(() => {
    const row = [...document.querySelectorAll('.more__row')].find((r) => r.textContent.includes('社区'))
    return { exists: !!row, hasBadge: !!row?.querySelector('.more__badge'), desc: row?.textContent || '' }
  })()`)
  ok(more.exists, '更多页有社区入口')
  ok(!more.hasBadge, '社区入口无「即将上线」badge', more.desc)
  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, 'community-more.png'), Buffer.from(shot2.data, 'base64'))

  section('6. 异常')
  ok(errors.length === 0, '无未捕获异常', errors)

  console.log('\n==============================================')
  console.log(fail === 0 ? '社区 UI 冒烟通过（' + pass + ' 项）' : '有 ' + fail + ' 项未通过（通过 ' + pass + ' 项）')
  try { chrome.kill() } catch { /* noop */ }
  try { preview.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
