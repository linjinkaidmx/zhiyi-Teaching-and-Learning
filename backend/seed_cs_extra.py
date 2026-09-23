# 计算机模块补充 2 题（补齐到 70 道）
SEED = [
  {
    "subject": "数据结构与算法", "question_type": "分析题",
    "question": r"比较红黑树与 AVL 树的异同，说明各自适用的场景。",
    "answer": r"共同点：都是自平衡二叉搜索树，查找/插入/删除均为 $O(\log n)$。差异：AVL 要求任意结点左右子树高度差 ≤1（严格平衡），红黑树只要求「从根到叶的最长路径不超过最短路径的 2 倍」（弱平衡，用颜色标记维持）。",
    "key_breakthrough": r"核心权衡：**AVL 更平衡 → 查找更快；红黑树旋转更少 → 插入删除更快**。AVL 是「查多改少」的首选（如数据库索引），红黑树是「频繁增删」的首选（如 Java TreeMap、Linux 内核、C++ STL 的 map/set）。",
    "knowledge_points": ["红黑树", "AVL树", "自平衡", "旋转", "工程选型"],
    "knowledge_review": r"红黑树的五条性质：① 每个结点非红即黑；② 根是黑的；③ 所有叶子（NIL）是黑的；④ 红结点不能有红孩子（不能连续红）；⑤ 从任一结点到其所有后代 NIL 的简单路径上，黑结点数目相同（黑高一致）。由性质 ④⑤ 可推出最长路径 ≤ 2×最短路径，保证树高 $O(\log n)$。插入删除时通过变色和旋转（最多 3 次旋转/插入、3 次/删除）恢复性质。AVL 以平衡因子（|左高-右高|≤1）维持更严格的平衡，树高更矮（约 1.44 log n），查找略快，但插入删除可能需 $O(\log n)$ 次旋转（自底向上）。工程选型：查找密集用 AVL；插入删除频繁用红黑树（实际标准库多用红黑树）。易错点：红黑树的「黑高」概念；红黑树不是严格平衡（最坏树高是 AVL 的约 2 倍）。",
    "extensions": [r"为什么 C++ STL 的 map 用红黑树而不用 AVL？", r"红黑树插入最多需要几次旋转？与 AVL 相比如何？"],
  },
  {
    "subject": "C语言程序设计", "question_type": "编程题",
    "question": r"实现 strlen 函数（求字符串长度，不含结尾的 '\0'），要求不用标准库。",
    "answer": r"```c\nsize_t my_strlen(const char *s) {\n    size_t n = 0;\n    while (s[n] != '\\0') n++;\n    return n;\n}\n```\n或用指针版：`const char *p = s; while (*p) p++; return p - s;`",
    "key_breakthrough": r"两种写法：下标版（直观）和指针版（高效，`p - s` 直接得到长度，利用指针相减得元素个数）。注意返回类型是 `size_t`（无符号）而非 int，且参数用 `const char*` 表示不修改源串。",
    "knowledge_points": ["字符串", "strlen实现", "指针运算", "const", "size_t"],
    "knowledge_review": r"C 字符串以 '\0' 结尾，长度 = 从头到 '\0' 之前的字符数。实现要点：① 循环条件是「当前字符非 '\0'」（`while (*p)` 利用了 '\0' 的 ASCII 值为 0，在条件中为假）；② 指针相减 `p - s` 得到的是元素个数（不是字节数，因为指针类型已知）；③ 返回 size_t（`typedef unsigned long`，定义在 string.h/stddef.h）；④ 参数加 const 表示只读，提高安全性。标准库 strlen 的时间复杂度是 O(n)（每次调用都遍历），因此**在循环中反复调用 strlen 是常见性能陷阱**（应提前保存长度）。易错点：忘记 '\0' 不计入长度；把指针相减当成字节差（对 char* 恰好相等，但其他类型不等）。",
    "extensions": [r"说明 `for (int i=0; i<strlen(s); i++)` 的性能问题及改法。", r"实现 strcpy 并说明为何要处理内存重叠（strncpy/memmove）。"],
  },
]
