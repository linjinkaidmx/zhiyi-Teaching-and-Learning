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
  gap: 8px;
  margin: var(--sp-3) 0;
  flex-wrap: wrap;
}
.countpicker__btn {
  min-width: 64px;
  padding: 7px 14px;
  border-radius: var(--radius-pill);
  border: var(--border-subtle);
  background: var(--surface-1);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.countpicker__btn:hover {
  border-color: var(--primary-line);
}
.countpicker__btn.is-active {
  border-color: transparent;
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
  color: #fff;
  font-weight: 600;
}
</style>
