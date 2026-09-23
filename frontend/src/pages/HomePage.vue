<template>
  <div class="zy-container zy-page home">
    <HomeBackground />

    <!-- 设备形态差异：桌面端把动态背景收进这块 Hero（不再全屏铺满），移动端隐藏、沿用原全屏背景 -->
    <section class="home__hero">
      <div class="home__hero-txt">
        <h1 class="home__hero-title">{{ greeting }}</h1>
        <p class="home__hero-sub">{{ heroSub }}</p>
        <div class="home__hero-metrics">
          <span v-for="m in heroMetrics" :key="m.k" class="home__hero-metric"><b>{{ m.v }}</b><i>{{ m.k }}</i></span>
        </div>
      </div>
      <svg class="home__hero-scene" viewBox="0 0 300 150" fill="none" aria-hidden="true">
        <path d="M0 96h300v54H0z" fill="#cfe4f6" opacity=".5" />
        <path d="M0 96h300" stroke="#a9cbe8" stroke-width="1.5" stroke-dasharray="9 7" />
        <path d="M22 110h70M120 118h58M210 108h64" stroke="#9fc6e6" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="7 6" />
        <g transform="translate(58 74)"><path d="M0 12 22 12 15 22 7 22Z" fill="#e8a06a" /><path d="M11 0v12" stroke="#b4763f" stroke-width="2" /><path d="M11 1 25 5l-14 4z" fill="#f2c98a" /></g>
        <g transform="translate(196 80) scale(.7)"><path d="M0 12 22 12 15 22 7 22Z" fill="#d98f5c" /><path d="M11 0v12" stroke="#a96c36" stroke-width="2" /><path d="M11 1 25 5l-14 4z" fill="#f2c98a" /></g>
        <circle cx="256" cy="34" r="17" fill="#fbe6b8" opacity=".8" />
      </svg>
      <div class="home__hero-cta">
        <button type="button" class="home__hero-btn" @click="go(ROUTES.capture)">
          <UiIcon name="camera" :size="16" />拍照搜题
        </button>
        <button type="button" class="home__hero-btn is-ghost" @click="goText">输入题目文字</button>
      </div>
    </section>

    <div class="home__layout">
      <div class="home__main">
        <!-- ① 主功能大卡（一页 4 个，无轮播 —— 原型 A1②；图案为样图定稿双色版） -->
        <div class="home__cards">
          <button
            v-for="c in cards"
            :key="c.path"
            type="button"
            class="home__card"
            :style="{ '--c': c.color }"
            @click="go(c.path)"
          >
            <span class="home__card-icon"><CardArt :name="c.icon" /></span>
            <span class="home__card-name">{{ c.label }}</span>
          </button>
        </div>

        <!-- ② 次入口（整体玻璃卡 + 右侧露出下一页一角暗示可滑 + 胶囊分页点 —— 移动横滑两页 / 桌面 9 项平铺） -->
        <div class="home__quick">
          <div ref="quickEl" class="home__quick-track" @scroll.passive="onQuickScroll">
            <div class="home__quick-page">
              <button v-for="q in quickP1" :key="q.path" type="button" class="home__ico" @click="go(q.path)">
                <UiIcon :name="q.icon" :size="22" /><span>{{ q.label }}</span>
              </button>
            </div>
            <div class="home__quick-page">
              <button v-for="q in quickP2" :key="q.path" type="button" class="home__ico" @click="go(q.path)">
                <UiIcon :name="q.icon" :size="22" /><span>{{ q.label }}</span>
              </button>
            </div>
          </div>
          <div class="home__quick-dots" aria-hidden="true">
            <span v-for="i in 2" :key="i" class="home__dot" :class="{ 'is-on': quickPage === i - 1 }" />
          </div>
        </div>

        <!-- ③ 信息位（按优先级取一条 —— 原型 A1④ 与映射表：考试 > 今日目标 > 待复习 > 空态；玻璃卡透出背景） -->
        <button v-if="infoSlot" type="button" class="home__info" @click="go(infoSlot.path)">
          <span class="home__info-emoji" :style="{ background: infoSlot.tint }">{{ infoSlot.emoji }}</span>
          <span class="home__info-main">
            <span class="home__info-title">{{ infoSlot.title }}</span>
            <span class="home__info-sub">{{ infoSlot.sub }}</span>
          </span>
          <span class="home__info-action">{{ infoSlot.action }} →</span>
        </button>

        <!-- ④ 今日复习任务（桌面专属：把移动端要靠滑动才能看到的信息一次摊开） -->
        <section v-if="todoList.length" class="home__blk home__todo">
          <div class="home__blk-head">
            <h2 class="t-h3">今日复习任务</h2>
            <span class="home__blk-chip">SRS 智能排期</span>
            <button type="button" class="home__blk-more" @click="go(ROUTES.wrongbook)">查看全部 →</button>
          </div>
          <table class="home__table">
            <thead>
              <tr>
                <th class="c-q">题目</th><th class="c-src">来源</th><th class="c-kp">知识点</th>
                <th class="c-bar">掌握度</th><th class="c-due">到期</th><th class="c-act"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in todoList" :key="it.id">
                <td class="c-q"><span class="home__q">{{ it.title }}</span></td>
                <td class="c-src">{{ it.source }}</td>
                <td class="c-kp"><span v-if="it.kp" class="home__kp">{{ it.kp }}</span><span v-else class="home__dash">—</span></td>
                <td class="c-bar">
                  <span class="home__bar"><i :style="{ width: it.mastery + '%' }" /></span>
                </td>
                <td class="c-due"><span class="home__due" :class="it.dueClass">{{ it.due }}</span></td>
                <td class="c-act">
                  <button type="button" class="home__row-btn" @click="startReview(it)">{{ it.action }} →</button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ⑤ 最近学习记录（桌面专属） -->
        <section v-if="recentList.length" class="home__blk home__recent">
          <div class="home__blk-head">
            <h2 class="t-h3">最近学习记录</h2>
            <button type="button" class="home__blk-more" @click="go(ROUTES.records)">全部记录 →</button>
          </div>
          <div v-for="r in recentList" :key="r.id" class="home__rec">
            <span class="home__rec-ic"><UiIcon :name="r.icon" :size="15" /></span>
            <span class="home__rec-main">
              <b><MathText :content="r.titleTex || r.title" /></b>
              <i>{{ r.sub }}</i>
            </span>
            <span class="home__rec-time">{{ r.time }}</span>
            <button type="button" class="home__row-btn is-ghost" @click="go(r.path)">查看 →</button>
          </div>
        </section>
      </div>

      <!-- 桌面专属：今日概览侧栏（工作台增强，移动端隐藏；玻璃卡透出背景） -->
      <aside class="home__aside">
        <div class="home__aside-title">今日概览</div>
        <div class="home__aside-grid">
          <span class="home__aside-metric"><b>{{ todayMin }}</b><i>今日分钟</i></span>
          <span class="home__aside-metric"><b>{{ todayQ }}</b><i>今日题量</i></span>
          <span class="home__aside-metric"><b>{{ pendingReview }}</b><i>待复习</i></span>
          <span class="home__aside-metric"><b>{{ streak }}</b><i>连续天数</i></span>
        </div>
        <button type="button" class="home__aside-link" @click="go(ROUTES.data)">查看学习数据 →</button>

        <!-- 最近一场考试（有数据才显示） -->
        <div v-if="examNext" class="home__exam">
          <div class="home__exam-label">最近一场考试</div>
          <div class="home__exam-days">{{ examNext.days }}<i>天后</i></div>
          <div class="home__exam-name">{{ examNext.name }}</div>
          <div class="home__exam-date">{{ examNext.date }}</div>
        </div>

        <!-- 快捷工具 -->
        <div class="home__aside-title is-sep">快捷工具</div>
        <div class="home__tools">
          <button v-for="tl in toolLinks" :key="tl.path" type="button" class="home__tool" @click="go(tl.path)">
            <UiIcon :name="tl.icon" :size="16" /><span>{{ tl.label }}</span>
          </button>
        </div>
      </aside>
    </div>

    <!-- ④ 留白（按原型保持） -->
    <div class="home__space" />

    <ReminderCenter v-model="remindOpen" :reminders="reminders" @go="go" />
    <SetupWizard v-model="wizardOpen" @done="dismissSetup" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiIcon from '../ui/UiIcon.vue'
