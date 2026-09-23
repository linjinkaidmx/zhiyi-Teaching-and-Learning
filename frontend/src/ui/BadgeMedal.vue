<template>
  <svg
    class="bm"
    :class="[`bm--${size}`, { 'is-locked': locked, 'is-legend': rarity === 'legend' }]"
    viewBox="0 0 96 96"
    role="img"
    :aria-label="ariaLabel"
  >
    <g filter="url(#bm-soft)">
      <g v-html="baseSvg" />
      <g v-if="rarity === 'legend'" class="bm__halo" v-html="haloSvg" />
      <g v-html="ringSvg" />
    </g>
    <g
      class="bm__totem"
      transform="translate(48 48) scale(2.08) translate(-12 -12)"
      fill="none"
      stroke="#fff"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      v-html="totemSvg"
    />
  </svg>
</template>

<script setup>
/**
 * 成就奖章（BadgeMedal）
 * ---------------------------------------------------------------------------
 * rarity：common | rare | epic | legend  → 决定底座（铜六边 / 银盾 / 金齿边 / 紫光环）
 * totem：功能图腾名（见 ui/badgeArt.js）
 * size ：xl(96) | lg(64) | md(44) | sm(28)
 * locked：未解锁 → 灰度 + 降透明
 * 渐变定义在 ui/BadgeDefs.vue（全局一次）。
 */
import { computed } from 'vue'
import { baseOf, ringOf, legendHalo, totemOf, RARITY_NAME } from './badgeArt.js'

const props = defineProps({
  rarity: { type: String, default: 'common' },
  totem: { type: String, default: 'spark' },
  size: { type: String, default: 'md' },
  locked: { type: Boolean, default: false },
  name: { type: String, default: '' },
})

const baseSvg = computed(() => baseOf(props.rarity))
const ringSvg = computed(() => ringOf(props.rarity))
const haloSvg = computed(() => legendHalo())
const totemSvg = computed(() => totemOf(props.totem))
const ariaLabel = computed(() => {
  const parts = [props.name || '成就奖章', RARITY_NAME[props.rarity] || '']
  if (props.locked) parts.push('未解锁')
  return parts.filter(Boolean).join(' · ')
})
</script>

<style scoped>
.bm {
  display: block;
  flex: none;
}
.bm--xl { width: 96px; height: 96px; }
.bm--lg { width: 64px; height: 64px; }
.bm--md { width: 44px; height: 44px; }
.bm--sm { width: 28px; height: 28px; }

/* 未解锁：灰度 + 降透明（仍能看清轮廓与稀有度，形成"想拿到"的钩子） */
.bm.is-locked {
  filter: grayscale(1);
  opacity: 0.58;
}

/* 传说级光环缓慢旋转（尊重"减少动效"偏好，移动端自动静止） */
.bm__halo {
  transform-origin: 48px 48px;
  animation: bm-spin 26s linear infinite;
}
@keyframes bm-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .bm__halo { animation: none; }
}
@media (max-width: 767px) {
  .bm__halo { animation: none; }
}
.bm__totem {
  transition: transform var(--dur) var(--ease-out);
}
</style>
