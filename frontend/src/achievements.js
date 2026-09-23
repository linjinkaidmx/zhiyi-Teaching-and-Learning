// 成就定义（44 枚，含 3 枚隐藏）
// ---------------------------------------------------------------------------
// value(ctx) 返回当前进度，达到 target 即解锁
// ctx 由 stats.js 的 buildContext 提供：
//   { totals, streak, days, refSeen, settings, checkedDays, mastered, weekFull,
//     earlyStreak, maxQuizPerItem, night, comeback }
// rarity：common(铜) | rare(银) | epic(金) | legend(传说)
// totem：奖章图腾（对应 ui/BadgeMedal.vue 的图形表）
// hidden：隐藏成就 —— 解锁前在成就页只显示灰影与「?」，不泄露条件

export const RARITY = {
  common: { key: 'common', name: '普通', order: 1 },
  rare: { key: 'rare', name: '稀有', order: 2 },
  epic: { key: 'epic', name: '史诗', order: 3 },
  legend: { key: 'legend', name: '传说', order: 4 },
}

/** 稀有度中文名（数据层唯一定义，UI 层从这里取，避免两处维护） */
export const RARITY_NAME = { common: '普通', rare: '稀有', epic: '史诗', legend: '传说' }

/** 分组顺序即成就页的展示顺序（按用户使用路径排） */
export const GROUPS = [
  '拍照搜题', '讲解与追问', '错题与自测', '坚持与打卡',
  '编程与工具', '班级课堂', '考试与模拟', '社区与个人',
]

