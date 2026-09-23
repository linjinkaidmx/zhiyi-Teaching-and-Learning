import { createRouter, createWebHistory } from 'vue-router'
import { ROUTES } from '../lib/routes.js'

/**
 * 知一 V1 · 路由表（路径已冻结，见 lib/routes.js）
 * ---------------------------------------------------------------------------
 * P2 的两类路由：
 *   chrome: 'legacy'  —— 现有页面（出题讲解 / 错题本 / 自测 / 我的）沿用它原来的外观与顶栏，
 *                        路由只负责「地址 + 前进后退」，功能与观感零变化。
 *                        这些路由的组件由 App.vue 按 meta.view 渲染，故路由本身挂 <NullView>
 *                        （不渲染任何内容，只提供匹配与参数）。
 *   chrome: 'v1'      —— 新外观页面（更多 / 各占位页），使用 AppShell + TopNav + BottomNav。
 * P3 起逐页把 legacy 路由改成带真实 component 的 v1 路由（抽出 pages/*.vue 并重做外观）。
 */

/** 占位组件：legacy 路由只用来匹配与传参，实际内容由 App.vue 渲染 */
export const NullView = { name: 'NullView', render: () => null }

const legacy = (path, name, view, meta = {}) => ({
  path,
  name,
  component: NullView,
  meta: { chrome: 'legacy', view, ...meta },
})

const v1 = (path, name, component, meta = {}) => ({
  path,
  name,
  component,
  meta: { chrome: 'v1', ...meta },
})

export const routes = [
  // ---------------- 首页（P3：依据已确认概念图实现，v1 外观） ----------------
  v1(ROUTES.home, 'home', () => import('../pages/HomePage.vue')),

  // ---------------- 拍题与讲解链路（P4 拍题页 + P5 文档型讲解页） ----------------
  v1(ROUTES.capture, 'capture', () => import('../pages/CapturePage.vue')),
  v1(ROUTES.question, 'question', () => import('../pages/ExplainPage.vue')),

  // ---------------- 错题学习（P6 重做） ----------------
  v1(ROUTES.wrongbook, 'wrongbook', () => import('../pages/WrongBookPage.vue')),
  v1(ROUTES.wrongbookDetail, 'wrongbook-detail', () => import('../pages/WrongBookPage.vue'), { detail: true }),
  v1(ROUTES.practice, 'practice', () => import('../pages/PracticePage.vue')),

  // ---------------- 新建页面（v1 外观） ----------------
  // 学习工具页（A5）：由原「更多」页改造而来；/more 保留重定向防旧链接
  v1(ROUTES.tools, 'tools', () => import('../pages/ToolsPage.vue')),
  { path: ROUTES.more, redirect: ROUTES.tools },
  // 列表与详情共用**同一条路由记录**（id 可选）：否则 /chat → /chat/:id 会重建组件，
  // 旧实例卸载时的 abort 会把「新建会话后立刻发送」的流式请求掐断（实测踩过）。
  v1('/chat/:id?', 'chat', () => import('../pages/ChatPage.vue')),
  v1(ROUTES.course, 'course', () => import('../pages/CoursePage.vue')),
  v1(ROUTES.timetable, 'timetable', () => import('../pages/TimetablePage.vue')),
  v1(ROUTES.exams, 'exams', () => import('../pages/ExamsPage.vue')),
  // 模拟考试：主页（模式 + 历史）与答题页（组卷 → 作答 → 判分 → 复盘）
  v1(ROUTES.simExam, 'sim-exam', () => import('../pages/ExamPage.vue')),
  v1(ROUTES.simExamRun, 'sim-exam-run', () => import('../pages/ExamRunPage.vue')),
  v1(ROUTES.data, 'data', () => import('../pages/DataPage.vue')),
  v1(ROUTES.records, 'records', () => import('../pages/RecordsPage.vue')),
  // 成就殿堂：51 枚奖章按 8 个功能域展示（数据来自本地统计，登录后云同步）
  v1(ROUTES.achievements, 'achievements', () => import('../pages/AchievementsPage.vue')),
  v1(ROUTES.community, 'community', () => import('../pages/CommunityPage.vue')),
  v1(ROUTES.about, 'about', () => import('../pages/AboutPage.vue')),
  v1(ROUTES.help, 'help', () => import('../pages/HelpPage.vue')),

  // ---------------- 班级模块（认证老师建班 → 布置作业 → 拍照提交 → AI 批改） ----------------
  v1(ROUTES.classPage, 'class', () => import('../pages/ClassPage.vue')),
  v1(ROUTES.classDetail, 'class-detail', () => import('../pages/ClassDetailPage.vue')),
  v1(ROUTES.homeworkDetail, 'homework-detail', () => import('../pages/HomeworkDetailPage.vue')),
  v1(ROUTES.classTestRun, 'class-test-run', () => import('../pages/TestRunPage.vue')),

  // ---------------- 我的（P6 起 v1 外观；至此所有路由均为 v1） ----------------
  v1(ROUTES.mine, 'mine', () => import('../pages/MinePage.vue')),

  // ---------------- 兜底 ----------------
  v1('/:pathMatch(.*)*', 'not-found', () => import('../pages/PlaceholderPage.vue'), {
    title: '页面不存在',
    phase: '404',
    description: '这个地址没有对应的页面，可以回到首页继续。',
  }),
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
