/**
 * 模拟考试纯逻辑测试（离线自包含）
 * 重点：分值必须精确凑满 100、选择题本地判分、成绩合并、限时与历史统计。
 */
const {
  PAPER_MODES, PAPER_TOTAL, MAX_PAPER_QUESTIONS, distributeScores, buildPlan, validatePlan,
  solveTidyScores, buildCustomPlan, customSummary,
  splitForGrading, combineGrade, formatDuration, remainingSeconds, historyStats, wrongToBookCandidates,
} = await import('./src/lib/exam.js')

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  c ? pass++ : fail++
  console.log((c ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const sum = (arr) => arr.reduce((s, x) => s + x, 0)

console.log('1. 三种预设模式的分值都恰好 100')
for (const key of ['full', 'choice', 'blank']) {
  const plan = buildPlan(key)
  const total = sum(plan.map((p) => sum(p.extras)))
  ok(total === PAPER_TOTAL, `${PAPER_MODES[key].label} 总分 100`, { 题数: sum(plan.map((p) => p.count)), 分值: plan.map((p) => `${p.type}×${p.count}(${p.score}分)`) })
  ok(validatePlan(plan).ok, `${PAPER_MODES[key].label} 校验通过`)
}

console.log('\n2. 自定义题量的分值分摊')
const p1 = distributeScores([{ type: 'choice', count: 7 }, { type: 'blank', count: 5 }])
ok(sum(p1.map((p) => sum(p.extras))) === 100, '自定义（7 选择 + 5 填空）合计 100', p1.map((p) => p.extras))
ok(p1[0].extras.length === 7 && p1[1].extras.length === 5, '每题都有独立分值', p1.map((p) => p.extras.length))
ok(p1.every((p) => p.extras.every((x) => x >= 1)), '每题至少 1 分')
const p2 = distributeScores([{ type: 'solution', count: 3 }, { type: 'blank', count: 4 }, { type: 'choice', count: 6 }])
ok(sum(p2.map((p) => sum(p.extras))) === 100, '三种题型混合也精确 100', p2.map((p) => [p.type, p.extras]))
ok(p2[2].score <= p2[1].score && p2[1].score <= p2[0].score, '难度越高每题分值越大（解答 > 填空 > 选择）', p2.map((p) => [p.type, p.score]))

console.log('\n2b. 整齐解搜索（同题型每题分值相同）')
const t1 = solveTidyScores([{ type: 'choice', count: 5 }])
ok(t1 && t1[0].score === 20, '只出 5 道选择 → 每题 20 分', t1 && t1[0].score)
const t2 = solveTidyScores([{ type: 'choice', count: 5 }, { type: 'blank', count: 3 }])
ok(t2 ? t2[0].score * 5 + t2[1].score * 3 === 100 : false, '5 选择 + 3 填空 → 合计 100', t2 && t2.map((p) => [p.type, p.score]))
ok(t2 ? t2[1].score >= t2[0].score : false, '填空每题分值不低于选择', t2 && [t2[0].score, t2[1].score])
ok(t2 ? t2.every((p) => p.extras.every((x) => x === p.score)) : false, '同题型每题分值相同（无「首题多一分」）', t2 && t2.map((p) => p.extras))
const t3 = solveTidyScores([{ type: 'choice', count: 7 }])
ok(t3 === null, '7 道选择除不尽 100 → 返回 null 走回退', t3)
const t4 = solveTidyScores([{ type: 'choice', count: 10 }, { type: 'blank', count: 5 }, { type: 'solution', count: 2 }])
ok(t4 ? t4.reduce((s, p) => s + p.count * p.score, 0) === 100 : false, '三题型也能找到整齐解', t4 && t4.map((p) => [p.type, p.count, p.score]))
ok(t4 ? (t4[2].score >= t4[1].score && t4[1].score >= t4[0].score) : false, '分值随难度递增（解答 ≥ 填空 ≥ 选择）', t4 && t4.map((p) => p.score))
const bp = buildPlan('custom', { choice: 5, blank: 3 })
ok(sum(bp.map((p) => sum(p.extras))) === 100, 'buildPlan(custom) 合计 100', bp.map((p) => [p.type, p.count, p.score]))
const bp2 = buildPlan('custom', { choice: 5 })
ok(bp2.length === 1 && bp2[0].count === 5 && bp2[0].score === 20, '自定义「只出 5 道选择」→ 5 × 20 分', bp2.map((p) => [p.count, p.score]))

console.log('\n2c. 手改分值（显式分值构造）')
const cp = buildCustomPlan([{ type: 'choice', count: 5, score: 12 }, { type: 'blank', count: 0, score: 0 }])
ok(cp.length === 1 && cp[0].score === 12 && cp[0].extras.length === 5, '5 道选择改成每题 12 分', cp.map((p) => [p.type, p.count, p.score]))
ok(sum(cp.map((p) => sum(p.extras))) === 60, '手改后合计 60（校验会提示不等于 100）')
ok(buildCustomPlan([{ type: 'choice', count: 0, score: 10 }]).length === 0, '数量为 0 的题型被略过')
ok(buildCustomPlan([{ type: 'solution', count: 2, score: 50 }]).length === 1, '只填解答题也行', buildCustomPlan([{ type: 'solution', count: 2, score: 50 }]))
const cs = customSummary([{ type: 'choice', count: 5, score: 11 }, { type: 'blank', count: 3, score: 15 }])
ok(cs.total === 8 && cs.score === 100, 'customSummary 返回合计题数与总分', cs)
ok(customSummary([{ type: 'choice', count: 5, score: 12 }]).score === 60, '手改后合计实时可算', customSummary([{ type: 'choice', count: 5, score: 12 }]))

console.log('\n3. 边界与校验')
ok(distributeScores([]).length === 0, '空配比 → 空')
ok(buildPlan('custom', {}) .length === 0, '自定义但没填题量 → 空')
ok(validatePlan([]).ok === false, '空 plan 校验失败')
ok(validatePlan([{ type: 'choice', count: MAX_PAPER_QUESTIONS + 1, score: 1, extras: [] }]).ok === false, '超过题量上限被拒')
const atLimit = Array.from({ length: MAX_PAPER_QUESTIONS }, () => 4) // 25 × 4 = 100
ok(validatePlan([{ type: 'choice', count: MAX_PAPER_QUESTIONS, score: 4, extras: atLimit }]).ok === true, '正好上限（25 题 × 4 分 = 100）可通过')
const badScore = Array.from({ length: 10 }, () => 5) // 只有 50 分
ok(validatePlan([{ type: 'blank', count: 10, score: 5, extras: badScore }]).ok === false, '分值合计不是 100 时校验失败')

console.log('\n4. 选择题本地判分（不花额度）')
const questions = [
  { id: 1, type: 'choice', question: 'q1', options: ['A. 1', 'B. 2'], answer: 'B', score: 5 },
  { id: 2, type: 'choice', question: 'q2', options: ['A. 1', 'B. 2'], answer: 'A', score: 5 },
  { id: 3, type: 'blank', question: 'q3', answer: '42', score: 10 },
]
const { graded, pending } = splitForGrading(questions, { 1: 'B', 2: 'C', 3: '四十二' })
ok(graded.length === 2 && pending.length === 1, '选择题本地判、主观题待 AI 判', { graded: graded.length, pending: pending.length })
ok(graded[0].got === 5 && graded[0].correct === true, '答对得满分')
ok(graded[1].got === 0 && graded[1].correct === false, '答错得 0 分')
ok(pending[0].reference === '42' && pending[0].user_answer === '四十二', '主观题带上参考答案与作答')
const lower = splitForGrading([{ id: 9, type: 'choice', answer: 'b', score: 5 }], { 9: 'B' })
ok(lower.graded[0].correct === true, '大小写不敏感', lower.graded[0])
const empty = splitForGrading([{ id: 9, type: 'choice', answer: 'B', score: 5 }], {})
ok(empty.graded[0].got === 0, '未作答得 0 分')

console.log('\n5. 成绩合并（本地 + AI）')
const g = combineGrade(
  questions,
  { 1: 'B', 2: 'C', 3: '四十二' },
  graded,
  [{ id: 3, got: 7, comment: '思路对，计算有小错' }],
)
ok(g.total === 12, '总分 = 5 + 0 + 7', g.total)
ok(g.fullScore === 20, '满分合计 20', g.fullScore)
ok(g.rate === 60, '得分率 60%', g.rate)
ok(g.correctCount === 1 && g.wrongCount === 2, '对 1 错 2', { right: g.correctCount, wrong: g.wrongCount })
ok(g.byType.choice.got === 5 && g.byType.blank.got === 7, '分题型统计正确', g.byType)
ok(g.perQuestion[2].partial === true, '主观题部分得分标记 partial')
ok(g.perQuestion[2].comment === '思路对，计算有小错', '评语带进结果')
const missing = combineGrade(questions, {}, graded, [])
ok(missing.total === 5, 'AI 缺项时主观题按 0 分', missing.total)
const overflow = combineGrade(questions, {}, [{ id: 1, got: 99, full: 5, correct: true }], [])
ok(overflow.perQuestion[0].got === 5, '得分被夹在满分内', overflow.perQuestion[0].got)

console.log('\n6. 用时与限时')
ok(formatDuration(45) === '45 秒', '45 秒', formatDuration(45))
ok(formatDuration(750) === '12 分 30 秒', '750 秒', formatDuration(750))
ok(formatDuration(3900) === '1 时 05 分', '3900 秒', formatDuration(3900))
const t0 = 1700000000000
ok(remainingSeconds(t0, 90, t0 + 60 * 1000) === 89 * 60, '限时 90 分钟，过了 1 分钟 → 剩 89 分')
ok(remainingSeconds(t0, 90, t0 + 100 * 60 * 1000) === 0, '超时 → 0（不出现负数）')
ok(remainingSeconds(t0, 0) === null, '未限时 → null')

console.log('\n7. 历史成绩统计')
const papers = [
  { id: 'a', createdAt: 300, graded: { total: 80 } },
  { id: 'b', createdAt: 100, graded: { total: 60 } },
  { id: 'c', createdAt: 200, graded: { total: 100 } },
  { id: 'd', createdAt: 400 }, // 未判分的不计入
]
const h = historyStats(papers)
ok(h.count === 3, '只统计已判分的卷子', h.count)
ok(h.avg === 80, '平均分 80', h.avg)
ok(h.best === 100, '最高分 100', h.best)
ok(h.latest.id === 'a', '最近一次按 createdAt 取最新', h.latest.id)
ok(h.list[0].id === 'a' && h.list[2].id === 'b', '列表按时间倒序', h.list.map((x) => x.id))
ok(historyStats([]).count === 0, '空历史安全')
ok(historyStats(null).count === 0, 'null 安全')

console.log('\n8. 错题转错题本候选')
const paper = { id: 'p1', subject: '高等数学', questions }
const cands = wrongToBookCandidates(paper, g)
ok(cands.length === 2, '两道错题进入候选', cands.map((c) => c.id))
ok(cands[0].question === 'q2' && cands[0].score === '0/5', '候选带上题干与得分', cands[0])
ok(cands.every((c) => c.id.startsWith('p1-')), '候选 id 与试卷绑定（避免跨卷撞号）')
ok(wrongToBookCandidates(null, g).length === 0, 'null 试卷安全')

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
