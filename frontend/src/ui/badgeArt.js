/**
 * 奖章图形库（纯逻辑，可离线测试）
 * ---------------------------------------------------------------------------
 * 组合式：底座表达稀有度（铜六边 / 银盾 / 金齿边 / 紫光环），图腾表达成就语义。
 * 所有图形在 96×96 画布内绘制；渐变与滤镜在 ui/BadgeDefs.vue 里全局定义一次
 * （id 前缀 bm-），奖章组件直接引用，避免每个实例重复定义。
 */

/** n 边（或 n 齿）极坐标点串，用于生成正多边形/齿轮路径 */
export function polygon(n, r, cx = 48, cy = 48, rot = 0, r2 = null) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2 + rot
    const rr = r2 === null ? r : (i % 2 === 0 ? r : r2)
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`)
  }
  return pts.join('L')
}

export const RARITY_LIST = ['common', 'rare', 'epic', 'legend']

/** 稀有度中文名从数据层再导出，保持单一来源 */
export { RARITY_NAME } from '../achievements.js'
export const RARITY_METAL = { common: '铜', rare: '银', epic: '金', legend: '紫' }

/** 底座：按稀有度返回 SVG 片段（引用全局渐变） */
export function baseOf(rarity) {
  if (rarity === 'rare') {
    return '<path d="M48 8C63 8 77 13 84 17V49C84 71 66 85 48 91C30 85 12 71 12 49V17C19 13 33 8 48 8Z" fill="url(#bm-g-rare)" stroke="#6b7689" stroke-width="1.4" stroke-linejoin="round"/>'
  }
  if (rarity === 'epic') {
    return `<path d="M${polygon(24, 40, 48, 48, 0, 35.5)}Z" fill="url(#bm-g-epic)" stroke="#9a6a12" stroke-width="1.4" stroke-linejoin="round"/>`
  }
  if (rarity === 'legend') {
    return '<circle cx="48" cy="48" r="40" fill="url(#bm-g-legend)" stroke="#4b39b8" stroke-width="1.4"/>'
  }
  return `<path d="M${polygon(6, 40)}Z" fill="url(#bm-g-common)" stroke="#8a5a2b" stroke-width="1.4" stroke-linejoin="round"/>`
}

/** 内圈亮边：给底座一点体积感 */
export function ringOf(rarity) {
  if (rarity === 'rare') {
    return '<path d="M48 15C60 15 71 19 77 22.5V48C77 66 62.5 78 48 83.5C33.5 78 19 66 19 48V22.5C25 19 36 15 48 15Z" fill="none" stroke="url(#bm-g-ring)" stroke-width="1.2" opacity=".55"/>'
  }
  if (rarity === 'epic') {
    return `<path d="M${polygon(24, 33, 48, 48, 0, 29)}Z" fill="none" stroke="url(#bm-g-ring)" stroke-width="1.2" stroke-linejoin="round" opacity=".5"/>`
  }
  if (rarity === 'legend') {
    return '<circle cx="48" cy="48" r="33" fill="none" stroke="url(#bm-g-ring)" stroke-width="1.2" opacity=".5"/>'
  }
  return `<path d="M${polygon(6, 35.5)}Z" fill="none" stroke="url(#bm-g-ring)" stroke-width="1.2" stroke-linejoin="round" opacity=".55"/>`
}

/** 传说级：外环虚线圈 + 8 道星芒（页面里缓慢旋转） */
export function legendHalo() {
  let s = '<circle cx="48" cy="48" r="45.5" fill="none" stroke="#9b83fb" stroke-width="2" stroke-linecap="round" stroke-dasharray="6 9" opacity=".85"/>'
  s += '<circle cx="48" cy="48" r="47" fill="url(#bm-g-halo)"/>'
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2
    const x1 = 48 + Math.cos(a) * 41, y1 = 48 + Math.sin(a) * 41
    const x2 = 48 + Math.cos(a) * 47.5, y2 = 48 + Math.sin(a) * 47.5
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#c3b0ff" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>`
  }
  return s
}

