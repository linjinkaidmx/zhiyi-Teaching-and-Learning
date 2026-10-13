<template>
  <header class="ui-topbar">
    <div class="ui-topbar__crumb">
      <template v-if="nav.section"><span>{{ nav.section }}</span><i>/</i></template>
      <b>{{ nav.item.label || '知一学习' }}</b>
    </div>

    <div ref="searchEl" class="ui-topbar__search">
      <UiIcon name="search" :size="15" class="ui-topbar__search-ico" />
      <input
        v-model="searchQ"
        class="ui-topbar__search-input"
        type="text"
        placeholder="搜功能：比如「错题」「老师」「复习」"
        @focus="searchOpen = true"
        @input="onSearchInput"
        @keydown.enter="onSearchEnter"
        @keydown.esc="searchOpen = false"
      />
      <button v-if="searchQ" type="button" class="ui-topbar__search-clear" aria-label="清空" @click="searchQ = ''">×</button>

      <Transition name="tb-search">
        <div v-if="searchOpen" class="ui-topbar__panel">
          <template v-if="!searchQ.trim()">
            <p class="ui-topbar__panel-hint">猜你想搜</p>
            <div class="ui-topbar__panel-quick">
              <button v-for="e in QUICK_ENTRIES" :key="e.title" type="button"
                      class="ui-topbar__chip" @click="goSearch(e.path)">
                <UiIcon :name="e.icon" :size="14" />{{ e.title }}
              </button>
            </div>
          </template>
          <template v-else>
            <button v-for="r in searchResults" :key="r.title" type="button"
                    class="ui-topbar__item" @click="goSearch(r.path)">
              <UiIcon :name="r.icon" :size="16" class="ui-topbar__item-ico" />
              <span class="ui-topbar__item-main">
                <b>{{ r.title }}</b><i>{{ r.desc }}</i>
              </span>
              <span class="ui-topbar__item-go">进入 →</span>
            </button>
            <div v-if="!searchResults.length" class="ui-topbar__empty">
              <p>没找到「{{ searchQ }}」，试试下面这些</p>
              <div class="ui-topbar__panel-quick">
                <button v-for="e in QUICK_ENTRIES.slice(0, 4)" :key="e.title" type="button"
                        class="ui-topbar__chip" @click="goSearch(e.path)">
                  <UiIcon :name="e.icon" :size="14" />{{ e.title }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </Transition>
    </div>

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
 * 左侧导航负责"去哪"，这条工具条负责"当前在哪 + 全局搜功能"：
 * 面包屑、全局搜功能（聚焦展开「猜你想搜」8 入口 + 输入即搜，点击跳对应界面）、提醒、账号。
 * 2026-10-10：原「搜题目/知识点/公式（粘贴截图）→ 跳拍照页」按钮替换为站内搜功能输入框；
 * 相机图标与 Ctrl+K 一并移除（Ctrl+K 相关逻辑在 AppShell 里已删）。
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import UiIcon from '../ui/UiIcon.vue'
import { ROUTES } from '../lib/routes.js'
import { matchNav } from '../lib/nav.js'
import { session } from '../stores/sessionStore.js'
import { QUICK_ENTRIES, searchSite } from '../lib/siteSearch.js'

const props = defineProps({
  active: { type: String, default: ROUTES.home },
  initial: { type: String, default: '我' },
  remindDot: { type: Boolean, default: false },
})
const emit = defineEmits(['navigate', 'remind'])

const nav = computed(() => matchNav(props.active))
const nameText = computed(() => session.userId || '未登录')

const searchEl = ref(null)
const searchQ = ref('')
const searchOpen = ref(false)
const searchResults = ref([])

function onSearchInput() {
  searchResults.value = searchSite(searchQ.value)
}
function goSearch(target) {
  searchOpen.value = false
  searchQ.value = ''
  emit('navigate', target)
}
function onSearchEnter() {
  if (searchResults.value.length) goSearch(searchResults.value[0].path)
}
function onDocClick(e) {
  if (searchEl.value && !searchEl.value.contains(e.target)) searchOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
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
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: 1;
  max-width: 520px;
  height: 38px;
  margin: 0 auto;
  padding: 0 var(--sp-3);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  transition: box-shadow var(--dur) var(--ease), background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.ui-topbar__search:focus-within {
  background: var(--surface-1);
  border-color: var(--primary-line);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
}
.ui-topbar__search-ico {
  flex: none;
  color: var(--text-muted);
}
.ui-topbar__search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: none;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--fs-body-2);
}
.ui-topbar__search-input::placeholder {
  color: var(--text-muted);
}
.ui-topbar__search-clear {
  flex: none;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-hover);
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.ui-topbar__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 480px;
  overflow: auto;
  padding: var(--sp-3);
  border-radius: var(--radius-lg);
  border: var(--border-default);
  background: var(--surface-1);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14);
}
.ui-topbar__panel-hint {
  margin: 2px 4px 8px;
  font-size: var(--fs-label);
  color: var(--text-muted);
  letter-spacing: 0.03em;
}
.ui-topbar__panel-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ui-topbar__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: var(--border-default);
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-label);
  padding: 6px 12px;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.ui-topbar__chip:hover {
  border-color: var(--primary-line);
  color: var(--primary-text);
  transform: translateY(-1px);
}
.ui-topbar__item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: var(--radius-md);
  background: none;
  text-align: left;
  cursor: pointer;
}
.ui-topbar__item:hover {
  background: var(--surface-hover);
}
.ui-topbar__item-ico {
  flex: none;
  color: var(--primary-text);
}
.ui-topbar__item-main {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}
.ui-topbar__item-main b {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
}
.ui-topbar__item-main i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-topbar__item-go {
  flex: none;
  font-size: var(--fs-label);
  color: var(--primary-text);
  opacity: 0;
  transition: opacity var(--dur) var(--ease);
}
.ui-topbar__item:hover .ui-topbar__item-go {
  opacity: 1;
}
.ui-topbar__empty p {
  margin: 4px 4px 10px;
  font-size: var(--fs-body-2);
  color: var(--text-muted);
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
.tb-search-enter-active, .tb-search-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.tb-search-enter-from, .tb-search-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (min-width: 1024px) {
  .ui-topbar {
    display: flex;
  }
}
</style>
