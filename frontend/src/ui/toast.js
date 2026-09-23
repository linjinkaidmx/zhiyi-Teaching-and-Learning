/**
 * Toast 服务：与 UI 解耦的轻量队列（组件 UiToastHost 负责渲染）
 * 用法：toast('已保存') / toast('识别失败', { type: 'error', duration: 4000 })
 *      toast.persist('已保存') → 返回 dismiss 函数（用于「重要状态持续显示」）
 */
import { reactive } from 'vue'

let seed = 0

export const toastState = reactive({ items: [] })

function push(message, options = {}) {
  const {
    type = 'info',
    duration = options.persist ? 0 : 2600,
    actionText = '',
    onAction = null,
  } = options

  const id = ++seed
  const item = { id, message, type, actionText }
  toastState.items.push(item)

  let timer = null
  const dismiss = () => {
    if (timer) clearTimeout(timer)
    const index = toastState.items.findIndex((x) => x.id === id)
    if (index >= 0) toastState.items.splice(index, 1)
  }
  if (duration > 0) timer = setTimeout(dismiss, duration)

  item.onAction = () => {
    if (typeof onAction === 'function') onAction()
    dismiss()
  }
  item.dismiss = dismiss
  return dismiss
}

export function toast(message, options) {
  return push(message, options)
}
toast.success = (message, options) => push(message, { ...options, type: 'success' })
toast.error = (message, options) => push(message, { ...options, type: 'error' })
toast.info = (message, options) => push(message, { ...options, type: 'info' })
/** 持续显示的重要状态（例如「已保存」），直到被 dismiss */
toast.persist = (message, options) => push(message, { ...options, persist: true })

export function clearToasts() {
  toastState.items.splice(0, toastState.items.length)
}

export function useToast() {
  return toast
}
