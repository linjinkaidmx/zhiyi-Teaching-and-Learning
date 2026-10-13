/**
 * 预置同类题题库
 * 字段说明：
 *  - knowledge_points: 关联知识点，用于和诊断结果做匹配
 *  - difficulty: 基础 / 进阶 / 挑战（推荐时难度递进）
 *  - target_errors: 该题容易强化训练的错因类型（可选）
 *
 * 分两部分：
 *  - HAND_BANK：手工精编题（id 1-18）
 *  - GEN_BANK：AI 离线预生成题（见 questionBankGen.js，id 1000+，已抽检）
 */
import { GEN_BANK } from './questionBankGen'

const HAND_BANK = [
  // 高等数学 · 微分方程
  {
    id: 1,
    subject: '高等数学',
    knowledge_points: ['二阶常系数齐次线性微分方程', '特征方程法'],
    difficulty: '基础',
    question: "求微分方程 y'' - 5y' + 6y = 0 的通解",
    hint: '写出特征方程 r² - 5r + 6 = 0，因式分解求根',
    answer: 'y = C₁e^(2x) + C₂e^(3x)',
    target_errors: ['计算失误'],
  },
  {
    id: 2,
    subject: '高等数学',
    knowledge_points: ['二阶常系数齐次线性微分方程', '特征方程法'],
    difficulty: '进阶',
    question: "求微分方程 y'' + 4y' + 4y = 0 的通解（注意重根情形）",
    hint: '判别式为 0 时，重根 r 对应 (C₁ + C₂x)e^(rx)',
    answer: 'y = (C₁ + C₂x)e^(-2x)',
    target_errors: ['方法错误', '知识盲区'],
  },
  {
    id: 3,
    subject: '高等数学',
    knowledge_points: ['二阶常系数齐次线性微分方程', '特征方程法'],
    difficulty: '挑战',
    question: "求微分方程 y'' - 2y' + 5y = 0 的通解（共轭复根情形）",
    hint: '复根 α ± βi 对应 e^(αx)(C₁cos βx + C₂sin βx)',
    answer: 'y = e^x(C₁cos 2x + C₂sin 2x)',
    target_errors: ['知识盲区'],
  },
  {
    id: 4,
    subject: '高等数学',
    knowledge_points: ['二阶常系数非齐次线性微分方程'],
    difficulty: '进阶',
    question: "求微分方程 y'' - 3y' + 2y = e^x 的一个特解形式",
    hint: '注意 e^x 的指数系数 1 是特征根，需乘以 x',
    answer: '特解形式为 y* = Axe^x',
    target_errors: ['方法错误'],
  },
  {
    id: 5,
    subject: '高等数学',
    knowledge_points: ['一阶线性微分方程'],
    difficulty: '基础',
    question: "求微分方程 y' + 2y = 0 的通解",
    hint: '分离变量或直接用一阶齐次公式',
    answer: 'y = Ce^(-2x)',
    target_errors: ['计算失误'],
  },

  // 高等数学 · 极限与导数
  {
    id: 6,
    subject: '高等数学',
    knowledge_points: ['极限计算', '洛必达法则'],
    difficulty: '基础',
    question: '求极限 lim(x→0) sin x / x',
    hint: '两个重要极限之一，或洛必达法则',
    answer: '1',
    target_errors: ['概念理解错误'],
  },
  {
    id: 7,
    subject: '高等数学',
    knowledge_points: ['极限计算', '洛必达法则'],
    difficulty: '进阶',
    question: '求极限 lim(x→∞) (1 + 1/x)^x',
    hint: '这是自然常数 e 的定义式',
    answer: 'e',
    target_errors: ['概念理解错误', '知识盲区'],
  },
  {
    id: 8,
    subject: '高等数学',
    knowledge_points: ['导数运算', '复合函数求导'],
    difficulty: '基础',
    question: '求 y = sin(2x + 1) 的导数',
    hint: '链式法则：外层导数乘内层导数',
    answer: "y' = 2cos(2x + 1)",
    target_errors: ['计算失误'],
  },
  {
    id: 9,
    subject: '高等数学',
    knowledge_points: ['导数运算', '复合函数求导'],
    difficulty: '进阶',
    question: '求 y = x² · e^x 的导数',
    hint: '乘积法则：(uv)\' = u\'v + uv\'',
    answer: "y' = e^x(x² + 2x)",
    target_errors: ['计算失误', '方法错误'],
  },

  // 线性代数
  {
    id: 10,
    subject: '线性代数',
    knowledge_points: ['矩阵特征值', '特征多项式'],
    difficulty: '基础',
    question: '求矩阵 A = [[2,0],[0,3]] 的特征值',
    hint: '对角矩阵的特征值就是主对角线元素',
    answer: 'λ₁ = 2，λ₂ = 3',
    target_errors: ['概念理解错误'],
  },
  {
    id: 11,
    subject: '线性代数',
    knowledge_points: ['矩阵特征值', '特征多项式'],
    difficulty: '进阶',
    question: '求矩阵 A = [[1,2],[2,1]] 的特征值',
    hint: '解 |A - λI| = 0',
    answer: 'λ₁ = 3，λ₂ = -1',
    target_errors: ['计算失误'],
  },
  {
    id: 12,
    subject: '线性代数',
    knowledge_points: ['行列式计算'],
    difficulty: '基础',
    question: '计算行列式 |3 1; 2 4|',
    hint: '二阶行列式 = 主对角线积 - 副对角线积',
    answer: '10',
    target_errors: ['计算失误'],
  },

  // 概率论
  {
    id: 13,
    subject: '概率论',
    knowledge_points: ['条件概率', '贝叶斯公式'],
    difficulty: '进阶',
    question: '已知 P(A)=0.3，P(B|A)=0.5，求 P(AB)',
    hint: '乘法公式：P(AB) = P(A)·P(B|A)',
    answer: '0.15',
    target_errors: ['概念理解错误'],
  },

  // 程序设计 / 数据结构
  {
    id: 14,
    subject: '数据结构',
    knowledge_points: ['时间复杂度分析', '算法复杂度'],
    difficulty: '基础',
    question: '分析冒泡排序的平均时间复杂度',
    hint: '两层嵌套循环，各约 n 次',
    answer: 'O(n²)',
    target_errors: ['概念理解错误'],
  },
  {
    id: 15,
    subject: '数据结构',
    knowledge_points: ['时间复杂度分析', '递归'],
    difficulty: '进阶',
    question: '分析二分查找的时间复杂度，并说明递归式',
    hint: '每次规模减半：T(n) = T(n/2) + O(1)',
    answer: 'O(log n)',
    target_errors: ['方法错误'],
  },
  {
    id: 16,
    subject: '数据结构',
    knowledge_points: ['递归', '栈'],
    difficulty: '挑战',
    question: '递归求 n! 时，若 n 很大会导致什么问题？如何优化？',
    hint: '考虑调用栈深度与重复计算',
    answer: '可能栈溢出；可改用迭代或尾递归/记忆化',
    target_errors: ['知识盲区'],
  },
  {
    id: 17,
    subject: '计算机网络',
    knowledge_points: ['TCP 三次握手'],
    difficulty: '基础',
    question: '简述 TCP 三次握手的三个报文及其标志位',
    hint: 'SYN → SYN+ACK → ACK',
    answer: '第一次 SYN，第二次 SYN+ACK，第三次 ACK',
    target_errors: ['审题偏差'],
  },
  {
    id: 18,
    subject: '操作系统',
    knowledge_points: ['进程与线程', '死锁'],
    difficulty: '进阶',
    question: '产生死锁的四个必要条件是什么？',
    hint: '互斥、占有且等待、不可抢占、循环等待',
    answer: '互斥条件、请求与保持、不可剥夺、环路等待',
    target_errors: ['知识盲区'],
  },
]

export const QUESTION_BANK = [...HAND_BANK, ...GEN_BANK]

export const DIFFICULTY_ORDER = { 基础: 1, 进阶: 2, 挑战: 3 }
