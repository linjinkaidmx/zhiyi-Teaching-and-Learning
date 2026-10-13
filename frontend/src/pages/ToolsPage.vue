<template>
  <div class="zy-container zy-page tools">
    <!-- 工具视图：/tools?tool=algo|debug|ref 直接渲染现有组件（与原 /more?tool= 机制一致） -->
    <template v-if="activeTool">
      <div class="tools__toolbar">
        <UiButton variant="soft" size="sm" class="zy-back" @click="closeTool" icon="left">返回学习工具</UiButton>
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

      <!-- 2×2 大卡（2026-10-11）：图标走站点色系 + 场景标签 + 用途 + 规模标签 + 打开 -->
      <div class="tools__grid">
        <button v-for="t in tools" :key="t.key" class="tools__card surface-standard" type="button" @click="openTool(t)">
          <span class="tools__card-top">
            <span class="tools__icon" :style="{ '--tool': t.color }"><UiIcon :name="t.icon" :size="20" /></span>
            <b class="tools__title">{{ t.title }}</b>
            <span class="tools__scene">{{ t.scene }}</span>
          </span>
          <span class="tools__desc">{{ t.desc }}</span>
          <span class="tools__meta">
            <span v-for="m in t.meta" :key="m" class="tools__chip">{{ m }}</span>
          </span>
          <span class="tools__go">打开 →</span>
        </button>
      </div>

      <!-- 使用节奏：把四个孤立工具串成场景（2026-10-11） -->
      <section class="tools__howto surface-standard">
        <div class="tools__howto-h">这四个工具怎么配合用<span>一个学期的节奏</span></div>
        <div class="tools__steps">
          <div v-for="(s, i) in howto" :key="i" class="tools__step" :style="{ '--sc': s.color }">
            <span class="tools__step-no">{{ i + 1 }}</span>
            <span>
              <b>{{ s.title }}</b>
              <p>{{ s.desc }}</p>
            </span>
          </div>
        </div>
      </section>

      <p class="tools__build">版本 {{ buildId }} · 若页面不是最新，请强制刷新</p>
    </template>
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
 *
 * 2026-10-11 优化：四张卡从「标题 + 一句」升级为「用途 + 规模标签 + 场景标签 + 打开」，
 * 配色回到站点色系（紫 / 蓝 / 琥珀 / 青），下方补「怎么配合用」的使用节奏，
 * 开发者版本号从页面正中挪到右下角极小字。
 */
const route = useRoute()
const router = useRouter()

const tools = [
  {
    key: 'exam', title: '模拟考试', scene: '考前一周用', icon: 'clipboard', color: '#7c5cff',
    desc: '按章节或知识点自动组卷，限时作答后 AI 判分；失分点会回流到错题本，直接接着补。',
    meta: ['组卷方式可选', '一套约 60 分钟', '判分后可看解析'],
  },
  {
    key: 'algo', title: '算法演示', scene: '平时理解用', icon: 'play', color: '#6fa0ee',
    desc: '21 个经典算法（排序 / 查找 / 树 / 图）分步动画演示，可单步、回退、调速度，看一遍就明白它在干什么。',
    meta: ['21 个算法', '单步 / 回退 / 调速度'],
  },
  {
    key: 'debug', title: '代码诊断', scene: '写完随手查', icon: 'settings', color: '#e0a55c',
    desc: '粘贴代码 + 报错信息，定位问题出在哪一行、为什么会报，并给出改法与原因说明。',
    meta: ['支持贴报错', '给改法 + 原因'],
  },
  {
    key: 'ref', title: '考前速查', scene: '开考前 10 分钟', icon: 'book', color: '#5cb4b4',
    desc: '公式 97 条、答题模板 21 个，按科目分类，支持搜索与打印；进考场前最后过一遍。',
    meta: ['公式 97 条', '模板 21 个', '可打印'],
  },
]

const howto = [
  { color: '#7c5cff', title: '平时：理解 + 自查', desc: '看不懂的算法先看演示动画；作业写完用代码诊断过一遍，错题自动进错题本。' },
  { color: '#8b74f3', title: '考前一周：模考摸底', desc: '做一套模拟考试，看哪些章节失分最多，再到 AI 课堂按章补课。' },
  { color: '#5b47d6', title: '进考场前：翻速查', desc: '用考前速查把公式与模板过一遍，能打印出来带在身边。' },
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
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.tools__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.tools__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}
@media (min-width: 768px) {
  .tools__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.tools__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 18px;
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-lg);
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.tools__card:hover {
  transform: translateY(-2px);
  border-color: var(--primary-line);
}
.tools__card-top {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
}
.tools__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--tool) 16%, transparent);
  color: color-mix(in srgb, var(--tool) 78%, var(--text-primary));
}
.tools__title {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.tools__scene {
  margin-left: auto;
  flex: none;
  font-size: var(--fs-label);
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  border: var(--border-subtle);
  background: var(--surface-unit);
  color: var(--text-tertiary);
  white-space: nowrap;
}
.tools__desc {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
  line-height: 1.65;
}
.tools__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.tools__chip {
  font-size: var(--fs-label);
  padding: 2px 8px;
  border-radius: 7px;
  color: var(--primary-text);
  background: var(--primary-soft-3);
  border: 0.5px solid var(--primary-line);
}
.tools__go {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
}

/* 使用节奏 */
.tools__howto {
  padding: 16px 18px;
  border-radius: var(--radius-lg);
  display: grid;
  gap: 12px;
}
.tools__howto-h {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: var(--fs-h4);
  font-weight: var(--fw-medium);
}
.tools__howto-h span {
  font-size: var(--fs-label);
  font-weight: 400;
  color: var(--text-muted);
}
.tools__steps {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
@media (min-width: 768px) {
  .tools__steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.tools__step {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--primary-soft-3);
  border: 0.5px solid var(--primary-line);
}
.tools__step-no {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex: none;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: var(--fs-label);
  font-weight: var(--fw-medium);
  background: var(--sc);
}
.tools__step b {
  display: block;
  font-size: var(--fs-body-2);
}
.tools__step p {
  margin: 3px 0 0;
  font-size: var(--fs-label);
  line-height: 1.6;
  color: var(--text-tertiary);
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
  margin-top: var(--sp-2);
  font-size: 10px;
  color: var(--text-disabled);
  text-align: right;
}
.tools__build b {
  font-weight: var(--fw-medium);
}

/* ---------------- 桌面端宽度（内容区已让出侧栏，按桌面档铺开） ---------------- */
@media (min-width: 1024px) {
  .tools {
    max-width: none;
  }
}
</style>
