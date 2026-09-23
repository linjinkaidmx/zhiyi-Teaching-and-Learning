/**
 * stores/ · 状态单例（P2.5 起）
 * ---------------------------------------------------------------------------
 * 已落位：
 *   bookStore.js     错题本与复习设置（src/book.js 纯逻辑 + 双空间 localStorage）
 *   sessionStore.js  登录态 / 双空间 / 云端同步 / 数据管理
 *   flowStore.js     出题讲解流程（串行讲解、合并拆分、变式题）
 *   statsStore.js    转发 → src/statsStore.js（打卡 / 连续 / 成就）
 *   profileStore.js  转发 → src/profileStore.js（个人资料与偏好）
 *
 * 为什么后两个是转发：它们已被 13 个组件引用，物理搬迁要同时改 13 处导入，
 * 现阶段收益小于风险；转发模块保证「任何路径引用都是同一个单例」。
 * P3 清理组件引用时，把实现整体搬进本文件并删除根目录旧文件。
 *
 * 依赖方向（单向，无循环）：
 *   bookStore → statsStore
 *   flowStore → statsStore
 *   sessionStore → bookStore · statsStore · profileStore · book.js(纯逻辑) · auth.js
 *   bookStore 通过 setPushHook 由 sessionStore 注入「写后同步」，避免反向依赖
 *
 * 约定：
 *   1. store 不持有页面级 UI 状态（弹窗开关、当前选中项等留在页面）
 *   2. 数据契约不变：localStorage key、字段名、后端接口一律不动
 *   3. 迁移后必须跑通：_test_stats / _test_quizpick / _test_mathtext / _test_profile
 *      / _test_routes + _smoke_app + 后端 5 套接口测试
 */
export {}
