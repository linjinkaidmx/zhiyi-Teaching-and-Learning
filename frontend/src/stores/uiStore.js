/**
 * uiStore · 跨页面的轻量 UI 状态（P6 起）
 * ---------------------------------------------------------------------------
 * 目前只有登录/注册弹窗：它由 App 外壳渲染，但需要被页面（如「我的」）唤起，
 * 属于典型的跨层状态，放 store 里最直接。
 */
import { reactive } from 'vue'

export const ui = reactive({
  authOpen: false,
  authMode: 'login', // login | register | changePassword
})

export function openAuth(mode = 'login') {
  ui.authMode = mode
  ui.authOpen = true
}

export function closeAuth() {
  ui.authOpen = false
}