import CardArt from '../ui/CardArt.vue'
import HomeBackground from '../ui/HomeBackground.vue'
import ReminderCenter from '../ui/ReminderCenter.vue'
import SetupWizard from '../components/SetupWizard.vue'
import { ROUTES, path } from '../lib/routes.js'
import { onBootDone, startEnterSequence } from '../lib/boot.js'
import { getOverview } from '../book.js'
import { latexToPlain } from '../mathtext'
import { upcomingExams } from '../stores/courseStore'
import { summary as statsSummary } from '../stores/statsStore'
import { recordsRef, RECORD_TYPES } from '../stores/recordsStore'
import { session } from '../stores/sessionStore'
import { bookRef, settingsRef } from '../stores/bookStore'
import { pendingReviewCount, todayQuestions, todayMinutes } from '../lib/homeStats.js'
import { toDateStr, daysUntil } from '../lib/termCalc.js'
import { profileRef } from '../profileStore'
import { coursesRef } from '../stores/courseStore'

/**
 * 首页（原型 A1）：大卡一页 4 个 + 次入口横滑两页 + 信息位一条 + 留白。
 * 底部导航移除；一级页之间靠大卡 / 次入口 / 顶部「学习/我的」Tab 跳转。
 * 重复红线：自测只从错题学习页进、我的课程只从课程表页进、工具只从学习工具页进。
 */
const route = useRoute()
const router = useRouter()
/** 开场级联的取消句柄（组件卸载时清掉定时器） */
let cancelEnter = null
const go = (target) => router.push(target)

/* ---------------- ① 主功能大卡 ---------------- */
const cards = [
  { label: '拍照搜题', icon: 'camera', color: '#3D6FA8', path: ROUTES.capture },
  { label: '错题学习', icon: 'book', color: '#6B5B95', path: ROUTES.wrongbook },
  { label: 'AI 对话', icon: 'chat', color: '#B5722A', path: ROUTES.chat },
  { label: '学习工具', icon: 'sparkle', color: '#6F57F0', path: ROUTES.tools },
]

/* ---------------- ② 次入口（横滑两页） ---------------- */
const quickP1 = [
  { label: '课程表', icon: 'schedule', path: ROUTES.timetable },
  { label: '知一社区', icon: 'chat', path: ROUTES.community },
  { label: '考试安排', icon: 'clipboard', path: ROUTES.exams },
  { label: '班级', icon: 'users', path: ROUTES.classPage },
  { label: '学习数据', icon: 'data', path: ROUTES.data },
]
const quickP2 = [
  { label: '学习记录', icon: 'history', path: ROUTES.records },
  { label: '成就殿堂', icon: 'sparkle', path: ROUTES.achievements },
  { label: '产品介绍', icon: 'info', path: ROUTES.about },
  { label: '帮助反馈', icon: 'help', path: ROUTES.help },
  { label: '账号同步', icon: 'user', path: ROUTES.mine },
]

