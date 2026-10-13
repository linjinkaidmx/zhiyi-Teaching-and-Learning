<template>
  <div class="radar">
    <svg v-if="points.length >= 3" :viewBox="`0 0 ${size} ${size}`" width="100%">
      <!-- 网格 -->
      <polygon
        v-for="ring in rings"
        :key="ring"
        :points="ringPoints(ring)"
        fill="none"
        stroke="var(--border-strong)"
        stroke-width="0.6"
      />
      <!-- 轴线 -->
      <line
        v-for="(p, i) in points"
        :key="`axis-${i}`"
        :x1="cx"
        :y1="cy"
        :x2="p.x2"
        :y2="p.y2"
        stroke="var(--border-strong)"
        stroke-width="0.6"
      />
      <!-- 数据区域 -->
      <polygon :points="dataPoints" fill=var(--brand) fill-opacity="0.25" stroke=var(--brand) stroke-width="1.6" />
      <!-- 顶点 -->
      <circle
        v-for="(p, i) in points"
        :key="`dot-${i}`"
        :cx="p.x"
        :cy="p.y"
        r="3"
        fill=var(--brand)
      />
      <!-- 标签 -->
      <text
        v-for="(p, i) in points"
        :key="`lb-${i}`"
        :x="p.lx"
        :y="p.ly"
        :text-anchor="p.anchor"
        font-size="11"
        fill="var(--text-sub)"
      >
        {{ shorten(p.name) }}
      </text>
    </svg>
    <div v-else class="empty">暂无足够数据，诊断几道题后这里会显示掌握度</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  dimensions: { type: Array, default: () => [] }, // [{ name, rate }]
  size: { type: Number, default: 300 },
})

const rings = [0.25, 0.5, 0.75, 1]

const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
const radius = computed(() => props.size / 2 - 46)

const minimalRate = (r) => Math.max(r, 6) // 避免全 0 时图形塌缩成点

const points = computed(() => {
  const n = props.dimensions.length
  if (n < 3) return []
  return props.dimensions.map((d, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const ratio = minimalRate(d.rate) / 100
    const x = cx.value + radius.value * ratio * Math.cos(angle)
    const y = cy.value + radius.value * ratio * Math.sin(angle)
    const ox = cx.value + radius.value * Math.cos(angle)
    const oy = cy.value + radius.value * Math.sin(angle)
    // 标签外扩一点
    const lx = cx.value + (radius.value + 20) * Math.cos(angle)
    const ly = cy.value + (radius.value + 20) * Math.sin(angle)
    const anchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
    return { x, y, x2: ox, y2: oy, lx, ly: ly + 4, anchor, name: d.name }
  })
})

const dataPoints = computed(() => points.value.map((p) => `${p.x},${p.y}`).join(' '))

function ringPoints(ratio) {
  const n = props.dimensions.length
  if (n < 3) return ''
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return `${cx.value + radius.value * ratio * Math.cos(angle)},${
      cy.value + radius.value * ratio * Math.sin(angle)
    }`
  }).join(' ')
}

function shorten(name) {
  return name && name.length > 8 ? `${name.slice(0, 8)}…` : name
}
</script>

<style scoped>
.radar {
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
}
.empty {
  text-align: center;
  color: var(--text-sub);
  font-size: 13px;
  padding: 40px 0;
}
</style>
