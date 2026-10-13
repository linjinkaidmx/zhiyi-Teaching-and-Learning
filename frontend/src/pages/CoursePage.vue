<template>
  <div class="zy-container zy-page course">
    <header class="co__head">
      <div>
        <UiButton variant="soft" size="sm" class="zy-back" @click="goBackSmart($router)" icon="left">返回</UiButton>
        <h1 class="t-h1">我的课程</h1>
        <p class="t-body-2">手动维护课程与知识点，教室、老师随时可改</p>
      </div>
      <div class="co__head-ops">
        <UiButton variant="ghost" size="sm" @click="$router.push(ROUTES.timetable)">课程表</UiButton>
        <UiButton variant="ghost" size="sm" @click="$router.push(ROUTES.exams)">考试安排</UiButton>
        <UiButton variant="primary" size="sm" @click="openAdd">＋ 新增课程</UiButton>
      </div>
    </header>

    <!-- 新手引导 · 三步开课（与课程表页统一口径；三步全部完成后自动隐藏） -->
    <nav v-if="onboarding.active" class="co__onboard surface-standard" aria-label="开课引导">
      <ol class="co__steps">
        <li
          v-for="s in onboarding.steps"
          :key="s.key"
          class="co__step"
          :class="{ 'is-done': s.done, 'is-current': s.current }"
        >
          <button type="button" class="co__step-btn" :disabled="s.done" @click="s.click && s.click()">
            <span class="co__step-dot">{{ s.done ? '✓' : s.index }}</span>
            <span class="co__step-main">
              <span class="co__step-title">{{ s.title }}</span>
              <span class="co__step-desc">{{ s.desc }}</span>
            </span>
            <span class="co__step-go">{{ s.done ? '已完成' : (s.current ? '去完成 →' : '待完成') }}</span>
          </button>
        </li>
      </ol>
    </nav>

    <div v-if="summary.courses" class="co__stats">
      <div class="co__stat">
        <span class="co__stat-num">{{ summary.courses }}</span>
        <span class="co__stat-label">课程</span>
      </div>
      <div class="co__stat">
        <span class="co__stat-num">{{ summary.slots }}</span>
        <span class="co__stat-label">已排课（节）</span>
      </div>
      <div class="co__stat">
        <span class="co__stat-num">{{ summary.exams }}</span>
        <span class="co__stat-label">考试</span>
      </div>
    </div>

    <UiEmptyState
      v-if="!courses.length"
      title="还没有课程"
      description="在这里建课并设置老师 / 教室 / 颜色；也可以直接在课程表网格点空格排课（会自动建课）。"
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
              <template v-if="c.teacher || c.location">
                <template v-if="c.teacher">{{ c.teacher }}</template>
                <template v-if="c.teacher && c.location"> · </template>
                <template v-if="c.location">{{ c.location }}</template>
              </template>
              <template v-else>未填教师/教室</template>
            </div>
          </div>
          <div class="co__card-ops">
            <UiButton variant="ghost" size="sm" icon="pencil" @click="openEdit(c)">编辑</UiButton>
            <button class="co__del" type="button" title="删除课程" @click="doRemoveCourse(c)">
              <UiIcon name="trash" size="15" />
            </button>
          </div>
        </header>
        <div v-if="coursePeriodsMap[c.id]?.length" class="co__card-periods">
          <span v-for="(t, i) in coursePeriodsMap[c.id]" :key="i" class="co__period-tag">
            <UiIcon name="clock" size="11" class="co__period-tag-icon" />
            {{ t }}
          </span>
        </div>
        <div v-else class="t-label co__card-noslot">尚未排课 · 去课程表点空格排课</div>
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
          <div class="co__period-head">
            <span class="co__period-title">
              <UiIcon name="clock" size="12" class="co__period-title-icon" />
              时段 {{ i + 1 }} · {{ dayLabel(p.day) }} {{ slotLabel(p) }} · {{ weeksPreview(p) }}
            </span>
            <span class="co__period-ops">
              <button class="co__period-copy" type="button" @click="duplicatePeriod(i)">复制</button>
              <button class="co__del" type="button" title="删除该时段" @click="removePeriod(i)">×</button>
            </span>
          </div>
          <div class="co__period-row">
            <UiSelect v-model="p.day" :options="dayOptions" aria-label="星期" />
            <UiSelect v-model="p.slotStart" :options="slotOptions" aria-label="起始节次" />
            <span class="co__period-sep">～</span>
            <UiSelect v-model="p.slotEnd" :options="slotOptions" aria-label="结束节次" />
          </div>
          <div class="t-label co__period-time">{{ slotTimeText(p) }}</div>
          <div class="co__period-row">
            <UiSelect v-model="p.weeksType" :options="weekTypeOptions" aria-label="周次类型" />
            <WeekPicker
              v-if="p.weeksType === 'custom'"
              v-model="p.weeksRanges"
              :total-weeks="termTotalWeeks"
              class="co__weekpicker"
            />
          </div>
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
import { useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiModal from '../ui/UiModal.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import {
  coursesRef, courseSummary, addCourse, updateCourse, removeCourse,
  timetableRef, slotAt, addSlot, removeSlot, DAYS, SLOTS, COURSE_COLORS,
  termRef, examsRef,
} from '../stores/courseStore'
import { slotsToPeriods, periodsToSlots, parseRanges, formToWeeks, weeksOverlap } from '../lib/schedulePeriods.js'
import WeekPicker from '../ui/WeekPicker.vue'
import { ElMessageBox } from '../ui/notify.js'
import { toast } from '../ui/toast.js'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'

