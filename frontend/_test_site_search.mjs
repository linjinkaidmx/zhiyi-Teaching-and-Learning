// 离线单测：首页站内搜索匹配逻辑（2026-10-10）。node 直跑。
// 用法：node _test_site_search.mjs
const { searchSite, QUICK_ENTRIES, SITE_INDEX } = await import('./src/lib/siteSearch.js')

let PASS = 0, FAIL = 0
const ok = (c, name, extra) => {
  if (c) { PASS++; console.log('  OK  ' + name) }
  else { FAIL++; console.log('  FAIL ' + name + '  ' + JSON.stringify(extra)) }
}
const top = (q, n = 1) => searchSite(q, n).map((r) => r.title)

console.log('\n== 1. 精确/别名命中 ==')
ok(top('错题').includes('错题本'), '「错题」→ 错题本', top('错题'))
ok(top('老师').includes('AI 课堂'), '「老师」→ AI 课堂', top('老师', 3))
ok(top('搭子').includes('AI 伴学'), '「搭子」→ AI 伴学', top('搭子'))
ok(top('公式').includes('考前速查'), '「公式」→ 考前速查', top('公式', 3))
ok(top('报错').includes('代码诊断'), '「报错」→ 代码诊断', top('报错'))
ok(top('AI角色').includes('AI 伴学'), '「AI角色」→ AI 伴学', top('AI角色'))

console.log('\n== 2. 口语化模糊描述 ==')
ok(top('我想复习一下错题').includes('错题本'), '长句「我想复习一下错题」→ 错题本', top('我想复习一下错题', 4))
ok(top('哪里能上课').includes('AI 课堂'), '「哪里能上课」→ AI 课堂', top('哪里能上课', 4))
ok(top('陪我学').includes('AI 伴学'), '「陪我学」→ AI 伴学', top('陪我学'))

console.log('\n== 3. 归一化（空格/大小写/标点） ==')
ok(top('AI 课堂').includes('AI 课堂'), '「AI 课堂」带空格命中', top('AI 课堂'))
ok(top('错题本！').includes('错题本'), '「错题本！」带标点命中', top('错题本！'))

console.log('\n== 4. 边界 ==')
ok(searchSite('').length === 0, '空输入返回空')
ok(searchSite('   ').length === 0, '纯空格返回空')
ok(searchSite('zzzz不存在').length === 0, '无匹配返回空')
ok(SITE_INDEX.length >= 18, '索引覆盖 ≥18 个功能', SITE_INDEX.length)
ok(QUICK_ENTRIES.length === 8, '常用入口 8 个', QUICK_ENTRIES.length)
ok(QUICK_ENTRIES.every((e) => e.path && e.title), '常用入口字段齐全')

console.log('\n------ %d passed, %d failed ------', PASS, FAIL)
process.exit(FAIL ? 1 : 0)
