/**
 * 课程归类匹配 · 纯逻辑回归（离线自包含）
 * 用法：node _test_coursematch.mjs
 */
import { matchCourse, courseNameOf } from './src/lib/courseMatch.js'

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

const courses = [
  { id: 'c1', name: '数据结构与算法' },
  { id: 'c2', name: '概率论与数理统计' },
  { id: 'c3', name: '大学英语（二）' },
]

section('1. 精确匹配')
ok(matchCourse('数据结构', [{ id: 'a', name: '数据结构' }])?.id === 'a', '完全同名命中')

section('2. 课程名包含 subject')
ok(matchCourse('概率论', courses)?.id === 'c2', '「概率论」→「概率论与数理统计」', matchCourse('概率论', courses)?.id)

section('3. subject 包含课程关键词')
ok(matchCourse('高等数学（下）', [{ id: 'x', name: '高等数学' }])?.id === 'x', '「高等数学（下）」→「高等数学」')

section('4. 匹配不上')
ok(matchCourse('汇编语言', courses) === null, '无相近课程返回 null')
ok(matchCourse('', courses) === null, '空 subject 返回 null')
ok(matchCourse('概率论', []) === null, '课程表为空返回 null')
ok(matchCourse('概率论', [{ id: 'y' }]) === null, '课程无 name 不会误匹配')

section('5. 归一化（全角/空白/后缀）')
ok(matchCourse('概率论', [{ id: 'z', name: '概率论与数理统计' }])?.id === 'z', '忽略空白差异')
ok(matchCourse('概率论课程', [{ id: 'w', name: '概率论' }])?.id === 'w', '「概率论课程」去后缀后命中「概率论」')

section('6. 显示名')
const it = { courseId: 'c2' }
ok(courseNameOf(it, courses) === '概率论与数理统计', '已归类显示课程名')
ok(courseNameOf({ courseId: '' }, courses) === '', '未归类返回空')
ok(courseNameOf({ courseId: 'c99' }, courses) === '', '课程已删除返回空')

console.log('\n==============================================')
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