const quickEl = ref(null)
const quickPage = ref(0)
function onQuickScroll() {
  const el = quickEl.value
  if (!el) return
  quickPage.value = el.scrollLeft > el.clientWidth / 2 ? 1 : 0
}

/* ---------------- 数据（本地真实状态） ---------------- */
const book = bookRef()
const reviewSettings = settingsRef()
const records = recordsRef()
const stats = computed(() => statsSummary())
const pendingReview = computed(() => pendingReviewCount(book.value, reviewSettings.value))
const todayQ = computed(() => todayQuestions(records.value))
const todayMin = computed(() => todayMinutes(records.value))
const streak = computed(() => Number(stats.value.current) || 0)

const nextExam = computed(() => upcomingExams(1)[0] || null)
function examDays(e) {
  return daysUntil(e.date, toDateStr(new Date()))
}

/* ---------------- ③ 信息位（单条，按优先级） ---------------- */
const infoSlot = computed(() => {
  const exam = nextExam.value
  if (exam) {
    const d = examDays(exam)
    const dLabel = d <= 0 ? '今天' : `${d} 天`
    return {
      emoji: '📅',
      tint: 'rgba(181, 114, 42, 0.14)',
      title: `距「${exam.name}」还有 ${dLabel}`,
      sub: `${exam.date} ${exam.startTime || ''}${exam.location ? ' · ' + exam.location : ''}`,
      action: '看安排',
      path: ROUTES.exams,
    }
  }
  if (stats.value.settings && stats.value.settings.goalEnabled) {
    const target = Number(stats.value.settings.goalQuestions) || 0
    return {
      emoji: '◎',
      tint: 'rgba(111, 87, 240, 0.12)',
      title: `今日已做 ${todayQ.value} / ${target} 题`,
      sub: target > todayQ.value ? `再做 ${target - todayQ.value} 题就达标` : '今日目标已达成',
      action: '继续',
      path: ROUTES.data,
    }
  }
  if (pendingReview.value > 0) {
    return {
      emoji: '↻',
      tint: 'rgba(74, 122, 99, 0.14)',
      title: `${pendingReview.value} 道错题该复习了`,
      sub: '按遗忘曲线，今天到期（自测入口在错题学习页内）',
      action: '去复习',
      path: ROUTES.wrongbook,
    }
  }
  return {
    emoji: '📷',
    tint: 'rgba(61, 111, 168, 0.14)',
    title: '拍一道题，开始你的学习',
    sub: 'AI 讲清思路，做错的题自动进错题本',
    action: '去拍题',
    path: ROUTES.capture,
  }
})

/* ---------------- 桌面端（≥1024px）工作台数据 ---------------- */
// 问候语（按时段 + 当前账号）
const greeting = computed(() => {
  const h = new Date().getHours()
  const word = h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  return `${word}，${session.userId || '同学'}`
})
const heroSub = computed(() => {
  if (pendingReview.value > 0) return `今天有 ${pendingReview.value} 道错题到了复习时间，先从最薄弱的知识点开始。`
  if (todayQ.value > 0) return `今天已经做了 ${todayQ.value} 道题，保持这个节奏。`
  return '拍一道题开始今天的学习，AI 会把每一步思路讲清楚。'
})
const overview = computed(() => getOverview(book.value))
const masteryPct = computed(() => {
  const o = overview.value
  return o.total > 0 ? Math.round((o.mastered / o.total) * 100) : 0
})
const heroMetrics = computed(() => [
  { k: '待复习', v: pendingReview.value },
  { k: '连续打卡', v: streak.value },
  { k: '今日题量', v: todayQ.value },
  { k: '掌握度', v: masteryPct.value + '%' },
])

