/**
 * 验证：游客态首页不显示个人学习数据（Mock 演示数据隔离）
 * 用法：node _qa_guest.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9491
const BASE = 'http://193.112.28.51:3300'
const userDir = path.join(os.tmpdir(), 'qa_guest_' + process.pid)
fs.mkdirSync(userDir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'], { stdio: 'ignore' })
let ws; let seq = 0; const pending = new Map()
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value
let pass = 0; let fail = 0
const ok = (c, label, extra) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }


async function waitSel(sel, timeout = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    try { if (await ev(`!!document.querySelector('${sel}')`)) return true } catch { /* retry */ }
    await sleep(300)
  }
  return false
}

async function main() {
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* retry */ } await sleep(250) }
  const t = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result) } })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })

  // 清空 localStorage，确保是全新游客
  await send('Page.navigate', { url: BASE + '/?v=53' })
  await waitSel('.home')
  await ev(`localStorage.clear()`)
  await send('Page.navigate', { url: BASE + '/?v=53' })
  await waitSel('.home__body')

  const r = await ev(`(() => {
    const txt = (document.body.textContent || '').replace(/\\s+/g, ' ')
    return {
      hasGuestGuide: txt.includes('登录后同步学习数据'),
      hasOverview: txt.includes('今日时长') || txt.includes('完成题目') || txt.includes('待复习'),
      hasSummary: txt.includes('AI 学习总结'),
      hasContinue: txt.includes('继续学习'),
      hasReview: txt.includes('今日复习'),
      hasRecommend: txt.includes('AI 推荐知识点'),
      hasCapture: txt.includes('开始识别') || txt.includes('拍照'),
    }
  })()`)

  ok(r.hasGuestGuide, '游客态显示「登录后同步学习数据」引导')
  ok(!r.hasOverview, '游客态不显示学习概览（今日时长/完成题目/待复习）', r.hasOverview)
  ok(!r.hasSummary, '游客态不显示「AI 学习总结」')
  ok(!r.hasContinue, '游客态不显示「继续学习」')
  ok(!r.hasReview, '游客态不显示「今日复习」')
  ok(!r.hasRecommend, '游客态不显示「AI 推荐知识点」')
  ok(r.hasCapture, '游客态仍可用拍题入口', r.hasCapture)

  // 点「去登录」：应直接弹登录窗，且不跳转页面
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '去登录'); if (b) b.click(); return !!b })()`)
  await sleep(900)
  const r2 = await ev(`(() => ({
    path: location.pathname,
    modalOpen: !!document.querySelector('.ui-modal, .ui-field__input'),
    hasLoginText: (document.body.textContent || '').includes('登录'),
    dashed: (document.body.textContent || '').includes('登录后同步学习数据'),
  }))()`)
  ok(r2.path === '/', '点击后仍停在首页（未跳转）', r2.path)
  ok(r2.modalOpen, '直接弹出登录窗（有输入框）', r2.modalOpen)

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('E:/知一2.0/.learnbuddy/_qa_imgs/home-guest.png', Buffer.from(shot.data, 'base64'))
  console.log('（已截图 home-guest.png）')

  console.log('\n' + '='.repeat(46))
  console.log(fail === 0 ? `游客隔离验证通过（${pass} 项）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
  process.exitCode = fail === 0 ? 0 : 1
}
main().catch((e) => console.error('异常:', e.message)).finally(() => { try { ws?.close() } catch {} chrome.kill() })
