<template>
  <div class="zr-root surface-standard">
    <div class="zr-head">
      <h3 class="section-title" style="margin: 0">考前速查（公式大全 + 算法模板）</h3>
      <div class="zr-tools">
        <div class="zr-search">
          <UiInput v-model="keyword" placeholder="搜关键词：泰勒、换元、二分、背包…" />
        </div>
        <UiButton variant="ghost" size="sm" @click="openPrint('current')">打印本类</UiButton>
        <UiButton variant="primary" size="sm" @click="openPrint('all')">打印全部</UiButton>
      </div>
    </div>

    <div class="zr-chips">
      <button
        v-for="s in SECTIONS"
        :key="s.key"
        class="zr-chip"
        :class="{ active: !keyword.trim() && activeKey === s.key }"
        @click="selectSection(s.key)"
      >
        {{ s.name }}<span class="zr-chip-n">{{ countOf(s) }}</span>
      </button>
    </div>

    <!-- 搜索结果（跨分类） -->
    <template v-if="keyword.trim()">
      <div class="muted" style="margin: 12px 0 4px">
        {{ hits.length ? `找到 ${hits.length} 条与「${keyword.trim()}」相关的内容` : '没有匹配的内容，换个关键词试试' }}
      </div>
      <div v-for="(h, i) in hits" :key="h.section.key + '-' + i" class="zr-group">
        <div class="zr-group-t">{{ h.section.name }} · {{ h.sub }}</div>
        <FxItem v-if="h.kind === 'fx'" :item="h.item" />
        <CodeItem
          v-else-if="h.kind === 'code'"
          :item="h.item"
          :running="!!running[h.item.key]"
          @toggle="toggleRun(h.item.key)"
          @copy="copyCode(h.item.code)"
        />
        <TableItem v-else :table="h.table" />
      </div>
    </template>

    <!-- 当前分类 -->
    <template v-else>
      <template v-if="current.type === 'formula'">
        <div v-for="g in current.groups" :key="g.title" class="zr-group">
          <div class="zr-group-t">{{ g.title }}</div>
          <FxItem v-for="it in g.items" :key="it.name" :item="it" />
        </div>
      </template>

      <template v-else-if="current.type === 'code'">
        <div class="muted" style="margin: 12px 0 0">
          模板均为完整可编译程序（C99），点「在编辑器里试跑」可直接改参数运行；复杂度与易错点按考点整理。
        </div>
        <CodeItem
          v-for="it in current.items"
          :key="it.key"
          :item="it"
          :running="!!running[it.key]"
          @toggle="toggleRun(it.key)"
          @copy="copyCode(it.code)"
        />
      </template>

      <template v-else>
        <TableItem v-for="t in current.tables" :key="t.key" :table="t" />
      </template>
    </template>

    <!-- 打印预览：复用错题本导出那套打印样式（body.zy-printing + .pe-overlay） -->
    <Teleport to="body">
      <div v-if="printOpen" class="pe-overlay">
        <div class="pe-toolbar">
          <div class="pe-tip">
            {{ printScope === 'all' ? '全部速查内容' : current.name }} · 点「打印」后在对话框中选择「另存为 PDF」即可
          </div>
          <div class="pe-actions">
            <button class="pe-btn pe-btn-primary" @click="doPrint">打印 / 保存 PDF</button>
            <button class="pe-btn" @click="printOpen = false">关闭</button>
          </div>
        </div>

        <div class="pe-paper">
          <div class="pe-head">
            <div class="pe-title">知一 · 考前速查</div>
            <div class="pe-sub">{{ printMeta }}</div>
          </div>

          <template v-for="s in printSections" :key="s.key">
            <div class="pe-subject">{{ s.name }}</div>

            <template v-if="s.type === 'formula'">
              <template v-for="g in s.groups" :key="g.title">
                <div class="zpr-gt">{{ g.title }}</div>
                <div v-for="it in g.items" :key="it.name" class="zpr-fx">
                  <FxItem :item="it" />
                </div>
              </template>
            </template>

            <template v-else-if="s.type === 'code'">
              <div v-for="it in s.items" :key="it.key" class="zpr-code">
                <div class="zpr-code-name">{{ it.name }}</div>
                <div class="zpr-meta">复杂度：{{ it.complexity }}</div>
                <div class="zpr-meta">易错：{{ it.pitfalls }}</div>
                <div class="zr-code"><MathText :content="fence(it)" /></div>
              </div>
            </template>

            <template v-else>
              <TableItem v-for="t in s.tables" :key="t.key" :table="t" />
            </template>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, h, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from '../ui/notify.js'
