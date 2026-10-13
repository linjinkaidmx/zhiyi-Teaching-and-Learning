<template>
  <div class="zy-container zy-page help">
    <header class="help__head">
      <h1 class="t-h1">帮助与反馈</h1>
      <p class="t-body-2">先看常见问题；没解决就在下面直接写，我们能看到</p>
    </header>

    <!-- FAQ -->
    <section class="help__block surface-standard">
      <div class="help__block-head">
        <span class="help__block-ic"><UiIcon name="help" :size="16" /></span>
        <h2 class="t-h3">常见问题</h2>
      </div>
      <div class="help__faq">
        <details v-for="(f, i) in faq" :key="i" class="help__item">
          <summary class="help__q">
            <span class="help__q-text">{{ f.q }}</span>
            <span class="help__q-ic"><UiIcon name="plus" :size="14" /></span>
          </summary>
          <p class="help__a t-body-2">{{ f.a }}</p>
        </details>
      </div>
    </section>

    <!-- 反馈 -->
    <section class="help__block surface-standard">
      <div class="help__block-head">
        <span class="help__block-ic is-accent"><UiIcon name="chat" :size="16" /></span>
        <h2 class="t-h3">意见反馈</h2>
      </div>
      <p class="t-body-2">
        遇到问题、想要的功能、觉得哪里别扭，都可以写在这里。若与某道题有关，请顺手把题目关键词也写上。
      </p>
      <UiInput
        v-model="content"
        type="textarea"
        :rows="5"
        :maxlength="500"
        show-count
        placeholder="例如：识别后把两道题合成了一道 / 希望自测能按课程筛选 / 公式在手机上显示偏小…"
      />
      <div class="help__ops">
        <UiButton variant="primary" :loading="sending" @click="send">提交反馈</UiButton>
        <span class="t-label">当前账号：{{ whoami }}</span>
      </div>
    </section>

    <!-- 自助排查 -->
    <section class="help__block surface-standard">
      <div class="help__block-head">
        <span class="help__block-ic is-safe"><UiIcon name="refresh" :size="16" /></span>
        <h2 class="t-h3">常见故障自助排查</h2>
      </div>
      <div class="help__checks">
        <div v-for="c in checks" :key="c.title" class="help__check">
          <span class="help__check-ic"><UiIcon name="check" :size="13" /></span>
          <div class="help__check-body">
            <span class="help__check-t">{{ c.title }}</span>
            <span class="help__check-d">{{ c.desc }}</span>
          </div>
        </div>
      </div>
    </section>
    <!-- 重看新手教程 -->
    <section class="help__block surface-standard">
      <div class="help__block-head">
        <span class="help__block-ic"><UiIcon name="play" :size="16" /></span>
        <h2 class="t-h3">重新查看新手教程</h2>
      </div>
      <p class="t-body-2">忘了某个功能怎么用？点对应按钮重看一遍图文教程。</p>
      <div class="help__tours">
        <button
          v-for="t in tourList"
          :key="t.key"
          type="button"
          class="help__tour"
          @click="openTour(t.key)"
        >
          <span class="help__tour-ic"><UiIcon :name="t.icon" :size="14" /></span>
          <span>{{ t.label }}</span>
        </button>
      </div>
    </section>

    <UiTour v-model="tourOpen" :tour-key="activeTour" />
  </div>
</template>

<script setup>
/**
 * 帮助与反馈（/help）
 * 反馈走真实接口 api.feedback（后端已有），不再造 mock。
 */
import { computed, ref } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiInput from '../ui/UiInput.vue'
import UiTour from '../ui/UiTour.vue'
import { api } from '../api'
import { session } from '../stores/sessionStore'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'

const content = ref('')
const sending = ref(false)
const whoami = computed(() => (session.space === 'account' ? session.userId : '本机用户（未登录）'))

/* 重看新手教程：与各页面自动弹的是同一套内容 */
const tourList = [
  { key: 'welcome', label: '知一总体介绍', icon: 'home' },
  { key: 'teacher', label: 'AI 课堂', icon: 'teacher' },
  { key: 'companion', label: 'AI 伴学', icon: 'sparkle' },
  { key: 'classroom', label: '班级', icon: 'users' },
  { key: 'community', label: '知一社区', icon: 'chat' },
  { key: 'wrongbook', label: '错题学习', icon: 'book' },
  { key: 'practice', label: '自测练习', icon: 'target' },
  { key: 'exam', label: '模拟考试', icon: 'clipboard' },
]
const tourOpen = ref(false)
const activeTour = ref('welcome')
function openTour(key) {
  activeTour.value = key
  tourOpen.value = true
}