const $router = useRouter()
const term = termRef()
const exams = examsRef()
const termTotalWeeks = computed(() => Number(term.value?.totalWeeks) || 20)

/** 新手引导三步（与课程表页统一口径）：设置学期 → 排第一节课 → 记一次考试 */
const onboarding = computed(() => {
  const s1 = !!term.value?.startDate
  const s2 = courses.value.length > 0
  const s3 = exams.value.length > 0
  const currentKey = !s1 ? 'term' : (!s2 ? 'course' : (!s3 ? 'exam' : null))
  const steps = [
    { key: 'term', index: 1, title: '设置学期', desc: '在课程表页填第一周周一的日期', done: s1, click: () => $router.push(ROUTES.timetable) },
    { key: 'course', index: 2, title: '建课程 / 排课', desc: '本页建课，或直接点课表空格排课', done: s2, click: () => { if (!s2) openAdd() } },
    { key: 'exam', index: 3, title: '记一次考试', desc: '在考试安排页录入，自动进首页提醒', done: s3, click: () => $router.push(ROUTES.exams) },
  ].map((s) => ({ ...s, current: s.key === currentKey }))
  return { active: !(s1 && s2 && s3), steps }
})

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

/** 节次显示：单节「第 3 节」、多节「3-5 节」 */
function slotLabel(p) {
  const a = Number(p.slotStart)
  const b = Number(p.slotEnd)
  return a === b ? `第 ${a} 节` : `${a}-${b} 节`
}

/** 时段副行时间：第 3 节 08:30-09:15 ～ 第 5 节 10:20-11:05 */
function slotTimeText(p) {
  const a = Number(p.slotStart)
  const b = Number(p.slotEnd)
  const sa = SLOTS[a - 1]
  const sb = SLOTS[b - 1]
  if (!sa) return ''
  const head = `第 ${a} 节 ${sa.start}-${sa.end}`
  if (a === b || !sb) return head
  return `${head} ～ 第 ${b} 节 ${sb.start}-${sb.end}`
}

/** 每个课程的排课时段摘要（卡片用）：['周一 3-5 节 · 每周', '周五 6-8 节 · 双周'] */
const coursePeriodsMap = computed(() => {
  const map = {}
  for (const c of courses.value) {
    const slots = table.value.filter((s) => s.courseId === c.id)
    const periods = slotsToPeriods(slots)
    map[c.id] = periods
      .map((p) => `${dayLabel(p.day)} ${slotLabel(p)} · ${weeksPreview(p)}`)
      .slice(0, 3)
  }
  return map
})

function addPeriod() {
  slotDraft.value = [...slotDraft.value, newPeriod()]
}

function removePeriod(i) {
  slotDraft.value = slotDraft.value.filter((_, idx) => idx !== i)
}

