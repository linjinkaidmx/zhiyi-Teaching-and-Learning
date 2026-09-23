<template>
  <nav class="ui-bottomnav" aria-label="底部导航">
    <div class="ui-bottomnav__inner">
      <button
        v-for="item in items"
        :key="item.path"
        class="ui-bottomnav__item"
        :class="{ 'is-primary': item.path === ROUTES.capture }"
        type="button"
        :aria-current="isActive(item) ? 'page' : undefined"
        @click="$emit('navigate', item.path)"
      >
        <span class="ui-bottomnav__icon"><UiIcon :name="item.icon" :size="21" /></span>
        <span>{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import UiIcon from '../ui/UiIcon.vue'
import { BOTTOM_NAV, ROUTES } from '../lib/routes.js'

/**
 * 移动端底部五项导航：首页 / 拍题 / 错题学习 / AI对话 / 我的
 * 不是在桌面导航上做缩小，而是重新组织的移动端信息结构（<768px 显示）。
 */
const props = defineProps({
  items: { type: Array, default: () => BOTTOM_NAV },
  active: { type: String, default: ROUTES.home },
})
defineEmits(['navigate'])

function isActive(item) {
  if (props.active === item.path) return true
  // 二级页面保持父级高亮（/q/:id 属于拍题链路）
  if (item.path === ROUTES.capture && props.active.startsWith('/q')) return true
  if (item.path === ROUTES.wrongbook && props.active.startsWith('/wrongbook')) return true
  if (item.path === ROUTES.chat && props.active.startsWith('/chat')) return true
  return false
}
</script>

<style scoped>
.ui-bottomnav {
  display: none;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-nav);
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--background) 92%, transparent);
  backdrop-filter: saturate(140%) blur(14px);
  border-top: var(--border-divider-soft);
}
.ui-bottomnav__inner {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 2px;
}
.ui-bottomnav__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-height: var(--tap-min);
  padding: 6px 0;
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ui-bottomnav__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 28px;
  border-radius: var(--radius-pill);
  transition: background var(--dur) var(--ease);
}
/* 选中：顶部指示条 + 文字提亮，不再铺满底色（更克制） */
.ui-bottomnav__item[aria-current='page'] {
  color: var(--primary-text);
}
.ui-bottomnav__item[aria-current='page']::before {
  content: '';
  position: absolute;
  top: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 2px;
  border-radius: 2px;
  background: var(--primary-bar);
}
/* 拍题是移动端主路径：常态给淡紫圆底，选中时加深一档 */
.ui-bottomnav__item.is-primary {
  color: var(--text-secondary);
}
.ui-bottomnav__item.is-primary .ui-bottomnav__icon {
  background: var(--primary-soft-3);
}
.ui-bottomnav__item.is-primary[aria-current='page'] .ui-bottomnav__icon {
  background: var(--primary-soft-2);
}

@media (max-width: 767px) {
  .ui-bottomnav {
    display: block;
  }
}
</style>
