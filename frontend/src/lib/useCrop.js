// 拍题「框选裁剪」组合式函数：首页与拍题页共用。
// pointer 事件统一鼠标 + 触屏；松手只保留选区，是否裁剪/识别由调用方决定。
import { ref, computed } from 'vue'

const MIN_SEL = 24 // 最小选区边长（显示像素），避免误触

export function useCrop() {
  const cropWrapRef = ref(null)
  const cropImgRef = ref(null)
  const cropStart = ref(null)
  const cropSel = ref(null)

  const cropBoxStyle = computed(() => {
    const s = cropSel.value
    if (!s) return {}
    return { left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px' }
  })

  function cropPoint(e) {
    const r = cropWrapRef.value.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function onCropDown(e) {
    if (e.button === 2) return
    cropStart.value = cropPoint(e)
    cropSel.value = null
  }
  function onCropMove(e) {
    if (!cropStart.value) return
    const p = cropPoint(e)
    const s = cropStart.value
    cropSel.value = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }
  }
  /** 松手：有有效选区则保留（返回 true），否则清除（返回 false）。不触发识别。 */
  function onCropUp() {
    if (!cropStart.value) return false
    const valid = cropSel.value && cropSel.value.w >= MIN_SEL && cropSel.value.h >= MIN_SEL
    cropStart.value = null
    if (!valid) cropSel.value = null
    return !!valid
  }
  function onCropLeave(e) {
    // 鼠标拖出图片但未松手：取消本次框选；触屏的 pointerleave 在 pointerup 之后，无需处理
    if (cropStart.value && (!e || e.pointerType === 'mouse')) {
      cropStart.value = null
      cropSel.value = null
    }
  }
  function resetCrop() {
    cropStart.value = null
    cropSel.value = null
  }
  /** 把当前选区按原图坐标裁剪成 JPEG dataURL；无有效选区返回 null。最长边限 1600。 */
  function cropToDataUrl() {
    const img = cropImgRef.value
    const wrap = cropWrapRef.value
    const s = cropSel.value
    if (!img || !wrap || !s) return null
    const sx = (s.x / wrap.clientWidth) * img.naturalWidth
    const sy = (s.y / wrap.clientHeight) * img.naturalHeight
    const sw = (s.w / wrap.clientWidth) * img.naturalWidth
    const sh = (s.h / wrap.clientHeight) * img.naturalHeight
    let w = Math.max(1, Math.round(sw))
    let h = Math.max(1, Math.round(sh))
    const scale = Math.min(1, 1600 / Math.max(w, h))
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.85)
  }

  return {
    cropWrapRef,
    cropImgRef,
    cropSel,
    cropBoxStyle,
    onCropDown,
    onCropMove,
    onCropUp,
    onCropLeave,
    resetCrop,
    cropToDataUrl,
  }
}
