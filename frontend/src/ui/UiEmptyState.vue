<template>
  <div class="ui-state">
    <div class="ui-state__art">
      <slot name="art">
        <svg viewBox="0 0 84 60" width="84" height="60" aria-hidden="true">
          <rect x="8" y="14" width="68" height="38" rx="7" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.5" />
          <path d="M22 34h40" stroke="currentColor" stroke-width="1.2" opacity="0.35" />
          <path d="M22 42h24" stroke="currentColor" stroke-width="1.2" opacity="0.25" />
          <circle cx="42" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.5" />
          <path d="M42 12v2" stroke="currentColor" stroke-width="1.2" opacity="0.4" />
        </svg>
      </slot>
    </div>
    <p class="ui-state__title">{{ title }}</p>
    <p v-if="description" class="ui-state__desc">{{ description }}</p>
    <div v-if="$slots.action" class="ui-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup>
/** 空状态：插画 + 简短说明 + 明确行动按钮（按钮文案由使用方按场景给） */
defineProps({
  title: { type: String, default: '这里还没有内容' },
  description: { type: String, default: '' },
})
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
  color: var(--text-disabled);
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
</style>
