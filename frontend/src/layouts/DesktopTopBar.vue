<template>
  <header class="ui-topbar">
    <div class="ui-topbar__crumb">
      <template v-if="nav.section"><span>{{ nav.section }}</span><i>/</i></template>
      <b>{{ nav.item.label || '知一学习' }}</b>
    </div>

    <button type="button" class="ui-topbar__search" @click="$emit('search')">
      <UiIcon name="search" :size="15" />
      <span class="ui-topbar__search-ph">搜题目、知识点、公式（也可直接粘贴截图）</span>
      <kbd class="ui-topbar__kbd">Ctrl K</kbd>
      <span class="ui-topbar__cam" aria-hidden="true"><UiIcon name="camera" :size="14" /></span>
    </button>

    <button type="button" class="ui-topbar__icon" title="提醒中心" @click="$emit('remind')">
      <UiIcon name="bell" :size="19" />
      <span v-if="remindDot" class="ui-topbar__dot" aria-hidden="true" />
    </button>

    <button type="button" class="ui-topbar__av" :title="nameText" @click="$emit('navigate', ROUTES.mine)">
      {{ initial }}
    </button>
  </header>
</template>

<script setup>
/**
 * 桌面端顶部工具条（≥1024px 显示）
 * ---------------------------------------------------------------------------
 * 左侧导航负责"去哪"，这条工具条负责"当前在哪 + 随手搜题"：
 * 面包屑、全局搜题入口（点击/ Ctrl K 直接进拍题页并聚焦文本输入）、提醒、账号。
 */
import { computed } from 'vue'
import UiIcon from '../ui/UiIcon.vue'
import { ROUTES } from '../lib/routes.js'
import { matchNav } from '../lib/nav.js'
import { session } from '../stores/sessionStore.js'

const props = defineProps({
  active: { type: String, default: ROUTES.home },
  initial: { type: String, default: '我' },
  remindDot: { type: Boolean, default: false },
})
defineEmits(['navigate', 'search', 'remind'])

const nav = computed(() => matchNav(props.active))
const nameText = computed(() => session.userId || '未登录')
</script>

<style scoped>
.ui-topbar {
  display: none;
  align-items: center;
  gap: var(--sp-4);
  height: 58px;
  flex: 0 0 58px;
  padding: 0 var(--sp-6);
  background: var(--surface-1);
  border-bottom: var(--border-divider-soft);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}
.ui-topbar__crumb {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-body-2);
  color: var(--text-muted);
  white-space: nowrap;
}
.ui-topbar__crumb i {
  font-style: normal;
  color: var(--text-disabled);
}
.ui-topbar__crumb b {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.ui-topbar__search {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: 1;
  max-width: 520px;
  height: 38px;
  margin: 0 auto;
  padding: 0 6px 0 var(--sp-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  color: var(--text-muted);
  font-family: inherit;
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: box-shadow var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ui-topbar__search:hover {
  background: var(--surface-hover);
  box-shadow: inset 0 0 0 1px var(--primary-line);
}
.ui-topbar__search-ph {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.ui-topbar__kbd {
  font-family: inherit;
  font-size: var(--fs-label);
  color: var(--text-muted);
  background: var(--surface-1);
  border: var(--border-default);
  border-radius: 6px;
  padding: 2px 7px;
  white-space: nowrap;
}
.ui-topbar__cam {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--primary);
  color: var(--text-on-primary);
}
.ui-topbar__icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
}
.ui-topbar__icon:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.ui-topbar__dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--error);
  box-shadow: 0 0 0 1.5px var(--surface-1);
}
.ui-topbar__av {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-on-primary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  background: linear-gradient(140deg, #8fb7f5, var(--primary));
  cursor: pointer;
}

@media (min-width: 1024px) {
  .ui-topbar {
    display: flex;
  }
}
</style>
