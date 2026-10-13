<template>
  <UiModal
    :model-value="open"
    :title="tour.title"
    size="lg"
    panel-class="ui-tour"
    :close-on-mask="false"
    @update:model-value="onVisible"
  >
    <div class="tour">
      <div class="tour__media">
        <img v-if="card.img" :src="card.img" class="tour__img" :alt="card.title || '教程配图'" />
        <div v-else class="tour__ph">
          <UiIcon name="image" :size="22" />
          <span class="t-label">配图生成中</span>
        </div>
      </div>
      <div class="tour__text">
        <h3 class="tour__title">{{ card.title }}</h3>
        <p class="tour__desc">{{ card.desc }}</p>
      </div>
      <div class="tour__dots">
        <button
          v-for="(c, i) in cards"
          :key="i"
          type="button"
          class="tour__dot"
          :class="{ 'is-on': i === idx }"
          :aria-label="`第 ${i + 1} 步`"
          @click="idx = i"
        />
      </div>
    </div>

    <template #footer>
      <span class="tour__progress t-label">{{ idx + 1 }} / {{ cards.length }}</span>
      <span class="tour__spacer" />
      <UiButton v-if="!isLast" variant="text" @click="done">跳过</UiButton>
      <UiButton v-if="idx > 0" variant="ghost" @click="idx--">上一步</UiButton>
      <UiButton variant="primary" @click="next">{{ isLast ? '开始使用' : '下一步' }}</UiButton>
    </template>
  </UiModal>
</template>

<script setup>
/**
 * 新手教程弹层（图片为主 + 一句标题 + 一句说明）。
 * ---------------------------------------------------------------------------
 * · 用法：<UiTour v-model="tourOpen" tour-key="teacher" />
 * · 教程内容见 lib/tours.js；「看过」标记见 lib/tourState.js
 * · 关闭（含点遮罩/跳过/看完最后一步）都会写标记，之后不再自动弹
 */
import { computed, ref, watch } from 'vue'
import UiModal from './UiModal.vue'
import UiButton from './UiButton.vue'
import UiIcon from './UiIcon.vue'
import { TOURS } from '../lib/tours.js'
import { markTourSeen } from '../lib/tourState.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  tourKey: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue', 'done'])

const idx = ref(0)
const tour = computed(() => TOURS[props.tourKey] || { title: '使用教程', cards: [] })
const cards = computed(() => tour.value.cards || [])
const card = computed(() => cards.value[idx.value] || {})
const isLast = computed(() => cards.value.length === 0 || idx.value >= cards.value.length - 1)

const open = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })

/* 每次重新打开都从第一张开始 */
watch(
  () => props.modelValue,
  (v) => {
    if (v) idx.value = 0
  },
)

function next() {
  if (isLast.value) return done()
  idx.value += 1
}
function done() {
  if (props.tourKey) markTourSeen(props.tourKey)
  emit('done')
  emit('update:modelValue', false)
}
/** 点遮罩关闭也记为「看过了」，避免反复弹 */
function onVisible(v) {
  if (!v) done()
}
</script>

<style scoped>
.tour {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
/* 配图区：固定比例，浅底衬白截图 */
.tour__media {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface-recess);
  border: var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tour__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}
.tour__ph {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
}
.tour__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tour__title {
  margin: 0;
  font-size: var(--fs-h3);
  color: var(--text-primary);
}
.tour__desc {
  margin: 0;
  font-size: var(--fs-body-2);
  line-height: var(--lh-relaxed);
  color: var(--text-secondary);
}
/* 进度点 */
.tour__dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: var(--sp-1);
}
.tour__dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--border-strong, #c9cfdb);
  cursor: pointer;
  transition: width var(--dur) var(--ease), background var(--dur) var(--ease);
}
.tour__dot.is-on {
  width: 18px;
  border-radius: 4px;
  background: var(--primary);
}
/* 底部 */
.tour__progress {
  color: var(--text-muted);
}
.tour__spacer {
  flex: 1;
}
</style>
