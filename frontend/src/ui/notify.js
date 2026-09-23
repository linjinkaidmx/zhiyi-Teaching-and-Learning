/**
 * notify · ElMessage / ElMessageBox 兼容层
 * ---------------------------------------------------------------------------
 * 目的：移除 Element Plus 时，各组件只需把
 *     import { ElMessage, ElMessageBox } from 'element-plus'
 * 改成
 *     import { ElMessage, ElMessageBox } from '../ui/notify.js'
 * 调用点一行都不用改（本项目里这类调用有 60+ 处）。
 *
 * 行为对齐：
 *   ElMessage.success/warning/error/info(msg)  → 右下/底部 Toast
 *   ElMessageBox.confirm(msg, title, opts)     → Promise；取消时 reject（与 EP 一致，既有 .catch 不受影响）
 *   ElMessageBox.alert(msg, title, opts)       → Promise（确认后 resolve）
 */
import { toast } from './toast.js'
import { confirm } from './confirm.js'

function message(type) {
  return (msg, options) => {
    const opts = typeof options === 'object' && options ? options : {}
    return toast(String(msg == null ? '' : msg), { type, ...opts })
  }
}

export const ElMessage = {
  success: message('success'),
  error: message('error'),
  warning: message('info'),
  info: message('info'),
  closeAll: () => {},
}

const CANCEL = 'cancel'

function toConfirmOptions(message_, title, options) {
  const opts = typeof options === 'object' && options ? options : {}
  return {
    title: typeof title === 'string' ? title : '',
    message: String(message_ == null ? '' : message_),
    okText: opts.confirmButtonText || '确定',
    cancelText: opts.cancelButtonText || '取消',
    danger: opts.type === 'error' || opts.type === 'warning',
  }
}

export const ElMessageBox = {
  /** 取消 → reject('cancel')；确认 → resolve('confirm')（语义与 EP 对齐） */
  confirm(message_, title, options) {
    return confirm(toConfirmOptions(message_, title, options)).then((ok) => {
      if (ok) return 'confirm'
      throw CANCEL
    })
  },
  /** 只有确认按钮：关闭也算已读，统一 resolve */
  alert(message_, title, options) {
    return confirm({ ...toConfirmOptions(message_, title, options), cancelText: '关闭' }).then(() => 'confirm')
  },
}
