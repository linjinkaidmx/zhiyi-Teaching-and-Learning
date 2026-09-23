<template>
  <AppShell
    :active="active"
    :ai-state="ai.state"
    :ai-text="ai.text"
    :ai-meta="ai.meta"
    :ai-progress="ai.progress"
    :ai-can-stop="ai.state === 'working' || ai.state === 'streaming'"
    :ai-can-rerun="ai.state === 'completed'"
    @navigate="onNavigate"
    @ai-stop="stopAi"
    @ai-rerun="startAi"
  >
    <div class="zy-container zy-page ds">
      <header class="ds__hero surface-standard">
        <div class="ds__hero-main">
          <p class="t-label">P1 · Design System 自检页</p>
          <h1 class="t-h1" style="margin-top: 6px">知一 V1 设计系统</h1>
          <p class="t-body" style="margin-top: 8px">
            本次只交付设计系统与外壳，不包含首页与业务页面。所有颜色、圆角、阴影、间距都必须来自
            <code class="t-code">src/styles/tokens.css</code>。
          </p>
        </div>
        <div class="ds__hero-side">
          <UiButton size="sm" variant="ghost" @click="toggleTheme">
            当前主题：{{ theme === 'dark' ? '深色' : '浅色' }}
          </UiButton>
        </div>
      </header>

      <!-- 表面层级 -->
      <section class="ds__block">
        <h2 class="t-h2">表面层级（Surface / Elevation）</h2>
        <p class="t-body-2 ds__note">
          深色默认下靠「明度 + 蓝相」共同区分：background 4.3% → surface-1 14.9% →
          surface-2 17.8% → surface-3 20.0% → unit 22.9%。裸眼不看边框也能分辨层级。
        </p>
        <div class="ds__grid ds__grid--4">
          <div class="ds__surface bg"><span class="t-label">background</span></div>
          <div class="ds__surface surface-standard"><span class="t-label">surface-1 · 普通模块</span></div>
          <div class="ds__surface surface-elevated"><span class="t-label">surface-2 · 重点模块</span></div>
          <div class="ds__surface surface-hero"><span class="t-label">hero-surface · 主模块</span></div>
        </div>
        <div class="ds__grid ds__grid--4" style="margin-top: var(--sp-3)">
          <div class="ds__surface unit"><span class="t-label">surface-unit · 小单元</span></div>
          <div class="ds__surface recess"><span class="t-label">surface-recess · 内凹区</span></div>
          <div class="ds__surface brand"><span class="t-label">accent-glow · AI 氛围光</span></div>
          <div class="ds__surface glow"><span class="t-label">accent-glow-soft · 微弱光</span></div>
        </div>
      </section>

      <!-- 颜色 -->
      <section class="ds__block">
        <h2 class="t-h2">颜色（Colors）</h2>
        <div class="ds__swatches">
          <div v-for="c in swatches" :key="c.name" class="ds__swatch">
            <span class="ds__chip" :style="{ background: c.value }" />
            <span class="t-label">{{ c.name }}</span>
            <span class="t-code ds__hex">{{ c.value }}</span>
          </div>
        </div>
      </section>

      <!-- 排版 -->
      <section class="ds__block">
        <h2 class="t-h2">排版（Typography）</h2>
        <div class="ds__type">
          <div v-for="t in typeScale" :key="t.cls" class="ds__typerow">
            <span class="t-label ds__typekey">{{ t.key }}</span>
            <span :class="t.cls">知一 · 拍下不会的题，马上开始理解</span>
            <span class="t-code ds__hex">{{ t.size }}</span>
          </div>
        </div>
      </section>

      <!-- 按钮 -->
      <section class="ds__block">
        <h2 class="t-h2">按钮（Button）</h2>
        <p class="t-body-2 ds__note">
          Primary 每页只应出现一个；CTA 用于模块内主操作（比 Primary 低一档）；Secondary
          用于次级入口；Ghost / Text 用于轻量动作。
        </p>
        <div class="ds__row">
          <UiButton variant="primary">开始识别</UiButton>
          <UiButton variant="cta">开始复习</UiButton>
          <UiButton variant="secondary">直接进入 AI 对话</UiButton>
          <UiButton variant="ghost">继续学习 →</UiButton>
          <UiButton variant="text">查看课表</UiButton>
        </div>
        <div class="ds__row" style="margin-top: var(--sp-3)">
          <UiButton variant="primary" size="lg">大号 Primary</UiButton>
          <UiButton variant="ghost" size="sm">小号 Ghost</UiButton>
          <UiButton variant="primary" loading>加载中</UiButton>
          <UiButton variant="ghost" disabled>禁用</UiButton>
        </div>
        <div style="max-width: 360px; margin-top: var(--sp-3)">
          <UiButton variant="cta" block>通栏 CTA（模块内主操作）</UiButton>
        </div>
      </section>

      <!-- 卡片 -->
      <section class="ds__block">
        <h2 class="t-h2">卡片（Card / Surface）</h2>
        <div class="ds__grid ds__grid--3">
          <UiCard title="普通模块" surface="standard">
            <div class="t-body-2">用于学习概览、继续学习、课程表等内容模块。</div>
          </UiCard>
          <UiCard title="重点模块" surface="elevated" task>
            <div class="t-body-2">用于今日复习等任务模块，左侧带蓝紫强调条。</div>
          </UiCard>
          <UiCard title="主模块" surface="hero">
            <div class="t-body-2">用于首页 AI 拍题入口，是页面第一视觉焦点。</div>
          </UiCard>
        </div>
      </section>

      <!-- 标签 -->
      <section class="ds__block">
        <h2 class="t-h2">标签（Tag）</h2>
        <div class="ds__row wrap">
          <UiTag variant="brand">指针与数组</UiTag>
          <UiTag variant="brand-soft">定积分换元</UiTag>
          <UiTag variant="neutral">条件概率</UiTag>
          <UiTag variant="success">已掌握</UiTag>
          <UiTag variant="warning">复习中</UiTag>
          <UiTag variant="error">待巩固</UiTag>
          <UiTag variant="info">新知识点</UiTag>
        </div>
        <div class="ds__row" style="margin-top: var(--sp-3)">
          <UiTag variant="brand" clickable level @click="notify('点击了知识点标签')">指针与数组</UiTag>
          <UiTag variant="neutral" level>复习中 · 3 天后复习</UiTag>
          <span class="t-label">掌握程度必须「颜色 + 文字」同时表达</span>
        </div>
      </section>

      <!-- 输入 -->
      <section class="ds__block">
        <h2 class="t-h2">输入（Input）</h2>
        <div class="ds__grid ds__grid--2">
          <UiInput v-model="demo.text" label="昵称" placeholder="2-20 位" hint="用于登录与云端同步" />
          <UiInput
            v-model="demo.bio"
            label="个性签名"
            placeholder="写一句正在做的事"
            :maxlength="60"
            show-count
          />
          <UiInput v-model="demo.error" label="错误态" error="昵称长度需 2-20 位" />
          <UiInput v-model="demo.area" type="textarea" label="题目文字" placeholder="粘贴或输入题目" />
        </div>
      </section>

      <!-- Modal / Toast -->
      <section class="ds__block">
        <h2 class="t-h2">弹层（Modal / Toast）</h2>
        <div class="ds__row wrap">
          <UiButton variant="ghost" @click="demo.modal = true">打开 Modal</UiButton>
          <UiButton variant="ghost" @click="notify('普通提示')">Toast · 普通</UiButton>
          <UiButton variant="ghost" @click="notify('已保存', 'success')">Toast · 成功</UiButton>
          <UiButton variant="ghost" @click="notify('识别失败，请重试', 'error')">Toast · 失败</UiButton>
          <UiButton variant="ghost" @click="persistToast">Toast · 持续显示</UiButton>
        </div>

        <UiModal v-model="demo.modal" title="确认操作" @close="notify('已关闭弹窗')">
          <p class="t-body">
            危险操作统一使用确认弹窗，并明确说明「影响范围」与「是否可恢复」。
          </p>
          <div class="ds__hintbox t-body-2">
            这将删除 2 条错题记录，删除后无法恢复。云端数据不受影响。
          </div>
          <template #footer>
            <UiButton variant="ghost" @click="demo.modal = false">取消</UiButton>
            <UiButton variant="primary" @click="confirmModal">确认删除</UiButton>
          </template>
        </UiModal>
      </section>

      <!-- 加载与状态 -->
      <section class="ds__block">
        <h2 class="t-h2">加载与状态（Skeleton / Empty / Error）</h2>
        <p class="t-body-2 ds__note">
          普通页面加载用骨架屏；AI 生成使用流式输出（不用骨架屏）。
        </p>
        <div class="ds__grid ds__grid--3">
          <UiCard title="骨架屏 · 文本">
            <UiSkeleton variant="text" :lines="3" />
          </UiCard>
          <UiCard title="骨架屏 · 卡片">
            <UiSkeleton variant="card" />
          </UiCard>
          <UiCard title="骨架屏 · 指标">
            <UiSkeleton variant="metrics" />
          </UiCard>
        </div>
        <div class="ds__grid ds__grid--2" style="margin-top: var(--sp-3)">
          <UiCard surface="plain">
            <UiEmptyState title="还没有错题" description="拍一道题或手动录入，就会出现在这里。">
              <template #action>
                <UiButton variant="primary" @click="notify('去拍题')">去拍题</UiButton>
              </template>
            </UiEmptyState>
          </UiCard>
          <UiCard surface="plain">
            <UiErrorState
              title="识别失败"
              description="图片太模糊，建议重新拍一张，或直接输入题目文字。"
              retry-text="重新上传"
              @retry="notify('重新上传')"
            />
          </UiCard>
        </div>
      </section>

      <!-- AI 状态 -->
      <section class="ds__block">
        <h2 class="t-h2">AI 状态（Logo / 状态条）</h2>
        <p class="t-body-2 ds__note">
          科技感通过光效、动态 Logo、流式内容与状态变化表达，不展示模型内部思考过程。
        </p>
        <div class="ds__row wrap">
          <div v-for="s in aiStates" :key="s.key" class="ds__aistate">
            <UiAiLogo :state="s.key" size="lg" />
            <span class="t-label">{{ s.label }}</span>
          </div>
        </div>
        <div class="ds__row" style="margin-top: var(--sp-4)">
          <UiButton variant="primary" @click="startAi">模拟 AI 处理流程</UiButton>
          <UiButton variant="ghost" @click="stopAi">停止生成</UiButton>
          <span class="t-label">状态：{{ ai.state }}</span>
        </div>
      </section>

      <!-- 外壳 -->
      <section class="ds__block">
        <h2 class="t-h2">外壳（AppShell / TopNav / BottomNav / AiStatusBar）</h2>
        <div class="ds__grid ds__grid--2">
          <div class="t-body-2">
            顶部导航在 <code class="t-code">≥768px</code> 显示（首页 / AI拍题 / 错题学习 / AI对话 /
            更多 + 头像·我的）；底部五项导航在 <code class="t-code">&lt;768px</code> 显示。
            当前页面已经套在外壳内，可直接缩放窗口验证。
          </div>
          <div class="t-body-2">
            全局 AI 状态条吸顶常驻，用于「离开生成页面后仍能看到生成状态」；点击上面的
            「模拟 AI 处理流程」可以观察它的状态变化。
          </div>
        </div>
        <div class="ds__row wrap" style="margin-top: var(--sp-3)">
          <UiButton v-for="r in routePreview" :key="r.path" variant="ghost" size="sm" @click="onNavigate(r.path)">
            {{ r.path }}
          </UiButton>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import AppShell from '../layouts/AppShell.vue'