/** 图腾：24×24 线条图形（与站点 UiIcon 同一套语言），每个功能域 3 个变体 */
export const TOTEM = {
  // 拍照搜题
  search: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="11" cy="11" r="3.4"/><path d="M14.6 14.6 18 18"/>',
  camera: '<rect x="2.8" y="6.6" width="18.4" height="13.6" rx="3"/><circle cx="12" cy="13.4" r="3.6"/><path d="M8.6 6.6 10 4.4h4l1.4 2.2"/>',
  bolt: '<path d="M13.8 3.2 6.4 13.4h4.9l-1.5 7.4 7.6-10.2h-4.9z"/>',
  // 错题自测
  book: '<path d="M11.6 6.6S9.6 5 6.6 5H3.6v12h3c3 0 5 1.6 5 1.6"/><path d="M12.4 6.6S14.4 5 17.4 5h3v12h-3c-3 0-5 1.6-5 1.6"/>',
  bookmark: '<path d="M6.6 3.6h10.8v16.8l-5.4-4.2-5.4 4.2z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>',
  // 讲解追问
  chat: '<path d="M20 11.2c0 3.6-3.6 6.5-8 6.5-.9 0-1.8-.1-2.6-.35L5 19.5l1.2-3.2A6.2 6.2 0 0 1 4 11.2C4 7.6 7.6 4.7 12 4.7s8 2.9 8 6.5Z"/>',
  question: '<path d="M20 11.2c0 3.6-3.6 6.5-8 6.5-.9 0-1.8-.1-2.6-.35L5 19.5l1.2-3.2A6.2 6.2 0 0 1 4 11.2C4 7.6 7.6 4.7 12 4.7s8 2.9 8 6.5Z"/><path d="M10.3 9.5a1.9 1.9 0 1 1 2.5 1.8c-.5.2-.8.5-.8 1v.2"/><path d="M12 15.5h.01"/>',
  layers: '<path d="M12 3.6 3.6 8.2 12 12.8l8.4-4.6z"/><path d="M3.6 12.4 12 17l8.4-4.6"/><path d="M3.6 16.2 12 20.8l8.4-4.6"/>',
  // 编程工具
  code: '<path d="M9 7 4.6 12 9 17"/><path d="M15 7 19.4 12 15 17"/>',
  terminal: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4"/><path d="M7.6 10l2.2 2.2-2.2 2.2"/><path d="M12.6 14.6h4"/>',
  bug: '<circle cx="12" cy="12.8" r="4.4"/><path d="M12 8.4v8.8M7.9 9.9 5.2 8.3M16.1 9.9 18.8 8.3M7.6 12.8H4.2M16.4 12.8h3.4M8.1 15.7 5.6 17.4M15.9 15.7l2.5 1.7"/><path d="M9.5 7.6a2.5 2.5 0 0 1 5 0"/>',
  // 班级课堂
  class: '<rect x="3" y="4.6" width="18" height="11.4" rx="2"/><path d="M7.5 20h9"/><path d="M12 16v4"/>',
  homework: '<path d="M6.6 3.6h7.8l3.6 3.6v13.2H6.6z"/><path d="M9.8 10.4h6M9.8 13.6h6M9.8 16.8h3.4"/>',
  podium: '<path d="M4 19.6h4.4v-5.4H4zM9.8 19.6h4.4V9.4H9.8zM15.6 19.6H20V5.8h-4.4z"/>',
  // 考试模拟
  exam: '<path d="M7.5 4.5h9v3.6a4.5 4.5 0 0 1-9 0z"/><path d="M12 12.6v2.4"/><path d="M8.8 19.5h6.4l-1-4.5H9.8z"/><path d="M7.5 6H5v1.6a2.4 2.4 0 0 0 2.4 2.4M16.5 6H19v1.6a2.4 2.4 0 0 1-2.4 2.4"/>',
  clock: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.2V12l3.2 2"/>',
  medal: '<circle cx="12" cy="14.4" r="5"/><path d="M8.6 9.2 6.4 3.6h11.2l-2.2 5.6"/><path d="M12 12.6v3.6"/>',
  // 数据 / 探索
  data: '<path d="M4 19 9 12.5l3.6 2.6L20 5"/><path d="M4.5 19.5h15"/>',
  pie: '<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8V12h8.2"/>',
  calendar: '<rect x="3.4" y="5.4" width="17.2" height="15" rx="2.6"/><path d="M3.4 10h17.2M8 3.4v3.6M16 3.4v3.6"/>',
  spark: '<path d="M12 3.6 13.9 9l5.4 1.9-5.4 1.9L12 18.2l-1.9-5.4L4.7 10.9 10.1 9z"/>',
  compass: '<circle cx="12" cy="12" r="8.2"/><path d="M15.6 8.4 13.7 13.7 8.4 15.6 10.3 10.3z"/>',
  rocket: '<path d="M12 3.2s4.6 2.4 4.6 8.4c0 3.4-1.6 6.4-1.6 6.4h-6s-1.6-3-1.6-6.4C7.4 5.6 12 3.2 12 3.2Z"/><circle cx="12" cy="9.6" r="1.7"/><path d="M9.4 18.4h5.2M10.2 20.8h3.6"/>',
}

/** 图腾缺省回退，避免定义里写错名字时奖章空白 */
export function totemOf(name) {
  return TOTEM[name] || TOTEM.spark
}
