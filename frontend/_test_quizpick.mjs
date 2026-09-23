/**
 * 自测组卷逻辑回归测试（针对「勾选后答题页空白」的修复）
 * 用法：node _test_quizpick.mjs
 *
 * 覆盖：
 *  1. 正常勾选 → 组卷正确
 *  2. 幽灵勾选（题已掌握被移出池）→ 修复前会组出空卷并导致答题页渲染失败；现在能被清理/拦截
 *  3. 部分失效 / 全部失效 / 空输入 / id 类型一致性
 *  4. 静态检查：QuizPanel.vue 里 checked 的声明必须在立即执行的 watch 之前（防 TDZ 回归）
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(here, '_book_tmp.mjs')
writeFileSync(TMP, readFileSync(path.join(here, 'src', 'book.js'), 'utf8'))

const B = await import('./_book_tmp.mjs')

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + label) }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }
}
const eq = (got, want, label) => ok(got === want, label, { got, want })
const section = (t) => console.log('\n' + t)

const SRS = { srsEnabled: true, srsMode: 'ladder', srsIntervals: [1, 3, 7], srsFixedDays: 7 }
// 注意：开启 SRS 时「已掌握但已到复习期」的题会回到池中；刚掌握（reviewAt 在未来）才不在池里
const item = (id, mastered = false) => ({
  id,
  question: 'q' + id,
  mastered,
  reviewAt: mastered ? Date.now() + 7 * 86400000 : 0,
})

section('0. 复习池语义（防止测试前提搞错）')
{
  const due = { id: 9, mastered: true, reviewAt: Date.now() - 1000 }
  eq(B.quizPool([due], SRS).length, 1, '已掌握但已到复习期 → 回到池中（SRS 设计行为）')
  eq(B.quizPool([due], { ...SRS, srsEnabled: false }).length, 0, '关闭 SRS → 掌握即永久移出')
  eq(B.quizPool([item(9, true)], SRS).length, 0, '刚掌握（未到复习期）→ 不在池中')
}

section('1. 正常组卷')
{
  const list = [item(1), item(2), item(3)]
  const pool = B.quizPool(list, SRS)
  eq(pool.length, 3, '三道未掌握题都在池中')
  eq(B.pickQuizItems(pool, [1, 3]).map((i) => i.id).join(','), '1,3', '勾选 1、3 → 组卷 1、3')
  eq(B.pruneCheckedIds(pool, [1, 3]).length, 2, '有效勾选不被打扰')
}

section('2. 幽灵勾选（本题已掌握被移出复习队列）')
{
  // 场景：勾了 1、2 两道题 → 答对 2 次后 1 被标记掌握 → 退出自测 → 勾选仍是 [1,2]
  const list = [item(1, true), item(2), item(3)]   // 1 已掌握 → 不在池中
  const pool = B.quizPool(list, SRS)
  eq(pool.length, 2, '已掌握的题不在复习池中')

  // 修复前的行为：直接用原始勾选组卷
  const naive = pool.filter((it) => [1, 2].includes(it.id))
  eq(naive.length, 1, '直接组卷仍能拿到 2（部分失效场景不会白屏）')

  // 全部失效场景（两道勾选题都被掌握）→ 直接组卷会得到空卷
  const pool2 = B.quizPool([item(1, true), item(2, true), item(3)], SRS)
  const naiveEmpty = pool2.filter((it) => [1, 2].includes(it.id))
  eq(naiveEmpty.length, 0, '全部失效时直接组卷为空（这就是白屏的根源）')

  // 修复后：先清理再组卷 → 勾选被清空，start() 会拦截并提示
  const pruned = B.pruneCheckedIds(pool2, [1, 2])
  eq(pruned.length, 0, 'pruneCheckedIds 清掉幽灵勾选')
  eq(B.pickQuizItems(pool2, pruned).length, 0, '清理后组卷仍为空 → start() 会提示而不进答题页')
  ok(B.pickQuizItems(pool2, pruned).length === 0, '不会出现「空卷进入答题页」的路径')
}

section('3. 部分失效与边界')
{
  const pool = B.quizPool([item(1, true), item(2), item(3)], SRS)
  eq(B.pruneCheckedIds(pool, [1, 2]).join(','), '2', '只保留仍有效的勾选')
  eq(B.pickQuizItems(pool, B.pruneCheckedIds(pool, [1, 2])).map((i) => i.id).join(','), '2', '清理后组卷拿到 2')

  eq(B.pruneCheckedIds([], [1, 2]).length, 0, '池为空 → 勾选被清空')
  eq(B.pruneCheckedIds(null, undefined).length, 0, 'null 输入 → 返回空数组')
  eq(B.pickQuizItems(null, [1]).length, 0, 'pickQuizItems(null) → 空数组')
  eq(B.pickQuizItems(pool, []).length, 0, '未勾选 → 空卷')

  // id 类型一致性：字符串 '2' 不应命中数字 2（页面里两边同源，故不会出现，但要保证不误命中）
  eq(B.pickQuizItems(pool, ['2']).length, 0, '字符串 id 不会误命中数字 id')
  eq(B.pruneCheckedIds(pool, ['2']).length, 0, '字符串 id 会被判定为失效并清理')
}

section('4. 静态检查：QuizPanel.vue 的声明顺序（防 TDZ 回归）')
{
  const src = readFileSync(path.join(here, 'src', 'components', 'QuizPanel.vue'), 'utf8')
  const iChecked = src.indexOf('const checked = ref([])')
  const iWatch = src.indexOf('watch(() => props.focusId')
  ok(iChecked > 0 && iWatch > 0, '两处代码都在文件中')
  ok(iChecked < iWatch, 'checked 的声明在 immediate watch 之前（不会抛 Cannot access before initialization）')

  const iStart = src.indexOf('function start()')
  const startBody = src.slice(iStart, iStart + 700)
  ok(startBody.includes('pruneCheckedIds') || startBody.includes('syncChecked'), 'start() 会先同步勾选状态')
  ok(startBody.includes('if (!picked.length)'), 'start() 有空卷兜底（不会进入空白答题页）')
  ok(src.includes('hasCurrent'), '答题区有 hasCurrent 渲染兜底')
  ok(src.includes('progressPct'), '进度条用防 NaN 的 progressPct')
}

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)

try { unlinkSync(TMP) } catch { /* ignore */ }
process.exit(fail === 0 ? 0 : 1)
