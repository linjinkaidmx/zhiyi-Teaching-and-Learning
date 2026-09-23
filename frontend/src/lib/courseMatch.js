/**
 * 课程归类匹配（纯逻辑，脱离浏览器可单测）
 * ---------------------------------------------------------------------------
 * 把 AI 判的学科名（result.subject，如「概率论」）映射到用户课程表里
 * 最接近的课程，用于拍完题存错题时的自动预选归类。
 * 只做规则匹配，不调模型、不花额度。
 */

const asArray = (x) => (Array.isArray(x) ? x : [])

/** 归一化：去空白、统一全角半角、去常见后缀词 */
function norm(s) {
  return String(s || '')
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/[：:、,，]/g, '')
    .replace(/(课程|上|下|一|二|三|四|实验|实践)$/g, '')
    .toLowerCase()
}

/**
 * 匹配课程，返回 course 或 null。
 * 优先级：完全同名 > 课程名包含 subject > subject 包含课程关键词。
 */
export function matchCourse(subject, courses) {
  const s = norm(subject)
  if (!s) return null
  const list = asArray(courses)

  // 1) 完全一致
  for (const c of list) {
    if (norm(c && c.name) === s) return c
  }
  // 2) 课程名包含 subject（「概率论」→「概率论与数理统计」）
  for (const c of list) {
    const n = norm(c && c.name)
    if (n && n.length > s.length && n.includes(s)) return c
  }
  // 3) subject 包含课程关键词（subject 较长时）
  for (const c of list) {
    const n = norm(c && c.name)
    if (n && n.length >= 2 && s.length > n.length && s.includes(n)) return c
  }
  return null
}

/** 已归类题目的显示名；未归类返回空串 */
export function courseNameOf(item, courses) {
  const id = item && item.courseId
  if (!id) return ''
  const c = asArray(courses).find((x) => x && String(x.id) === String(id))
  return c ? c.name : ''
}
