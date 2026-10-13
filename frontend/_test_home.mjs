/**
 * 首页真实学情 · 纯逻辑回归（离线自包含，不联网不启服务）
 * 用法：node _test_home.mjs
 * 覆盖：今日时长 / 完成题目 / 待复习 / 推荐知识点 / 复习计划 / 学习总结
 */
import fs from 'node:fs'
import {
  todayMinutes,
  todayQuestions,
  pendingReviewCount,
  weightOf,
  buildRecommendations,
  buildReviewPlan,
  buildSummary,
  buildHomeStats,
  startOfDay,
  MINUTES_PER_REVIEW_ITEM,
} from './src/lib/homeStats.js'

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

const DAY = 24 * 3600 * 1000
/* 用真实当前时间作基准：虚拟「今天中午」在午夜后会落到未来，
   导致「已到期」的题相对 Date.now() 还没到期（quizPool 用真实时钟），测试假失败 */
const NOW = Date.now()
const YESTERDAY = NOW - DAY

const rec = (type, minutes, createdAt) => ({ type, minutes, createdAt })
const item = (over = {}) => ({
  id: over.id || 'i' + Math.random(),
  subject: over.subject || '数据结构',
  knowledgePoints: over.knowledgePoints || ['指针与数组'],
  quizCount: over.quizCount || 0,
  correctCount: over.correctCount || 0,
  mastered: !!over.mastered,
  reviewAt: over.reviewAt || 0,
  createdAt: over.createdAt || new Date(NOW).toISOString(),
})

section('1. 今日时长 todayMinutes')
ok(todayMinutes([rec('explain', 10, NOW), rec('quiz', 5.5, NOW)], NOW) === 16, '今天两条合计 15.5 → 四舍五入 16')
ok(todayMinutes([rec('explain', 10, YESTERDAY)], NOW) === 0, '昨天的记录不计入今天')
ok(todayMinutes([], NOW) === 0, '无记录为 0')
ok(todayMinutes([rec('explain', 300, NOW)], NOW) === 120, '单条超过 120 分钟按上限截断')

section('2. 今日完成题目 todayQuestions')
ok(todayQuestions([rec('explain', 1, NOW), rec('quiz', 1, NOW), rec('practice', 1, NOW)], NOW) === 3, '讲解/自测/练习都算题')
ok(todayQuestions([rec('followup', 1, NOW), rec('save', 1, NOW)], NOW) === 0, '追问与存入错题本不算题目')
ok(todayQuestions([rec('quiz', 1, YESTERDAY)], NOW) === 0, '昨天的题不计入今天')

section('3. 待复习 pendingReviewCount')
const settings = { srsEnabled: true, srsMode: 'spaced', srsIntervals: [1, 3, 7], srsFixedDays: 7 }
ok(pendingReviewCount([item({ mastered: false })], settings, NOW) === 1, '未掌握算待复习')
ok(pendingReviewCount([item({ mastered: true, reviewAt: NOW + DAY })], settings, NOW) === 0, '已掌握且未到期不算')
ok(pendingReviewCount([item({ mastered: true, reviewAt: NOW - 1000 })], settings, NOW) === 1, '已掌握但已到期算待复习')
ok(pendingReviewCount([], settings, NOW) === 0, '空错题本为 0')

section('4. 权重与推荐知识点')
ok(weightOf(0.6) === 'high' && weightOf(0.5) === 'high', '错误率 ≥50% 为 high')
ok(weightOf(0.3) === 'mid' && weightOf(0.25) === 'mid', '25%~50% 为 mid')
ok(weightOf(0.1) === 'low', '<25% 为 low')
const recs = buildRecommendations([
  item({ knowledgePoints: ['条件概率'], quizCount: 4, correctCount: 3 }),
  item({ knowledgePoints: ['指针与数组'], quizCount: 4, correctCount: 1 }),
])
ok(recs.items[0].name === '指针与数组', '错误率高的排前面', recs.items.map((i) => i.name))
ok(recs.items[0].weight === 'high' && recs.items[1].weight === 'mid', '权重按错误率给出')
ok(recs.hint.includes('指针与数组'), '提示语指向最薄弱项', recs.hint)
ok(buildRecommendations([]).items.length === 0, '无错题时推荐为空')

