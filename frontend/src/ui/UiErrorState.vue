<template>
  <div class="ui-state ui-state--error">
    <div class="ui-state__art">
      <svg viewBox="0 0 84 60" width="84" height="60" aria-hidden="true">
        <circle cx="42" cy="28" r="16" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.7" />
        <path d="M42 20v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <circle cx="42" cy="36" r="1.4" fill="currentColor" />
        <path d="M14 50h56" stroke="currentColor" stroke-width="1.2" opacity="0.3" />
      </svg>
    </div>
    <p class="ui-state__title">{{ title }}</p>
    <p v-if="description" class="ui-state__desc">{{ description }}</p>
    <div class="ui-state__action">
      <slot name="action">
        <button v-if="retryText" class="ui-err-btn" type="button" @click="$emit('retry')">
          {{ retryText }}
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup>
/** 错误状态：说明原因 + 明确的重试/替代动作（区分网络错误 / 内容异常 / 服务繁忙由使用方决定文案） */
defineProps({
  title: { type: String, default: '出错了' },
  description: { type: String, default: '' },
  retryText: { type: String, default: '重试' },
})
defineEmits(['retry'])
</script>

<style scoped>
.ui-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-8) var(--sp-4);
  text-align: center;
}
.ui-state__art {
  color: var(--error);
}
.ui-state__title {
  font-size: var(--fs-h3);
  color: var(--text-primary);
}
.ui-state__desc {
  max-width: 34em;
  font-size: var(--fs-body-2);
  color: var(--text-tertiary);
}
.ui-err-btn {
  min-height: 34px;
  padding: 0 var(--sp-5);
  border: 0.5px solid var(--primary-line);
  border-radius: var(--radius-sm);
  background: none;
  color: var(--primary-text);
  font-size: var(--fs-button);
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.ui-err-btn:hover {
  background: var(--primary-soft-3);
}
</style>