import UiButton from '../ui/UiButton.vue'
import UiCard from '../ui/UiCard.vue'
import UiTag from '../ui/UiTag.vue'
import UiInput from '../ui/UiInput.vue'
import UiModal from '../ui/UiModal.vue'
import UiSkeleton from '../ui/UiSkeleton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiErrorState from '../ui/UiErrorState.vue'
import UiAiLogo from '../ui/UiAiLogo.vue'
import { toast } from '../ui/toast.js'
import { ROUTES } from '../lib/routes.js'

/* 主题切换（仅自检页提供；正式入口在「我的 → 系统设置」） */
const theme = ref(document.documentElement.dataset.theme || 'dark')
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  try {
    localStorage.setItem('zy_theme', theme.value)
  } catch {
    /* ignore */
  }
}

const active = ref(ROUTES.home)
const demo = reactive({ text: '', bio: '', error: '阿', area: '', modal: false })

/* 颜色 token 展示（与 tokens.css 一一对应） */
const styleOf = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const tokens = [
  '--background',
  '--surface-1',
  '--surface-2',
  '--surface-3',
  '--surface-unit',
  '--hero-surface',
  '--border-subtle',
  '--border-default',
  '--border-strong',
  '--primary',
  '--primary-hover',
  '--primary-cta',
  '--primary-soft-1',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--text-muted',
  '--accent-glow',
  '--success',
  '--warning',
  '--error',
  '--info',
]
const swatches = computed(() => tokens.map((name) => ({ name, value: styleOf(name) || '—' })))