/** 题目摘要 → 表格里的一行标题（LaTeX 先转 Unicode，避免半截源码） */
function qBrief(text, n = 34) {
  const t = latexToPlain(String(text || '')).replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t || '（无题干）'
}
const DAY = 86400000
/** 今日复习任务：到期的优先，其次未掌握的，最多 4 条 */
const todoList = computed(() => {
  const now = Date.now()
  const qs = (book.value || []).filter((it) => it && it.kind !== 'note' && !it.mastered)
  const due = qs.filter((it) => !it.reviewAt || it.reviewAt <= now)
  const rest = qs.filter((it) => it.reviewAt && it.reviewAt > now).sort((a, b) => a.reviewAt - b.reviewAt)
  return [...due, ...rest].slice(0, 4).map((it) => {
    const isDue = !it.reviewAt || it.reviewAt <= now
    const days = Math.round((Number(it.reviewAt || 0) - now) / DAY)
    const dueLabel = isDue ? '今天' : days <= 1 ? '明天' : `${days} 天后`
    return {
      id: it.id,
      title: qBrief(it.question),
      source: it.source || it.subject || '拍照搜题',
      kp: (it.knowledgePoints || [])[0] || '',
      mastery: Math.min(100, Math.round(((Number(it.streak) || 0) / 2) * 100)),
      due: dueLabel,
      dueClass: isDue ? 'is-now' : '',
      action: isDue ? '开始复习' : '查看解析',
    }
  })
})
/** 最近学习记录（取本地 4 条） */
const recentList = computed(() => {
  return (records.value || []).slice(0, 4).map((r) => {
    const meta = RECORD_TYPES[r.type] || {}
    const bits = [meta.label, r.brief, r.correct === true ? '正确' : r.correct === false ? '错误' : '',
      r.minutes ? r.minutes + ' 分钟' : ''].filter(Boolean)
    return {
      id: r.id,
      icon: meta.icon || 'history',
      title: r.title || meta.label || '学习记录',
      titleTex: r.titleTex || '',
      sub: bits.join(' · '),
      time: timeAgo(r.createdAt),
      path: ROUTES.records,
    }
  })
})
const examNext = computed(() => {
  const e = nextExam.value
  if (!e) return null
  return {
    days: Math.max(0, examDays(e)),
    name: e.name,
    date: `${e.date}${e.startTime ? ' ' + e.startTime : ''}`,
  }
})
const toolLinks = [
  { label: '模拟考试', icon: 'clipboard', path: ROUTES.simExam },
  { label: '错题自测', icon: 'book', path: ROUTES.wrongbook },
  { label: '学习数据', icon: 'data', path: ROUTES.data },
  { label: '课程表', icon: 'schedule', path: ROUTES.timetable },
]
function goText() {
  router.push(path(ROUTES.capture, {}) + '?focus=text')
}
function startReview(it) {
  router.push(path(ROUTES.wrongbookDetail, { id: it.id }))
}
function timeAgo(ts) {
  const d = Date.now() - Number(ts || 0)
  if (d < 60000) return '刚刚'
  if (d < 3600000) return `${Math.floor(d / 60000)} 分钟前`
  if (d < DAY) return `${Math.floor(d / 3600000)} 小时前`
  if (d < DAY * 2) return '昨天'
  return `${Math.floor(d / DAY)} 天前`
}

/* ---------------- 提醒中心（B1）：信息位是「一条」，这里是「全部」 ---------------- */
const remindOpen = ref(false)
const reminders = computed(() => {
  const list = []
  if (pendingReview.value > 0) {
    list.push({
      key: 'review',
      emoji: '↻',
      tint: 'rgba(74, 122, 99, 0.16)',
      title: `${pendingReview.value} 道错题该复习了`,
      sub: '按遗忘曲线，今天到期',
      action: '去复习',
      path: ROUTES.wrongbook,
    })
  }
  const exam = nextExam.value
  if (exam) {
    const d = examDays(exam)
    list.push({
      key: 'exam',
      emoji: '📅',
      tint: 'rgba(181, 114, 42, 0.16)',
      title: `距「${exam.name}」${d <= 0 ? '就是今天' : d + ' 天'}`,
      sub: `${exam.date} ${exam.startTime || ''}${exam.location ? ' · ' + exam.location : ''}`,
      action: '看安排',
      path: ROUTES.exams,
    })
  }
  if (stats.value.settings && stats.value.settings.goalEnabled) {
    const target = Number(stats.value.settings.goalQuestions) || 0
    list.push({
      key: 'goal',
      emoji: '◎',
      tint: 'rgba(111, 87, 240, 0.14)',
      title: `今日已做 ${todayQ.value} / ${target} 题`,
      sub: target > todayQ.value ? `再做 ${target - todayQ.value} 题就达标` : '今日目标已达成',
      action: '继续',
      path: ROUTES.data,
    })
  }
  const streak = Number(stats.value.current) || 0
  if (streak > 0) {
    list.push({
      key: 'streak',
      emoji: '🔥',
      tint: 'rgba(61, 111, 168, 0.16)',
      title: `已连续学习 ${streak} 天`,
      sub: '明天再来就再进一步',
      action: '',
      path: '',
    })
  }
  return list
})

/* ---------------- 新用户初始化引导（保留功能流程） ---------------- */
const wizardOpen = ref(false)
const setupDismissed = ref(readDismissed())

function readDismissed() {
  try {
    return localStorage.getItem('zhiyi_setup_dismissed') === '1'
  } catch {
    return false
  }
}

const showSetup = computed(() => {
  if (setupDismissed.value) return false
  const p = profileRef().value
  const noProfile = !String(p.major || '').trim() || !String(p.grade || '').trim()
  const noCourse = coursesRef().value.length === 0
  return noProfile || noCourse
})

function dismissSetup() {
  setupDismissed.value = true
  try {
    localStorage.setItem('zhiyi_setup_dismissed', '1')
  } catch {
    /* 忽略 */
  }
}

onBeforeUnmount(() => {
  if (cancelEnter) cancelEnter()
})

onMounted(() => {
  // 顶栏 🔔 → /?remind=1：进首页即弹出提醒中心
  if (route.query.remind === '1') remindOpen.value = true
  // 开场动画：等开屏层交接完成后播内容级联（未播过/被跳过则直接呈现）
  // 首次引导弹窗也等入场结束再出现，避免刚看完 Logo 就被弹窗怼脸
  cancelEnter = onBootDone((animate) => {
    if (!animate) {
      if (showSetup.value) wizardOpen.value = true
      return
    }
    cancelEnter = startEnterSequence()
    setTimeout(() => {
      if (showSetup.value) wizardOpen.value = true
    }, 700)
  })
})
// 已在首页时再点铃铛：query 变化不会重挂载组件，用 watch 跟随
watch(
  () => route.query.remind,
  (v) => {
    if (v === '1') remindOpen.value = true
  },
)
</script>

<style scoped>
.home {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 62px);
  /* 背景层顶到视口顶：负 margin 越过 sticky 顶栏，Tab 区透出天空色 */
  margin-top: -62px;
  padding-top: 62px;
}