import UiButton from '../ui/UiButton.vue'
import UiInput from '../ui/UiInput.vue'
import MathText from './MathText.vue'
import CodeEditor from './CodeEditor.vue'
import { SECTIONS, countOf, fence } from '../ref'
import { recordAction } from '../statsStore'

/* ---- 三个内部小渲染组件（同类内容在三处复用：分类视图 / 搜索结果 / 打印预览） ---- */

const FxItem = {
  props: { item: { type: Object, required: true } },
  setup(props) {
    return () =>
      h('div', { class: 'zr-fx' }, [
        h('div', { class: 'zr-name' }, props.item.name),
        h('div', { class: 'zr-formula' }, [h(MathText, { content: '$$' + props.item.tex + '$$' })]),
        props.item.note ? h('div', { class: 'zr-note' }, [h(MathText, { content: props.item.note })]) : null,
      ])
  },
}

const CodeItem = {
  props: { item: { type: Object, required: true }, running: Boolean },
  emits: ['toggle', 'copy'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'zr-code-card' }, [
        h('div', { class: 'zr-code-head' }, [
          h('div', { class: 'zr-name' }, props.item.name),
          h(
            'div',
            { class: 'zr-tags' },
            props.item.tags.map((t) => h('span', { class: 'zr-tag' }, t)),
          ),
        ]),
        h('div', { class: 'zr-meta' }, [h('span', { class: 'zr-k' }, '复杂度'), props.item.complexity]),
        h('div', { class: 'zr-meta' }, [h('span', { class: 'zr-k' }, '易错'), props.item.pitfalls]),
        h('div', { class: 'zr-meta' }, [h('span', { class: 'zr-k' }, '适用'), props.item.usage]),
        h('div', { class: 'zr-code' }, [h(MathText, { content: fence(props.item) })]),
        h('div', { class: 'zr-code-ops' }, [
          h('button', { class: 'zr-btn', onClick: () => emit('copy') }, '复制代码'),
          h('button', { class: 'zr-btn', onClick: () => emit('toggle') }, props.running ? '收起编辑器' : '在编辑器里试跑'),
        ]),
        props.running ? h(CodeEditor, { code: props.item.code, language: props.item.lang }) : null,
      ])
  },
}

const TableItem = {
  props: { table: { type: Object, required: true } },
  setup(props) {
    return () =>
      h('div', { class: 'zr-group' }, [
        h('div', { class: 'zr-group-t' }, props.table.name),
        h('table', { class: 'zr-table' }, [
          h('thead', [h('tr', props.table.columns.map((c) => h('th', c)))]),
          h(
            'tbody',
            props.table.rows.map((row) => h('tr', row.map((cell) => h('td', cell)))),
          ),
        ]),
        props.table.note ? h('div', { class: 'zr-note' }, props.table.note) : null,
      ])
  },
}

/* ---- 状态 ---- */
const activeKey = ref('calc')
const keyword = ref('')
const running = ref({})          // { [templateKey]: true } 展开内联编辑器
const printOpen = ref(false)
const printScope = ref('current') // current | all

const current = computed(() => SECTIONS.find((s) => s.key === activeKey.value) || SECTIONS[0])
const printSections = computed(() => (printScope.value === 'all' ? SECTIONS : [current.value]))

