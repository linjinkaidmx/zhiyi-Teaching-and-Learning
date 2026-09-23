<template>
  <div class="zy-container zy-page tt">
    <header class="tt__head">
      <div>
        <UiButton variant="ghost" size="sm" class="zy-back" @click="goBackSmart($router)">← 返回</UiButton>
        <h1 class="t-h1">课程表</h1>
        <p class="t-body-2">
          <template v-if="info.configured">本周第 <b>{{ info.week }}</b> 周 · 共 {{ info.totalWeeks }} 周</template>
          <template v-else>先设置学期（第一周周一的日期），才能按周排课</template>
        </p>
      </div>
      <div class="tt__head-ops">
        <UiButton :variant="editing ? 'primary' : 'ghost'" size="sm" @click="editing = !editing">
          {{ editing ? '完成' : '编辑' }}
        </UiButton>
        <UiButton variant="ghost" size="sm" @click="examOpen = true">考试安排</UiButton>
        <UiButton variant="ghost" size="sm" @click="openTerm">设置学期</UiButton>
      </div>
    </header>

    <!-- 我的课程横条（原型 B9）：我的课程只从课程表页进 -->
    <button type="button" class="tt__course-entry surface-standard" @click="$router.push(ROUTES.course)">
      <span class="tt__course-main">
        <span class="tt__course-title">我的课程</span>
        <span class="t-label">{{ coursesRef().length }} 门课 · 管理课程 / 教师 / 教室 / 颜色</span>
      </span>
      <span class="tt__course-go">进入 →</span>
    </button>

    <!-- 考试提醒条 -->
    <div v-if="upcoming.length" class="tt__exam-banner">
      <span class="tt__exam-banner-title">近期考试</span>
      <span v-for="(e, i) in upcoming" :key="e.id" class="tt__exam-pill">
        {{ e.name }} <b>{{ e.date }}</b>{{ e.date === todayStr ? '（今天）' : daysText(e.date) }}
      </span>
    </div>

    <UiEmptyState
      v-if="!info.configured"
      title="还没设置学期"
      description="设置本学期第一周周一的日期和学期长度，之后才能按周排课、显示本周课程。"
    >
      <template #action>
        <UiButton variant="primary" @click="openTerm">设置学期</UiButton>
      </template>
    </UiEmptyState>

    <template v-else-if="!courses.length">
      <UiEmptyState
        title="还没有课程"
        description="点课程表里的空格，直接填课程名、老师、教室，就能建课并排课。"
      >
        <template #action>
          <UiButton variant="primary" @click="openAdd(1, 1)">排第一节课</UiButton>
        </template>
      </UiEmptyState>
    </template>

    <template v-else>
      <!-- 星期 × 节次网格（桌面与移动共用；移动端由 CSS 压缩列宽、字号与行高，7 列一屏放下） -->
      <section class="tt__grid surface-standard" :class="{ 'is-editing': editing }">
        <div class="tt__corner" :style="{ gridRow: 1, gridColumn: 1 }" />
        <div
          v-for="(d, di) in DAYS"
          :key="d"
          class="tt__day"
          :style="{ gridRow: 1, gridColumn: di + 2 }"
        >{{ d }}</div>
        <template v-for="s in SLOTS" :key="s.key">
          <div class="tt__slot" :style="{ gridRow: s.key + 1, gridColumn: 1 }">
            <span class="tt__slot-label">第 {{ s.key }} 节</span>
            <span class="t-label tt__slot-time">{{ s.start }}–{{ s.end }}</span>
          </div>
          <template v-for="(day, di) in DAYS" :key="day + s.key">
            <!-- 连续同门课：只渲染「块首」这一个格子并跨行（span N），被跨越的格子不渲染 -->
            <div
              v-if="!isContinuation(di + 1, s.key)"
              class="tt__cell"
              :class="{ 'has-course': !!cellAt(di + 1, s.key), 'is-span': blockSpan(di + 1, s.key) > 1 }"
              :style="{
                gridRow: (s.key + 1) + ' / span ' + blockSpan(di + 1, s.key),
                gridColumn: di + 2,
              }"
              @click="onCell(di + 1, s.key)"
            >
              <template v-if="cellAt(di + 1, s.key)">
                <span
                  class="tt__course"
                  :style="{ '--course-color': cellAt(di + 1, s.key).course?.color || 'var(--primary)' }"
                >
                  {{ cellAt(di + 1, s.key).course?.name || '（课程已删除）' }}
                </span>
                <!-- 跨行块内空间充裕，顺带显示教室；单节块仍只放课名 -->
                <span
                  v-if="blockSpan(di + 1, s.key) > 1 && cellAt(di + 1, s.key).location"
                  class="t-label tt__cell-meta"
                >{{ cellAt(di + 1, s.key).location }}</span>
              </template>
              <!-- 仅编辑模式显示「＋」占位；查看模式保持干净 -->
              <span v-else-if="editing" class="tt__plus">＋</span>
            </div>
          </template>
        </template>
      </section>
    </template>

    <!-- 课程详情（查看模式点课块） -->
    <UiModal v-model="detailOpen" title="课程详情">
      <div v-if="detailItem" class="tt__detail">
        <div class="tt__detail-head">
          <span class="tt__detail-dot" :style="{ background: detailItem.course?.color || 'var(--primary)' }" />
          <span class="tt__detail-name">{{ detailItem.course?.name || '（课程已删除）' }}</span>
        </div>
        <div class="tt__detail-row">
          <span class="t-label">教师</span>
          <span>{{ detailItem.course?.teacher || '未填' }}</span>
        </div>
        <div class="tt__detail-row">
          <span class="t-label">教室</span>
          <span>{{ detailItem.location || detailItem.course?.location || '未填' }}</span>
        </div>
        <div v-if="detailPeriods.length" class="tt__detail-block">
          <span class="t-label">全部上课时段</span>
          <ul class="tt__detail-list">
            <li v-for="(p, i) in detailPeriods" :key="i">
              {{ DAY_LABEL[p.day] }} 第 {{ p.slotStart }}<template v-if="Number(p.slotEnd) > Number(p.slotStart)">-{{ p.slotEnd }}</template> 节 · {{ periodWeeksText(p) }}
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <UiButton variant="primary" @click="detailOpen = false">知道了</UiButton>
      </template>
    </UiModal>

    <!-- 排课（内联新建/沿用课程） -->
    <UiModal v-model="addOpen" :title="`排课 · ${DAY_LABEL[addDay] || ''}`" size="sm">
      <div class="tt__form">
        <label class="tt__field">
          <span class="t-label">课程名</span>
          <UiInput v-model="addForm.name" :maxlength="30" placeholder="输入课程名，已建课程会自动带出老师/教室" />
          <span v-if="matchedCourse" class="t-label tt__hint">将排到已有课程「{{ matchedCourse.name }}」</span>
          <span v-else-if="addForm.name.trim()" class="t-label tt__hint tt__hint-new">将新建课程「{{ addForm.name.trim() }}」</span>
        </label>
        <label class="tt__field">
          <span class="t-label">老师</span>
          <UiInput v-model="addForm.teacher" :maxlength="16" placeholder="如：王老师" optional />
        </label>
        <label class="tt__field">
          <span class="t-label">教室</span>
          <UiInput v-model="addForm.location" :maxlength="20" placeholder="如：教三 302" optional />
        </label>
        <label class="tt__field">
          <span class="t-label">节次（选起止，一次排连续多节）</span>
          <div class="tt__slot-range">
            <UiSelect v-model.number="addForm.slotStart" :options="slotOptions" />
            <span class="tt__range-sep">～</span>
            <UiSelect v-model.number="addForm.slotEnd" :options="slotOptions" />
            <span class="t-label tt__range-count">共 {{ slotCount }} 节</span>
          </div>
        </label>
        <label class="tt__field">
          <span class="t-label">上课周数</span>
          <UiSelect v-model="addForm.weeksType" :options="weekTypeOptions" />
          <UiInput
            v-if="addForm.weeksType === 'custom'"
            v-model="addForm.weeksRanges"
            :maxlength="40"
            placeholder="如 2-8, 12-16（留空=全学期）"
            optional
          />
        </label>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="addOpen = false">取消</UiButton>
        <UiButton variant="primary" :disabled="!addForm.name.trim()" @click="doAdd">添加</UiButton>
      </template>
    </UiModal>

    <!-- 学期设置 -->
    <UiModal v-model="termOpen" title="设置学期" size="sm">
      <div class="tt__form">
        <label class="tt__field">
          <span class="t-label">第一周周一的日期</span>
          <input v-model="termForm.startDate" type="date" class="tt__date-input" />
          <span class="t-label tt__hint">本周起算基准：这一周记为第 1 周</span>
        </label>
        <label class="tt__field">
          <span class="t-label">学期长度（周）</span>
          <input v-model.number="termForm.totalWeeks" type="number" min="1" max="60" class="tt__date-input" />
        </label>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="termOpen = false">取消</UiButton>
        <UiButton variant="primary" :disabled="!termForm.startDate" @click="saveTerm">保存</UiButton>
      </template>
    </UiModal>

    <!-- 考试安排（跳转独立页） -->
    <UiModal v-model="examOpen" title="考试安排" size="sm">
      <p class="t-body-2 tt__exam-tip">考试独立于课程表，按具体日期记录，会出现在课程表顶部和首页提醒里。</p>
      <div v-if="!exams.length" class="t-label tt__day-empty">还没有考试</div>
      <ul v-else class="tt__exam-list">
        <li v-for="e in exams" :key="e.id" class="tt__exam-row">
          <span class="tt__exam-name">{{ e.name }}</span>
          <span class="t-label">{{ e.date }} {{ e.startTime || '' }}</span>
        </li>
      </ul>
      <template #footer>
        <UiButton variant="ghost" @click="examOpen = false">关闭</UiButton>
        <UiButton variant="primary" @click="$router.push(ROUTES.exams)">管理考试</UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup>
