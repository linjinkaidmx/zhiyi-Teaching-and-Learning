<template>
  <div class="countpicker">
    <button
      v-for="n in options"
      :key="n"
      type="button"
      class="countpicker__btn"
      :class="{ 'is-active': count === n }"
      @click="$emit('change', n)"
    >
      {{ n === max ? '全部' : n }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/** 练习题数选择器（5 / 10 / 20 / 全部） */
const props = defineProps({
  count: { type: Number, default: 10 },
  max: { type: Number, default: 20 },
})
defineEmits(['change'])

const options = computed(() => {
  const base = [5, 10, 20].filter((n) => n < props.max)
  return [...base, props.max]
})
</script>

<style scoped>
.countpicker {
  display: flex;
  gap: var(--sp-2);
  margin: var(--sp-3) 0;
}
.countpicker__btn {
  min-width: 48px;
  padding: 8px 0;
  border: var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-size: var(--fs-body-2);
  cursor: pointer;
}
.countpicker__btn.is-active {
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
  color: var(--primary-text);
}
</style>