/** 关键词搜索：跨分类匹配名称/标签/提示/代码/表格内容 */
const hits = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return []
  const out = []
  for (const s of SECTIONS) {
    if (s.type === 'formula') {
      for (const g of s.groups) {
        for (const it of g.items) {
          const hay = (it.name + ' ' + g.title + ' ' + (it.note || '') + ' ' + it.tex).toLowerCase()
          if (hay.includes(kw)) out.push({ section: s, sub: g.title, kind: 'fx', item: it })
        }
      }
    } else if (s.type === 'code') {
      for (const it of s.items) {
        const hay = (it.name + ' ' + it.tags.join(' ') + ' ' + it.complexity + ' ' + it.pitfalls + ' ' + it.usage + ' ' + it.code).toLowerCase()
        if (hay.includes(kw)) out.push({ section: s, sub: '代码模板', kind: 'code', item: it })
      }
    } else {
      for (const t of s.tables) {
        const hay = (t.name + ' ' + t.note + ' ' + t.rows.flat().join(' ')).toLowerCase()
        if (hay.includes(kw)) out.push({ section: s, sub: '速查表', kind: 'table', table: t })
      }
    }
  }
  return out
})

const printMeta = computed(() => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const t = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  return `${t} 导出 · ${printScope.value === 'all' ? '全部分类' : current.value.name}`
})

function selectSection(key) {
  activeKey.value = key
  keyword.value = ''
  recordAction('ref', { category: key })   // 打卡埋点：浏览速查分类（同分类不重复计数）
}

function toggleRun(key) {
  running.value = { ...running.value, [key]: !running.value[key] }
}

/** 复制文本：优先 clipboard API，http 非安全上下文回落 execCommand（与部署环境一致） */
async function copyCode(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      ElMessage.success('代码已复制')
      return
    }
  } catch {
    /* 回落到 execCommand */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage[ok ? 'success' : 'warning'](ok ? '代码已复制' : '复制失败，请手动选择复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}

function openPrint(scope) {
  printScope.value = scope
  printOpen.value = true
}

function doPrint() {
  document.body.classList.add('zy-printing')
  const cleanup = () => document.body.classList.remove('zy-printing')
  window.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(cleanup, 60000) // 兜底：个别浏览器不触发 afterprint
  window.print()
}

onMounted(() => {
  // 进入速查页即视为浏览了默认分类
  recordAction('ref', { category: activeKey.value })
})

onBeforeUnmount(() => document.body.classList.remove('zy-printing'))
</script>

<style scoped>
/* v1 样式：只覆盖屏幕显示用的类；.zpr-* / .pe-* 属打印预览（白纸），保持全局浅色不变 */
.zr-root { padding: var(--sp-6); }
.zr-head { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
.zr-tools { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.zr-search { width: 230px; }
.zr-chips { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin: var(--sp-4) 0 var(--sp-1); }
.zr-chip {
  border: var(--border-subtle);
  background: var(--surface-unit);
  color: var(--primary-text);
  border-radius: var(--radius-pill);
  padding: 5px 14px;
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.zr-chip.active { border-color: var(--primary-line); background: var(--primary-soft-2); color: var(--primary-text-strong); }
.zr-chip-n { margin-left: 6px; font-size: var(--fs-label); opacity: 0.75; }
.zr-group { margin-top: var(--sp-4); }
.zr-group-t {
  font-size: var(--fs-h3);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
  padding-left: 9px;
  border-left: 3px solid var(--primary);
  margin-bottom: var(--sp-2);
}
.zr-fx {
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-2);
  background: var(--surface-1);
}
.zr-name { font-size: var(--fs-body); font-weight: var(--fw-medium); color: var(--text-primary); }
.zr-formula { margin: 6px 0 2px; overflow-x: auto; }
.zr-note { font-size: var(--fs-body-2); line-height: var(--lh-body); color: var(--text-tertiary); margin-top: 4px; }
.zr-code-card {
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--sp-3) var(--sp-4);
  margin-top: var(--sp-3);
  background: var(--surface-1);
}
.zr-code { margin-top: var(--sp-2); }
.muted { color: var(--text-muted); font-size: var(--fs-body-2); }
.section-title { font-size: var(--fs-h2); font-weight: var(--fw-medium); margin: 0 0 var(--sp-3); color: var(--text-primary); }
</style>