/**
 * 课程表（/timetable）· 重做版
 * 桌面：星期 × 14 节；移动：按天列表。排课内联新建课程（名+老师+教室+节次+周数）。
 */
import { computed, reactive, ref } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiModal from '../ui/UiModal.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'
import {
  coursesRef, timetableRef, examsRef, termRef, DAYS, SLOTS, getCourse, addCourse,
  updateCourse, addSlot, removeSlot, slotAt, setTerm, weekInfo, upcomingExams,
} from '../stores/courseStore'
import { weeksBadge, toDateStr, daysUntil } from '../lib/termCalc.js'
import { slotsToPeriods, formToWeeks } from '../lib/schedulePeriods.js'
import { ElMessageBox } from '../ui/notify.js'
import { toast } from '../ui/toast.js'

const courses = coursesRef()
const table = timetableRef()
const exams = examsRef()
const term = termRef()

/** 编辑模式开关：默认只读展示，点「编辑」后才可排课/移除 */
const editing = ref(false)

const addOpen = ref(false)
const addDay = ref(1)
const addForm = reactive({ name: '', teacher: '', location: '', slotStart: 1, slotEnd: 1, weeksType: 'every', weeksRanges: '' })
/** 一次排课的节数（起止闭合区间） */
const slotCount = computed(() => Math.max(1, Number(addForm.slotEnd) - Number(addForm.slotStart) + 1))

