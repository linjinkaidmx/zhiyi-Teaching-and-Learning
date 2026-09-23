<template>
  <span class="ui-select" :class="{ 'is-disabled': disabled, 'is-sm': size === 'sm' }">
    <select
      class="ui-select__native"
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.value); $emit('change', $event.target.value)"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <!-- 平铺选项 -->
      <template v-for="(opt, i) in flatOptions" :key="'o' + i">
        <option :value="opt.value">{{ opt.label }}</option>
      </template>
      <!-- 分组选项 -->
      <optgroup v-for="(group, gi) in groupedOptions" :key="'g' + gi" :label="group.label">
        <option v-for="(opt, oi) in group.options" :key="'go' + oi" :value="opt.value">{{ opt.label }}</option>
      </optgroup>
    </select>
    <span class="ui-select__arrow" aria-hidden="true">▾</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

/**
 * 下拉选择：替代 el-select + el-option / el-option-group
 * 选项两种写法：
 *   [{ label, value }]                       → 平铺
 *   [{ label: '分组名', options: [...] }]    → optgroup（可混用）
 * 用原生 select，键盘与无障碍行为最稳。
 */
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md'].includes(v) },
})
defineEmits(['update:modelValue', 'change'])

const isGroup = (o) => o && Array.isArray(o.options)
const flatOptions = computed(() => props.options.filter((o) => !isGroup(o)))
const groupedOptions = computed(() => props.options.filter(isGroup))
</script>

<style scoped>
.ui-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
}
.ui-select__native {
  width: 100%;
  min-height: 38px;
  padding: 8px 30px 8px var(--sp-3);
  border-radius: var(--radius-sm);
  border: var(--border-default);
  border-top: var(--border-top-default);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body);
  appearance: none;
  cursor: pointer;
}
.ui-select.is-sm .ui-select__native {
  min-height: 32px;
  padding: 6px 28px 6px var(--sp-2);
  font-size: var(--fs-body-2);
}
.ui-select__native:focus {
  outline: none;
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
.ui-select__native option,
.ui-select__native optgroup {
  background: var(--surface-2);
  color: var(--text-primary);
}
.ui-select__arrow {
  position: absolute;
  right: var(--sp-3);
  color: var(--text-muted);
  font-size: 11px;
  pointer-events: none;
}
.ui-select.is-sm .ui-select__arrow {
  right: var(--sp-2);
}
.ui-select.is-disabled {
  opacity: 0.6;
}
</style>
