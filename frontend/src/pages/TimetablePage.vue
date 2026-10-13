<template>
  <div class="zy-container zy-page tt">
    <header class="tt__head">
      <div class="tt__head-left">
        <UiButton variant="soft" size="sm" class="zy-back" @click="goBackSmart($router)" icon="left">返回</UiButton>
        <h1 class="t-h1">课程表</h1>
        <!-- 周导航器：切换查看周，单双周课都能看 -->
        <div v-if="info.configured" class="tt__weeknav">
          <button type="button" class="tt__wnav-btn" :disabled="viewWeekNum <= 1" aria-label="上一周" @click="stepWeek(-1)">‹</button>
          <span class="tt__wnav-label">第 <b>{{ viewWeekNum }}</b> 周 / {{ info.totalWeeks }}</span>
          <button type="button" class="tt__wnav-btn" :disabled="viewWeekNum >= info.totalWeeks" aria-label="下一周" @click="stepWeek(1)">›</button>
          <span class="tt__wnav-badge">{{ viewWeekNum % 2 === 1 ? '单周' : '双周' }}</span>
          <button v-if="!isCurrentView" type="button" class="tt__wnav-back" @click="viewWeek = null">回到本周</button>
        </div>
        <span v-else class="t-body-2 tt__weeknav-hint">先设置学期，才能按周排课</span>
      </div>
      <div class="tt__head-ops">
        <UiButton variant="primary" size="sm" icon="pencil" @click="editing = !editing">
          {{ editing ? '完成' : '编辑' }}
        </UiButton>
        <UiButton variant="secondary" size="sm" icon="bell" @click="examOpen = true">考试安排</UiButton>
        <UiButton variant="secondary" size="sm" icon="calendar" @click="openTerm">设置学期</UiButton>
      </div>
    </header>

    <!-- 我的课程窄条（原型 B9）：我的课程只从课程表页进 -->
    <button type="button" class="tt__course-entry surface-standard" @click="$router.push(ROUTES.course)">
      <span class="tt__course-icon"><UiIcon name="book" size="15" /></span>
      <span class="tt__course-title">我的课程</span>
      <span class="t-label tt__course-meta">{{ coursesRef().length }} 门课 · 已排 {{ table.length }} 节</span>
      <span class="tt__course-go">
        进入
        <UiIcon name="arrowRight" size="14" class="tt__course-arrow" />
      </span>
    </button>

    <!-- 考试提醒条（轻量白卡） -->
    <div v-if="upcoming.length" class="tt__exam-banner">
      <UiIcon name="bell" size="14" class="tt__exam-bell" />
      <span class="tt__exam-banner-title">近期考试</span>
      <span v-for="e in upcoming" :key="e.id" class="tt__exam-item">
        <span class="tt__exam-item-name">{{ e.name }}</span>
        <span class="t-label tt__exam-item-date">{{ shortDate(e.date) }}</span>
        <span class="tt__exam-badge" :class="countdownClass(e)">{{ examCountdown(e) }}</span>
      </span>
      <button type="button" class="tt__exam-all" @click="$router.push(ROUTES.exams)">全部 ›</button>
    </div>

    <!-- 新手引导 · 三步开课（进度条式，全部完成后自动隐藏） -->
    <nav v-if="onboarding.active" class="tt__onboard surface-standard" aria-label="开课引导">
      <ol class="tt__steps">
        <li
          v-for="s in onboarding.steps"
          :key="s.key"
          class="tt__step"
          :class="{ 'is-done': s.done, 'is-current': s.current }"
        >
          <button type="button" class="tt__step-btn" :disabled="s.done" @click="s.click && s.click()">
            <span class="tt__step-dot">{{ s.done ? '✓' : s.index }}</span>
            <span class="tt__step-main">
              <span class="tt__step-title">{{ s.title }}</span>
              <span class="tt__step-desc">{{ s.desc }}</span>
            </span>
            <span class="tt__step-go">{{ s.done ? '已完成' : (s.current ? '去完成 →' : '待完成') }}</span>
          </button>
        </li>
      </ol>
    </nav>
    <template v-if="info.configured">
      <!-- 星期 × 节次网格（桌面与移动共用；移动端由 CSS 压缩列宽、字号与行高，7 列一屏放下） -->
      <section class="tt__grid surface-standard" :class="{ 'is-editing': editing }">
        <div class="tt__corner" :style="{ gridRow: 1, gridColumn: 1 }" />
        <div
          v-for="(d, di) in DAYS"
          :key="d"
          class="tt__day"
          :class="{ 'is-today': isCurrentView && di + 1 === todayDow }"
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
                  <span class="tt__course-name">{{ cellAt(di + 1, s.key).course?.name || '（课程已删除）' }}</span>
                  <span
                    v-if="cellAt(di + 1, s.key).course?.teacher || cellAt(di + 1, s.key).location"
                    class="tt__course-sub"
                  >
                    <template v-if="cellAt(di + 1, s.key).course?.teacher">{{ cellAt(di + 1, s.key).course?.teacher }}</template>
                    <template v-if="cellAt(di + 1, s.key).course?.teacher && cellAt(di + 1, s.key).location"> · </template>
                    <template v-if="cellAt(di + 1, s.key).location">{{ cellAt(di + 1, s.key).location }}</template>
                  </span>
                </span>
              </template>
              <!-- 编辑模式或还没有课程时显示「＋」占位，把隐藏的点击交互显性化 -->
              <span v-else-if="editing || !courses.length" class="tt__plus">＋</span>
            </div>
          </template>
        </template>
      </section>
      <p v-if="!courses.length" class="tt__grid-hint">
        点击任意空格即可排课 · 已建课程会自动带出老师与教室
      </p>
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
          <span class="t-label">上课时段（周一至周日）</span>
          <div class="tt__timeline">
            <div v-for="d in detailTimeline" :key="d.day" class="tt__tl-col">
              <div class="tt__tl-day">{{ DAY_LABEL[d.day] }}</div>
              <div v-if="d.items.length" class="tt__tl-items">
                <div v-for="(p, idx) in d.items" :key="idx" class="tt__tl-block">
                  <span class="tt__tl-slot">{{ p.slotStart }}<template v-if="Number(p.slotEnd) > Number(p.slotStart)">-{{ p.slotEnd }}</template> 节</span>
                  <span class="tt__tl-weeks">{{ periodWeeksText(p) }}</span>
                </div>
              </div>
              <div v-else class="tt__tl-empty">—</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <UiButton variant="primary" @click="detailOpen = false">知道了</UiButton>
      </template>
    </UiModal>

    <!-- 排课（内联新建/沿用课程；支持一门课一次排多个时段 + 实时预览） -->
    <UiModal v-model="addOpen" title="排课" size="lg" panel-class="tt-add-panel">
      <div class="tt__add">
        <!-- 左：表单 -->
        <div class="tt__add-main">
          <!-- 排课汇总条（色点 + 时间摘要） -->
          <div class="tt__summary">
            <span class="tt__summary-dot" :style="{ background: summaryColor }" />
            <span class="tt__summary-text">
              将排入 <b>{{ addForm.name.trim() || '未命名课程' }}</b>
            </span>
            <span class="tt__summary-meta">{{ periodsSummary }}</span>
          </div>

          <label class="tt__field">
            <span class="t-label">课程名</span>
            <UiInput
              v-model="addForm.name"
              :maxlength="30"
              placeholder="输入课程名，已建课程会自动带出老师/教室"
              @focus="suggestionOpen = true"
              @input="suggestionOpen = true"
              @blur="suggestionOpen = false"
            />
            <!-- 已有课程联想下拉 -->
            <div v-if="suggestionOpen && nameSuggestions.length" class="tt__suggest">
              <button
                v-for="c in nameSuggestions"
                :key="c.id"
                type="button"
                class="tt__suggest-item"
                @mousedown.prevent="selectCourse(c)"
              >
                <span class="tt__suggest-dot" :style="{ background: c.color }" />
                <span class="tt__suggest-name">{{ c.name }}</span>
                <span v-if="c.teacher" class="tt__suggest-teacher">{{ c.teacher }}</span>
              </button>
            </div>
            <span v-if="matchedCourse" class="t-label tt__hint">将排到已有课程「{{ matchedCourse.name }}」</span>
            <span v-else-if="addForm.name.trim()" class="t-label tt__hint tt__hint-new">将新建课程「{{ addForm.name.trim() }}」</span>
          </label>
          <div class="tt__row">
            <label class="tt__field">
              <span class="t-label">老师</span>
              <UiInput v-model="addForm.teacher" :maxlength="16" placeholder="如：王老师" optional />
            </label>
            <label class="tt__field">
              <span class="t-label">教室</span>
              <UiInput v-model="addForm.location" :maxlength="20" placeholder="如：教三 302" optional />
            </label>
          </div>

          <!-- 时段卡片（标题自动生成，冲突即时标红） -->
          <div
            v-for="(p, i) in periods"
            :key="i"
            class="tt__period-card"
            :class="{ 'is-conflict': !!periodConflicts[i] }"
          >
            <div class="tt__period-head">
              <span class="tt__period-title">
                <UiIcon name="clock" size="12" class="tt__period-title-icon" />
                时段 {{ i + 1 }} · {{ DAY_LABEL[p.day] }} {{ slotLabel(p) }} · {{ weeksShort(p) }}
              </span>
              <span class="tt__period-ops">
                <button class="tt__period-copy" type="button" title="复制该时段" @click="duplicatePeriod(i)">复制</button>
                <button
                  v-if="periods.length > 1"
                  class="tt__period-del"
                  type="button"
                  title="删除该时段"
                  @click="removePeriod(i)"
                >×</button>
              </span>
            </div>
            <div class="tt__period-row">
              <UiSelect v-model.number="p.day" :options="dayOptions" aria-label="星期" />
              <UiSelect v-model.number="p.slotStart" :options="slotOptions" aria-label="起始节次" />
              <span class="tt__range-sep">～</span>
              <UiSelect v-model.number="p.slotEnd" :options="slotOptions" aria-label="结束节次" />
              <span class="t-label tt__range-count">{{ slotCountOf(p) }} 节</span>
            </div>
            <div class="t-label tt__period-time">{{ slotTimeText(p) }}</div>
            <div class="tt__period-row">
              <UiSelect v-model="p.weeksType" :options="weekTypeOptions" aria-label="周次类型" />
              <WeekPicker
                v-if="p.weeksType === 'custom'"
                v-model="p.weeksRanges"
                :total-weeks="termTotalWeeks"
              />
            </div>
            <div v-if="periodConflicts[i]" class="tt__conflict">
              <UiIcon name="info" size="12" class="tt__conflict-icon" />
              <span>{{ periodConflicts[i] }}</span>
            </div>
          </div>
          <UiButton variant="ghost" size="sm" icon="plus" @click="addPeriod">再加一个时段</UiButton>
        </div>

        <!-- 右：课表实时预览（迷你时间块） -->
        <div class="tt__add-preview">
          <div class="tt__preview-head">
            <span class="tt__preview-title">实时预览</span>
            <span class="t-label">第 {{ viewWeekNum }} 周</span>
          </div>
          <div class="tt__preview-grid">
            <div v-for="d in previewByDay" :key="d.day" class="tt__preview-col">
              <div class="tt__preview-day">{{ DAY_LABEL[d.day] }}</div>
              <div class="tt__preview-stack">
                <div
                  v-for="(it, idx) in d.items"
                  :key="idx"
                  class="tt__preview-block"
                  :class="{ 'is-mine': it.mine }"
                  :style="{ '--pc': it.color, height: (it.slotEnd - it.slot + 1) * 11 + 'px' }"
                  :title="it.name + ' ' + it.slot + (it.slotEnd > it.slot ? '-' + it.slotEnd : '') + '节'"
                />
              </div>
            </div>
          </div>
          <div class="tt__preview-legend">
            <span class="tt__legend-dot is-mine" />
            <span class="t-label">本次排入</span>
            <span class="tt__legend-dot" />
            <span class="t-label">已有课程</span>
          </div>
        </div>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="addOpen = false">取消</UiButton>
        <UiButton variant="primary" :disabled="!addForm.name.trim()" @click="doAdd">添加 · 共 {{ totalSlots }} 节</UiButton>
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
        <!-- 学期进度预览 -->
        <div class="tt__term-progress">
          <div class="tt__term-progress-head">
            <span class="t-label">学期进度预览</span>
            <span class="t-label">{{ termPreviewText }}</span>
          </div>
          <div class="tt__term-progress-bar">
            <div class="tt__term-progress-fill" :style="{ width: termPreviewPct + '%' }"></div>
          </div>
        </div>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="termOpen = false">取消</UiButton>
        <UiButton variant="primary" :disabled="!termForm.startDate" @click="saveTerm">保存</UiButton>
      </template>
    </UiModal>

    <!-- 考试安排（倒计时卡片） -->
    <UiModal v-model="examOpen" title="考试安排" size="sm">
      <p class="t-body-2 tt__exam-tip">考试独立于课程表，按具体日期记录，会出现在课程表顶部和首页提醒里。</p>
      <div v-if="!exams.length" class="t-label tt__day-empty">还没有考试</div>
      <ul v-else class="tt__exam-list">
        <li v-for="e in sortedExams" :key="e.id" class="tt__exam-card" :class="countdownClass(e)">
          <span class="tt__exam-dot" :style="{ background: examColor(e) }" />
          <span class="tt__exam-main">
            <span class="tt__exam-name">{{ e.name }}</span>
            <span class="t-label">{{ e.date }}{{ e.startTime ? ' ' + e.startTime : '' }}</span>
          </span>
          <span class="tt__exam-countdown">{{ examCountdown(e) }}</span>
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
import UiIcon from '../ui/UiIcon.vue'
import { ROUTES } from '../lib/routes.js'
import { goBackSmart } from '../lib/nav.js'
import {
  coursesRef, timetableRef, examsRef, termRef, DAYS, SLOTS, getCourse, addCourse,
  updateCourse, addSlot, removeSlot, setTerm, weekInfo, upcomingExams,
} from '../stores/courseStore'
import { weeksBadge, toDateStr, daysUntil } from '../lib/termCalc.js'
import { slotsToPeriods, formToWeeks, weeksOverlap, weeksLabel, weekActive, parseRanges, formatRanges } from '../lib/schedulePeriods.js'
import WeekPicker from '../ui/WeekPicker.vue'
import { ElMessageBox } from '../ui/notify.js'
import { toast } from '../ui/toast.js'