const typeScale = [
  { key: 'Display', cls: 't-display', size: '28px' },
  { key: 'H1', cls: 't-h1', size: '22px' },
  { key: 'H2', cls: 't-h2', size: '17px' },
  { key: 'H3', cls: 't-h3', size: '15px' },
  { key: 'Body', cls: 't-body', size: '13.5px' },
  { key: 'Body 2', cls: 't-body-2', size: '12.5px' },
  { key: 'Caption', cls: 't-caption', size: '12px' },
  { key: 'Label', cls: 't-label', size: '11.5px' },
  { key: 'Code', cls: 't-code', size: '12.5px mono' },
  { key: 'Metric', cls: 't-metric', size: '25px' },
]

const aiStates = [
  { key: 'idle', label: 'idle · 待命' },
  { key: 'working', label: 'working · 处理中' },
  { key: 'streaming', label: 'streaming · 输出中' },
  { key: 'completed', label: 'completed · 完成' },
]

/* AI 状态条演示：常驻显示，working → streaming → completed */
const ai = reactive({ state: 'idle', text: '知一待命 · 全局状态条常驻示例', meta: '', progress: 0 })
let timers = []

function clearTimers() {
  timers.forEach((t) => clearTimeout(t))
  timers = []
}

function startAi() {
  clearTimers()
  ai.state = 'working'
  ai.text = '正在读取题目'
  ai.meta = ''
  ai.progress = 12
  const steps = [
    { at: 700, text: '正在识别题目结构', progress: 38 },
    { at: 1500, text: '正在整理题目', progress: 66 },
    { at: 2300, text: '正在生成讲解', progress: 82, state: 'streaming' },
    { at: 3400, text: 'AI 已完成', progress: 100, state: 'completed' },
  ]
  steps.forEach((s) => {
    timers.push(
      setTimeout(() => {
        ai.text = s.text
        ai.progress = s.progress
        if (s.state) ai.state = s.state
        if (ai.state === 'completed') ai.meta = '用时 3.4s'
      }, s.at),
    )
  })
}

