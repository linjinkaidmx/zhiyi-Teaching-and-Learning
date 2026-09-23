<template>
  <div class="zy-container zy-page course">
    <header class="co__head">
      <div>
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBackSmart($router)">← 返回</UiButton>
        <h1 class="t-h1">我的课程</h1>
        <p class="t-body-2">手动维护课程与知识点，教室、老师随时可改</p>
      </div>
      <div class="co__head-ops">
        <UiButton variant="ghost" size="sm" @click="$router.push(ROUTES.timetable)">课程表</UiButton>
        <UiButton variant="ghost" size="sm" @click="$router.push(ROUTES.exams)">考试安排</UiButton>
        <UiButton variant="primary" size="sm" @click="openAdd">＋ 新增课程</UiButton>
      </div>
    </header>

    <div v-if="summary.courses" class="co__stats">
      <span class="co__chip">课程 <b>{{ summary.courses }}</b></span>
      <span class="co__chip">已排课 <b>{{ summary.slots }}</b> 节</span>
      <span class="co__chip">考试 <b>{{ summary.exams }}</b> 场</span>
    </div>

    <UiEmptyState
      v-if="!courses.length"
      title="还没有课程"
      description="手动添加课程、教师与教室，然后在课程表里排课。"
    >
      <template #action>
        <UiButton variant="primary" @click="openAdd">＋ 新增课程</UiButton>
      </template>
    </UiEmptyState>

    <div v-else class="co__list">
      <section v-for="c in courses" :key="c.id" class="co__card surface-standard">
        <header class="co__card-head">
          <span class="co__dot" :style="{ background: c.color }" />
          <div class="co__card-title">
            <div class="co__name">{{ c.name }}</div>
            <div class="t-label co__meta">
              <template v-if="c.teacher">{{ c.teacher }}</template>
              <template v-if="c.teacher && c.location"> · </template>
              <template v-if="c.location">{{ c.location }}</template>
              <template v-if="!c.teacher && !c.location">未填教师/教室</template>
            </div>
          </div>
          <UiButton variant="ghost" size="sm" @click="openEdit(c)">编辑</UiButton>
          <button class="co__del" type="button" title="删除课程" @click="doRemoveCourse(c)">×</button>
        </header>
      </section>
    </div>

    <!-- 新增 / 编辑课程 -->
    <UiModal v-model="addOpen" :title="editingId ? '编辑课程' : '新增课程'">
      <div class="co__form">
        <UiInput v-model="addForm.name" label="课程名" :maxlength="30" placeholder="如：数据结构" />
        <UiInput v-model="addForm.teacher" label="教师" :maxlength="16" placeholder="如：王老师" optional />
        <UiInput v-model="addForm.location" label="教室" :maxlength="20" placeholder="如：教三 302" optional />

        <!-- 课程颜色：预设色点选 + 取色器自定义（决定课表色块颜色） -->
        <div class="co__color-field">
          <span class="t-label">课程颜色（课表里用这个色区分课程）</span>
          <div class="co__swatches">
            <button
              v-for="c in COURSE_COLORS"
              :key="c"
              type="button"
              class="co__swatch"
              :class="{ 'is-active': addForm.color === c }"
              :style="{ background: c }"
              :title="c"
              @click="addForm.color = c"
            />
            <label
              class="co__swatch co__swatch--custom"
              :class="{ 'is-active': !COURSE_COLORS.includes(addForm.color) }"
              :style="{ background: addForm.color }"
              title="自定义颜色"
            >
              <input type="color" :value="addForm.color" @input="addForm.color = $event.target.value" />
            </label>
          </div>
        </div>
      </div>

      <!-- 上课时段：可增删多条（星期 + 节次范围 + 周次），保存时按此重建排课 -->
      <div class="co__periods">
        <div class="co__periods-head">
          <span class="t-label">上课时段</span>
          <span class="t-label co__periods-tip">保存后按此重建该课程在课程表的排课</span>
        </div>

        <div v-if="!slotDraft.length" class="t-label co__period-empty">
          未设置时段（可在课程表里手动排课，或在这里按星期 + 节次 + 周次批量设置）
        </div>

        <div v-for="(p, i) in slotDraft" :key="i" class="co__period">
          <div class="co__period-row">
            <UiSelect v-model="p.day" :options="dayOptions" aria-label="星期" />
            <UiSelect v-model="p.slotStart" :options="slotOptions" aria-label="起始节次" />
            <span class="co__period-sep">～</span>
            <UiSelect v-model="p.slotEnd" :options="slotOptions" aria-label="结束节次" />
            <button class="co__del" type="button" title="删除该时段" @click="removePeriod(i)">×</button>
          </div>
          <div class="co__period-row">
            <UiSelect v-model="p.weeksType" :options="weekTypeOptions" aria-label="周次类型" />
            <UiInput
              v-if="p.weeksType === 'custom'"
              v-model="p.weeksRanges"
              placeholder="如 2,5,6 或 2-8"
              :maxlength="40"
              optional
            />
          </div>
          <div class="t-label co__period-preview">周次：{{ weeksPreview(p) }}</div>
        </div>

        <UiButton variant="ghost" size="sm" @click="addPeriod">＋ 添加时段</UiButton>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="addOpen = false">取消</UiButton>
        <UiButton variant="primary" :disabled="!addForm.name.trim()" @click="doAddCourse">
          {{ editingId ? '保存' : '添加' }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup>
/**
 * 我的课程（/course）
 * 课程/章节/知识点本地存储（courseStore v2）；纯手动，无 AI 推荐。
 */
import { computed, reactive, ref } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiModal from '../ui/UiModal.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import {
  coursesRef, courseSummary, addCourse, updateCourse, removeCourse,
  timetableRef, slotAt, addSlot, removeSlot, DAYS, SLOTS, COURSE_COLORS,
} from '../stores/courseStore'
import { slotsToPeriods, periodsToSlots, parseRanges } from '../lib/schedulePeriods.js'
import { ElMessageBox } from '../ui/notify.js'
import { toast } from '../ui/toast.js'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'

