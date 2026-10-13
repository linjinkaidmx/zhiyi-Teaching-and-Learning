<template>
  <UiModal :model-value="modelValue" title="复习设置" @update:model-value="close">
    <p class="rs-sub">决定答错的题隔多久再考你一次</p>

    <span class="rs-sec">选择复习节奏</span>
    <div class="rs-tiers">
      <button v-for="p in PACES" :key="p.key" type="button" class="rs-tier" :class="{ 'is-on': form.pace === p.key }"
              @click="form.pace = p.key">
        <b>{{ p.label }}<em v-if="form.pace === p.key">✓</em></b>
        <i class="rs-tier-days">{{ p.desc }}</i>
        <i class="rs-tier-note">{{ TIER_NOTE[p.key] }}</i>
      </button>
    </div>

    <!-- 效果预览：用错题本真实数据算 -->
    <div class="rs-preview">
      <div class="rs-preview-t">效果预览<span>{{ previewBasis }}</span></div>
      <div v-if="preview.total" class="rs-bars">
        <span v-for="(n, i) in preview.buckets" :key="i" class="rs-col">
          <i :style="{ height: barH(n) }" :class="{ 'is-zero': !n }" />
          <u>{{ i === 0 ? '今天' : `+${i}` }}</u>
        </span>
      </div>
      <p v-if="preview.total" class="rs-sum">
        今天可以练 <b>{{ preview.today }} 道</b> · 未来 7 天还会进来 <b>{{ preview.week }} 道</b>（共 {{ preview.total }} 道待巩固）
      </p>
      <p v-else class="rs-sum">错题本里还没有待巩固的题 —— 先去拍题或从 AI 课堂攒几道吧。</p>
      <p class="rs-note">{{ paceNote }}</p>
    </div>

    <!-- 规则说明（替代原先的开关与阶梯参数） -->
    <div class="rs-rules">
      <div class="rs-rules-h">掌握与回炉规则</div>
      <div class="rs-rules-b">
        <div class="rs-rule"><span class="k">答对 1 次</span><span>进入「连对 1/2」，按所选节奏排下一次练习</span></div>
        <div class="rs-rule"><span class="k">连对 2 次</span><span>标记「已掌握」，之后<b>不再自动回炉</b>（想练可在错题本里点「再练一遍」）</span></div>
        <div class="rs-rule"><span class="k">答错</span><span>连对清零、当天就能再练（已掌握的题答错会降级回来）</span></div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="close(false)">取消</UiButton>
      <UiButton variant="primary" @click="save">保存</UiButton>
    </template>
  </UiModal>
</template>

<script setup>
/**
 * 复习设置对话框（2026-10-11 改版）
 * ---------------------------------------------------------------------------
 * 旧版是一串 SRS 参数（开关 / 阶梯间隔 / 固定天数），用户看不懂也感受不到差别。
 * 新版只做两件用户关心的事：
 *   1. 三档节奏 = 「答对后隔多久回炉」（轻松 3 天 / 标准 1 天 / 冲刺 当天）
 *   2. 效果预览 = 用错题本真实数据算出「今天可以练几道、未来 7 天还会进来几道」
 * 已掌握的题不再自动回炉，所以旧的「开启间隔复习」开关与阶梯参数一并删除。
 */
import { computed, ref, watch } from 'vue'
import UiModal from '../ui/UiModal.vue'
import UiButton from '../ui/UiButton.vue'
import { ElMessage } from '../ui/notify.js'
import { PACES, DEFAULT_PACE, quizPool } from '../book.js'
import { bookRef, getSettings, updateSettings } from '../stores/bookStore'

const DAY = 86400000
const TIER_NOTE = {
  easy: '给记忆留更多时间，每天要练的题最少',
  standard: '第二天再考一次，确认没忘（默认）',
  rush: '当天连对 2 次即算掌握，适合考前突击',
}

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const book = bookRef()
const form = ref({ pace: DEFAULT_PACE })

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    form.value = { pace: getSettings().pace || DEFAULT_PACE }
  },
)

/** 未掌握的题（= 组卷池），用于效果预览 */
const pool = computed(() => quizPool(book.value || []))

/** 未来 7 天分桶：0 = 今天可以练，1..6 = 第 N 天进来 */
const preview = computed(() => {
  const now = Date.now()
  const buckets = [0, 0, 0, 0, 0, 0, 0]
  for (const it of pool.value) {
    const due = Number(it.reviewAt) || 0
    const days = due && due > now ? Math.ceil((due - now) / DAY) : 0
    buckets[Math.min(days, 6)] += 1
  }
  const today = buckets[0]
  const week = buckets.slice(1).reduce((a, b) => a + b, 0)
  return { buckets, today, week, total: pool.value.length }
})

