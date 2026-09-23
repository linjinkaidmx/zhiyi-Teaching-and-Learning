// 经典算法代码模板（自建内容，零 API 成本）
// 每个模板：{ key, name, tags, lang, complexity, pitfalls, usage, code }
// 代码统一用 String.raw 书写：printf 里的 \n 才不会被 JS 转义成真换行
// 模板均为完整可编译程序（gcc -std=c99），可在页面里直接改参数运行

export const CODE_TEMPLATES = [
  {
    key: 'quicksort',
    name: '快速排序（随机基准）',
    tags: ['排序', '分治'],
    lang: 'c',
    complexity: '平均 O(n log n)，最坏 O(n²)；空间 O(log n)（递归栈）',
    pitfalls: '基准取首元素 + 数据有序 → 退化为 O(n²)，故取随机基准；递归边界是 (l,p) 与 (p+1,r)，写错会死循环',
    usage: '需要原地排序、常数小；课程手写排序的首选',
    code: String.raw`#include <stdio.h>
#include <stdlib.h>

void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }

/* 双指针分区：返回基准分界点，[l..j] 都 <= pivot，[i..r] 都 >= pivot */
int partition(int a[], int l, int r) {
    int pivot = a[l + rand() % (r - l + 1)];   /* 随机基准，避免有序数据退化 */
    int i = l, j = r;
    while (i <= j) {
        while (a[i] < pivot) i++;
        while (a[j] > pivot) j--;
        if (i <= j) { swap(&a[i], &a[j]); i++; j--; }
    }
    return j;
}

void quick_sort(int a[], int l, int r) {
    if (l >= r) return;              /* 递归出口 */
    int p = partition(a, l, r);
    quick_sort(a, l, p);
    quick_sort(a, p + 1, r);
}

int main(void) {
    int a[] = {5, 2, 9, 1, 5, 6, -3, 8};
    int n = sizeof(a) / sizeof(a[0]);
    quick_sort(a, 0, n - 1);
    for (int i = 0; i < n; i++) printf("%d ", a[i]);
    printf("\n");
    return 0;
}`,
  },
  {
    key: 'mergesort',
    name: '归并排序 + 逆序对计数',
    tags: ['排序', '分治', '逆序对'],
    lang: 'c',
    complexity: 'O(n log n)；空间 O(n)（辅助数组）',
    pitfalls: '合并时用 <= 才稳定；逆序对只在 a[i] > a[j] 时累加 a[i..mid] 的数量（mid-i+1）',
    usage: '要求稳定排序、或需要在 O(n log n) 内统计逆序对/求「左侧比它大的个数」',
    code: String.raw`#include <stdio.h>

int tmp[100005];
long long inv = 0;                    /* 逆序对数量 */

void merge_sort(int a[], int l, int r) {
    if (l >= r) return;
    int m = (l + r) / 2;
    merge_sort(a, l, m);
    merge_sort(a, m + 1, r);

    int i = l, j = m + 1, k = l;
    while (i <= m && j <= r) {
        if (a[i] <= a[j]) tmp[k++] = a[i++];        /* <= 保证稳定 */
        else { tmp[k++] = a[j++]; inv += m - i + 1; }  /* a[i..m] 全都 > a[j] */
    }
    while (i <= m) tmp[k++] = a[i++];
    while (j <= r) tmp[k++] = a[j++];
    for (int t = l; t <= r; t++) a[t] = tmp[t];
}

int main(void) {
    int a[] = {5, 2, 9, 1, 5, 6};
    int n = 6;
    merge_sort(a, 0, n - 1);
    for (int i = 0; i < n; i++) printf("%d ", a[i]);
    printf("\n逆序对 = %lld\n", inv);     /* 应为 6 */
    return 0;
}`,
  },
  {
    key: 'binarysearch',
    name: '二分查找（三种边界写法）',
    tags: ['查找', '二分'],
    lang: 'c',
    complexity: 'O(log n)',
    pitfalls: '死循环根源：区间开闭没写对。记住「找值用闭区间 l<=r，找边界用左闭右开 l<r」；mid 用 l+(r-l)/2 防溢出',
    usage: '有序数组找值、找第一个 ≥ x（lower_bound）、找最后一个 ≤ x',
    code: String.raw`#include <stdio.h>

/* 1) 找等于 x 的下标，找不到返回 -1（闭区间写法） */
int find(int a[], int n, int x) {
    int l = 0, r = n - 1;
    while (l <= r) {
        int m = l + (r - l) / 2;
        if (a[m] == x) return m;
        if (a[m] < x) l = m + 1;
        else r = m - 1;
    }
    return -1;
}

/* 2) 第一个 >= x 的位置（下界，左闭右开写法，返回 [0, n]） */
int lower_bound_(int a[], int n, int x) {
    int l = 0, r = n;
    while (l < r) {
        int m = l + (r - l) / 2;
        if (a[m] >= x) r = m;         /* m 可能就是答案，保留 */
        else l = m + 1;
    }
    return l;
}

/* 3) 第一个 > x 的位置；把它减 1 就是「最后一个 <= x」 */
int upper_bound_(int a[], int n, int x) {
    int l = 0, r = n;
    while (l < r) {
        int m = l + (r - l) / 2;
        if (a[m] > x) r = m;
        else l = m + 1;
    }
    return l;
}

int main(void) {
    int a[] = {1, 3, 3, 5, 7, 9};
    int n = 6;
    printf("find(5) = %d, find(4) = %d\n", find(a, n, 5), find(a, n, 4));
    printf("第一个 >= 3 的位置 = %d\n", lower_bound_(a, n, 3));
    printf("第一个 > 3 的位置 = %d，故最后一个 <= 3 的位置 = %d\n",
           upper_bound_(a, n, 3), upper_bound_(a, n, 3) - 1);
    return 0;
}`,
  },
  {
    key: 'binaryanswer',
    name: '二分答案（整数 + 浮点）',
    tags: ['二分', '最值'],
    lang: 'c',
    complexity: 'O(log(值域) × 判定代价)',
    pitfalls: '必须先确认「单调性」：判定函数 ok(x) 随 x 的变化必须是单调的；浮点二分固定迭代 100 次比 while(r-l>eps) 更稳',
    usage: '「最大化最小值 / 最小化最大值」类问题（切木棍、分蛋糕、跳石头、装载问题）',
    code: String.raw`#include <stdio.h>

/* 例：n 根木棍切成「至少 k 段」，求每段的最大长度（整数二分答案） */
int n = 5, k = 7;
int L[5] = {10, 12, 8, 20, 15};

int ok(int x) {                       /* 每段长 x 时能否切出 >= k 段（单调：x 越小越容易满足） */
    if (x <= 0) return 1;
    int s = 0;
    for (int i = 0; i < n; i++) s += L[i] / x;
    return s >= k;
}

int main(void) {
    int l = 1, r = 20, ans = 0;
    while (l <= r) {
        int m = l + (r - l) / 2;
        if (ok(m)) { ans = m; l = m + 1; }   /* 可行 → 试更大的 */
        else r = m - 1;
    }
    printf("最大长度 = %d\n", ans);          /* 应为 7 */

    /* 浮点二分：求 sqrt(2)，固定迭代 100 次 */
    double lo = 0, hi = 2;
    for (int i = 0; i < 100; i++) {
        double mid = (lo + hi) / 2;
        if (mid * mid < 2) lo = mid; else hi = mid;
    }
    printf("sqrt(2) ≈ %.15f\n", lo);
    return 0;
}`,
  },
  {
    key: 'prefixdiff',
    name: '前缀和与差分',
    tags: ['前缀和', '差分', '技巧'],
    lang: 'c',
    complexity: '预处理 O(n)，区间查询/区间加 O(1)',
    pitfalls: '统一用 1-based 存数据；差分还原必须从前往后累加；二维差分四个角要加减成对',
    usage: '多次区间求和（前缀和）／多次区间整体加减最后统一查询（差分）',
    code: String.raw`#include <stdio.h>

long long pre[100005];     /* 前缀和：区间和 O(1) */
int diff[100005];          /* 差分：区间加 O(1)，最后一遍前缀和还原 */

int main(void) {
    int a[6] = {0, 3, 1, 4, 1, 5};      /* 下标从 1 开始，a[0] 不用 */
    int n = 5;
    for (int i = 1; i <= n; i++) pre[i] = pre[i - 1] + a[i];

    int l = 2, r = 4;
    printf("a[%d..%d] 的和 = %lld\n", l, r, pre[r] - pre[l - 1]);   /* 9 */

    /* 给 [2,4] 每个元素 +10，给 [1,3] 每个元素 -2 */
    diff[2] += 10; diff[5] -= 10;      /* 区间加：左端点 +c，右端点+1 处 -c */
    diff[1] -= 2;  diff[4] += 2;
    for (int i = 1; i <= n; i++) diff[i] += diff[i - 1];   /* 还原增量 */
    for (int i = 1; i <= n; i++) printf("%d ", a[i] + diff[i]);
    printf("\n");                       /* 应为 1 9 12 11 5 */
    return 0;
}`,
  },
  {
    key: 'slidewindow',
    name: '双指针 / 滑动窗口',
    tags: ['双指针', '滑动窗口'],
    lang: 'c',
    complexity: 'O(n)（左右指针各走一遍，均摊）',
    pitfalls: '窗口收缩条件写成 if 还是 while，取决于题目要求「恰好」还是「最长」；注意左指针只能右移、不能回退',
    usage: '「最长/最短满足条件的连续子数组」类问题（无重复子串、和 ≥ target 的最短长度）',
    code: String.raw`#include <stdio.h>
#include <string.h>

/* 最长无重复字符子串：last[c] 记录字符 c 上次出现的位置 */
int main(void) {
    char s[] = "abcabcbb";
    int last[256];
    memset(last, -1, sizeof(last));

    int n = strlen(s), best = 0, start = 0;
    for (int i = 0; i < n; i++) {
        int c = (unsigned char)s[i];
        if (last[c] >= start) start = last[c] + 1;   /* 出现重复：左边界跳到重复字符之后 */
        last[c] = i;
        if (i - start + 1 > best) best = i - start + 1;
    }
    printf("最长无重复子串长度 = %d\n", best);       /* 3 */
    return 0;
}`,
  },
  {
    key: 'dfs-backtrack',
    name: 'DFS 回溯（全排列 + 剪枝）',
    tags: ['DFS', '回溯', '搜索'],
    lang: 'c',
    complexity: '全排列 O(n!)，剪枝后远小于此',
    pitfalls: '「恢复现场」必须与递归调用成对出现，漏掉会让后续分支拿不到元素；剪枝条件写错是隐性超时主因',
    usage: '求所有方案（全排列、子集、n 皇后、数独、组合总和）',
    code: String.raw`#include <stdio.h>
#include <string.h>

int n = 3, used[10], path[10];

void dfs(int depth) {
    if (depth == n) {                       /* 到达叶子：输出一个完整方案 */
        for (int i = 0; i < n; i++) printf("%d", path[i]);
        printf("\n");
        return;
    }
    for (int v = 1; v <= n; v++) {
        if (used[v]) continue;              /* 剪枝：已用过的不能再选 */
        used[v] = 1;                        /* 做选择 */
        path[depth] = v;
        dfs(depth + 1);                     /* 进入下一层 */
        used[v] = 0;                        /* 撤销选择（回溯） */
    }
}

int main(void) {
    memset(used, 0, sizeof(used));
    dfs(0);
    return 0;          /* 输出 123 132 213 231 312 321 共 6 个 */
}`,
  },
  {
    key: 'bfs',
    name: 'BFS（网格最短路）',
    tags: ['BFS', '最短路'],
    lang: 'c',
    complexity: 'O(V + E)；网格上即 O(nm)',
    pitfalls: '入队时就要标记 visited（不是出队时），否则同一格会重复入队导致超时/内存爆；BFS 只保证边权为 1 时是最短路',
    usage: '无权图/网格的「最少步数」，层序遍历，多源扩散（腐烂的橘子、岛屿数量变体）',
    code: String.raw`#include <stdio.h>
#include <string.h>

#define N 5
char g[N][N + 1] = {
    ".S...",
    ".##..",
    ".....",
    ".##..",
    "...E.",
};
int dist[N][N];
int qx[N * N], qy[N * N];
int dx[4] = {-1, 1, 0, 0}, dy[4] = {0, 0, -1, 1};

int main(void) {
    memset(dist, -1, sizeof(dist));
    int sx = 0, sy = 1, ex = 4, ey = 3;
    int head = 0, tail = 0;

    qx[tail] = sx; qy[tail] = sy; tail++;
    dist[sx][sy] = 0;

    while (head < tail) {                    /* 队列：一层一层向外扩 */
        int x = qx[head], y = qy[head]; head++;
        if (x == ex && y == ey) break;
        for (int d = 0; d < 4; d++) {
            int nx = x + dx[d], ny = y + dy[d];
            if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
            if (g[nx][ny] == '#' || dist[nx][ny] != -1) continue;
            dist[nx][ny] = dist[x][y] + 1;
            qx[tail] = nx; qy[tail] = ny; tail++;   /* 入队即标记 */
        }
    }
    printf("最短步数 = %d\n", dist[ex][ey]);      /* 6 */
    return 0;
}`,
  },
  {
    key: 'dsu',
    name: '并查集（路径压缩 + 按秩合并）',
    tags: ['并查集', '图'],
    lang: 'c',
    complexity: '近 O(1)（阿克曼反函数 α(n)）',
    pitfalls: 'find 里路径压缩要沿链改父指针；合并必须按秩/按大小，否则退化成链；删边问题不能直接用并查集',
    usage: '连通性判定、Kruskal 求最小生成树、朋友圈/亲戚问题、判环',
    code: String.raw`#include <stdio.h>

int fa[100005], rnk[100005];

void init(int n) { for (int i = 1; i <= n; i++) { fa[i] = i; rnk[i] = 0; } }

int find(int x) {                       /* 路径压缩（迭代写法，避免深递归） */
    int root = x;
    while (fa[root] != root) root = fa[root];
    while (fa[x] != root) { int nxt = fa[x]; fa[x] = root; x = nxt; }
    return root;
}

void unite(int a, int b) {               /* 按秩合并 */
    int ra = find(a), rb = find(b);
    if (ra == rb) return;
    if (rnk[ra] < rnk[rb]) { int t = ra; ra = rb; rb = t; }
    fa[rb] = ra;
    if (rnk[ra] == rnk[rb]) rnk[ra]++;
}

int main(void) {
    init(6);
    unite(1, 2); unite(2, 3); unite(5, 6);
    printf("1 和 3 同集合? %s\n", find(1) == find(3) ? "是" : "否");   /* 是 */
    printf("1 和 5 同集合? %s\n", find(1) == find(5) ? "是" : "否");   /* 否 */
    int cnt = 0;
    for (int i = 1; i <= 6; i++) if (find(i) == i) cnt++;
    printf("集合个数 = %d\n", cnt);                                    /* 3 */
    return 0;
}`,
  },
  {
    key: 'dijkstra',
    name: 'Dijkstra 最短路（堆优化）',
    tags: ['图', '最短路', '堆'],
    lang: 'c',
    complexity: 'O((V + E) log V)',
    pitfalls: '不能处理负权边（负权用 Bellman-Ford/SPFA）；用「懒删除」出堆时才判断 done，不要在入堆时去重',
    usage: '单源最短路、边权非负（地图导航、费用最小路径）',
    code: String.raw`#include <stdio.h>
#include <string.h>

#define MAXN 1005
#define MAXM 20005

int head[MAXN], nxt[MAXM], to[MAXM], wt[MAXM], ecnt;
void add(int u, int v, int w) { to[ecnt] = v; wt[ecnt] = w; nxt[ecnt] = head[u]; head[u] = ecnt++; }

/* 手写小顶堆：hd 存距离，hv 存顶点（教学演示，实际用 priority_queue） */
int hd[MAXN], hv[MAXN], hn;

void push(int d, int v) {
    int i = ++hn;
    while (i > 1 && hd[i / 2] > d) { hd[i] = hd[i / 2]; hv[i] = hv[i / 2]; i /= 2; }
    hd[i] = d; hv[i] = v;
}

int pop(int *d, int *v) {
    if (hn == 0) return 0;
    *d = hd[1]; *v = hv[1];
    int lastd = hd[hn], lastv = hv[hn];
    hn--;
    int i = 1;
    while (i * 2 <= hn) {
        int c = i * 2;
        if (c + 1 <= hn && hd[c + 1] < hd[c]) c++;
        if (hd[c] >= lastd) break;
        hd[i] = hd[c]; hv[i] = hv[c]; i = c;
    }
    if (hn > 0) { hd[i] = lastd; hv[i] = lastv; }
    return 1;
}

int dist[MAXN], done[MAXN];

void dijkstra(int s) {
    memset(dist, 0x3f, sizeof(dist));
    memset(done, 0, sizeof(done));
    hn = 0;
    dist[s] = 0;
    push(0, s);
    while (hn) {
        int d, u;
        pop(&d, &u);
        if (done[u]) continue;            /* 过期条目，跳过 */
        done[u] = 1;
        for (int e = head[u]; e != -1; e = nxt[e]) {
            int v = to[e];
            if (dist[u] + wt[e] < dist[v]) {   /* 松弛 */
                dist[v] = dist[u] + wt[e];
                push(dist[v], v);
            }
        }
    }
}

int main(void) {
    memset(head, -1, sizeof(head));
    add(1, 2, 2); add(1, 3, 5); add(2, 3, 1);
    add(2, 4, 4); add(3, 4, 1); add(4, 5, 3);
    dijkstra(1);
    for (int i = 2; i <= 5; i++) printf("1 -> %d : %d\n", i, dist[i]);
    return 0;      /* 2 3 4 7 */
}`,
  },
  {
    key: 'toposort',
    name: '拓扑排序（Kahn）',
    tags: ['图', 'DAG', '拓扑'],
    lang: 'c',
    complexity: 'O(V + E)',
    pitfalls: '入度表要按边初始化；输出序列长度 < n 说明有环；**输出顺序不唯一**（与建边/邻接表顺序有关，只要满足所有先后约束即可），要固定顺序就换成优先队列',
    usage: '任务调度/课程先修、判断有向图有无环、DAG 上 DP 定序',
    code: String.raw`#include <stdio.h>
#include <string.h>

#define MAXN 1005
#define MAXM 10005

int head[MAXN], nxt[MAXM], to[MAXM], ecnt, indeg[MAXN];
void add(int u, int v) { to[ecnt] = v; nxt[ecnt] = head[u]; head[u] = ecnt++; indeg[v]++; }

int main(void) {
    memset(head, -1, sizeof(head));
    /* 先修关系：1->2, 1->3, 2->4, 3->4, 4->5, 3->6 */
    add(1, 2); add(1, 3); add(2, 4); add(3, 4); add(4, 5); add(3, 6);

    int n = 6, q[MAXN], front = 0, tail = 0;
    for (int i = 1; i <= n; i++) if (indeg[i] == 0) q[tail++] = i;   /* 入度为 0 的入队 */

    int cnt = 0;
    while (front < tail) {
        int u = q[front++];
        cnt++;
        printf("%d ", u);
        for (int e = head[u]; e != -1; e = nxt[e]) {
            int v = to[e];
            if (--indeg[v] == 0) q[tail++] = v;      /* 入度归零即可排 */
        }
    }
    printf("\n%s\n", cnt == n ? "是 DAG，排序完成" : "存在环，无法拓扑排序");
    return 0;
}`,
  },
  {
    key: 'knapsack',
    name: '背包 DP（0-1 / 完全 / 恰好装满）',
    tags: ['DP', '背包'],
    lang: 'c',
    complexity: 'O(nW) 时间，O(W) 空间（滚动数组）',
    pitfalls: '0-1 背包体积必须倒序（否则同一件被用多次）；完全背包正序；「恰好装满」把 dp 初始化为 -INF、dp[0]=0',
    usage: '选或不选的最优值问题（装箱、预算分配、零钱兑换、凑数）',
    code: String.raw`#include <stdio.h>
#include <string.h>

int max(int a, int b) { return a > b ? a : b; }

int main(void) {
    int n = 4, W = 10;
    int w[5] = {0, 2, 3, 4, 7};      /* 下标 1 开始：体积 */
    int v[5] = {0, 3, 4, 5, 9};      /* 价值 */
    int dp[1005];

    /* 0-1 背包：每件最多一件 → 体积倒序 */
    memset(dp, 0, sizeof(dp));
    for (int i = 1; i <= n; i++)
        for (int j = W; j >= w[i]; j--)
            dp[j] = max(dp[j], dp[j - w[i]] + v[i]);
    printf("0-1 背包最大价值 = %d\n", dp[W]);          /* 13 */
    int best01 = dp[W];

    /* 完全背包：每件无限件 → 体积正序 */
    memset(dp, 0, sizeof(dp));
    for (int i = 1; i <= n; i++)
        for (int j = w[i]; j <= W; j++)
            dp[j] = max(dp[j], dp[j - w[i]] + v[i]);
    printf("完全背包最大价值 = %d\n", dp[W]);          /* 15 */

    /* 恰好装满：dp 初值 -INF（表示不可达），dp[0] = 0 */
    const int NEG = -1000000000;
    for (int j = 0; j <= W; j++) dp[j] = NEG;
    dp[0] = 0;
    for (int i = 1; i <= n; i++)
        for (int j = W; j >= w[i]; j--)
            if (dp[j - w[i]] != NEG) dp[j] = max(dp[j], dp[j - w[i]] + v[i]);
    if (dp[W] == NEG) printf("恰好装满：无解\n");
    else printf("恰好装满最大价值 = %d（不要求装满时为 %d）\n", dp[W], best01);
    return 0;
}`,
  },
  {
    key: 'lis',
    name: '最长上升子序列 LIS（O(n log n)）',
    tags: ['DP', '二分', '贪心'],
    lang: 'c',
    complexity: 'O(n log n)（贪心 + 二分维护 tails）',
    pitfalls: 'tails[k] 的含义是「长度 k+1 的子序列的最小结尾」，不是最终答案序列本身；严格上升用 >= 找下界，非严格改 >',
    usage: 'LIS 长度、导弹拦截（最长不上升子序列）、套信封问题',
    code: String.raw`#include <stdio.h>

int tails[100005];    /* tails[k] = 长度 k+1 的上升子序列的最小结尾元素 */

int main(void) {
    int a[] = {10, 9, 2, 5, 3, 7, 101, 18};
    int n = 8, len = 0;
    for (int i = 0; i < n; i++) {
        int x = a[i];
        int l = 0, r = len;                 /* 在 tails[0, len) 中找第一个 >= x */
        while (l < r) {
            int m = l + (r - l) / 2;
            if (tails[m] >= x) r = m; else l = m + 1;
        }
        tails[l] = x;                       /* 替换掉第一个 >= x 的元素 */
        if (l == len) len++;                /* 扩展了长度 */
    }
    printf("最长上升子序列长度 = %d\n", len);   /* 4：2 3 7 101 */
    return 0;
}`,
  },
  {
    key: 'lcs',
    name: '最长公共子序列 LCS',
    tags: ['DP', '字符串'],
    lang: 'c',
    complexity: 'O(nm) 时间，O(nm) 空间（可滚动到 O(min(n,m))）',
    pitfalls: 'dp 数组要开 n+1 × m+1 并留出第 0 行/列；比较时用 a[i-1] 与 b[j-1]（下标偏移容易错）',
    usage: '字符串相似度、diff 算法、最短编辑距离的前置',
    code: String.raw`#include <stdio.h>
#include <string.h>

int dp[1005][1005];

int main(void) {
    char a[] = "ABCBDAB", b[] = "BDCABA";
    int n = strlen(a), m = strlen(b);

    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++) {
            if (a[i - 1] == b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
            else dp[i][j] = dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1];
        }

    printf("最长公共子序列长度 = %d\n", dp[n][m]);   /* 4 */
    return 0;
}`,
  },
  {
    key: 'editdist',
    name: '编辑距离（Levenshtein）',
    tags: ['DP', '字符串'],
    lang: 'c',
    complexity: 'O(nm)',
    pitfalls: '边界 dp[i][0]=i、dp[0][j]=j 不能漏；三种操作取最小（删除/插入/替换）',
    usage: '拼写纠错、相似度、DNA 比对、模糊匹配',
    code: String.raw`#include <stdio.h>
#include <string.h>

int dp[505][505];
int min3(int a, int b, int c) { int t = a < b ? a : b; return t < c ? t : c; }

int main(void) {
    char a[] = "kitten", b[] = "sitting";
    int n = strlen(a), m = strlen(b);

    for (int i = 0; i <= n; i++) dp[i][0] = i;   /* 全删 */
    for (int j = 0; j <= m; j++) dp[0][j] = j;   /* 全插 */

    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++) {
            if (a[i - 1] == b[j - 1]) dp[i][j] = dp[i - 1][j - 1];   /* 相同不用操作 */
            else dp[i][j] = min3(dp[i - 1][j] + 1,      /* 删除 a[i-1] */
                                 dp[i][j - 1] + 1,      /* 插入 b[j-1] */
                                 dp[i - 1][j - 1] + 1); /* 替换 */
        }

    printf("编辑距离 = %d\n", dp[n][m]);   /* 3 */
    return 0;
}`,
  },
  {
    key: 'kmp',
    name: 'KMP 字符串匹配',
    tags: ['字符串', '匹配'],
    lang: 'c',
    complexity: 'O(n + m)',
    pitfalls: 'next[0] = -1 的写法里，主串指针永不回退；build_next 循环条件是 i < m-1（少写一个会越界）',
    usage: '找子串位置、求最小循环节（m - next[m]）、前缀出现次数',
    code: String.raw`#include <stdio.h>
#include <string.h>

void build_next(const char *p, int *nxt) {
    int m = strlen(p);
    nxt[0] = -1;
    int i = 0, k = -1;
    while (i < m - 1) {
        if (k == -1 || p[i] == p[k]) nxt[++i] = ++k;
        else k = nxt[k];                 /* 回退到更短的前缀 */
    }
}

/* 返回首次匹配的下标，失败返回 -1 */
int kmp(const char *s, const char *p) {
    int n = strlen(s), m = strlen(p), nxt[1005];
    build_next(p, nxt);
    int i = 0, j = 0;
    while (i < n && j < m) {
        if (j == -1 || s[i] == p[j]) { i++; j++; }
        else j = nxt[j];                 /* 失配：模式串滑动，主串不回退 */
    }
    return j == m ? i - m : -1;
}

int main(void) {
    printf("ababcabcacbab 中 abcac 首次出现在下标 %d\n", kmp("ababcabcacbab", "abcac"));
    printf("aaaaa 中 baa 的结果 = %d\n", kmp("aaaaa", "baa"));
    return 0;      /* 5 与 -1 */
}`,
  },
  {
    key: 'fastpow',
    name: '快速幂 / 快速幂取模',
    tags: ['数论', '位运算'],
    lang: 'c',
    complexity: 'O(log b)',
    pitfalls: '底数先取模；乘法可能溢出（long long 内 a*a 需 < 9.2e18，模数很大时要用 __int128）；指数为 0 时结果 1',
    usage: '大指数幂取模、矩阵快速幂加速递推（斐波那契）、费马小定理求逆元',
    code: String.raw`#include <stdio.h>

long long pow_mod(long long a, long long b, long long mod) {
    long long r = 1 % mod;
    a %= mod;
    while (b) {
        if (b & 1) r = r * a % mod;      /* 当前二进制位是 1 → 乘进结果 */
        a = a * a % mod;                 /* 底数平方 */
        b >>= 1;                         /* 指数右移一位 */
    }
    return r;
}

int main(void) {
    long long MOD = 1000000007;
    printf("2^10 = %lld\n", pow_mod(2, 10, MOD));
    printf("2^100 mod 1e9+7 = %lld\n", pow_mod(2, 100, MOD));
    printf("3^0 mod 1000 = %lld\n", pow_mod(3, 0, 1000));
    /* 费马小定理：mod 为素数时 a^{mod-2} 即 a 的逆元 */
    printf("3 在模 1e9+7 下的逆元 = %lld\n", pow_mod(3, MOD - 2, MOD));
    return 0;
}`,
  },
  {
    key: 'monostack',
    name: '单调栈（下一个更大元素）',
    tags: ['栈', '单调栈'],
    lang: 'c',
    complexity: 'O(n)（每个元素最多进出栈一次）',
    pitfalls: '「找右边更大」要倒序遍历；弹栈条件是 <= 还是 < 决定重复元素处理方式；栈里存下标才能算距离/宽度',
    usage: '下一个更大/更小元素、柱状图最大矩形、接雨水、滑动窗口最大值（单调队列）',
    code: String.raw`#include <stdio.h>

int st[100005], top;      /* 单调栈：存元素值；若要算宽度改成存下标 */
int ans[100005];

int main(void) {
    int a[] = {3, 1, 4, 2, 5};
    int n = 5;

    for (int i = n - 1; i >= 0; i--) {          /* 从右往左扫 */
        while (top && st[top - 1] <= a[i]) top--;   /* 弹出比当前小的：它们不可能是答案 */
        ans[i] = top ? st[top - 1] : -1;            /* 栈顶就是右边第一个更大的 */
        st[top++] = a[i];
    }

    for (int i = 0; i < n; i++)
        printf("a[%d] = %d，右边第一个更大的是 %d\n", i, a[i], ans[i]);
    return 0;      /* 4 4 5 5 -1 */
}`,
  },
  {
    key: 'travtree',
    name: '二叉树遍历（前中后序非递归 + 层序）',
    tags: ['树', '遍历', '栈'],
    lang: 'c',
    complexity: 'O(n)；空间 O(h)（h 为树高）',
    pitfalls: '前序压栈要「先右后左」才能先访问左子树；后序非递归需 last 记录上次访问节点，判断右子树是否已处理',
    usage: '树的遍历输出、非递归改写（机试常考）、层序求树宽/深度',
    code: String.raw`#include <stdio.h>

/* 用完全二叉树数组存：节点 i 的左孩子 2i、右孩子 2i+1（下标 0 不用） */
int tree[16] = {0, 1, 2, 3, 4, 5, 6, 7};
int n = 7;
int st[64];

void preorder(void) {                     /* 根 左 右 */
    int top = 0;
    st[top++] = 1;
    while (top) {
        int u = st[--top];
        if (u > n) continue;
        printf("%d ", tree[u]);
        if (2 * u + 1 <= n) st[top++] = 2 * u + 1;   /* 先压右 */
        if (2 * u <= n) st[top++] = 2 * u;           /* 再压左 */
    }
}

void inorder(void) {                      /* 左 根 右 */
    int top = 0, u = 1;
    while (top || u <= n) {
        while (u <= n) { st[top++] = u; u = 2 * u; }   /* 一路向左压栈 */
        u = st[--top];
        printf("%d ", tree[u]);                         /* 弹出即访问 */
        u = 2 * u + 1;                                   /* 转向右子树 */
    }
}

void postorder(void) {                    /* 左 右 根 */
    int top = 0, u = 1, last = 0;
    while (top || u <= n) {
        while (u <= n) { st[top++] = u; u = 2 * u; }
        int peek = st[top - 1];
        if (2 * peek + 1 <= n && last != 2 * peek + 1) u = 2 * peek + 1;  /* 右子树还没走 */
        else { printf("%d ", tree[peek]); top--; last = peek; }
    }
}

void levelorder(void) {                   /* 层序：队列 */
    int q[64], h = 0, t = 0;
    q[t++] = 1;
    while (h < t) {
        int u = q[h++];
        if (u > n) continue;
        printf("%d ", tree[u]);
        if (2 * u <= n) q[t++] = 2 * u;
        if (2 * u + 1 <= n) q[t++] = 2 * u + 1;
    }
}

int main(void) {
    printf("前序："); preorder(); printf("\n");      /* 1 2 4 5 3 6 7 */
    printf("中序："); inorder(); printf("\n");       /* 4 2 5 1 6 3 7 */
    printf("后序："); postorder(); printf("\n");     /* 4 5 2 6 7 3 1 */
    printf("层序："); levelorder(); printf("\n");    /* 1 2 3 4 5 6 7 */
    return 0;
}`,
  },
  {
    key: 'trie',
    name: '字典树 Trie（插入 / 前缀查询）',
    tags: ['字符串', '树'],
    lang: 'c',
    complexity: '插入/查询 O(L)（L 为串长）',
    pitfalls: '节点数上限 ≈ 所有串长度之和 + 1，开小会越界；root 用 0 表示，ch[u][c]==0 即「不存在」；小写字母才够用 26 个字母表',
    usage: '前缀检索、自动补全、单词统计、最大异或对（二进制 Trie）',
    code: String.raw`#include <stdio.h>

#define MAXN 100005
int ch[MAXN][26], cnt[MAXN], node_cnt = 1;   /* 0 号是根，ch 为 0 表示没有该儿子 */

void insert(const char *s) {
    int u = 0;
    for (int i = 0; s[i]; i++) {
        int c = s[i] - 'a';
        if (!ch[u][c]) ch[u][c] = node_cnt++;
        u = ch[u][c];
    }
    cnt[u]++;                                /* 以该节点结尾的单词数 */
}

/* 统计以 s 为前缀的单词数（只要精确匹配就返回 cnt[u]） */
int query(const char *s) {
    int u = 0;
    for (int i = 0; s[i]; i++) {
        int c = s[i] - 'a';
        if (!ch[u][c]) return 0;
        u = ch[u][c];
    }
    int stk[MAXN], top = 0, total = 0;
    stk[top++] = u;
    while (top) {
        int x = stk[--top];
        total += cnt[x];
        for (int c = 0; c < 26; c++) if (ch[x][c]) stk[top++] = ch[x][c];
    }
    return total;
}

int main(void) {
    insert("apple"); insert("app"); insert("apply"); insert("banana");
    printf("前缀 app  的单词数 = %d\n", query("app"));    /* 3 */
    printf("前缀 appl 的单词数 = %d\n", query("appl"));   /* 2 */
    printf("前缀 cat  的单词数 = %d\n", query("cat"));    /* 0 */
    return 0;
}`,
  },
  {
    key: 'numbertheory',
    name: '数论：gcd / 扩展欧几里得 / 线性筛',
    tags: ['数论', '素数'],
    lang: 'c',
    complexity: 'gcd O(log n)；线性筛 O(n)',
    pitfalls: 'exgcd 递归返回时要同步更新 x、y（顺序别写反）；逆元要求 gcd(a,m)=1；线性筛 break 条件 i % p == 0 必须写，否则退化为 O(n log log n)',
    usage: '最大公约数、不定方程 ax+by=c、求模逆元、素数表、同余问题',
    code: String.raw`#include <stdio.h>

/* 扩展欧几里得：求 ax + by = gcd(a,b) 的一组整数解，返回 gcd */
long long exgcd(long long a, long long b, long long *x, long long *y) {
    if (b == 0) { *x = 1; *y = 0; return a; }
    long long x1, y1;
    long long g = exgcd(b, a % b, &x1, &y1);
    *x = y1;
    *y = x1 - a / b * y1;          /* 由 (b, a%b) 的解回推 */
    return g;
}

#define N 100
int is_comp[N + 1], primes[N / 2], pcnt;

void sieve(int n) {                 /* 线性筛：每个合数只被其最小质因子筛一次 */
    for (int i = 2; i <= n; i++) {
        if (!is_comp[i]) primes[pcnt++] = i;
        for (int j = 0; j < pcnt && i * primes[j] <= n; j++) {
            is_comp[i * primes[j]] = 1;
            if (i % primes[j] == 0) break;      /* 保证线性 */
        }
    }
}

int main(void) {
    long long x, y, g = exgcd(12, 8, &x, &y);
    printf("gcd(12,8) = %lld，12*(%lld) + 8*(%lld) = %lld\n", g, x, y, 12 * x + 8 * y);

    exgcd(3, 7, &x, &y);                        /* 3 在模 7 下的逆元 */
    printf("3 在模 7 下的逆元 = %lld\n", (x % 7 + 7) % 7);

    sieve(N);
    printf("100 以内素数个数 = %d，最大的是 %d\n", pcnt, primes[pcnt - 1]);   /* 25 与 97 */
    return 0;
}`,
  },
]

