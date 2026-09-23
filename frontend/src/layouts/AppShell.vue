<template>
  <div class="zy-scope ui-shell">
    <!-- 移动端 / 平板：顶部「学习 / 我的」双 Tab（原样保留） -->
    <TopNav :active="active" :initial="initial" :ai-state="aiState" @navigate="$emit('navigate', $event)" />

    <!-- 桌面端（≥1024px）：左侧竖向导航 -->
    <DesktopSideNav :active="active" :initial="initial" :ai-state="aiState" @navigate="$emit('navigate', $event)" />

    <div class="ui-shell__col">
      <!-- 桌面端：顶部工具条（面包屑 + 全局搜题 + 提醒 + 账号） -->
      <DesktopTopBar
        :active="active"
        :initial="initial"
        :remind-dot="remindDot"
        @navigate="$emit('navigate', $event)"
        @search="onSearch"
        @remind="$emit('navigate', ROUTES.home + '?remind=1')"
      />

      <AiStatusBar
        :state="aiState"
        :text="aiText"
        :meta="aiMeta"
        :progress="aiProgress"
        :can-stop="aiCanStop"
        :can-rerun="aiCanRerun"
        @stop="$emit('ai-stop')"
        @rerun="$emit('ai-rerun')"
      />

      <main class="ui-shell__main">
        <slot />
      </main>
    </div>

    <BadgeDefs />
    <AchievementToast />
    <AchievementReveal />
    <UiToastHost />
    <UiConfirmHost />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import TopNav from './TopNav.vue'
import DesktopSideNav from './DesktopSideNav.vue'
import DesktopTopBar from './DesktopTopBar.vue'
import AiStatusBar from './AiStatusBar.vue'
import UiToastHost from '../ui/UiToastHost.vue'
import UiConfirmHost from '../ui/UiConfirmHost.vue'
import BadgeDefs from '../ui/BadgeDefs.vue'
import AchievementToast from '../ui/AchievementToast.vue'
import AchievementReveal from '../ui/AchievementReveal.vue'
import { ROUTES, path } from '../lib/routes.js'
import { useRouter } from 'vue-router'

/**
 * 应用外壳
 * ---------------------------------------------------------------------------
 * 同一份 DOM 承载两种形态，靠媒体查询切换（不重建组件，避免切换时丢页面状态）：
 *   ≥1024px  左侧竖向导航 + 顶部工具条 + 内容区（桌面工作台）
 *   <1024px  顶部「学习 / 我的」双 Tab（移动端原样，未做任何改动）
 * 全局搜题：点击工具条搜索框或按 Ctrl/⌘+K → 进拍题页并聚焦文本输入。
 */
defineProps({
  active: { type: String, default: ROUTES.home },
  initial: { type: String, default: '我' },
  aiState: { type: String, default: 'idle' },
  aiText: { type: String, default: '' },
  aiMeta: { type: String, default: '' },
  aiProgress: { type: Number, default: 0 },
  aiCanStop: { type: Boolean, default: false },
  aiCanRerun: { type: Boolean, default: false },
  remindDot: { type: Boolean, default: false },
})
const emit = defineEmits(['navigate', 'ai-stop', 'ai-rerun'])
const router = useRouter()

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

function onSearch() {
  emit('navigate', path(ROUTES.capture, {}) + '?focus=text')
}

function onKey(e) {
  if (!isDesktop()) return
  const k = String(e.key || '').toLowerCase()
  if ((e.ctrlKey || e.metaKey) && k === 'k') {
    e.preventDefault()
    onSearch()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.ui-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.ui-shell__col {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.ui-shell__main {
  flex: 1;
  min-width: 0;
}

/* 桌面端：侧栏 + 内容列 两栏骨架；移动端顶部双 Tab 在桌面端让位给侧栏 */
@media (min-width: 1024px) {
  .ui-shell {
    flex-direction: row;
    background: var(--background);
  }
  .ui-shell__col {
    min-height: 100vh;
  }
  .ui-shell :deep(.ui-topnav) {
    display: none;
  }
}
</style>