function stopAi() {
  clearTimers()
  ai.state = 'idle'
  ai.text = '知一待命 · 全局状态条常驻示例'
  ai.meta = ''
  ai.progress = 0
  notify('已停止生成（用户主动停止不算错误）')
}

function notify(message, type = 'info') {
  toast(message, { type })
}

function persistToast() {
  const dismiss = toast.persist('已保存到错题本', {
    type: 'success',
    actionText: '撤销',
    onAction: () => notify('已撤销'),
  })
  timers.push(setTimeout(dismiss, 5000))
}

function confirmModal() {
  demo.modal = false
  notify('已确认（演示）', 'success')
}

const routePreview = [ROUTES.capture, ROUTES.wrongbook, ROUTES.chat, ROUTES.tools, ROUTES.mine]

function onNavigate(path) {
  active.value = path
  toast(`路由将在 P2 接入 vue-router：${path}`)
}

onBeforeUnmount(clearTimers)
</script>

<style scoped>
.ds {
  display: flex;
  flex-direction: column;
  gap: var(--sp-8);
}
.ds__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-5);
  padding: var(--sp-6);
}
.ds__hero-side {
  flex: none;
}
.ds__block {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.ds__note {
  max-width: 72ch;
}
.ds__grid {
  display: grid;
  gap: var(--sp-3);
}
.ds__grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.ds__grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.ds__grid--4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.ds__surface {
  min-height: 96px;
  display: flex;
  align-items: flex-end;
  padding: var(--sp-4);
  border-radius: var(--radius-lg);
  border: var(--border-subtle);
  border-top: var(--border-top-subtle);
}
.ds__surface.bg {
  background: var(--background);
  border: 0.5px dashed rgba(150, 175, 230, 0.2);
}
.ds__surface.unit {
  background: var(--surface-unit);
  box-shadow: var(--highlight-1);
}
.ds__surface.recess {
  background: var(--surface-recess);
  box-shadow: var(--highlight-recess);
}
.ds__surface.brand {
  background: var(--primary-soft-1);
  border-color: var(--primary-line);
}
.ds__surface.glow {
  background: radial-gradient(120% 120% at 0% 0%, var(--accent-glow) 0%, transparent 60%),
    var(--surface-1);
}
.ds__row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.ds__row.wrap {
  flex-wrap: wrap;
}
.ds__swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--sp-3);
}
.ds__swatch {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  background: var(--surface-1);
}
.ds__chip {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 0.5px solid rgba(255, 255, 255, 0.14);
  flex: none;
}
.ds__hex {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 11px;
}
.ds__type {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.ds__typerow {
  display: flex;
  align-items: baseline;
  gap: var(--sp-4);
  padding-bottom: var(--sp-2);
  border-bottom: var(--border-divider-soft);
}
.ds__typekey {
  width: 72px;
  flex: none;
}
.ds__hintbox {
  margin-top: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  background: var(--error-soft);
  color: var(--text-secondary);
}
.ds__aistate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  background: var(--surface-1);
  min-width: 120px;
}

@media (max-width: 1024px) {
  .ds__grid--4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ds__grid--3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .ds__hero {
    flex-direction: column;
  }
  .ds__grid--2,
  .ds__grid--3,
  .ds__grid--4 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
