<template>
  <div class="zy-container zy-page about">
    <header class="about__head">
      <h1 class="t-h1">关于知一</h1>
      <p class="t-body-2">AI 拍题讲解 + 错题自测，面向大学生</p>
    </header>

    <section class="about__block surface-standard">
      <h2 class="t-h3">它解决什么问题</h2>
      <p class="t-body">
        拍下不会的题，知一不只给答案，而是按<strong>思路 → 步骤 → 答案 → 知识点 → 易错点</strong>的顺序讲清楚，并把它收进错题本；
        之后按间隔复习帮你自测，直到真正掌握。核心不是「搜到答案」，而是「下次遇到会做」。
      </p>
    </section>

    <section class="about__block surface-standard">
      <h2 class="t-h3">和其他搜题工具的区别</h2>
      <div class="about__rows">
        <div v-for="d in diffs" :key="d.title" class="about__row">
          <span class="about__row-t">{{ d.title }}</span>
          <span class="about__row-d">{{ d.desc }}</span>
        </div>
      </div>
    </section>

    <section class="about__block surface-standard">
      <h2 class="t-h3">怎么用</h2>
      <ol class="about__steps">
        <li v-for="(s, i) in steps" :key="i">
          <span class="about__step-no">{{ i + 1 }}</span>
          <span>{{ s }}</span>
        </li>
      </ol>
    </section>

    <section class="about__block surface-standard">
      <h2 class="t-h3">数据存在哪</h2>
      <p class="t-body">
        错题本、打卡、资料、对话与学习记录默认<strong>只存在你本机</strong>（浏览器本地存储）；
        登录后错题本与打卡统计会同步到你的账号，换设备用昵称登录即可拉回。
        未登录时不会上传任何做题内容。
      </p>
    </section>

    <div class="about__ops">
      <UiButton variant="primary" @click="$router.push(ROUTES.capture)">开始拍题</UiButton>
      <UiButton variant="ghost" @click="$router.push(ROUTES.help)">帮助与反馈</UiButton>
    </div>
  </div>
</template>

<script setup>
/** 产品介绍（/about）：自建内容页，无 mock 数据 */
import UiButton from '../ui/UiButton.vue'
import { ROUTES } from '../lib/routes.js'

const diffs = [
  { title: '讲解优先', desc: '默认展开思路与步骤，答案放前面但不只给答案' },
  { title: '自测闭环', desc: '错题自动进入复习队列，连对 2 次才算掌握' },
  { title: '学情可见', desc: '薄弱知识点、掌握度、新增趋势都看得到' },
  { title: '可追问', desc: '对讲解不满意可以继续追问、换个讲法' },
]

const steps = [
  'AI 拍题：拍照 / 相册 / 拖拽 / 粘贴，或直接输入题目文字',
  '看讲解：先看关键突破口，再看分步推导，最后对照答案',
  '存错题：把没吃透的题存入错题本（可自动带知识点）',
  '自测复习：原题复习 / 变式题 / AI 新出题三种模式',
  '看数据：在「学习数据」里查看薄弱点与趋势，调整复习重点',
]
</script>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: var(--col-main);
}
.about__head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.about__block {
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.about__block .t-body {
  color: var(--text-secondary);
}
.about__rows {
  display: flex;
  flex-direction: column;
}
.about__row {
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-2) 0;
  font-size: var(--fs-body-2);
  border-bottom: var(--border-divider-soft);
}
.about__row:last-child {
  border-bottom: 0;
}
.about__row-t {
  min-width: 84px;
  color: var(--text-primary);
}
.about__row-d {
  color: var(--text-tertiary);
}
.about__steps {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  list-style: none;
}
.about__steps li {
  display: flex;
  gap: var(--sp-3);
  align-items: flex-start;
  font-size: var(--fs-body-2);
  color: var(--text-secondary);
}
.about__step-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-soft-2);
  color: var(--primary-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-label);
  flex: none;
  margin-top: 1px;
}
.about__ops {
  display: flex;
  gap: var(--sp-3);
}
</style>
