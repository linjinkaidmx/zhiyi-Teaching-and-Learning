<template>
  <section class="ph surface-standard">
    <span class="ph__phase t-label">{{ phase }}</span>
    <h1 class="t-h2 ph__title">{{ title }}</h1>
    <p class="t-body-2 ph__desc">{{ description }}</p>
    <div class="ph__ops">
      <UiButton variant="primary" @click="goHome">回到首页</UiButton>
      <UiButton variant="ghost" @click="goBack">返回上一页</UiButton>
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
import { ROUTES } from '../lib/routes.js'

const route = useRoute()
const router = useRouter()

const phase = computed(() => String(route.meta.phase || '404'))
const title = computed(() => String(route.meta.title || '页面不存在'))
const description = computed(
  () => String(route.meta.description || '这个地址没有对应的页面，可以回到首页继续。'),
)

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
.ph__phase {
  color: var(--text-muted);
  letter-spacing: 0.14em;
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
</style>
