<template>
  <section class="ph surface-standard">
    <span class="ph__code">{{ phase }}</span>
    <span class="ph__ic"><UiIcon name="help" :size="22" /></span>
    <h1 class="t-h2 ph__title">{{ title }}</h1>
    <p class="t-body-2 ph__desc">{{ description }}</p>
    <div class="ph__ops">
      <UiButton variant="primary" @click="goHome">回到首页</UiButton>
      <UiButton variant="ghost" @click="goBack">返回上一页</UiButton>
    </div>
    <div class="ph__links">
      <button v-for="l in links" :key="l.path" type="button" class="ph__link" @click="router.push(l.path)">
        <span class="ph__link-ic"><UiIcon :name="l.icon" :size="14" /></span>
        <span>{{ l.label }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
/**
 * 兜底页（404 / 未匹配路径）。
 * 文案来自路由 meta，方便同一条路由复用到其它"未开放"的地址。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import { ROUTES } from '../lib/routes.js'

const route = useRoute()
const router = useRouter()

const phase = computed(() => String(route.meta.phase || '404'))
const title = computed(() => String(route.meta.title || '页面不存在'))
const description = computed(
  () => String(route.meta.description || '这个地址没有对应的页面，可以回到首页继续。'),
)

/** 快捷入口：迷路了也能一键去最常用的几个地方 */
const links = [
  { label: '拍照搜题', icon: 'camera', path: ROUTES.capture },
  { label: '错题学习', icon: 'book', path: ROUTES.wrongbook },
  { label: '学习数据', icon: 'data', path: ROUTES.data },
]

function goHome() {
  router.push(ROUTES.home)
}
function goBack() {
  if (window.history.length > 1) router.back()
  else router.push(ROUTES.home)
}
</script>

<style scoped>
.ph {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  text-align: center;
  padding: var(--sp-10) var(--sp-5);
  min-height: 52vh;
}
/* 大号状态码 + 图标，做出识别度 */
.ph__code {
  font-size: 64px;
  font-weight: var(--fw-semibold);
  line-height: 1;
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.ph__ic {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.ph__title {
  margin: 0;
}
.ph__desc {
  color: var(--text-muted);
  max-width: 34em;
}
.ph__ops {
  display: flex;
  gap: var(--sp-3);
  margin-top: var(--sp-2);
  flex-wrap: wrap;
  justify-content: center;
}
/* 快捷入口 */
.ph__links {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--sp-3);
  padding-top: var(--sp-4);
  border-top: var(--border-divider-soft);
  width: 100%;
  max-width: 520px;
}
.ph__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: var(--border-subtle);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.ph__link:hover {
  color: var(--primary-text);
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.ph__link-ic {
  display: inline-flex;
  color: var(--primary-text);
}
</style>
