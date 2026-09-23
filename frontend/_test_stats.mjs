/**
 * stats.js / achievements.js 纯逻辑测试（Node 直接运行，不需要浏览器）
 * 用法：node _test_stats.mjs
 *
 * 原理：把 src/stats.js 里的 './achievements.js' 改写成临时文件名后落成 .mjs，Node 即可按 ESM 加载。
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(here, 'src')
const TMP_STATS = path.join(here, '_stats_tmp.mjs')
const TMP_ACH = path.join(here, '_ach_tmp.mjs')

writeFileSync(
  TMP_STATS,
  readFileSync(path.join(srcDir, 'stats.js'), 'utf8').replace("'./achievements.js'", "'./_ach_tmp.mjs'"),
)
writeFileSync(TMP_ACH, readFileSync(path.join(srcDir, 'achievements.js'), 'utf8'))

const S = await import('./_stats_tmp.mjs')
const { ACHIEVEMENTS } = await import('./_ach_tmp.mjs')

let pass = 0
let fail = 0
function ok(cond, label, extra) {
  if (cond) {
    pass++
    console.log('  ✓ ' + label)
  } else {
    fail++
    console.log('  ✗ ' + label + (extra !== undefined ? '  → 实际: ' + JSON.stringify(extra) : ''))
  }
}
const eq = (got, want, label) => ok(got === want, label, { got, want })

function section(t) {
  console.log('\n' + t)
}

// ---------------------------------------------------------------- 1. 连续天数
section('1. 连续天数与打卡幂等')
{
  let r = S.record(S.emptyStats(), 'explain', { day: '2026-09-01' })
  eq(r.stats.streak.current, 1, '首次打卡 → current=1')
  eq(r.stats.days['2026-09-01'].checked, true, '当日标记为已打卡')

  r = S.record(r.stats, 'quiz', { day: '2026-09-02', correct: true })
  r = S.record(r.stats, 'explain', { day: '2026-09-03' })
  r = S.record(r.stats, 'followup', { day: '2026-09-04' })
  eq(r.stats.streak.current, 4, '连续 4 天 → current=4')
  eq(r.stats.streak.longest, 4, 'longest 同步为 4')

  const before = JSON.stringify(r.stats.streak)
  r = S.record(r.stats, 'quiz', { day: '2026-09-04', correct: false })
  eq(JSON.stringify(r.stats.streak), before, '同日再次记录：连续天数不变（幂等）')
  eq(r.stats.days['2026-09-04'].count, 2, '同日计数正常累加')
}

// ---------------------------------------------------------------- 2. 护盾
section('2. 护盾：发放 / 消耗 / 归零')
{
  // 连打 7 天 → 补 1 张护盾
  let r = { stats: S.emptyStats() }
  for (let i = 1; i <= 7; i++) {
    r = S.record(r.stats, 'quiz', { day: `2026-09-0${i}`, correct: true })
  }
  eq(r.stats.streak.current, 7, '连续 7 天 → current=7')
  eq(r.stats.streak.shields, 1, '满 7 天自动补 1 张护盾')
  eq(r.stats.streak.nextShieldIn, 7, '距下一张还差 7 天')

  // 断 1 天（9/9）→ 自动扣盾保链
  r = S.record(r.stats, 'explain', { day: '2026-09-09' })
  eq(r.stats.streak.current, 8, '断 1 天：护盾保链 → current=8')
  eq(r.stats.streak.shields, 0, '消耗 1 张护盾')
  eq(r.stats.days['2026-09-08'].shield, true, '被护盾覆盖的那天标记 shield')

  // 再断 1 天但已无护盾 → 归零
  r = S.record(r.stats, 'explain', { day: '2026-09-11' })
  eq(r.stats.streak.current, 1, '无护盾可用 → 从 1 重来')
  eq(r.stats.streak.longest, 8, '历史最长连续保留为 8')

  // 护盾上限 2 张
  let r2 = { stats: S.emptyStats() }
  for (let i = 1; i <= 21; i++) {
    const day = S.shiftDay('2026-09-01', i - 1)
    r2 = S.record(r2.stats, 'quiz', { day, correct: true })
  }
  eq(r2.stats.streak.shields, 2, '连打 21 天：护盾封顶 2 张')

  // 断 3 天（gap=3）仍可用护盾；断 4 天不可用
  let r3 = S.record(S.emptyStats(), 'quiz', { day: '2026-09-01', correct: true })
  r3.stats.streak.shields = 1
  r3 = S.record(r3.stats, 'quiz', { day: '2026-09-04', correct: true })
  eq(r3.stats.streak.current, 2, '日期差 3（漏 2 天）：护盾仍可保链')

  let r4 = S.record(S.emptyStats(), 'quiz', { day: '2026-09-01', correct: true })
  r4.stats.streak.shields = 2
  r4 = S.record(r4.stats, 'quiz', { day: '2026-09-05', correct: true })
  eq(r4.stats.streak.current, 1, '日期差 4（漏 3 天）：护盾不救，归零')
  eq(r4.stats.streak.shields, 2, '归零场景不消耗护盾')
}

// ---------------------------------------------------------------- 3. 每日目标
section('3. 每日目标与周满勤')
{
  let r = { stats: S.emptyStats() }
  const DAY = '2026-09-14' // 周一
  r = S.record(r.stats, 'quiz', { day: DAY, correct: true })
  eq(r.stats.days[DAY].goalMet, false, '目标 5 题、只做 1 题 → 未达成')
  for (let i = 0; i < 4; i++) r = S.record(r.stats, 'quiz', { day: DAY, correct: i % 2 === 0 })
  eq(r.stats.days[DAY].goalMet, true, '累计 5 题 → 达成')

  // 一周 7 天每天达成目标 → 周满勤
  let w = { stats: S.emptyStats() }
  for (let d = 0; d < 7; d++) {
    const day = S.shiftDay('2026-09-14', d)
    for (let i = 0; i < 5; i++) w = S.record(w.stats, 'quiz', { day, correct: true })
  }
  eq(S.computeWeekFull(w.stats.days, w.stats.settings), 1, '一周 7 天全达成 → 周满勤计数 1')
  ok(w.stats.achievements.week_full !== undefined, '周满勤成就解锁')
  ok(w.stats.achievements.streak_7 !== undefined, '连续 7 天成就解锁')

  // 关闭目标后不再判定周满勤
  let off = JSON.parse(JSON.stringify(w.stats))
  off.settings.goalEnabled = false
  eq(S.computeWeekFull(off.days, off.settings), 0, '关闭每日目标 → 不判定周满勤')

  // 每日目标口径：自测 + 针对性练习
  let p = S.record(S.emptyStats(), 'practice', { day: '2026-09-14', correct: true })
  eq(S.goalQuestions(p.stats, '2026-09-14'), 1, '练习也计入每日题数')
  ok(p.stats.totals.correct === 1, '练习答对计入 correct')
}

// ---------------------------------------------------------------- 4. 历史回填
section('4. 历史回填')
{
  const items = []
  for (let i = 0; i < 12; i++) {
    items.push({
      quizCount: i < 6 ? 10 : 5,
      correctCount: i < 6 ? 9 : 4,
      followups: i < 5 ? [{}, {}, {}, {}, {}] : [],
      reteach: i < 2 ? [{}, {}, {}] : [],
      mastered: i < 6,
    })
  }
  const r = S.backfill(S.emptyStats(), items)
  eq(r.stats.totals.quiz, 6 * 10 + 6 * 5, '回填 quiz 总数 = 90')
  eq(r.stats.totals.correct, 6 * 9 + 6 * 4, '回填 correct 总数 = 78')
  eq(r.stats.totals.followup, 25, '回填追问 25 次')
  eq(r.stats.totals.masteredMax, 6, '回填已掌握 6 题')
  ok(r.stats.achievements.correct_10 !== undefined, '答对 10 题成就已回填解锁')
  ok(r.stats.achievements.correct_100 === undefined, '答对 100 题尚未达标（78 < 100）')
  ok(r.stats.achievements.followup_20 !== undefined, '追问 20 次成就回填解锁')
  ok(r.stats.achievements.mastered_20 === undefined, '掌握 20 题未达标（6 < 20）')
  eq(r.stats.achievements.correct_10.backfilled, true, '回填解锁带 backfilled 标记')
  eq(r.stats.streak.current, 0, '坚持类不从历史推算（current 仍为 0）')

  const again = S.backfill(r.stats, items)
  eq(again.unlocked.length, 0, '重复回填不重复计数')
  eq(again.stats.totals.quiz, 90, '重复回填不重复累加')
}

// ---------------------------------------------------------------- 5. 云端合并
section('5. 云端合并')
{
  // 本地：9/1~9/3 连续；云端：9/2~9/5（云端更晚）
  let local = { stats: S.emptyStats() }
  for (const d of ['2026-09-01', '2026-09-02', '2026-09-03']) local = S.record(local.stats, 'quiz', { day: d, correct: true })
  let cloud = { stats: S.emptyStats() }
  for (const d of ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']) {
    for (let i = 0; i < 2; i++) cloud = S.record(cloud.stats, 'quiz', { day: d, correct: true })
  }
  const m = S.mergeStats(local.stats, cloud.stats)
  eq(Object.keys(m.days).length, 5, 'days 取并集（5 天）')
  eq(m.days['2026-09-01'].count, 1, '本地独有的一天保留')
  eq(m.days['2026-09-05'].count, 2, '云端独有的一天保留')
  eq(m.days['2026-09-02'].count, 2, '同日取较大计数（2 > 1）')
  // totals 逐键取 max：故意不求和 —— 合并结果会回推云端，求和会在每次拉取时重复累加（膨胀）
  eq(m.totals.quiz, 8, 'totals 逐键取 max（幂等安全；跨设备计数偏保守）')
  const m5 = S.mergeStats(m, cloud.stats)
  eq(m5.totals.quiz, m.totals.quiz, '重复合并幂等（不会越合越大）')
  eq(Object.keys(m5.days).length, 5, '重复合并后天数不变')
  eq(m.streak.lastCheckin, '2026-09-05', '连续以 lastCheckin 较晚的一方为主')
  eq(m.streak.current, 4, '云端连续 4 天保留')

  // achievements 取解锁更早的
  const a = S.emptyStats()
  a.achievements.correct_10 = { at: '2026-09-03T10:00:00.000Z' }
  const b = S.emptyStats()
  b.achievements.correct_10 = { at: '2026-09-01T10:00:00.000Z' }
  const m2 = S.mergeStats(a, b)
  eq(m2.achievements.correct_10.at, '2026-09-01T10:00:00.000Z', '成就解锁时间取更早的')

  // settings 以本地为准 + shields 取 max
  const c = S.emptyStats()
  c.settings = { goalEnabled: false, goalQuestions: 12 }
  const d = S.emptyStats()
  d.settings = { goalEnabled: true, goalQuestions: 3 }
  d.streak.shields = 2
  const m3 = S.mergeStats(c, d)
  eq(m3.settings.goalQuestions, 12, '设置以本地为准')
  eq(m3.settings.goalEnabled, false, '设置开关以本地为准')
  eq(m3.streak.shields, 2, '护盾取较大值（不因换设备丢护盾）')

  // 空云端 → 直接用本地
  const m4 = S.mergeStats(local.stats, null)
  eq(Object.keys(m4.days).length, 3, '云端为空时保留本地数据')

  // isRicher
  ok(S.isRicher(cloud.stats, local.stats) === true, '云端天数更多 → isRicher(local) 为 false')
  ok(S.isRicher(null, local.stats) === false, '本地为空 → 不判定为更丰富')
}

// ---------------------------------------------------------------- 6. 跨月 / 跨年 / 时区
section('6. 跨月跨年与时间边界')
{
  let r = S.record(S.emptyStats(), 'quiz', { day: '2026-12-31', correct: true })
  r = S.record(r.stats, 'quiz', { day: '2027-01-01', correct: true })
  eq(r.stats.streak.current, 2, '跨年连续：12-31 → 01-01 计为连续')
  eq(S.dayDiff('2026-12-31', '2027-01-01'), 1, '跨年日期差为 1')

  r = S.record(r.stats, 'quiz', { day: '2027-03-01', correct: true })
  eq(r.stats.streak.current, 1, '跨月且断档 → 归零')

  ok(S.dateKey(new Date(2026, 8, 19, 0, 30)) === '2026-09-19', '凌晨 0:30 归为当天（本地时区，不用 UTC）')
  eq(S.dayDiff('2026-02-28', '2026-03-01'), 1, '平年 2 月边界')
  eq(S.dayDiff('2028-02-28', '2028-03-01'), 2, '闰年 2 月边界')
}

// ---------------------------------------------------------------- 7. 健壮性
section('7. 健壮性与体积控制')
{
  eq(S.normalize(null).streak.current, 0, 'null 输入 → 空统计')
  eq(S.normalize('坏数据').totals.quiz, 0, '字符串输入 → 空统计')
  const dirty = S.normalize({ days: { bad: {}, '2026-09-01': { count: 'x', actions: null } }, streak: { current: -5, shields: 99 }, achievements: { x: 'y' } })
  eq(dirty.streak.current, 0, '负数连续被修正为 0')
  eq(dirty.streak.shields, 2, '护盾超出上限被裁剪为 2')
  eq(Object.keys(dirty.days).length, 1, '非法日期键被丢弃')
  eq(Object.keys(dirty.achievements).length, 0, '格式错误的成就记录被丢弃')

  let big = S.emptyStats()
  for (let i = 0; i < 500; i++) {
    big = S.record(big, 'quiz', { day: S.shiftDay('2024-01-01', i), correct: true }).stats
  }
  eq(Object.keys(big.days).length, 400, '超过 400 天自动压缩为最近 400 天')

  // 速查分类去重
  let ref = S.record(S.emptyStats(), 'ref', { category: 'calc' })
  ref = S.record(ref.stats, 'ref', { category: 'calc' })
  eq(ref.stats.refSeen.length, 1, '重复浏览同一分类只记一次')
  for (const c of ['linear', 'prob', 'algo', 'complexity']) ref = S.record(ref.stats, 'ref', { category: c })
  ok(ref.stats.achievements.ref_all !== undefined, '浏览全部 5 个分类 → 通览全书解锁')

  eq(ACHIEVEMENTS.length, 15, '成就总数为 15 个')
}

// ---------------------------------------------------------------- 汇总
console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)

// 清理临时文件
for (const f of [TMP_STATS, TMP_ACH]) {
  try { unlinkSync(f) } catch { /* ignore */ }
}
process.exit(fail === 0 ? 0 : 1)