const courses = coursesRef()
const table = timetableRef()
const summary = computed(() => courseSummary().value)

const addOpen = ref(false)
const editingId = ref(null)
const addForm = reactive({ name: '', teacher: '', location: '', color: COURSE_COLORS[0] })
/** 上课时段草稿：[{ day, slotStart, slotEnd, weeksType, weeksRanges }] */
const slotDraft = ref([])

const dayOptions = DAYS.map((d, i) => ({ label: d, value: i + 1 }))
const slotOptions = SLOTS.map((s) => ({ label: `第 ${s.key} 节`, value: s.key }))
const weekTypeOptions = [
  { label: '每周', value: 'every' },
  { label: '单周', value: 'odd' },
  { label: '双周', value: 'even' },
  { label: '自定义周次', value: 'custom' },
]

function newPeriod() {
  return { day: 1, slotStart: 1, slotEnd: 1, weeksType: 'every', weeksRanges: '' }
}

function dayLabel(day) {
  return DAYS[Number(day) - 1] || `周${day}`
}

function addPeriod() {
  slotDraft.value = [...slotDraft.value, newPeriod()]
}

function removePeriod(i) {
  slotDraft.value = slotDraft.value.filter((_, idx) => idx !== i)
}

/** 周次文本预览（人类可读） */
function weeksPreview(p) {
  if (p.weeksType === 'every') return '每周'
  if (p.weeksType === 'odd') return '单周'
  if (p.weeksType === 'even') return '双周'
  const ranges = parseRanges(p.weeksRanges)
  if (!ranges.length) return '未填周次，按每周处理'
  return ranges.map(([a, b]) => (a === b ? `第 ${a} 周` : `第 ${a}-${b} 周`)).join('、')
}

function openAdd() {
  editingId.value = null
  addForm.name = ''
  addForm.teacher = ''
  addForm.location = ''
  // 默认自动轮到一个预设色，用户可在弹窗里改
  addForm.color = COURSE_COLORS[courses.value.length % COURSE_COLORS.length]
  slotDraft.value = []
  addOpen.value = true
}

function openEdit(c) {
  editingId.value = c.id
  addForm.name = c.name
  addForm.teacher = c.teacher || ''
  addForm.location = c.location || ''
  addForm.color = c.color || COURSE_COLORS[0]
  // 把该课程现有排课反推成时段（同天+同周次的连续节次自动合并为一段）
  slotDraft.value = slotsToPeriods(table.value.filter((s) => s.courseId === c.id))
  addOpen.value = true
}