const termOpen = ref(false)
const termForm = reactive({ startDate: '', totalWeeks: 20 })

const examOpen = ref(false)

const DAY_LABEL = computed(() => DAYS.reduce((m, d, i) => ({ ...m, [i + 1]: d }), {}))
const info = computed(() => weekInfo())
const todayStr = toDateStr(new Date())
const upcoming = computed(() => upcomingExams(3))

const slotOptions = SLOTS.map((s) => ({ label: `第 ${s.key} 节 ${s.start}-${s.end}`, value: s.key }))
const weekTypeOptions = [
  { label: '每周', value: 'every' },
  { label: '单周', value: 'odd' },
  { label: '双周', value: 'even' },
  { label: '自定义周', value: 'custom' },
]

/** 输入课程名时匹配已有课程（忽略大小写/空格） */
const matchedCourse = computed(() => {
  const n = addForm.name.trim().toLowerCase()
  if (!n) return null
  return courses.value.find((c) => String(c.name).toLowerCase() === n) || null
})

function cellAt(day, slot) {
  const s = slotAt(day, slot)
  return s ? { ...s, course: getCourse(s.courseId) } : null
}

/** 该天（周几）是否命中考试 —— 考试按具体日期提醒，不做格子级强关联 */
function daysText(dateStr) {
  const d = daysUntil(dateStr, todayStr)
  if (d === 0) return '（今天）'
  if (d === 1) return '（明天）'
  if (d > 1) return `（${d} 天后）`
  return ''
}

