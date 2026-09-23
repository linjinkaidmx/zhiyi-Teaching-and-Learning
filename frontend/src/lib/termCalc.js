/**
 * 学期与周数计算（纯逻辑，Node 可测）
 * ---------------------------------------------------------------------------
 * 规则：
 *  - 学期以「第一周周一」为基准，一周从周一开始，7 天为一周。
 *  - 第 w 周：w 从 1 开始（开学第一周 = 1）。
 *  - 单周 = w 为奇数，双周 = w 为偶数。
 */

/** 解析 'YYYY-MM-DD' → 本地时区 Date（避免 toISOString 的 UTC 偏移导致跨天） */
export function parseDate(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/** 某日期所在周的周一（本地 00:00） */
export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay() // 0=周日 1=周一 … 6=周六
  const back = dow === 0 ? 6 : dow - 1
  d.setDate(d.getDate() - back)
  return d
}

/** 1=周一 … 7=周日 */
export function dayOfWeek(date) {
  const dow = date.getDay()
  return dow === 0 ? 7 : dow
}

/** 今天是开学第几周（1-based）；开学前返回 ≤0 */
export function weekIndexFor(today, startDate) {
  const start = startDate instanceof Date ? startDate : parseDate(startDate)
  const now = today instanceof Date ? today : parseDate(today)
  if (!start || !now) return 0
  const a = mondayOf(start).getTime()
  const b = mondayOf(now).getTime()
  return Math.floor((b - a) / (7 * 86400000)) + 1
}

/**
 * 该周是否上这门课
 * @param weeks { type: 'every'|'odd'|'even'|'custom', ranges: [[起,止],…] }
 * @param weekIndex 1-based
 */
export function weekActiveIn(weeks, weekIndex) {
  const w = weeks || {}
  const wi = Number(weekIndex) || 0
  if (wi <= 0) return false
  switch (w.type) {
    case 'odd': return wi % 2 === 1
    case 'even': return wi % 2 === 0
    case 'custom': {
      return (Array.isArray(w.ranges) ? w.ranges : []).some((r) => {
        if (!Array.isArray(r)) return false
        const a = Number(r[0]) || 0
        const b = Number(r[1]) || 0
        return wi >= a && wi <= b
      })
    }
    case 'every':
    default:
      return true
  }
}

/** 周数规则的显示文本 */
export function formatWeeks(weeks) {
  const w = weeks || {}
  switch (w.type) {
    case 'odd': return '单周'
    case 'even': return '双周'
    case 'custom': {
      const rs = (Array.isArray(w.ranges) ? w.ranges : []).filter((r) => Array.isArray(r))
      if (!rs.length) return ''
      if (rs.length === 1 && rs[0][0] === rs[0][1]) return `第${rs[0][0]}周`
      return rs.map((r) => (r[0] === r[1] ? `第${r[0]}周` : `第${r[0]}-${r[1]}周`)).join('、')
    }
    case 'every':
    default:
      return '每周'
  }
}

/** 把周数规则转成一个可读的、用于格子角标的一行（空=每周不显示） */
export function weeksBadge(weeks) {
  const w = weeks || {}
  if (!w.type || w.type === 'every') return ''
  return formatWeeks(w)
}

/** 某天是否命中考试（按日期字符串比较，忽略时分） */
export function examOnDate(exam, dateStr) {
  if (!exam || !exam.date) return false
  return exam.date === dateStr
}

/** 日期 → 'YYYY-MM-DD' 字符串（本地时区） */
export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 距某考试还有几天（今天 0，明天 1，过期为负） */
export function daysUntil(dateStr, todayStr) {
  const a = parseDate(todayStr)
  const b = parseDate(dateStr)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}
