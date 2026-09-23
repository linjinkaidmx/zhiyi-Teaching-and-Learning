/**
 * 双击返回键退出 · 纯逻辑回归（离线自包含，不联网不启服务）
 * 用法：node _test_exitguard.mjs
 */
import { isDoubleBack, isMobileViewport } from './src/lib/exitGuard.js'
import fs from 'node:fs'

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

section('1. 双击判定 isDoubleBack(now, lastAt, interval)')
ok(!isDoubleBack(1000, 0), '从未按过（lastAt=0）不算双击')
ok(isDoubleBack(1000, 500, 2000), '间隔 500ms 算双击')
ok(isDoubleBack(2400, 500, 2000), '间隔 1900ms 算双击')
ok(isDoubleBack(2500, 500, 2000), '间隔 2000ms 整算双击')
ok(!isDoubleBack(2501, 500, 2000), '间隔 2001ms 不算双击')
ok(!isDoubleBack(1000, 1000, 2000), '同一次按键（间隔 0）不算双击')
ok(!isDoubleBack(500, 1000, 2000), '时间倒流不算双击')

section('2. 移动端判定 isMobileViewport(width)')
ok(isMobileViewport(390), '390 是移动端')
ok(isMobileViewport(767), '767 是移动端（断点含边界）')
ok(!isMobileViewport(768), '768 不是移动端')
ok(!isMobileViewport(1440), '1440 不是移动端')
ok(!isMobileViewport(0), '宽度 0（未测量）不当移动端')

section('3. 实现约定')
const src = fs.readFileSync(new URL('./src/lib/exitGuard.js', import.meta.url), 'utf8')
ok(src.includes('pushState') && src.includes('zyExitGuard'), '用哨兵 history entry 接住返回')
ok(src.includes("addEventListener('popstate'"), '监听 popstate')
ok(src.includes('history.go(-steps)'), '退出时按步数回退到站外')
ok(src.includes('onExit'), '没有站外历史时有兜底回调')
const app = fs.readFileSync(new URL('./src/App.vue', import.meta.url), 'utf8')
ok(app.includes('installExitGuard'), 'App 层已安装')
ok(app.includes("matchMedia('(max-width: 767px)')"), '只在移动端启用')
ok(app.includes('zy-bye'), '有退出落地页')

console.log('\n==============================================')
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
