/**
 * 开场动画 · Vue 侧接口（纯逻辑，可离线测试）
 * ---------------------------------------------------------------------------
 * 开屏层本体在 index.html（内联 HTML/CSS/JS，不依赖 Vue，用来盖住首屏加载的空白期）。
 * 本模块负责三件事：
 *   markBootReady()       —— Vue 挂载完成后通知开屏层可以交接
 *   onBootDone(cb)        —— 等开屏层结束（已结束则立即回调），首页据此决定是否播级联
 *   startEnterSequence()  —— 给 <html> 加 is-enter（场景展开 + 内容级联的动画作用域）
 *
 * 为什么用 <html> 上的 class 而不是 props：
 *   背景层（HomeBackground）与首页内容分属两个组件、且动画只跑一次，
 *   用根节点 class 让两处共用同一个开关，且切页回来时能确保不再重播。
 */
export const ENTER_CLASS = 'is-enter'
const DONE_CLASS = 'zy-boot-done'
const SKIP_CLASS = 'zy-boot-skip'

/** 给测试用：判定某个 classList 集合是否表示「本次要播入场」 */
export function shouldAnimateClasses(has) {
  return !!has(DONE_CLASS) && !has(SKIP_CLASS)
}

function root() {
  return typeof document === 'undefined' ? null : document.documentElement
}

/** Vue 挂载完成 → 通知开屏层（它会等最短展示时间后交接） */
export function markBootReady() {
  try {
    if (typeof window !== 'undefined' && window.__zyBoot) window.__zyBoot.ready()
  } catch {
    /* 开屏层不存在（深链/已播过）时忽略 */
  }
}

export function bootDone() {
  const r = root()
  return !!r && r.classList.contains(DONE_CLASS)
}

/** 本次是否需要播放入场（开屏层播过且未被跳过） */
export function bootWillAnimate() {
  const r = root()
  return !!r && shouldAnimateClasses((c) => r.classList.contains(c))
}

/**
 * 等开屏层结束：已结束立即回调；否则监听 <html> 的 class 变化（含超时兜底）。
 * 返回取消函数。
 */
export function onBootDone(cb, timeout = 3200) {
  if (typeof document === 'undefined') {
    cb(false)
    return () => {}
  }
  const r = document.documentElement
  if (bootDone()) {
    cb(bootWillAnimate())
    return () => {}
  }
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    obs.disconnect()
    clearTimeout(timer)
    cb(bootWillAnimate())
  }
  const obs = new MutationObserver(() => {
    if (r.classList.contains(DONE_CLASS)) finish()
  })
  obs.observe(r, { attributes: true, attributeFilter: ['class'] })
  const timer = setTimeout(finish, timeout)
  return () => {
    finished = true
    obs.disconnect()
    clearTimeout(timer)
  }
}

/**
 * 启动入场级联：加 is-enter 触发动画；动画结束后自动移除该 class，
 * 避免用户切到别的页面再回首页时又播一遍（主题要求：只在点开网站时播）。
 */
export function startEnterSequence(duration = 1900) {
  const r = root()
  if (!r) return () => {}
  r.classList.add(ENTER_CLASS)
  const timer = setTimeout(() => r.classList.remove(ENTER_CLASS), duration)
  return () => {
    clearTimeout(timer)
    r.classList.remove(ENTER_CLASS)
  }
}