const faq = [
  { q: '识别不准 / 只识别出一部分题目怎么办？', a: '尽量正对题目、光线均匀、避免倾斜与阴影；也可以在拍题页直接用「文字」通道把题目打进来。识别后再手动拆题/合并也能救回来。' },
  { q: '讲解里的公式显示不出来？', a: '在「我的 → 偏好设置」里检查「公式渲染」是否被关掉（关闭时会显示为纯文本，便于复制）。若仍异常，请把题目关键词通过下方反馈发给我们。' },
  { q: '为什么有时讲解要等十几秒？', a: '讲解用的是带推理的模型，越难的题越慢；超时会自动降级为更快的模型重试一次，保证你能拿到讲解。' },
  { q: '换个设备数据会丢吗？', a: '未登录时数据只在本机浏览器里，换设备不会带过去。登录后错题本与打卡统计会同步到账号，用昵称登录即可拉回。' },
  { q: '「已掌握」是怎么判定的？', a: '自测里连续答对 2 次就标记为已掌握并移出复习队列；只要答错一次就回到复习队列重新累积。' },
  { q: '怎么导出和备份数据？', a: '在「我的 → 数据管理」里可以导出全部数据为 JSON；换设备时用「导入备份」合并或覆盖，也可以「以云端覆盖本地」。' },
]

const checks = [
  { title: '页面空白 / 打不开', desc: '先强制刷新（Ctrl/Cmd+Shift+R）；仍不行请反馈浏览器与系统版本' },
  { title: '上传图片没反应', desc: '确认是图片格式（jpg/png/webp）；超大图片先裁剪一次再传' },
  { title: '登录后数据没回来', desc: '在「我的 → 数据管理」点「立即同步」，或「以云端覆盖本地」' },
  { title: '自测抽不到题', desc: '说明当前没有待巩固的题；去拍题或从 AI 课堂攒几道，答错会自动进入待巩固' },
]

async function send() {
  const text = content.value.trim()
  if (text.length < 5) {
    toast.info('再多写几个字吧')
    return
  }
  sending.value = true
  try {
    const r = await api.feedback(session.token || '', text, '', 'v1')
    if (!r.ok) {
      toast.error(r.error || '提交失败')
      return
    }
    content.value = ''
    toast.success('感谢反馈，已收到')
  } catch (e) {
    toastError(e, '提交失败')
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.help {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.help__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.help__block {
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
/* 区块头：图标 + 标题 */
.help__block-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.help__block-head .t-h3 {
  margin: 0;
}
.help__block-ic {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.help__block-ic.is-accent {
  background: rgba(201, 80, 58, 0.12);
  color: #c9503a;
}
.help__block-ic.is-safe {
  background: rgba(58, 120, 192, 0.12);
  color: #3a78c0;
}
.help__faq {
  display: flex;
  flex-direction: column;
}
.help__item {
  border-bottom: var(--border-divider-soft);
  padding: var(--sp-2) 0;
}
.help__item:last-child {
  border-bottom: 0;
}
.help__q {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  cursor: pointer;
  font-size: var(--fs-body);
  color: var(--text-primary);
  list-style: none;
  transition: color var(--dur) var(--ease);
}
.help__q:hover {
  color: var(--primary-text);
}
.help__q::-webkit-details-marker {
  display: none;
}
.help__q-text {
  flex: 1;
  min-width: 0;
}
/* 折叠指示：＋ 图标，展开时旋转成 × */
.help__q-ic {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-unit);
  color: var(--text-tertiary);
  transition: transform var(--dur) var(--ease), background var(--dur) var(--ease),
    color var(--dur) var(--ease);
}
.help__q:hover .help__q-ic {
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.help__item[open] .help__q-ic {
  transform: rotate(45deg);
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.help__a {
  margin-top: var(--sp-2);
  padding-left: calc(var(--sp-2) + 12px);
  color: var(--text-secondary);
  line-height: var(--lh-body);
}
.help__ops {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
/* 自助排查：卡片网格 */
.help__checks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--sp-2);
}
.help__check {
  display: flex;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  background: var(--surface-recess);
}
.help__check-ic {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.help__check-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.help__check-t {
  font-size: var(--fs-body-2);
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}
.help__check-d {
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  line-height: var(--lh-relaxed);
}
/* 重看教程入口 */
.help__tours {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.help__tour {
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
.help__tour:hover {
  color: var(--primary-text);
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.help__tour-ic {
  display: inline-flex;
  color: var(--primary-text);
}
</style>
