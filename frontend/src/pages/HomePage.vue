<template>
  <div class="zy-container zy-page home">
    <HomeBackground />

    <!-- 站内功能搜索（2026-10-10 用户拍板）：首页顶部，聚焦展开下拉面板 -->
    <div ref="searchEl" class="home__search">
      <div class="home__search-box">
        <UiIcon name="search" :size="18" class="home__search-ico" />
        <input
          v-model="searchQ"
          class="home__search-input"
          type="text"
          placeholder="搜功能：比如「错题」「老师」「复习」"
          @focus="searchOpen = true"
          @input="onSearchInput"
          @keydown.enter="onSearchEnter"
          @keydown.esc="searchOpen = false"
        />
        <button v-if="searchQ" type="button" class="home__search-clear" aria-label="清空" @click="searchQ = ''">×</button>
      </div>
      <Transition name="home-search">
        <div v-if="searchOpen" class="home__search-panel">
          <template v-if="!searchQ.trim()">
            <p class="home__search-hint">猜你想搜</p>
            <div class="home__search-quick">
              <button v-for="e in QUICK_ENTRIES" :key="e.title" type="button"
                      class="home__search-chip" @click="goSearch(e.path)">
                <UiIcon :name="e.icon" :size="14" />{{ e.title }}
              </button>
            </div>
          </template>
          <template v-else>
            <button v-for="r in searchResults" :key="r.title" type="button"
                    class="home__search-item" @click="goSearch(r.path)">
              <UiIcon :name="r.icon" :size="16" class="home__search-item-ico" />
              <span class="home__search-item-main">
                <b>{{ r.title }}</b><i>{{ r.desc }}</i>
              </span>
              <span class="home__search-item-go">进入 →</span>
            </button>
            <div v-if="!searchResults.length" class="home__search-empty">
              <p>没找到「{{ searchQ }}」，试试下面这些</p>
              <div class="home__search-quick">
                <button v-for="e in QUICK_ENTRIES.slice(0, 4)" :key="e.title" type="button"
                        class="home__search-chip" @click="goSearch(e.path)">
                  <UiIcon :name="e.icon" :size="14" />{{ e.title }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </Transition>
    </div>

    <!-- 桌面 Hero（v3 定稿 2026-10-10）：左侧问候+动态副标题+4 指标卡横排；右侧紧凑双卡竖排。
         帆船海浪贴图桌面端删除；移动端沿用全屏背景（贴图在背景层里，不受影响） -->
    <section class="home__hero">
      <div class="home__hero-txt">
        <h1 class="home__hero-title">{{ greeting }}</h1>
        <p class="home__hero-sub">{{ heroSub }}</p>
        <div class="home__hero-stats">
          <span v-for="m in heroMetrics" :key="m.k" class="home__hero-stat" :class="m.cls">
            <b :class="{ 'is-long': m.v.length > 7 }">{{ m.v }}</b><i>{{ m.k }}</i>
          </span>
        </div>
      </div>
      <div class="home__hero-entries">
        <button type="button" class="home__entry" @click="go(ROUTES.report)">
          <span class="home__entry-ico is-blue">
            <UiIcon name="data" :size="18" />
          </span>
          <span class="home__entry-main">
            <b>AI 学情报告</b>
            <i>学过什么 · 薄弱在哪 · 接下来学什么</i>
            <em>查看报告 →</em>
          </span>
        </button>
        <button type="button" class="home__entry" @click="adviceOpen = !adviceOpen">
          <span class="home__entry-ico is-green">
            <UiIcon name="sparkle" :size="18" />
          </span>
          <span class="home__entry-main">
            <b>今日学习建议</b>
            <i>结合课表与薄弱点，规划今天怎么学</i>
            <em>{{ adviceOpen ? '收起建议 ↑' : '展开建议 →' }}</em>
          </span>
        </button>
      </div>
    </section>

    <!-- 移动端（<1024px，Hero 不渲染）：今日横幅（学情报告大入口 + 今日建议小按钮，合并成一条渐变横幅） -->
    <div class="home__m-entries">
      <button type="button" class="home__today-report" @click="go(ROUTES.report)">
        <span class="home__today-ico"><UiIcon name="data" :size="20" /></span>
        <span class="home__today-main">
          <b>AI 学情报告</b>
          <i>学过什么 · 薄弱在哪 · 接下来学什么</i>
        </span>
      </button>
      <span class="home__today-sep" aria-hidden="true"></span>
      <button type="button" class="home__today-advice" @click="adviceOpen = !adviceOpen">
        <UiIcon name="sparkle" :size="16" />
        <span>今日建议</span>
        <em>{{ adviceOpen ? '↑' : '→' }}</em>
      </button>
    </div>

    <!-- 今日学习建议（首页就地展开，AI 点击才生成） -->
    <DailyAdvicePanel :open="adviceOpen" :due="pendingReview" :next-chapter="teachNext" />

    <div class="home__layout">
      <div class="home__main">
        <!-- ① 主功能大卡（一页 4 个，无轮播 —— 原型 A1②；图案为样图定稿双色版；第三张为 AI 聚合入口） -->
        <div class="home__cards">
          <div v-for="c in cards" :key="c.key" class="home__card-cell">
            <button
              type="button"
              class="home__card"
              :style="{ '--c': c.color, '--cb': c.border }"
              :aria-expanded="c.menu ? aiOpen : undefined"
              @click="onCardClick(c, $event)"
            >
              <span v-if="badges[c.key]" class="home__card-badge" :class="{ 'is-hot': c.hotBadge && badges[c.key] !== '0' }">{{ badges[c.key] }}</span>
              <span class="home__card-icon"><CardArt :name="c.icon" /></span>
              <!-- 桌面=完整标题；移动横排=精简标题（short），靠显隐切换而非改共享数据 -->
              <span class="home__card-name home__card-name--full">{{ c.label }}</span>
              <span class="home__card-name home__card-name--short">{{ c.short || c.label }}</span>
              <span class="home__card-sub">{{ c.sub }}</span>
            </button>
          </div>
        </div>

        <!-- AI 学习中心弹层：Teleport 到 body（避开首页 z-index:1 的层叠上下文，确保盖过伴学角色层 900） -->
        <Teleport to="body">
          <div v-if="aiOpen" ref="popEl" class="home__card-pop" :class="{ 'is-up': popUp }" :style="popStyle" role="menu">
            <span class="home__card-pop-head">选择要进入的 AI 模块</span>
            <button
              v-for="m in aiMenu"
              :key="m.path"
              type="button"
              class="home__pop-item"
              role="menuitem"
              :style="{ '--c': m.color }"
              @click="goAi(m.path)"
            >
              <span class="home__pop-ico"><UiIcon :name="m.icon" :size="20" /></span>
              <span class="home__pop-main"><b>{{ m.label }}</b><i>{{ m.sub }}</i></span>
              <span class="home__pop-go">进入</span>
            </button>
          </div>
        </Teleport>

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

        <!-- ③ 信息条（考试倒计时只在右侧「今日概览」展示，此处不重复；玻璃卡透出背景） -->
        <div class="home__infos">
          <button
            v-for="p in infoPills"
            :key="p.key"
            type="button"
            class="home__info"
            :style="{ '--c': p.color }"
            @click="go(p.path)"
          >
            <span class="home__info-ico"><UiIcon :name="p.icon" :size="18" /></span>
            <span class="home__info-main">
              <span class="home__info-title">{{ p.title }}</span>
              <span class="home__info-sub">{{ p.sub }}</span>
            </span>
            <span class="home__info-action">{{ p.action }} →</span>
          </button>
        </div>

        <!-- ④ 今日复习任务（桌面专属：素行 + 只展示到期优先 3 条） -->
        <section v-if="todoList.length" class="home__blk home__todo">
          <div class="home__blk-head">
            <h2 class="t-h3">今日复习任务</h2>
            <span class="home__blk-cnt">{{ todoList.length }} 条待处理</span>
            <button type="button" class="home__blk-more" @click="go(ROUTES.wrongbook)">查看全部 →</button>
          </div>
          <div class="home__todo-list">
            <div v-for="it in todoList" :key="it.id" class="home__trow">
              <div class="home__trow-q">
                <b>{{ it.title }}</b>
                <span class="home__trow-sub">{{ it.source }}<template v-if="it.kp"> · {{ it.kp }}</template></span>
              </div>
              <span class="home__trow-bar"><i :style="{ width: it.mastery + '%' }" /></span>
              <span class="home__trow-pct">{{ it.mastery }}%</span>
              <span class="home__due" :class="it.dueClass">{{ it.due }}</span>
              <button type="button" class="home__trow-go" @click="startReview(it)">{{ it.action }} →</button>
            </div>
          </div>
          <div v-if="todoRest" class="home__todo-foot">
            还有 <b>{{ todoRest.n }} 条</b>未到期<template v-if="todoRest.label">，{{ todoRest.label }}</template>
          </div>
        </section>

        <!-- ⑤ 新用户空态引导（无复习任务且无记录时出现，替代空白） -->
        <section v-if="showStarter" class="home__blk home__starter">
          <div class="home__blk-head">
            <h2 class="t-h3">从这里开始</h2>
            <span class="home__blk-chip">新手引导</span>
          </div>
          <div class="home__starter-list">
            <button
              v-for="s in starters"
              :key="s.path"
              type="button"
              class="home__starter-item"
              :style="{ '--c': s.color }"
              @click="go(s.path)"
            >
              <span class="home__starter-ico"><UiIcon :name="s.icon" :size="20" /></span>
              <b>{{ s.label }}</b>
              <span class="home__starter-desc">{{ s.desc }}</span>
              <em>{{ s.action }} →</em>
            </button>
          </div>
        </section>

        <!-- ⑥ 最近学习记录（桌面专属） -->
        <section v-if="recentList.length" class="home__blk home__recent">
          <div class="home__blk-head">
            <h2 class="t-h3">最近学习记录</h2>
            <button type="button" class="home__blk-more" @click="go(ROUTES.records)">全部记录 →</button>
          </div>
          <div v-for="r in recentList" :key="r.id" class="home__rec" :style="{ '--c': r.color }">
            <span class="home__rec-ic"><UiIcon :name="r.icon" :size="14" /></span>
            <span class="home__rec-main">
              <b><MathText :content="r.titleTex || r.title" /></b>
              <i>{{ r.sub }}</i>
            </span>
            <span class="home__rec-time">{{ r.time }}</span>
            <button type="button" class="home__rec-go" @click="go(r.path)">查看 →</button>
          </div>
        </section>
      </div>

      <!-- 桌面专属：今日概览侧栏（工作台增强，移动端隐藏；玻璃卡透出背景） -->
      <aside class="home__aside">
        <div class="home__aside-title">今日概览</div>
        <div class="home__aside-grid">
          <span class="home__aside-metric"><b>{{ todayMin }}</b><i>今日分钟</i></span>
          <span class="home__aside-metric"><b>{{ todayQ }}</b><i>今日题量</i></span>
          <span class="home__aside-metric"><b>{{ pendingReview }}</b><i>待巩固</i></span>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiIcon from '../ui/UiIcon.vue'
import CardArt from '../ui/CardArt.vue'
import HomeBackground from '../ui/HomeBackground.vue'
import ReminderCenter from '../ui/ReminderCenter.vue'
import SetupWizard from '../components/SetupWizard.vue'
import { ROUTES, path } from '../lib/routes.js'
import { QUICK_ENTRIES, searchSite } from '../lib/siteSearch.js'
import { onBootDone, startEnterSequence } from '../lib/boot.js'
import { getOverview, getMasteryByPoint } from '../book.js'
import { latexToPlain } from '../mathtext'
import { upcomingExams } from '../stores/courseStore'
import { summary as statsSummary } from '../stores/statsStore'
import { recordsRef, RECORD_TYPES } from '../stores/recordsStore'
import { session } from '../stores/sessionStore'
import { bookRef, settingsRef } from '../stores/bookStore'
import { pendingReviewCount, todayQuestions, todayMinutes } from '../lib/homeStats.js'
import { heroSubtitle, nextChapterOf } from '../lib/reportStats.js'
import { toDateStr, daysUntil } from '../lib/termCalc.js'
import { profileRef } from '../profileStore'
import { coursesRef } from '../stores/courseStore'
import DailyAdvicePanel from '../components/DailyAdvicePanel.vue'
import { api } from '../api'

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

/* ---------------- 站内功能搜索（2026-10-10 用户拍板） ---------------- */
const searchQ = ref('')
const searchOpen = ref(false)
const searchResults = ref([])
const searchEl = ref(null)
function onSearchInput() {
  searchResults.value = searchSite(searchQ.value)
}
function goSearch(target) {
  searchOpen.value = false
  searchQ.value = ''
  router.push(target)
}
function onSearchEnter() {
  if (searchResults.value.length) goSearch(searchResults.value[0].path)
}
function onDocClick(e) {
  if (searchEl.value && !searchEl.value.contains(e.target)) searchOpen.value = false
  // AI 学习中心弹层：点卡片本体/浮层内部的都不关（二者各自处理），点别处关闭
  const t = e.target
  const inside = t && t.closest && (t.closest('.home__card-pop') || t.closest('.home__card-cell'))
  if (aiOpen.value && !inside) aiOpen.value = false
}

/* ---------------- ① 主功能大卡 ---------------- */
const cards = [
  { key: 'capture', label: '拍照搜题', icon: 'camera', color: '#3D6FA8', border: '#a9c9e8', path: ROUTES.capture, sub: '拍一道，AI 讲清每一步思路' },
  { key: 'book', label: '错题学习', icon: 'book', color: '#6B5B95', border: '#c3bcee', path: ROUTES.wrongbook, sub: '按遗忘曲线复习巩固记忆', hotBadge: true },
  { key: 'chat', label: 'AI 学习中心', short: 'AI 中心', icon: 'aiStar', color: '#B5722A', border: '#e4c08a', path: ROUTES.chat, sub: '对话 · 课堂 · 伴学，都在这', menu: true },
  { key: 'tools', label: '学习工具', icon: 'wand', color: '#6F57F0', border: '#b9aef0', path: ROUTES.tools, sub: '公式·代码·速查一站' },
]

/* AI 学习中心弹层（排序：伴学 → 课堂 → 对话，2026-10-11 用户拍板） */
const aiMenu = [
  { label: 'AI 伴学', icon: 'companion', color: '#B5722A', path: ROUTES.companion, sub: '陪你学习的小伙伴，能问能聊' },
  { label: 'AI 课堂', icon: 'blackboard', color: '#3D6FA8', path: ROUTES.teacher, sub: '老师带着学，逐个知识点过关' },
  { label: 'AI 对话', icon: 'chatDots', color: '#6B5B95', path: ROUTES.chat, sub: '随时问，逐字讲清楚' },
]
const aiOpen = ref(false)
const aiRect = ref(null)
const popEl = ref(null)
const popH = ref(0)
/** 是否向上弹（供箭头方向切换） */
const popUp = computed(() => {
  const r = aiRect.value
  if (!r || typeof window === 'undefined') return false
  const h = popH.value || 232
  return r.bottom + 8 + h > window.innerHeight - 8
})
/** 短震动反馈（移动端；桌面无振动硬件自动忽略） */
function buzz(ms = 15) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch (e) {
    /* 忽略：部分浏览器/WebView 不支持 */
  }
}
function onCardClick(c, e) {
  buzz()
  if (c.menu) {
    const el = e && e.currentTarget
    if (el && !aiOpen.value) {
      const r = el.getBoundingClientRect()
      aiRect.value = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }
    aiOpen.value = !aiOpen.value
    return
  }
  go(c.path)
}
/** 弹层位置（fixed 坐标：移动端左对齐卡片、桌面右对齐卡片 320px 宽）
 *  下方空间不足时自动向上弹（翻转），避免低处卡片被视口裁掉 */
