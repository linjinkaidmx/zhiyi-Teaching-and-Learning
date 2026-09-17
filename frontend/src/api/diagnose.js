import axios from 'axios'

// 后端地址。构建时可通过环境变量 VITE_API_BASE 覆盖。
// 生产部署（Nginx 同源反向代理）时该值为空串，请求走相对路径 /api/...，
// 从而实现「build 一次、任意服务器通用」，且天然规避 HTTPS 混合内容拦截。
// 注意：这里用 ?? 而非 || —— 空串必须保留，否则会被回退成本机地址。
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

const client = axios.create({
  baseURL: API_BASE,
  timeout: 180000,
})

/**
 * 上传错题图片，返回结构化诊断结果
 * @param {File} file
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function diagnoseImage(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post('/api/diagnose', form)
  return data
}

/** 健康检查，用于前端判断后端是否可用 */
export async function healthCheck() {
  const { data } = await client.get('/api/health')
  return data
}

/**
 * 自测判分：把「题目 + 标准答案 + 用户作答」交给后端，由模型判定对错
 * @param {{question: string, correct_answer: string, user_answer: string}} payload
 * @returns {Promise<{success: boolean, data?: {verdict: string, comment: string, key_mistake: string}, error?: string}>}
 */
export async function judgeAnswer(payload) {
  const { data } = await client.post('/api/judge', payload, { timeout: 120000 })
  return data
}
