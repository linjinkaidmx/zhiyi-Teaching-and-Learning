<template>
  <UiModal :model-value="open" title="成长报告" size="lg" @update:model-value="$emit('update:open', $event)">
    <div class="gr__range">
      <UiSegmented v-model="range" :options="RANGES" />
      <span class="t-label gr__range-hint">{{ rangeLabel }}</span>
    </div>

    <p v-if="!hasData" class="t-body-2 gr__empty">
      这段时间还没有学习记录。先用拍照搜题问一道题、或把错题练一练，报告就会有内容了。
    </p>

    <template v-else>
      <!-- 关键数字 -->
      <section class="gr__metrics">
        <div v-for="m in metrics" :key="m.label" class="gr__metric">
          <b class="gr__metric-val">{{ m.value }}</b>
          <span class="t-label">{{ m.label }}</span>
        </div>
      </section>

      <!-- 掌握趋势 -->
      <section class="gr__block">
        <h3 class="t-h3">错题与掌握趋势 <span class="t-label">{{ trendLabel }}</span></h3>
        <div class="gr__bars">
          <span v-for="(d, i) in trend" :key="i" class="gr__bar-wrap" :title="`${d.label}：新增 ${d.count}`">
            <i class="gr__bar" :style="{ height: barH(d.count) }" />
          </span>
        </div>
        <div class="gr__bars-x t-label">
          <span>{{ trend.length ? trend[0].label.slice(5) : '' }}</span>
          <span>{{ trend.length ? trend[trend.length - 1].label.slice(5) : '' }}</span>
        </div>
      </section>

      <!-- 知识点掌握 -->
      <section v-if="mastery.length" class="gr__block">
        <h3 class="t-h3">知识点掌握度 <span class="t-label">前 6 个</span></h3>
        <div v-for="m in mastery.slice(0, 6)" :key="m.name" class="gr__row">
          <span class="gr__row-name">{{ m.name }}</span>
          <span class="gr__row-bar"><i :style="{ width: rate(m) + '%' }" /></span>
          <span class="t-label">{{ m.mastered }}/{{ m.total }}</span>
        </div>
      </section>

      <!-- 结论 -->
      <section class="gr__block">
        <h3 class="t-h3">这段时间的一句话总结</h3>
        <ul class="gr__points">
          <li v-for="(t, i) in conclusions" :key="i" class="t-body-2">{{ t }}</li>
        </ul>
      </section>

      <div class="gr__ops">
        <UiButton variant="primary" @click="print">打印 / 存为 PDF</UiButton>
        <UiButton variant="ghost" @click="copySummary">复制数据摘要</UiButton>
        <UiButton variant="ghost" @click="close">关闭</UiButton>
      </div>
    </template>
  </UiModal>
</template>

<script setup>
/**
 * 学期成长报告
 * ---------------------------------------------------------------------------
 * 数据全部来自本地学习数据（错题本 / 统计 / 学习时长 / 成就 / 考试），不调后端。
 * 三档范围：本月 / 近 6 个月 / 全部；可打印成 PDF，也可复制一段纯文本摘要。
 */
import { computed, ref } from 'vue'
import UiModal from '../ui/UiModal.vue'
import UiButton from '../ui/UiButton.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import { printHtml } from '../lib/print.js'
import { latexToPlain } from '../mathtext'
import { bookRef } from '../stores/bookStore'
import { getOverview, getMasteryByPoint, getDailyTrend, analyzeWeakPoints } from '../book.js'
import { statsRef, summary as statsSummary, achievementList } from '../statsStore'
import { humanMinutes, studyTimeByDay } from '../stores/recordsStore'
import { toast } from '../ui/toast.js'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['update:open'])

const RANGES = [
  { label: '本月', value: 'month' },
  { label: '近 6 个月', value: 'term' },
  { label: '全部', value: 'all' },
]
const range = ref('month')

const days = computed(() => ({ month: 30, term: 180, all: 3650 }[range.value] || 30))
const rangeLabel = computed(() => ({ month: '近 30 天', term: '近 180 天', all: '全部记录' }[range.value]))
const trendLabel = computed(() => `近 ${Math.min(days.value, 30)} 天`)

/** 报告用到的错题（按范围过滤 createdAt；没有时间的保留） */
const scopedItems = computed(() => {
  const from = Date.now() - days.value * 86400000
  return (bookRef().value || []).filter((it) => {
    if (!it || it.kind === 'note') return false
    const t = Date.parse(it.createdAt || '') || 0
    return !t || t >= from
  })
})

// 一律用防御式取值：分析函数在某些数据形态下可能返回非数组，避免整页渲染报错
const overview = computed(() => getOverview(scopedItems.value) || { total: 0, mastered: 0, accuracy: 0, weekNew: 0 })
const mastery = computed(() => getMasteryByPoint(scopedItems.value) || [])
const weak = computed(() => analyzeWeakPoints(scopedItems.value) || [])
const trend = computed(() => getDailyTrend(scopedItems.value, Math.min(days.value, 30)) || [])
const achList = computed(() => (statsRef().value, achievementList() || []))
const summary = computed(() => (statsRef().value, statsSummary() || { current: 0, longest: 0 }))
// studyMinutes() 返回 { today, week, dailyAvg } 对象；报告要的是「范围内总时长」，
// 所以按天累加（与 DataPage 的用法保持一致）
const minutesInRange = computed(() =>
  (statsRef().value,
  (studyTimeByDay(Math.min(days.value, 30)) || []).reduce((sum, d) => sum + (Number(d && d.minutes) || 0), 0))
)