.home__layout,
.home__space {
  position: relative;
  z-index: 1;
}

/* ① 大卡：一页 4 个，极浅功能色玻璃底（背景云/水色隐约透出） */
.home__cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-3);
}
.home__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-1);
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--c) 7%, var(--glass));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.home__card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--c) 45%, transparent);
}
.home__card-icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.home__card-name {
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}

/* ② 次入口：整体玻璃卡（突出边界，与四卡/信息位同一套表面） */
.home__quick {
  margin-top: var(--sp-5);
  padding: var(--sp-3) var(--sp-2);
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--glass);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.home__quick-track {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.home__quick-track::-webkit-scrollbar {
  display: none;
}
.home__quick-page {
  /* 92%：右侧露出下一页一角，暗示可横滑 */
  flex: 0 0 92%;
  scroll-snap-align: start;
  display: flex;
  justify-content: space-between;
  gap: var(--sp-2);
  padding-right: var(--sp-3);
}
.home__ico {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
  border: 0;
  background: none;
  padding: var(--sp-1) 0;
  color: var(--text-secondary);
  font-size: var(--fs-label);
  cursor: pointer;
}
.home__ico:hover {
  color: var(--text-primary);
}
.home__quick-dots {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: var(--sp-3);
}
.home__dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: var(--border-strong, #d6dce6);
  transition: width var(--dur) var(--ease), background var(--dur) var(--ease);
}
.home__dot.is-on {
  width: 18px;
  background: var(--primary);
}

/* ③ 信息位：单条横卡（玻璃底透出背景） */
.home__info {
  /* 按钮默认 shrink-to-fit：文案变长（如「N 道错题该复习了」）会撑破窄屏，锁成容器宽 */
  width: 100%;
  box-sizing: border-box;
  margin-top: var(--sp-5);
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--glass);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease);
}
.home__info:hover {
  border-color: var(--border-strong);
}
.home__info-emoji {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}
.home__info-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.home__info-title {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__info-sub {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__info-action {
  flex: none;
  font-size: var(--fs-body-2);
  color: var(--primary-text);
  white-space: nowrap;
}

/* ④ 留白 */
.home__space {
  flex: 1;
  min-height: 40px;
}

/* ---------------- 桌面（≥768px）：工作台增强 ---------------- */
.home__aside {
  display: none;
}
@media (min-width: 768px) {
  .home {
    max-width: var(--col-wide);
  }
  .home__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: var(--sp-6);
    align-items: start;
  }
  /* 大卡横版：图标 + 标题左对齐 */
  .home__card {
    flex-direction: row;
    justify-content: flex-start;
    gap: var(--sp-3);
    padding: var(--sp-4) var(--sp-5);
  }
  .home__card-name {
    font-size: var(--fs-body);
  }
  /* 次入口 9 项平铺（禁横滑，display:contents 把两页并进一行）：沿用同一张玻璃卡 */
  .home__quick {
    padding: var(--sp-4);
  }
  .home__quick-track {
    overflow: visible;
    scroll-snap-type: none;
  }
  .home__quick-page {
    display: contents;
  }
  .home__quick-dots {
    display: none;
  }
  .home__space {
    min-height: 24px;
  }
  /* 今日概览侧栏（sticky 跟随滚动；玻璃底透出背景） */
  .home__aside {
    position: sticky;
    top: 80px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4) var(--sp-5);
    border: var(--border-subtle);
    border-radius: var(--radius-lg);
    background: var(--glass);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .home__aside-title {
    font-size: var(--fs-h3);
    font-weight: var(--fw-medium);
    color: var(--text-primary);
  }
  .home__aside-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
  }
  .home__aside-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .home__aside-metric b {
    font-size: var(--fs-h2);
    font-weight: var(--fw-semibold);
    color: var(--text-primary);
  }
  .home__aside-metric i {
    font-style: normal;
    font-size: var(--fs-label);
    color: var(--text-tertiary);
  }
  .home__aside-link {
    border: 0;
    background: none;
    padding: 0;
    text-align: left;
    font-size: var(--fs-body-2);
    color: var(--primary-text);
    cursor: pointer;
  }
}

@media (max-width: 767px) {
  .home {
    min-height: calc(100vh - 48px);
    margin-top: -48px;
    padding-top: 48px;
  }
  /* 四功能卡：2×2 大卡（单卡约 104px 高、图标 40px），比原来一行 4 个明显更清楚 */
  .home__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-3);
  }
  .home__card {
    padding: 18px var(--sp-3) 16px;
    gap: 10px;
    min-height: 104px;
  }
  .home__card-icon {
    width: 40px;
    height: 40px;
  }
  .home__card-icon :deep(svg.card-art) {
    width: 40px;
    height: 40px;
  }
  .home__card-name {
    font-size: 13.5px;
    font-weight: var(--fw-medium);
  }
}
/* ==========================================================================
   桌面端工作台（≥1024px）
   ---------------------------------------------------------------------------
   与移动端的差别：全屏动态背景收进 Hero 卡 → 四功能卡 → 今日复习任务（表格）
   → 提示条 → 最近记录；右栏承载今日概览 / 考试倒计时 / 快捷工具。
   以下模块默认 display:none，只在桌面端显示，移动端不受影响。
   ========================================================================== */
.home__hero,
.home__blk,
.home__exam,
.home__tools,
.home__aside-title.is-sep {
  display: none;
}

