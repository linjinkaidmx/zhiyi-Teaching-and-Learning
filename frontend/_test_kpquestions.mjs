/**
 * 知识点快捷提问 · 纯逻辑回归（离线自包含）
 * 用法：node _test_kpquestions.mjs
 */
import {
  templateQuestions,
  wrongQuestion,
  buildQuestions,
  parseQuestions,
  sanitizeQuestion,
  aiPromptFor,
  cacheKey,
  readCache,
  writeCache,
  CACHE_TTL,
} from './src/lib/kpQuestions.js'

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const section = (t) => console.log('\n' + t)

/** 内存版 localStorage，避免依赖浏览器 */
function memStore() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
  }
}

section('1. 模板问题')
const t1 = templateQuestions('条件概率')
ok(t1.length === 4, '默认 4 条', t1.length)
ok(t1[0] === '条件概率的定义是什么？', '首条是定义', t1[0])
ok(t1.every((q) => q.includes('条件概率')), '每条都带上知识点名')
ok(templateQuestions('').length === 0, '空知识点返回空')
ok(templateQuestions('  指针与数组  ')[0] === '指针与数组的定义是什么？', '知识点名两端空白已 trim')

section('2. 错题诊断条')
ok(wrongQuestion('条件概率', 3) === '我在条件概率这类题上错了 3 次，帮我分析原因', '有错题时给出诊断条')
ok(wrongQuestion('条件概率', 0) === null, '没错题时不给')
ok(wrongQuestion('条件概率', -1) === null, '负数当作没有')
ok(buildQuestions('条件概率', { wrongCount: 3 }).length === 5, '模板 4 条 + 诊断 1 条')
ok(buildQuestions('条件概率').length === 4, '没错题时仍是 4 条')

section('3. 解析模型输出')
ok(parseQuestions('1. 条件概率怎么理解\n2. 它在什么题里用\n3. 容易错在哪\n4. 这类题怎么练').length === 4, '解析「1. 」编号')
ok(parseQuestions('- 条件概率怎么理解\n- 它在什么题里用').length === 2, '解析「- 」列表')
ok(parseQuestions('1）条件概率怎么理解\n2）它在什么题里用').length === 2, '解析「1）」编号')
ok(parseQuestions('好的，以下是：\n1. 条件概率怎么理解\n2. 它在什么题里用\n希望有帮助').length === 2, '忽略首尾废话')
ok(parseQuestions('1. 太短\n2. 这是一条长度合适的问题').length === 1, '过短的条目被丢弃')
ok(parseQuestions('1. 同样的问题\n2. 同样的问题').length === 1, '去重')
ok(parseQuestions('').length === 0, '空输入返回空')
const long = parseQuestions('1. ' + 'x'.repeat(80))
ok(long.length === 0, '超长条目被丢弃（避免模型跑偏）')

section('4. 缓存')
const s = memStore()
const now = 1000000
ok(readCache('条件概率', now, s) === null, '未缓存时读不到')
ok(writeCache('条件概率', ['q1', 'q2'], now, s) === true, '写入成功')
ok(JSON.stringify(readCache('条件概率', now, s)) === JSON.stringify(['q1', 'q2']), '读回一致')
ok(readCache('条件概率', now + CACHE_TTL + 1, s) === null, '超过 7 天过期')
ok(readCache('别的', now, s) === null, '不同知识点互不干扰')
ok(writeCache('条件概率', [], now, s) === false, '空列表不写缓存')
ok(cacheKey('条件概率') === 'zhiyi_kpq_条件概率', '缓存键带前缀', cacheKey('条件概率'))
ok(readCache('条件概率', now, { getItem: () => '{坏 json' }) === null, '坏数据当作没有')

section('5. LaTeX 清洗')
const s1 = sanitizeQuestion('为啥 $P(A\\cup B)=P(A)+P(B)$ 会错?')
ok(s1.includes('P(A∪') && s1.includes('∪') && !s1.includes('$') && !s1.includes('\\cup'), '行内公式转 Unicode', s1)
ok(!sanitizeQuestion('为啥 $P(A\\cup B)$ 会错?').includes('$'), '转换后不含 $ 定界符')
ok(sanitizeQuestion('普通文本没公式') === '普通文本没公式', '无公式原样返回')
ok(sanitizeQuestion('') === '', '空串安全')
const ql = parseQuestions('1. 为啥 $P(A\\cup B)=P(A)+P(B)$ 有时会算错\n2. 条件概率的定义')
ok(ql[0].includes('P(A∪') && !ql[0].includes('$') && !ql[0].includes('\\cup'), 'parseQuestions 输出已清洗', ql[0])

section('6. 提问文本')
const p = aiPromptFor('条件概率')
ok(p.includes('条件概率'), '提示语带上知识点名')
ok(p.includes('只输出 4 行'), '约束输出格式')
ok(p.includes('不要编号以外的任何说明'), '约束不要废话')
ok(p.includes('不要用 LaTeX'), '约束不要 LaTeX')

console.log('\n==============================================')
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
