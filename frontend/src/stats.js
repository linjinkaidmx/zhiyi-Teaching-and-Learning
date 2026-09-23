/**
 * 打卡 / 连续学习 / 成就 —— 纯逻辑层（不依赖 DOM/Vue，可直接在 Node 中测试）
 *
 * 规则约定：
 * - 只有「实质学习动作」才打卡（record 即代表发生了一次真实动作）
 * - 连续按自然日计算，断 1~2 天可用护盾保链（自动扣），断 ≥3 天归零
 * - 每连续 7 天自动补 1 张护盾，上限 2 张
 * - 日期一律用本地时区（避免早 8 点被算成昨天）
 */
import { ACHIEVEMENTS } from './achievements.js'

export const KEY_GUEST = 'zhiyi_stats_v1'
export const KEY_ACCOUNT = 'zhiyi_stats_account_v1'
export const MAX_DAYS = 400      // 只保留最近 400 天，控制体积
export const MAX_SHIELDS = 2     // 护盾上限
export const SHIELD_EVERY = 7    // 每连续 7 天补一张护盾

/** 计入 totals 的动作类型 */
const TOTALS_OF = {
  explain: 'explain',
  quiz: 'quiz',
  practice: 'practice',
  followup: 'followup',
  reteach: 'reteach',
  debug: 'debug',
  run: 'run',
  ref: 'ref',
  export: 'export',
  save: 'save',
  // 功能域动作（成就体系扩展）
  search: 'search',      // 拍照识别成功
  bank: 'bank',          // 题库秒答命中
  exam: 'exam',          // 模拟考试交卷
  algo: 'algo',          // 算法演示打开
  hw: 'hw',              // 班级作业提交
  note: 'note',          // 班级笔记发布
  post: 'post',          // 社区发帖
  course: 'course',      // 课表维护
  examPlan: 'examPlan',  // 考试安排维护
  profile: 'profile',    // 资料完善
  cls: 'cls',            // 加入班级
}

export function emptyTotals() {
  return {
    explain: 0, quiz: 0, practice: 0, correct: 0, followup: 0,
    reteach: 0, debug: 0, run: 0, ref: 0, export: 0, save: 0, masteredMax: 0,
    // 成就体系扩展计数
    search: 0, bank: 0, multi: 0, exam: 0, algo: 0, hw: 0, note: 0, post: 0,
    course: 0, examPlan: 0, profile: 0, cls: 0,
    perfect: 0, stickyFix: 0, ontime: 0, hwPerfect: 0, examPerfect: 0, top3: 0,
    night: 0, comeback: 0,
  }
}

export function emptyStats() {
  return {
    version: 1,
    days: {},                 // { 'YYYY-MM-DD': { count, actions, checked, goalMet, shield } }
    streak: { current: 0, longest: 0, lastCheckin: '', shields: 0, nextShieldIn: SHIELD_EVERY },
    totals: emptyTotals(),
    achievements: {},         // { key: { at: ISO, backfilled?: true } }
    settings: { goalEnabled: true, goalQuestions: 5 },
    refSeen: [],              // 速查浏览过的分类
    algoSeen: [],             // 看过的算法演示 id（去重）
    backfillDone: false,
  }
}

// ---------------------------------------------------------------- 日期工具