.home__blk {
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
}
.home__blk-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.home__blk-chip {
  font-size: var(--fs-label);
  color: var(--primary-text);
  background: var(--primary-soft-2);
  border-radius: var(--radius-pill);
  padding: 2px 9px;
}
.home__blk-more {
  margin-left: auto;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: var(--fs-body-2);
  color: var(--text-muted);
  cursor: pointer;
}
.home__blk-more:hover {
  color: var(--primary-text);
}

/* 今日复习任务表格 */
.home__table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
.home__table th {
  font-size: var(--fs-label);
  font-weight: 400;
  color: var(--text-muted);
  text-align: left;
  padding: var(--sp-2);
  border-bottom: var(--border-divider-soft);
}
.home__table td {
  padding: 11px var(--sp-2);
  border-bottom: var(--border-divider-soft);
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  vertical-align: middle;
}
.home__table tr:last-child td {
  border-bottom: 0;
}
.home__table .c-q {
  width: 36%;
  padding-left: 0;
}
.home__table .c-src {
  width: 12%;
}
.home__table .c-kp {
  width: 15%;
}
.home__table .c-bar {
  width: 14%;
}
.home__table .c-due {
  width: 11%;
}
.home__table .c-act {
  width: 92px;
  text-align: right;
  padding-right: 0;
}
.home__q {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}
.home__kp,
.home__dash {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  background: var(--surface-unit);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
}
.home__dash {
  background: none;
  color: var(--text-disabled);
}
.home__bar {
  display: block;
  width: 74px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.home__bar i {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, #7e68f7, var(--primary-cta));
}
.home__due {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  white-space: nowrap;
}
.home__due.is-now {
  color: var(--warning);
  background: var(--warning-soft);
  border-radius: var(--radius-pill);
  padding: 2px 9px;
}
.home__row-btn {
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--primary-soft-1);
  color: var(--primary-text);
  font-family: inherit;
  font-size: var(--fs-label);
  font-weight: var(--fw-medium);
  padding: 6px 11px;
  cursor: pointer;
  white-space: nowrap;
}
.home__row-btn:hover {
  background: var(--primary-soft-2);
}
.home__row-btn.is-ghost {
  background: none;
  color: var(--text-muted);
}
.home__row-btn.is-ghost:hover {
  color: var(--primary-text);
}

