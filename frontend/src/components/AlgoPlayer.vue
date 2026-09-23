<template>
  <div class="algo-player">
    <div class="main-row">
      <!-- 代码面板 -->
      <div class="code-panel">
        <div class="panel-title">{{ algorithm.name }} · {{ langLabel }}</div>
        <div
          v-for="(line, i) in codeLines"
          :key="i"
          class="code-line"
          :class="{ active: isActive(i) }"
        >
          <span class="line-no">{{ i + 1 }}</span>
          <span class="line-text">{{ line }}</span>
        </div>
      </div>

      <!-- 动画画布 -->
      <div ref="canvasRef" class="canvas">
        <!-- 数组：条形图 -->
        <div v-if="renderer === 'array'" class="bars" :style="{ height: barAreaH + 'px' }">
          <div v-for="(v, i) in currentArray" :key="i" class="bar" :class="barClass(i)" :style="barStyle(v, i)">
            <span class="bar-val">{{ v }}</span>
          </div>
        </div>

        <!-- 树：SVG -->
        <svg v-else-if="renderer === 'tree'" viewBox="0 0 640 320" class="svg-canvas">
          <line v-for="(l, idx) in treeLines" :key="'tl' + idx" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" class="edge" />
          <g v-for="n in TREE.nodes" :key="n.id">
            <circle :cx="n.x" :cy="n.y" r="18" :class="treeNodeClass(n.id)" />
            <text :x="n.x" :y="n.y" class="node-val" dominant-baseline="central" text-anchor="middle">{{ n.value }}</text>
          </g>
        </svg>

        <!-- 图：SVG -->
        <svg v-else viewBox="0 0 640 300" class="svg-canvas">
          <g v-for="(e, idx) in GRAPH_DATA.edges" :key="'ge' + idx">
            <line :x1="pos(e.from).x" :y1="pos(e.from).y" :x2="pos(e.to).x" :y2="pos(e.to).y" class="edge" />
            <text :x="(pos(e.from).x + pos(e.to).x) / 2" :y="(pos(e.from).y + pos(e.to).y) / 2 - 4" class="edge-w" text-anchor="middle">{{ e.w }}</text>
          </g>
          <g v-for="n in GRAPH_DATA.nodes" :key="n.id">
            <circle :cx="n.x" :cy="n.y" r="22" :class="graphNodeClass(n.id)" />
            <text :x="n.x" :y="n.y" class="node-val" dominant-baseline="central" text-anchor="middle">{{ n.label }}</text>
            <text v-if="showDist" :x="n.x" :y="n.y + 38" class="dist-val" text-anchor="middle">{{ distText(n.id) }}</text>
          </g>
        </svg>

        <div class="desc">{{ currentStep.desc }}</div>

        <div class="legend">
          <template v-if="renderer === 'array'">
            <span class="lg"><i class="dot compare"></i>比较</span>
            <span class="lg"><i class="dot swap"></i>交换/移动</span>
            <span class="lg"><i class="dot sorted"></i>已就位</span>
            <span class="lg"><i class="dot pivot"></i>枢轴/当前</span>
          </template>
          <template v-else-if="renderer === 'tree'">
            <span class="lg"><i class="dot current"></i>当前访问</span>
            <span class="lg"><i class="dot visited"></i>已访问</span>
          </template>
          <template v-else>
            <span class="lg"><i class="dot current"></i>当前</span>
            <span class="lg"><i class="dot visited"></i>已访问</span>
            <span class="lg"><i class="dot queued"></i>队列中</span>
            <span class="lg" v-if="showDist"><i class="dot normal"></i>下方数字 = 最短距离</span>
          </template>
        </div>
      </div>
    </div>

    <!-- 控制栏 -->
    <div class="controls">
      <UiButton variant="ghost" size="sm" :disabled="currentIdx <= 0" @click="stepBack">◀ 上一步</UiButton>
      <UiButton variant="primary" size="sm" @click="togglePlay">{{ playing ? '⏸ 暂停' : '▶ 播放' }}</UiButton>
      <UiButton variant="ghost" size="sm" :disabled="currentIdx >= steps.length - 1" @click="stepForward">下一步 ▶</UiButton>
      <UiSegmented v-model="speed" :options="SPEEDS" aria-label="播放速度" />
      <UiButton variant="ghost" size="sm" @click="reset">⟳ 重置</UiButton>
      <span class="stats">比较 {{ compareCount }} · 交换 {{ swapCount }} · 步 {{ currentIdx + 1 }}/{{ steps.length }}</span>
    </div>

    <UiSlider v-model="currentIdx" :min="0" :max="steps.length - 1" @change="onSliderChange" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { TREE, GRAPH_DATA } from '../algorithms'
