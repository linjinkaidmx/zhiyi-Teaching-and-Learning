/**
 * confirm · Promise 式确认框（替代 ElMessageBox.confirm）
 * ---------------------------------------------------------------------------
 * 用法：confirm({ title, message, okText, cancelText, danger }).then(ok => ...)
 *      ElMessageBox 兼容层见 ui/notify.js（取消时 reject，与 EP 行为一致）
 * 渲染：UiConfirmHost（已在 AppShell / App 外壳中全局挂载一次）
 */
import { reactive } from 'vue'

export const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  okText: '确定',
  cancelText: '取消',
  danger: false,
})

let resolver = null

export function confirm(options = {}) {
  return new Promise((resolve) => {
    resolver = resolve
    Object.assign(confirmState, {
      open: true,
      title: '',
      message: '',
      okText: '确定',
      cancelText: '取消',
      danger: false,
      ...options,
    })
  })
}

export function resolveConfirm(ok) {
  const r = resolver
  resolver = null
  confirmState.open = false
  if (r) r(ok)
}