section('5. 复习计划 buildReviewPlan')
const plan = buildReviewPlan([
  item({ knowledgePoints: ['指针与数组'], mastered: true, reviewAt: NOW - 5000 }),
  item({ knowledgePoints: ['指针与数组'], mastered: false }),
  item({ knowledgePoints: ['定积分'], mastered: false }),
], settings, NOW)
ok(plan !== null && plan.items.length === 2, '按知识点分成 2 组', plan && plan.items.map((i) => i.title))
ok(plan.items[0].count === 2 && plan.items[0].minutes === 5, '组内题数与估算时长（2 题 × 2.5 → 5）', plan.items[0])
ok(plan.estimateMinutes === Math.round(3 * MINUTES_PER_REVIEW_ITEM), '总时长 = 各组之和', plan.estimateMinutes)
ok(buildReviewPlan([item({ mastered: true, reviewAt: NOW + DAY })], settings, NOW) === null, '没有到期题目时无复习计划')

section('6. 学习总结 buildSummary（规则生成，不调模型）')
const sum = buildSummary({
  book: [item({ quizCount: 4, correctCount: 1 }), item({ mastered: true, quizCount: 2, correctCount: 2 })],
  settings,
  now: NOW,
})
ok(!!sum && sum.text.includes('错题 2 道'), '含错题总数', sum && sum.text)
ok(!!sum && sum.text.includes('已掌握 1 道'), '含已掌握数', sum && sum.text)
ok(!!sum && sum.text.includes('最薄弱的是「指针与数组」'), '含最薄弱知识点')
ok(!!sum && /正确率 \d+%/.test(sum.text), '含练习正确率')
ok(buildSummary({ book: [], settings, now: NOW }) === null, '无错题时不显示总结（空态隐藏）')

section('7. 聚合 buildHomeStats')
const stats = buildHomeStats({
  book: [item({ mastered: false }), item({ quizCount: 3, correctCount: 0 })],
  records: [rec('explain', 8, NOW), rec('followup', 1, NOW)],
  settings,
  now: NOW,
})
ok(stats.overview.minutes === 9, '今日时长 = 所有类型 minutes 之和（讲解 8 + 追问 1）', stats.overview.minutes)
ok(stats.overview.questions === 1, '完成题目 1（followup 不算）', stats.overview.questions)
ok(stats.overview.pendingReview === 2, '待复习 2', stats.overview.pendingReview)
const empty = buildHomeStats({ book: [], records: [], settings, now: NOW })
ok(empty.overview.minutes === 0 && empty.overview.questions === 0 && empty.overview.pendingReview === 0, '新用户三项为 0')
ok(empty.summary === null && empty.reviewPlan === null, '新用户不显示总结与复习计划')
ok(empty.recommendations.items.length === 0, '新用户无推荐')

section('8. 假数据已清除（源码契约）')
const read = (p) => {
  try { return fs.readFileSync(new URL(p, import.meta.url), 'utf8') } catch { return '' }
}
ok(!fs.existsSync(new URL('./src/lib/mock/data.js', import.meta.url)), 'mock/data.js 已删除')
const adapter = read('./src/lib/adapter/home.js')
ok(!adapter.includes('mockData') && !adapter.includes("MOCK.home"), 'adapter 不再读 mock')
ok(adapter.includes('buildHomeStats'), 'adapter 走真实计算')
ok(read('./src/config/app.js').includes('home: false'), 'MOCK.home 已关闭')
const hp = read('./src/pages/HomePage.vue')
ok(!hp.includes('bundle.user'), '首页不再使用演示用户')
ok(hp.includes('statsSummary'), '连续天数取自真实打卡统计')

console.log('\n==============================================')
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
