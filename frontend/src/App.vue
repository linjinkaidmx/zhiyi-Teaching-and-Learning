<template>
  <AppShell :active="route.path" :initial="userInitial" @navigate="go">
    <router-view />
  </AppShell>

  <!-- 账号弹窗（全局，由 uiStore 唤起：页面不再需要把事件传回外壳） -->
  <AuthModal v-model="authOpen" :initial-mode="authMode" @auth="onAuth" />

  <!-- 退出落地页：双击返回键退出时，若没有站外历史可退（直接打开本站）则显示 -->
  <div v-if="byeOpen" class="zy-bye">
    <div class="zy-bye__box surface-standard">
      <p class="t-h2">已退出知一</p>
      <p class="t-body-2">可以直接关闭这个标签页了。</p>
      <UiButton variant="primary" @click="reenter">重新进入</UiButton>
    </div>
  </div>
</template>

<script setup>
/**
 * App · 外壳（P6 后所有路由都是 v1 外观，这里只负责：外壳 + 启动初始化 + 账号弹窗）
 * ---------------------------------------------------------------------------
 * 业务状态与逻辑全部在 stores：
 *   sessionStore 登录态 / 双空间 / 云同步 / 数据管理
 *   bookStore    错题本与复习设置
 *   flowStore    拍题讲解流程（含识别状态）
 *   statsStore   打卡 / 成就      profileStore 个人资料与偏好
 *   uiStore      登录弹窗等跨页面 UI 状态
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from './ui/UiButton.vue'
import AppShell from './layouts/AppShell.vue'
import AuthModal from './components/AuthModal.vue'
import { installExitGuard } from './lib/exitGuard.js'
import { ACHIEVEMENT_MAP } from './achievements'
import { getProfile, onProfileChange } from './profileStore'
import { onUnlock } from './statsStore'
import { initSession, adoptLogin } from './stores/sessionStore'
import { ui, closeAuth } from './stores/uiStore'
import { session } from './stores/sessionStore'
import { celebrate } from './stores/achievementStore.js'
import { markBootReady } from './lib/boot.js'
import { setContextProvider } from './statsStore'
import { bookRef } from './stores/bookStore'
import { coursesRef, examsRef } from './stores/courseStore'
import { profileRef } from './profileStore'

/**
 * 注册成就统计上下文：把「错题本掌握数 / 同题最大复习次数 / 课表课程数 / 考试安排数 / 资料是否完善」
 * 实时提供给成就判定（每枚成就的 value(ctx) 从这里取数）。
 */
setContextProvider(() => {
  try {
    const book = (bookRef().value || []).filter((i) => i && i.kind !== 'note')
    const prof = (profileRef() && profileRef().value) || {}
    return {
      mastered: book.filter((i) => i.mastered).length,
      maxQuizPerItem: book.reduce((m, i) => Math.max(m, Number(i.quizCount) || 0), 0),
      streakMax: book.reduce((m, i) => Math.max(m, Number(i.streak) || 0), 0),
      courseCount: ((coursesRef() && coursesRef().value) || []).length,
      examCount: ((examsRef() && examsRef().value) || []).length,
      profileDone: (String(prof.nickname || '').trim() || prof.avatar) ? 1 : 0,
    }
  } catch {
    return {}
  }
})
import { toast } from './ui/toast.js'

const route = useRoute()
const router = useRouter()
const go = (target) => router.push(target)

/** 顶栏头像首字（未登录时用「我」） */
const userInitial = computed(() => {
  const name = session.userId || '我'
  return Array.from(String(name).trim())[0] || '我'
})

/** 账号弹窗（状态在 uiStore，页面可直接唤起） */
const authOpen = computed({
  get: () => ui.authOpen,
  set: (v) => (v ? (ui.authOpen = true) : closeAuth()),
})
const authMode = computed({
  get: () => ui.authMode,
  set: (v) => (ui.authMode = v),
})

async function onAuth({ userId, token }) {
  await adoptLogin({ token, userId })
}

/* ---------------- 启动 ---------------- */
initSession()
onUnlock(showUnlock)
applyFontScale()
onProfileChange(applyFontScale)

/* ---------------- 移动端双击返回键退出 ---------------- */
const byeOpen = ref(false)
let exitGuard = null

function atHome() {
  return route.path === '/' && window.matchMedia('(max-width: 767px)').matches
}

onMounted(() => {
  // 开屏层（index.html 内联）已可见，Vue 渲染完成后通知它交接
  markBootReady()
  exitGuard = installExitGuard({
    isHome: atHome,
    hasModal: () => ui.authOpen,
    closeModal: () => closeAuth(),
    onExit: () => { byeOpen.value = true },
  })
})
onBeforeUnmount(() => exitGuard && exitGuard.destroy())
watch(() => route.path, () => exitGuard && exitGuard.sync())

function reenter() {
  byeOpen.value = false
  window.location.replace(window.location.pathname)
}

/** 解锁成就：轻提示（回填批量解锁只提示一条，避免刷屏） */

/** 正文字号偏好 → 根节点 class（style.css 里定义三档字号） */
function applyFontScale() {
  try {
    const scale = getProfile().prefs.fontScale || 'md'
    const el = document.documentElement
    el.classList.remove('zy-font-sm', 'zy-font-md', 'zy-font-lg')
    el.classList.add('zy-font-' + scale)
  } catch {
    /* 忽略 */
  }
}

/** 解锁成就：分级庆祝（普通/稀有 → 顶部滑入卡；史诗/传说 → 全屏揭晓；历史回填只给汇总提示） */
function showUnlock(keys, src) {
  const list = (keys || []).filter((k) => ACHIEVEMENT_MAP[k])
  if (!list.length) return
  if (src === 'backfill') {
    toast.success(`根据已有学习记录，解锁了 ${list.length} 个成就，去成就殿堂看看`, { duration: 8000 })
    return
  }
  celebrate(list)
}
</script>

<style scoped>
.zy-bye {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--sp-6);
  background: var(--background);
}
.zy-bye__box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-8) var(--sp-6);
  text-align: center;
  max-width: 320px;
}
</style>
