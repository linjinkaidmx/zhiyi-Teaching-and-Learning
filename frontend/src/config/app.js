/**
 * 运行配置（唯一入口）
 * 前端只从这里读取环境相关配置，组件与页面不得散落写死地址或开关。
 */

export const APP_VERSION = '1.0.0'

/** 真实后端地址：开发用 .env.development 的 VITE_API_BASE，生产留空走同源 */
export const API_BASE = import.meta.env?.VITE_API_BASE ?? ''

/**
 * Mock 白名单（仅「后端尚未实现」的能力允许 Mock）
 * 已存在真实接口的能力（题目识别 / AI 讲解 / 批改 / 题内追问 / 换个讲法）
 * 必须直接走 lib/api，不允许重新 Mock。
 * 首页（home）已于 2026-09-20 改为本地真实数据，不再 Mock。
 */
export const MOCK = {
  chat: false, // ✅ 已实现：/api/chat/stream（会话历史仍在前端本地）
  similarQuestions: false, // ✅ 已实现：/api/variant
  learningRecords: false, // ✅ 批次1 已实现：user_sessions 表 + 云同步
  studyTime: false, // ✅ 批次4 已实现：学习时长（前端计时 + 记录 minutes 字段）
  practiceAttempt: false, // ✅ 批次4 已实现：自测作答已写入学习记录
  analysis: false, // ✅ 批次4 已实现：/api/analyze/errorbook（AI 学情建议）
  home: false, // ✅ 已改为本地真实数据（错题本 + 学习记录，lib/homeStats.js）
}
