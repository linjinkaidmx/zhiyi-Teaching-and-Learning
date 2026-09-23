<template>
  <Transition name="ui-ai-bar">
    <div v-if="visible" class="ui-ai-bar" :data-state="state" role="status" aria-live="polite">
      <div class="zy-container ui-ai-bar__inner">
        <UiAiLogo :state="state" size="sm" />
        <span class="ui-ai-bar__text">{{ text || stateText }}</span>
        <span v-if="meta" class="ui-ai-bar__meta">{{ meta }}</span>

        <div v-if="progress > 0" class="ui-ai-bar__progress" aria-hidden="true">
          <span :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }" />
        </div>

        <button v-if="canStop" class="ui-ai-bar__stop" type="button" @click="$emit('stop')">
          停止生成
        </button>
        <button v-if="canRerun" class="ui-ai-bar__rerun" type="button" @click="$emit('rerun')">
          重新生成
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import UiAiLogo from '../ui/UiAiLogo.vue'

/**
 * 全局 AI 状态条：常驻页面顶部（吸顶），让用户离开生成页面后仍能看到生成状态。
 * state: idle | working | streaming | completed
 */
const props = defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'working', 'streaming', 'completed'].includes(v),
  },
  text: { type: String, default: '' },
  meta: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  canStop: { type: Boolean, default: false },
  canRerun: { type: Boolean, default: false },
  /** idle 且无文案时自动隐藏 */
  autoHide: { type: Boolean, default: true },
})
defineEmits(['stop', 'rerun'])

const stateText = computed(
  () =>
    ({
      idle: '知一待命',
      working: 'AI 正在处理…',
      streaming: 'AI 正在输出…',
      completed: 'AI 已完成',
    })[props.state],
)

const visible = computed(() => {
  if (props.state !== 'idle') return true
  return props.autoHide ? !!props.text.trim() : true
})
</script>

<style scoped>
.ui-ai-bar {
  position: sticky;
  top: 62px;
  z-index: var(--z-sticky);
  background: color-mix(in srgb, var(--background) 88%, transparent);
  backdrop-filter: saturate(140%) blur(12px);
  border-bottom: var(--border-divider-soft);
}
.ui-ai-bar__inner {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 40px;
  position: relative;
}
.ui-ai-bar__text {
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.ui-ai-bar__meta {
  font-size: var(--fs-label);
  color: var(--text-muted);
}
.ui-ai-bar__progress {
  flex: 1;
  height: 3px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  min-width: 60px;
}
.ui-ai-bar__progress > span {
  display: block;
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-pill);
  transition: width var(--dur-slow) var(--ease);
}
.ui-ai-bar__stop,
.ui-ai-bar__rerun {
  margin-left: auto;
  padding: 4px 10px;
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-secondary);
  font-size: var(--fs-label);
  cursor: pointer;
}
.ui-ai-bar__rerun {
  margin-left: 0;
}
.ui-ai-bar__stop:hover,
.ui-ai-bar__rerun:hover {
  border-color: var(--primary-line);
  color: var(--primary-text);
}

.ui-ai-bar-enter-active,
.ui-ai-bar-leave-active {
  transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.ui-ai-bar-enter-from,
.ui-ai-bar-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 767px) {
  .ui-ai-bar {
    top: 0;
  }
}
</style>
