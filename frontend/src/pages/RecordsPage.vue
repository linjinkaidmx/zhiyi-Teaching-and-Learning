<template>
  <div class="zy-container zy-page records">
    <header class="rec__head">
      <div>
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBackSmart($router)">← 返回</UiButton>
        <h1 class="t-h1">学习记录</h1>
        <p class="t-body-2">讲解、追问、自测、存题与代码诊断的流水（本地记录，后端表就绪后同步）</p>
      </div>
      <div class="rec__head-ops">
        <UiButton variant="ghost" size="sm" @click="$router.push(ROUTES.data)">学习数据</UiButton>
        <UiButton v-if="records.length" variant="ghost" size="sm" @click="doClear">清空记录</UiButton>
      </div>
    </header>

    <!-- 类型筛选 -->
    <div class="rec__filters">
      <button
        type="button"
        class="rec__chip"
        :class="{ 'is-active': !type }"
        @click="type = ''"
      >
        全部 <b>{{ records.length }}</b>
      </button>
      <button
        v-for="(meta, key) in RECORD_TYPES"
        :key="key"
        type="button"
        class="rec__chip"
        :class="{ 'is-active': type === key }"
        @click="type = key"
      >
        {{ meta.label }} <b>{{ countOf(key) }}</b>
      </button>
    </div>

    <UiEmptyState
      v-if="!shown.length"
      :title="records.length ? '这个类型还没有记录' : '还没有学习记录'"
      :description="records.length ? '换个类型看看' : '去拍一道题、做一次自测，这里就会有记录。'"
    >
      <template #action>
        <UiButton variant="primary" @click="$router.push(ROUTES.capture)">去拍题</UiButton>
      </template>
    </UiEmptyState>

    <ul v-else class="rec__list">
      <li v-for="r in shown" :key="r.id" class="rec__item surface-standard">
        <UiIcon :name="iconOf(r.type)" :size="18" />
        <div class="rec__body">
          <div class="rec__title-row">
            <span class="rec__type">{{ labelOf(r.type) }}</span>
            <span class="t-label rec__time">{{ timeText(r.createdAt) }}</span>
          </div>
          <!-- MathText 渲染：兼容历史记录里未转符号的 LaTeX 源码（渲染失败自动降级，绝不显示 $ 或反斜杠残留） -->
          <p v-if="r.titleTex || r.title" class="rec__title"><MathText :content="r.titleTex || r.title" /></p>
          <div class="rec__meta">
            <UiTag v-if="r.brief" variant="neutral"><MathText :content="r.brief" /></UiTag>
            <UiTag v-if="r.correct === true" variant="success">答对</UiTag>
            <UiTag v-else-if="r.correct === false" variant="error">答错</UiTag>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="records.length >= 300" class="t-label rec__more">记录上限 300 条，更早的会自动滚出。</p>
  </div>
</template>

<script setup>
/**
 * 学习记录（/records）
 * 数据来源：recordsStore（所有打卡埋点自动写入，结构对齐后端 LearningSession）
 */
import { computed, ref } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiTag from '../ui/UiTag.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import MathText from '../components/MathText.vue'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'
import { recordsRef, RECORD_TYPES, clearRecords } from '../stores/recordsStore'
import { ElMessageBox } from '../ui/notify.js'
import { toast } from '../ui/toast.js'

const records = computed(() => recordsRef().value)
const type = ref('')

const shown = computed(() => (type.value ? records.value.filter((r) => r.type === type.value) : records.value))

const labelOf = (t) => (RECORD_TYPES[t] ? RECORD_TYPES[t].label : t)
const iconOf = (t) => (RECORD_TYPES[t] ? RECORD_TYPES[t].icon : 'sparkle')
const countOf = (t) => records.value.filter((r) => r.type === t).length

function timeText(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`
  return sameDay ? `今天 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function doClear() {
  ElMessageBox.confirm('将清空本机的学习记录（错题本与打卡统计不受影响）。继续吗？', '清空学习记录', {
    type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消',
  })
    .then(() => {
      clearRecords()
      toast.success('学习记录已清空')
    })
    .catch(() => {})
}
</script>

<style scoped>
.records {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: 860px;
}
.rec__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.rec__head-ops {
  display: flex;
  gap: var(--sp-2);
}
.rec__filters {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.rec__chip {
  padding: 6px 14px;
  border: var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.rec__chip.is-active {
  border-color: var(--primary-line);
  background: var(--primary-soft-2);
  color: var(--primary-text-strong);
}
.rec__chip b {
  font-weight: var(--fw-medium);
}
.rec__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.rec__item {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  align-items: flex-start;
  color: var(--text-tertiary);
}
.rec__body {
  flex: 1;
  min-width: 0;
}
.rec__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.rec__type {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.rec__time {
  color: var(--text-muted);
}
.rec__title {
  margin-top: 3px;
  font-size: var(--fs-body);
  color: var(--text-primary);
  line-height: var(--lh-body);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.rec__meta {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-top: var(--sp-2);
}
.rec__more {
  color: var(--text-muted);
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .records {
    max-width: none;
  }
}
</style>
