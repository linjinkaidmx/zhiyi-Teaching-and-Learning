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

      <!-- 全站页脚标语：内容短则贴视口底、长则沉到内容末尾（ui-shell__col 纵向 flex 的天然行为） -->
      <SiteSlogan />
    </div>

    <BadgeDefs />
    <AchievementToast />
    <AchievementReveal />
    <UiToastHost />
    <UiConfirmHost />
    <CompanionLayer :key="session.epoch" />
  </div>
</template>

<script setup>
import { session } from '../stores/sessionStore.js'
import TopNav from './TopNav.vue'
import DesktopSideNav from './DesktopSideNav.vue'
import DesktopTopBar from './DesktopTopBar.vue'
import AiStatusBar from './AiStatusBar.vue'
import UiToastHost from '../ui/UiToastHost.vue'
import UiConfirmHost from '../ui/UiConfirmHost.vue'
import CompanionLayer from '../components/CompanionLayer.vue'
import SiteSlogan from '../components/SiteSlogan.vue'
import BadgeDefs from '../ui/BadgeDefs.vue'
import AchievementToast from '../ui/AchievementToast.vue'
import AchievementReveal from '../ui/AchievementReveal.vue'
import { ROUTES } from '../lib/routes.js'

/**
 * 应用外壳
 * ---------------------------------------------------------------------------
 * 同一份 DOM 承载两种形态，靠媒体查询切换（不重建组件，避免切换时丢页面状态）：
 *   ≥1024px  左侧竖向导航 + 顶部工具条 + 内容区（桌面工作台）
 *   <1024px  顶部「学习 / 我的」双 Tab（移动端原样，未做任何改动）
 * 2026-10-10：原「全局搜题（点搜索框/Ctrl K 进拍题页）」移除，改为 DesktopTopBar 内嵌的站内搜功能。
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
    /* 2026-10-13 品牌化：桌面端外壳背景叠加品牌紫/暖橘柔光（原来纯 var(--background) 无渐变无光斑，
       会盖死 body 的光斑）；内容列与侧栏间的留白、卡片间隙透出紫氛围 */
    background:
      radial-gradient(55% 45% at 6% -6%, rgba(124, 92, 255, 0.10), rgba(124, 92, 255, 0) 60%),
      radial-gradient(45% 40% at 100% 0%, rgba(250, 199, 117, 0.08), rgba(250, 199, 117, 0) 60%),
      linear-gradient(180deg, #f5f3fc 0%, #faf9fe 45%, #fbfaff 100%);
  }
  .ui-shell__col {
    min-height: 100vh;
  }
  .ui-shell :deep(.ui-topnav) {
    display: none;
  }
}
</style>
