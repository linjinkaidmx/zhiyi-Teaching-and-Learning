/**
 * 算法多语言代码完整性测试：15 算法 × 4 语言
 * 用法：node _test_algo_langs.mjs
 * 校验：每算法每语言 codes 非空、lineMap 存在、且 lineMap 覆盖该算法全部 codeLine 且行号不越界。
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const ALGO_CODES_TMP = path.join(here, '_algoCodes_tmp.mjs')
const ALGOS_TMP = path.join(here, '_algorithms_tmp.mjs')

writeFileSync(ALGO_CODES_TMP, readFileSync(path.join(here, 'src', 'algoCodes.js'), 'utf8'))
let algSrc = readFileSync(path.join(here, 'src', 'algorithms.js'), 'utf8')
algSrc = algSrc.replace("from './algoCodes'", "from './_algoCodes_tmp.mjs'")
writeFileSync(ALGOS_TMP, algSrc)

const { ALGORITHMS, ALGORITHM_IDS } = await import('./_algorithms_tmp.mjs')
const { CODE_LANGS } = await import('./_algoCodes_tmp.mjs')

let pass = 0
let fail = 0
const ok = (c, label, extra) => {
  if (c) pass++
  else fail++
  if (!c) console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : ''))
}
const LANGS = CODE_LANGS.map((l) => l.key)

console.log('算法总数：' + ALGORITHM_IDS.length + '，语言：' + LANGS.join('/') + '\n')

for (const id of ALGORITHM_IDS) {
  const alg = ALGORITHMS[id]
  const codes = alg.codes || {}
  const map = alg.lineMap || {}

  // 1. 每个语言都有非空代码 + lineMap
  for (const lang of LANGS) {
    ok(Array.isArray(codes[lang]) && codes[lang].length > 0, `${id}/${lang} 代码非空`)
    ok(map[lang] != null, `${id}/${lang} lineMap 存在`)
  }

  // 2. 跑生成器收集实际用到的 codeLine 集合
  let steps
  const sample = [5, 3, 8, 1, 9, 2, 7]
  if (alg.fixed) steps = alg.generate()
  else if (alg.needsTarget) steps = alg.generate(sample, 5)
  else steps = alg.generate(sample)
  const codeLines = [...new Set(steps.map((s) => s.codeLine))]

  // 3. 每个 codeLine 在每种语言都能映射到合法行号
  for (const lang of LANGS) {
    const lines = codes[lang]
    const m = map[lang] || {}
    for (const cl of codeLines) {
      const v = m[cl]
      ok(v != null, `${id}/${lang} codeLine ${cl} 有映射`)
      if (v == null) continue
      const arr = Array.isArray(v) ? v : [v]
      for (const ln of arr) {
        ok(ln >= 1 && ln <= lines.length, `${id}/${lang} codeLine ${cl} → 行 ${ln} 在 [1,${lines.length}] 内`)
      }
    }
  }
}

// 清理临时文件
try { unlinkSync(ALGO_CODES_TMP) } catch { /* noop */ }
try { unlinkSync(ALGOS_TMP) } catch { /* noop */ }

console.log('\n==============================================')
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)
process.exit(fail === 0 ? 0 : 1)
