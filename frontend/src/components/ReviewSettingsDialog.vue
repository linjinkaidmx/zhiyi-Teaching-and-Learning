<template>
  <UiModal :model-value="modelValue" title="复习设置" @update:model-value="close">
    <div class="rs-row">
      <span class="t-body">开启间隔复习</span>
      <UiSwitch v-model="form.srsEnabled" />
    </div>
    <p class="t-body-2 rs-tip">关闭后，掌握即永久移出复习队列（不再自动回炉）。</p>

    <template v-if="form.srsEnabled">
      <div class="rs-row" style="margin: 14px 0 10px">
        <UiSegmented
          v-model="form.srsMode"
          :options="[{ label: '阶梯间隔', value: 'ladder' }, { label: '固定天数', value: 'fixed' }]"
          aria-label="复习间隔模式"
        />
      </div>
      <template v-if="form.srsMode === 'ladder'">
        <p class="t-body-2 rs-tip">每次答对后的复习间隔（天，逗号分隔）</p>
        <UiInput v-model="form.srsIntervalsText" placeholder="1,3,7,15,30" />
      </template>
      <template v-else>
        <p class="t-body-2 rs-tip">每次答对后固定间隔（天）</p>
        <UiNumber v-model="form.srsFixedDays" :min="1" :max="365" />
      </template>
    </template>

    <template #footer>
      <UiButton variant="ghost" @click="close(false)">取消</UiButton>
      <UiButton variant="primary" @click="save">保存</UiButton>
    </template>
  </UiModal>
</template>

<script setup>
/**
 * 复习设置对话框（SRS 间隔复习，用户可自定义、可关闭）
 * 数据层直接走 bookStore.settingsRef / updateSettings —— 全应用单例，保存即生效
 * （自测组卷的到期题、错题本掌握度展示都会随之变化）
 */
import { ref, watch } from 'vue'
import UiModal from '../ui/UiModal.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import UiInput from '../ui/UiInput.vue'
import UiNumber from '../ui/UiNumber.vue'
import UiButton from '../ui/UiButton.vue'
import { ElMessage } from '../ui/notify.js'
import { getSettings, updateSettings } from '../stores/bookStore'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const form = ref({})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    const s = getSettings()
    form.value = {
      srsEnabled: s.srsEnabled,
      srsMode: s.srsMode,
      srsFixedDays: s.srsFixedDays,
      srsIntervalsText: (s.srsIntervals || []).join(','),
    }
  }
)

function close(v) {
  emit('update:modelValue', v)
}

function save() {
  const intervals = form.value.srsIntervalsText
    .split(/[,，\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => n > 0)
  updateSettings({
    srsEnabled: form.value.srsEnabled,
    srsMode: form.value.srsMode,
    srsFixedDays: form.value.srsFixedDays,
    srsIntervals: intervals.length ? intervals : [1, 3, 7, 15, 30],
  })
  ElMessage.success('复习设置已保存')
  close(false)
}
</script>

<style scoped>
.rs-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.rs-tip {
  color: var(--zy-text-3, #6b7686);
  margin: 6px 0 8px;
}
</style>
