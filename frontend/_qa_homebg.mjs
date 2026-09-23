/**
 * 首页动态背景落地验证（vite preview(dist106) + CDP）
 * 覆盖：默认浅色 / 河流背景层（云·岸·流线·双船 72s/88s）/ 玻璃卡（半透明+blur）
 *       / 四卡双色图案 CardArt / TopNav 透明 / 桌面段场景切换 + 侧栏玻璃
 *       / ?theme=dark 星河层（星球·金环·流光）+ river 隐藏
 * 说明：不用 MOCK 后端（首页数据全本地），且安全层拦截 cpSync 覆盖 backend/static，故走 preview。
 * 用法：node _qa_homebg.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9500 + ((process.pid % 200) + (Date.now() % 300))
const CDP_PORT = PORT + 1000
const WEB = process.env.QA_BASE || `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../.learnbuddy/_qa_imgs')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }

let ws, seq = 0
const pending = new Map()
const errors = []
const send = (m, p = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expr, timeout, label) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { try { if (await ev(expr)) return true } catch { /* retry */ } await sleep(500) }
  console.log('  · timeout: ' + label)
  return false
}
const setView = (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile })
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
}

async function main() {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + path.join(os.tmpdir(), 'qa_homebg_' + process.pid), 'about:blank'], { stdio: 'ignore' })
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break } catch { /* retry */ } await sleep(250) }
  const t = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' }).then((r) => r.json())
  ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params?.exceptionDetails?.exception?.description || '').slice(0, 140))
  })
  await send('Page.enable'); await send('Runtime.enable')
  await setView(390, 844, true)

  console.log('\n1. 默认浅色 + 河流背景层（移动）')
  await send('Page.navigate', { url: WEB + '/' })
  await waitFor(`!!document.querySelector('.home__cards')`, 15000, '首页出现')
  await ev(`try { localStorage.setItem('zhiyi_setup_dismissed', '1') } catch {}`)
  await send('Page.navigate', { url: WEB + '/' })
  await waitFor(`!!document.querySelector('.home__cards') && !document.querySelector('.ui-modal')`, 15000, '首页无弹窗')
  ok(await ev(`document.documentElement.dataset.theme`) === 'light', '默认主题 = light（无 ?theme / 无存档时）', await ev(`document.documentElement.dataset.theme`))
  ok(await ev(`getComputedStyle(document.querySelector('.hbg__river')).display`) === 'block', '河流背景层可见')
  ok(await ev(`getComputedStyle(document.querySelector('.hbg__star')).display`) === 'none', '星河层浅色下隐藏')
  ok(await ev(`document.querySelectorAll('.hbg__cloud').length`) === 3, '白云 3 朵')
  ok(await ev(`!!document.querySelector('.hbg__water')`), '水面带存在')
  ok(await ev(`getComputedStyle(document.querySelector('.hbg__scene--m')).display`) === 'block' && await ev(`getComputedStyle(document.querySelector('.hbg__scene--d')).display`) === 'none', '移动端用 --m 场景')
  ok(await ev(`[...document.querySelectorAll('.hbg__scene--m animateMotion')].map((x) => x.getAttribute('dur')).sort().join(',')`) === '72s,88s', '纸船航线动画 dur = 72s/88s', await ev(`[...document.querySelectorAll('.hbg__scene--m animateMotion')].map((x) => x.getAttribute('dur')).join(',')`))
  ok(await ev(`document.querySelectorAll('.hbg__scene--m .hbg-f1, .hbg__scene--m .hbg-f2, .hbg__scene--m .hbg-f3, .hbg__scene--m .hbg-f4, .hbg__scene--m .hbg-f5').length`) >= 4, '流线水光动画 ≥4 条')
  ok(await ev(`!!document.querySelector('.hbg__scene--m use[href="#hbgBoatM"]') || !!document.querySelector('.hbg__scene--m use')`), '纸船 use 引用存在')
  console.log('  · diag cls=', await ev("[...document.querySelectorAll('.hbg__scene')].map(x=>x.getAttribute('class')).join('|')"), 'mq=', await ev("window.matchMedia('(min-width:768px)').matches"), 'innerW=', await ev('window.innerWidth'))
  console.log('  · diag sceneM=', await ev("getComputedStyle(document.querySelector('.hbg__scene--m')).display"), 'sceneD=', await ev("getComputedStyle(document.querySelector('.hbg__scene--d')).display"))
  console.log('  · diag sheet=', await ev("(() => { const out=[]; for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules } catch { continue } for (const r of rules) { if (r.cssText && r.cssText.includes('hbg__scene--d')) out.push(r.cssText.slice(0,80)) } } return out.join(' @@ ') })()"))
  console.log('  · diag allRules=', await ev("(() => { const out=[]; let idx=0; for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules } catch { continue } for (const r of rules) { const t=r.cssText||''; if (t.includes('hbg__scene')) out.push((idx++)+': '+t.slice(0,90)) } } return out.join(' || ') })()"))
  console.log('  · diag artVar=', await ev("getComputedStyle(document.documentElement).getPropertyValue('--art-camera')"), 'cardArtHTML=', await ev("document.querySelector('.card-art').outerHTML.slice(0,200)"), 'fill=', await ev("getComputedStyle(document.querySelector('.card-art rect, .card-art path')).fill"))
  await sleep(800)
  await shot('homebg_light_m.png')

  console.log('\n2. 玻璃卡 + 四卡双色图案（移动）')
  ok(await ev(`document.querySelectorAll('.home__card .card-art').length`) === 4, '四卡全部使用 CardArt 双色图案')
  const bf = await ev(`getComputedStyle(document.querySelector('.home__card')).backdropFilter || getComputedStyle(document.querySelector('.home__card')).webkitBackdropFilter`)
  ok(String(bf).includes('blur'), '大卡半透明 + backdrop blur', bf)
  const bg = await ev(`getComputedStyle(document.querySelector('.home__card')).backgroundColor`)
  ok(bg && !bg.startsWith('rgb(255, 255, 255)') || (bg && bg.includes('0.72')), '大卡底色为半透明混色', bg)
  ok(String(await ev(`getComputedStyle(document.querySelector('.home__info')).backdropFilter || ''`)).includes('blur'), '信息位卡玻璃 blur')
  console.log('  · diag cards=', await ev("[...document.querySelectorAll('.home__card .card-art')].map(x => x.outerHTML.slice(0,80)).join(' ## ')"), 'counts=', await ev("[...document.querySelectorAll('.home__card .card-art')].map(x => 'r'+x.querySelectorAll('rect').length+' p'+x.querySelectorAll('path').length+' g'+x.querySelectorAll('g').length+' c'+x.querySelectorAll('circle').length).join('|')"))
  console.log('  · diag artEls=', await ev("[...document.querySelectorAll('.home__card .card-art')].map(x => { const el = x.querySelector('rect,path,g,circle'); return el.tagName + ':' + getComputedStyle(el).fill }).join(' | ')"))
  const arts = await ev(`[...document.querySelectorAll('.home__card .card-art')].map((x) => getComputedStyle(x.querySelector('path,rect,circle')).fill).join('|')`)
  ok(arts.split('|').every((c) => c !== 'rgb(0, 0, 0)'), '图案填色解析正常（非默认黑）', arts)
  const bboxes = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.home__card .card-art')].map((svg) => { const b = svg.querySelector('g').getBBox(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } }))`))
  ok(bboxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= 40 && b.y + b.h <= 40), '【bug回归】四图标 bbox 不越界（无裁切）', bboxes)
  ok(bboxes.every((b) => b.w >= 26 && b.h >= 22), '【bug回归】四图标视觉尺寸统一（宽≥26 高≥22）', bboxes.map((b) => b.w + 'x' + b.h))
  await ev(`[...document.querySelectorAll('.home__card')][0].click()`)
  ok(await waitFor(`location.pathname === '/capture'`, 8000, '跳拍题'), '大卡点击仍跳拍题（功能回归）')
  await ev(`history.back()`)
  await waitFor(`!!document.querySelector('.home__cards')`, 10000, '回首页')

  console.log('\n2b. 次入口横滑边界（玻璃卡 + peek + 胶囊圆点）')
  const qStyle = await ev(`(() => { const el = document.querySelector('.home__quick'); const cs = getComputedStyle(el); return JSON.stringify({ bg: cs.backgroundColor, bd: cs.borderTopWidth, blur: cs.backdropFilter || cs.webkitBackdropFilter, radius: cs.borderTopLeftRadius }) })()`)
  ok(JSON.parse(qStyle).blur && JSON.parse(qStyle).blur.includes('blur'), '次入口整体玻璃卡（有边框+模糊）', qStyle)
  const peek = JSON.parse(await ev(`(() => { const t = document.querySelector('.home__quick-track'); const p = document.querySelector('.home__quick-page'); return JSON.stringify({ trackW: Math.round(t.clientWidth), pageW: Math.round(p.getBoundingClientRect().width), scrollable: t.scrollWidth > t.clientWidth + 4 }) })()`))
  ok(peek.pageW < peek.trackW - 8 && peek.pageW > peek.trackW * 0.8, '次入口页宽 < 容器（右侧露出下一页一角）', peek)
  ok(peek.scrollable, '次入口可横向滑动')
  const dots = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.home__dot')].map((d) => Math.round(d.getBoundingClientRect().width)))`))
  ok(dots.length === 2 && Math.max(...dots) >= 16 && Math.min(...dots) >= 5, '胶囊圆点：选中≥16px、未选≥5px', dots)
  await ev(`document.querySelector('.home__quick-track').scrollLeft = 9999`)
  await sleep(500)
  const dots2 = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.home__dot')].map((d) => Math.round(d.getBoundingClientRect().width)))`))
  ok(dots2[1] >= 16 && dots2[0] < 10, '滑到第 2 页后圆点高亮切换', dots2)
  await ev(`document.querySelector('.home__quick-track').scrollLeft = 0`)
  await sleep(300)
  const quickShot = JSON.parse(await ev(`(() => { const r = document.querySelector('.home__quick').getBoundingClientRect(); return JSON.stringify({ x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height }) })()`))
  const qsRes = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: quickShot.x, y: quickShot.y, width: quickShot.w, height: quickShot.h, scale: 3 } })
  fs.writeFileSync(path.join(OUT, 'homebg_quick.png'), Buffer.from(qsRes.data, 'base64'))
  console.log('  已截图 homebg_quick.png')

  console.log('\n3. TopNav 透明（Tab 区透出天空）')
  ok(await ev(`getComputedStyle(document.querySelector('.ui-topnav')).backgroundColor`) === 'rgba(0, 0, 0, 0)', 'TopNav 背景透明', await ev(`getComputedStyle(document.querySelector('.ui-topnav')).backgroundColor`))
  ok(await ev(`document.querySelector('.home').getBoundingClientRect().top`) <= 1, '首页背景顶到视口顶（负 margin 越过顶栏）', await ev(`document.querySelector('.home').getBoundingClientRect().top`))

  console.log('\n4. 桌面段（1440×900）')
  await setView(1440, 900, false)
  await send('Page.navigate', { url: WEB + '/' })
  await waitFor(`!!document.querySelector('.home__cards')`, 15000, '首页出现')
  ok(await ev(`getComputedStyle(document.querySelector('.hbg__scene--d')).display`) === 'block' && await ev(`getComputedStyle(document.querySelector('.hbg__scene--m')).display`) === 'none', '桌面切换到 --d 场景')
  ok(await ev(`[...document.querySelectorAll('.hbg__scene--d animateMotion')].map((x) => x.getAttribute('dur')).sort().join(',')`) === '72s,88s', '桌面纸船航线动画 72s/88s')
  ok(await ev(`!!document.querySelector('.home__aside')`) && String(await ev(`getComputedStyle(document.querySelector('.home__aside')).backdropFilter || ''`)).includes('blur'), '桌面今日概览侧栏玻璃化')
  ok(await ev(`document.querySelectorAll('.home__quick .home__ico').length`) === 9, '次入口 9 项平铺不变（布局未动）')
  ok(await ev(`document.querySelectorAll('.home__card').length`) === 4 && await ev(`getComputedStyle(document.querySelector('.home__card')).flexDirection`) === 'row', '桌面大卡横版不变')
  await sleep(800)
  await shot('homebg_light_d.png')

  console.log('\n5. ?theme=dark 星河层')
  await send('Page.navigate', { url: WEB + '/?theme=dark' })
  await waitFor(`!!document.querySelector('.home__cards')`, 15000, '首页出现')
  ok(await ev(`document.documentElement.dataset.theme`) === 'dark', '?theme=dark 生效')
  ok(await ev(`getComputedStyle(document.querySelector('.hbg__star')).display`) === 'block', '星河层可见')
  ok(await ev(`getComputedStyle(document.querySelector('.hbg__river')).display`) === 'none', '河流层深色下隐藏')
  ok(await ev(`document.querySelectorAll('.hbg__nightsky circle').length`) >= 55, '星点 ≥55 颗', await ev(`document.querySelectorAll('.hbg__nightsky circle').length`))
  ok(await ev(`!!document.querySelector('.hbg__planet use')`), '星球表面自转 use 存在')
  ok(await ev(`document.querySelectorAll('.hbg__nightsky animateTransform').length`) >= 2, '银河 2 层流动动画', await ev(`document.querySelectorAll('.hbg__nightsky animateTransform').length`))
  ok(await ev(`[...document.querySelectorAll('.hbg__planet .hbg-spark1, .hbg__planet .hbg-spark2')].length`) === 2, '星环流光 2 段（CSS dashoffset 动画）')
  const planet = JSON.parse(await ev(`JSON.stringify((() => { const el = document.querySelector('.hbg__planet'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight } })())`))
  ok(planet && planet.w > 0 && planet.x >= 0 && planet.x + planet.w <= planet.vw && planet.y >= 0 && planet.y + planet.h <= planet.vh, '【bug回归】星球完整落在视口内（不再被 slice 裁掉）', planet)
  ok(await ev(`document.querySelectorAll('.hbg__meteor').length`) === 2, '流星 2 颗')
  ok(String(await ev(`getComputedStyle(document.querySelector('.home__card')).backgroundColor`)).length > 0, '深色下玻璃卡背景解析正常')
  await sleep(800)
  await shot('homebg_dark.png')

  console.log('\n5b. 移动端深色星球（390 视口）')
  await setView(390, 844, true)
  await send('Page.navigate', { url: WEB + '/?theme=dark' })
  await waitFor(`!!document.querySelector('.hbg__planet')`, 15000, '星球层出现')
  await ev(`try { localStorage.setItem('zhiyi_setup_dismissed', '1') } catch {}`)
  await send('Page.navigate', { url: WEB + '/?theme=dark' })
  await waitFor(`!!document.querySelector('.hbg__planet')`, 15000, '星球层出现2')
  const planetM = JSON.parse(await ev(`JSON.stringify((() => { const el = document.querySelector('.hbg__planet'); const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight } })())`))
  ok(planetM.w > 0 && planetM.x >= 0 && planetM.x + planetM.w <= planetM.vw && planetM.y >= 0 && planetM.y + planetM.h <= planetM.vh, '【bug回归】移动端星球完整落在视口内', planetM)
  const bboxM = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.home__card .card-art')].map((svg) => { const b = svg.querySelector('g').getBBox(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } }))`))
  ok(bboxM.length === 4 && bboxM.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= 40 && b.y + b.h <= 40), '移动端四图标 bbox 不越界', bboxM)
  await sleep(800)
  await shot('homebg_dark_m.png')

  console.log('\n6. 全局')
  ok(errors.length === 0, '无运行时异常', errors.slice(0, 3))

  console.log(`\n==============================================\n${fail === 0 ? '全部通过' : '存在失败'}（${pass} 项断言，失败 ${fail}）`)
  try { chrome.kill() } catch { /* noop */ }
  process.exit(fail === 0 ? 0 : 1)
}

const server = process.env.QA_BASE ? null : spawn('npx', ['vite', 'preview', '--outDir', 'dist108', '--port', String(PORT), '--strictPort'], { cwd: __dirname, stdio: 'ignore', shell: true })
if (!process.env.QA_BASE) for (let i = 0; i < 40; i += 1) { try { if ((await fetch(WEB)).ok) break } catch { /* retry */ } await sleep(250) }

main().catch((e) => { console.error('E2E 异常:', e); process.exitCode = 1 }).finally(() => { try { if (server) server.kill() } catch { /* ignore */ } })
