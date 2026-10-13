// 图片文件通用管线：校验 + EXIF 转正 + 等比压缩。
// 从 CapturePage 抽出，供拍题页与自测作答页（PracticePage）共用。

/** 图片最长边上限（压缩目标）与文件大小上限 */
export const MAX_EDGE = 1600
export const MAX_BYTES = 15 * 1024 * 1024

/**
 * 读图 + 应用 EXIF 方向 + 等比压缩的前置：拿到已转正的位图。
 * 用 createImageBitmap({imageOrientation:'from-image'}) 让浏览器**自动转正**，
 * 避免手写旋转把方向搞反；不支持时降级为 <img>（方向可能丢，但至少不报错）。
 */
export async function loadOriented(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (e) {
    const url = URL.createObjectURL(file)
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('图片读取失败'))
        img.src = url
      })
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** 等比压缩；超长图保留 PNG，普通图 JPEG */
export function compressImage(file, mime) {
  return loadOriented(file).then((src) => {
    const w = src.width || src.naturalWidth || 0
    const h = src.height || src.naturalHeight || 0
    if (!w || !h) throw new Error('图片尺寸无效')
    const scale = Math.max(w, h) > MAX_EDGE ? MAX_EDGE / Math.max(w, h) : 1
    const cw = Math.round(w * scale)
    const ch = Math.round(h * scale)
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.drawImage(src, 0, 0, cw, ch)
    const outMime = ch > cw * 3 ? 'image/png' : 'image/jpeg'
    const q = outMime === 'image/jpeg' ? 0.78 : undefined
    return { dataUrl: canvas.toDataURL(outMime, q), mime: outMime, w: cw, h: ch }
  })
}

/**
 * 校验并读取图片文件：非图片 / 超过大小上限时经 onError 提示并返回 null。
 * 返回 { dataUrl, mime, raw } —— dataUrl 为压缩转正结果（压缩失败时用 raw 原图兜底），
 * raw 为未压缩的 dataURL。回调可选，不传则静默返回 null。
 */
export async function readImageDataUrl(file, { onError } = {}) {
  if (!file || !/^image\//.test(file.type)) {
    onError && onError('请选择图片文件')
    return null
  }
  if (file.size > MAX_BYTES) {
    onError && onError('图片超过 15MB，请压缩后再上传')
    return null
  }
  const raw = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
  try {
    const r = await compressImage(file, file.type)
    return { dataUrl: r.dataUrl, mime: r.mime, raw }
  } catch (e) {
    // 压缩/转正失败也照常使用原图，不阻断流程
    return { dataUrl: raw, mime: file.type, raw }
  }
}

/**
 * 按 dataURL 重压一次（指定最长边与 JPEG 质量）。
 */
async function recompress(dataUrl, edge, quality) {
  const img = await new Promise((resolve) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => resolve(null)
    el.src = dataUrl
  })
  if (!img || !img.width) return dataUrl
  const scale = Math.min(1, edge / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * 单张 dataURL 超过阈值时**多轮降质**，直到进入目标体积或用尽档位。
 * ---------------------------------------------------------------------------
 * 为什么要收紧：A/B 实测（2026-09-22）显示视觉调用耗时受图片体积影响明显，
 * 49KB 的真实作业图批改 7.5s，而接近后端 450KB 上限的图会拖到分钟级甚至超时。
 * 目标 ~220KB：肉眼几乎无损（作业场景以文字为主），但视觉调用明显更快更稳。
 * 档位：1200/0.72 → 1100/0.62 → 1000/0.55（最后一档也超就接受，避免无限降质伤识别）。
 */
export async function shrinkIfNeeded(dataUrl, limit = 260000) {
  if (!dataUrl || dataUrl.length <= limit) return dataUrl
  let cur = dataUrl
  const rounds = [
    [1200, 0.72],
    [1100, 0.62],
    [1000, 0.55],
  ]
  for (const [edge, q] of rounds) {
    try {
      cur = await recompress(cur, edge, q)
    } catch {
      return cur
    }
    if (cur.length <= limit) return cur
  }
  return cur
}
