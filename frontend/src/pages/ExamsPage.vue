<template>
  <div class="zy-container zy-page ex">
    <header class="ex__head">
      <div>
        <UiButton variant="soft" size="sm" class="zy-back" @click="goBackSmart($router)" icon="left">返回</UiButton>
        <h1 class="t-h1">考试安排</h1>
        <p class="t-body-2">按日期记录考试，会出现在课程表顶部与首页的提醒里</p>
      </div>
      <div class="ex__head-ops">
        <UiButton variant="ghost" size="sm" icon="schedule" @click="$router.push(ROUTES.timetable)">课程表</UiButton>
        <UiButton variant="primary" size="sm" icon="plus" @click="openAdd">新增考试</UiButton>
      </div>
    </header>

    <!-- 新手引导 · 三步开课（与课程表页统一口径；三步全部完成后自动隐藏） -->
    <nav v-if="onboarding.active" class="ex__onboard surface-standard" aria-label="开课引导">
      <ol class="ex__steps">
        <li
          v-for="s in onboarding.steps"
          :key="s.key"
          class="ex__step"
          :class="{ 'is-done': s.done, 'is-current': s.current }"
        >
          <button type="button" class="ex__step-btn" :disabled="s.done" @click="s.click && s.click()">
            <span class="ex__step-dot">{{ s.done ? '✓' : s.index }}</span>
            <span class="ex__step-main">
              <span class="ex__step-title">{{ s.title }}</span>
              <span class="ex__step-desc">{{ s.desc }}</span>
            </span>
            <span class="ex__step-go">{{ s.done ? '已完成' : (s.current ? '去完成 →' : '待完成') }}</span>
          </button>
        </li>
      </ol>
    </nav>

    <UiEmptyState
      v-if="!exams.length"
      title="还没有考试"
      description="添加本学期要考的科目，考试当天与临近几天会特别提醒你；也可以在课程表页顶部快速录入。"
    >
      <template #action>
        <UiButton variant="primary" @click="openAdd">＋ 新增考试</UiButton>
      </template>
    </UiEmptyState>

    <div v-else class="ex__list">
      <template v-for="g in groupedExams" :key="g.key">
        <div class="ex__group-label">{{ g.label }}</div>
        <section v-for="e in g.items" :key="e.id" class="ex__card surface-standard" :class="{ 'is-past': isPast(e) }">
          <span class="ex__date">
            <span class="ex__date-day">{{ e.date.slice(8, 10) }}</span>
            <span class="ex__date-month">{{ e.date.slice(5, 7) }} 月</span>
          </span>
          <span class="ex__dot" :style="{ background: examColor(e) }" />
          <div class="ex__card-main">
            <div class="ex__name">
              {{ e.name }}
              <span v-if="examCourseName(e)" class="t-label ex__course">（{{ examCourseName(e) }}）</span>
            </div>
            <div class="t-label ex__meta">
              {{ e.date }}
              <template v-if="e.startTime"> {{ e.startTime }}<template v-if="e.endTime">–{{ e.endTime }}</template></template>
              <template v-if="e.location"> · {{ e.location }}</template>
              <template v-if="e.note"> · {{ e.note }}</template>
            </div>
          </div>
          <span class="ex__badge" :class="badgeClass(e)">{{ badgeText(e) }}</span>
          <div class="ex__ops">
            <UiButton variant="ghost" size="sm" icon="pencil" @click="openEdit(e)">编辑</UiButton>
            <button class="ex__del" type="button" title="删除考试" @click="doRemove(e)">
              <UiIcon name="trash" size="15" />
            </button>
          </div>
        </section>
      </template>
    </div>

    <!-- 新增/编辑 -->
    <UiModal v-model="addOpen" :title="editingId ? '编辑考试' : '新增考试'" size="sm">
      <div class="ex__form">
        <UiInput v-model="form.name" label="考试名称" :maxlength="30" placeholder="如：数据结构期末" />
        <label class="ex__field">
          <span class="t-label">日期</span>
          <input v-model="form.date" type="date" class="ex__date-input" />
        </label>
        <div class="ex__row">
          <label class="ex__field">
            <span class="t-label">开始时间</span>
            <input v-model="form.startTime" type="time" class="ex__date-input" />
          </label>
          <label class="ex__field">
            <span class="t-label">结束时间</span>
            <input v-model="form.endTime" type="time" class="ex__date-input" />
          </label>
        </div>
        <UiInput v-model="form.location" label="地点" :maxlength="20" placeholder="如：教三 201" optional />
        <UiInput v-model="form.note" label="备注" :maxlength="60" placeholder="如：闭卷，带计算器" optional />
        <label class="ex__field">
          <span class="t-label">关联课程（可选）</span>
          <UiSelect v-model="form.courseId" :options="courseOptions" placeholder="不关联" clearable />
        </label>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="addOpen = false">取消</UiButton>
        <UiButton variant="primary" :disabled="!form.name.trim() || !form.date" @click="doSave">
          {{ editingId ? '保存' : '添加' }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup>
/**
 * 考试安排（/exams）· 课程表重做版新增
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiModal from '../ui/UiModal.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'
import { examsRef, coursesRef, termRef, addExam, updateExam, removeExam, getCourse } from '../stores/courseStore'
import { toDateStr, daysUntil } from '../lib/termCalc.js'
import { ElMessageBox } from '../ui/notify.js'
import { toast } from '../ui/toast.js'

const $router = useRouter()
const exams = examsRef()
const courses = coursesRef()
const term = termRef()
const todayStr = toDateStr(new Date())

/** 新手引导三步（与课程表页统一口径）：设置学期 → 排第一节课 → 记一次考试 */
const onboarding = computed(() => {
  const s1 = !!term.value?.startDate
  const s2 = courses.value.length > 0
  const s3 = exams.value.length > 0
  const currentKey = !s1 ? 'term' : (!s2 ? 'course' : (!s3 ? 'exam' : null))
  const goTimetable = () => $router.push(ROUTES.timetable)
  const steps = [
    { key: 'term', index: 1, title: '设置学期', desc: '在课程表页填第一周周一的日期', done: s1, click: goTimetable },
    { key: 'course', index: 2, title: '排第一节课', desc: '在课程表网格点击空格排课', done: s2, click: goTimetable },
    { key: 'exam', index: 3, title: '记一次考试', desc: '本页录入，自动进首页提醒', done: s3, click: openAdd },
  ].map((s) => ({ ...s, current: s.key === currentKey }))
  return { active: !(s1 && s2 && s3), steps }
})

const addOpen = ref(false)
const editingId = ref(null)
const form = reactive({ name: '', date: '', startTime: '', endTime: '', location: '', note: '', courseId: null })

const courseOptions = computed(() => courses.value.map((c) => ({ label: c.name, value: c.id })))

const sorted = computed(() => [...exams.value].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)))

