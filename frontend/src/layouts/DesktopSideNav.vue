<template>
  <aside class="ui-sidenav">
    <button class="ui-sidenav__brand" type="button" @click="$emit('navigate', ROUTES.home)">
      <UiAiLogo :state="aiState" size="md" />
      <span class="ui-sidenav__brand-txt">
        <b>知一学习</b>
        <i>{{ subTitle }}</i>
      </span>
    </button>

    <nav class="ui-sidenav__nav" aria-label="桌面主导航">
      <template v-for="sec in DESKTOP_NAV" :key="sec.title">
        <div class="ui-sidenav__group">{{ sec.title }}</div>
        <button
          v-for="it in sec.items"
          :key="it.path"
          type="button"
          class="ui-sidenav__item"
          :class="{ 'is-on': isOn(it) }"
          @click="$emit('navigate', it.path)"
        >
          <UiIcon :name="it.icon" :size="18" />
          <span class="ui-sidenav__label">{{ it.label }}</span>
          <span v-if="badgeOf(it)" class="ui-sidenav__badge">{{ badgeOf(it) }}</span>
        </button>
      </template>
    </nav>

    <div class="ui-sidenav__foot">
      <button type="button" class="ui-sidenav__me" @click="$emit('navigate', ROUTES.mine)">
        <span class="ui-sidenav__av">{{ initial }}</span>
        <span class="ui-sidenav__me-txt">
          <b>{{ nameText }}</b>
          <i>{{ stateText }}</i>
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup>
/**
 * 桌面端左侧竖向导航（≥1024px 显示，移动端由 CSS 隐藏）
 * ---------------------------------------------------------------------------
 * 与移动端顶部双 Tab 并存：外壳只切换显示，不改路由与页面逻辑。
 * 待复习数来自错题本 + 复习设置（与首页信息位同源，避免两处数字不一致）。
 */
import { computed } from 'vue'
import UiAiLogo from '../ui/UiAiLogo.vue'
import UiIcon from '../ui/UiIcon.vue'
import { ROUTES } from '../lib/routes.js'
import { DESKTOP_NAV } from '../lib/nav.js'
import { bookRef, settingsRef } from '../stores/bookStore.js'
import { pendingReviewCount } from '../lib/homeStats.js'
import { session } from '../stores/sessionStore.js'

const props = defineProps({
  active: { type: String, default: ROUTES.home },
  initial: { type: String, default: '我' },
  aiState: { type: String, default: 'idle' },
})
defineEmits(['navigate'])

const subTitle = computed(() => (session.space === 'account' ? '已登录 · 云端同步' : '计算机 · 全学科'))
const nameText = computed(() => session.userId || '未登录')
const stateText = computed(() => (session.syncing ? '同步中…' : (session.space === 'account' ? '云端已同步' : '仅本机保存')))

const reviewCount = computed(() => pendingReviewCount(bookRef.value || [], settingsRef.value || {}))
const isOn = (it) => {
  const p = String(props.active || '').split('?')[0]
  const home = it.path === ROUTES.home
  const base = home ? p === ROUTES.home : p === it.path || p.startsWith(it.path + '/')
  if (base) return true
  // 详情页归属父级，保证侧栏始终有高亮项
  const parents = {
    [ROUTES.capture]: [/^\/q\//],
    [ROUTES.wrongbook]: [/^\/wrongbook\//, /^\/practice\//],
    [ROUTES.chat]: [/^\/chat\//],
    [ROUTES.classPage]: [/^\/class\//],
    [ROUTES.exams]: [/^\/exam/],
    [ROUTES.tools]: [/^\/more$/],
  }
  return (parents[it.path] || []).some((re) => re.test(p))
}
const badgeOf = (it) => (it.badge === 'review' && reviewCount.value > 0 ? reviewCount.value : '')
</script>

<style scoped>
.ui-sidenav {
  display: none;
  width: 232px;
  flex: 0 0 232px;
  background: var(--surface-1);
  border-right: var(--border-divider-soft);
  padding: var(--sp-4) var(--sp-3);
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.ui-sidenav__brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  background: none;
  border: 0;
  padding: var(--sp-1) var(--sp-2) 18px;
  cursor: pointer;
  text-align: left;
}
.ui-sidenav__brand-txt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ui-sidenav__brand-txt b {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  letter-spacing: -.2px;
}
.ui-sidenav__brand-txt i {
  font-size: var(--fs-label);
  font-style: normal;
  color: var(--text-muted);
  margin-top: 1px;
}
.ui-sidenav__nav {
  display: flex;
  flex-direction: column;
}
.ui-sidenav__group {
  font-size: var(--fs-label);
  color: var(--text-disabled);
  letter-spacing: .06em;
  padding: var(--sp-4) var(--sp-3) var(--sp-2);
}
.ui-sidenav__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 9px var(--sp-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-secondary);
  font-size: var(--fs-body);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.ui-sidenav__item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.ui-sidenav__item.is-on {
  background: var(--primary-soft-2);
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}
.ui-sidenav__item.is-on::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--primary);
}
.ui-sidenav__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-sidenav__badge {
  font-size: var(--fs-label);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  background: var(--primary-soft-1);
  border-radius: var(--radius-pill);
  padding: 1px 7px;
}
.ui-sidenav__foot {
  margin-top: auto;
  padding-top: var(--sp-3);
  border-top: var(--border-divider-soft);
}
.ui-sidenav__me {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  padding: var(--sp-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-recess);
  cursor: pointer;
  text-align: left;
}
.ui-sidenav__me:hover {
  background: var(--surface-hover);
}
.ui-sidenav__av {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-on-primary);
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  background: linear-gradient(140deg, #8fb7f5, var(--primary));
}
.ui-sidenav__me-txt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ui-sidenav__me-txt b {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-sidenav__me-txt i {
  font-size: var(--fs-label);
  font-style: normal;
  color: var(--text-muted);
  margin-top: 1px;
}

@media (min-width: 1024px) {
  .ui-sidenav {
    display: flex;
    position: sticky;
    top: 0;
    height: 100vh;
  }
}
</style>
