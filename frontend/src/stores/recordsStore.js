/**
 * recordsStore · 学习记录（LearningSession 形态，本地先行）
 * ---------------------------------------------------------------------------
 * 后端暂无学习记录表 → 按计划「本地存储先行（真实数据结构）」：
 *   记录结构对齐后端将来要落表的字段，接口就绪后只改同步层，UI 与结构不动。
 * 存储：zhiyi_records_v1（游客）/ zhiyi_records_account_v1（账号），上限 300 条。
 */
import { ref, computed } from 'vue'
import { nextId } from '../book.js'
import { mergeSessions } from '../lib/syncMerge.js'
import { addMinutesToLatest, minutesSummary, dailyMinutes, humanMinutes } from '../lib/studyTime.js'
import { latexToPlain } from '../mathtext'

const GUEST_KEY = 'zhiyi_records_v1'
const ACCOUNT_KEY = 'zhiyi_records_account_v1'
const MAX_RECORDS = 300

/** 动作类型 → 展示文案/图标 */
export const RECORD_TYPES = {
  explain: { label: '完成讲解', icon: 'sparkle' },
  followup: { label: '追问', icon: 'chat' },
  quiz: { label: '自测作答', icon: 'book' },
  save: { label: '存入错题本', icon: 'clipboard' },
  debug: { label: '代码诊断', icon: 'settings' },
}

const records = ref([])
let space = 'guest'

const keyOf = (sp) => (sp === 'account' ? ACCOUNT_KEY : GUEST_KEY)

function readStore(sp) {
  try {
    const raw = localStorage.getItem(keyOf(sp))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeStore() {
  try {
    localStorage.setItem(keyOf(space), JSON.stringify(records.value.slice(0, MAX_RECORDS)))
  } catch {
    /* 隐私模式忽略 */
  }
}

export function initRecords(sp) {
  space = sp === 'account' ? 'account' : 'guest'
  records.value = readStore(space)
  return records.value
}

export function recordsRef() {
  return records
}

/** 记录一次学习动作（与打卡埋点同源，字段对齐后端 LearningSession） */
export function logLearning(type, payload = {}) {
  if (!RECORD_TYPES[type]) return null
  const rec = {
    id: nextId(),
    type,
    // 与后端 LearningSession 对齐的字段
    // title/brief 保留纯文本版（可安全截断、不出现 $ 或反斜杠残留），
    // 同时另存 titleTex（LaTeX 原文）供列表按教材式排版渲染公式；老记录无该字段时自动回退纯文本
    questionId: payload.questionId || '',
    title: latexToPlain(String(payload.title || '')).replace(/\s+/g, ' ').slice(0, 60),
    titleTex: String(payload.title || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    brief: latexToPlain(String(payload.brief || '')).slice(0, 40),
    correct: typeof payload.correct === 'boolean' ? payload.correct : null,
    minutes: Number(payload.minutes) || 0,
    createdAt: Date.now(),
    synced: false, // 后端表就绪后置 true
  }
  records.value = [rec, ...records.value].slice(0, MAX_RECORDS)
  writeStore()
  return rec
}

export function clearRecords() {
  records.value = []
  writeStore()
}

// ---------------- 云端同步（批次1）

/** 推送给云端的载荷（数组，上限与后端一致） */
export function sessionsCloudPayload() {
  return records.value.slice(0, MAX_RECORDS)
}

/**
 * 拉取云端后落地
 * @param {{merge?: boolean}} opts merge=false 时按"以云端覆盖本地"处理
 */
export function applyCloudSessions(remote, opts = {}) {
  if (opts.merge === false) {
    records.value = (Array.isArray(remote) ? remote : [])
      .filter((r) => r && typeof r === 'object')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, MAX_RECORDS)
    writeStore()
    return records.value
  }
  const merged = mergeSessions(records.value, remote, MAX_RECORDS)
  records.value = merged
  writeStore()
  return merged
}

/** 按类型统计（用于「学习记录」页顶部小结） */
export const recordSummary = computed(() => {
  const byType = {}
  records.value.forEach((r) => {
    byType[r.type] = (byType[r.type] || 0) + 1
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return {
    total: records.value.length,
    today: records.value.filter((r) => r.createdAt >= today.getTime()).length,
    byType,
  }
})

export function getSpace() {
  return space
}

// ---------------- 学习时长（批次4）

/**
 * 把一段时长累加到最近一条同类型记录上。
 * 用法：讲解页停留 → addStudyMinutes('explain', 分钟数)
 */
export function addStudyMinutes(type, minutes) {
  const changedAnything = addMinutesToLatest(records.value, type, minutes)
  if (changedAnything) writeStore()
  return changedAnything
}

export function studyMinutes() {
  return minutesSummary(records.value)
}

export function studyTimeByDay(days = 7) {
  return dailyMinutes(records.value, days)
}

export { humanMinutes }