const courses = coursesRef()
const table = timetableRef()
const exams = examsRef()
const term = termRef()

/** 编辑模式开关：默认只读展示，点「编辑」后才可排课/移除 */
const editing = ref(false)

const addOpen = ref(false)
/** 课程级字段（一门课一份） */
const addForm = reactive({ name: '', teacher: '', location: '' })
/** 时段级字段（一门课可多条）：星期 + 节次起止 + 周次 */
const periods = ref([{ day: 1, slotStart: 1, slotEnd: 1, weeksType: 'every', weeksRanges: '' }])

/** 每条时段的节数（起止闭合区间） */
function slotCountOf(p) {
  return Math.max(1, Number(p.slotEnd) - Number(p.slotStart) + 1)
}

function addPeriod() {
  const last = periods.value[periods.value.length - 1]
  periods.value.push({ day: last ? last.day : 1, slotStart: 1, slotEnd: 1, weeksType: 'every', weeksRanges: '' })
}

function removePeriod(i) {
  periods.value.splice(i, 1)
}

/** 复制时段：在 i 之后插入一份同配置的新时段 */
function duplicatePeriod(i) {
  periods.value.splice(i + 1, 0, { ...periods.value[i] })
}

const dayOptions = DAYS.map((d, i) => ({ label: d, value: i + 1 }))
const termTotalWeeks = computed(() => Number(term.value?.totalWeeks) || 20)