/* 最近学习记录 */
.home__rec {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 10px 0;
  border-bottom: var(--border-divider-soft);
}
.home__rec:last-child {
  border-bottom: 0;
}
.home__rec-ic {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.home__rec-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.home__rec-main b {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__rec-main i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__rec-time {
  font-size: var(--fs-label);
  color: var(--text-disabled);
  white-space: nowrap;
}

/* 右栏：考试倒计时 + 快捷工具 */
.home__exam {
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-4);
  border-radius: var(--radius-md);
  background: linear-gradient(140deg, rgba(255, 245, 232, 0.9), rgba(253, 240, 246, 0.9));
  border: var(--border-subtle);
}
html[data-theme='dark'] .home__exam {
  background: linear-gradient(140deg, rgba(120, 82, 30, 0.28), rgba(96, 52, 90, 0.24));
}
.home__exam-label {
  font-size: var(--fs-label);
  color: var(--warning);
}
.home__exam-days {
  font-size: var(--fs-display);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  letter-spacing: -0.04em;
  line-height: 1.15;
}
.home__exam-days i {
  font-style: normal;
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
  margin-left: 3px;
}
.home__exam-name {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__exam-date {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.home__tools {
  display: none;
  flex-direction: column;
  gap: var(--sp-2);
}
.home__tool {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  padding: 9px 10px;
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
}
.home__tool:hover {
  color: var(--text-primary);
  border-color: var(--primary-line);
}
.home__tool span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (min-width: 1024px) {
  /* 桌面：不再全屏出血，背景收进 Hero；页面铺满内容区 */
  .home {
    max-width: none;
    margin-top: 0;
    padding-top: 0;
    padding-bottom: var(--sp-6);
    gap: var(--sp-4);
  }
  /* 桌面端隐藏全屏背景层（改用 Hero 内部的小场景） */
  .home :deep(.hbg) {
    display: none;
  }
  .home__hero {
    display: flex;
    align-items: center;
    gap: var(--sp-6);
    position: relative;
    overflow: hidden;
    padding: var(--sp-6) var(--sp-6) var(--sp-6) var(--sp-8);
    border-radius: var(--radius-xl);
    background: linear-gradient(120deg, #e8effc 0%, #f3f0fd 55%, #fdf3ec 100%);
    border: var(--border-subtle);
    box-shadow: var(--shadow-subtle);
  }
  html[data-theme='dark'] .home__hero {
    background: linear-gradient(120deg, rgba(38, 48, 78, 0.9) 0%, rgba(46, 40, 74, 0.9) 55%, rgba(58, 44, 40, 0.85) 100%);
  }
  .home__hero-txt {
    position: relative;
    z-index: 1;
    flex: 1;
    min-width: 0;
  }
  .home__hero-title {
    font-size: var(--fs-h1);
    font-weight: var(--fw-medium);
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }
  .home__hero-sub {
    font-size: var(--fs-body);
    color: var(--text-tertiary);
    margin-top: var(--sp-2);
  }
  .home__hero-metrics {
    display: flex;
    gap: var(--sp-8);
    margin-top: var(--sp-5);
  }
  .home__hero-metric {
    display: flex;
    flex-direction: column;
  }
  .home__hero-metric b {
    font-size: var(--fs-metric);
    font-weight: var(--fw-medium);
    letter-spacing: -0.04em;
    color: var(--text-primary);
    white-space: nowrap;
  }
  .home__hero-metric i {
    font-style: normal;
    font-size: var(--fs-label);
    color: var(--text-muted);
    margin-top: 2px;
    white-space: nowrap;
  }
  .home__hero-scene {
    position: absolute;
    right: 214px;
    bottom: 0;
    width: 300px;
    height: 150px;
    opacity: 0.9;
    pointer-events: none;
  }
  .home__hero-cta {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    flex: 0 0 172px;
  }
  .home__hero-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    height: 40px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--primary-cta);
    color: var(--text-on-primary);
    font-family: inherit;
    font-size: var(--fs-button);
    font-weight: var(--fw-medium);
    cursor: pointer;
    box-shadow: var(--shadow-cta);
  }
  .home__hero-btn:hover {
    background: var(--primary-cta-hover);
  }
  .home__hero-btn.is-ghost {
    background: var(--surface-1);
    color: var(--text-secondary);
    border: var(--border-default);
    box-shadow: none;
  }
  .home__hero-btn.is-ghost:hover {
    color: var(--text-primary);
    border-color: var(--primary-line);
  }
  /* 主栏 + 右栏 */
  .home__layout {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: var(--sp-4);
  }
  .home__main {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    min-width: 0;
  }
  /* 两侧已有侧栏导航，次入口与侧栏重复 → 桌面隐藏，避免功能冗余 */
  .home__quick {
    display: none;
  }
  .home__blk {
    display: flex;
  }
  .home__exam,
  .home__tools {
    display: flex;
  }
  .home__aside {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }
  .home__aside-title.is-sep {
    display: block;
    margin-top: var(--sp-2);
  }
}
/* ==========================================================================
   桌面端工作台（≥1024px）
   ---------------------------------------------------------------------------
   与移动端的差别：全屏动态背景收进 Hero 卡 → 四功能卡 → 今日复习任务（表格）
   → 提示条 → 最近记录；右栏承载今日概览 / 考试倒计时 / 快捷工具。
   以下模块默认 display:none，只在桌面端显示，移动端不受影响。
   ========================================================================== */
.home__hero,
.home__blk,
.home__exam,
.home__tools,
.home__aside-title.is-sep {
  display: none;
}

.home__blk {
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
}
.home__blk-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.home__blk-chip {
  font-size: var(--fs-label);
  color: var(--primary-text);
  background: var(--primary-soft-2);
  border-radius: var(--radius-pill);
  padding: 2px 9px;
}
.home__blk-more {
  margin-left: auto;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: var(--fs-body-2);
  color: var(--text-muted);
  cursor: pointer;
}
.home__blk-more:hover {
  color: var(--primary-text);
}

/* 今日复习任务表格 */
.home__table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}
.home__table th {
  font-size: var(--fs-label);
  font-weight: 400;
  color: var(--text-muted);
  text-align: left;
  padding: var(--sp-2);
  border-bottom: var(--border-divider-soft);
}
.home__table td {
  padding: 11px var(--sp-2);
  border-bottom: var(--border-divider-soft);
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  vertical-align: middle;
}
.home__table tr:last-child td {
  border-bottom: 0;
}
.home__table .c-q {
  width: 36%;
  padding-left: 0;
}
.home__table .c-src {
  width: 12%;
}
.home__table .c-kp {
  width: 15%;
}
.home__table .c-bar {
  width: 14%;
}
.home__table .c-due {
  width: 11%;
}
.home__table .c-act {
  width: 92px;
  text-align: right;
  padding-right: 0;
}
.home__q {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}
.home__kp,
.home__dash {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  background: var(--surface-unit);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
}
.home__dash {
  background: none;
  color: var(--text-disabled);
}
.home__bar {
  display: block;
  width: 74px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.home__bar i {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, #7e68f7, var(--primary-cta));
}
.home__due {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  white-space: nowrap;
}
.home__due.is-now {
  color: var(--warning);
  background: var(--warning-soft);
  border-radius: var(--radius-pill);
  padding: 2px 9px;
}
.home__row-btn {
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--primary-soft-1);
  color: var(--primary-text);
  font-family: inherit;
  font-size: var(--fs-label);
  font-weight: var(--fw-medium);
  padding: 6px 11px;
  cursor: pointer;
  white-space: nowrap;
}
.home__row-btn:hover {
  background: var(--primary-soft-2);
}
.home__row-btn.is-ghost {
  background: none;
  color: var(--text-muted);
}
.home__row-btn.is-ghost:hover {
  color: var(--primary-text);
}

/* 最近学习记录 */
.home__rec {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 10px 0;
  border-bottom: var(--border-divider-soft);
}
.home__rec:last-child {
  border-bottom: 0;
}
.home__rec-ic {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.home__rec-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.home__rec-main b {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__rec-main i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__rec-time {
  font-size: var(--fs-label);
  color: var(--text-disabled);
  white-space: nowrap;
}

/* 右栏：考试倒计时 + 快捷工具 */
.home__exam {
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-4);
  border-radius: var(--radius-md);
  background: linear-gradient(140deg, rgba(255, 245, 232, 0.9), rgba(253, 240, 246, 0.9));
  border: var(--border-subtle);
}
html[data-theme='dark'] .home__exam {
  background: linear-gradient(140deg, rgba(120, 82, 30, 0.28), rgba(96, 52, 90, 0.24));
}
.home__exam-label {
  font-size: var(--fs-label);
  color: var(--warning);
}
.home__exam-days {
  font-size: var(--fs-display);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  letter-spacing: -0.04em;
  line-height: 1.15;
}
.home__exam-days i {
  font-style: normal;
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
  margin-left: 3px;
}
.home__exam-name {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__exam-date {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.home__tools {
  display: none;
  flex-direction: column;
  gap: var(--sp-2);
}
.home__tool {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  padding: 9px 10px;
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
}
.home__tool:hover {
  color: var(--text-primary);
  border-color: var(--primary-line);
}
.home__tool span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (min-width: 1024px) {
  /* 桌面：不再全屏出血，背景收进 Hero；页面铺满内容区 */
  .home {
    max-width: none;
    margin-top: 0;
    padding-top: 0;
    padding-bottom: var(--sp-6);
    gap: var(--sp-4);
  }
  /* 桌面端隐藏全屏背景层（改用 Hero 内部的小场景） */
  .home :deep(.hbg) {
    display: none;
  }
  .home__hero {
    display: flex;
    align-items: center;
    gap: var(--sp-6);
    position: relative;
    overflow: hidden;
    padding: var(--sp-6) var(--sp-6) var(--sp-6) var(--sp-8);
    border-radius: var(--radius-xl);
    background: linear-gradient(120deg, #e8effc 0%, #f3f0fd 55%, #fdf3ec 100%);
    border: var(--border-subtle);
    box-shadow: var(--shadow-subtle);
  }
  html[data-theme='dark'] .home__hero {
    background: linear-gradient(120deg, rgba(38, 48, 78, 0.9) 0%, rgba(46, 40, 74, 0.9) 55%, rgba(58, 44, 40, 0.85) 100%);
  }
  .home__hero-txt {
    position: relative;
    z-index: 1;
    flex: 1;
    min-width: 0;
  }
  .home__hero-title {
    font-size: var(--fs-h1);
    font-weight: var(--fw-medium);
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }
  .home__hero-sub {
    font-size: var(--fs-body);
    color: var(--text-tertiary);
    margin-top: var(--sp-2);
  }
  .home__hero-metrics {
    display: flex;
    gap: var(--sp-8);
    margin-top: var(--sp-5);
  }
  .home__hero-metric {
    display: flex;
    flex-direction: column;
  }
  .home__hero-metric b {
    font-size: var(--fs-metric);
    font-weight: var(--fw-medium);
    letter-spacing: -0.04em;
    color: var(--text-primary);
    white-space: nowrap;
  }
  .home__hero-metric i {
    font-style: normal;
    font-size: var(--fs-label);
    color: var(--text-muted);
    margin-top: 2px;
    white-space: nowrap;
  }
  .home__hero-scene {
    position: absolute;
    right: 214px;
    bottom: 0;
    width: 300px;
    height: 150px;
    opacity: 0.9;
    pointer-events: none;
  }
  .home__hero-cta {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    flex: 0 0 172px;
  }
  .home__hero-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    height: 40px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--primary-cta);
    color: var(--text-on-primary);
    font-family: inherit;
    font-size: var(--fs-button);
    font-weight: var(--fw-medium);
    cursor: pointer;
    box-shadow: var(--shadow-cta);
  }
  .home__hero-btn:hover {
    background: var(--primary-cta-hover);
  }
  .home__hero-btn.is-ghost {
    background: var(--surface-1);
    color: var(--text-secondary);
    border: var(--border-default);
    box-shadow: none;
  }
  .home__hero-btn.is-ghost:hover {
    color: var(--text-primary);
    border-color: var(--primary-line);
  }
  /* 主栏 + 右栏 */
  .home__layout {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: var(--sp-4);
  }
  .home__main {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    min-width: 0;
  }
  /* 两侧已有侧栏导航，次入口与侧栏重复 → 桌面隐藏，避免功能冗余 */
  .home__quick {
    display: none;
  }
  .home__blk {
    display: flex;
  }
  .home__exam,
  .home__tools {
    display: flex;
  }
  .home__aside {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    min-width: 0;
  }
  .home__aside-title.is-sep {
    display: block;
    margin-top: var(--sp-2);
  }
}

/* ==========================================================================
   开场：内容错位级联（仅当 <html> 带 is-enter 时跑一次）
   ---------------------------------------------------------------------------
   延迟是相对「开屏层交接完成」的时刻；未播入场时这些规则不生效，页面直接呈现。
   桌面端的 Hero / 今日任务 / 最近记录、移动端的次入口 / 信息位都在这里排队。
   ========================================================================== */
html.is-enter .home__hero,
html.is-enter .home__card,
html.is-enter .home__quick,
html.is-enter .home__info,
html.is-enter .home__blk,
html.is-enter .home__aside {
  animation: homeEnterIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
}
html.is-enter .home__hero { animation-delay: 0s; }
html.is-enter .home__card:nth-child(1) { animation-delay: 0.06s; }
html.is-enter .home__card:nth-child(2) { animation-delay: 0.12s; }
html.is-enter .home__card:nth-child(3) { animation-delay: 0.18s; }
html.is-enter .home__card:nth-child(4) { animation-delay: 0.24s; }
html.is-enter .home__quick { animation-delay: 0.30s; }
html.is-enter .home__info { animation-delay: 0.38s; }
html.is-enter .home__blk:nth-of-type(1) { animation-delay: 0.46s; }
html.is-enter .home__blk:nth-of-type(2) { animation-delay: 0.54s; }
html.is-enter .home__aside { animation-delay: 0.34s; }

@keyframes homeEnterIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  html.is-enter .home__hero,
  html.is-enter .home__card,
  html.is-enter .home__quick,
  html.is-enter .home__info,
  html.is-enter .home__blk,
  html.is-enter .home__aside { animation: none; }
}
</style>