function doAddCourse() {
  const name = addForm.name.trim().slice(0, 30)
  if (!name) {
    toast.error('课程名不能为空')
    return
  }
  // 时段校验
  for (const p of slotDraft.value) {
    if (Number(p.slotEnd) < Number(p.slotStart)) {
      toast.error('时段的结束节次不能早于起始节次')
      return
    }
    if (p.weeksType === 'custom' && !parseRanges(p.weeksRanges).length) {
      toast.error('自定义周次不能为空，可写 2,5,6 或 2-8')
      return
    }
  }
  // 冲突检查：目标格子被「其他课程」占用则阻止
  const selfId = editingId.value
  const conflicts = []
  for (const p of slotDraft.value) {
    for (let s = Number(p.slotStart); s <= Number(p.slotEnd); s += 1) {
      const exist = slotAt(Number(p.day), s)
      if (exist && exist.courseId !== selfId) conflicts.push(`${dayLabel(p.day)} 第 ${s} 节`)
    }
  }
  if (conflicts.length) {
    toast.error(
      `这些格子已有其他课程：${conflicts.slice(0, 4).join('、')}${conflicts.length > 4 ? ' 等' : ''}`
    )
    return
  }

  // 写入课程基本信息
  let courseId = selfId
  if (courseId) {
    updateCourse(courseId, {
      name,
      teacher: addForm.teacher.trim().slice(0, 16),
      location: addForm.location.trim().slice(0, 20),
      color: addForm.color,
    })
  } else {
    const c = addCourse({
      name,
      teacher: addForm.teacher,
      location: addForm.location,
      color: addForm.color,
    })
    if (!c) {
      toast.error('课程名不能为空')
      return
    }
    courseId = c.id
  }

  // 按「上课时段」重建该课程的排课：先清旧格子，再按每个时段展开写入
  table.value.filter((s) => s.courseId === courseId).forEach((s) => removeSlot(s.id))
  const toWrite = periodsToSlots(slotDraft.value, courseId, addForm.location.trim())
  for (const s of toWrite) addSlot(s)

  addOpen.value = false
  toast.success(toWrite.length ? `已保存，排入 ${toWrite.length} 节` : '已保存')
}

function doRemoveCourse(c) {
  ElMessageBox.confirm(`将删除「${c.name}」及其章节、知识点，并移除它在课程表里的所有安排。继续吗？`, '删除课程', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
  })
    .then(() => {
      removeCourse(c.id)
      toast.success('已删除')
    })
    .catch(() => {})
}
</script>

<style scoped>
.course {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.co__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.co__head-ops {
  display: flex;
  gap: var(--sp-2);
}
.co__stats {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.co__chip {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
}
.co__chip b {
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}
.co__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.co__card {
  padding: var(--sp-4) var(--sp-5);
}
.co__card-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.co__dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}
.co__card-title {
  flex: 1;
  min-width: 0;
}
.co__name {
  font-size: var(--fs-h3);
  color: var(--text-primary);
}
.co__meta {
  color: var(--text-muted);
  margin-top: 2px;
}
.co__del {
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.co__del:hover {
  color: var(--error);
}
.co__form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
/* 课程颜色选择 */
.co__color-field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.co__swatches {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.co__swatch {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  transition: transform var(--dur) var(--ease);
}
.co__swatch:hover {
  transform: scale(1.1);
}
.co__swatch.is-active {
  border-color: var(--text-primary);
}
.co__swatch--custom {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  border-style: dashed;
  border-color: var(--border-strong);
}
.co__swatch--custom.is-active {
  border-style: solid;
  border-color: var(--text-primary);
}
.co__swatch--custom input[type='color'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
}
/* 上课时段编辑区 */
.co__periods {
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
  border-top: var(--border-divider-soft);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  align-items: flex-start;
}
.co__periods-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.co__periods-tip {
  color: var(--text-muted);
}
.co__period-empty {
  color: var(--text-muted);
  line-height: var(--lh-body);
}
.co__period {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--sp-2);
  border-radius: var(--radius-sm);
  background: var(--surface-recess);
}
.co__period-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.co__period-row > .ui-select {
  flex: 1;
  min-width: 0;
}
.co__period-sep {
  flex: 0 0 auto;
  color: var(--text-tertiary);
}
.co__period-preview {
  color: var(--text-muted);
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .course {
    max-width: none;
  }
}
</style>
