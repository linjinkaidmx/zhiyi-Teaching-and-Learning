/**
 * termCalc.js 纯逻辑测试（学期 / 周数 / 周规则）
 * 用法：node _test_termcalc.mjs
 */
import {
  parseDate, mondayOf, dayOfWeek, weekIndexFor, weekActiveIn, formatWeeks, weeksBadge,
  examOnDate, toDateStr, daysUntil,
} from './src/lib/termCalc.js'

let pass = 0
let fail = 0
const ok = (cond, label, extra) => { if (cond) { pass += 1; console.log('  ✓ ' + label) } else { fail += 1; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) } }
const sec = (t) => console.log('\n' + t)

sec('1. 日期解析（本地时区）')
const d = parseDate('2026-09-20')
ok(d !== null && d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() === 20, '2026-09-20 正确')
ok(parseDate('2026-9-7') !== null, '单数字月/日也能解析')
ok(parseDate('bad') === null, '非法字符串返回 null')
ok(parseDate('') === null, '空串返回 null')

sec('2. 周一与星期')
ok(dayOfWeek(parseDate('2026-09-21')) === 1, '2026-09-21 是周一', dayOfWeek(parseDate('2026-09-21')))
ok(dayOfWeek(parseDate('2026-09-20')) === 7, '2026-09-20 是周日', dayOfWeek(parseDate('2026-09-20')))
const mon = mondayOf(parseDate('2026-09-20')) // 周日
ok(toDateStr(mon) === '2026-09-14', '周日所在周的周一是 09-14', toDateStr(mon))
ok(toDateStr(mondayOf(parseDate('2026-09-21'))) === '2026-09-21', '周一所在周的周一就是自己')

sec('3. 第几周（开学第一周=1）')
const start = '2026-09-07' // 周一
ok(weekIndexFor('2026-09-07', start) === 1, '开学当天 = 第1周')
ok(weekIndexFor('2026-09-14', start) === 2, '第二周周一 = 第2周')
ok(weekIndexFor('2026-09-20', start) === 2, '第二周周日仍 = 第2周', weekIndexFor('2026-09-20', start))
ok(weekIndexFor('2026-09-06', start) === 0, '开学前一天 = 第0周（未开学）', weekIndexFor('2026-09-06', start))

sec('4. 周规则判断')
ok(weekActiveIn({ type: 'every' }, 3) === true, '每周 第3周上课')
ok(weekActiveIn({ type: 'odd' }, 3) === true, '单周 第3周上课')
ok(weekActiveIn({ type: 'odd' }, 4) === false, '单周 第4周不上')
ok(weekActiveIn({ type: 'even' }, 4) === true, '双周 第4周上课')
ok(weekActiveIn({ type: 'even' }, 3) === false, '双周 第3周不上')
ok(weekActiveIn({ type: 'custom', ranges: [[2, 8], [12, 16]] }, 5) === true, '自定义 2-8,12-16 的第5周上课')
ok(weekActiveIn({ type: 'custom', ranges: [[2, 8], [12, 16]] }, 10) === false, '自定义 第10周不上')
ok(weekActiveIn({ type: 'custom', ranges: [[2, 8], [12, 16]] }, 15) === true, '自定义 第15周上课')
ok(weekActiveIn(null, 3) === true, '空规则默认每周')
ok(weekActiveIn({ type: 'every' }, 0) === false, '第0周（未开学）不上课')

sec('5. 周规则显示')
ok(formatWeeks({ type: 'every' }) === '每周', '每周')
ok(formatWeeks({ type: 'odd' }) === '单周', '单周')
ok(formatWeeks({ type: 'even' }) === '双周', '双周')
ok(formatWeeks({ type: 'custom', ranges: [[2, 8]] }) === '第2-8周', '区间')
ok(formatWeeks({ type: 'custom', ranges: [[3, 3]] }) === '第3周', '单周区间')
ok(formatWeeks({ type: 'custom', ranges: [[2, 8], [12, 16]] }) === '第2-8周、第12-16周', '多区间')
ok(weeksBadge({ type: 'every' }) === '', '每周不显示角标')
ok(weeksBadge({ type: 'odd' }) === '单周', '单周角标')

sec('6. 考试与倒计时')
ok(examOnDate({ date: '2026-09-20' }, '2026-09-20') === true, '考试命中当天')
ok(examOnDate({ date: '2026-09-21' }, '2026-09-20') === false, '考试不在今天')
ok(examOnDate(null, '2026-09-20') === false, '空考试安全')
ok(daysUntil('2026-09-23', '2026-09-20') === 3, '3 天后')
ok(daysUntil('2026-09-20', '2026-09-20') === 0, '今天')
ok(daysUntil('2026-09-17', '2026-09-20') === -3, '已过 3 天')

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
