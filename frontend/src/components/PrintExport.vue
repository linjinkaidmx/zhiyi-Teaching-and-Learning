<template>
  <Teleport to="body">
    <div v-if="visible" class="pe-overlay">
      <!-- 顶部工具条（打印时隐藏） -->
      <div class="pe-toolbar">
        <div class="pe-tip">
          共 {{ items.length }} 题 · {{ modeLabel }} · 点「打印」后在对话框中选「另存为 PDF」即可导出
        </div>
        <div class="pe-actions">
          <button class="pe-btn pe-btn-primary" @click="doPrint">打印 / 保存 PDF</button>
          <button class="pe-btn" @click="close">关闭</button>
        </div>
      </div>

      <!-- 打印纸张 -->
      <div class="pe-paper">
        <div class="pe-head">
          <div class="pe-title">知一 · 错题本</div>
          <div class="pe-sub">{{ metaLine }}</div>
          <div v-if="groups.length" class="pe-chips">
            <span v-for="g in groups" :key="g.subject" class="pe-chip">{{ g.subject }} {{ g.items.length }} 题</span>
          </div>
        </div>

        <div v-if="!items.length" class="pe-empty">没有可导出的错题</div>

        <template v-for="g in groups" :key="g.subject">
          <div class="pe-subject">
            {{ g.subject }}<span class="pe-subject-n">（{{ g.items.length }} 题）</span>
          </div>

          <div v-for="it in g.items" :key="it.id" class="pe-item">
            <div class="pe-item-head">
              <span class="pe-no">{{ noOf(it) }}.</span>
              <span class="pe-kps">{{ (it.knowledgePoints || []).join(' / ') || '未标注知识点' }}</span>
              <span class="pe-status" :class="{ ok: it.mastered }">{{ it.mastered ? '已掌握' : `掌握度 ${it.streak || 0}/2` }}</span>
              <span class="pe-practice">练 {{ it.quizCount || 0 }} 次 · 对 {{ it.correctCount || 0 }} 次</span>
            </div>

            <div class="pe-q"><MathText :content="it.question" /></div>

            <!-- 完整版：作答 + 答案 + 解析 -->
            <template v-if="mode === 'full'">
              <div v-if="it.attempt" class="pe-attempt">
                <span class="pe-att-label">我的作答</span>
                <MathText :content="it.attempt" />
              </div>
              <div class="pe-label">答案</div>
              <div class="pe-answer"><MathText :content="it.answer || '（无）'" /></div>
              <template v-if="it.steps && it.steps.length">
                <div class="pe-label">解题步骤</div>
                <div v-for="(s, i) in it.steps" :key="i" class="pe-step">
                  <div class="pe-step-no">{{ i + 1 }}. <MathText :content="s.title" /></div>
                  <MathText :content="s.detail" />
                </div>
              </template>
              <template v-if="it.keyBreakthrough">
                <div class="pe-label">关键突破口</div>
                <div class="pe-key"><MathText :content="it.keyBreakthrough" /></div>
              </template>
              <template v-if="it.knowledgeReview">
                <div class="pe-label">知识点复习</div>
                <div class="pe-review"><MathText :content="it.knowledgeReview" /></div>
              </template>
              <template v-if="it.diagnosis">
                <div class="pe-label">错因诊断</div>
                <div class="pe-diagnosis"><MathText :content="it.diagnosis" /></div>
              </template>
              <template v-if="withFollowups && (it.followups || []).length">
                <div class="pe-label">追问记录（{{ it.followups.length }} 条）</div>
                <div v-for="(f, fi) in it.followups" :key="f.id || fi" class="pe-fu">
                  <div class="pe-fu-q">{{ f.q }}</div>
                  <div class="pe-fu-a"><MathText :content="f.a" /></div>
                </div>
              </template>
            </template>

            <!-- 自测卷：仅留作答区 -->
            <template v-else>
              <div class="pe-blank"><span>作 答 区</span></div>
            </template>
          </div>
        </template>

        <div v-if="items.length" class="pe-foot">
          —— 共 {{ items.length }} 题 · 知一（AI 拍题讲解 + 错题自测）导出 ——
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount } from 'vue'
import MathText from './MathText.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  mode: { type: String, default: 'full' }, // full 完整版 | quiz 自测卷
  withFollowups: { type: Boolean, default: false }, // 是否在完整版中附带追问记录
})
const emit = defineEmits(['close'])

const modeLabel = computed(() => (props.mode === 'quiz' ? '自测卷（仅题干）' : '完整版（含答案解析）'))

const metaLine = computed(() => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const t = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  return `${t} 导出 · ${modeLabel.value}`
})

// 全局连续编号（按传入列表顺序）
const noMap = computed(() => {
  const m = new Map()
  props.items.forEach((it, i) => m.set(it.id, i + 1))
  return m
})

// 按科目分组
const groups = computed(() => {
  const map = new Map()
  for (const it of props.items) {
    const k = it.subject || '未分类'
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(it)
  }
  return [...map.entries()].map(([subject, items]) => ({ subject, items }))
})

function noOf(it) {
  return noMap.value.get(it.id) || ''
}

