<template>
  <input
    class="ui-number"
    :class="{ 'is-sm': size === 'sm' }"
    type="number"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    @change="onChange"
  />
</template>

<script setup>
/** 数字输入：替代 el-input-number（用原生 number，保留 min/max/step 语义） */
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: undefined },
  max: { type: Number, default: undefined },
  step: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md', validator: (v) => ['sm', 'md'].includes(v) },
})
const emit = defineEmits(['update:modelValue', 'change'])

function onChange(e) {
  let v = Number(e.target.value)
  if (Number.isNaN(v)) v = props.min != null ? props.min : 0
  if (props.min != null) v = Math.max(props.min, v)
  if (props.max != null) v = Math.min(props.max, v)
  e.target.value = v
  emit('update:modelValue', v)
  emit('change', v)
}
</script>

<style scoped>
.ui-number {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: var(--border-default);
  border-top: var(--border-top-default);
  background: var(--surface-recess);
  color: var(--text-primary);
  font-size: var(--fs-body);
}
.ui-number.is-sm {
  min-height: 32px;
  padding: 6px 8px;
  font-size: var(--fs-body-2);
}
.ui-number:focus {
  outline: none;
  border-color: var(--primary-line);
  background: var(--primary-soft-3);
}
</style>