function isPast(e) {
  return e.date < todayStr
}
function daysTo(e) {
  return daysUntil(e.date, todayStr)
}
function countdownText(e) {
  const d = daysTo(e)
  if (d < 0) return `已结束 ${-d} 天`
  if (d === 0) return '今天考试'
  if (d === 1) return '明天考试'
  if (d <= 7) return `${d} 天后考试`
  if (d <= 30) return `${d} 天后`
  return ''
}

/** 关联课程色点（无关联用品牌紫） */
function examColor(e) {
  const c = e.courseId ? getCourse(e.courseId) : null
  return c?.color || 'var(--primary)'
}
/** 关联课程名（考试只存 courseId，这里实时取） */
function examCourseName(e) {
  return e.courseId ? getCourse(e.courseId)?.name || '' : ''
}
/** 倒计时徽标文字（简洁三态） */
function badgeText(e) {
  const d = daysTo(e)
  if (d < 0) return `已结束 ${-d} 天`
  if (d === 0) return '今天'
  if (d === 1) return '明天'
  return `${d} 天后`
}
function badgeClass(e) {
  const d = daysTo(e)
  if (d < 0) return 'is-past'
  if (d <= 7) return 'is-urgent'
  return ''
}

/** 时间分组：近期（7天内）/ 未来 / 已结束 */
const groupedExams = computed(() => {
  const groups = [
    { key: 'soon', label: '近期 · 7 天内', items: [] },
    { key: 'future', label: '未来', items: [] },
    { key: 'past', label: '已结束', items: [] },
  ]
  for (const e of sorted.value) {
    const d = daysTo(e)
    if (d < 0) groups[2].items.push(e)
    else if (d <= 7) groups[0].items.push(e)
    else groups[1].items.push(e)
  }
  return groups.filter((g) => g.items.length)
})

function openAdd() {
  editingId.value = null
  form.name = ''
  form.date = ''
  form.startTime = ''
  form.endTime = ''
  form.location = ''
  form.note = ''
  form.courseId = null
  addOpen.value = true
}

