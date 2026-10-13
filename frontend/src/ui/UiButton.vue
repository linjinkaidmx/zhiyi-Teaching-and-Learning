<template>
  <button
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, { 'ui-btn--block': block, 'ui-btn--loading': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    type="button"
    @click="$emit('click', $event)"
  >
    <slot name="icon" />
    <UiIcon v-if="icon" :name="icon" :size="iconSize" class="ui-btn__icon" />
    <span class="ui-btn__label"><slot /></span>
  </button>
</template>

<script setup>
/**
 * 三级按钮体系：Primary（页面主操作）/ CTA（模块内主操作）/ Secondary（次级）
 *            / Ghost（轻量动作）/ Text（文字动作）
 * 每页只应有一个 Primary。
 */
import { computed } from 'vue'
import UiIcon from './UiIcon.vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'ghost',
    validator: (v) => ['primary', 'cta', 'secondary', 'soft', 'ghost', 'text'].includes(v),
  },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md', 'lg'].includes(v) },
  block: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** 前置线性图标名（见 UiIcon） */
  icon: { type: String, default: '' },
})

const iconSize = computed(() => (props.size === 'lg' ? 16 : 14))
defineEmits(['click'])
</script>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  min-height: 38px;
  padding: 0 var(--sp-5);
  border: 0.5px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  font-size: var(--fs-button);
  font-weight: var(--fw-medium);
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease),
    color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.ui-btn:active {
  transform: translateY(0.5px);
}
.ui-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ui-btn--sm {
  min-height: 32px;
  padding: 0 var(--sp-4);
  font-size: var(--fs-body-2);
}
.ui-btn--lg {
  min-height: 44px;
  padding: 0 var(--sp-6);
}
.ui-btn--block {
  width: 100%;
}

.ui-btn--primary {
  background: var(--primary);
  color: var(--text-on-primary);
  box-shadow: var(--shadow-primary);
}
.ui-btn--primary:not(:disabled):hover {
  background: var(--primary-hover);
}
.ui-btn--primary:not(:disabled):active {
  background: var(--primary-active);
}

.ui-btn--cta {
  background: var(--primary-cta);
  color: var(--text-on-primary);
  box-shadow: var(--shadow-cta);
}
.ui-btn--cta:not(:disabled):hover {
  background: var(--primary-cta-hover);
}

.ui-btn--secondary {
  border-color: var(--primary-line);
  color: var(--primary-text);
}
.ui-btn--secondary:not(:disabled):hover {
  background: var(--primary-soft-3);
  border-color: var(--primary);
}
/* soft：白底胶囊返回键（对齐 AI 课堂 .tch__back 那套：白底 + 淡描边 + 胶囊 + hover 左移）
   注意：项目 --primary-soft-1/2/3 是「数字越大越淡」，hover 加深用 color-mix。 */
.ui-btn--soft {
  min-height: 0;
  padding: 7px 14px;
  gap: 5px;
  background: var(--surface-1);
  border-color: var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: var(--fw-semibold);
}
.ui-btn--soft:not(:disabled):hover {
  background: var(--surface-1);
  border-color: var(--primary);
  color: var(--primary-text);
  transform: translateX(-2px);
}

.ui-btn--ghost {
  border-color: rgba(165, 190, 240, 0.2);
  color: var(--text-secondary);
}
.ui-btn--ghost:not(:disabled):hover {
  background: var(--surface-hover);
  border-color: rgba(175, 198, 250, 0.3);
  color: var(--text-primary);
}

.ui-btn--text {
  min-height: 0;
  padding: 0 var(--sp-1);
  color: var(--primary-text);
}
.ui-btn--text:not(:disabled):hover {
  color: var(--primary-text-strong);
}

.ui-btn--loading {
  position: relative;
}
.ui-btn--loading .ui-btn__label {
  visibility: hidden;
}
.ui-btn--loading::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: zy-spin 0.7s linear infinite;
}
</style>