/** 汇总条：所有时段总节数 */
const totalSlots = computed(() => periods.value.reduce((n, p) => n + slotCountOf(p), 0))

/** 周次简写（时段卡片标题用） */
function weeksShort(p) {
  if (p.weeksType === 'odd') return '单周'
  if (p.weeksType === 'even') return '双周'
  if (p.weeksType === 'custom') {
    const r = parseRanges(p.weeksRanges)
    return r.length ? `第 ${formatRanges(r)} 周` : '每周'
  }
  return '每周'
}

/** 每个时段的冲突信息（即时标红），无冲突为 null */
const periodConflicts = computed(() => periods.value.map((p) => {
  const weeks = formToWeeks(p.weeksType, p.weeksRanges)
  const conf = []
  for (let s = Number(p.slotStart); s <= Number(p.slotEnd); s += 1) {
    const exist = conflictAt(Number(p.day), s, weeks)
    if (exist) {
      conf.push(`${DAY_LABEL.value[Number(p.day)]}第 ${s} 节「${exist.course?.name || '已删课程'}」`)
    }
  }
  if (!conf.length) return null
  return `与 ${conf.slice(0, 2).join('、')}${conf.length > 2 ? ' 等' : ''} 冲突`
}))

/** 实时预览：已有课（视图周命中）+ 本次排入，按天分组，同课连节合并 */
const previewByDay = computed(() => {
  const wk = viewWeekNum.value
  const days = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, items: [] }))
  for (const s of table.value) {
    if (!weekActive(s.weeks, wk)) continue
    const d = days[Number(s.day) - 1]
    if (!d) continue
    const c = getCourse(s.courseId)
    d.items.push({ name: c?.name || '?', color: c?.color || 'var(--primary)', mine: false, slot: Number(s.slot) })
  }
  for (const p of periods.value) {
    const d = days[Number(p.day) - 1]
    if (!d) continue
    const weeks = formToWeeks(p.weeksType, p.weeksRanges)
    for (let s = Number(p.slotStart); s <= Number(p.slotEnd); s += 1) {
      if (conflictAt(Number(p.day), s, weeks)) continue
      d.items.push({ name: addForm.name.trim() || '新课', color: 'var(--primary)', mine: true, slot: s })
    }
  }
  for (const d of days) {
    d.items.sort((a, b) => a.slot - b.slot)
    const merged = []
    for (const it of d.items) {
      const last = merged[merged.length - 1]
      if (last && last.name === it.name && last.mine === it.mine && it.slot === last.slotEnd + 1) {
        last.slotEnd = it.slot
      } else {
        merged.push({ ...it, slotEnd: it.slot })
      }
    }
    d.items = merged
  }
  return days
})