function openEdit(e) {
  editingId.value = e.id
  form.name = e.name || ''
  form.date = e.date || ''
  form.startTime = e.startTime || ''
  form.endTime = e.endTime || ''
  form.location = e.location || ''
  form.note = e.note || ''
  form.courseId = e.courseId || null
  addOpen.value = true
}

function doSave() {
  const payload = {
    name: form.name.trim(),
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    location: form.location.trim(),
    note: form.note.trim(),
    courseId: form.courseId || null,
  }
  if (editingId.value) {
    updateExam(editingId.value, payload)
    toast.success('已保存')
  } else {
    addExam(payload)
    toast.success('已添加考试')
  }
  addOpen.value = false
}

function doRemove(e) {
  ElMessageBox.confirm(`删除考试「${e.name}」？`, '删除考试', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
  })
    .then(() => { removeExam(e.id); toast.success('已删除') })
    .catch(() => {})
}
</script>

<style scoped>
.ex {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.ex__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.ex__head-ops {
  display: flex;
  gap: var(--sp-2);
}
/* 新手引导 · 三步开课（与课程表页同款） */
.ex__steps {
  list-style: none;
  margin: 0;
  padding: var(--sp-2) var(--sp-3);
  display: flex;
  align-items: stretch;
  gap: 0;
}
.ex__step {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
.ex__step + .ex__step::before {
  content: '';
  flex: none;
  width: 28px;
  height: 2px;
  margin: 0 var(--sp-2);
  background: var(--surface-recess);
  border-radius: 1px;
}
.ex__step.is-done + .ex__step::before {
  background: var(--primary-soft-2);
}
.ex__step-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: none;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ex__step-btn:not(:disabled):hover {
  background: var(--surface-hover);
}
.ex__step.is-current .ex__step-btn {
  border-color: var(--primary-line);
  background: var(--primary-soft-1);
}
.ex__step-dot {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: var(--surface-recess);
  color: var(--text-tertiary);
  border: var(--border-subtle);
}
.ex__step.is-current .ex__step-dot {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.ex__step.is-done .ex__step-dot {
  background: var(--primary-soft-1);
  border-color: var(--primary-line);
  color: var(--primary-text);
}
.ex__step-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ex__step-title {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.ex__step.is-done .ex__step-title {
  color: var(--text-secondary);
}
.ex__step-desc {
  font-size: var(--fs-label);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ex__step-go {
  flex: none;
  font-size: var(--fs-label);
  color: var(--text-muted);
  white-space: nowrap;
}
.ex__step.is-current .ex__step-go {
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}
.ex__step.is-done .ex__step-go {
  color: var(--text-disabled);
}
@media (max-width: 900px) {
  .ex__steps {
    flex-direction: column;
    gap: var(--sp-1);
    padding: var(--sp-2);
  }
  .ex__step + .ex__step::before {
    display: none;
  }
  .ex__step + .ex__step {
    border-top: var(--border-divider-soft);
  }
  .ex__step-btn {
    padding: var(--sp-2);
  }
  .ex__step-desc {
    white-space: normal;
  }
}
.ex__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.ex__group-label {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  letter-spacing: 0.5px;
  margin-top: var(--sp-2);
}
.ex__group-label:first-child {
  margin-top: 0;
}
.ex__card {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
}
.ex__card.is-past {
  opacity: 0.55;
}
.ex__date {
  flex: none;
  width: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 0;
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.ex__date-day {
  font-size: 18px;
  font-weight: var(--fw-medium);
  line-height: 1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ex__date-month {
  font-size: 10px;
  color: var(--text-muted);
}
.ex__dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.ex__card-main {
  flex: 1;
  min-width: 0;
}
.ex__name {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.ex__course {
  color: var(--text-muted);
}
.ex__meta {
  color: var(--text-muted);
  margin-top: 2px;
}
.ex__badge {
  flex: none;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-label);
  white-space: nowrap;
}
.ex__badge.is-urgent {
  background: var(--danger-soft, rgba(200, 60, 60, 0.12));
  color: var(--danger, #c0392b);
  font-weight: var(--fw-medium);
}
.ex__badge.is-past {
  color: var(--text-disabled);
}
.ex__ops {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: none;
}
.ex__del {
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ex__del:hover {
  color: var(--error, #c0392b);
  background: var(--danger-soft, rgba(200, 60, 60, 0.12));
}
.ex__form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.ex__field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.ex__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}
.ex__date-input {
  padding: 8px var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body-2);
}
.ex__date-input:focus {
  outline: none;
  border-color: var(--primary-line);
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .ex {
    max-width: none;
  }
}
</style>