function openAdd(day, slot) {
  addDay.value = day
  addForm.name = ''
  addForm.teacher = ''
  addForm.location = ''
  addForm.slotStart = slot || 1
  addForm.slotEnd = slot || 1
  addForm.weeksType = 'every'
  addForm.weeksRanges = ''
  addOpen.value = true
}

/** 同一门课在相邻节次连排时：当前格是否为「延续格」（不单独渲染，由块首跨行覆盖） */
function isContinuation(day, slot) {
  const cur = cellAt(day, slot)
  if (!cur) return false
  const prev = cellAt(day, slot - 1)
  return !!prev && prev.courseId === cur.courseId && JSON.stringify(prev.weeks || {}) === JSON.stringify(cur.weeks || {})
}

/** 从该格起、同门课连续多少节（块首跨几行；非块首返回 1） */
function blockSpan(day, slot) {
  if (!cellAt(day, slot)) return 1
  let n = 1
  while (isContinuation(day, slot + n)) n += 1
  return n
}

function parseRanges(text) {
  return String(text || '')
    .split(/[,，、]/)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const m = seg.match(/^(\d{1,2})\s*[-~到]\s*(\d{1,2})$/)
      if (m) return [Number(m[1]), Number(m[2])]
      const single = seg.match(/^(\d{1,2})$/)
      return single ? [Number(single[1]), Number(single[1])] : null
    })
    .filter(Boolean)
}

function doAdd() {
  // 节次范围校验
  const start = Number(addForm.slotStart)
  const end = Number(addForm.slotEnd)
  if (end < start) {
    toast.error('结束节次不能早于起始节次')
    return
  }
  // 冲突校验：范围内任一节已排课则阻止，并明确指出是哪几节
  const conflicts = []
  for (let s = start; s <= end; s += 1) {
    if (cellAt(addDay.value, s)) conflicts.push(`第 ${s} 节`)
  }
  if (conflicts.length) {
    toast.error(`${DAY_LABEL.value[addDay.value]}的 ${conflicts.join('、')} 已有课，请调整节次范围`)
    return
  }

  let courseId = matchedCourse.value ? matchedCourse.value.id : null
  if (!courseId) {
    const c = addCourse({ name: addForm.name, teacher: addForm.teacher, location: addForm.location })
    if (!c) { toast.error('课程名不能为空'); return }
    courseId = c.id
  } else {
    // 沿用已有课程，但允许这次覆盖老师/教室
    const c = getCourse(courseId)
    const newTeacher = addForm.teacher.trim()
    const newLocation = addForm.location.trim()
    if ((newTeacher && newTeacher !== c.teacher) || (newLocation && newLocation !== c.location)) {
      updateCourse(courseId, { teacher: newTeacher || c.teacher, location: newLocation || c.location })
    }
  }
  const weeks = addForm.weeksType === 'custom'
    ? { type: 'custom', ranges: parseRanges(addForm.weeksRanges) }
    : { type: addForm.weeksType }
  // 一次排连续多节（课程/老师/教室/周次完全一致）
  let added = 0
  for (let s = start; s <= end; s += 1) {
    if (addSlot({ courseId, day: addDay.value, slot: s, location: addForm.location, weeks })) added += 1
  }
  addOpen.value = false
  toast.success(added > 1 ? `已排 ${added} 节` : '已排课')
}

