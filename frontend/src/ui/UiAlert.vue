<template>
  <div class="ui-alert" :data-variant="variant" role="alert">
    <span class="ui-alert__icon" aria-hidden="true">
      {{ variant === 'error' ? '!' : variant === 'warning' ? '!' : variant === 'success' ? '✓' : 'i' }}
    </span>
    <div class="ui-alert__body">
      <p v-if="title" class="ui-alert__title">{{ title }}</p>
      <p v-if="$slots.default" class="ui-alert__desc"><slot /></p>
    </div>
  </div>
</template>

<script setup>
/** 提示条：替代 el-alert（info / warning / error / success） */
defineProps({
  variant: { type: String, default: 'info', validator: (v) => ['info', 'warning', 'error', 'success'].includes(v) },
  title: { type: String, default: '' },
})
</script>

<style scoped>
.ui-alert {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  border-left: 2px solid currentColor;
  font-size: var(--fs-body-2);
  line-height: var(--lh-body);
}
.ui-alert[data-variant='info'] {
  background: var(--info-soft);
  color: var(--info);
}
.ui-alert[data-variant='warning'] {
  background: var(--warning-soft);
  color: var(--warning);
}
.ui-alert[data-variant='error'] {
  background: var(--error-soft);
  color: var(--error);
}
.ui-alert[data-variant='success'] {
  background: var(--success-soft);
  color: var(--success);
}
.ui-alert__icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid currentColor;
  display: grid;
  place-items: center;
  font-size: 10px;
  flex: none;
  margin-top: 1px;
}
.ui-alert__body {
  flex: 1;
  min-width: 0;
}
.ui-alert__title {
  font-size: var(--fs-body-2);
}
.ui-alert__desc {
  margin-top: var(--sp-1);
  color: var(--text-secondary);
}
</style>
