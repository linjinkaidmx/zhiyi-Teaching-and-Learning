<template>
  <component
    :is="as"
    class="ui-card"
    :class="[surfaceClass, { 'ui-card--task': task, 'ui-card--pad-lg': padLg }]"
  >
    <div v-if="title || $slots.head || $slots.action" class="ui-card__head">
      <span v-if="title" class="ui-card__title">{{ title }}</span>
      <slot name="head" />
      <span class="ui-card__spacer" />
      <slot name="action" />
    </div>
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'

/**
 * 表面卡片：四级表面必须通过 surface 指定，组件内不写死颜色
 *  standard = 普通模块 / elevated = 重点模块 / hero = 主模块 / plain = 无表面
 *  表面类由 styles/themes.css 全局提供，保证全站层级一致。
 */
const props = defineProps({
  as: { type: String, default: 'section' },
  surface: {
    type: String,
    default: 'standard',
    validator: (v) => ['standard', 'elevated', 'hero', 'plain'].includes(v),
  },
  task: { type: Boolean, default: false },
  title: { type: String, default: '' },
  padLg: { type: Boolean, default: false },
})

const surfaceClass = computed(() => `surface-${props.surface}`)
</script>

<style scoped>
.ui-card {
  padding: var(--sp-5);
  transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.ui-card--pad-lg {
  padding: var(--sp-6);
}
.ui-card__head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}
.ui-card__title {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.ui-card__spacer {
  flex: 1;
}
.ui-card--task {
  position: relative;
  overflow: hidden;
}
.ui-card--task::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18px;
  bottom: 18px;
  width: 2px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--primary-bar), rgba(124, 92, 255, 0.28));
}
</style>
