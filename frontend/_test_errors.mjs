/**
 * 离线回归：错误分类与文案（不依赖网络/DOM）
 * 用法：node _test_errors.mjs
 */
import { classifyError, errorText } from './src/lib/errors.js'

let pass = 0, fail = 0
const ok = (c, l, e) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + l + (e !== undefined ? '  → ' + JSON.stringify(e) : '')) }
const kind = (m) => classifyError(new Error(m)).kind

console.log('\n===== 分类判定 =====')
ok(kind('Failed to fetch') === 'network', 'Failed to fetch → network')
ok(kind('NetworkError when attempting to fetch resource.') === 'network', 'NetworkError → network')
ok(kind('net::ERR_CONNECTION_REFUSED') === 'network', 'ERR_CONNECTION_REFUSED → network')
ok(kind('网络连接失败：请检查网络后重试') === 'network', '中文网络文案仍判 network')
ok(kind('The operation was aborted.') === 'timeout', 'aborted → timeout')
ok(kind('请求超时：服务响应较慢，请重试') === 'timeout', '中文超时文案 → timeout')
ok(kind('请先登录') === 'auth', '请先登录 → auth')
ok(kind('只有班级老师能导出成绩') === 'rule', '权限拒绝 → rule')
ok(kind('作业已过截止时间，无法提交') === 'rule', '业务规则 → rule')
ok(kind('报告生成失败，请重试') === 'server', '业务失败 → server')

console.log('\n===== 文案与兜底 =====')
const net = classifyError(new Error('Failed to fetch'))
ok(/网络连接失败/.test(net.title) && net.hint.length > 0, 'network 有中文标题与建议', net)
ok(net.canRetry === true, 'network 允许重试')

const auth = classifyError(new Error('请先登录'))
ok(auth.canRetry === false, 'auth 不提示重试（应引导重新登录）')

const rule = classifyError(new Error('只有班级老师能导出成绩'))
ok(rule.title === '只有班级老师能导出成绩' && rule.hint === '', 'rule 直接透传后端说明', rule)

const empty = classifyError(new Error(''))
ok(empty.kind === 'server' && empty.title === '操作失败', '空错误串兜底为「操作失败」', empty)

// errorText：页面内联错误态（带 fallback）
ok(/加载失败/.test(errorText(new Error(''), '题库加载失败')), 'errorText 在兜底时用 fallback')
ok(/网络连接失败/.test(errorText(new Error('Failed to fetch'))), 'errorText 分类文案优先于 fallback')
ok(/（.*）/.test(errorText(new Error('Failed to fetch'))), 'errorText 把建议放进括号')

console.log(`\n结果：通过 ${pass}，失败 ${fail}`)
process.exit(fail > 0 ? 1 : 0)