export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseDay(key) {
  const d = new Date(key + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

/** toKey - fromKey 的天数差 */
export function dayDiff(fromKey, toKey) {
  const a = parseDay(fromKey)
  const b = parseDay(toKey)
  if (!a || !b) return NaN
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function shiftDay(key, n) {
  const d = parseDay(key)
  if (!d) return key
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

function nextShieldIn(current) {
  const cur = Math.max(0, Number(current) || 0)
  if (cur > 0 && cur % SHIELD_EVERY === 0) return SHIELD_EVERY
  return SHIELD_EVERY - (cur % SHIELD_EVERY)
}

// ---------------------------------------------------------------- 归一化 / 压缩

export function normalize(raw) {
  const s = emptyStats()
  if (!raw || typeof raw !== 'object') return s

  if (raw.days && typeof raw.days === 'object') {
    for (const [k, v] of Object.entries(raw.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue
      s.days[k] = {
        count: Math.max(0, Number(v.count) || 0),
        actions: (v.actions && typeof v.actions === 'object') ? { ...v.actions } : {},
        checked: !!v.checked || Number(v.count) > 0,
        goalMet: !!v.goalMet,
        shield: !!v.shield,
        night: !!v.night,        // 当天 0-5 点学习过
        early: !!v.early,        // 当天 8 点前学习过
        comeback: !!v.comeback,  // 当天是「间隔 3 天以上回归」
      }
    }
  }

  const st = raw.streak || {}
  s.streak = {
    current: Math.max(0, Number(st.current) || 0),
    longest: Math.max(0, Number(st.longest) || 0),
    lastCheckin: typeof st.lastCheckin === 'string' ? st.lastCheckin : '',
    shields: Math.min(MAX_SHIELDS, Math.max(0, Number(st.shields) || 0)),
    nextShieldIn: 0,
  }
  s.streak.nextShieldIn = nextShieldIn(s.streak.current)

  const t = raw.totals || {}
  for (const k of Object.keys(s.totals)) s.totals[k] = Math.max(0, Number(t[k]) || 0)

  if (raw.achievements && typeof raw.achievements === 'object') {
    for (const [k, v] of Object.entries(raw.achievements)) {
      if (v && typeof v === 'object' && v.at) {
        s.achievements[k] = { at: String(v.at), backfilled: !!v.backfilled }
      }
    }
  }

  if (raw.settings && typeof raw.settings === 'object') {
    s.settings = {
      goalEnabled: raw.settings.goalEnabled !== false,
      goalQuestions: Math.min(100, Math.max(1, Number(raw.settings.goalQuestions) || 5)),
    }
  }

  if (Array.isArray(raw.refSeen)) s.refSeen = raw.refSeen.filter((x) => typeof x === 'string').slice(0, 8)
  if (Array.isArray(raw.algoSeen)) s.algoSeen = raw.algoSeen.filter((x) => typeof x === 'string').slice(0, 60)

  s.backfillDone = !!raw.backfillDone
  compact(s)
  return s
}

/** 只保留最近 MAX_DAYS 天 */
export function compact(s) {
  const keys = Object.keys(s.days).sort()
  if (keys.length > MAX_DAYS) {
    for (const k of keys.slice(0, keys.length - MAX_DAYS)) delete s.days[k]
  }
  return s
}

// ---------------------------------------------------------------- 打卡状态机

/** 当天题数（每日目标口径：自测 + 针对性练习的作答题数） */
export function goalQuestions(s, dayKeyStr) {
  const a = (s.days[dayKeyStr] || {}).actions || {}
  return (a.quiz || 0) + (a.practice || 0)
}

/**
 * 打卡（仅在当天第一次产生动作时调用）。返回是否真的推进了连续。
 * 断 1~2 天且有护盾 → 自动扣 1 张保链；断 ≥3 天 → 归零重来。
 */
export function checkin(s, today = dateKey()) {
  const st = s.streak
  const last = st.lastCheckin

  if (!last) {
    st.current = 1
  } else {
    const gap = dayDiff(last, today)
    if (gap === 1) {
      st.current += 1
    } else if (gap <= 0) {
      st.nextShieldIn = nextShieldIn(st.current)
      return false                        // 同日或时间回拨：不动连续
    } else if ((gap === 2 || gap === 3) && st.shields > 0) {
      st.shields -= 1                     // 自动消耗 1 张护盾
      const covered = shiftDay(last, 1)   // 被护盾保住的那一天
      if (!s.days[covered]) {
        s.days[covered] = { count: 0, actions: {}, checked: false, goalMet: false, shield: true }
      } else {
        s.days[covered].shield = true
      }
      st.current += 1
    } else {
      st.current = 1
    }
  }

  st.lastCheckin = today
  st.longest = Math.max(st.longest || 0, st.current)
  if (st.current > 0 && st.current % SHIELD_EVERY === 0) {
    st.shields = Math.min(MAX_SHIELDS, st.shields + 1)
  }
  st.nextShieldIn = nextShieldIn(st.current)
  return true
}

// ---------------------------------------------------------------- 成就用时间/事件标记

/** 两个日期键相差的天数（b - a） */
export function dayGap(a, b) {
  const da = parseDay(a), db = parseDay(b)
  if (!da || !db) return 0
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

/** today 之前最近一个「有学习动作」的日期键 */
export function prevStudyDay(days, today) {
  const keys = Object.keys(days).filter((k) => k < today && (days[k].count || 0) > 0).sort()
  return keys.length ? keys[keys.length - 1] : ''
}

/** 连续「8 点前学习」的天数（含今天，要求日期连续） */
export function computeEarlyStreak(days) {
  const keys = Object.keys(days).sort()
  let n = 0
  for (let i = keys.length - 1; i >= 0; i--) {
    const d = days[keys[i]]
    if (!(d && d.early)) break
    if (n > 0 && dayGap(keys[i], keys[i + 1]) !== 1) break
    n++
  }
  return n
}

/** 当天首次动作时判定：深夜灯下 / 早起鸟用的标记 / 卷土重来 */
function markDayFlags(s, d, today, opts = {}) {
  const at = opts.at ? new Date(opts.at) : new Date()
  const h = Number.isFinite(at.getHours()) ? at.getHours() : new Date().getHours()
  if (h >= 0 && h < 5 && !d.night) {
    d.night = true
    s.totals.night = (s.totals.night || 0) + 1
  }
  if (h < 8 && !d.early) d.early = true
  const prev = prevStudyDay(s.days, today)
  if (prev && dayGap(prev, today) >= 4) {
    d.comeback = true
    s.totals.comeback = (s.totals.comeback || 0) + 1
  }
}

/** 调用方显式标记的事件（满分 / 前三 / 到期清完 / 多图） */
function applyEvents(s, opts = {}) {
  const t = s.totals
  if (opts.perfect) t.perfect = (t.perfect || 0) + 1
  if (opts.hwPerfect) t.hwPerfect = (t.hwPerfect || 0) + 1
  if (opts.examPerfect) t.examPerfect = (t.examPerfect || 0) + 1
  if (opts.top3) t.top3 = (t.top3 || 0) + 1
  if (opts.ontime) t.ontime = 1
  if (Number(opts.images) >= 5) t.multi = (t.multi || 0) + 1
}

// ---------------------------------------------------------------- 记录动作

/**
 * 记录一次实质学习动作：累加当日计数与总量 → 首次动作触发打卡 → 判定每日目标 → 判定成就。
 * type: explain | quiz | practice | followup | reteach | debug | run | ref | export | save
 * opts: { correct?, category?, day?, ctx? }
 */
export function record(stats, type, opts = {}) {
  const s = normalize(stats)
  const today = opts.day || dateKey()
  if (!s.days[today]) {
    s.days[today] = { count: 0, actions: {}, checked: false, goalMet: false, shield: false }
  }
  const d = s.days[today]
  const firstToday = d.count === 0

  d.actions[type] = (d.actions[type] || 0) + 1
  d.count += 1
  const tk = TOTALS_OF[type]
  if (tk) s.totals[tk] += 1

  // 时间类（深夜/早起）与回归类标记：只在当天首次动作时判定，按天去重
  if (firstToday) markDayFlags(s, d, today, opts)
  // 事件类成就（调用方显式标记）
  applyEvents(s, opts)
  // 算法演示：记录看过的算法 id
  if (type === 'algo' && opts.algoId) {
    const id = String(opts.algoId)
    if (!s.algoSeen.includes(id)) s.algoSeen.push(id)
  }
  if (opts.correct === true && (type === 'quiz' || type === 'practice')) {
    d.actions.correct = (d.actions.correct || 0) + 1
    s.totals.correct += 1
  }
  if (type === 'ref' && opts.category && !s.refSeen.includes(opts.category)) {
    s.refSeen.push(opts.category)
  }

  if (!d.checked) {
    d.checked = true
    checkin(s, today)
  }
  if (s.settings.goalEnabled) {
    d.goalMet = goalQuestions(s, today) >= s.settings.goalQuestions
  }

  const r = evaluate(s, opts.ctx || {})
  compact(r.stats)
  return r
}

// ---------------------------------------------------------------- 成就判定

/** 某周（周一~周日）7 天是否都达成了每日目标 → 周满勤次数 */
export function computeWeekFull(days, settings) {
  if (!settings || settings.goalEnabled === false) return 0
  const weeks = {}
  for (const [k, v] of Object.entries(days)) {
    const d = parseDay(k)
    if (!d) continue
    const dow = (d.getDay() + 6) % 7            // 0 = 周一
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)
    const wk = dateKey(monday)
    if (!weeks[wk]) weeks[wk] = {}
    weeks[wk][dow] = !!v.goalMet
  }
  let n = 0
  for (const wk of Object.keys(weeks)) {
    let all = true
    for (let i = 0; i < 7; i++) {
      if (!weeks[wk][i]) { all = false; break }
    }
    if (all) n++
  }
  return n
}

export function buildContext(s, extra = {}) {
  return {
    totals: s.totals,
    streak: s.streak,
    days: s.days,
    refSeen: s.refSeen,
    settings: s.settings,
    checkedDays: Object.values(s.days).filter((d) => d.checked).length,
    mastered: Math.max(0, Number(extra.mastered) || 0),
    weekFull: computeWeekFull(s.days, s.settings),
    // 成就体系扩展
    algoSeen: (s.algoSeen || []).length,
    night: s.totals.night || 0,
    comeback: s.totals.comeback || 0,
    earlyStreak: computeEarlyStreak(s.days),
    maxQuizPerItem: Math.max(0, Number(extra.maxQuizPerItem) || 0),
    // 由 App 注册的 context provider 实时提供（课表课程数 / 考试安排数 / 资料是否完善）
    courseCount: Math.max(0, Number(extra.courseCount) || 0),
    examCount: Math.max(0, Number(extra.examCount) || 0),
    profileDone: Math.max(0, Number(extra.profileDone) || 0),
  }
}

/** 判定所有成就；返回新 stats（含新解锁的 key 列表） */
export function evaluate(stats, extra = {}, opts = {}) {
  const s = normalize(stats)
  if (typeof extra.mastered === 'number') {
    s.totals.masteredMax = Math.max(s.totals.masteredMax || 0, extra.mastered)
  }
  if (Number(extra.streakMax) >= 2) {
    s.totals.stickyFix = Math.max(s.totals.stickyFix || 0, 1)
  }
  const ctx = buildContext(s, extra)
  const unlocked = []
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.key]) continue
    let v = 0
    try { v = Number(a.value(ctx)) || 0 } catch { v = 0 }
    if (v >= a.target) {
      s.achievements[a.key] = { at: new Date().toISOString(), backfilled: !!opts.backfill }
      unlocked.push(a.key)
    }
  }
  return { stats: s, unlocked, context: ctx }
}

/** 单个成就的进度（用于成就墙） */
export function progressOf(stats, ach, ctx) {
  const c = ctx || buildContext(stats || emptyStats())
  let v = 0
  try { v = Number(ach.value(c)) || 0 } catch { v = 0 }
  const rec = (stats && stats.achievements && stats.achievements[ach.key]) || null
  return {
    done: !!rec,
    at: rec ? rec.at : '',
    backfilled: !!(rec && rec.backfilled),
    value: Math.min(v, ach.target),
    target: ach.target,
  }
}

// ---------------------------------------------------------------- 历史回填

/**
 * 用现有错题本数据回填「学习类」成就（坚持类从今天算）。
 * 每题都经过一次讲解，故讲解次数以错题条数作为下界估计。
 */
export function backfill(stats, items) {
  const s = normalize(stats)
  if (s.backfillDone) return { stats: s, unlocked: [], context: buildContext(s) }

  let quiz = 0, correct = 0, followup = 0, reteach = 0, mastered = 0, explain = 0
  let maxQuiz = 0, maxStreak = 0
  for (const it of items || []) {
    quiz += Number(it.quizCount) || 0
    correct += Number(it.correctCount) || 0
    followup += (it.followups || []).length
    reteach += (it.reteach || []).length
    if (it.mastered) mastered++
    maxQuiz = Math.max(maxQuiz, Number(it.quizCount) || 0)
    maxStreak = Math.max(maxStreak, Number(it.streak) || 0)
    explain++
  }
  s.totals.quiz += quiz
  s.totals.correct += correct
  s.totals.followup += followup
  s.totals.reteach += reteach
  s.totals.explain += explain
  s.totals.masteredMax = Math.max(s.totals.masteredMax, mastered)
  s.backfillDone = true

  const r = evaluate(s, { mastered, maxQuizPerItem: maxQuiz, streakMax: maxStreak }, { backfill: true })
  return r
}

// ---------------------------------------------------------------- 云端合并

/**
 * 合并本地与云端统计（换设备场景）：
 * days 取并集（同日取较大者）· totals 逐键取 max · achievements 取解锁更早的 ·
 * streak 以 lastCheckin 较晚的一方为主、longest 取 max、shields 取 max（无竞争性，不怕刷）·
 * settings 以本地为准
 */
export function mergeStats(localRaw, remoteRaw) {
  const a = normalize(localRaw)
  if (!remoteRaw) return a
  const b = normalize(remoteRaw)

  const days = clone(b.days)
  for (const [k, v] of Object.entries(a.days)) {
    const cur = days[k]
    if (!cur) {
      days[k] = v
      continue
    }
    const actions = { ...cur.actions }
    for (const [ak, av] of Object.entries(v.actions || {})) {
      actions[ak] = Math.max(Number(actions[ak]) || 0, Number(av) || 0)
    }
    days[k] = {
      count: Math.max(cur.count || 0, v.count || 0),
      actions,
      checked: !!(cur.checked || v.checked),
      goalMet: !!(cur.goalMet || v.goalMet),
      shield: !!(cur.shield || v.shield),
    }
  }

  const totals = {}
  for (const k of Object.keys(emptyTotals())) {
    totals[k] = Math.max(a.totals[k] || 0, b.totals[k] || 0)
  }

  const achievements = { ...b.achievements }
  for (const [k, v] of Object.entries(a.achievements)) {
    const other = achievements[k]
    achievements[k] = (!other || new Date(v.at) <= new Date(other.at)) ? v : other
  }

  const aLater = (a.streak.lastCheckin || '') >= (b.streak.lastCheckin || '')
  const main = aLater ? a.streak : b.streak
  const streak = {
    current: Math.max(0, Number(main.current) || 0),
    longest: Math.max(a.streak.longest || 0, b.streak.longest || 0),
    lastCheckin: main.lastCheckin || '',
    shields: Math.max(a.streak.shields || 0, b.streak.shields || 0),
    nextShieldIn: 0,
  }
  streak.nextShieldIn = nextShieldIn(streak.current)

  const merged = {
    ...a,
    days,
    streak,
    totals,
    achievements,
    refSeen: [...new Set([...(a.refSeen || []), ...(b.refSeen || [])])].slice(0, 8),
    settings: a.settings,                      // 设置以本地为准
    backfillDone: a.backfillDone || b.backfillDone,
  }
  return compact(merged)
}

/** 本地是否比云端更「丰富」（用于决定是否回推云端） */
export function isRicher(local, remote) {
  if (!local) return false
  if (!remote) return true
  const a = Object.keys(local.days || {}).length
  const b = Object.keys(remote.days || {}).length
  if (a !== b) return a > b
  const at = local.totals || {}
  const bt = remote.totals || {}
  const sum = (o) => Object.values(o).reduce((x, y) => x + (Number(y) || 0), 0)
  if (sum(at) !== sum(bt)) return sum(at) > sum(bt)
  return (local.streak?.lastCheckin || '') >= (remote.streak?.lastCheckin || '')
}

// ---------------------------------------------------------------- 展示用汇总

/** 近 N 周热力数据：13 列（周）× 7 行（周一~周日） */
export function buildHeat(days, weeks = 13) {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (weeks - 1) * 7)
  const out = []
  for (let w = 0; w < weeks; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      const key = dateKey(cur)
      const rec = days[key] || null
      col.push({
        key,
        count: rec ? rec.count || 0 : 0,
        checked: !!(rec && rec.checked),
        goalMet: !!(rec && rec.goalMet),
        shield: !!(rec && rec.shield),
        future: cur.getTime() > now.getTime(),
      })
    }
    out.push(col)
  }
  return out
}

