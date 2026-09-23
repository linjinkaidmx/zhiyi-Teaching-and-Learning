/**
 * 批次4 前端测试：学习时长纯逻辑
 * 用法：node _test_studytime.mjs
 */
const { addMinutesToLatest, sumMinutes, dailyMinutes, minutesSummary, humanMinutes, MAX_MINUTES_PER_RECORD } =
  await import('./src/lib/studyTime.js')

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) {
    pass += 1
    console.log('  ✓ ' + label)
  } else {
    fail += 1
    console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
  }
}
const section = (t) => console.log('\n' + t)

const DAY = 86400000
const now = Date.now()

section('1. 累加到「最近一条同类型记录」')
let recs = [
  { id: 1, type: 'explain', minutes: 2, createdAt: now - 3 * DAY },
  { id: 2, type: 'quiz', minutes: 1, createdAt: now - 2 * DAY },
  { id: 3, type: 'explain', minutes: 0, createdAt: now - DAY },
]
ok(addMinutesToLatest(recs, 'explain', 3.5) === true, '累加成功')
ok(recs[2].minutes === 3.5, '加到最新那条 explain 上（而不是较早的）', recs[2].minutes)
ok(recs[0].minutes === 2, '较早的记录不受影响')
ok(addMinutesToLatest(recs, 'debug', 5) === false, '没有该类型记录时返回 false（不凭空造记录）')

section('2. 噪声过滤与封顶')
ok(addMinutesToLatest(recs, 'quiz', 0.05) === false, '少于 9 秒不计入（避免噪声）')
ok(addMinutesToLatest(recs, 'quiz', 0.2) === true, '超过阈值就计入')
ok(Math.abs(recs[1].minutes - 1.2) < 1e-6, '累加值正确', recs[1].minutes)
addMinutesToLatest(recs, 'explain', 999)
ok(recs[2].minutes === MAX_MINUTES_PER_RECORD, `单条封顶 ${MAX_MINUTES_PER_RECORD} 分钟（防"忘了关标签页"）`, recs[2].minutes)
ok(addMinutesToLatest([], 'explain', 10) === false, '空数组安全')
ok(addMinutesToLatest(null, 'explain', 10) === false, 'null 安全')

section('3. 区间合计')
// 「今天」的记录锚定今天中午：now-1h 在午夜刚过时会落进昨天，导致假失败
const todayNoon = new Date(new Date().setHours(0, 0, 0, 0)).getTime() + 12 * 3600 * 1000
recs = [
  { type: 'explain', minutes: 10, createdAt: todayNoon },         // 今天
  { type: 'quiz', minutes: 5, createdAt: now - 3 * DAY },
  { type: 'quiz', minutes: 2, createdAt: now - 10 * DAY },        // 超出 7 天窗口
]
ok(sumMinutes(recs) === 17, '不传起点则全算', sumMinutes(recs))
ok(sumMinutes(recs, now - 2 * DAY) === 10, '只算近 2 天', sumMinutes(recs, now - 2 * DAY))
ok(sumMinutes([], now) === 0, '空数组为 0')

section('4. 近 7 天每日时长')
const daily = dailyMinutes(recs, 7)
ok(daily.length === 7, '返回 7 天')
ok(daily[6].minutes === 10, '今天的记录进了今天这一格', daily[6].minutes)
ok(daily[3].minutes === 5, '3 天前 = 5 分钟', daily[3].minutes)
ok(daily[0].minutes === 0, '超出窗口的记录不出现（且最早那格为 0）', daily[0].minutes)
ok(/^\d+\/\d+$/.test(daily[0].label), '标签形如 M/D', daily[0].label)

section('5. 汇总')
const sum = minutesSummary(recs)
ok(sum.week === 15, '本周合计 15 分钟', sum.week)
ok(sum.today === 10, '今天 10 分钟', sum.today)
ok(sum.activeDays === 2, '有记录的天数 2', sum.activeDays)
ok(sum.dailyAvg === 7.5, '日均按有记录的天算（15/2）', sum.dailyAvg)
ok(minutesSummary([]).week === 0, '无数据时为 0')
ok(minutesSummary([]).dailyAvg === 0, '无数据日均不为 NaN', minutesSummary([]).dailyAvg)

section('6. 人话格式化')
ok(humanMinutes(0) === '0 分钟', '0 分钟')
ok(humanMinutes(0.2) === '不到 1 分钟', '不足一分钟的表述', humanMinutes(0.2))
ok(humanMinutes(45) === '45 分钟', '45 分钟')
ok(humanMinutes(60) === '1 小时', '整小时')
ok(humanMinutes(95) === '1 小时 35 分', '小时+分钟', humanMinutes(95))
ok(humanMinutes(NaN) === '0 分钟', 'NaN 兜底')

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