const termOpen = ref(false)
const termForm = reactive({ startDate: '', totalWeeks: 20 })

const examOpen = ref(false)

const DAY_LABEL = computed(() => DAYS.reduce((m, d, i) => ({ ...m, [i + 1]: d }), {}))
const info = computed(() => weekInfo())
const todayStr = toDateStr(new Date())
const upcoming = computed(() => upcomingExams(3))

/** 学期进度预览（学期设置弹窗） */
const termPreviewPct = computed(() => {
  const total = Number(termForm.totalWeeks) || 20
  const wk = info.value.week || 0
  return Math.min(100, Math.max(0, Math.round((wk / total) * 100)))
})
const termPreviewText = computed(() => {
  const wk = info.value.week || 0
  return wk ? `当前第 ${wk} 周 · 共 ${termForm.totalWeeks || 20} 周` : `共 ${termForm.totalWeeks || 20} 周`
})

/** 考试（倒计时卡片）：按日期升序 */
const sortedExams = computed(() => [...exams.value].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)))
function examColor(e) {
  const c = e.courseId ? getCourse(e.courseId) : null
  return c?.color || 'var(--primary)'
}
function examCountdown(e) {
  const d = daysUntil(e.date, todayStr)
  if (d < 0) return `已结束 ${-d} 天`
  if (d === 0) return '今天'
  if (d === 1) return '明天'
  return `${d} 天后`
}
function countdownClass(e) {
  const d = daysUntil(e.date, todayStr)
  if (d < 0) return 'is-past'
  if (d <= 7) return 'is-urgent'
  return ''
}

