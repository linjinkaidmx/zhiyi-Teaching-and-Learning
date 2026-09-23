<template>
  <div class="ui-skeleton" :class="`ui-skeleton--${variant}`" aria-hidden="true">
    <template v-if="variant === 'card'">
      <div class="skeleton ui-skeleton__title" />
      <div class="skeleton ui-skeleton__line" style="width: 92%" />
      <div class="skeleton ui-skeleton__line" style="width: 76%" />
    </template>
    <template v-else-if="variant === 'metrics'">
      <div v-for="i in 3" :key="i" class="ui-skeleton__metric">
        <div class="skeleton ui-skeleton__num" />
        <div class="skeleton ui-skeleton__cap" />
      </div>
    </template>
    <template v-else>
      <div
        v-for="i in lines"
        :key="i"
        class="skeleton ui-skeleton__line"
        :style="{ width: i === lines && lines > 1 ? '64%' : '100%' }"
      />
    </template>
  </div>
</template>

<script setup>
/** 骨架屏：用于普通页面加载（AI 生成使用流式输出，不用骨架屏） */
defineProps({
  variant: { type: String, default: 'text', validator: (v) => ['text', 'card', 'metrics'].includes(v) },
  lines: { type: Number, default: 3 },
})
</script>

<style scoped>
.ui-skeleton__line {
  height: 12px;
  margin-bottom: var(--sp-2);
}
.ui-skeleton__line:last-child {
  margin-bottom: 0;
}
.ui-skeleton__title {
  height: 16px;
  width: 38%;
  margin-bottom: var(--sp-3);
}
.ui-skeleton--metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
}
.ui-skeleton__num {
  height: 24px;
  width: 60%;
  margin-bottom: var(--sp-2);
}
.ui-skeleton__cap {
  height: 10px;
  width: 70%;
}
</style>
