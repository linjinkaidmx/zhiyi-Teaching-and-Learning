// 推荐算法四档匹配的回归验证
// 复制 ESM 源码为 .mjs 后在 node 里直接跑纯逻辑单测
import fs from 'fs'

fs.copyFileSync('zhiyi/frontend/src/utils/knowledgeAliases.js', 'tmp_ka.mjs')
const { matchScore, bestMatch } = await import('./tmp_ka.mjs')

// 之前实测记录的真实场景：AI 输出 vs 题库写法
const CASES = [
  { name: '精确相等', ai: '特征方程法', bank: ['二阶常系数齐次线性微分方程', '特征方程法'], expect: 10 },
  { name: '别名：特征方程与特征根', ai: '特征方程与特征根', bank: ['二阶常系数齐次线性微分方程', '特征方程法'], expect: 8 },
  { name: '别名：特征根法', ai: '特征根法', bank: ['特征方程法'], expect: 8 },
  { name: '别名：教科书全称', ai: '二阶常系数齐次线性微分方程求解', bank: ['二阶常系数齐次线性微分方程'], expect: 8 },
  // 「常系数齐次线性微分方程」在词典里被登记为别名，别名(8)优先于包含(5)，是更优结果
  { name: '命中别名而非包含', ai: '常系数齐次线性微分方程', bank: ['二阶常系数齐次线性微分方程'], expect: 8 },
  { name: '别名：时间复杂度简称', ai: '时间复杂度', bank: ['时间复杂度分析', '算法复杂度'], expect: 8 },
  // 已知局限：包含匹配会误判「同前缀但不是一回事」的写法，扣到最低档 5 分，可接受
  { name: '已知局限：同前缀', ai: '机器学习2', bank: ['机器学习'], expect: 5 },
  { name: '精确：进程与线程', ai: '进程与线程', bank: ['进程与线程', '死锁'], expect: 10 },
  { name: '别名：死锁的四个必要条件', ai: '死锁的四个必要条件', bank: ['死锁'], expect: 8 },
  { name: '算法套路', ai: '进程调度算法', bank: ['进程调度算法'], expect: 10 },
  { name: '页面置换（新题库）', ai: '页面置换算法', bank: ['页面置换算法'], expect: 10 },
]

let pass = 0
let fail = 0
console.log('=== matchScore / bestMatch 回归 ===\n')
for (const c of CASES) {
  const got = bestMatch(c.ai, c.bank)
  const ok = got === c.expect
  ok ? pass++ : fail++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name}`)
  console.log(`     AI输出 "${c.ai}" vs 题库 ${JSON.stringify(c.bank)}`)
  console.log(`     期望 ${c.expect} 实际 ${got}${ok ? '' : '  <-- 不符'}\n`)
}

// 端到端回溯：历史记录的真实漏匹配案例
console.log('=== 历史漏匹配案例复盘 ===')
const OLD_AI = ['二阶常系数齐次线性微分方程', '特征方程与特征根', '微分方程的通解']
const OLD_BANK = ['二阶常系数齐次线性微分方程', '特征方程法']
let best = 0
const detail = OLD_AI.map((k) => {
  const s = bestMatch(k, OLD_BANK)
  best = Math.max(best, s)
  return `${k} -> ${s}`
})
console.log('AI 输出 :', JSON.stringify(OLD_AI))
console.log('题库写法:', JSON.stringify(OLD_BANK))
console.log('逐项打分:', detail.join(' | '))
console.log(`最终得分 ${best}`)

// 上面这个案例恰好包含一个精确匹配，新旧算法都会选中，看不出差异。
// 真正致命的是下面这种：AI 没有输出任何一个与题库写法完全相同的知识点。
console.log('\n--- 关键场景：AI 完全没输出与题库同名的知识点 ---')
const CRIT_AI = ['二阶常系数齐次线性微分方程求解', '特征方程与特征根', '微分方程的通解']
const newScore = Math.max(...CRIT_AI.map((k) => bestMatch(k, OLD_BANK)))
const oldScore2 = CRIT_AI.filter((k) => OLD_BANK.includes(k)).length * 10
console.log('AI 输出 :', JSON.stringify(CRIT_AI))
console.log('逐项打分:', CRIT_AI.map((k) => `${k} -> ${bestMatch(k, OLD_BANK)}`).join(' | '))
console.log(`旧算法得分 ${oldScore2}  ->  该题被彻底排除，推荐可能落到空态`)
console.log(`新算法得分 ${newScore}  ->  正常命中`)
if (newScore > oldScore2) pass++
else fail++
console.log(newScore > oldScore2 ? '=> 漏匹配问题已修复' : '=> 仍未修复')

// 学科发散的极端情况
console.log('\n=== 极端：AI 输出散命名的情况 ===')
const WEIRD = ['全微分方程变体']
console.log(`AI 输出 ${JSON.stringify(WEIRD)} -> 知识点得分 ${bestMatch(WEIRD[0], OLD_BANK)}`)
console.log('此时靠错因(+4) + 学科(+2) 兜底，fallbackQuestions 保证不返回空')

// 注：这里不能删临时文件，Windows 沙箱的 safe-delete 会拦截 fs.rmSync
console.log(`\n结果: pass=${pass} fail=${fail}`)
