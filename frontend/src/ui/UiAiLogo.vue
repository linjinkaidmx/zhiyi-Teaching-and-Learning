<template>
  <div class="ui-ai-logo" :data-state="state" :class="[`ui-ai-logo--${size}`]" :title="label || stateText">
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <!-- 占位版 Logo：学习（弧线/轨迹）+ AI（节点）的抽象融合，正式 Logo 在后续阶段替换 -->
      <path
        class="ui-ai-logo__path"
        d="M2.4 11C4.3 7.2 6.4 5.4 8.7 5.4c1.7 0 3 1.1 3 2.6"
        stroke="currentColor"
        stroke-width="1.2"
        fill="none"
        stroke-linecap="round"
      />
      <circle class="ui-ai-logo__node" cx="9.8" cy="3.6" r="1.5" />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * AI Logo：状态可视化
 *  idle      静态，无发光
 *  working   呼吸 + 蓝紫光圈（AI 正在处理）
 *  streaming 光圈 + 节点跳动（正在流式输出）
 *  completed 收敛为完成的绿色描边，随后可回到 idle
 */
const props = defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'working', 'streaming', 'completed'].includes(v),
  },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
  label: { type: String, default: '' },
})

const stateText = computed(
  () =>
    ({ idle: '知一待命', working: 'AI 正在处理', streaming: 'AI 正在输出', completed: 'AI 已完成' })[
      props.state
    ],
)
</script>

<style scoped>
.ui-ai-logo {
  display: grid;
  place-items: center;
  border-radius: 7px;
  border: 1px solid var(--ai-idle-ring);
  color: var(--text-secondary);
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease),
    color var(--dur) var(--ease);
  flex: none;
}
.ui-ai-logo--sm {
  width: 18px;
  height: 18px;
}
.ui-ai-logo--sm svg {
  width: 10px;
  height: 10px;
}
.ui-ai-logo--md {
  width: 22px;
  height: 22px;
}
.ui-ai-logo--md svg {
  width: 14px;
  height: 14px;
}
.ui-ai-logo--lg {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}
.ui-ai-logo--lg svg {
  width: 20px;
  height: 20px;
}

.ui-ai-logo__node {
  fill: currentColor;
}

.ui-ai-logo[data-state='working'] {
  border-color: var(--ai-working-ring);
  color: var(--primary-text);
  animation: zy-breathe 2.4s var(--ease) infinite;
}
.ui-ai-logo[data-state='streaming'] {
  border-color: var(--ai-streaming-ring);
  color: var(--primary-text);
  box-shadow: 0 0 0 3px var(--ai-streaming-glow);
}
.ui-ai-logo[data-state='streaming'] .ui-ai-logo__node {
  animation: zy-pulse 1.1s var(--ease) infinite;
}
.ui-ai-logo[data-state='streaming'] .ui-ai-logo__path {
  stroke-dasharray: 18;
  animation: ui-ai-trace 1.4s linear infinite;
}
.ui-ai-logo[data-state='completed'] {
  border-color: var(--ai-completed-ring);
  color: var(--success);
  box-shadow: 0 0 0 3px var(--ai-completed-glow);
}

@keyframes ui-ai-trace {
  from {
    stroke-dashoffset: 36;
  }
  to {
    stroke-dashoffset: 0;
  }
}
</style>