/** 查看模式：点课块看详情；编辑模式：点空格排课、点课块移除 */
function onCell(day, slot) {
  const exist = cellAt(day, slot)
  if (!editing.value) {
    if (exist) openDetail(exist)
    return
  }
  if (exist) { removeItem(exist); return }
  openAdd(day, slot)
}

/* ---- 课程详情（查看模式） */
const detailOpen = ref(false)
const detailItem = ref(null)

function openDetail(item) {
  detailItem.value = item
  detailOpen.value = true
}

/** 该课程在课表的全部上课时段（连续节次自动合并展示） */
const detailPeriods = computed(() => {
  const it = detailItem.value
  if (!it) return []
  return slotsToPeriods(table.value.filter((s) => s.courseId === it.courseId))
})

function weeksText(weeks) {
  return weeksBadge(weeks) || '每周'
}

function periodWeeksText(p) {
  return weeksText(formToWeeks(p.weeksType, p.weeksRanges))
}

function removeItem(item) {
  ElMessageBox.confirm(`从课程表移除「${item.course?.name || '该课程'}」这一节？`, '移除排课', {
    confirmButtonText: '移除', cancelButtonText: '取消',
  })
    .then(() => { removeSlot(item.id); toast.success('已移除') })
    .catch(() => {})
}

function saveTerm() {
  setTerm({ startDate: termForm.startDate, totalWeeks: termForm.totalWeeks })
  termOpen.value = false
  toast.success('学期已设置')
}

function openTerm() {
  termForm.startDate = term.value.startDate || ''
  termForm.totalWeeks = term.value.totalWeeks || 20
  termOpen.value = true
}
</script>

