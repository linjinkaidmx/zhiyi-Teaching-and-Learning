/**
 * 上课时段 ⇄ 排课格子 转换测试（离线自包含）
 * 重点：双向对称性（编辑回填 ⟷ 保存重建）与周次解析
 */
const { parseRanges, formatRanges, weeksToForm, formToWeeks, slotsToPeriods, periodsToSlots } = await import('./src/lib/schedulePeriods.js')

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('1. 周次文本解析')
ok(eq(parseRanges('2,5,6'), [[2, 2], [5, 5], [6, 6]]), "'2,5,6' → 三个离散周", parseRanges('2,5,6'))
ok(eq(parseRanges('2-8'), [[2, 8]]), "'2-8' → 区间", parseRanges('2-8'))
ok(eq(parseRanges('2-8,12-16'), [[2, 8], [12, 16]]), "'2-8,12-16' → 两段")
ok(eq(parseRanges('2，5，6'), [[2, 2], [5, 5], [6, 6]]), '中文逗号同样支持')
ok(eq(parseRanges('8-2'), [[2, 8]]), '倒序区间自动纠正')
ok(eq(parseRanges(''), []), '空文本 → 空数组')
ok(eq(parseRanges('abc,3'), [[3, 3]]), '非法片段被忽略')

console.log('\n2. 周次格式化（回填）')
ok(formatRanges([[2, 2], [5, 5], [6, 6]]) === '2,5,6', '三个离散周 → 2,5,6')
ok(formatRanges([[2, 8]]) === '2-8', '区间 → 2-8')
ok(formatRanges([[2, 8], [12, 16]]) === '2-8,12-16', '两段 → 2-8,12-16')
ok(formatRanges([]) === '', '空 → 空串')

console.log('\n3. weeks 对象 ⇄ 表单')
ok(eq(formToWeeks('every', ''), { type: 'every' }), 'every')
ok(eq(formToWeeks('odd', ''), { type: 'odd' }), 'odd')
ok(eq(formToWeeks('custom', '2,5,6'), { type: 'custom', ranges: [[2, 2], [5, 5], [6, 6]] }), 'custom → ranges')
ok(eq(weeksToForm({ type: 'custom', ranges: [[2, 2], [5, 5]] }), { weeksType: 'custom', weeksRanges: '2,5' }), 'ranges → 表单文本')
ok(eq(weeksToForm(undefined), { weeksType: 'every', weeksRanges: '' }), 'undefined 兜底 every')

console.log('\n4. 时段 → 排课格子')
const p1 = { day: 3, slotStart: 3, slotEnd: 5, weeksType: 'custom', weeksRanges: '2,5,6' }
const p2 = { day: 5, slotStart: 6, slotEnd: 8, weeksType: 'custom', weeksRanges: '2,5,6' }
const slots = periodsToSlots([p1, p2], 'c1', '教三302')
ok(slots.length === 6, '2 个时段（各 3 节）→ 6 条格子', slots.length)
ok(eq(slots.map((s) => [s.day, s.slot]), [[3, 3], [3, 4], [3, 5], [5, 6], [5, 7], [5, 8]]), '格子按天/节次展开正确', slots.map((s) => [s.day, s.slot]))
ok(eq(slots[0].weeks, { type: 'custom', ranges: [[2, 2], [5, 5], [6, 6]] }), '周次写入正确')
ok(slots[0].courseId === 'c1' && slots[0].location === '教三302', '课程与教室带入')
ok(periodsToSlots([{ day: 1, slotStart: 3, slotEnd: 2, weeksType: 'every' }], 'c1').length === 0, '起止非法 → 不产出格子')
ok(periodsToSlots([], 'c1').length === 0, '空时段 → 空格子')

console.log('\n5. 排课格子 → 时段（编辑回填）')
const back = slotsToPeriods(slots.map((s, i) => ({ ...s, id: 's' + i })))
ok(back.length === 2, '6 条格子 → 还原 2 个时段', back.length)
ok(eq(back.map((p) => [p.day, p.slotStart, p.slotEnd]), [[3, 3, 5], [5, 6, 8]]), '连续节次合并为范围', back.map((p) => [p.day, p.slotStart, p.slotEnd]))
ok(back.every((p) => p.weeksType === 'custom' && p.weeksRanges === '2,5,6'), '周次回填为文本', back.map((p) => p.weeksRanges))

console.log('\n6. 边界：不连续 / 不同周次 不合并')
const mixed = [
  { id: 'a', day: 1, slot: 3, weeks: { type: 'every' } },
  { id: 'b', day: 1, slot: 4, weeks: { type: 'every' } },
  { id: 'c', day: 1, slot: 7, weeks: { type: 'every' } },
  { id: 'd', day: 1, slot: 8, weeks: { type: 'odd' } },
]
const mixedP = slotsToPeriods(mixed)
ok(mixedP.length === 3, '断开的节次 + 不同周次 → 3 个时段', mixedP.map((p) => [p.slotStart, p.slotEnd, p.weeksType]))
ok(eq(mixedP[0], { day: 1, slotStart: 3, slotEnd: 4, weeksType: 'every', weeksRanges: '', location: '' }), '首段 3~4 每周')
ok(eq(mixedP[1].slotStart, 7) && mixedP[1].slotEnd === 7, '中间单节自成一段')
ok(mixedP[2].weeksType === 'odd', '单周不并入每周片段')

console.log('\n7. 双向对称性（关键）')
// 注意：slotsToPeriods 输出按「星期 + 起始节次」稳定排序，故原始数据也按此序书写
const origin = [
  { day: 2, slotStart: 1, slotEnd: 2, weeksType: 'every', weeksRanges: '', location: '' },
  { day: 3, slotStart: 3, slotEnd: 5, weeksType: 'custom', weeksRanges: '2,5,6', location: '' },
  { day: 5, slotStart: 6, slotEnd: 8, weeksType: 'custom', weeksRanges: '2,5,6', location: '' },
]
const roundTrip = slotsToPeriods(periodsToSlots(origin, 'c9').map((s, i) => ({ ...s, id: 'x' + i })))
ok(eq(roundTrip, origin), '时段 → 格子 → 时段 完全还原', roundTrip)
// 乱序输入也能收敛到同一结果（顺序无关性）
const shuffled = [origin[2], origin[0], origin[1]]
const roundTrip2 = slotsToPeriods(periodsToSlots(shuffled, 'c9').map((s, i) => ({ ...s, id: 'y' + i })))
ok(eq(roundTrip2, origin), '乱序输入的往返结果与规范序一致', roundTrip2)

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
