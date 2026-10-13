<template>
  <div class="zy-container zy-page about">
    <header class="about__head">
      <span class="about__badge">面向大学理工科</span>
      <h1 class="about__title">知一 3.0</h1>
      <p class="about__slogan">从一道错题，到一个闭环</p>
      <p class="t-body-2 about__sub">AI 讲解 · 错题复习 · AI 课堂 · 班级批改</p>
      <div class="about__anchors">
        <span class="about__anchor"><b>3 档</b>讲解深度</span>
        <span class="about__anchor"><b>连对 2 次</b>才算掌握</span>
        <span class="about__anchor"><b>全班</b>一键批改</span>
      </div>
    </header>

    <section class="about__block surface-standard">
      <div class="about__block-head">
        <span class="about__block-ic"><UiIcon name="help" :size="16" /></span>
        <h2 class="t-h3">它解决什么问题</h2>
      </div>
      <p class="t-body">
        拍下不会的题，知一不只给答案，而是按<strong>思路 → 步骤 → 答案 → 知识点 → 易错点</strong>的顺序讲清楚，并把它收进错题本；
        之后按遗忘曲线帮你自测，直到真正掌握。核心不是「搜到答案」，而是「下次遇到会做」。
      </p>
    </section>

    <!-- 界面预览：真实界面截图（可切换场景、点击放大） -->
    <section class="about__block surface-standard">
      <div class="about__shots-head">
        <div class="about__block-head">
          <span class="about__block-ic is-safe"><UiIcon name="image" :size="16" /></span>
          <h2 class="t-h3">界面预览</h2>
        </div>
        <div class="about__shots-tabs">
          <button
            v-for="g in shotGroups"
            :key="g.key"
            type="button"
            class="about__shot-tab"
            :class="{ 'is-on': shotGroup === g.key }"
            @click="shotGroup = g.key"
          >{{ g.label }}</button>
        </div>
      </div>
      <div class="about__shots">
        <button
          v-for="s in activeShots"
          :key="s.img"
          type="button"
          class="about__shot"
          @click="openShot(s)"
        >
          <img :src="s.img" :alt="s.title" />
          <span class="about__shot-cap">{{ s.title }}</span>
        </button>
      </div>
      <p class="t-label about__shots-tip">以上均为真实界面截图，点击可放大查看</p>
    </section>

    <!-- 能力全景：学 / 练 / 管 / 教 -->
    <section class="about__block surface-standard">
      <div class="about__block-head">
        <span class="about__block-ic is-accent"><UiIcon name="data" :size="16" /></span>
        <h2 class="t-h3">能力全景</h2>
      </div>
      <div class="about__layers">
        <div v-for="l in layers" :key="l.key" class="about__layer">
          <div class="about__layer-head">
            <span class="about__layer-ic" :class="l.tone"><UiIcon :name="l.icon" :size="15" /></span>
            <b class="about__layer-name">{{ l.name }}</b>
            <span class="t-label">{{ l.tagline }}</span>
          </div>
          <ul class="about__layer-list">
            <li v-for="(f, i) in l.features" :key="i">{{ f }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="about__block surface-standard">
      <div class="about__block-head">
        <span class="about__block-ic is-accent"><UiIcon name="target" :size="16" /></span>
        <h2 class="t-h3">和其他搜题产品的区别</h2>
      </div>
      <div class="about__vs">
        <div class="about__vs-col is-them">
          <div class="about__vs-title">市面上多数搜题工具</div>
          <ul class="about__vs-list">
            <li>只给一个答案，看完还是不会</li>
            <li>错题躺在收藏夹，没有复习安排</li>
            <li>不知道哪里弱，只能凭感觉刷题</li>
            <li>看不懂也没法接着问</li>
            <li>老师布置与批改全靠人工</li>
            <li>没有理工科专属工具</li>
          </ul>
        </div>
        <div class="about__vs-col is-us">
          <div class="about__vs-title">知一 3.0</div>
          <ul class="about__vs-list">
            <li v-for="d in diffs" :key="d.title">
              <b>{{ d.title }}</b>
              <span>{{ d.desc }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 怎么用：学生线 / 老师线 -->
    <section class="about__block surface-standard">
      <div class="about__block-head">
        <span class="about__block-ic"><UiIcon name="play" :size="16" /></span>
        <h2 class="t-h3">怎么用</h2>
      </div>
      <div class="about__paths">
        <div class="about__path">
          <div class="about__path-head"><UiIcon name="user" :size="14" /> 学生：把不会的变成会的</div>
          <ol class="about__steps">
            <li v-for="(s, i) in studentSteps" :key="i">
              <span class="about__step-no">{{ i + 1 }}</span>
              <span class="about__step-text">{{ s }}</span>
            </li>
          </ol>
        </div>
        <div class="about__path">
          <div class="about__path-head"><UiIcon name="teacher" :size="14" /> 老师：布置与批改都变轻</div>
          <ol class="about__steps">
            <li v-for="(s, i) in teacherSteps" :key="i">
              <span class="about__step-no">{{ i + 1 }}</span>
              <span class="about__step-text">{{ s }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <section class="about__block surface-standard">
      <div class="about__block-head">
        <span class="about__block-ic is-safe"><UiIcon name="info" :size="16" /></span>
        <h2 class="t-h3">数据存在哪</h2>
      </div>
      <p class="t-body">
        错题本、打卡、资料、对话与学习记录默认<strong>只存在你本机</strong>（浏览器本地存储）；
        登录后错题本与打卡统计会同步到你的账号，换设备用昵称登录即可拉回。
        未登录时不会上传任何做题内容。
      </p>
    </section>

    <div class="about__ops">
      <UiButton variant="primary" @click="$router.push(ROUTES.capture)">开始拍题</UiButton>
      <UiButton variant="ghost" @click="$router.push(ROUTES.companion)">试试 AI 伴学</UiButton>
      <UiButton variant="ghost" @click="$router.push(ROUTES.help)">帮助与反馈</UiButton>
    </div>

    <!-- 截图放大 -->
    <UiModal v-model="shotOpen" :title="shot.title" size="lg">
      <img v-if="shot.img" :src="shot.img" class="about__shot-full" :alt="shot.title" />
    </UiModal>
  </div>
</template>

<script setup>
/** 产品介绍（/about）：自建内容页，无 mock 数据 */
import { computed, ref } from 'vue'
import UiButton from '../ui/UiButton.vue'
import UiIcon from '../ui/UiIcon.vue'
import UiModal from '../ui/UiModal.vue'
import { ROUTES } from '../lib/routes.js'

/* ---------- 差异化：右边这一列（与左边「传统搜题」逐条对齐） ---------- */
const diffs = [
  { title: '面向大学理工科', desc: '高数 / 线代 / 概率 / 数据结构 / 算法与代码，不是 K12 题库' },
  { title: '讲解优先', desc: '思路 → 步骤 → 突破口 → 易错点，三档深度可选，还能换个讲法' },
  { title: '真的会帮你复习', desc: '连对 2 次才算掌握，答错自动回炉；考前可切「突击模式」' },
  { title: 'AI 当老师，不只当客服', desc: '按知识点一节节讲，讲完当场出题检验、当场批改' },
  { title: '老师这边也省事', desc: '全班作业 AI 一键批改，共性错误自动汇总成班级报告' },
  { title: '理工科专属工具', desc: '代码在线判题、算法可视化演示、考前速查' },
]

/* ---------- 能力全景（学 / 练 / 管 / 教） ---------- */
const layers = [
  {
    key: 'learn',
    name: '学',
    icon: 'book',
    tone: '',
    tagline: '把不会的搞懂',
    features: [
      '拍照搜题：拍照 / 相册 / 拖拽 / 直接输文字',
      'AI 讲解：思路 → 步骤 → 答案 → 知识点 → 易错点',
      '看不懂可以追问，也能让它换个讲法',
      'AI 课堂：按知识点一节一节讲，讲完出题检验',
      'AI 伴学：有性格的伙伴，聊学习也能陪你放松',
    ],
  },
  {
    key: 'practice',
    name: '练',
    icon: 'target',
    tone: 'is-accent',
    tagline: '把会的变牢',
    features: [
      '错题自动归集，按课程与知识点分类',
      '按遗忘曲线安排复习，不用自己记时间',
      '三种练法：重做原题 / 变式题 / AI 出新题',
      '连对 2 次才算「已掌握」，答错自动回炉',
      '模拟考试：100 分制限时作答，主观题 AI 估分',
    ],
  },
  {
    key: 'manage',
    name: '管',
    icon: 'data',
    tone: 'is-safe',
    tagline: '让自己看得见',
    features: [
      '学情报告：薄弱知识点、错因归类与复习建议',
      '掌握度与练习趋势，一眼看出进步',
      '67 项成就、连续打卡与学习记录',
      '课程表与考试倒计时',
      '考前速查：公式表 / 算法模板 / 复杂度',
    ],
  },
  {
    key: 'teach',
    name: '教',
    icon: 'users',
    tone: '',
    tagline: '把一个人学变成一群人学',
    features: [
      '老师建班发码，学生输码进班',
      '布置作业，学生拍照提交（可传题目图）',
      'AI 一键批改全班，按评分点逐项核查',
      '班级报告：共性错误汇总 + 教学建议',
      '随堂测、班级群聊、社区论坛与学习小组',
    ],
  },
]

/* ---------- 界面预览：复用新手教程的真实截图（public/tours/*.webp） ---------- */
const shotGroups = [
  {
    key: 'learn',
    label: '学',
    shots: [
      { img: '/tours/welcome-1.webp', title: '拍题：拍照 / 相册 / 文字' },
      { img: '/tours/welcome-2.webp', title: 'AI 讲解：答案 + 分步推导' },
      { img: '/tours/teacher-1.webp', title: 'AI 课堂：开一门自己的课' },
      { img: '/tours/teacher-2.webp', title: '挑老师、定章节进度' },
      { img: '/tours/companion-2.webp', title: 'AI 伴学：聊天也能求教' },
    ],
  },
  {
    key: 'practice',
    label: '练',
    shots: [
      { img: '/tours/welcome-3.webp', title: '错题本：自动归集分类' },
      { img: '/tours/wrongbook-2.webp', title: '间隔复习：按遗忘曲线排期' },
      { img: '/tours/practice-1.webp', title: '自测：三种练法可选' },
      { img: '/tours/exam-1.webp', title: '模拟考试：选卷型' },
      { img: '/tours/exam-2.webp', title: '出卷：题量与限时' },
    ],
  },
  {
    key: 'manage',
    label: '管',
    shots: [
      { img: '/tours/welcome-4.webp', title: '学情报告：薄弱点与建议' },
      { img: '/tours/wrongbook-3.webp', title: '错题详情与掌握状态' },
      { img: '/tours/practice-2.webp', title: '练习与复习队列' },
      { img: '/tours/wrongbook-1.webp', title: '错题总览与筛选' },
    ],
  },
  {
    key: 'teach',
    label: '教',
    shots: [
      { img: '/tours/classroom-1.webp', title: '班级列表与待批改' },
      { img: '/tours/classroom-2.webp', title: '学生输班级码进班' },
      { img: '/tours/classroom-3.webp', title: '作业提交与批改反馈' },
      { img: '/tours/classroom-4.webp', title: '全班作业进度一览' },
      { img: '/tours/community-1.webp', title: '知一社区：论坛' },
      { img: '/tours/community-2.webp', title: '学习小组' },
      { img: '/tours/community-3.webp', title: '把错题分享到小组' },
    ],
  },
]
const shotGroup = ref('learn')
const activeShots = computed(() => {
  const g = shotGroups.find((x) => x.key === shotGroup.value) || shotGroups[0]
  return g.shots
})
const shotOpen = ref(false)
const shot = ref({})
function openShot(s) {
  shot.value = s
  shotOpen.value = true
}

/* ---------- 怎么用：学生线 / 老师线 ---------- */
const studentSteps = [
  'AI 拍题：拍照 / 相册 / 拖拽 / 文字都行',
  '看讲解：先看关键突破口，再看分步推导',
  '存错题：没吃透的题存入错题本（自动带知识点）',
  '自测复习：原题 / 变式 / AI 出新题，连对 2 次算掌握',
  '看数据：在「学情报告」里找薄弱点，调整复习重点',
]
const teacherSteps = [
  '完成教师认证（填姓名与学校）',
  '建班级，把 6 位班级码发给学生',
  '布置作业：可传题目图片、设截止时间',
  '学生拍照提交，AI 一键批改全班',
  '看班级报告：共性错误 + 教学建议，可导出成绩表',
]
</script>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
/* 页头：做出「封面感」 */
.about__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-5) 0 var(--sp-2);
}
.about__badge {
  align-self: flex-start;
  padding: 3px 12px;
  border-radius: var(--radius-pill);
  background: var(--primary-soft-2);
  color: var(--primary-text);
  font-size: var(--fs-label);
}
.about__title {
  margin: 0;
  font-size: 34px;
  line-height: 1.2;
}
.about__slogan {
  margin: 0;
  font-size: var(--fs-h2);
  font-weight: var(--fw-medium);
  background: linear-gradient(135deg, #7c5cff, #5b47d6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.about__sub {
  margin: 0;
  color: var(--text-tertiary);
}
/* 区块 */
.about__block {
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.about__block-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.about__block-head .t-h3 {
  margin: 0;
}
.about__block-ic {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.about__block-ic.is-accent {
  background: rgba(201, 80, 58, 0.12);
  color: #c9503a;
}
.about__block-ic.is-safe {
  background: rgba(58, 120, 192, 0.12);
  color: #3a78c0;
}
.about__block .t-body {
  color: var(--text-secondary);
}
/* 对比卡：知一 vs 传统搜题 */
.about__vs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--sp-3);
}
.about__vs-col {
  padding: var(--sp-4);
  border-radius: var(--radius-md);
  border: var(--border-subtle);
  background: var(--surface-recess);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.about__vs-col.is-us {
  background: var(--primary-soft-3);
  border-color: var(--primary-line);
}
.about__vs-title {
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--text-tertiary);
}
.about__vs-col.is-us .about__vs-title {
  color: var(--primary-text);
}
.about__vs-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.about__vs-list li {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: var(--lh-relaxed);
}
.about__vs-list li b {
  color: var(--text-primary);
  font-weight: var(--fw-medium);
}
/* 怎么用：竖向时间轴（连接线） */
.about__steps {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  list-style: none;
  margin: 0;
  padding: 0;
}
.about__steps li {
  position: relative;
  display: flex;
  gap: var(--sp-3);
  align-items: flex-start;
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.about__steps li:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 26px;
  bottom: -12px;
  width: 1px;
  background: var(--border-subtle);
}
.about__step-no {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-soft-2);
  color: var(--primary-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-label);
  font-weight: var(--fw-medium);
  flex: none;
  position: relative;
  z-index: 1;
}
.about__step-text {
  min-width: 0;
  line-height: var(--lh-relaxed);
  padding-top: 1px;
}
/* 界面预览：真实截图横向带 + 场景切换 */
.about__shots-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
.about__shots-tabs {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--surface-unit);
  border: var(--border-subtle);
  gap: 2px;
}
.about__shot-tab {
  padding: 4px 14px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text-tertiary);
  font-family: inherit;
  font-size: var(--fs-body-2);
  cursor: pointer;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.about__shot-tab.is-on {
  background: var(--primary);
  color: var(--text-on-primary);
}
.about__shots {
  display: flex;
  gap: var(--sp-3);
  overflow-x: auto;
  padding: 4px 2px 10px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}
