/**
 * 新手教程「是否看过」的状态管理
 * ---------------------------------------------------------------------------
 * 存储：localStorage 的 zy_tour_<key>（值=首次看完的时间戳）
 * 规则：看过就不再自动弹；用户随时可以从页面右上角「?」重新打开。
 */
const markKey = (key) => `zy_tour_${key}`

/** 是否需要在进入页面时自动弹（没看过才弹） */
export function shouldAutoShowTour(key) {
  try {
    return !localStorage.getItem(markKey(key))
  } catch {
    return false // 隐私模式：读不到就当作已看过，避免每次刷新都弹
  }
}

/** 标记为已看过 */
export function markTourSeen(key) {
  try {
    localStorage.setItem(markKey(key), String(Date.now()))
  } catch {
    /* 忽略 */
  }
}

/** 重置（调试 / 未来做「重新看一遍教程」用） */
export function resetTour(key) {
  try {
    localStorage.removeItem(markKey(key))
  } catch {
    /* 忽略 */
  }
}
