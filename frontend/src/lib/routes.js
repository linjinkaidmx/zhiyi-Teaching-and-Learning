/**
 * 路由常量（已冻结，P2 接入 vue-router 时直接复用，禁止另行命名）
 *  /  /capture  /q/:id  /wrongbook  /wrongbook/:id  /practice/:mode
 *  /chat  /chat/:id  /tools(原/more)  /course  /timetable  /exam  /exam/run  /data  /records
 *  /community  /achievements  /about  /help  /me  /class  /class/:id  /class/:id/hw/:hid
 */
export const ROUTES = {
  home: '/',
  capture: '/capture',
  question: '/q/:id',
  wrongbook: '/wrongbook',
  wrongbookDetail: '/wrongbook/:id',
  practice: '/practice/:mode',
  chat: '/chat',
  chatDetail: '/chat/:id',
  tools: '/tools',
  more: '/more',
  course: '/course',
  timetable: '/timetable',
  exams: '/exams',
  simExam: '/exam',
  simExamRun: '/exam/run',
  data: '/data',
  records: '/records',
  achievements: '/achievements',
  community: '/community',
  about: '/about',
  help: '/help',
  mine: '/me',
  classPage: '/class',
  classDetail: '/class/:id',
  homeworkDetail: '/class/:id/hw/:hid',
  classTestRun: '/class/:id/test/:tid',
}

/** 生成带参数的路径 */
export function path(route, params = {}) {
  return String(route).replace(/:(\w+)/g, (_, key) => encodeURIComponent(params[key] ?? ''))
}

/** 首页顶部双 Tab（学习 / 我的）—— 底部导航移除后全站唯一的常驻导航 */
export const HOME_TABS = [
  { label: '学习', path: ROUTES.home },
  { label: '我的', path: ROUTES.mine },
]
