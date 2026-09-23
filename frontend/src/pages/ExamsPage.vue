<template>
  <div class="zy-container zy-page ex">
    <header class="ex__head">
      <div>
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBackSmart($router)">← 返回</UiButton>
        <h1 class="t-h1">考试安排</h1>
        <p class="t-body-2">按日期记录考试，会出现在课程表顶部与首页的提醒里</p>
      </div>
      <div class="ex__head-ops">
        <UiButton variant="ghost" size="sm" @click="$router.push(ROUTES.timetable)">课程表</UiButton>
        <UiButton variant="primary" size="sm" @click="openAdd">＋ 新增考试</UiButton>
      </div>
    </header>

    <UiEmptyState
      v-if="!exams.length"
      title="还没有考试"
      description="添加本学期要考的科目，考试当天与临近几天会特别提醒你。"
    >
      <template #action>
        <UiButton variant="primary" @click="openAdd">＋ 新增考试</UiButton>
      </template>
    </UiEmptyState>

    <div v-else class="ex__list">
      <section v-for="e in sorted" :key="e.id" class="ex__card surface-standard" :class="{ 'is-past': isPast(e) }">
        <div class="ex__card-main">
          <div class="ex__name">
            {{ e.name }}
            <span v-if="e.courseName" class="t-label">（{{ e.courseName }}）</span>
          </div>
          <div class="t-label ex__meta">
            {{ e.date }}
            <template v-if="e.startTime"> {{ e.startTime }}<template v-if="e.endTime">–{{ e.endTime }}</template></template>
            <template v-if="e.location"> · {{ e.location }}</template>
            <template v-if="e.note"> · {{ e.note }}</template>
          </div>
          <div class="t-label ex__countdown" :class="{ 'is-urgent': daysTo(e) <= 7 }">
            {{ countdownText(e) }}
          </div>
        </div>
        <div class="ex__ops">
          <UiButton variant="ghost" size="sm" @click="openEdit(e)">编辑</UiButton>
          <button class="ex__del" type="button" title="删除" @click="doRemove(e)">×</button>
        </div>
      </section>
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
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiModal from '../ui/UiModal.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'
import { examsRef, coursesRef, addExam, updateExam, removeExam, getCourse } from '../stores/courseStore'
import { toDateStr, daysUntil } from '../lib/termCalc.js'
import { ElMessageBox } from '../ui/notify.js'
import { toast } from '../ui/toast.js'

const exams = examsRef()
const courses = coursesRef()
const todayStr = toDateStr(new Date())

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
.ex__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.ex__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
}
.ex__card.is-past {
  opacity: 0.55;
}
.ex__card-main {
  min-width: 0;
}
.ex__name {
  font-size: var(--fs-h3);
  color: var(--text-primary);
}
.ex__meta {
  color: var(--text-muted);
  margin-top: 2px;
}
.ex__countdown {
  margin-top: 4px;
  color: var(--text-tertiary);
}
.ex__countdown.is-urgent {
  color: var(--danger, #c0392b);
  font-weight: var(--fw-medium);
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
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.ex__del:hover {
  color: var(--error);
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