export function summary(stats) {
  const s = normalize(stats)
  const today = dateKey()
  const td = s.days[today] || null
  const month = today.slice(0, 7)
  return {
    todayKey: today,
    checkedToday: !!(td && td.checked),
    todayCount: td ? td.count : 0,
    todayQuestions: goalQuestions(s, today),
    current: s.streak.current,
    longest: s.streak.longest,
    shields: s.streak.shields,
    nextShieldIn: s.streak.nextShieldIn,
    goalEnabled: s.settings.goalEnabled,
    goalTarget: s.settings.goalQuestions,
    goalMet: !!(td && td.goalMet),
    monthDays: Object.entries(s.days).filter(([k, v]) => v.checked && k.startsWith(month)).length,
    checkedDays: Object.values(s.days).filter((d) => d.checked).length,
    weekFull: computeWeekFull(s.days, s.settings),
    heat: buildHeat(s.days, 13),
    totals: s.totals,
  }
}

// ---------------------------------------------------------------- 存储

export function statsKey(space) {
  return space === 'account' ? KEY_ACCOUNT : KEY_GUEST
}

export function loadStats(space = 'guest') {
  try {
    if (typeof localStorage === 'undefined') return emptyStats()
    const raw = localStorage.getItem(statsKey(space))
    return raw ? normalize(JSON.parse(raw)) : emptyStats()
  } catch {
    return emptyStats()          // 数据损坏：静默重置，不阻塞应用
  }
}

export function saveStats(stats, space = 'guest') {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(statsKey(space), JSON.stringify(stats))
  } catch {
    /* 配额不足或隐私模式：静默降级 */
  }
}
