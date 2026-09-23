/**
 * 个人资料（纯逻辑层，可在 Node 中测试）：
 * 头像 / 昵称副本 / 学校专业年级 / 签名 / 偏好设置 + 备份包的构建与校验
 */

export const KEY_GUEST = 'zhiyi_profile_v1'
export const KEY_ACCOUNT = 'zhiyi_profile_account_v1'
export const MAX_AVATAR_LEN = 400_000   // 与后端上限一致（约 300KB）

export const GRADES = ['大一', '大二', '大三', '大四', '大五', '研一', '研二', '研三', '博士', '其他']

/** 首字色块可选颜色（8 色，与项目主色系协调） */
export const AVATAR_COLORS = [
  '#35507a', '#1d9e75', '#d85a30', '#d4537e',
  '#7f77dd', '#185fa5', '#3b6d11', '#854f0b',
]

export const FONT_SCALES = [
  { key: 'sm', label: '小' },
  { key: 'md', label: '标准' },
  { key: 'lg', label: '大' },
]

export const DEFAULT_PREFS = {
  defaultMode: 'deep',   // 追问默认档位：deep 深思 | fast 快答
  renderMath: true,      // 公式渲染（关闭 = 公式转可复制文本，不跑 KaTeX）
  fontScale: 'md',       // 正文字号：sm | md | lg
  subject: '',           // 默认学科（用于练习预填）
}

export function emptyProfile() {
  return {
    version: 1,
    avatar: '',          // base64 dataURL；空 → 用首字色块
    avatarColor: '',     // 空 → 由昵称推导
    nickname: '',        // 显示副本（真正的登录名以账号系统为准）
    bio: '',
    school: '',
    major: '',
    grade: '',
    prefs: { ...DEFAULT_PREFS },
  }
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

export function normalizeProfile(raw) {
  const p = emptyProfile()
  if (!raw || typeof raw !== 'object') return p
  const avatar = str(raw.avatar, MAX_AVATAR_LEN)
  p.avatar = /^data:image\//.test(avatar) ? avatar : ''
  p.avatarColor = AVATAR_COLORS.includes(raw.avatarColor) ? raw.avatarColor : ''
  p.nickname = str(raw.nickname, 20)
  p.bio = str(raw.bio, 60)
  p.school = str(raw.school, 30)
  p.major = str(raw.major, 30)
  p.grade = GRADES.includes(raw.grade) ? raw.grade : ''
  const prefs = raw.prefs && typeof raw.prefs === 'object' ? raw.prefs : {}
  p.prefs = {
    defaultMode: prefs.defaultMode === 'fast' ? 'fast' : 'deep',
    renderMath: prefs.renderMath !== false,
    fontScale: ['sm', 'md', 'lg'].includes(prefs.fontScale) ? prefs.fontScale : 'md',
    subject: str(prefs.subject, 20),
  }
  return p
}

/** 首字（支持中文/emoji：用 Array.from 取第一个码点） */
export function avatarLetter(name) {
  const s = (name || '').trim()
  if (!s) return '知'
  return Array.from(s)[0]
}

function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** 首字色块颜色：用户选了就用选的，否则由昵称稳定推导 */
export function avatarColorOf(profile, name) {
  if (profile && profile.avatarColor) return profile.avatarColor
  const seed = (name || (profile && profile.nickname) || '知一')
  return AVATAR_COLORS[hashCode(seed) % AVATAR_COLORS.length]
}

/**
 * 与云端资料合并：逐字段取「非空的一方」，本地优先；偏好以本地为准（与 stats 合并策略一致）。
 */
export function mergeProfile(localRaw, remoteRaw) {
  const a = normalizeProfile(localRaw)
  if (!remoteRaw) return a
  const b = normalizeProfile(remoteRaw)
  return {
    version: 1,
    avatar: a.avatar || b.avatar,
    avatarColor: a.avatarColor || b.avatarColor,
    nickname: a.nickname || b.nickname,
    bio: a.bio || b.bio,
    school: a.school || b.school,
    major: a.major || b.major,
    grade: a.grade || b.grade,
    prefs: a.prefs,
  }
}

/** 资料是否比云端更「完整」（用于决定是否回推） */
export function isProfileRicher(local, remote) {
  const a = normalizeProfile(local)
  const b = normalizeProfile(remote)
  const score = (p) => ['avatar', 'bio', 'school', 'major', 'grade'].filter((k) => p[k]).length
  return score(a) >= score(b) && score(a) > 0
}

// ---------------------------------------------------------------- 备份包（导出/导入）

export function buildExport({ profile, stats, items, settings, nickname }) {
  return {
    app: 'zhiyi',
    version: 1,
    exportedAt: new Date().toISOString(),
    nickname: nickname || '',
    profile: normalizeProfile(profile),
    stats: stats || {},
    items: Array.isArray(items) ? items : [],
    settings: settings || {},
  }
}

/** 校验导入文件结构 */
export function validateImport(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: '文件内容不是有效的 JSON' }
  if (obj.app !== 'zhiyi') return { ok: false, error: '这不是知一的备份文件' }
  const items = Array.isArray(obj.items) ? obj.items : []
  const hasStats = obj.stats && typeof obj.stats === 'object'
  const hasProfile = obj.profile && typeof obj.profile === 'object'
  if (!items.length && !hasStats && !hasProfile) {
    return { ok: false, error: '备份里没有可导入的数据' }
  }
  const bad = items.filter((it) => !it || typeof it !== 'object' || it.id == null).length
  return {
    ok: true,
    exportedAt: obj.exportedAt || '',
    nickname: obj.nickname || '',
    counts: { items: items.length, badItems: bad, hasStats: !!hasStats, hasProfile: !!hasProfile },
    items,
    stats: hasStats ? obj.stats : null,
    profile: hasProfile ? obj.profile : null,
  }
}

/** 导出文件名 */
export function exportFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `知一备份-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`
}

export function profileKey(space) {
  return space === 'account' ? KEY_ACCOUNT : KEY_GUEST
}

export function loadProfile(space = 'guest') {
  try {
    if (typeof localStorage === 'undefined') return emptyProfile()
    const raw = localStorage.getItem(profileKey(space))
    return raw ? normalizeProfile(JSON.parse(raw)) : emptyProfile()
  } catch {
    return emptyProfile()
  }
}

export function saveProfile(profile, space = 'guest') {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(profileKey(space), JSON.stringify(normalizeProfile(profile)))
  } catch {
    /* 配额不足：静默降级 */
  }
}

/** localStorage 占用（KB，保留一位小数，用于数据管理面板展示） */
export function storageUsageKB() {
  try {
    if (typeof localStorage === 'undefined') return 0
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || ''
      if (!k.startsWith('zhiyi_')) continue
      total += (localStorage.getItem(k) || '').length + k.length
    }
    return Math.round(total / 102.4) / 10
  } catch {
    return 0
  }
}
