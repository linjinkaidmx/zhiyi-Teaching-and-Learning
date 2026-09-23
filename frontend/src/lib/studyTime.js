/**
 * 学习时长统计（批次4）· 纯逻辑
 * ---------------------------------------------------------------------------
 * 时长的来源是「学习记录」里的 minutes 字段（结构已对齐后端 LearningSession），
 * 这里只做纯计算，便于脱离浏览器直接单测。
 */

export const MAX_MINUTES_PER_RECORD = 120   // 单条记录上限（防"忘了关标签页"刷出离谱时长）
export const MIN_MINUTES_TO_COUNT = 0.15    // 少于 9 秒不计（避免噪声）

const asArray = (x) => (Array.isArray(x) ? x : [])

/**
 * 把一段时长累加到「最近一条同类型记录」上。
 * @returns {boolean} 是否真的累加了
 */
export function addMinutesToLatest(records, type, minutes) {
  const m = Number(minutes) || 0
  if (!Number.isFinite(m) || m < MIN_MINUTES_TO_COUNT) return false
  const arr = asArray(records)
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const r = arr[i]
    if (r && r.type === type) {
      const cur = Number(r.minutes) || 0
      r.minutes = Math.min(MAX_MINUTES_PER_RECORD, Number((cur + m).toFixed(2)))
      return true
    }
  }
  return false
}

/** 某时间点之后的时长合计（分钟） */
export function sumMinutes(records, sinceTs = 0) {
  return asArray(records).reduce((sum, r) => {
    if (!r || (r.createdAt || 0) < sinceTs) return sum
    const m = Number(r.minutes) || 0
    return sum + (Number.isFinite(m) ? Math.min(m, MAX_MINUTES_PER_RECORD) : 0)
  }, 0)
}

/** 近 N 天每日时长：[{ label, date, minutes }]，按时间正序 */
export function dailyMinutes(records, days = 7) {
  const now = new Date()
  const out = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const start = d.getTime()
    const end = start + 24 * 3600 * 1000
    const minutes = asArray(records).reduce((s, r) => {
      if (!r) return s
      const t = r.createdAt || 0
      if (t < start || t >= end) return s
      const m = Number(r.minutes) || 0
      return s + (Number.isFinite(m) ? Math.min(m, MAX_MINUTES_PER_RECORD) : 0)
    }, 0)
    out.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      date: start,
      minutes: Math.round(minutes * 10) / 10,
    })
  }
  return out
}

/** 时长汇总：今日 / 本周 / 日均（近 7 天，按有记录的天数算） */
export function minutesSummary(records) {
  const week = dailyMinutes(records, 7)
  const today = week.length ? week[week.length - 1].minutes : 0
  const weekTotal = Math.round(week.reduce((s, d) => s + d.minutes, 0) * 10) / 10
  const activeDays = week.filter((d) => d.minutes > 0).length
  return {
    today,
    week: weekTotal,
    dailyAvg: activeDays ? Math.round((weekTotal / activeDays) * 10) / 10 : 0,
    activeDays,
  }
}

/** 把分钟变成「x 小时 y 分」 */
export function humanMinutes(minutes) {
  const m = Number(minutes) || 0
  if (m < 1) return m > 0 ? '不到 1 分钟' : '0 分钟'
  if (m < 60) return `${Math.round(m)} 分钟`
  const h = Math.floor(m / 60)
  const rest = Math.round(m - h * 60)
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`
}
