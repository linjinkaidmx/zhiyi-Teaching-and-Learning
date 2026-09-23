/**
 * 上课时段 ⇄ 排课格子 的双向转换（纯逻辑，可离线测试）
 * ---------------------------------------------------------------------------
 * 「时段」Period 是编辑课程时的输入形态：{ day, slotStart, slotEnd, weeksType, weeksRanges }
 * 「排课格子」Slot 是课表存储形态：每个节次一条 { id, courseId, day, slot, weeks, location }
 *
 * 双方互转用于：编辑课程时回填现有设置（slotsToPeriods）、保存时重建排课（periodsToSlots）。
 */

/** 周次文本 → 区间数组：'2,5,6' → [[2,2],[5,5],[6,6]]；'2-8,12-16' → [[2,8],[12,16]] */
export function parseRanges(text) {
  return String(text || '')
    .split(/[,，、\s]+/)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const m = seg.match(/^(\d{1,2})\s*[-~到]\s*(\d{1,2})$/)
      if (m) {
        const a = Number(m[1])
        const b = Number(m[2])
        return a <= b ? [a, b] : [b, a]
      }
      const single = seg.match(/^(\d{1,2})$/)
      return single ? [Number(single[1]), Number(single[1])] : null
    })
    .filter(Boolean)
}

/** 区间数组 → 周次文本（回填输入框）：[[2,2],[5,5],[6,6]] → '2,5,6'；[[2,8]] → '2-8' */
export function formatRanges(ranges) {
  return (Array.isArray(ranges) ? ranges : [])
    .map(([a, b]) => (a === b ? String(a) : `${a}-${b}`))
    .join(',')
}

/** weeks 对象 → 稳定的描述键（用于分组比较） */
function weeksKey(weeks) {
  const w = weeks && typeof weeks === 'object' ? weeks : { type: 'every' }
  if (w.type === 'custom') return 'custom:' + formatRanges(w.ranges)
  return String(w.type || 'every')
}

/** weeks 对象 → 表单态（类型 + 文本） */
export function weeksToForm(weeks) {
  const w = weeks && typeof weeks === 'object' ? weeks : { type: 'every' }
  return {
    weeksType: w.type || 'every',
    weeksRanges: w.type === 'custom' ? formatRanges(w.ranges) : '',
  }
}

/** 表单态 → weeks 对象 */
export function formToWeeks(weeksType, weeksRanges) {
  if (weeksType === 'custom') return { type: 'custom', ranges: parseRanges(weeksRanges) }
  return { type: weeksType || 'every' }
}

/**
 * 排课格子 → 时段列表
 * 同一「星期 + 周次」下的连续节次合并为一个时段（3、4、5 节 → 3~5）
 */
export function slotsToPeriods(slots) {
  const groups = new Map()
  for (const s of Array.isArray(slots) ? slots : []) {
    if (!s || s.day == null || s.slot == null) continue
    const gk = Number(s.day) + '|' + weeksKey(s.weeks)
    if (!groups.has(gk)) groups.set(gk, [])
    groups.get(gk).push(s)
  }
  const out = []
  for (const [, list] of groups) {
    const sorted = list.slice().sort((a, b) => Number(a.slot) - Number(b.slot))
    const days = sorted.map((s) => Number(s.slot))
    let start = days[0]
    let prev = days[0]
    const flush = (from, to) => {
      const first = sorted[0]
      out.push({
        day: Number(first.day),
        slotStart: from,
        slotEnd: to,
        ...weeksToForm(first.weeks),
        location: first.location || '',
      })
    }
    for (let i = 1; i <= days.length; i += 1) {
      const cur = days[i]
      if (cur !== prev + 1) {
        flush(start, prev)
        if (cur !== undefined) start = cur
      }
      prev = cur
    }
  }
  // 稳定排序：先按星期，再按起始节次
  return out.sort((a, b) => a.day - b.day || a.slotStart - b.slotStart)
}

/** 时段列表 → 待写入的排课格子（不含 id，由 store 分配） */
export function periodsToSlots(periods, courseId, fallbackLocation = '') {
  const out = []
  for (const p of Array.isArray(periods) ? periods : []) {
    if (!p || p.day == null) continue
    const start = Number(p.slotStart)
    const end = Number(p.slotEnd)
    if (!(start >= 1) || !(end >= start)) continue
    const weeks = formToWeeks(p.weeksType, p.weeksRanges)
    for (let s = start; s <= end; s += 1) {
      out.push({
        courseId,
        day: Number(p.day),
        slot: s,
        location: p.location || fallbackLocation || '',
        weeks,
      })
    }
  }
  return out
}
