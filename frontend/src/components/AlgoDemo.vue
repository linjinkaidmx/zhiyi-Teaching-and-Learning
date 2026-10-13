<template>
  <div class="algo">
    <div class="algo__toolbar">
      <div class="algo__select">
        <UiSelect v-model="algoId" :options="algoOptions" />
      </div>
      <div class="algo__lang">
        <UiSelect v-model="lang" :options="langOptions" aria-label="代码语言" />
      </div>

      <template v-if="!isFixed">
        <UiButton variant="ghost" size="sm" @click="randomData">⟳ 随机数据</UiButton>
        <div class="algo__size">
          <UiSelect v-model.number="dataSize" size="sm" :options="sizeOptions" @change="randomData" />
        </div>
      </template>

      <template v-if="algorithm.needsTarget">
        <span class="t-label">{{ isFixed ? '目标值' : '查找目标' }}</span>
        <div class="algo__target">
          <UiNumber v-model="target" :min="0" :max="99" size="sm" />
        </div>
      </template>
    </div>

    <p v-if="!isFixed" class="t-label algo__data">
      当前数据：[{{ data.join(', ') }}]（{{ data.length }} 个）
    </p>
    <p v-else class="t-label algo__data">
      {{ algorithm.name }}使用预定义结构，播放下方动画即可。
    </p>

    <AlgoPlayer :key="algoId + ':' + (isFixed ? 'fixed' : data.join('-'))" :algorithm="algorithm" :data="data" :target="target" :lang="lang" />
  </div>
</template>

<script setup>
/**
 * 算法演示（v1）：从 EP 版迁移，逻辑逐字保留，仅换 UI 组件
 * el-select + el-option-group → UiSelect 分组选项；el-input-number → UiNumber
 */
import { ref, computed, watch, onMounted } from 'vue'
import { recordAction } from '../statsStore'
import { ALGORITHMS } from '../algorithms'
import { CODE_LANGS } from '../algoCodes'
import AlgoPlayer from './AlgoPlayer.vue'
import UiButton from '../ui/UiButton.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiNumber from '../ui/UiNumber.vue'

const props = defineProps({
  initialAlgo: { type: String, default: null },
})

const algoId = ref('bubble')
const lang = ref('c') // 默认 C 语言
const dataSize = ref(10)
const data = ref([])
const target = ref(6)

const algorithm = computed(() => ALGORITHMS[algoId.value])
const isFixed = computed(() => !!algorithm.value.fixed)

const byCategory = (cat) =>
  Object.entries(ALGORITHMS)
    .filter(([, a]) => a.category === cat)
    .map(([id, a]) => ({ label: a.name, value: id }))

/** 按分类分组的下拉选项（等价于原来的 4 个 el-option-group） */
const algoOptions = computed(() => [
  { label: '排序', options: byCategory('排序') },
  { label: '查找', options: byCategory('查找') },
  { label: '树', options: byCategory('树') },
  { label: '图', options: byCategory('图') },
].filter((g) => g.options.length))

const sizeOptions = [
  { label: '6 个', value: 6 },
  { label: '10 个', value: 10 },
  { label: '15 个', value: 15 },
  { label: '20 个', value: 20 },
]

const langOptions = CODE_LANGS.map((l) => ({ label: l.label, value: l.key }))

function randomData() {
  const arr = []
  for (let i = 0; i < Number(dataSize.value); i++) {
    arr.push(Math.floor(Math.random() * 90) + 10)
  }
  if (algorithm.value.needsTarget && !algorithm.value.fixed) {
    arr.sort((a, b) => a - b)
    target.value = arr[Math.floor(arr.length / 2)]
  }
  data.value = arr
}

function refreshForAlgorithm() {
  if (algorithm.value.fixed) {
    if (algorithm.value.needsTarget) target.value = 6
    data.value = []
  } else {
    randomData()
  }
}

watch(algoId, (v) => { refreshForAlgorithm(v); trackAlgo(v) })
onMounted(() => { refreshForAlgorithm(); trackAlgo(algoId.value) })

/** 打卡/成就埋点：看过某个算法演示（按算法 id 去重，成就「算法漫游」看的是不同算法数） */
function trackAlgo(id) {
  try {
    const key = String(id || algoId.value || '')
    if (!key) return
    const meta = (typeof ALGORITHMS !== 'undefined' && ALGORITHMS && ALGORITHMS[key]) || null
    recordAction('algo', { title: String((meta && (meta.name || meta.title)) || key).slice(0, 40), brief: '算法演示', algoId: key })
  } catch {
    /* 埋点失败不影响演示 */
  }
}

// 从讲解页跳转过来时，预选目标算法
watch(() => props.initialAlgo, (a) => {
  if (a && ALGORITHMS[a]) algoId.value = a
}, { immediate: true })
</script>

<style scoped>
.algo {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.algo__toolbar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.algo__select {
  width: 200px;
}
.algo__lang {
  width: 96px;
}
.algo__size {
  width: 96px;
}
.algo__target {
  width: 110px;
}
.algo__data {
  margin: 0;
}
</style>