/** 新手引导三步：设置学期 → 排第一节课 → 记一次考试（三页统一口径） */
const onboarding = computed(() => {
  const s1 = !!info.value.configured
  const s2 = courses.value.length > 0
  const s3 = exams.value.length > 0
  const currentKey = !s1 ? 'term' : (!s2 ? 'course' : (!s3 ? 'exam' : null))
  const steps = [
    { key: 'term', index: 1, title: '设置学期', desc: '填第一周周一的日期和学期长度', done: s1, click: openTerm },
    { key: 'course', index: 2, title: '排第一节课', desc: '点击下方网格任意空格，填课名即可', done: s2, click: () => stepGoCourse() },
    { key: 'exam', index: 3, title: '记一次考试', desc: '期末 / 机考按日期录入，自动进首页提醒', done: s3, click: () => { examOpen.value = true } },
  ].map((s) => ({ ...s, current: s.key === currentKey }))
  return { active: !(s1 && s2 && s3), steps }
})

/** 步骤 2 的跳转：学期已配置时进入编辑模式聚焦网格，否则先引导设置学期 */
function stepGoCourse() {
  if (info.value.configured) {
    editing.value = true
    toast.info('已进入编辑模式：点击网格空格排课')
  } else {
    openTerm()
  }
}

const slotOptions = SLOTS.map((s) => ({ label: `第 ${s.key} 节`, value: s.key }))
const weekTypeOptions = [
  { label: '每周', value: 'every' },
  { label: '单周', value: 'odd' },
  { label: '双周', value: 'even' },
  { label: '自定义周', value: 'custom' },
]

/** 输入课程名时精确匹配已有课程（忽略大小写/空格） */
const matchedCourse = computed(() => {
  const n = addForm.name.trim().toLowerCase()
  if (!n) return null
  return courses.value.find((c) => String(c.name).toLowerCase() === n) || null
})

/** 联想下拉：模糊匹配已有课程（输入即联想，最多 5 条） */
const nameSuggestions = computed(() => {
  const n = addForm.name.trim().toLowerCase()
  if (!n) return []
  return courses.value
    .filter((c) => String(c.name).toLowerCase().includes(n))
    .slice(0, 5)
})
const suggestionOpen = ref(false)

/** 选中联想课程：带出老师/教室（颜色经 matchedCourse 取） */
function selectCourse(c) {
  addForm.name = c.name
  addForm.teacher = c.teacher || ''
  addForm.location = c.location || ''
  suggestionOpen.value = false
}

/** 汇总条颜色：命中已有课程用其色，否则默认紫 */
const summaryColor = computed(() => matchedCourse.value?.color || 'var(--primary)')

/** 汇总条时间摘要：周一 3-5 节 · 周五 6-8 节 */
const periodsSummary = computed(() => {
  const parts = periods.value.map((p) => `${DAY_LABEL.value[Number(p.day)]} ${slotLabel(p)}`)
  return `${parts.join(' · ')} · ${periods.value.length} 时段 · ${totalSlots.value} 节`
})

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

/* ---- 视图周（周导航器）：null = 跟随本周 ---- */
const viewWeek = ref(null)
const viewWeekNum = computed(() => viewWeek.value || info.value.week || 1)
const isCurrentView = computed(() => !viewWeek.value || viewWeek.value === info.value.week)
function stepWeek(delta) {
  const total = info.value.totalWeeks || 20
  viewWeek.value = Math.min(total, Math.max(1, viewWeekNum.value + delta))
}
const todayDow = computed(() => {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
})

/** 视图周命中的格子（周导航器驱动；单双周按 viewWeek 过滤） */
function cellAt(day, slot) {
  const wk = viewWeekNum.value
  const s = table.value.find(
    (x) => Number(x.day) === Number(day) && Number(x.slot) === Number(slot) && weekActive(x.weeks, wk),
  )
  return s ? { ...s, course: getCourse(s.courseId) } : null
}

/** 冲突判定：与该格任意周次的已有排课比较（不受视图周影响） */
function conflictAt(day, slot, weeks) {
  return table.value.find(
    (x) => Number(x.day) === Number(day) && Number(x.slot) === Number(slot)
      && weeksOverlap(weeks, x.weeks || { type: 'every' }, termTotalWeeks.value),
  )
}

function shortDate(dateStr) {
  return String(dateStr || '').slice(5)
}