const popStyle = computed(() => {
  const r = aiRect.value
  if (!r) return {}
  const vw = typeof window === 'undefined' ? 390 : window.innerWidth
  const vh = typeof window === 'undefined' ? 844 : window.innerHeight
  const w = vw >= 768 ? 320 : Math.min(320, vw * 0.88)
  const h = popH.value || 232
  const up = r.bottom + 8 + h > vh - 8
  const top = up ? Math.max(8, r.top - 8 - h) : r.bottom + 8
  const left = vw >= 768 ? Math.max(8, r.right - w) : Math.max(8, Math.min(r.left, vw - w - 8))
  return { left: `${left}px`, top: `${top}px`, width: `${w}px` }
})
function goAi(target) {
  aiOpen.value = false
  buzz(20)
  router.push(target)
}

/* 四卡实时角标：拍照=今日已拍数 / 错题=待巩固数 / AI 对话=追问记录数 / 工具=工具数；常显（含 0），hot 红色仅在有待巩固时 */
const followupCount = computed(() => (records.value || []).filter((r) => r && r.type === 'followup').length)
const badges = computed(() => ({
  capture: `${todayQ.value || 0}`,
  book: `${pendingReview.value || 0}`,
  chat: `${followupCount.value || 0}`,
  tools: '9',
}))

