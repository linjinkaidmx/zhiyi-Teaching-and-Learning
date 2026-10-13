<template>
  <footer class="site-slogan" aria-label="网站标语">
    <button type="button" class="site-slogan__link" title="了解知一" @click="go">
      <!-- 品牌小标：开屏/海报同款「循环箭头环 + 块面 Z」的缩小版（14px 下箭头细节省略） -->
      <svg class="site-slogan__mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="sloganZg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#9A7BFF" />
            <stop offset="1" stop-color="#5F3FE0" />
          </linearGradient>
        </defs>
        <path d="M89.5 35.6 A42 42 0 1 1 57.3 8.6" fill="none" stroke="#A995FF" stroke-width="10" stroke-linecap="round" />
        <path d="M30 36 L70 36 L70 45 L44 55 L70 55 L70 64 L30 64 L30 55 L56 45 L30 45 Z" fill="url(#sloganZg)" />
      </svg>
      <span class="site-slogan__text">知理于一 · 笃学前行</span>
    </button>
  </footer>
</template>

<script setup>
/**
 * 全站页脚标语（2026-10-13）：挂在 AppShell 主区底部，一处生效、全路由覆盖。
 * 定位是「品牌签名」——小字灰阶 + 拉开字距，低调到不干扰、精致到被注意到；
 * 点击进 /about（产品介绍），让标语有去处。
 */
import { useRouter } from 'vue-router'
import { ROUTES } from '../lib/routes.js'

const router = useRouter()
function go() {
  router.push(ROUTES.about)
}
</script>

<style scoped>
.site-slogan {
  flex: none; /* ui-shell__col 是纵向 flex：内容短则贴视口底，长则沉到内容末尾 */
  display: flex;
  justify-content: center;
  padding: 4px 16px 20px;
}
.site-slogan__link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border: 0;
  border-radius: var(--radius-pill);
  background: none;
  cursor: pointer;
  color: var(--text-tertiary);
  font-family: inherit;
  transition: color var(--dur) var(--ease), background-color var(--dur) var(--ease);
}
.site-slogan__link:hover {
  color: var(--primary-text);
  background: var(--primary-soft-3);
}
.site-slogan__link:focus-visible {
  outline: 2px solid var(--primary-line);
  outline-offset: 2px;
}
.site-slogan__mark {
  flex: none;
  width: 14px;
  height: 14px;
}
.site-slogan__text {
  font-size: 11.5px;
  letter-spacing: 0.12em;
  /* 补偿末尾字距，让整串文字在按钮里视觉居中 */
  margin-right: -0.12em;
}
@media (max-width: 640px) {
  .site-slogan { padding: 2px 12px 14px; }
}
@media print {
  .site-slogan { display: none; }
}
</style>