import { CODE_LANGS } from '../algoCodes'
import UiButton from '../ui/UiButton.vue'
import UiSegmented from '../ui/UiSegmented.vue'
import UiSlider from '../ui/UiSlider.vue'

const SPEEDS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
]

const props = defineProps({
  algorithm: { type: Object, required: true },
  data: { type: Array, required: true },
  target: { type: Number, default: null },
  lang: { type: String, default: 'c' },
})

const currentIdx = ref(0)
const playing = ref(false)
const speed = ref(1)
let timer = null
const barAreaH = 240

const renderer = computed(() => props.algorithm.renderer || 'array')
const langLabel = computed(() => (CODE_LANGS.find((l) => l.key === props.lang) || {}).label || props.lang)
const codeLines = computed(() => props.algorithm.codes?.[props.lang] || [])
/** 当前步 codeLine 映射到当前语言的真实行号（可能单行或多行） */
const activeLines = computed(() => {
  const v = props.algorithm.lineMap?.[props.lang]?.[currentStep.value.codeLine]
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
})
function isActive(i) {
  return activeLines.value.includes(i + 1)
}

const steps = computed(() => {
  const alg = props.algorithm
  const arr = [...props.data]
  return alg.needsTarget ? alg.generate(arr, props.target) : alg.generate(arr)
})

const currentStep = computed(() => steps.value[Math.min(currentIdx.value, steps.value.length - 1)] || steps.value[0])
const currentArray = computed(() => currentStep.value.array || [])
const maxVal = computed(() => Math.max(...currentArray.value, 1))

// ---- 数组条形图（宽度响应式） ----
const canvasRef = ref(null)
const canvasW = ref(560)
function updateCanvasW() {
  if (canvasRef.value) canvasW.value = canvasRef.value.clientWidth || 560
}
const barW = computed(() => {
  const n = currentArray.value.length
  return Math.max(12, Math.min(42, (canvasW.value - (n + 1) * 6) / n))
})
function barStyle(v, i) {
  const n = currentArray.value.length
  const gap = 6
  const left = i * (barW.value + gap) + gap
  const h = Math.max(14, (v / maxVal.value) * (barAreaH - 46) + 16)
  return { left: left + 'px', width: barW.value + 'px', height: h + 'px' }
}
function barClass(i) {
  const s = currentStep.value
  if (s.sorted && s.sorted.includes(i)) return 'sorted'
  if (s.swap && s.swap.includes(i)) return 'swap'
  if (s.pivot === i) return 'pivot'
  if (s.compare && s.compare.includes(i)) return 'compare'
  return ''
}

// ---- 树 ----
const treeLines = computed(() => {
  const nodeOf = {}
  TREE.nodes.forEach((n) => { nodeOf[n.id] = n })
  const lines = []
  for (const n of TREE.nodes) {
    if (n.left != null) lines.push({ x1: n.x, y1: n.y, x2: nodeOf[n.left].x, y2: nodeOf[n.left].y })
    if (n.right != null) lines.push({ x1: n.x, y1: n.y, x2: nodeOf[n.right].x, y2: nodeOf[n.right].y })
  }
  return lines
})
function treeNodeClass(id) {
  const s = currentStep.value
  if (s.highlight === id) return 'current'
  if (s.visited && s.visited.includes(id)) return 'visited'
  return 'normal'
}

// ---- 图 ----
function pos(id) {
  const n = GRAPH_DATA.nodes.find((x) => x.id === id)
  return n || { x: 0, y: 0 }
}
function graphNodeClass(id) {
  const s = currentStep.value
  if (s.current === id) return 'current'
  if (s.done && s.done.includes(id)) return 'visited'
  if (s.visited && s.visited.includes(id)) return 'visited'
  if (s.queue && s.queue.includes(id)) return 'queued'
  return 'normal'
}
const showDist = computed(() => currentStep.value.dist != null)
function distText(id) {
  const d = currentStep.value.dist ? currentStep.value.dist[id] : Infinity
  return d === Infinity ? '∞' : String(d)
}

// ---- 统计 ----
const compareCount = computed(() => {
  let c = 0
  for (let i = 0; i <= currentIdx.value; i++) if (steps.value[i].compare) c++
  return c
})
const swapCount = computed(() => {
  let c = 0
  for (let i = 0; i <= currentIdx.value; i++) if (steps.value[i].swap) c++
  return c
})