/* ---------------- ② 次入口（横滑两页） ----------------
 * 2026-10-13：补「自测练习 / 模拟考试」两个一级入口（移动端此前要从错题页二级进、模拟考试无入口）；
 * 「账号同步」移出（我的 Tab + 侧栏都有，横排里最弱）——两页仍各 6 项，桌面平铺 12 项 */
const quickP1 = [
  { label: 'AI 课堂', icon: 'teacher', path: ROUTES.teacher },
  { label: '自测练习', icon: 'target', path: '/practice/original' },
  { label: '模拟考试', icon: 'clipboard', path: ROUTES.simExam },
  { label: '课程表', icon: 'schedule', path: ROUTES.timetable },
  { label: '知一社区', icon: 'chat', path: ROUTES.community },
  { label: '考试安排', icon: 'clipboard', path: ROUTES.exams },
]
const quickP2 = [
  { label: '班级', icon: 'users', path: ROUTES.classPage },
  { label: '学习数据', icon: 'data', path: ROUTES.data },
  { label: '学习记录', icon: 'history', path: ROUTES.records },
  { label: '成就殿堂', icon: 'sparkle', path: ROUTES.achievements },
  { label: '产品介绍', icon: 'info', path: ROUTES.about },
  { label: '帮助反馈', icon: 'help', path: ROUTES.help },
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

/* ---------------- ③ 信息条（考试倒计时只在右侧「今日概览」展示，这里不重复） ---------------- */
const infoPills = computed(() => {
  const list = []
  if (stats.value.settings && stats.value.settings.goalEnabled) {
    const target = Number(stats.value.settings.goalQuestions) || 0
    list.push({
      key: 'goal',
      icon: 'target',
      color: '#6F57F0',
      title: `今日已做 ${todayQ.value} / ${target} 题`,
      sub: target > todayQ.value ? `再做 ${target - todayQ.value} 题就达标` : '今日目标已达成',
      action: '继续',
      path: ROUTES.data,
    })
  }
  if (pendingReview.value > 0) {
    list.push({
      key: 'review',
      icon: 'refresh',
      color: '#4A7A63',
      title: `${pendingReview.value} 道错题该复习了`,
      sub: '按遗忘曲线，今天到期（自测入口在错题学习页内）',
      action: '去复习',
      path: ROUTES.wrongbook,
    })
  }
  if (!list.length) {
    list.push({
      key: 'start',
      icon: 'camera',
      color: '#3D6FA8',
      title: '拍一道题，开始你的学习',
      sub: 'AI 讲清思路，做错的题自动进错题本',
      action: '去拍题',
      path: ROUTES.capture,
    })
  }
  return list
})

/* ---------------- 桌面端（≥1024px）工作台数据 ---------------- */
// 问候语（按时段 + 当前账号）
const greeting = computed(() => {
  const h = new Date().getHours()
  const word = h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  return `${word}，${session.userId || '同学'}`
})
const heroSub = computed(() =>
  heroSubtitle({ pendingReview: pendingReview.value, todayQuestions: todayQ.value }))
const overview = computed(() => getOverview(book.value))
/** 掌握知识点数：有练习记录且正确率 ≥60% 的知识点 */
const masteredKPs = computed(() =>
  getMasteryByPoint(book.value).filter((p) => p.quiz > 0 && p.mastery >= 60).length)
/** 累计做题：全部讲解/自测/练习记录条数 */
const totalQuestions = computed(() =>
  (records.value || []).filter((r) => r && ['explain', 'quiz', 'practice'].includes(r.type)).length)
/** 累计时长（分钟合计 → 友好展示） */
const totalMinutes = computed(() =>
  (records.value || []).reduce((s, r) => s + (Number(r && r.minutes) || 0), 0))
function fmtDuration(min) {
  const m = Math.round(Number(min) || 0)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小时 ${rest} 分钟` : `${h} 小时`
}
const heroMetrics = computed(() => [
  { k: '连续打卡', v: streak.value > 0 ? `${streak.value} 天` : '0 天', cls: 'is-blue' },
  { k: '掌握知识点', v: `${masteredKPs.value} 个`, cls: 'is-green' },
  { k: '累计做题', v: `${totalQuestions.value} 道`, cls: 'is-amber' },
  { k: '累计时长', v: fmtDuration(totalMinutes.value), cls: 'is-purple' },
])

/* ---------------- 今日学习建议（首页就地展开） ---------------- */
const adviceOpen = ref(false)
const teachNext = ref(null)
let teachNextFetched = false
async function fetchTeachNext() {
  if (teachNextFetched) return
  teachNextFetched = true
  try {
    const r = await api.teachSyllabi()
    const list = r.list || []
    const active = list.find((s) => s.status === 'active') || list[0] || null
    if (active) teachNext.value = nextChapterOf(active)
  } catch {
    /* 未登录/未开课：面板自己有空态 */
  }
}
watch(adviceOpen, (v) => {
  if (v) fetchTeachNext()
})

/** 题目摘要 → 表格里的一行标题（LaTeX 先转 Unicode，避免半截源码） */
function qBrief(text, n = 34) {
  const t = latexToPlain(String(text || '')).replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t || '（无题干）'
}
const DAY = 86400000
/** 今日复习任务：全部候选（到期优先，其次未掌握的按最近到期排） */
const todoAll = computed(() => {
  const now = Date.now()
  const qs = (book.value || []).filter((it) => it && it.kind !== 'note' && !it.mastered)
  const due = qs.filter((it) => !it.reviewAt || it.reviewAt <= now)
  const rest = qs.filter((it) => it.reviewAt && it.reviewAt > now).sort((a, b) => a.reviewAt - b.reviewAt)
  return [...due, ...rest]
})
/** 只展示前 3 条（瘦身：到期优先，未到期折进底部一行） */
const todoList = computed(() => todoAll.value.slice(0, 3).map((it) => {
  const now = Date.now()
  const isDue = !it.reviewAt || it.reviewAt <= now
  const days = Math.round((Number(it.reviewAt || 0) - now) / DAY)
  const dueLabel = isDue ? '今天到期' : days <= 1 ? '明天' : `${days} 天后`
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
}))
/** 未展示的剩余条数 + 最早到期描述（底部一行小字） */
const todoRest = computed(() => {
  const shown = todoList.value.length
  const restN = todoAll.value.length - shown
  if (restN <= 0) return null
  const now = Date.now()
  const next = todoAll.value.slice(shown).find((it) => it.reviewAt && it.reviewAt > now)
  const days = next ? Math.max(1, Math.round((next.reviewAt - now) / DAY)) : null
  return { n: restN, label: days ? `最早 ${days} 天后` : '' }
})
/** 新用户空态：无复习任务且无学习记录时，展示「从这里开始」引导卡 */
const showStarter = computed(() => todoAll.value.length === 0 && (records.value || []).length === 0)
const starters = [
  { label: '拍第一道题', icon: 'camera', color: '#3D6FA8', desc: '拍下不会的题，AI 一步步讲清思路，错题自动进错题本', action: '去拍题', path: ROUTES.capture },
  { label: '去 AI 课堂', icon: 'teacher', color: '#B5722A', desc: '老师带着学，逐个知识点过关，学完自动安排测验', action: '开始上课', path: ROUTES.teacher },
  { label: '设置我的课程表', icon: 'schedule', color: '#4A7A63', desc: '填上课表和考试日期，考试倒计时、今日建议自动生成', action: '去设置', path: ROUTES.timetable },
]
/** 最近记录图标淡色底（按记录类型着色，与四卡色板一致） */
const REC_COLORS = { explain: '#3D6FA8', followup: '#B5722A', quiz: '#6B5B95', save: '#4A7A63', debug: '#6F57F0', teach: '#B5722A' }
/** 最近学习记录（取本地 3 条） */
const recentList = computed(() => {
  return (records.value || []).slice(0, 3).map((r) => {
    const meta = RECORD_TYPES[r.type] || {}
    const bits = [meta.label, r.brief, r.correct === true ? '正确' : r.correct === false ? '错误' : '',
      r.minutes ? r.minutes + ' 分钟' : ''].filter(Boolean)
    return {
      id: r.id,
      icon: meta.icon || 'history',
      color: REC_COLORS[r.type] || '#3D6FA8',
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

function onScrollOrResize() {
  aiOpen.value = false
}
/* 弹层渲染后量一次真实高度：用于「下方放不下就向上弹」的翻转判断 */
watch(aiOpen, async (v) => {
  if (!v) return
  await nextTick()
  if (popEl.value) popH.value = popEl.value.offsetHeight
})
function onKeydown(e) {
  if (e.key === 'Escape') aiOpen.value = false
}

onBeforeUnmount(() => {
  if (cancelEnter) cancelEnter()
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
  window.removeEventListener('keydown', onKeydown)
})

onMounted(() => {
  document.addEventListener('click', onDocClick)
  // AI 学习中心弹层是 fixed 定位：滚动/改窗口尺寸/按 Esc 时收起，避免位置漂移
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
  window.addEventListener('keydown', onKeydown)
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

/* ---------------- 站内功能搜索（2026-10-10 用户拍板） ---------------- */
.home__search { position: relative; z-index: 20; max-width: 640px; width: 100%; margin: 18px auto 4px; }
.home__search-box {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px; border: 1px solid var(--line, #dbe3ec); border-radius: 16px;
  background: var(--glass, var(--surface)); box-shadow: 0 4px 18px rgba(0,0,0,.05);
  transition: border-color .2s, box-shadow .2s;
}
.home__search-box:focus-within { border-color: var(--brand, #3d6a7a); box-shadow: 0 6px 24px rgba(0,0,0,.08); }
.home__search-ico { flex: none; color: var(--text-3, #8895a6); }
.home__search-input {
  flex: 1; min-width: 0; border: 0; background: transparent; outline: none;
  font-size: 15px; color: var(--text-1, #22303f);
}
.home__search-input::placeholder { color: var(--text-3, #a0aab8); }
.home__search-clear {
  flex: none; border: 0; background: var(--surface-2, #eef2f6); border-radius: 50%;
  width: 22px; height: 22px; cursor: pointer; color: var(--text-3, #8895a6);
  font-size: 15px; line-height: 1; display: grid; place-items: center;
}
.home__search-panel {
  margin-top: 8px; padding: 12px; border: 1px solid var(--line, #dbe3ec);
  border-radius: 16px; background: var(--surface, #fff);
  box-shadow: 0 12px 40px rgba(0,0,0,.12); display: grid; gap: 4px;
  max-height: 60vh; overflow: auto;
}
.home__search-hint { margin: 2px 4px 8px; font-size: 12px; color: var(--text-3, #8895a6); letter-spacing: .03em; }
.home__search-quick { display: flex; flex-wrap: wrap; gap: 8px; }
.home__search-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px;
  border: 1px solid var(--line, #dbe3ec); border-radius: 999px; cursor: pointer;
  background: var(--surface-2, #f6f8fb); color: var(--text-2, #3c4a59); font-size: 13px;
  transition: border-color .2s, color .2s, transform .2s;
}
.home__search-chip:hover { border-color: var(--brand, #3d6a7a); color: var(--brand, #3d6a7a); transform: translateY(-1px); }
.home__search-item {
  display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px;
  border: 0; border-radius: 12px; background: transparent; cursor: pointer; text-align: left;
  transition: background .15s;
}
.home__search-item:hover { background: var(--surface-2, #f6f8fb); }
.home__search-item-ico { flex: none; color: var(--brand, #3d6a7a); }
.home__search-item-main { flex: 1; min-width: 0; display: grid; gap: 2px; }
.home__search-item-main b { font-size: 14px; color: var(--text-1, #22303f); }
.home__search-item-main i { font-style: normal; font-size: 12px; color: var(--text-3, #8895a6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.home__search-item-go { flex: none; font-size: 12px; color: var(--brand, #3d6a7a); opacity: 0; transition: opacity .2s; }
.home__search-item:hover .home__search-item-go { opacity: 1; }
.home__search-empty p { margin: 4px 4px 10px; font-size: 13px; color: var(--text-3, #8895a6); }
.home-search-enter-active, .home-search-leave-active { transition: opacity .18s ease, transform .18s ease; }
.home-search-enter-from, .home-search-leave-to { opacity: 0; transform: translateY(-6px); }
@media (max-width: 720px) {
  .home__search { margin: 12px auto 2px; padding: 0 4px; }
}

/* ① 大卡：一页 4 个，极浅功能色玻璃底（背景云/水色隐约透出） */
.home__cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-3);
}
.home__card-cell {
  position: relative;
  display: flex;
}
.home__card-cell > .home__card {
  flex: 1;
  min-width: 0;
}
.home__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-1);
  border: var(--border-subtle);
  border-color: var(--cb, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--c) 7%, var(--glass));
  box-shadow: 0 1px 8px rgba(24, 95, 165, 0.06);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.home__card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--c) 45%, transparent);
  box-shadow: 0 6px 18px rgba(24, 95, 165, 0.14);
}
.home__card-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  min-width: 20px;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--c) 14%, #fff);
  border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
  color: color-mix(in srgb, var(--c) 75%, #000);
  font-size: 11px;
  font-weight: var(--fw-medium);
  line-height: 18px;
  text-align: center;
}
.home__card-badge.is-hot {
  background: #fdeaea;
  border-color: #eec3c3;
  color: #c24141;
}
.home__card-icon {
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 底块需在白卡上成形：22% 同色铺底 + 38% 同色细描边（2026-10-11 定稿） */
  background: color-mix(in srgb, var(--c) 22%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 38%, transparent);
}
html[data-theme="dark"] .home__card-icon {
  background: color-mix(in srgb, var(--c) 30%, transparent);
  border-color: color-mix(in srgb, var(--c) 45%, transparent);
}
.home__card-name {
  font-size: var(--fs-caption);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
/* 桌面=完整标题，移动横排=精简标题（互斥显隐） */
.home__card-name--short { display: none; }
.home__card-sub {
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-tertiary);
  text-align: center;
}

/* AI 学习中心弹层（Teleport 到 body：fixed 定位，坐标由 JS 按卡片 rect 计算）
 * z-index 960：需高于伴学角色漂浮层（900）与其聊天面板（950），否则漫游角色会挡住菜单点击 */
.home__card-pop {
  position: fixed;
  z-index: 960;
  padding: 8px;
  border: 1px solid #e4c08a;
  border-radius: 14px;
  background: var(--surface, #fff);
  box-shadow: 0 14px 34px rgba(60, 42, 10, 0.18);
}
.home__card-pop::before {
  content: "";
  position: absolute;
  top: -6px;
  left: 28px;
  width: 12px;
  height: 12px;
  background: var(--surface, #fff);
  border-left: 1px solid #e4c08a;
  border-top: 1px solid #e4c08a;
  border-radius: 2px;
  transform: rotate(45deg);
}
/* 向上弹（flip）：箭头翻到下方，指向卡片 */
.home__card-pop.is-up::before {
  top: auto;
  bottom: -6px;
  border-left: 0;
  border-top: 0;
  border-right: 1px solid #e4c08a;
  border-bottom: 1px solid #e4c08a;
}
.home__card-pop-head {
  display: block;
  padding: 6px 10px 4px;
  font-size: 11px;
  color: var(--text-tertiary, #a09a8c);
  letter-spacing: 0.05em;
}
.home__pop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: 10px;
  background: none;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur) var(--ease), transform 0.12s var(--ease);
}
.home__pop-item:hover {
  background: color-mix(in srgb, var(--c) 8%, transparent);
}
.home__pop-item:active {
  transform: scale(0.96);
}
.home__pop-ico {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--c) 12%, #fff);
  color: var(--c);
}
.home__pop-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.home__pop-main b {
  font-size: 13.5px;
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.home__pop-main i {
  font-style: normal;
  margin-top: 2px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-tertiary);
}
.home__pop-go {
  flex: none;
  margin-left: auto;
  padding: 4px 9px;
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--c) 6%, #fff);
  color: color-mix(in srgb, var(--c) 78%, #000);
  font-size: 12px;
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
/* 暗色主题：描边与图标底随主题走 */
html[data-theme="dark"] .home__card-pop,
html[data-theme="dark"] .home__card-pop::before {
  border-color: rgba(228, 192, 138, 0.45);
}
html[data-theme="dark"] .home__pop-ico {
  background: color-mix(in srgb, var(--c) 22%, transparent);
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
/* 标签不折行（2026-10-13：移动端「知一社区/考试安排」等 4 字标签曾折成两行） */
.home__ico span {
  white-space: nowrap;
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

/* ③ 信息条：多条胶囊并列（考试倒计时只在右侧「今日概览」展示，此处不重复） */
.home__infos {
  margin-top: var(--sp-2);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--sp-3);
}
.home__info {
  /* 按钮默认 shrink-to-fit：文案变长（如「N 道错题该复习了」）会撑破窄屏，锁成容器宽 */
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 11px var(--sp-4);
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--glass);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.home__info:hover {
  border-color: color-mix(in srgb, var(--c, var(--primary)) 40%, transparent);
  transform: translateY(-1px);
}
.home__info-ico {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--c, var(--primary-text));
  background: color-mix(in srgb, var(--c, var(--primary)) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--c, var(--primary)) 30%, transparent);
}
html[data-theme='dark'] .home__info-ico {
  color: color-mix(in srgb, var(--c, var(--primary)) 55%, #fff);
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

/* ---------------- Hero 入口双卡（2026-10-10 v3：桌面在 Hero 右侧竖排 / 移动横排兜底） ---------------- */
.home__m-entries {
  display: flex;
  align-items: stretch;
  margin-top: var(--sp-3);
  border-radius: var(--radius-lg);
  background: linear-gradient(120deg, #8a6bff 0%, #6f57f0 55%, #5b47d6 100%);
  color: #fff;
  overflow: hidden;
  position: relative;
  z-index: 1;
  box-shadow: 0 8px 24px -12px rgba(91, 71, 214, 0.55);
}
/* 今日横幅：左=学情报告大入口（flex:1），右=今日建议小按钮（竖排），中间分隔线 */
.home__today-report {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 15px 16px;
  background: none;
  border: 0;
  color: #fff;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.home__today-ico {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}
.home__today-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.home__today-main b {
  font-size: 16px;
  font-weight: var(--fw-semibold);
  letter-spacing: 0.01em;
}
.home__today-main i {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.home__today-sep {
  width: 1px;
  align-self: stretch;
  margin: 12px 0;
  background: rgba(255, 255, 255, 0.22);
}
.home__today-advice {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 16px;
  background: none;
  border: 0;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
}
.home__today-advice span {
  font-size: 12.5px;
  font-weight: var(--fw-medium);
  white-space: nowrap;
}
.home__today-advice em {
  font-style: normal;
  font-size: 11px;
  opacity: 0.75;
}
.home__entry {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: 14px 16px;
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--glass, var(--surface, #fff));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.home__entry:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.home__entry-ico {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}
.home__entry-ico.is-blue {
  background: rgba(24, 95, 165, 0.14);
  color: #185fa5;
}
.home__entry-ico.is-green {
  background: rgba(15, 110, 86, 0.14);
  color: #0f6e56;
}
html[data-theme='dark'] .home__entry-ico.is-blue {
  background: rgba(133, 183, 235, 0.16);
  color: #85b7eb;
}
html[data-theme='dark'] .home__entry-ico.is-green {
  background: rgba(93, 202, 165, 0.14);
  color: #5dcaa5;
}
.home__entry-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.home__entry-main b {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.home__entry-main i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  line-height: 1.4;
}
.home__entry-main em {
  font-style: normal;
  font-size: var(--fs-label);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  margin-top: 4px;
  white-space: nowrap;
}
.home__m-entries .home__entry-main em {
  display: none;
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
  /* 大卡：保持竖排（图标+标题+副文案），加宽内边距 */
  .home__card {
    padding: var(--sp-4) var(--sp-3);
  }
  /* 弹层：桌面宽度/位置由 popStyle 内联给出，此处只需把箭头挪到卡片右半区 */
  .home__card-pop::before {
    left: auto;
    right: 46px;
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
  /* 横排金刚区显示精简标题、隐藏完整标题 */
  .home__card-name--full { display: none; }
  .home__card-name--short { display: inline-block; }
  /* 四功能卡：1×4 横排金刚区（2026-10-13，原 2×2 大卡）——图标块上、标题下，去副标题，紧凑 */
  .home__cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-2);
    /* 与上方今日横幅拉开间距（2026-10-13 用户反馈挨太近；桌面由 home__main gap 管，不受影响） */
    margin-top: var(--sp-4);
  }
  .home__card {
    padding: 12px 4px 10px;
    gap: 8px;
    min-height: 0;
  }
  .home__card-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }
  .home__card-icon :deep(svg.card-art) {
    width: 26px;
    height: 26px;
  }
  .home__card-name {
    font-size: 12px;
    font-weight: var(--fw-medium);
    white-space: nowrap;
  }
  .home__card-sub {
    display: none;
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

/* 今日复习任务：素行列表（2026-10-11 瘦身版：去色块底，颜色只留「今天到期」） */
.home__blk-cnt {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.home__todo-list {
  display: flex;
  flex-direction: column;
}
.home__trow {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: 11px 2px;
  border-bottom: var(--border-divider-soft);
}
.home__trow:last-child {
  border-bottom: 0;
}
.home__trow-q {
  flex: 1.5;
  min-width: 0;
}
.home__trow-q b {
  display: block;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__trow-sub {
  display: block;
  margin-top: 3px;
  font-size: var(--fs-label);
  color: var(--text-disabled);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__trow-bar {
  flex: 0.7;
  display: block;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.home__trow-bar i {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: #7ea690;
}
.home__trow-pct {
  flex: none;
  width: 30px;
  text-align: right;
  font-size: var(--fs-label);
  color: var(--text-disabled);
}
.home__due {
  flex: none;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  white-space: nowrap;
}
.home__due.is-now {
  color: var(--warning);
  font-weight: var(--fw-medium);
}
.home__trow-go {
  flex: none;
  border: 0;
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  cursor: pointer;
  white-space: nowrap;
}
.home__trow-go:hover {
  text-decoration: underline;
}
.home__todo-foot {
  padding: 9px 2px 2px;
  border-top: var(--border-divider-soft);
  font-size: var(--fs-body-2);
  color: var(--text-muted);
}
.home__todo-foot b {
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}

/* 新用户空态引导（无任务无记录时替代空白） */
.home__starter-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
}
.home__starter-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  padding: var(--sp-4);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c) 5%, var(--glass));
  border: 1px solid color-mix(in srgb, var(--c) 20%, transparent);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.home__starter-item:hover {
  border-color: color-mix(in srgb, var(--c) 45%, transparent);
  transform: translateY(-2px);
}
.home__starter-ico {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
}
html[data-theme='dark'] .home__starter-ico {
  color: color-mix(in srgb, var(--c) 55%, #fff);
}
.home__starter-item b {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.home__starter-desc {
  font-size: var(--fs-label);
  color: var(--text-muted);
  line-height: 1.55;
}
.home__starter-item em {
  font-style: normal;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--c);
}
html[data-theme='dark'] .home__starter-item em {
  color: color-mix(in srgb, var(--c) 55%, #fff);
}

/* 最近学习记录（素行 + 淡色图标底） */
.home__rec {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 10px 2px;
  border-bottom: var(--border-divider-soft);
}
.home__rec:last-child {
  border-bottom: 0;
}
.home__rec-ic {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--c, var(--primary)) 10%, transparent);
  color: var(--c, var(--primary-text));
}
html[data-theme='dark'] .home__rec-ic {
  background: color-mix(in srgb, var(--c, var(--primary)) 20%, transparent);
  color: color-mix(in srgb, var(--c, var(--primary)) 55%, #fff);
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
  color: var(--text-muted);
  white-space: nowrap;
}
.home__rec-go {
  flex: none;
  border: 0;
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  cursor: pointer;
  white-space: nowrap;
}
.home__rec-go:hover {
  text-decoration: underline;
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
  /* 桌面：不再全屏出血，背景收进 Hero；限宽 1440 居中 + 横向留白（2026-10-11 侧边距方案） */
  .home {
    max-width: 1440px;
    margin-inline: auto;
    padding-inline: clamp(20px, 3vw, 40px);
    margin-top: 0;
    padding-top: 0;
    padding-bottom: var(--sp-6);
    gap: var(--sp-4);
  }
  /* 搜功能已搬到全局顶栏：桌面端隐藏首页搜索框，Hero 上移 */
  .home__search {
    display: none;
  }
  /* 桌面端隐藏全屏背景层（改用 Hero 内部的小场景） */
  .home :deep(.hbg) {
    display: none;
  }
  .home__hero {
    display: flex;
    align-items: stretch;
    gap: var(--sp-6);
    margin-top: var(--sp-5);
    position: relative;
    overflow: hidden;
    padding: var(--sp-6) 72px var(--sp-6) 64px;
    border-radius: var(--radius-xl);
    /* 2026-10-13 品牌化：在原渐变上叠加品牌紫柔光（左上）+ 暖橘柔光（右上），
       与移动端光斑、开屏动画、页脚标语串成一条线（原淡蓝紫暖基调保留） */
    background:
      radial-gradient(120% 100% at 12% -12%, rgba(124, 92, 255, 0.18), rgba(124, 92, 255, 0) 55%),
      radial-gradient(80% 90% at 100% 0%, rgba(250, 199, 117, 0.15), rgba(250, 199, 117, 0) 55%),
      linear-gradient(120deg, #e8effc 0%, #f3f0fd 55%, #fdf3ec 100%);
    border: 1px solid #b8cfe8;
    box-shadow: 0 2px 14px rgba(24, 95, 165, 0.08);
  }
  html[data-theme='dark'] .home__hero {
    background: linear-gradient(120deg, rgba(38, 48, 78, 0.9) 0%, rgba(46, 40, 74, 0.9) 55%, rgba(58, 44, 40, 0.85) 100%);
    border-color: rgba(133, 183, 235, 0.28);
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.35);
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
  .home__hero-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: var(--sp-5);
    max-width: 640px;
  }
  .home__hero-stat {
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-radius: var(--radius-md);
    padding: 13px 16px;
    min-width: 0;
  }
  .home__hero-stat b {
    font-size: var(--fs-h2, 20px);
    font-weight: var(--fw-medium);
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .home__hero-stat i {
    font-style: normal;
    font-size: var(--fs-label);
    color: var(--text-muted);
    white-space: nowrap;
  }
  /* 累计时长等长数值：自动缩一档字号，避免省略号截断（4 卡横排空间受限） */
  .home__hero-stat b.is-long {
    font-size: 15px;
    letter-spacing: -0.01em;
  }
  .home__hero-stat.is-blue { background: rgba(24, 95, 165, 0.12); border: 1px solid #a9c9e8; }
  .home__hero-stat.is-blue b { color: #185fa5; }
  .home__hero-stat.is-green { background: rgba(15, 110, 86, 0.12); border: 1px solid #9fd4bd; }
  .home__hero-stat.is-green b { color: #0f6e56; }
  .home__hero-stat.is-amber { background: rgba(186, 117, 23, 0.12); border: 1px solid #e4c08a; }
  .home__hero-stat.is-amber b { color: #854f0b; }
  .home__hero-stat.is-purple { background: rgba(83, 74, 183, 0.12); border: 1px solid #c3bcee; }
  .home__hero-stat.is-purple b { color: #534ab7; }
  html[data-theme='dark'] .home__hero-stat.is-blue { background: rgba(133, 183, 235, 0.14); border-color: rgba(133, 183, 235, 0.35); }
  html[data-theme='dark'] .home__hero-stat.is-blue b { color: #85b7eb; }
  html[data-theme='dark'] .home__hero-stat.is-green { background: rgba(93, 202, 165, 0.12); border-color: rgba(93, 202, 165, 0.35); }
  html[data-theme='dark'] .home__hero-stat.is-green b { color: #5dcaa5; }
  html[data-theme='dark'] .home__hero-stat.is-amber { background: rgba(250, 199, 117, 0.12); border-color: rgba(250, 199, 117, 0.35); }
  html[data-theme='dark'] .home__hero-stat.is-amber b { color: #fac775; }
  html[data-theme='dark'] .home__hero-stat.is-purple { background: rgba(175, 169, 236, 0.14); border-color: rgba(175, 169, 236, 0.4); }
  html[data-theme='dark'] .home__hero-stat.is-purple b { color: #afa9ec; }
  /* 右侧入口双卡（v3：紧凑竖排，填满桌面右侧空白） */
  .home__hero-entries {
    position: relative;
    z-index: 1;
    flex: 0 0 270px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .home__hero-entries .home__entry {
    flex: 1;
    background: var(--surface, rgba(255, 255, 255, 0.9));
    border-color: #b8cfe8;
    box-shadow: 0 1px 8px rgba(24, 95, 165, 0.06);
  }
  html[data-theme='dark'] .home__hero-entries .home__entry {
    border-color: rgba(133, 183, 235, 0.28);
    box-shadow: 0 1px 10px rgba(0, 0, 0, 0.3);
  }
  /* 桌面入口在 Hero 里，移动兜底行不再显示 */
  .home__m-entries {
    display: none;
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

/* 今日复习任务：素行列表（2026-10-11 瘦身版：去色块底，颜色只留「今天到期」） */
.home__blk-cnt {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.home__todo-list {
  display: flex;
  flex-direction: column;
}
.home__trow {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: 11px 2px;
  border-bottom: var(--border-divider-soft);
}
.home__trow:last-child {
  border-bottom: 0;
}
.home__trow-q {
  flex: 1.5;
  min-width: 0;
}
.home__trow-q b {
  display: block;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__trow-sub {
  display: block;
  margin-top: 3px;
  font-size: var(--fs-label);
  color: var(--text-disabled);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__trow-bar {
  flex: 0.7;
  display: block;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  overflow: hidden;
}
.home__trow-bar i {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: #7ea690;
}
.home__trow-pct {
  flex: none;
  width: 30px;
  text-align: right;
  font-size: var(--fs-label);
  color: var(--text-disabled);
}
.home__due {
  flex: none;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  white-space: nowrap;
}
.home__due.is-now {
  color: var(--warning);
  font-weight: var(--fw-medium);
}
.home__trow-go {
  flex: none;
  border: 0;
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  cursor: pointer;
  white-space: nowrap;
}
.home__trow-go:hover {
  text-decoration: underline;
}
.home__todo-foot {
  padding: 9px 2px 2px;
  border-top: var(--border-divider-soft);
  font-size: var(--fs-body-2);
  color: var(--text-muted);
}
.home__todo-foot b {
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}

/* 新用户空态引导（无任务无记录时替代空白） */
.home__starter-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
}
.home__starter-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  padding: var(--sp-4);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--c) 5%, var(--glass));
  border: 1px solid color-mix(in srgb, var(--c) 20%, transparent);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.home__starter-item:hover {
  border-color: color-mix(in srgb, var(--c) 45%, transparent);
  transform: translateY(-2px);
}
.home__starter-ico {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
}
html[data-theme='dark'] .home__starter-ico {
  color: color-mix(in srgb, var(--c) 55%, #fff);
}
.home__starter-item b {
  font-size: var(--fs-body);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.home__starter-desc {
  font-size: var(--fs-label);
  color: var(--text-muted);
  line-height: 1.55;
}
.home__starter-item em {
  font-style: normal;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--c);
}
html[data-theme='dark'] .home__starter-item em {
  color: color-mix(in srgb, var(--c) 55%, #fff);
}

/* 最近学习记录（素行 + 淡色图标底） */
.home__rec {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 10px 2px;
  border-bottom: var(--border-divider-soft);
}
.home__rec:last-child {
  border-bottom: 0;
}
.home__rec-ic {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--c, var(--primary)) 10%, transparent);
  color: var(--c, var(--primary-text));
}
html[data-theme='dark'] .home__rec-ic {
  background: color-mix(in srgb, var(--c, var(--primary)) 20%, transparent);
  color: color-mix(in srgb, var(--c, var(--primary)) 55%, #fff);
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
  color: var(--text-muted);
  white-space: nowrap;
}
.home__rec-go {
  flex: none;
  border: 0;
  background: none;
  padding: 0;
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  cursor: pointer;
  white-space: nowrap;
}
.home__rec-go:hover {
  text-decoration: underline;
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
  /* 桌面：不再全屏出血，背景收进 Hero；限宽 1440 居中 + 横向留白（2026-10-11 侧边距方案） */
  .home {
    max-width: 1440px;
    margin-inline: auto;
    padding-inline: clamp(20px, 3vw, 40px);
    margin-top: 0;
    padding-top: 0;
    padding-bottom: var(--sp-6);
    gap: var(--sp-4);
  }
  /* 搜功能已搬到全局顶栏：桌面端隐藏首页搜索框，Hero 上移 */
  .home__search {
    display: none;
  }
  /* 桌面端隐藏全屏背景层（改用 Hero 内部的小场景） */
  .home :deep(.hbg) {
    display: none;
  }
  .home__hero {
    display: flex;
    align-items: stretch;
    gap: var(--sp-6);
    margin-top: var(--sp-5);
    position: relative;
    overflow: hidden;
    padding: var(--sp-6) 72px var(--sp-6) 64px;
    border-radius: var(--radius-xl);
    /* 2026-10-13 品牌化：在原渐变上叠加品牌紫柔光（左上）+ 暖橘柔光（右上），
       与移动端光斑、开屏动画、页脚标语串成一条线（原淡蓝紫暖基调保留） */
    background:
      radial-gradient(120% 100% at 12% -12%, rgba(124, 92, 255, 0.18), rgba(124, 92, 255, 0) 55%),
      radial-gradient(80% 90% at 100% 0%, rgba(250, 199, 117, 0.15), rgba(250, 199, 117, 0) 55%),
      linear-gradient(120deg, #e8effc 0%, #f3f0fd 55%, #fdf3ec 100%);
    border: 1px solid #b8cfe8;
    box-shadow: 0 2px 14px rgba(24, 95, 165, 0.08);
  }
  html[data-theme='dark'] .home__hero {
    background: linear-gradient(120deg, rgba(38, 48, 78, 0.9) 0%, rgba(46, 40, 74, 0.9) 55%, rgba(58, 44, 40, 0.85) 100%);
    border-color: rgba(133, 183, 235, 0.28);
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.35);
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
  .home__hero-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: var(--sp-5);
    max-width: 640px;
  }
  .home__hero-stat {
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-radius: var(--radius-md);
    padding: 13px 16px;
    min-width: 0;
  }
  .home__hero-stat b {
    font-size: var(--fs-h2, 20px);
    font-weight: var(--fw-medium);
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .home__hero-stat i {
    font-style: normal;
    font-size: var(--fs-label);
    color: var(--text-muted);
    white-space: nowrap;
  }
  /* 累计时长等长数值：自动缩一档字号，避免省略号截断（4 卡横排空间受限） */
  .home__hero-stat b.is-long {
    font-size: 15px;
    letter-spacing: -0.01em;
  }
  .home__hero-stat.is-blue { background: rgba(24, 95, 165, 0.12); border: 1px solid #a9c9e8; }
  .home__hero-stat.is-blue b { color: #185fa5; }
  .home__hero-stat.is-green { background: rgba(15, 110, 86, 0.12); border: 1px solid #9fd4bd; }
  .home__hero-stat.is-green b { color: #0f6e56; }
  .home__hero-stat.is-amber { background: rgba(186, 117, 23, 0.12); border: 1px solid #e4c08a; }
  .home__hero-stat.is-amber b { color: #854f0b; }
  .home__hero-stat.is-purple { background: rgba(83, 74, 183, 0.12); border: 1px solid #c3bcee; }
  .home__hero-stat.is-purple b { color: #534ab7; }
  html[data-theme='dark'] .home__hero-stat.is-blue { background: rgba(133, 183, 235, 0.14); border-color: rgba(133, 183, 235, 0.35); }
  html[data-theme='dark'] .home__hero-stat.is-blue b { color: #85b7eb; }
  html[data-theme='dark'] .home__hero-stat.is-green { background: rgba(93, 202, 165, 0.12); border-color: rgba(93, 202, 165, 0.35); }
  html[data-theme='dark'] .home__hero-stat.is-green b { color: #5dcaa5; }
  html[data-theme='dark'] .home__hero-stat.is-amber { background: rgba(250, 199, 117, 0.12); border-color: rgba(250, 199, 117, 0.35); }
  html[data-theme='dark'] .home__hero-stat.is-amber b { color: #fac775; }
  html[data-theme='dark'] .home__hero-stat.is-purple { background: rgba(175, 169, 236, 0.14); border-color: rgba(175, 169, 236, 0.4); }
  html[data-theme='dark'] .home__hero-stat.is-purple b { color: #afa9ec; }
  /* 右侧入口双卡（v3：紧凑竖排，填满桌面右侧空白） */
  .home__hero-entries {
    position: relative;
    z-index: 1;
    flex: 0 0 270px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .home__hero-entries .home__entry {
    flex: 1;
    background: var(--surface, rgba(255, 255, 255, 0.9));
    border-color: #b8cfe8;
    box-shadow: 0 1px 8px rgba(24, 95, 165, 0.06);
  }
  html[data-theme='dark'] .home__hero-entries .home__entry {
    border-color: rgba(133, 183, 235, 0.28);
    box-shadow: 0 1px 10px rgba(0, 0, 0, 0.3);
  }
  /* 桌面入口在 Hero 里，移动兜底行不再显示 */
  .home__m-entries {
    display: none;
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