function openAdd(day, slot) {
  addForm.name = ''
  addForm.teacher = ''
  addForm.location = ''
  periods.value = [{ day, slotStart: slot || 1, slotEnd: slot || 1, weeksType: 'every', weeksRanges: '' }]
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

function doAdd() {
  // 时段校验
  const cleaned = []
  for (const p of periods.value) {
    const start = Number(p.slotStart)
    const end = Number(p.slotEnd)
    if (end < start) {
      toast.error('时段的结束节次不能早于起始节次')
      return
    }
    const weeks = formToWeeks(p.weeksType, p.weeksRanges)
    if (p.weeksType === 'custom' && !weeks.ranges.length) {
      toast.error('自定义周次不能为空，可写 2,5,6 或点选周次格子')
      return
    }
    cleaned.push({ day: Number(p.day), start, end, weeks })
  }
  // 冲突检查（升级）：与已有排课只在「周次有交集」时冲突（单双周可共格）；
  // 本批次内部同格同周次也不允许
  const conflicts = []
  const planned = []
  for (const c of cleaned) {
    for (let s = c.start; s <= c.end; s += 1) {
      const same = planned.find((q) => q.day === c.day && q.slot === s && weeksOverlap(q.weeks, c.weeks, termTotalWeeks.value))
      if (same) {
        conflicts.push(`${DAY_LABEL.value[c.day]}第 ${s} 节（本次填写重复）`)
        continue
      }
      planned.push({ day: c.day, slot: s, weeks: c.weeks })
      const exist = conflictAt(c.day, s, c.weeks)
      if (exist) {
        const cname = exist.course?.name ? `「${exist.course.name}」` : ''
        conflicts.push(`${DAY_LABEL.value[c.day]}第 ${s} 节${cname}（${weeksLabel(exist.weeks)}）`)
      }
    }
  }
  if (conflicts.length) {
    toast.error(`这些时段已有课：${conflicts.slice(0, 4).join('、')}${conflicts.length > 4 ? ' 等' : ''}`)
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
  // 逐时段展开写格（连续节次渲染层自动合并成大块）
  let added = 0
  for (const c of cleaned) {
    for (let s = c.start; s <= c.end; s += 1) {
      if (addSlot({ courseId, day: c.day, slot: s, location: addForm.location, weeks: c.weeks })) added += 1
    }
  }
  addOpen.value = false
  toast.success(added > 1 ? `已排 ${added} 节（${cleaned.length} 个时段）` : '已排课')
}

/** 查看模式：点课块看详情；编辑模式：点空格排课、点课块移除 */
function onCell(day, slot) {
  const exist = cellAt(day, slot)
  if (!editing.value) {
    if (exist) { openDetail(exist); return }
    // 还没有课程时，空格在查看模式也直接可点 —— 引导阶段不要求先开编辑
    if (!courses.value.length) openAdd(day, slot)
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

/** 课程详情时间轴：detailPeriods 按星期分组 */
const detailTimeline = computed(() => {
  const days = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, items: [] }))
  for (const p of detailPeriods.value) {
    const d = days[Number(p.day) - 1]
    if (d) d.items.push(p)
  }
  return days
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
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  flex-wrap: wrap;
}
.tt__head-left {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  min-width: 0;
}
/* 周导航器 */
.tt__weeknav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 5px;
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
}
.tt__wnav-btn {
  border: 0;
  background: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--primary-text);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--dur) var(--ease);
}
.tt__wnav-btn:not(:disabled):hover {
  background: var(--primary-soft-1);
}
.tt__wnav-btn:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
}
.tt__wnav-label {
  padding: 0 4px;
  font-size: var(--fs-body-2);
  color: var(--text-primary);
  white-space: nowrap;
}
.tt__wnav-label b {
  font-weight: var(--fw-medium);
  color: var(--primary-text);
}
.tt__wnav-badge {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--primary-soft-1);
  color: var(--primary-text);
  font-size: var(--fs-label);
  white-space: nowrap;
}
.tt__wnav-back {
  border: 0;
  background: none;
  padding: 2px 8px;
  color: var(--primary-text);
  font-size: var(--fs-label);
  cursor: pointer;
  white-space: nowrap;
}
.tt__wnav-back:hover {
  text-decoration: underline;
}
.tt__weeknav-hint {
  color: var(--text-muted);
}
.tt__head-ops {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
/* 新手引导 · 三步开课（进度条式清单） */
.tt__steps {
  list-style: none;
  margin: 0;
  padding: var(--sp-2) var(--sp-3);
  display: flex;
  align-items: stretch;
  gap: 0;
}
.tt__step {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
.tt__step + .tt__step::before {
  content: '';
  flex: none;
  width: 28px;
  height: 2px;
  margin: 0 var(--sp-2);
  background: var(--surface-recess);
  border-radius: 1px;
}
.tt__step.is-done + .tt__step::before {
  background: var(--primary-soft-2);
}
.tt__step-btn {
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
.tt__step-btn:not(:disabled):hover {
  background: var(--surface-hover);
}
.tt__step.is-current .tt__step-btn {
  border-color: var(--primary-line);
  background: var(--primary-soft-1);
}
.tt__step-dot {
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
.tt__step.is-current .tt__step-dot {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.tt__step.is-done .tt__step-dot {
  background: var(--primary-soft-1);
  border-color: var(--primary-line);
  color: var(--primary-text);
}
.tt__step-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.tt__step-title {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.tt__step.is-done .tt__step-title {
  color: var(--text-secondary);
}
.tt__step-desc {
  font-size: var(--fs-label);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tt__step-go {
  flex: none;
  font-size: var(--fs-label);
  color: var(--text-muted);
  white-space: nowrap;
}
.tt__step.is-current .tt__step-go {
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}
.tt__step.is-done .tt__step-go {
  color: var(--text-disabled);
}
/* 空网格引导提示 */
.tt__grid-hint {
  margin: 0;
  text-align: center;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
@media (max-width: 900px) {
  .tt__steps {
    flex-direction: column;
    gap: var(--sp-1);
    padding: var(--sp-2);
  }
  .tt__step + .tt__step::before {
    display: none;
  }
  .tt__step + .tt__step {
    border-top: var(--border-divider-soft);
  }
  .tt__step-btn {
    padding: var(--sp-2);
  }
  .tt__step-desc {
    white-space: normal;
  }
}
/* 考试提醒条：轻量白卡（红只留左侧竖条与徽标） */
.tt__exam-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  padding: var(--sp-2) var(--sp-4);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-unit);
  overflow: hidden;
}
.tt__exam-banner::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: var(--danger, #c0392b);
}
.tt__exam-bell {
  color: var(--danger, #c0392b);
}
.tt__exam-banner-title {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  font-weight: var(--fw-medium);
}
.tt__exam-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tt__exam-item-name {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
}
.tt__exam-item-date {
  color: var(--text-muted);
}
.tt__exam-badge {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-label);
  white-space: nowrap;
}
.tt__exam-badge.is-urgent {
  background: var(--danger-soft, rgba(200, 60, 60, 0.12));
  color: var(--danger, #c0392b);
  font-weight: var(--fw-medium);
}
.tt__exam-badge.is-past {
  color: var(--text-disabled);
}
.tt__exam-all {
  margin-left: auto;
  border: 0;
  background: none;
  padding: 2px 4px;
  color: var(--text-muted);
  font-size: var(--fs-label);
  cursor: pointer;
  white-space: nowrap;
}
.tt__exam-all:hover {
  color: var(--primary-text);
}
.tt__grid {
  display: grid;
  grid-template-columns: 96px repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(60px, auto); /* 行高加大，容纳课名+老师+教室 */
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
  letter-spacing: 0.5px;
}
/* 今天列表头高亮（仅视图周=本周时） */
.tt__day.is-today {
  position: relative;
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}
.tt__day.is-today::after {
  content: '今天';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -1px;
  padding: 1px 6px;
  border-radius: var(--radius-pill) var(--radius-pill) 0 0;
  background: var(--primary-soft-1);
  color: var(--primary-text);
  font-size: 9px;
  font-weight: var(--fw-medium);
  line-height: 1.4;
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
  font-variant-numeric: tabular-nums;
}
.tt__cell {
  min-height: 60px;
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
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 6px 8px;
  border-radius: 7px;
  background: var(--course-color, var(--primary));
  color: #fff;
  overflow: hidden;
  line-height: 1.25;
}
.tt__course-name {
  font-size: 13px;
  font-weight: var(--fw-medium);
  letter-spacing: 0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tt__course-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.88);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 跨行块（连续节次合并）：整块一个色块，圆角统一、内容垂直居中 */
.tt__cell.is-span {
  position: relative;
  padding: 4px 6px;
}
.tt__cell.is-span .tt__course {
  flex: 1;
  justify-content: center;
  gap: 4px;
  padding: 8px 10px;
}
.tt__cell.is-span .tt__course-name {
  font-size: 14px;
  white-space: normal;
  line-height: 1.3;
  max-height: 2.6em;
}
.tt__cell.is-span .tt__course-sub {
  white-space: normal;
}
.tt__slot-range {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
/* 多时段排课 */
.tt__periods-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.tt__period {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
}
.tt__period-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.tt__period-row > * {
  min-width: 0;
}
.tt__period-row > .ui-select {
  flex: 1 1 0;
}
.tt__period-row > .tt__range-sep,
.tt__period-row > .tt__range-count {
  flex: 0 0 auto;
}
.tt__period-del {
  flex: none;
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.tt__period-del:hover {
  color: var(--error, #c0392b);
}
/* 排课弹窗：左右分栏 + 汇总条 + 时段卡片 + 实时预览 */
.tt__add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 210px;
  gap: var(--sp-4);
  align-items: start;
}
.tt__add-main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
}
.tt__summary {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
  background: var(--primary-soft-1);
  color: var(--primary-text);
  font-size: var(--fs-body-2);
}
.tt__summary-icon {
  color: var(--primary);
}
.tt__summary-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.tt__summary-text b {
  font-weight: var(--fw-medium);
}
.tt__summary-meta {
  color: var(--text-muted);
}
/* 已有课程联想下拉 */
.tt__suggest {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-elevated, #fff);
  box-shadow: var(--shadow-float, 0 8px 24px rgba(0, 0, 0, 0.08));
}
.tt__suggest-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 6px 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  text-align: left;
  transition: background var(--dur) var(--ease);
}
.tt__suggest-item:hover {
  background: var(--surface-hover);
}
.tt__suggest-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.tt__suggest-name {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-body-2);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tt__suggest-teacher {
  flex: none;
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.tt__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}
.tt__period-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  transition: border-color var(--dur) var(--ease);
}
.tt__period-card.is-conflict {
  border-color: var(--danger, #c0392b);
}
.tt__period-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.tt__period-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.tt__period-title-icon {
  color: var(--text-muted);
}
.tt__period-ops {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}
.tt__period-copy {
  border: 0;
  background: none;
  padding: 2px 4px;
  color: var(--primary-text);
  font-size: var(--fs-label);
  cursor: pointer;
}
.tt__period-copy:hover {
  text-decoration: underline;
}
.tt__period-time {
  color: var(--text-muted);
}
.tt__conflict {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: var(--sp-2) var(--sp-2);
  border-radius: var(--radius-sm);
  background: var(--danger-soft, rgba(200, 60, 60, 0.12));
  color: var(--danger, #c0392b);
  font-size: var(--fs-label);
  line-height: 1.4;
}
.tt__conflict-icon {
  flex: none;
  margin-top: 1px;
}
/* 实时预览 */
.tt__add-preview {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-unit);
}
.tt__preview-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
}
.tt__preview-title {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.tt__preview-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.tt__preview-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.tt__preview-day {
  text-align: center;
  font-size: 10px;
  color: var(--text-tertiary);
}
.tt__preview-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: stretch;
  min-height: 154px;
}
.tt__preview-block {
  border-radius: 4px;
  background: color-mix(in srgb, var(--pc, var(--primary)) 40%, var(--surface-unit));
}
.tt__preview-block.is-mine {
  background: var(--primary);
}
.tt__preview-empty {
  text-align: center;
  font-size: 11px;
  color: var(--text-disabled);
}
.tt__preview-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.tt__legend-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--primary) 22%, var(--surface-unit));
}
.tt__legend-dot.is-mine {
  background: var(--primary);
}
@media (max-width: 900px) {
  .tt__add {
    grid-template-columns: 1fr;
  }
  .tt__add-preview {
    position: static;
    order: -1;
  }
  .tt__row {
    grid-template-columns: 1fr;
  }
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
    grid-auto-rows: minmax(50px, auto);
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
    min-height: 50px;
    padding: 2px;
    gap: 0;
  }
  .tt__course {
    padding: 3px 4px;
    border-radius: 5px;
    gap: 2px;
  }
  .tt__course-name {
    font-size: 11px;
    line-height: 1.2;
  }
  .tt__course-sub {
    font-size: 9px;
  }
  .tt__cell.is-span {
    padding: 2px;
  }
  .tt__cell.is-span .tt__course-name {
    font-size: 12px;
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
.tt__exam-card {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border: 0.5px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-unit);
}
.tt__exam-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.tt__exam-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tt__exam-name {
  color: var(--text-primary);
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
}
.tt__exam-countdown {
  flex: none;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: var(--fs-label);
  white-space: nowrap;
}
.tt__exam-card.is-urgent {
  border-color: var(--danger-soft, rgba(200, 60, 60, 0.4));
}
.tt__exam-card.is-urgent .tt__exam-countdown {
  background: var(--danger-soft, rgba(200, 60, 60, 0.12));
  color: var(--danger, #c0392b);
  font-weight: var(--fw-medium);
}
.tt__exam-card.is-past {
  opacity: 0.6;
}
.tt__exam-card.is-past .tt__exam-countdown {
  color: var(--text-disabled);
}
/* 学期进度预览 */
.tt__term-progress {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border-radius: var(--radius-md);
  background: var(--surface-unit);
}
.tt__term-progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
}
.tt__term-progress-bar {
  height: 8px;
  border-radius: 999px;
  background: var(--surface-recess);
  overflow: hidden;
}
.tt__term-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--primary);
  transition: width var(--dur) var(--ease);
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
/* 课程详情：时段可视化周时间轴 */
.tt__timeline {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.tt__tl-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.tt__tl-day {
  text-align: center;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  padding-bottom: 2px;
  border-bottom: var(--border-divider-soft);
}
.tt__tl-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tt__tl-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 6px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--primary) 16%, var(--surface-unit));
  text-align: center;
}
.tt__tl-slot {
  font-size: var(--fs-label);
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}
.tt__tl-weeks {
  font-size: 10px;
  color: var(--text-muted);
}
.tt__tl-empty {
  text-align: center;
  font-size: var(--fs-label);
  color: var(--text-disabled);
  padding: 4px 0;
}

/* 我的课程窄条（一行高） */
.tt__course-entry {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  padding: var(--sp-2) var(--sp-4);
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease);
}
.tt__course-entry:hover {
  border-color: var(--border-strong);
}
.tt__course-icon {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--primary-soft-1);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tt__course-title {
  flex: none;
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.tt__course-meta {
  flex: 1;
  min-width: 0;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tt__course-go {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 0.5px solid var(--primary-line);
  border-radius: var(--radius-pill);
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  white-space: nowrap;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.tt__course-go .tt__course-arrow {
  transition: transform var(--dur) var(--ease);
}
.tt__course-entry:hover .tt__course-go {
  background: var(--primary-soft-1);
  border-color: var(--primary);
}
.tt__course-entry:hover .tt__course-arrow {
  transform: translateX(3px);
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .tt {
    max-width: none;
  }
}
</style>

<style>
/* 排课弹窗面板加宽（UiModal teleport 到 body，scoped 选择器够不到，走全局；类名唯一防冲突） */
.ui-modal__panel.tt-add-panel {
  max-width: 800px;
}
</style>
