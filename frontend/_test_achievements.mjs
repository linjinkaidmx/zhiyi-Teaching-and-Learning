/**
 * 成就体系离线回归（纯逻辑，不依赖浏览器/网络）
 * 用法：node _test_achievements.mjs
 */
import {
  emptyStats, record, evaluate, buildContext, backfill, computeEarlyStreak, dayGap, prevStudyDay,
} from './src/stats.js'
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, GROUPS, RARITY, countByRarity } from './src/achievements.js'

let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
const T = (h) => new Date(2026, 8, 22, h, 30, 0).getTime()  // 2026-09-22 指定小时
const day = (d) => `2026-09-${String(d).padStart(2, '0')}`

console.log('\n===== 定义完整性 =====')
ok(ACHIEVEMENTS.length === 51, '成就总数 51 枚', ACHIEVEMENTS.length)
ok(new Set(ACHIEVEMENTS.map((a) => a.key)).size === ACHIEVEMENTS.length, '成就 key 无重复')
ok(GROUPS.length === 8, '分组数 8', GROUPS.length)
ok(ACHIEVEMENTS.every((a) => GROUPS.includes(a.group)), '每个成就的分组都在 GROUPS 里')
ok(ACHIEVEMENTS.every((a) => RARITY[a.rarity]), '每个成就都有合法稀有度')
ok(ACHIEVEMENTS.every((a) => a.totem && a.desc && a.target > 0), '每个成就都有图腾与条件')
ok(ACHIEVEMENTS.filter((a) => a.hidden).length === 3, '隐藏成就 3 枚', ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.name))
const byR = {}
ACHIEVEMENTS.forEach((a) => { byR[a.rarity] = (byR[a.rarity] || 0) + 1 })
ok(byR.common > byR.rare && byR.rare > byR.epic && byR.epic >= byR.legend, '稀有度呈金字塔分布', byR)

console.log('\n===== 新计数器与标记 =====')
let s = emptyStats()
let r = record(s, 'search', { day: day(22), at: T(14) })
ok(r.stats.totals.search === 1, '搜索计数 +1', r.stats.totals.search)
s = r.stats
s = record(s, 'bank', { day: day(22), at: T(14) }).stats
ok(s.totals.bank === 1, '题库秒答计数 +1')

// 深夜（0-5 点）按天去重
s = emptyStats()
s = record(s, 'explain', { day: day(22), at: T(3) }).stats
s = record(s, 'explain', { day: day(22), at: T(4) }).stats
ok(s.totals.night === 1, '深夜学习按天去重只计 1 次', s.totals.night)
s = record(s, 'explain', { day: day(23), at: T(2) }).stats
ok(s.totals.night === 2, '第二天深夜再计 1 次', s.totals.night)

// 早起
s = emptyStats()
s = record(s, 'explain', { day: day(22), at: T(7) }).stats
ok(!!s.days[day(22)].early, '7 点学习标记 early')
s = record(s, 'explain', { day: day(23), at: T(6) }).stats
ok(computeEarlyStreak(s.days) === 2, '连续两天早起 → 2', computeEarlyStreak(s.days))
s = record(s, 'explain', { day: day(24), at: T(9) }).stats
ok(!s.days[day(24)].early, '9 点学习不标记 early')
ok(computeEarlyStreak(s.days) === 0, '当天非早起 → 连续段归零', computeEarlyStreak(s.days))

// 回归（间隔 ≥3 天）
s = emptyStats()
s = record(s, 'explain', { day: day(10), at: T(14) }).stats
s = record(s, 'explain', { day: day(13), at: T(14) }).stats
ok(s.totals.comeback === 0, '间隔 2 天不算回归', s.totals.comeback)
s = record(s, 'explain', { day: day(18), at: T(14) }).stats
ok(s.totals.comeback === 1, '间隔 4 天算回归', s.totals.comeback)

// 多图 / 事件
s = emptyStats()
s = record(s, 'search', { day: day(22), at: T(14), images: 5 }).stats
ok(s.totals.multi === 1, '一次传 5 张图 → 多题连发 +1')
s = record(s, 'quiz', { day: day(22), at: T(14), perfect: true, correct: true }).stats
ok(s.totals.perfect === 1, '满分事件 +1')
s = record(s, 'hw', { day: day(22), at: T(14), hwPerfect: true }).stats
ok(s.totals.hwPerfect === 1, '作业满分事件 +1')
s = record(s, 'test', { day: day(22), at: T(14), top3: true }).stats
ok(s.totals.top3 === 1, '班级前三事件 +1')
s = record(s, 'exam', { day: day(22), at: T(14), examPerfect: true }).stats
ok(s.totals.examPerfect === 1, '模拟满分事件 +1')
s = record(s, 'quiz', { day: day(22), at: T(14), ontime: true }).stats
ok(s.totals.ontime === 1, '到期清完事件标记')

