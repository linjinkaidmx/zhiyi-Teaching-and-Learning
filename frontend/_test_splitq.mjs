// splitQuestions 去页头 + 拆题回归测试
// 用法：node _test_splitq.mjs
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(here, '_book_tmp.mjs')
writeFileSync(TMP, readFileSync(path.join(here, 'src', 'book.js'), 'utf8'))
const B = await import('./_book_tmp.mjs')

let pass = 0, fail = 0
const ok = (c, l, e) => { if (c) { pass++; console.log('  ✓ ' + l) } else { fail++; console.log('  ✗ ' + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) } }

// 1. 整页试卷：页头 + 注意事项编号条目 + 大题引导语 → 只留 3 道真题
const exam = [
  '绝密★启用前',
  '试卷类型：A',
  '普通高等学校期末教学质量监测考试',
  '高等数学（下）',
  '注意事项：',
  '1. 答卷前，考生务必将自己的姓名填写在指定位置。',
  '2. 回答选择题时，用铅笔涂黑答案标号。',
  '3. 考试结束后，将本试卷和答题卡一并交回。',
  '一、选择题：本题共3小题，每小题3分。',
  '1. 已知向量 a=(2,-1,3)，b=(1,2,-2)，则 a×b=',
  'A. (-4,7,5)  B. (-4,-7,5)  C. (4,-7,5)  D. (4,7,5)',
  '2. 极限 lim(x,y)->(0,0) 3xy/(x^2+y^2)',
  'A. 0  B. 3/2  C. 3  D. 不存在',
  '3. 设 z=x^2y+sin(xy)，则 ∂z/∂x=',
  'A. 2xy  B. ...',
].join('\n')
const parts = B.splitQuestions(exam)
ok(parts.length === 3, '整页试卷拆成 3 道题', { got: parts.length })
ok(!parts.some((p) => /绝密|试卷类型|注意事项|答卷前|考试结束后|一、选择题|本题共/.test(p)), '页头/注意事项/大题引导语全部剔除')
ok(parts[0].includes('已知向量'), '第 1 题题干完整保留')

// 2. 单题（无页头）→ 原样 1 题
const single = '1. 已知向量 a=(2,-1,3)，b=(1,2,-2)，则 a×b='
ok(B.splitQuestions(single).length === 1, '单题不拆')
ok(B.splitQuestions(single)[0] === single, '单题内容原样')

// 3. 主题干 + 小题（无强页头标志）→ 保留主题干，整体不拆
const stem = '已知函数 f(x)=x^3-3x，求下列各题：\n(1) 单调区间\n(2) 极值点'
const stemParts = B.splitQuestions(stem)
ok(stemParts.length === 1, '主题干+小题 整体返回', { got: stemParts.length })
ok(stemParts[0].includes('已知函数'), '主题干未被误删')

// 4. 无题号纯文本 → 原样单题
const plain = '求极限 lim(x->0) sinx/x'
ok(B.splitQuestions(plain).length === 1 && B.splitQuestions(plain)[0] === plain, '无题号纯文本原样')

// 5. 只有注意事项条目、无真题 → 不误删（无题号则原样返回）
const onlyNote = '1. 答卷前，考生务必将自己的姓名填写在指定位置。'
ok(B.splitQuestions(onlyNote).length === 1, '仅注意事项条目（无真题）原样返回')

// 6. 空输入
ok(B.splitQuestions('').length === 0, '空输入返回空')
ok(B.splitQuestions('  \n  ').length === 0, '纯空白返回空')

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
try { unlinkSync(TMP) } catch {}
process.exit(fail === 0 ? 0 : 1)
