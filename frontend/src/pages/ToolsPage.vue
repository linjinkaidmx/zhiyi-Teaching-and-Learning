<template>
  <div class="zy-container zy-page tools">
    <!-- 工具视图：/tools?tool=algo|debug|ref 直接渲染现有组件（与原 /more?tool= 机制一致） -->
    <template v-if="activeTool">
      <div class="tools__toolbar">
        <UiButton variant="ghost" size="sm" @click="closeTool">← 返回学习工具</UiButton>
        <span class="t-h3">{{ activeToolLabel }}</span>
      </div>
      <div class="tools__toolbody">
        <AlgoDemo v-if="activeTool === 'algo'" :initial-algo="algoTarget" />
        <CodeDebug v-else-if="activeTool === 'debug'" />
        <Reference v-else />
      </div>
    </template>

    <template v-else>
      <header class="tools__head">
        <h1 class="t-h1">学习工具</h1>
        <p class="t-body-2">考前冲刺与进阶工具，点开即用</p>
      </header>

      <div class="tools__grid">
        <button v-for="t in tools" :key="t.key" class="tools__card surface-standard" type="button" @click="openTool(t)">
          <span class="tools__icon" :style="{ '--tool': t.color }"><UiIcon :name="t.icon" :size="20" /></span>
          <span class="tools__title">{{ t.title }}</span>
          <span class="tools__desc">{{ t.desc }}</span>
        </button>
      </div>
      <p class="tools__tip t-label">每个工具点开即进入对应功能页，返回即回到本页</p>
    </template>

    <p class="tools__build">当前构建 <b>{{ buildId }}</b> · 若这里不是最新版本，请强制刷新（Ctrl/Cmd+Shift+R）</p>
  </div>
</template>

<script setup>
const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import AlgoDemo from '../components/AlgoDemo.vue'
import CodeDebug from '../components/CodeDebug.vue'
import Reference from '../components/Reference.vue'
import { ROUTES } from '../lib/routes.js'

/**
 * 学习工具页（原型 A5）：由原「更多」页改造而来。
 * 底部导航移除后，四个学习工具独立成页；课程/数据类入口归首页次入口，设置类归「我的」。
 * 工具用 ?tool= 在同一路由内切换（沿用原 /more?tool= 机制，路径迁到 /tools）。
 */
const route = useRoute()
const router = useRouter()

const tools = [
  { key: 'exam', title: '模拟考试', desc: '组卷 · 作答 · AI 判分', icon: 'clipboard', color: '#4A5D8A' },
  { key: 'algo', title: '算法演示', desc: '21 个算法分步动画', icon: 'play', color: '#7A5F3D' },
  { key: 'debug', title: '代码诊断', desc: '贴代码 + 报错定位问题', icon: 'settings', color: '#5A6B7A' },
  { key: 'ref', title: '考前速查', desc: '公式 97 条 · 模板 21 个', icon: 'book', color: '#3D6A7A' },
]

const activeTool = computed(() => {
  const tool = String(route.query.tool || '')
  return tools.some((t) => t.key === tool) ? tool : ''
})
const activeToolLabel = computed(() => tools.find((t) => t.key === activeTool.value)?.title || '')
const algoTarget = computed(() => (route.query.algo ? String(route.query.algo) : null))

function openTool(t) {
  // 模拟考试是独立页面，直接跳转
  if (t.key === 'exam') {
    router.push(ROUTES.simExam)
    return
  }
  router.push({ path: ROUTES.tools, query: { tool: t.key } })
}
function closeTool() {
  router.push({ path: ROUTES.tools })
}
</script>

<style scoped>
.tools {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  max-width: var(--col-main);
}
.tools__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.tools__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-3);
}
.tools__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-5);
  text-align: left;
  cursor: pointer;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.tools__card:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
}
.tools__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--tool) 22%, transparent);
  color: color-mix(in srgb, var(--tool) 62%, var(--text-primary));
  margin-bottom: var(--sp-1);
}
.tools__title {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.tools__desc {
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}
.tools__tip {
  color: var(--text-muted);
}
.tools__toolbar {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}
.tools__toolbody {
  margin-top: var(--sp-2);
}
.tools__build {
  margin-top: var(--sp-4);
  font-size: var(--fs-label);
  color: var(--text-muted);
  text-align: center;
}
.tools__build b {
  color: var(--text-tertiary);
  font-weight: var(--fw-medium);
}
@media (max-width: 767px) {
  .tools__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (min-width: 768px) {
  .tools__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (min-width: 768px) {
  .tools__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .tools {
    max-width: none;
  }
}
</style>
