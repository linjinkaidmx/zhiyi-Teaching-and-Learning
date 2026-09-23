/**
 * P2 路由契约测试（静态校验，无需浏览器）
 * 用法：node _test_routes.mjs
 *
 * 校验点：
 *  1. 冻结路由清单里的每个路径都在 lib/routes.js 中存在
 *  2. 不得出现被禁止的重复命名（/wrong-questions、/schedule）
 *  3. 路由表：legacy 路由必须带 meta.view；v1 路由必须有 component
 *  4. 顶部导航 5 个内容项 + 底部导航 5 项，且都指向已冻结的路由
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const routesSrc = readFileSync(path.join(here, 'src', 'lib', 'routes.js'), 'utf8')
const routerSrc = readFileSync(path.join(here, 'src', 'router', 'index.js'), 'utf8')

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) {
    pass += 1
    console.log('  ✓ ' + label)
  } else {
    fail += 1
    console.log('  ✗ ' + label + (extra !== undefined ? `  → ${JSON.stringify(extra)}` : ''))
  }
}
const section = (t) => console.log('\n' + t)

section('1. 冻结路由清单（P0 已确认，不得改名/新增）')
const FROZEN = [
  '/',
  '/capture',
  '/q/:id',
  '/wrongbook',
  '/wrongbook/:id',
  '/practice/:mode',
  '/chat',
  '/chat/:id',
  '/tools',
  '/more',
  '/course',
  '/timetable',
  '/data',
  '/records',
  '/community',
  '/about',
  '/help',
  '/me',
]
FROZEN.forEach((p) => {
  ok(routesSrc.includes(`'${p}'`), `routes.js 含 ${p}`)
})

section('2. 禁止的重复命名')
ok(!routesSrc.includes('/wrong-questions'), '不含 /wrong-questions')
ok(!routesSrc.includes("'/schedule'"), '不含 /schedule')
ok(!routerSrc.includes('/wrong-questions'), '路由表不含 /wrong-questions')
ok(!routerSrc.includes("'/schedule'"), '路由表不含 /schedule')

section('3. 路由表结构')
const legacyCount = (routerSrc.match(/^\s*legacy\(/gm) || []).length
const v1Count = (routerSrc.match(/^\s*v1\(/gm) || []).length
ok(legacyCount === 0, `legacy 路由已清零、全部 v1（实际 legacy ${legacyCount}）`)
ok(v1Count >= 17, `v1 路由数量 ≥ 17（/chat 列表与详情已合并为一条记录，实际 ${v1Count}）`)

// 每个 legacy 都带 meta.view（第 3 个位置参数）
const legacyLines = routerSrc.split('\n').filter((l) => /^\s*legacy\(/.test(l))
const views = legacyLines.map((l) => ((l.match(/'(solve|book|quiz|profile)'/g) || []).pop() || '').replace(/'/g, ''))
ok(
  views.length === legacyLines.length && views.every((v) => ['solve', 'book', 'quiz', 'profile'].includes(v)),
  'legacy 路由都声明了 meta.view',
  { legacyLines: legacyLines.length, views },
)

// 每个 v1 都带 component（惰性 import）
const v1Lines = routerSrc.split('\n').filter((l) => /^\s*v1\(/.test(l))
const withComponent = v1Lines.filter((l) => /import\(/.test(l) || /component/.test(l)).length
ok(withComponent === v1Lines.length, 'v1 路由都有 component', { v1Lines: v1Lines.length, withComponent })

// 兜底路由存在
ok(routerSrc.includes('pathMatch'), '含 404 兜底路由')

section('4. 导航结构（首页改版原型：底部导航移除，顶部「学习/我的」双 Tab）')
ok(!routesSrc.includes('TOP_NAV'), 'TOP_NAV 五项顶栏已移除')
ok(!routesSrc.includes('BOTTOM_NAV'), 'BOTTOM_NAV 底部导航已移除（原型前提）')
ok(routesSrc.includes('HOME_TABS'), '导出 HOME_TABS 双 Tab')
const tabBlock = routesSrc.slice(routesSrc.indexOf('HOME_TABS'))
const tabLabels = [...tabBlock.matchAll(/label: '([^']+)'/g)].map((m) => m[1])
ok(tabLabels.join(',') === '学习,我的', '双 Tab 顺序 = 学习 / 我的', tabLabels)
ok(routesSrc.includes("tools: '/tools'"), '学习工具独立路由 /tools')
ok(routerSrc.includes(`redirect: ROUTES.tools`), '/more 保留重定向到 /tools（防旧链接）')

// Tab 路径都来自冻结清单
const navPaths = [...routesSrc.matchAll(/path: ROUTES\.(\w+)/g)].map((m) => m[1])
ok(navPaths.length >= 2, `导航项都引用 ROUTES 常量（${navPaths.length} 处）`)

section('5. 兼容性守卫')
ok(!routerSrc.includes("view.value ="), '路由表不直接改视图状态')
ok(!routesSrc.includes("'/algo'") && !routesSrc.includes("'/debug'") && !routesSrc.includes("'/ref'"),
  '算法演示 / 代码诊断 / 考前速查 未新增独立路由（收进学习工具页）')

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
