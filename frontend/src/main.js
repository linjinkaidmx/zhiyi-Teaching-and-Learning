import { createApp } from 'vue'

/* ---------------------------------------------------------------------------
   知一 V1 · 入口
   现状（P8）：Element Plus 已完全移除，全部页面使用自研 ui/ 组件
     - tokens / themes / base / print 全局生效：
       base 的样式限定在 .zy-scope 内，不影响未迁移的旧页面（旧页面没有 .zy-scope）
   --------------------------------------------------------------------------- */
import 'katex/dist/katex.min.css'
import './style.css'

// 设计系统（全局生效）
import './styles/tokens.css'
import './styles/themes.css'
import './styles/base.css'
import './styles/print.css'

import App from './App.vue'

const params = new URLSearchParams(window.location.search)

/* 主题：默认浅色（移动/桌面一致），支持 ?theme=dark 预览深色；持久化到 zy_theme，后续接入「我的 → 系统设置」 */
const savedTheme = (() => {
  try {
    return localStorage.getItem('zy_theme')
  } catch {
    return null
  }
})()
const theme = params.get('theme') || savedTheme || 'light'
document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'

/* 是否进入 Design System 自检页（P1 交付物，用 ?ds=1 访问） */
const isDesignSystem = params.has('ds')

async function bootstrap() {
  let RootComponent = App

  if (isDesignSystem) {
    RootComponent = (await import('./pages/DesignSystemPage.vue')).default
  }

  const app = createApp(RootComponent)

  if (!isDesignSystem) {
    // P2：接入 vue-router（自检页不需要路由）
    const { default: router } = await import('./router/index.js')
    app.use(router)
    await router.isReady()
  }

  app.mount('#app')
}

bootstrap()