.about__shot {
  flex: none;
  width: 264px;
  padding: 0;
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  scroll-snap-align: start;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.about__shot:hover {
  transform: translateY(-2px);
  border-color: var(--primary-line);
  box-shadow: var(--shadow-elevated);
}
.about__shot img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: top center;
  background: var(--surface-recess);
}
.about__shot-cap {
  display: block;
  padding: 8px 10px;
  font-size: var(--fs-label);
  color: var(--text-secondary);
  border-top: var(--border-divider-soft);
}
.about__shots-tip {
  margin: 0;
}
.about__shot-full {
  display: block;
  width: 100%;
  border-radius: var(--radius-sm);
}
.about__ops {
  display: flex;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
/* Hero 数字锚点 */
.about__anchors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
.about__anchor {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface-1);
  border: var(--border-subtle);
  font-size: var(--fs-label);
  color: var(--text-secondary);
}
.about__anchor b {
  color: var(--primary-text);
  font-weight: var(--fw-medium);
}
/* 能力全景：学 / 练 / 管 / 教 */
.about__layers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--sp-3);
}
.about__layer {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border-radius: var(--radius-md);
  background: var(--surface-recess);
  border: var(--border-subtle);
}
.about__layer-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.about__layer-ic {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft-2);
  color: var(--primary-text);
}
.about__layer-ic.is-accent {
  background: rgba(201, 80, 58, 0.12);
  color: #c9503a;
}
.about__layer-ic.is-safe {
  background: rgba(58, 120, 192, 0.12);
  color: #3a78c0;
}
.about__layer-name {
  font-size: var(--fs-body);
  color: var(--text-primary);
}
.about__layer-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--fs-label);
  color: var(--text-secondary);
  line-height: var(--lh-relaxed);
}
/* 怎么用：双路径 */
.about__paths {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--sp-4);
}
.about__path {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.about__path-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-body-2);
  font-weight: var(--fw-medium);
  color: var(--primary-text);
}
</style>
