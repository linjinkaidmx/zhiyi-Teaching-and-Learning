<template>
  <component
    :is="clickable ? 'button' : 'span'"
    class="ui-tag"
    :class="[`ui-tag--${variant}`, { 'ui-tag--level': level, 'ui-tag--clickable': clickable }]"
    :type="clickable ? 'button' : undefined"
    @click="clickable && $emit('click', $event)"
  >
    <slot />
  </component>
</template>

<script setup>
/**
 * 标签 / 胶囊：掌握程度等状态必须「颜色 + 文字」同时表达（level 会在左侧加点）
 */
defineProps({
  variant: {
    type: String,
    default: 'neutral',
    validator: (v) => ['brand', 'brand-soft', 'neutral', 'success', 'warning', 'error', 'info'].includes(v),
  },
  clickable: { type: Boolean, default: false },
  level: { type: Boolean, default: false },
})
defineEmits(['click'])
</script>

<style scoped>
.ui-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 5px 12px;
  border: 0.5px solid transparent;
  border-top-color: rgba(170, 195, 245, 0.13);
  border-radius: var(--radius-pill);
  font-size: var(--fs-body-2);
  line-height: 1.4;
  white-space: nowrap;
}
.ui-tag--clickable {
  cursor: pointer;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease),
    border-color var(--dur) var(--ease);
}
.ui-tag--level::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.ui-tag--brand {
  background: var(--primary-soft-1);
  color: var(--primary-text-strong);
}
.ui-tag--brand.ui-tag--clickable:hover {
  background: rgba(124, 92, 255, 0.32);
}

.ui-tag--brand-soft {
  background: var(--primary-soft-2);
  color: var(--primary-text-soft);
}
.ui-tag--brand-soft.ui-tag--clickable:hover {
  background: var(--primary-soft-1);
}

.ui-tag--neutral {
  background: var(--surface-unit);
  color: var(--text-secondary);
}
.ui-tag--neutral.ui-tag--clickable:hover {
  color: var(--text-primary);
}

.ui-tag--success {
  background: var(--success-soft);
  color: var(--success);
}
.ui-tag--warning {
  background: var(--warning-soft);
  color: var(--warning);
}
.ui-tag--error {
  background: var(--error-soft);
  color: var(--error);
}
.ui-tag--info {
  background: var(--info-soft);
  color: var(--info);
}
</style>
