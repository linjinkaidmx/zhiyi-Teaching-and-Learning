/**
 * AI 学情建议 · Mock（MOCK.analysis = true 时使用）
 * 后端未配置 Key 或离线开发时给出**结构相同的演示内容**，不假装真实分析。
 */
export async function analyzeMock(summary) {
  const pts = (summary && summary.points) || []
  const top = pts[0] || { name: '（暂无明显薄弱点）', quiz: 0, correct: 0 }
  return {
    weak_points: [
      {
        name: top.name,
        why: `练习 ${top.quiz || 0} 次、答对 ${top.correct || 0} 次，是当前错题里最需要补的一块（演示数据）`,
        advice: '先把该知识点的基本题型各做 2 道，再回到错题重做；做完用自己的话复述一遍思路。',
      },
    ],
    reason_advice: [
      { type: '计算失误（演示）', advice: '完成后单独留 30 秒回代验证关键一步。' },
    ],
    summary: '这是演示建议：真实分析会依据你的错题分布给出具体优先级与做法。',
    generatedAt: Date.now(),
    demo: true,
  }
}