// ---- 播放控制 ----
function clearTimer() {
  if (timer) { clearTimeout(timer); timer = null }
}
function schedule() {
  clearTimer()
  timer = setTimeout(() => {
    if (currentIdx.value >= steps.value.length - 1) {
      playing.value = false
      return
    }
    currentIdx.value++
    if (playing.value) schedule()
  }, 500 / speed.value)
}
function togglePlay() {
  if (playing.value) {
    playing.value = false
    clearTimer()
  } else {
    if (currentIdx.value >= steps.value.length - 1) currentIdx.value = 0
    playing.value = true
    schedule()
  }
}
function stepForward() {
  if (currentIdx.value < steps.value.length - 1) currentIdx.value++
}
function stepBack() {
  if (currentIdx.value > 0) currentIdx.value--
}
function reset() {
  playing.value = false
  clearTimer()
  currentIdx.value = 0
}
function onSliderChange() {
  playing.value = false
  clearTimer()
}

watch(() => [props.data, props.algorithm, props.target], () => {
  reset()
}, { deep: true })

onMounted(() => {
  updateCanvasW()
  window.addEventListener('resize', updateCanvasW)
})
onBeforeUnmount(() => {
  clearTimer()
  window.removeEventListener('resize', updateCanvasW)
})
</script>

<style scoped>
.algo-player {
  border: 1px solid #e5e8ee;
  border-radius: 10px;
  padding: 16px;
  background: #fdfdfe;
}
.main-row { display: flex; gap: 16px; }
.code-panel {
  width: 260px;
  flex-shrink: 0;
  background: #f7f8fa;
  border: 1px solid #e5e8ee;
  border-radius: 8px;
  padding: 10px 12px;
  font-family: "SF Mono", Consolas, Menlo, "Courier New", monospace;
  font-size: 12px;
  overflow-x: auto;
}
.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #1f2733;
  margin-bottom: 8px;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}
.code-line { display: flex; gap: 8px; padding: 2px 6px; border-radius: 4px; line-height: 1.6; }
.code-line.active { background: #faeeda; color: #633806; font-weight: 600; }
.line-no { color: #b4b2a9; width: 16px; text-align: right; flex-shrink: 0; user-select: none; }
.line-text { white-space: pre; }
.canvas { flex: 1; min-width: 0; }
.bars { position: relative; border-bottom: 1px solid #e5e8ee; }
.bar {
  position: absolute; bottom: 0; border-radius: 4px 4px 0 0;
  background: #b5d4f4; border: 1px solid #85b7eb;
  transition: left 0.35s ease, background-color 0.2s, border-color 0.2s, height 0.35s ease;
  display: flex; align-items: flex-start; justify-content: center;
}
.bar-val { font-size: 11px; color: #1f2733; padding-top: 4px; user-select: none; }
.bar.compare { background: #f7c1c1; border-color: #e24b4a; }
.bar.swap { background: #f09595; border-color: #a32d2d; }
.bar.sorted { background: #c0dd97; border-color: #3b6d11; }
.bar.pivot { background: #d3c6f0; border-color: #7f77dd; }

.svg-canvas { width: 100%; height: 300px; }
.edge { stroke: #b4b2a9; stroke-width: 1.5; }
.edge-w { font-size: 11px; fill: #5f5e5a; }
circle.normal { fill: #e6f1fb; stroke: #185fa5; stroke-width: 1.5; }
circle.current { fill: #faeeda; stroke: #ba7517; stroke-width: 2; }
circle.visited { fill: #c0dd97; stroke: #3b6d11; stroke-width: 1.5; }
circle.queued { fill: #f0997b; stroke: #993c1d; stroke-width: 1.5; }
.node-val { font-size: 14px; fill: #1f2733; font-weight: 600; }
.dist-val { font-size: 11px; fill: #185fa5; }

.desc { margin-top: 10px; font-size: 13px; color: #1f2733; min-height: 20px; }
.legend { margin-top: 6px; display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: #6b7686; }
.lg { display: inline-flex; align-items: center; gap: 4px; }
.dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.dot.compare { background: #f7c1c1; }
.dot.swap { background: #f09595; }
.dot.sorted { background: #c0dd97; }
.dot.pivot { background: #d3c6f0; }
.dot.current { background: #faeeda; }
.dot.visited { background: #c0dd97; }
.dot.queued { background: #f0997b; }
.dot.normal { background: #e6f1fb; }

.controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.stats { margin-left: auto; font-size: 12px; color: #6b7686; }

/* 移动端：代码面板与画布改上下布局 */
@media (max-width: 768px) {
  .main-row { flex-direction: column; }
  .code-panel { width: 100%; padding: 8px 10px; font-size: 11px; }
  .code-line { gap: 6px; padding: 2px 4px; }
  .line-no { width: 14px; }
  .svg-canvas { height: 260px; }
  .stats { margin-left: 0; width: 100%; }
}
</style>
