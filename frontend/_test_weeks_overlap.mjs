/** 离线断言：weeksOverlap / parseRanges / WeekPicker 文本压缩逻辑（不依赖浏览器） */
import { weeksOverlap, weekActive, parseRanges, formToWeeks } from './src/lib/schedulePeriods.js'

let fail = 0
const ok = (cond, name) => { console.log((cond ? '✓ ' : '✗ ') + name); if (!cond) fail += 1 }
const EVERY = { type: 'every' }, ODD = { type: 'odd' }, EVEN = { type: 'even' }
const C157 = { type: 'custom', ranges: [[1, 1], [5, 5], [7, 7]] }
const C238 = { type: 'custom', ranges: [[2, 3], [8, 8]] }

ok(weeksOverlap(ODD, EVEN, 20) === false, '单周 vs 双周 不重叠')
ok(weeksOverlap(ODD, EVERY, 20) === true, '单周 vs 每周 重叠')
ok(weeksOverlap(C157, ODD, 20) === true, '第1,5,7周 vs 单周（1,5,7均为单）重叠')
ok(weeksOverlap(C157, EVEN, 20) === false, '第1,5,7周 vs 双周 不重叠')
ok(weeksOverlap(C157, C238, 20) === false, '1,5,7 vs 2,3,8 不重叠')
ok(weeksOverlap(C157, { type: 'custom', ranges: [[7, 10]] }, 20) === true, '第7周交集')
ok(weekActive(C157, 5) === true && weekActive(C157, 6) === false, 'custom 单周命中判定')
ok(JSON.stringify(parseRanges('2-8, 12，16')) === '[[2,8],[12,12],[16,16]]', 'parseRanges 多分隔符')
ok(JSON.stringify(formToWeeks('custom', '1,5,7').ranges) === '[[1,1],[5,5],[7,7]]', 'formToWeeks custom')

console.log(fail ? `FAIL ${fail}` : 'ALL PASS')
process.exit(fail ? 1 : 0)