export const ACHIEVEMENTS = [
  // ---------------- 拍照搜题
  {
    key: 'first_search', group: '拍照搜题', name: '初次识题', rarity: 'common', totem: 'search',
    desc: '第一次拍照识别题目', target: 1,
    value: (c) => c.totals.search,
  },
  {
    key: 'multi_upload', group: '拍照搜题', name: '多题连发', rarity: 'common', totem: 'camera',
    desc: '一次上传 5 张以上图片', target: 1,
    value: (c) => c.totals.multi,
  },
  {
    key: 'search_50', group: '拍照搜题', name: '拍照达人', rarity: 'rare', totem: 'camera',
    desc: '累计识别 50 次', target: 50,
    value: (c) => c.totals.search,
  },
  {
    key: 'bank_20', group: '拍照搜题', name: '秒答猎手', rarity: 'rare', totem: 'bolt',
    desc: '题库秒答命中 20 次', target: 20,
    value: (c) => c.totals.bank,
  },
  {
    key: 'search_200', group: '拍照搜题', name: '识题如飞', rarity: 'epic', totem: 'bolt',
    desc: '累计识别 200 次', target: 200,
    value: (c) => c.totals.search,
  },

  // ---------------- 讲解与追问
  {
    key: 'first_explain', group: '讲解与追问', name: '初识知一', rarity: 'common', totem: 'chat',
    desc: '完成第一次题目讲解', target: 1,
    value: (c) => c.totals.explain,
  },
  {
    key: 'reteach_5', group: '讲解与追问', name: '另辟蹊径', rarity: 'common', totem: 'layers',
    desc: '累计使用「换个讲法」5 次', target: 5,
    value: (c) => c.totals.reteach,
  },
  {
    key: 'followup_10', group: '讲解与追问', name: '追问新手', rarity: 'common', totem: 'question',
    desc: '向 AI 追问 10 次', target: 10,
    value: (c) => c.totals.followup,
  },
  {
    key: 'explain_10', group: '讲解与追问', name: '十解成习', rarity: 'rare', totem: 'chat',
    desc: '累计完成 10 次题目讲解', target: 10,
    value: (c) => c.totals.explain,
  },
  {
    key: 'followup_20', group: '讲解与追问', name: '好问不倦', rarity: 'rare', totem: 'question',
    desc: '累计向 AI 追问 20 次', target: 20,
    value: (c) => c.totals.followup,
  },
  {
    key: 'explain_100', group: '讲解与追问', name: '精研百题', rarity: 'epic', totem: 'chat',
    desc: '累计完成 100 次题目讲解', target: 100,
    value: (c) => c.totals.explain,
  },
  {
    key: 'followup_100', group: '讲解与追问', name: '刨根问底', rarity: 'legend', totem: 'layers',
    desc: '累计向 AI 追问 100 次', target: 100,
    value: (c) => c.totals.followup,
  },

  // ---------------- 错题与自测
  {
    key: 'first_quiz', group: '错题与自测', name: '首战告捷', rarity: 'common', totem: 'bookmark',
    desc: '完成第一次自测', target: 1,
    value: (c) => c.totals.quiz + c.totals.practice,
  },
  {
    key: 'sticky_fix', group: '错题与自测', name: '顽疾攻克', rarity: 'common', totem: 'target',
    desc: '同一道错题连续答对 2 次', target: 1,
    value: (c) => c.totals.stickyFix,
  },
  {
    key: 'correct_10', group: '错题与自测', name: '小试牛刀', rarity: 'common', totem: 'book',
    desc: '自测与练习累计答对 10 题', target: 10,
    value: (c) => c.totals.correct,
  },
  {
    key: 'review_ontime', group: '错题与自测', name: '复习守时', rarity: 'rare', totem: 'clock',
    desc: '在同一天清完到期的 10 道错题', target: 1,
    value: (c) => c.totals.ontime,
  },
  {
    key: 'quiz_perfect', group: '错题与自测', name: '全对一次', rarity: 'rare', totem: 'target',
    desc: '单次自测全部答对（≥5 题）', target: 1,
    value: (c) => c.totals.perfect,
  },
  {
    key: 'correct_100', group: '错题与自测', name: '正解百题', rarity: 'epic', totem: 'book',
    desc: '自测与练习累计答对 100 题', target: 100,
    value: (c) => c.totals.correct,
  },
  {
    key: 'mastered_20', group: '错题与自测', name: '错题清零人', rarity: 'epic', totem: 'bookmark',
    desc: '累计 20 道错题达到「已掌握」', target: 20,
    value: (c) => c.totals.masteredMax,
  },
  {
    key: 'mastered_200', group: '错题与自测', name: '融会贯通', rarity: 'legend', totem: 'target',
    desc: '累计 200 道错题达到「已掌握」', target: 200,
    value: (c) => c.totals.masteredMax,
  },

  // ---------------- 坚持与打卡
  {
    key: 'streak_3', group: '坚持与打卡', name: '三日之约', rarity: 'common', totem: 'spark',
    desc: '连续学习 3 天', target: 3,
    value: (c) => Math.max(c.streak.current, c.streak.longest),
  },
  {
    key: 'night_owl', group: '坚持与打卡', name: '深夜灯下', rarity: 'common', totem: 'clock', hidden: true,
    desc: '在凌晨 0 点到 5 点之间学习', target: 1,
    value: (c) => c.night,
  },
  {
    key: 'streak_7', group: '坚持与打卡', name: '七日不断', rarity: 'rare', totem: 'calendar',
    desc: '连续学习 7 天', target: 7,
    value: (c) => Math.max(c.streak.current, c.streak.longest),
  },
  {
    key: 'early_bird', group: '坚持与打卡', name: '早起鸟', rarity: 'rare', totem: 'clock',
    desc: '连续 7 天在早上 8 点前学习', target: 7,
    value: (c) => c.earlyStreak,
  },
  {
    key: 'week_full', group: '坚持与打卡', name: '周满勤', rarity: 'rare', totem: 'calendar',
    desc: '一周 7 天每天都完成每日目标', target: 1,
    value: (c) => c.weekFull,
    requiresGoal: '需开启每日目标',
  },
  {
    key: 'streak_30', group: '坚持与打卡', name: '月度铁人', rarity: 'epic', totem: 'spark',
    desc: '连续学习 30 天', target: 30,
    value: (c) => Math.max(c.streak.current, c.streak.longest),
  },
  {
    key: 'days_100', group: '坚持与打卡', name: '百日筑基', rarity: 'epic', totem: 'calendar',
    desc: '累计打卡满 100 天', target: 100,
    value: (c) => c.checkedDays,
  },
  {
    key: 'streak_60', group: '坚持与打卡', name: '学期全勤', rarity: 'legend', totem: 'spark',
    desc: '连续学习 60 天', target: 60,
    value: (c) => Math.max(c.streak.current, c.streak.longest),
  },

  // ---------------- 编程与工具
  {
    key: 'first_run', group: '编程与工具', name: '首次运行', rarity: 'common', totem: 'terminal',
    desc: '第一次在线运行代码', target: 1,
    value: (c) => c.totals.run,
  },
  {
    key: 'run_10', group: '编程与工具', name: '跑通十次', rarity: 'common', totem: 'code',
    desc: '在线运行代码 10 次', target: 10,
    value: (c) => c.totals.run,
  },
  {
    key: 'ref_all', group: '编程与工具', name: '通览全书', rarity: 'common', totem: 'compass',
    desc: '浏览过考前速查的全部 5 个分类', target: 5,
    value: (c) => c.refSeen.length,
  },
  {
    key: 'debug_10', group: '编程与工具', name: '捉虫达人', rarity: 'rare', totem: 'bug',
    desc: '使用代码诊断 10 次', target: 10,
    value: (c) => c.totals.debug,
  },
  {
    key: 'algo_10', group: '编程与工具', name: '算法漫游', rarity: 'rare', totem: 'rocket',
    desc: '看过 10 个不同的算法演示', target: 10,
    value: (c) => c.algoSeen,
  },
  {
    key: 'debug_50', group: '编程与工具', name: '调试高手', rarity: 'rare', totem: 'bug',
    desc: '使用代码诊断 50 次', target: 50,
    value: (c) => c.totals.debug,
  },
  {
    key: 'algo_50', group: '编程与工具', name: '可视化控', rarity: 'epic', totem: 'rocket',
    desc: '累计使用算法演示 50 次', target: 50,
    value: (c) => c.totals.algo,
  },
  {
    key: 'export_10', group: '编程与工具', name: '导出能手', rarity: 'epic', totem: 'homework',
    desc: '导出或打印讲解 10 次', target: 10,
    value: (c) => c.totals.export,
  },

  // ---------------- 班级课堂
  {
    key: 'join_class', group: '班级课堂', name: '入班第一课', rarity: 'common', totem: 'class',
    desc: '加入一个班级', target: 1,
    value: (c) => c.totals.cls,
  },
  {
    key: 'note_share', group: '班级课堂', name: '笔记分享者', rarity: 'common', totem: 'homework',
    desc: '发布或收藏 5 篇班级笔记', target: 5,
    value: (c) => c.totals.note,
  },
  {
    key: 'hw_10', group: '班级课堂', name: '作业不落', rarity: 'rare', totem: 'homework',
    desc: '累计提交 10 次作业', target: 10,
    value: (c) => c.totals.hw,
  },
  {
    key: 'hw_perfect', group: '班级课堂', name: '满分作业', rarity: 'rare', totem: 'podium',
    desc: '作业获得 100 分', target: 1,
    value: (c) => c.totals.hwPerfect,
  },
  {
    key: 'test_top3', group: '班级课堂', name: '考霸', rarity: 'epic', totem: 'podium',
    desc: '班级测试进入前 3 名', target: 1,
    value: (c) => c.totals.top3,
  },

  // ---------------- 考试与模拟
  {
    key: 'sim_1', group: '考试与模拟', name: '模拟初体验', rarity: 'common', totem: 'medal',
    desc: '完成第一次模拟考试', target: 1,
    value: (c) => c.totals.exam,
  },
  {
    key: 'sim_10', group: '考试与模拟', name: '考试达人', rarity: 'rare', totem: 'medal',
    desc: '完成 10 次模拟考试', target: 10,
    value: (c) => c.totals.exam,
  },
  {
    key: 'sim_perfect', group: '考试与模拟', name: '模拟满分', rarity: 'legend', totem: 'exam',
    desc: '模拟考试获得满分', target: 1,
    value: (c) => c.totals.examPerfect,
  },

  // ---------------- 社区与个人
  {
    key: 'first_post', group: '社区与个人', name: '社区新人', rarity: 'common', totem: 'chat',
    desc: '在社区发布第一篇帖子', target: 1,
    value: (c) => c.totals.post,
  },
  {
    key: 'profile_done', group: '社区与个人', name: '资料完善', rarity: 'common', totem: 'compass',
    desc: '完善头像或昵称', target: 1,
    value: (c) => (c.profileDone || c.totals.profile || 0),
  },
  {
    key: 'course_5', group: '社区与个人', name: '课程管家', rarity: 'common', totem: 'calendar',
    desc: '课程表里添加 5 门课程', target: 5,
    value: (c) => (c.courseCount || c.totals.course || 0),
  },
  {
    key: 'exam_plan_3', group: '社区与个人', name: '考试规划', rarity: 'common', totem: 'homework',
    desc: '考试安排里添加 3 场考试', target: 3,
    value: (c) => (c.examCount || c.totals.examPlan || 0),
  },
  {
    key: 'post_saved', group: '社区与个人', name: '热心分享', rarity: 'rare', totem: 'spark',
    desc: '累计发布 5 篇社区帖子', target: 5,
    value: (c) => c.totals.post,
  },
  {
    key: 'come_back', group: '社区与个人', name: '卷土重来', rarity: 'common', totem: 'rocket', hidden: true,
    desc: '间隔 3 天以上之后，重新回来学习', target: 1,
    value: (c) => c.comeback,
  },
  {
    key: 'never_give_up', group: '社区与个人', name: '不离不弃', rarity: 'rare', totem: 'layers', hidden: true,
    desc: '同一道错题累计复习 5 次以上', target: 5,
    value: (c) => c.maxQuizPerItem,
  },
]

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a]))

/** 速查可浏览的分类（用于「通览全书」） */
export const REF_CATEGORIES = ['calc', 'linear', 'prob', 'algo', 'complexity']

/** 按稀有度统计（成就页总览用） */
export function countByRarity(list) {
  const out = { common: { done: 0, total: 0 }, rare: { done: 0, total: 0 }, epic: { done: 0, total: 0 }, legend: { done: 0, total: 0 } }
  for (const a of list) {
    out[a.rarity].total += 1
    if (a.done) out[a.rarity].done += 1
  }
  return out
}