/** 复制时段：在 i 之后插入一份同配置的新时段 */
function duplicatePeriod(i) {
  const copy = { ...slotDraft.value[i] }
  slotDraft.value = [...slotDraft.value.slice(0, i + 1), copy, ...slotDraft.value.slice(i + 1)]
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
  // 冲突检查（升级）：目标格子被「其他课程」占用且周次有交集才阻止（单双周可共格）
  const selfId = editingId.value
  const conflicts = []
  for (const p of slotDraft.value) {
    const weeks = formToWeeks(p.weeksType, p.weeksRanges)
    for (let s = Number(p.slotStart); s <= Number(p.slotEnd); s += 1) {
      const exist = slotAt(Number(p.day), s)
      if (exist && exist.courseId !== selfId && weeksOverlap(weeks, exist.weeks || { type: 'every' }, termTotalWeeks.value)) {
        conflicts.push(`${dayLabel(p.day)} 第 ${s} 节`)
      }
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
/* 新手引导 · 三步开课（与课程表页同款） */
.co__steps {
  list-style: none;
  margin: 0;
  padding: var(--sp-2) var(--sp-3);
  display: flex;
  align-items: stretch;
  gap: 0;
}
.co__step {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
.co__step + .co__step::before {
  content: '';
  flex: none;
  width: 28px;
  height: 2px;
  margin: 0 var(--sp-2);
  background: var(--surface-recess);
  border-radius: 1px;
}
.co__step.is-done + .co__step::before {
  background: var(--primary-soft-2);
}
.co__step-btn {
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
.co__step-btn:not(:disabled):hover {
  background: var(--surface-hover);
}
.co__step.is-current .co__step-btn {
  border-color: var(--primary-line);
  background: var(--primary-soft-1);
}
.co__step-dot {
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
.co__step.is-current .co__step-dot {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.co__step.is-done .co__step-dot {
  background: var(--primary-soft-1);
  border-color: var(--primary-line);
  color: var(--primary-text);
}
.co__step-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.co__step-title {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.co__step.is-done .co__step-title {
  color: var(--text-secondary);
}
.co__step-desc {
  font-size: var(--fs-label);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.co__step-go {
  flex: none;
  font-size: var(--fs-label);
  color: var(--text-muted);
  white-space: nowrap;
}
.co__step.is-current .co__step-go {
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}
.co__step.is-done .co__step-go {
  color: var(--text-disabled);
}
@media (max-width: 900px) {
  .co__steps {
    flex-direction: column;
    gap: var(--sp-1);
    padding: var(--sp-2);
  }
  .co__step + .co__step::before {
    display: none;
  }
  .co__step + .co__step {
    border-top: var(--border-divider-soft);
  }
  .co__step-btn {
    padding: var(--sp-2);
  }
  .co__step-desc {
    white-space: normal;
  }
}
.co__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
}
.co__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  background: var(--surface-unit);
}
.co__stat-num {
  font-size: 22px;
  font-weight: var(--fw-medium);
  line-height: 1.1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.co__stat-label {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
@media (max-width: 900px) {
  .co__stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sp-2);
  }
  .co__stat {
    padding: var(--sp-2) var(--sp-3);
  }
  .co__stat-num {
    font-size: 18px;
  }
}
.co__list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.co__card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
}
.co__card-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.co__dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex: none;
}
.co__card-title {
  flex: 1;
  min-width: 0;
}
.co__name {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.co__meta {
  color: var(--text-muted);
  margin-top: 2px;
}
.co__card-ops {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.co__card-periods {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.co__period-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-label);
}
.co__period-tag-icon {
  color: var(--text-muted);
}
.co__card-noslot {
  color: var(--text-muted);
}
.co__del {
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
.co__del:hover {
  color: var(--error, #c0392b);
  background: var(--danger-soft, rgba(200, 60, 60, 0.12));
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
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.co__period-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.co__period-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.co__period-title-icon {
  color: var(--text-muted);
}
.co__period-ops {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}
.co__period-copy {
  border: 0;
  background: none;
  padding: 2px 4px;
  color: var(--primary-text);
  font-size: var(--fs-label);
  cursor: pointer;
}
.co__period-copy:hover {
  text-decoration: underline;
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
.co__weekpicker {
  flex: 1 1 100%;
}
.co__period-sep {
  flex: 0 0 auto;
  color: var(--text-tertiary);
}
.co__period-time {
  color: var(--text-muted);
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .course {
    max-width: none;
  }
}
</style>
