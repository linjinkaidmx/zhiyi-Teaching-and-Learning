/**
 * AI 教学老师 · 前端纯逻辑 离线断言（2026-10-09）
 * 与后端 teach.py 同规则，这里锁住前端一侧的行为。
 * 用法：node frontend/_qa_teach_flow.mjs
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mod = await import(pathToFileURL(path.join(__dirname, 'src/lib/teachFlow.js')).href)
const {
  isConfirm, normText, can, nextState, optionState, gradeMeta,
  progressLabel, kpContextOf, answerPayload, teacherOf, DEFAULT_TEACHER,
  teacherArt, artFace, TEACHER_FACES, kpStatusOf,
} = mod

let pass = 0
let fail = 0

function ok(cond, label, extra) {
  if (cond) {
    pass += 1
    console.log('  OK  ' + label)
  } else {
    fail += 1
    console.log('  FAIL ' + label + (extra === undefined ? '' : '  -> ' + JSON.stringify(extra)))
  }
}

console.log('\n== 1. 确认语识别（推进的唯一语义入口） ==')
const yes = ['会了，下一个知识点', '会了', '下一个', '下一题', '懂了', '学会了', '明白了', 'next', '可以了', '往下讲']
const no = ['我还没懂', '等一下，先别讲', '不会，再讲一遍', '没跟上', '这道题为什么用洛必达', '', '   ',
  '我不太明白为什么这里要判断类型，能再讲讲吗', '会了？我还不确定']
yes.forEach((t) => ok(isConfirm(t), `「${t}」→ 推进`))
no.forEach((t) => ok(!isConfirm(t), `「${t}」→ 不推进`))
ok(normText('会了，下一个知识点！') === '会了下一个知识点', '归一化去标点', normText('会了，下一个知识点！'))

console.log('\n== 2. 状态机 ==')
ok(nextState('lecture', 'start') === 'exam', 'lecture --start--> exam')
ok(nextState('exam', 'answer') === 'graded', 'exam --answer--> graded')
ok(nextState('graded', 'ask') === 'exam', 'graded --ask--> exam（解答后回到考试题）')
ok(nextState('graded', 'next') === 'lecture', 'graded --next--> lecture')
ok(nextState('exam', 'next') === 'lecture', 'exam --next--> lecture（用户明确确认也可推进）')
ok(!can('lecture', 'next'), 'lecture 不能 next（讲义阶段没有可确认的内容）')
ok(nextState('graded', 'finish') === 'done', 'graded --finish--> done')
ok(!can('lecture', 'answer'), 'lecture 不能直接 answer')
ok(!can('done', 'start'), '结课后不能再 start')

console.log('\n== 3. 选项着色 ==')
const opts = [{ key: 'A' }, { key: 'B' }, { key: 'C' }]
ok(optionState('A', 'A', 'B', false) === 'chosen', '未揭晓只标已选')
ok(optionState('B', 'A', 'B', false) === '', '未揭晓不标答案')
ok(optionState('B', 'A', 'B', true) === 'right', '揭晓后标正确项')
ok(optionState('A', 'A', 'B', true) === 'wrong', '揭晓后标选错项')
ok(optionState('C', 'A', 'B', true) === '', '揭晓后无关项不着色')

console.log('\n== 4. 批改与进度文案 ==')
ok(gradeMeta('correct').tone === 'ok', 'correct → ok')
ok(gradeMeta('partial').tone === 'warn', 'partial → warn')
ok(gradeMeta('wrong').tone === 'bad', 'wrong → bad')
ok(progressLabel(0, 12) === '第 1 / 12 讲', '进度 0/12', progressLabel(0, 12))
ok(progressLabel(11, 12) === '第 12 / 12 讲', '进度 11/12', progressLabel(11, 12))
ok(progressLabel(12, 12) === '第 12 / 12 讲', '越界钳位', progressLabel(12, 12))
ok(progressLabel(0, 0) === '还没有知识点', '空大纲文案')

console.log('\n== 5. 作答载荷（前端先挡空提交） ==')
ok(answerPayload({ type: 'choice' }, { choice: 'a' })?.choice === 'A', '选项小写→大写')
ok(answerPayload({ type: 'choice' }, {}) === null, '选择题未选 → 拦截')
ok(answerPayload({ type: 'text' }, { text: '  ' }) === null, '文字题空 → 拦截')
ok(answerPayload({ type: 'text' }, { text: '我的思路' })?.text === '我的思路', '文字题载荷')
ok(answerPayload({ type: 'choice' }, { choice: 'B', text: 'x' })?.text === '', '选择题不带文字')

console.log('\n== 6. 老师与讲义上下文 ==')
ok(teacherOf('chenli').name === '陈砺', '陈砺')
ok(teacherOf('shentong').name === '沈疏桐', '沈疏桐')
ok(teacherOf('不存在').id === DEFAULT_TEACHER, '未知老师回退默认')
const ctx = kpContextOf({ kp: { definition: '定义', principle: '原理', pitfalls: ['易错一', '易错二'] } })
ok(ctx.includes('定义') && ctx.includes('易错：易错一、易错二'), '讲义要点拼串', ctx)

console.log('\n== 7. 立绘资源路径（四档表情） ==')
ok(TEACHER_FACES.length === 4 && TEACHER_FACES.includes('talk'), '四档表情定义', TEACHER_FACES)
ok(teacherArt('chenli') === '/teachers/chenli_default.webp?v=1', '默认档路径', teacherArt('chenli'))
ok(teacherArt('shentong', 'happy') === '/teachers/shentong_happy.webp?v=1', '指定表情档路径',
  teacherArt('shentong', 'happy'))
ok(teacherArt('chenli', 'not-exist') === '/teachers/chenli_default.webp?v=1', '非法档位回退默认')
ok(teacherArt('不存在', 'talk') === '/teachers/chenli_talk.webp?v=1', '未知老师回退首位')
ok(artFace('idle') === 'default', 'idle → 默认表情')
ok(artFace('talk') === 'talk' && artFace('happy') === 'happy', '状态档位直通')
ok(artFace('') === 'default', '空状态回退默认')

console.log('\n== 8. 章节目录状态（2026-10-09 目录） ==')
ok(kpStatusOf({ cursor: 2 }, 2) === 'cur', '当前讲 → cur')
ok(kpStatusOf({ cursor: 3, kp_done: [1] }, 1) === 'done', '已确认掌握 → done')
ok(kpStatusOf({ cursor: 3, kp_started: [1] }, 1) === 'started', '学过未确认 → started')
ok(kpStatusOf({ cursor: 3 }, 1) === 'todo', '未学 → todo')
ok(kpStatusOf({ cursor: 1, kp_done: [1] }, 1) === 'cur', '跳回已打勾的章重学 → 显示当前（cur 优先于 done）')
ok(kpStatusOf({ cursor: 9, kp_done: [0], status: 'done' }, 0) === 'done', '结课后 done 优先于 cur（游标越界）')

console.log(`\n------ ${pass} passed, ${fail} failed ------`)
process.exit(fail ? 1 : 0)
