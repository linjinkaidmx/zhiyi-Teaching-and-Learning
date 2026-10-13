<template>
  <div class="wp">
    <div class="wp__quick">
      <UiButton variant="ghost" size="sm" @click="pickAll">全选</UiButton>
      <UiButton variant="ghost" size="sm" @click="pickOdd">单周</UiButton>
      <UiButton variant="ghost" size="sm" @click="pickEven">双周</UiButton>
      <UiButton variant="ghost" size="sm" @click="emitText('')">清空</UiButton>
    </div>
    <div class="wp__grid">
      <button
        v-for="w in totalWeeks"
        :key="w"
        type="button"
        class="wp__chip"
        :class="{ 'is-on': picked.has(w) }"
        @click="toggle(w)"
      >{{ w }}</button>
    </div>
    <input
      class="wp__text"
      :value="modelValue"
      placeholder="也可直接输入，如 2-8, 12-16（留空=全学期）"
      @input="emitText($event.target.value)"
    />
  </div>
</template>

<script setup>
/**
 * 周次点选器：1~N 周格子点选 + 快捷（全选/单周/双周/清空）+ 文本输入双向同步
 * v-model = 周次文本（'2,5,7' / '2-8,12-16'，留空=全学期）
 */
import { computed } from 'vue'
import UiButton from './UiButton.vue'
import { parseRanges, formatRanges } from '../lib/schedulePeriods.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  totalWeeks: { type: Number, default: 20 },
})
const emit = defineEmits(['update:modelValue'])

const total = computed(() => Math.min(60, Math.max(1, Number(props.totalWeeks) || 20)))
const picked = computed(() => new Set(parseRanges(props.modelValue).flatMap(([a, b]) => {
  const out = []
  for (let w = a; w <= b; w += 1) out.push(w)
  return out
})))

function emitText(text) {
  emit('update:modelValue', String(text || '').trim())
}

function toggle(w) {
  const set = new Set(picked.value)
  if (set.has(w)) set.delete(w)
  else set.add(w)
  emitText(toRangesText(set))
}

function pickPattern(pred) {
  const set = new Set()
  for (let w = 1; w <= total.value; w += 1) if (pred(w)) set.add(w)
  emitText(toRangesText(set))
}

/** 排序去重后压缩成区间文本：{1,2,3,5,7} → '1-3,5,7' */
function toRangesText(set) {
  const arr = [...set].sort((a, b) => a - b)
  const ranges = []
  for (const w of arr) {
    const last = ranges[ranges.length - 1]
    if (last && w === last[1] + 1) last[1] = w
    else ranges.push([w, w])
  }
  return formatRanges(ranges)
}
</script>

<style scoped>
.wp {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.wp__quick {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.wp__grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
}
.wp__chip {
  padding: 4px 0;
  border: var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-recess);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.wp__chip:hover {
  border-color: var(--primary-line);
}
.wp__chip.is-on {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.wp__text {
  padding: 8px var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-subtle);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body-2);
}
.wp__text:focus {
  outline: none;
  border-color: var(--primary-line);
}
@media (max-width: 600px) {
  .wp__grid {
    grid-template-columns: repeat(10, minmax(0, 1fr));
  }
  .wp__chip {
    font-size: 10px;
    padding: 3px 0;
  }
}
</style>
