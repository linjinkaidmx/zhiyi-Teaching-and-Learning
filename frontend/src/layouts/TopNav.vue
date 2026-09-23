<template>
  <header class="ui-topnav" :class="{ 'is-scrolled': scrolled }">
    <div class="zy-container ui-topnav__inner">
      <button class="ui-topnav__brand" type="button" @click="$emit('navigate', routes.home)">
        <UiAiLogo :state="aiState" size="md" />
        <span class="ui-topnav__name">知一</span>
      </button>

      <nav class="ui-topnav__tabs" aria-label="主导航">
        <button
          v-for="t in tabs"
          :key="t.path"
          type="button"
          class="ui-topnav__tab"
          :class="{ 'is-on': isTabActive(t) }"
          @click="$emit('navigate', t.path)"
        >
          {{ t.label }}
        </button>
      </nav>

      <button class="ui-topnav__bell" type="button" title="提醒中心" @click="$emit('navigate', routes.home + '?remind=1')">
        <UiIcon name="bell" :size="18" />
        <span v-if="remindDot" class="ui-topnav__dot" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import UiAiLogo from '../ui/UiAiLogo.vue'
import UiIcon from '../ui/UiIcon.vue'
import { ROUTES, HOME_TABS } from '../lib/routes.js'

/**
 * 全站顶部「学习 / 我的」双 Tab + 提醒铃铛（首页改版原型 A1/B17）。
 * 底部导航已移除：一级页之间靠首页大卡 / 次入口 / 本 Tab 跳转；
 * 铃铛 → 首页提醒中心浮层（/?remind=1，由 HomePage 读取 query 弹出）。
 */
const props = defineProps({
  active: { type: String, default: ROUTES.home },
  remindDot: { type: Boolean, default: false },
  aiState: { type: String, default: 'idle' },
})
defineEmits(['navigate'])

const routes = ROUTES
const tabs = HOME_TABS
const isTabActive = (t) => (t.path === '/' ? props.active === '/' : props.active.startsWith(t.path))

const scrolled = ref(false)
const onScroll = () => {
  scrolled.value = window.scrollY > 4
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped>
.ui-topnav {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  /* 透明底：首页透出天空渐变（背景层经负 margin 顶到视口顶），其他页面透出页面底色；
     保留 backdrop 模糊，滚动后靠分割线保证可读性 */
  background: transparent;
  backdrop-filter: saturate(140%) blur(12px);
  -webkit-backdrop-filter: saturate(140%) blur(12px);
  border-bottom: 0.5px solid transparent;
  transition: border-color var(--dur) var(--ease);
}
.ui-topnav.is-scrolled {
  border-bottom: var(--border-divider-soft);
}
.ui-topnav__inner {
  display: flex;
  align-items: center;
  gap: var(--sp-6);
  height: 62px;
}
.ui-topnav__brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.ui-topnav__name {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.ui-topnav__tabs {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
}
.ui-topnav__tab {
  position: relative;
  background: none;
  border: 0;
  padding: 4px 0;
  font-size: 16px;
  font-weight: var(--fw-medium);
  color: var(--text-quaternary);
  cursor: pointer;
  transition: color var(--dur) var(--ease);
}
.ui-topnav__tab:hover {
  color: var(--text-secondary);
}
.ui-topnav__tab.is-on {
  color: var(--text-primary);
}
.ui-topnav__tab.is-on::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -4px;
  height: 2.5px;
  border-radius: 2px;
  background: var(--primary);
}
.ui-topnav__bell {
  position: relative;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  border: 0;
  background: none;
  padding: var(--sp-2);
  color: var(--text-secondary);
  cursor: pointer;
}
.ui-topnav__bell:hover {
  color: var(--text-primary);
}
.ui-topnav__dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--danger, #e8443a);
}

@media (max-width: 767px) {
  .ui-topnav__inner {
    height: 48px;
  }
  .ui-topnav__brand {
    display: none;
  }
  .ui-topnav__tabs {
    gap: var(--sp-6);
    padding-left: var(--sp-2);
  }
  .ui-topnav__tab {
    font-size: 17px;
  }
}
</style>
