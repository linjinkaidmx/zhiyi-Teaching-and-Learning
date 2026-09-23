/**
 * captureStore · 拍题入口之间的图片透传
 * ---------------------------------------------------------------------------
 * 首页拍题卡选图后 → 存入 pendingImage → 跳 /capture 直接带过去识别，
 * 实现「首页拍题 → 拍题页」的无缝交接（P3 是跳转重新选图，P4 起透传）。
 */
import { ref } from 'vue'

const pending = ref(null) // { dataUrl: string, mime: string, name: string }

export function setPendingImage(payload) {
  pending.value = payload || null
}

export function takePendingImage() {
  const p = pending.value
  pending.value = null
  return p
}

export function pendingRef() {
  return pending
}
