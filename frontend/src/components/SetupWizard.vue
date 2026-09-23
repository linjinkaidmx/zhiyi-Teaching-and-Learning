<template>
  <UiModal v-model="visible" title="填一下专业与年级" size="sm" :close-on-mask="false" @close="onClose">
    <p class="t-body-2 sw__tip">告诉我你的专业与年级，学习记录和学情统计会更准。</p>
    <div class="sw__grid">
      <UiInput v-model="form.major" label="专业" :maxlength="30" placeholder="如：计算机科学与技术" />
      <label class="sw__field">
        <span class="t-label">年级</span>
        <UiSelect v-model="form.grade" :options="gradeOptions" placeholder="选择年级" />
      </label>
    </div>
    <div class="sw__ops">
      <UiButton variant="ghost" @click="skip">以后再说</UiButton>
      <UiButton variant="primary" @click="finish">完成</UiButton>
    </div>
  </UiModal>
</template>

<script setup>
/**
 * 新用户初始化向导：专业/年级（课程已改为用户手动添加，不再推荐）
 */
import { computed, reactive, watch } from 'vue'
import UiModal from '../ui/UiModal.vue'
import UiInput from '../ui/UiInput.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiButton from '../ui/UiButton.vue'
import { updateProfile, profileRef } from '../profileStore'
import { GRADES } from '../profile.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'done'])

const gradeOptions = GRADES.map((g) => ({ label: g, value: g }))
const form = reactive({ major: '', grade: '' })

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

watch(() => props.modelValue, (v) => {
  if (v) {
    const p = profileRef().value
    form.major = p.major || ''
    form.grade = p.grade || ''
  }
})

function finish() {
  updateProfile({ major: form.major.trim(), grade: form.grade })
  visible.value = false
  emit('done')
}

function skip() {
  updateProfile({ major: form.major.trim(), grade: form.grade })
  visible.value = false
  emit('done')
}

function onClose() {
  /* 关闭即视为跳过 */
}
</script>

<style scoped>
.sw__tip {
  margin-bottom: var(--sp-4);
  line-height: var(--lh-body);
}
.sw__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-4);
}
.sw__field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.sw__ops {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-top: var(--sp-5);
}
@media (max-width: 767px) {
  .sw__grid {
    grid-template-columns: 1fr;
  }
}
</style>
