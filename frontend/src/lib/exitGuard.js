/**
 * 移动端「双击返回键退出站点」
 * ---------------------------------------------------------------------------
 * 背景：浏览器返回键 = history 后退。移动端用户在首页按返回时，
 * 往往是想「退出」，结果却回到了上一个点开的页面（体验很别扭）。
 *
 * 做法：用「哨兵 history entry」把首页的返回动作接住 —— 进入首页时压一个
 * 与当前 URL 相同的哨兵，用户按返回时 pop 掉哨兵（URL 不变，路由不动）：
 *   第一次 → 补一个哨兵把这次后退抵消掉，提示「再按一次退出」
 *   2s 内再按 → 真正离开站点
 *
 * 只在移动端（<768px）启用：桌面返回键的主流预期仍是「回上一页」。
 */
import { toast } from '../ui/toast.js'

/** 进入应用时的 history 长度，用于计算「要后退多少步才能出栈」 */
const ENTRY_LEN = typeof window !== 'undefined' ? window.history.length : 1

/** 纯逻辑：是否构成「双击」（离线可测） */
export function isDoubleBack(now, lastAt, interval = 2000) {
  return lastAt > 0 && now - lastAt > 0 && now - lastAt <= interval
}

/** 纯逻辑：是否移动端 */
export function isMobileViewport(width) {
  return typeof width === 'number' && width > 0 && width <= 767
}

/**
 * @param {object} o
 * @param {() => boolean} o.isHome        当前是否在首页（含「移动端」判断）
 * @param {() => boolean} [o.hasModal]    是否有弹窗打开（先关弹窗，不退出）
 * @param {() => void}    [o.closeModal]
 * @param {() => void}    [o.onExit]      退出兜底：没有站外历史可退时调用（展示「已退出」）
 * @param {number}        [o.interval]    双击间隔（ms）
 */
export function installExitGuard({ getPath, isHome, hasModal, closeModal, onExit, interval = 2000 } = {}) {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') {
    return { sync() {}, destroy() {} }
  }

  let lastAt = 0
  let leaving = false

  /** 压哨兵：与当前 URL 相同，pop 它不会改变地址，也不会让路由跳转 */
  function pushGuard() {
    if (leaving) return
    if (window.history.state && window.history.state.zyExitGuard) return
    try {
      window.history.pushState({ zyExitGuard: 1 }, '', window.location.href)
    } catch {
      /* 某些环境禁止 pushState，忽略即可 */
    }
  }

  function leave() {
    leaving = true
    // 退回到「进入本站之前」的那一条历史；没有就退到栈底
    const steps = Math.max(1, window.history.length - ENTRY_LEN + 1)
    try {
      window.history.go(-steps)
    } catch {
      /* 忽略 */
    }
    // 若没有站外历史（用户直接打开本站），go 不会真的离开页面 —— 脚本还在跑，
    // 说明没退成，交给调用方展示「已退出」落地页。
    window.setTimeout(() => {
      if (typeof onExit === 'function') onExit()
    }, 700)
  }

  /**
   * 用 popstate 的 event.state 判断落点，不依赖路由时序：
   *   落在哨兵上 → 说明是从子页回到首页（普通回退），不拦截
   *   落在首页本体上 → URL 没变还往后退，就是「在首页按返回」，接管
   */
  function onPop(event) {
    if (leaving) return
    const landedOnGuard = !!(event && event.state && event.state.zyExitGuard)
    if (landedOnGuard) {
      lastAt = 0
      return
    }
    if (!isHome()) {
      lastAt = 0
      return
    }
    // 有弹窗：返回键先关弹窗（移动端基本预期），不触发退出
    if (typeof hasModal === 'function' && hasModal()) {
      if (typeof closeModal === 'function') closeModal()
      lastAt = 0
      pushGuard()
      return
    }
    const now = Date.now()
    if (isDoubleBack(now, lastAt, interval)) {
      leave()
      return
    }
    lastAt = now
    pushGuard()
    toast('再按一次退出知一', { duration: 1600 })
  }

  window.addEventListener('popstate', onPop)
  pushGuard()

  return {
    /** 回到首页时补上哨兵（路由变化后调用） */
    sync() {
      if (!isHome()) {
        lastAt = 0
        return
      }
      pushGuard()
    },
    destroy() {
      window.removeEventListener('popstate', onPop)
    },
  }
}