<style scoped>
.tt {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: 1100px;
}
.tt__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.tt__head-ops {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.tt__exam-banner {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  background: var(--danger-soft, rgba(200, 60, 60, 0.12));
  border: 1px solid var(--danger, #c0392b);
}
.tt__exam-banner-title {
  font-size: var(--fs-body-2);
  color: var(--danger, #c0392b);
  font-weight: var(--fw-medium);
}
.tt__exam-pill {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--danger, #c0392b);
  color: #fff;
  font-size: var(--fs-label);
}
.tt__exam-pill b {
  font-weight: var(--fw-medium);
}
.tt__grid {
  display: grid;
  grid-template-columns: 96px repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(44px, auto); /* 行高统一，跨行块高度 = N × 行高 */
  padding: var(--sp-4);
  font-size: var(--fs-body-2);
}
.tt__corner {
  border-bottom: var(--border-divider);
}
.tt__day {
  text-align: center;
  padding-bottom: var(--sp-2);
  border-bottom: var(--border-divider);
  color: var(--text-tertiary);
}
.tt__slot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: var(--sp-1) var(--sp-2) var(--sp-1) 0;
  border-bottom: var(--border-divider-soft);
  color: var(--text-quaternary);
}
.tt__slot-label {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.tt__slot-time {
  color: var(--text-muted);
  font-size: var(--fs-label);
}
.tt__cell {
  min-height: 44px;
  padding: 4px 6px;
  border-bottom: var(--border-divider-soft);
  border-left: var(--border-divider-soft);
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--dur) var(--ease);
}
.tt__cell:hover {
  background: var(--surface-hover);
}
.tt__cell.has-course {
  align-items: stretch;
  justify-content: center; /* 有课时内容垂直居中（跨行块里不再贴顶） */
}
.tt__cell.is-exam {
  background: var(--danger-soft, rgba(200, 60, 60, 0.08));
}
.tt__plus {
  color: var(--text-disabled);
}
.tt__course {
  display: block;
  padding: 3px 7px;
  border-left: 3px solid var(--course-color, var(--primary));
  border-radius: 5px;
  /* 课程色淡彩背景（与当前主题表面混合 → 深浅主题都柔和）；不支持 color-mix 时退化为纯表面色 */
  background: var(--surface-unit);
  background: color-mix(in srgb, var(--course-color, var(--primary)) 22%, var(--surface-unit));
  color: var(--text-secondary);
  font-size: var(--fs-label);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tt__cell-meta {
  color: var(--text-muted);
  font-size: var(--fs-label);
}
/* 跨行块（连续节次合并）：整块一个色块，圆角统一、色条贯穿、内容垂直居中 */
.tt__cell.is-span {
  position: relative;
  padding: 4px 6px;
}
.tt__cell.is-span .tt__course {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 6px 8px;
  white-space: normal;
  overflow: hidden;
  text-overflow: clip;
  line-height: 1.3;
}
.tt__cell.is-span .tt__cell-meta {
  position: absolute;
  bottom: 4px;
  left: 12px;
  right: 6px;
  text-align: center;
  pointer-events: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tt__slot-range {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.tt__slot-range > * {
  flex: 1;
  min-width: 0;
}
.tt__range-sep {
  flex: 0 0 auto;
  color: var(--text-tertiary);
}
.tt__range-count {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  white-space: nowrap;
}
/* 移动端：网格压缩 —— 7 列一屏放下（节次列收窄、字号行高降低、课名允许折行） */
@media (max-width: 900px) {
  .tt__grid {
    grid-template-columns: 46px repeat(7, minmax(0, 1fr));
    grid-auto-rows: minmax(34px, auto);
    padding: var(--sp-2);
    font-size: 11px;
  }
  .tt__day {
    font-size: 11px;
    padding-bottom: 6px;
  }
  .tt__slot {
    padding: 2px 2px 2px 0;
  }
  .tt__slot-label {
    font-size: 10px;
    white-space: nowrap;
  }
  .tt__slot-time {
    display: block;
    font-size: 9px;
    white-space: nowrap;
  }
  .tt__cell {
    min-height: 34px;
    padding: 2px;
    gap: 0;
  }
  .tt__course {
    display: -webkit-box;
    padding: 2px 4px;
    border-left-width: 2px;
    border-radius: 4px;
    font-size: 10px;
    line-height: 1.25;
    white-space: normal;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
  .tt__cell-meta {
    display: none; /* 单节块太小放不下教室；跨行块内单独放开（见下） */
  }
  .tt__cell.is-span .tt__cell-meta {
    display: block;
    font-size: 9px;
  }
  .tt__cell.is-span {
    padding: 2px; /* 移动端列窄，内外 padding 收紧，保证中文课名一行能放 2~3 字 */
  }
  .tt__cell.is-span .tt__course {
    font-size: 10px;
    padding: 4px 3px;
  }
  .tt__cell.is-span .tt__cell-meta {
    left: 5px;
    right: 5px;
  }
  .tt__plus {
    font-size: 12px;
  }
}
.tt__form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.tt__field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.tt__hint {
  color: var(--text-muted);
}
.tt__hint-new {
  color: var(--primary-text);
}
.tt__date-input {
  padding: 8px var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body-2);
}
.tt__date-input:focus {
  outline: none;
  border-color: var(--primary-line);
}
.tt__exam-tip {
  margin: 0 0 var(--sp-3);
  line-height: var(--lh-body);
}
.tt__exam-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.tt__exam-row {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-2) 0;
  border-top: var(--border-divider-soft);
}
.tt__exam-name {
  color: var(--text-secondary);
}
/* 编辑模式：课块边框转虚线，提示可增删 */
.tt__grid.is-editing .tt__course {
  border-style: dashed;
}
/* 课程详情弹窗（查看模式点课块） */
.tt__detail {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.tt__detail-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.tt__detail-dot {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.tt__detail-name {
  font-size: var(--fs-h3);
  color: var(--text-primary);
}
.tt__detail-row {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
}
.tt__detail-row > .t-label {
  flex: 0 0 58px;
  color: var(--text-muted);
}
.tt__detail-block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.tt__detail-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text-secondary);
}

/* 我的课程横条（原型 B9） */
.tt__course-entry {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  padding: var(--sp-3) var(--sp-4);
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease);
}
.tt__course-entry:hover {
  border-color: var(--border-strong);
}
.tt__course-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tt__course-title {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.tt__course-go {
  flex: none;
  font-size: var(--fs-body-2);
  color: var(--primary-text);
  white-space: nowrap;
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .tt {
    max-width: none;
  }
}
</style>
