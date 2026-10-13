import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 构建版本号（每次构建不同）：用于确认「用户浏览器是否加载到了最新构建」
const BUILD_ID = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

export default defineConfig({
  plugins: [vue()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5173,
  },
})
