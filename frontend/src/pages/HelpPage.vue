<template>
  <div class="zy-container zy-page help">
    <header class="help__head">
      <h1 class="t-h1">帮助与反馈</h1>
      <p class="t-body-2">先看常见问题；没解决就在下面直接写，我们能看到</p>
    </header>

    <!-- FAQ -->
    <section class="help__block surface-standard">
      <h2 class="t-h3">常见问题</h2>
      <div class="help__faq">
        <details v-for="(f, i) in faq" :key="i" class="help__item">
          <summary class="help__q">{{ f.q }}</summary>
          <p class="help__a t-body-2">{{ f.a }}</p>
        </details>
      </div>
    </section>

    <!-- 反馈 -->
    <section class="help__block surface-standard">
      <h2 class="t-h3">意见反馈</h2>
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
      <h2 class="t-h3">常见故障自助排查</h2>
      <div class="help__rows">
        <div v-for="c in checks" :key="c.title" class="help__row">
          <span class="help__row-t">{{ c.title }}</span>
          <span class="help__row-d">{{ c.desc }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
/**
 * 帮助与反馈（/help）
 * 反馈走真实接口 api.feedback（后端已有），不再造 mock。
 */
import { computed, ref } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import { api } from '../api'
import { session } from '../stores/sessionStore'
import { toast } from '../ui/toast.js'
import { toastError } from '../lib/errors.js'

const content = ref('')
const sending = ref(false)
const whoami = computed(() => (session.space === 'account' ? session.userId : '本机用户（未登录）'))

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
  { title: '自测抽不到题', desc: '说明当前没有待复习的题；可先添加新错题，或把已掌握的题答错一次回炉' },
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
  cursor: pointer;
  font-size: var(--fs-body);
  color: var(--text-primary);
  list-style: none;
}
.help__q::-webkit-details-marker {
  display: none;
}
.help__q::before {
  content: '＋';
  margin-right: var(--sp-2);
  color: var(--text-muted);
}
.help__item[open] .help__q::before {
  content: '－';
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
.help__rows {
  display: flex;
  flex-direction: column;
}
.help__row {
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-2) 0;
  font-size: var(--fs-body-2);
  border-bottom: var(--border-divider-soft);
}
.help__row:last-child {
  border-bottom: 0;
}
.help__row-t {
  min-width: 110px;
  color: var(--text-primary);
}
.help__row-d {
  color: var(--text-tertiary);
}
</style>