export const COMPLEXITY_TABLES = [
  {
    key: 'sort',
    name: '排序算法对比',
    columns: ['算法', '平均时间', '最坏时间', '空间', '稳定性'],
    rows: [
      ['冒泡排序', 'O(n²)', 'O(n²)', 'O(1)', '稳定'],
      ['选择排序', 'O(n²)', 'O(n²)', 'O(1)', '不稳定'],
      ['插入排序', 'O(n²)', 'O(n²)', 'O(1)', '稳定'],
      ['希尔排序', 'O(n^1.3)', 'O(n²)', 'O(1)', '不稳定'],
      ['归并排序', 'O(n log n)', 'O(n log n)', 'O(n)', '稳定'],
      ['快速排序', 'O(n log n)', 'O(n²)', 'O(log n)', '不稳定'],
      ['堆排序', 'O(n log n)', 'O(n log n)', 'O(1)', '不稳定'],
      ['计数排序', 'O(n + k)', 'O(n + k)', 'O(k)', '稳定'],
      ['基数排序', 'O(d(n + k))', 'O(d(n + k))', 'O(n + k)', '稳定'],
      ['桶排序', 'O(n + k)', 'O(n²)', 'O(n + k)', '稳定'],
    ],
    note: '「稳定」= 相等元素的相对次序不变。考点：快排最坏 O(n²) 的触发条件（数据有序 + 基准取首元素）、堆排序空间 O(1)、何时必须用稳定排序（多关键字排序）',
  },
  {
    key: 'ds',
    name: '数据结构操作复杂度',
    columns: ['结构', '查找', '插入', '删除', '备注'],
    rows: [
      ['数组（按下标）', 'O(1)', 'O(n)', 'O(n)', '尾部插入均摊 O(1)'],
      ['链表', 'O(n)', 'O(1)', 'O(1)', '需已拿到该结点指针'],
      ['栈 / 队列', '—', 'O(1)', 'O(1)', '只在一端操作'],
      ['哈希表', 'O(1) 平均', 'O(1) 平均', 'O(1) 平均', '最坏 O(n)，取决于冲突处理'],
      ['二叉搜索树', 'O(h)', 'O(h)', 'O(h)', 'h 为树高；退化成链时 O(n)'],
      ['平衡树（AVL/红黑）', 'O(log n)', 'O(log n)', 'O(log n)', '保证 h = O(log n)'],
      ['堆（优先队列）', 'O(1) 取顶', 'O(log n)', 'O(log n)', '找任意元素 O(n)'],
      ['并查集', 'α(n)≈O(1)', 'α(n)≈O(1)', '不支持', '路径压缩 + 按秩合并'],
      ['Trie', 'O(L)', 'O(L)', 'O(L)', 'L 为串长'],
    ],
    note: '考点：哈希平均 O(1) 的最坏情况、BST 退化、堆为什么能 O(1) 取极值',
  },
  {
    key: 'graph',
    name: '图算法对比',
    columns: ['算法', '复杂度', '适用场景', '注意'],
    rows: [
      ['BFS', 'O(V + E)', '无权图最短路、层序遍历', '入队即标记'],
      ['DFS', 'O(V + E)', '连通性、拓扑、回溯搜索', '深递归需防爆栈'],
      ['Dijkstra', 'O((V+E)log V)', '单源最短路，边权 ≥ 0', '不能有负权边'],
      ['Bellman-Ford', 'O(VE)', '含负权边、判负环', '负环 → 最短路不存在'],
      ['Floyd', 'O(V³)', '多源最短路、传递闭包', '三重循环顺序 k-i-j 不能乱'],
      ['拓扑排序', 'O(V + E)', 'DAG 任务定序、判环', '输出数 < V 说明有环'],
      ['Kruskal', 'O(E log E)', '最小生成树（稀疏图）', '先排序边，用并查集判环'],
      ['Prim', 'O(E log V)', '最小生成树（稠密图）', '从点集扩展，用堆选最小边'],
      ['二叉树 LCA / Tarjan', 'O(n) / O(n α)', '树上路径问题', '倍增预处理 O(n log n)'],
    ],
    note: '选型口诀：边权为 1 用 BFS；非负权用 Dijkstra；有负权用 Bellman-Ford/SPFA；多源小图用 Floyd；稀疏图 Kruskal、稠密图 Prim',
  },
  {
    key: 'growth',
    name: '复杂度量级对照（做题估算用）',
    columns: ['复杂度', 'n = 10', 'n = 100', 'n = 1000', 'n = 10⁵'],
    rows: [
      ['O(1)', '1', '1', '1', '1'],
      ['O(log n)', '3', '7', '10', '17'],
      ['O(n)', '10', '100', '10³', '10⁵'],
      ['O(n log n)', '33', '7×10²', '10⁴', '1.7×10⁶'],
      ['O(n²)', '100', '10⁴', '10⁶', '10¹⁰ ❌'],
      ['O(n³)', '10³', '10⁶', '10⁹ ❌', '10¹⁵ ❌'],
      ['O(2ⁿ)', '10³', '10³⁰ ❌', '—', '—'],
      ['O(n!)', '3.6×10⁶', '—', '—', '—'],
    ],
    note: '经验值：C 语言 1 秒约 10⁸ 次基本操作。n ≤ 20 可指数级；n ≤ 500 可 O(n³)；n ≤ 5000 可 O(n²)；n ≤ 10⁵ 需 O(n log n) 或更好——看题目数据范围就能反推该用什么算法',
  },
]

