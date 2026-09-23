/**
 * 子页面导航工具
 * ---------------------------------------------------------------------------
 * goBackSmart：优先「返回上一页」（从「更多」进来就回更多、从首页进来就回首页），
 * 直接打开链接（深链、无站内历史）时回落到「更多」——保证任何入口都不会卡死。
 */
import { ROUTES } from './routes.js'

export function goBackSmart(router, fallback = ROUTES.more) {
  const state = typeof window !== 'undefined' ? window.history.state : null
  if (state && state.back) {
    router.back()
  } else {
    router.push(fallback)
  }
}

/**
 * 桌面端左侧导航结构（≥1024px 使用；移动端不渲染）
 * ---------------------------------------------------------------------------
 * 分组与移动端首页的「主功能大卡 + 次入口」保持一致，只是改为常驻竖列，
 * 桌面端一键直达，不必先回首页再点卡片。
 */
export const DESKTOP_NAV = [
  {
    title: '学习',
    items: [
      { label: '工作台', icon: 'home', path: ROUTES.home },
      { label: '拍照搜题', icon: 'camera', path: ROUTES.capture },
      { label: 'AI 讲题对话', icon: 'chat', path: ROUTES.chat },
    ],
  },
  {
    title: '巩固',
    items: [
      { label: '错题学习', icon: 'book', path: ROUTES.wrongbook, badge: 'review' },
      { label: '学习数据', icon: 'data', path: ROUTES.data },
      { label: '学习记录', icon: 'history', path: ROUTES.records },
      { label: '成就殿堂', icon: 'sparkle', path: ROUTES.achievements },
    ],
  },
  {
    title: '教学与工具',
    items: [
      { label: '班级课堂', icon: 'users', path: ROUTES.classPage },
      { label: '课程表', icon: 'schedule', path: ROUTES.timetable },
      { label: '考试安排', icon: 'clipboard', path: ROUTES.exams },
      { label: '学习工具', icon: 'sparkle', path: ROUTES.tools },
      { label: '知一社区', icon: 'image', path: ROUTES.community },
    ],
  },
  {
    title: '我的',
    items: [
      { label: '账号与同步', icon: 'user', path: ROUTES.mine },
      { label: '产品介绍', icon: 'info', path: ROUTES.about },
      { label: '帮助与反馈', icon: 'help', path: ROUTES.help },
    ],
  },
]

/** 按当前路径匹配导航项（含分组名）：用于侧栏高亮与顶部面包屑 */
export function matchNav(pathname = '') {
  const p = String(pathname).split('?')[0]
  for (const sec of DESKTOP_NAV) {
    for (const item of sec.items) {
      const on = item.path === ROUTES.home
        ? p === ROUTES.home
        : p === item.path || p.startsWith(item.path + '/')
      if (on) return { section: sec.title, item }
    }
  }
  // 兜底：详情类页面（/q/:id、/wrongbook/:id、/practice/:mode 等）挂到语义最近的父级
  const fallbackMap = [
    [/^\/q\//, ROUTES.capture],
    [/^\/wrongbook\//, ROUTES.wrongbook],
    [/^\/practice\//, ROUTES.wrongbook],
    [/^\/chat\//, ROUTES.chat],
    [/^\/class\//, ROUTES.classPage],
    [/^\/exam\//, ROUTES.exams],
    [/^\/exam$/, ROUTES.exams],
    [/^\/more$/, ROUTES.tools],
    [/^\/achievements$/, ROUTES.achievements],
  ]
  for (const [re, target] of fallbackMap) {
    if (re.test(p)) return matchNav(target)
  }
  return { section: '', item: { label: '', icon: 'home', path: p } }
}