const hasData = computed(
  () => scopedItems.value.length > 0 || (studyTimeByDay(Math.min(days.value, 30)) || []).some((d) => (d && d.minutes) > 0)
)

const metrics = computed(() => [
  { label: '学习时长', value: humanMinutes(minutesInRange.value) },
  { label: '错题总数', value: overview.value.total },
  { label: '已掌握', value: overview.value.mastered },
  { label: '自测正确率', value: `${overview.value.accuracy}%` },
  { label: '连续打卡', value: `${summary.value.current} 天` },
  { label: '成就', value: `${achList.value.filter((a) => a.done).length}/${achList.value.length}` },
])

const maxTrend = computed(() => Math.max(1, ...trend.value.map((d) => Number(d && d.count) || 0)))
function barH(c) {
  return c ? `${Math.max(8, Math.round((c / maxTrend.value) * 60))}px` : '3px'
}
const rate = (m) => (m.total ? Math.round((m.mastered / m.total) * 100) : 0)

/** 自动结论：基于数据的几句话，不编造 */
const conclusions = computed(() => {
  const out = []
  const o = overview.value
  if (o.total) {
    out.push(`这段时间共整理了 ${o.total} 道错题，其中 ${o.mastered} 道已掌握（掌握率 ${rate2(o)}%），自测正确率 ${o.accuracy}%。`)
  }
  if (o.weekNew) out.push(`最近 7 天新增 ${o.weekNew} 道错题。`)
  const w = weak.value.filter((x) => x.errorRate > 0.4).slice(0, 3)
  if (w.length) {
    out.push(`最需要补的是：${w.map((x) => `${x.name}（错误率 ${Math.round(x.errorRate * 100)}%）`).join('、')}。建议从学习数据页每个薄弱点后面的「练一组」开始。`)
  } else if (weak.value.length) {
    out.push('薄弱知识点的错误率都在 40% 以下，保持节奏即可。')
  }
  if (summary.value.longest >= 3) out.push(`最长连续打卡 ${summary.value.longest} 天，连续性不错。`)
  if (!out.length) out.push('样本还不多，先攒几道错题再看趋势。')
  return out
})
const rate2 = (o) => (o.total ? Math.round((o.mastered / o.total) * 100) : 0)

function plainText() {
  const lines = [
    `知一学习 · 成长报告（${rangeLabel.value}）`,
    ...metrics.value.map((m) => `${m.label}：${m.value}`),
    '',
    ...conclusions.value.map((t) => '· ' + latexToPlain(t)),
  ]
  return lines.join('\n')
}

function copySummary() {
  const t = plainText()
  navigator.clipboard?.writeText(t).then(
    () => toast.success('数据摘要已复制，可直接粘贴到周报里'),
    () => toast.error('复制失败，可手动选择文本')
  )
}

function print() {
  const sec = (label, html) => ({ label, html })
  const table = (rows) =>
    `<table style="border-collapse:collapse;width:100%;font-size:12px">${rows
      .map(
        (r, i) =>
          `<tr>${r
            .map((c) => `<td style="border:1px solid #bbb;padding:5px 8px;${i === 0 ? 'background:#f4f4f6;font-weight:600' : ''}">${c}</td>`)
            .join('')}</tr>`
      )
      .join('')}</table>`

  const sections = [
    sec('一、关键数据', table([['指标', '数值'], ...metrics.value.map((m) => [m.label, String(m.value)])])),
    sec(
      '二、知识点掌握度',
      mastery.value.length
        ? table([['知识点', '已掌握', '总数', '掌握率'], ...mastery.value.slice(0, 10).map((m) => [m.name, m.mastered, m.total, rate(m) + '%'])])
        : '<p style="font-size:12.5px">暂无知识点数据</p>'
    ),
    sec(
      '三、薄弱知识点',
      weak.value.length
        ? table([['知识点', '错误率', '题目数'], ...weak.value.slice(0, 8).map((w) => [w.name, Math.round(w.errorRate * 100) + '%', w.total])])
        : '<p style="font-size:12.5px">暂无</p>'
    ),
    sec('四、总结', `<ol style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.9">${conclusions.value.map((t) => `<li>${latexToPlain(t)}</li>`).join('')}</ol>`),
    sec('五、近 30 天错题趋势', table([['日期', '新增错题'], ...trend.value.filter((d, i) => d.count || i % 5 === 0).map((d) => [d.label, d.count])])),
  ]
  printHtml(`成长报告 · ${rangeLabel.value}`, sections)
}

function close() {
  emit('update:open', false)
}
</script>

<style scoped>
.gr__range {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
  flex-wrap: wrap;
}
.gr__range-hint {
  color: var(--text-muted);
}
.gr__empty {
  color: var(--text-muted);
  line-height: 1.9;
}
.gr__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: var(--sp-3);
  margin-bottom: var(--sp-5);
}
.gr__metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  text-align: center;
}
.gr__metric-val {
  font-size: var(--fs-h3);
  font-weight: var(--fw-semibold);
}
.gr__block {
  margin-bottom: var(--sp-5);
}
.gr__bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 64px;
  margin-top: var(--sp-3);
}
.gr__bar-wrap {
  flex: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;
}
.gr__bar {
  display: block;
  width: 100%;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, var(--primary), color-mix(in srgb, var(--primary) 55%, transparent));
}
.gr__bars-x {
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  margin-top: 4px;
}
.gr__row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 7px 0;
}
.gr__row-name {
  min-width: 6em;
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.gr__row-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--surface-recess);
  overflow: hidden;
}
.gr__row-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--success);
}
.gr__points {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  color: var(--text-secondary);
  line-height: 1.9;
}
.gr__ops {
  display: flex;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
</style>
