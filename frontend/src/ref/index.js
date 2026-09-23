// 速查内容汇总：3 科公式 + 算法代码模板 + 复杂度速查表
import { CALC, LINEAR, PROB } from './formulas'
import { CODE_TEMPLATES, COMPLEXITY_TABLES } from './code'

export const SECTIONS = [
  CALC,
  LINEAR,
  PROB,
  { key: 'algo', name: '算法代码模板', type: 'code', items: CODE_TEMPLATES },
  { key: 'complexity', name: '复杂度速查', type: 'table', tables: COMPLEXITY_TABLES },
]

/** 某一分类的条目数（用于分类按钮上的角标） */
export function countOf(section) {
  if (section.type === 'formula') return section.groups.reduce((s, g) => s + g.items.length, 0)
  if (section.type === 'code') return section.items.length
  return section.tables.length
}

/** 组装代码围栏，交给 MathText 做 hljs 高亮渲染 */
export function fence(item) {
  return '```' + (item.lang || 'c') + '\n' + item.code + '\n```'
}