// 算法 id 去重
s = emptyStats()
s = record(s, 'algo', { day: day(22), at: T(14), algoId: 'quick_sort' }).stats
s = record(s, 'algo', { day: day(22), at: T(14), algoId: 'quick_sort' }).stats
s = record(s, 'algo', { day: day(22), at: T(14), algoId: 'merge_sort' }).stats
ok(s.totals.algo === 3 && s.algoSeen.length === 2, '算法计数 3 次、去重看过 2 个', { algo: s.totals.algo, seen: s.algoSeen.length })

console.log('\n===== 成就解锁链 =====')
s = emptyStats()
r = record(s, 'search', { day: day(22), at: T(14) })
ok(r.unlocked.includes('first_search'), '首次识别解锁「初次识题」', r.unlocked)
s = r.stats
ok(s.achievements.first_search && s.achievements.first_search.at, '解锁记录带时间戳')

// 未达标不解锁
s = emptyStats()
r = record(s, 'explain', { day: day(22), at: T(14) })
ok(!r.unlocked.includes('explain_10'), '讲解 1 次不解锁十解成习')

// 隐藏成就：backfill 后按数据推导
const items = [
  { quizCount: 6, correctCount: 5, mastered: true, streak: 2, followups: [1, 2], reteach: [1] },
  { quizCount: 2, correctCount: 1, mastered: false, streak: 1, followups: [], reteach: [] },
]
let bf = backfill(emptyStats(), items)
ok(bf.stats.totals.quiz === 8 && bf.stats.totals.correct === 6, '回填自测/答对数', { quiz: bf.stats.totals.quiz, correct: bf.stats.totals.correct })
ok(bf.stats.totals.masteredMax === 1, '回填掌握数')
ok(bf.unlocked.includes('sticky_fix'), '回填后解锁「顽疾攻克」（同题连对 2 次）', bf.unlocked)
ok(bf.unlocked.includes('never_give_up'), '同题复习 6 次（≥5）解锁隐藏成就「不离不弃」', bf.unlocked.filter((k) => k === 'never_give_up'))
const bf2 = backfill(emptyStats(), [{ quizCount: 4, correctCount: 4, mastered: false, streak: 1 }])
ok(!bf2.unlocked.includes('never_give_up'), '同题复习 4 次不足门槛，不解锁', bf2.unlocked.filter((k) => k === 'never_give_up'))

console.log('\n===== 判定健壮性 =====')
s = emptyStats()
const ctx = buildContext(s, {})
let threw = 0
for (const a of ACHIEVEMENTS) { try { a.value(ctx) } catch { threw++ } }
ok(threw === 0, '空数据下所有 value() 不抛错', threw)
s = emptyStats()
s = record(s, 'explain', { day: day(22), at: T(3) }).stats
ok(s.totals.night === 1 && buildContext(s, {}).night === 1, 'night 进入 ctx')
ok(buildContext(s, { maxQuizPerItem: 7 }).maxQuizPerItem === 7, 'maxQuizPerItem 走 extra')
ok(dayGap('2026-09-18', '2026-09-22') === 4, 'dayGap 计算正确')
ok(prevStudyDay({ '2026-09-10': { count: 1 }, '2026-09-13': { count: 2 } }, '2026-09-20') === '2026-09-13', 'prevStudyDay 取最近有动作日')

// 序列化往返（normalize 保真）
s = emptyStats()
s = record(s, 'explain', { day: day(22), at: T(3), algoId: 'x' }).stats
s = record(s, 'search', { day: day(22), at: T(3), images: 6 }).stats
const round = JSON.parse(JSON.stringify(s))
const again = record(round, 'explain', { day: day(23), at: T(14) }).stats
ok(again.totals.night === 1 && again.totals.multi === 1 && again.days[day(22)].night === true, 'JSON 往返后每日标记不丢', { night: again.totals.night, multi: again.totals.multi, flag: again.days[day(22)].night })

const rar = countByRarity(ACHIEVEMENTS.map((a) => ({ ...a, done: a.rarity === 'common' })))
ok(rar.common.done === rar.common.total && rar.legend.done === 0, '按稀有度统计正确', rar)

console.log(`\n===== 结果：通过 ${pass}，失败 ${fail} =====`)
process.exit(fail > 0 ? 1 : 0)