const maxBar = computed(() => Math.max(1, ...preview.value.buckets))
function barH(n) {
  if (!n) return '3px'
  return `${Math.max(8, Math.round((n / maxBar.value) * 44))}px`
}

const previewBasis = computed(() => (preview.value.total
  ? `按你错题本里的 ${preview.value.total} 道未掌握题实时估算`
  : '暂无数据'))

/** 换档后的感受说明（基于真实数字，不说空话） */
const paceNote = computed(() => {
  const p = PACES.find((x) => x.key === form.value.pace) || PACES[1]
  if (!preview.value.total) return `${p.desc}。`
  if (p.days === 0) return '冲刺：今天可以反复练，连对 2 次就毕业，当天就能把题清掉。'
  if (p.days === 1) return `标准：今天答对的题会排到明天再考一次；今天已有 ${preview.value.today} 道可以练。`
  return `轻松：今天答对的题会排到 3 天后；今天已有 ${preview.value.today} 道可以练，练完可以歇几天。`
})

function close(v) {
  emit('update:modelValue', v)
}

function save() {
  updateSettings({ pace: form.value.pace })
  ElMessage.success('复习节奏已更新')
  close(false)
}
</script>

<style scoped>
.rs-sub {
  margin: 0 0 14px;
  font-size: var(--fs-body-2);
  color: var(--text-muted);
}
.rs-sec { font-size: var(--fs-label); font-weight: 600; color: var(--text-tertiary); }
.rs-tiers {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 8px 0 16px;
}
.rs-tier {
  display: grid;
  gap: 5px;
  padding: 12px;
  border-radius: 13px;
  border: var(--border-subtle);
  background: var(--surface-1);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.rs-tier:hover { border-color: var(--primary-line); }
.rs-tier.is-on {
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
  box-shadow: 0 0 0 3px var(--primary-soft-3);
}
.rs-tier b {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-body);
}
.rs-tier b em { font-style: normal; font-size: var(--fs-label); color: var(--primary-text); }
.rs-tier-days { font-style: normal; font-size: var(--fs-body-2); font-weight: 600; color: var(--primary-text); }
.rs-tier-note { font-style: normal; font-size: var(--fs-label); color: var(--text-muted); line-height: 1.5; }

.rs-preview {
  display: grid;
  gap: 10px;
  padding: 13px 15px;
  border-radius: 13px;
  border: 0.5px solid var(--primary-line);
  background: var(--primary-soft-3);
}
.rs-preview-t {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: var(--fs-body-2);
  font-weight: 600;
  color: var(--text-secondary);
}
.rs-preview-t span { margin-left: auto; font-weight: 400; font-size: var(--fs-label); color: var(--text-muted); }
.rs-bars { display: flex; align-items: flex-end; gap: 6px; height: 54px; }
.rs-col { flex: 1; display: grid; justify-items: center; gap: 4px; }
.rs-col i {
  display: block;
  width: 100%;
  max-width: 26px;
  border-radius: 5px 5px 2px 2px;
  background: linear-gradient(180deg, #9d8bf5, #5b47d6);
}
.rs-col i.is-zero { background: var(--primary-soft-1); }
.rs-col u { text-decoration: none; font-size: 10px; color: var(--text-muted); }
.rs-sum { margin: 0; font-size: var(--fs-body-2); color: var(--text-secondary); }
.rs-sum b { color: var(--primary-text); }
.rs-note { margin: 0; font-size: var(--fs-label); color: var(--text-muted); line-height: 1.6; }

.rs-rules {
  margin-top: 14px;
  border: var(--border-subtle);
  border-radius: 13px;
  overflow: hidden;
}
.rs-rules-h {
  padding: 11px 15px;
  background: var(--surface-recess);
  font-size: var(--fs-body-2);
  font-weight: 600;
  color: var(--text-tertiary);
}
.rs-rules-b { padding: 13px 15px; display: grid; gap: 9px; }
.rs-rule { display: flex; gap: 9px; font-size: var(--fs-body-2); color: var(--text-secondary); line-height: 1.65; }
.rs-rule .k { flex: none; min-width: 74px; font-weight: 600; color: var(--text-primary); }
.rs-rule b { color: var(--text-primary); }
</style>
