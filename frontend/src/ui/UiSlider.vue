<template>
  <input
    class="ui-slider"
    type="range"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    @input="onInput"
    @change="$emit('change', Number($event.target.value))"
  />
</template>

<script setup>
/** 滑块：替代 el-slider（原生 range，保留 min/max/step 语义） */
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'change'])

function onInput(e) {
  const v = Number(e.target.value)
  if (v !== props.modelValue) emit('update:modelValue', v)
}
</script>

<style scoped>
.ui-slider {
  width: 100%;
  height: 20px;
  appearance: none;
  background: none;
  cursor: pointer;
}
.ui-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
}
.ui-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: 50%;
  background: var(--primary);
  border: 0;
}
.ui-slider::-moz-range-track {
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--surface-unit);
}
.ui-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--primary);
}
.ui-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
