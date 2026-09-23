/**
 * 成就庆祝队列
 * ---------------------------------------------------------------------------
 * 分级策略（不打断学习节奏，同时让高价值成就足够隆重）：
 *   · 普通 / 稀有 → 顶部滑入一张奖章卡，停留 4.5 秒自动收起；同时解锁多个会合并成一张
 *   · 史诗 / 传说 → 全屏揭晓浮层，逐个展示（等用户点「知道了」或 7 秒自动收起）
 * 组件：ui/AchievementToast.vue（轻提示）、ui/AchievementReveal.vue（全屏）
 */
import { ref } from 'vue'
import { ACHIEVEMENT_MAP, RARITY_NAME } from '../achievements.js'

/** 顶部轻提示队列：[{ id, keys: string[], count, first }] */
export const achToasts = ref([])
/** 当前全屏揭晓的成就 key（'' = 不展示） */
export const achRevealKey = ref('')

const revealQueue = ref([])
let toastSeq = 0
let toastTimer = null

const isHigh = (key) => {
  const a = ACHIEVEMENT_MAP[key]
  return a && (a.rarity === 'epic' || a.rarity === 'legend')
}

function nextReveal() {
  if (achRevealKey.value) return
  const k = revealQueue.value.shift()
  if (k) achRevealKey.value = k
}

/** 用户点「知道了」（或超时）→ 展示下一个 */
export function dismissReveal() {
  achRevealKey.value = ''
  setTimeout(nextReveal, 260)
}

/** 收起当前轻提示（点关闭或超时） */
export function dismissToast(id) {
  achToasts.value = achToasts.value.filter((t) => t.id !== id)
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
  if (achToasts.value.length) armToastTimer()
}

function armToastTimer() {
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    achToasts.value = achToasts.value.slice(1)
    toastTimer = null
    if (achToasts.value.length) armToastTimer()
  }, 4500)
}

/**
 * 入口：把一批新解锁的成就 key 送进庆祝流程
 * @param {string[]} keys
 */
export function celebrate(keys = []) {
  const valid = (keys || []).filter((k) => ACHIEVEMENT_MAP[k])
  if (!valid.length) return
  const low = valid.filter((k) => !isHigh(k))
  const high = valid.filter(isHigh)

  if (low.length) {
    // 合并成一条（避免连续解锁刷屏）：只显示第一个名字 + 总数
    const first = ACHIEVEMENT_MAP[low[0]]
    achToasts.value = [...achToasts.value, {
      id: ++toastSeq,
      keys: low,
      count: low.length,
      first,
      rarityName: RARITY_NAME[first.rarity],
    }].slice(-2)   // 最多同时 2 条
    armToastTimer()
  }
  if (high.length) {
    revealQueue.value.push(...high)
    nextReveal()
  }
}

/** 测试/登出用：清空队列 */
export function resetCelebrate() {
  achToasts.value = []
  revealQueue.value = []
  achRevealKey.value = ''
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
}