function close() {
  emit('close')
}

function doPrint() {
  // 打印瞬间隐藏应用本体，只留打印文档；afterprint 恢复
  document.body.classList.add('zy-printing')
  const cleanup = () => document.body.classList.remove('zy-printing')
  window.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(cleanup, 60000) // 兜底：个别浏览器不触发 afterprint
  window.print()
}

onBeforeUnmount(() => document.body.classList.remove('zy-printing'))
</script>

<style scoped>
.pe-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: #eceef1;
  overflow-y: auto;
}
.pe-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 18px;
  background: #1f2733;
}
.pe-tip { font-size: 13px; color: #c8d0dc; }
.pe-actions { display: flex; gap: 10px; flex-shrink: 0; }
.pe-btn {
  border: 1px solid #55617a;
  background: transparent;
  color: #e7ebf2;
  border-radius: 6px;
  padding: 7px 16px;
  font-size: 13px;
  cursor: pointer;
}
.pe-btn:hover { border-color: #8b9cc0; }
.pe-btn-primary { background: #35507a; border-color: #35507a; color: #fff; font-weight: 600; }
.pe-btn-primary:hover { background: #2a4062; }

.pe-paper {
  width: min(820px, 100%);
  margin: 22px auto 60px;
  background: #fff;
  box-shadow: 0 2px 14px rgba(31, 39, 51, 0.12);
  padding: 44px 52px;
}

.pe-head { border-bottom: 2px solid #35507a; padding-bottom: 14px; margin-bottom: 8px; }
.pe-title { font-size: 24px; font-weight: 800; color: #1f2733; letter-spacing: 2px; }
.pe-sub { margin-top: 8px; font-size: 12.5px; color: #6b7686; }
.pe-chips { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.pe-chip {
  font-size: 12px;
  color: #35507a;
  border: 1px solid #d3dbec;
  background: #f2f5fa;
  border-radius: 999px;
  padding: 1px 10px;
}
.pe-empty { text-align: center; color: #9aa5b5; padding: 60px 0; font-size: 14px; }

.pe-subject {
  font-size: 16px;
  font-weight: 700;
  color: #35507a;
  margin: 26px 0 4px;
  padding-left: 9px;
  border-left: 4px solid #35507a;
}
.pe-subject-n { font-size: 12.5px; font-weight: 400; color: #6b7686; margin-left: 6px; }

.pe-item { padding: 14px 2px 16px; border-bottom: 1px solid #e5e8ee; }
.pe-item-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #6b7686;
  margin-bottom: 8px;
}
.pe-no { font-size: 15px; font-weight: 700; color: #1f2733; }
.pe-kps { color: #35507a; }
.pe-status { border: 1px solid #dfc9a0; color: #96690f; border-radius: 999px; padding: 0 8px; }
.pe-status.ok { border-color: #b5cfb5; color: #3e7a3e; }

.pe-q { font-size: 14.5px; line-height: 1.75; color: #1f2733; }

.pe-label { font-size: 12.5px; font-weight: 700; color: #6b7686; margin: 14px 0 6px; }
.pe-answer {
  border: 1px solid #cfdccf;
  background: #f4f9f4;
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.7;
}
.pe-attempt {
  border-left: 3px solid #d3dbec;
  padding: 4px 0 4px 12px;
  margin: 10px 0;
  font-size: 13.5px;
  color: #4a5568;
}
.pe-att-label { display: block; font-size: 12px; color: #6b7686; margin-bottom: 2px; }
.pe-step {
  border-left: 2px solid #e5e8ee;
  padding: 6px 0 6px 14px;
  margin-bottom: 6px;
  font-size: 14px;
  line-height: 1.7;
}
.pe-step-no { font-weight: 600; margin-bottom: 4px; }
.pe-key, .pe-review { font-size: 14px; line-height: 1.7; }
.pe-diagnosis {
  border: 1px solid #ecd9b0;
  background: #fdf8ee;
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.7;
}

.pe-blank {
  margin-top: 12px;
  height: 11em;
  border: 1px dashed #c9d2e0;
  border-radius: 6px;
  position: relative;
}
.pe-blank span {
  position: absolute;
  top: 8px;
  left: 12px;
  font-size: 11.5px;
  color: #b6c0cf;
  letter-spacing: 2px;
}

/* 追问记录 */
.pe-fu { margin-bottom: 8px; }
.pe-fu-q {
  font-size: 13.5px;
  font-weight: 600;
  color: #1f2733;
  margin-bottom: 4px;
}
.pe-fu-q::before { content: "问："; color: #6b7686; font-weight: 400; }
.pe-fu-a {
  padding-left: 10px;
  border-left: 2px solid #e5e8ee;
  font-size: 13.5px;
  line-height: 1.7;
  color: #1f2733;
}

.pe-foot { margin-top: 34px; text-align: center; font-size: 12px; color: #9aa5b5; }

@media (max-width: 768px) {
  .pe-paper { padding: 24px 18px; margin-top: 12px; }
  .pe-title { font-size: 20px; }
  .pe-toolbar { padding: 8px 12px; }
}
</style>
