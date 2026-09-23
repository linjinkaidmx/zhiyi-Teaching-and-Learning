// 算法可视化：7 种算法的步骤生成器 + 伪代码
// 每种算法一个纯函数 generateSteps(data[, target])，输出步骤序列。
// 每一步包含完整数组快照 + 操作标记（compare/swap/sorted/pivot）+ 代码行 + 说明。
import { ALGO_CODES } from './algoCodes'

function push(steps, array, sorted, codeLine, desc, extra = {}) {
  steps.push({ array: [...array], sorted: [...sorted], codeLine, desc, ...extra })
}

// ---------------- 冒泡排序 ----------------
function bubbleSteps(data) {
  const a = [...data], steps = [], sorted = []
  push(steps, a, sorted, 1, '初始数组')
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      push(steps, a, sorted, 4, `比较 a[${j}]=${a[j]} 与 a[${j + 1}]=${a[j + 1]}`, { compare: [j, j + 1] })
      if (a[j] > a[j + 1]) {
        ;[a[j], a[j + 1]] = [a[j + 1], a[j]]
        push(steps, a, sorted, 5, `交换 a[${j}] 与 a[${j + 1}]`, { swap: [j, j + 1] })
      }
    }
    sorted.push(a.length - 1 - i)
    push(steps, a, sorted, 2, `第 ${i + 1} 趟结束，a[${a.length - 1 - i}]=${a[a.length - 1 - i]} 已就位`)
  }
  sorted.push(0)
  push(steps, a, sorted, 7, '排序完成')
  return steps
}

// ---------------- 选择排序 ----------------
function selectionSteps(data) {
  const a = [...data], steps = [], sorted = []
  push(steps, a, sorted, 1, '初始数组')
  for (let i = 0; i < a.length - 1; i++) {
    let min = i
    push(steps, a, sorted, 3, `假设最小值在 a[${i}]`, { pivot: i })
    for (let j = i + 1; j < a.length; j++) {
      push(steps, a, sorted, 4, `比较 a[${j}]=${a[j]} 与当前最小 a[${min}]=${a[min]}`, { compare: [j, min] })
      if (a[j] < a[min]) {
        min = j
        push(steps, a, sorted, 5, `更新最小值下标为 ${j}`, { pivot: j })
      }
    }
    if (min !== i) {
      ;[a[i], a[min]] = [a[min], a[i]]
      push(steps, a, sorted, 6, `把最小值换到 a[${i}]`, { swap: [i, min] })
    }
    sorted.push(i)
    push(steps, a, sorted, 2, `a[${i}] 已就位`)
  }
  sorted.push(a.length - 1)
  push(steps, a, sorted, 8, '排序完成')
  return steps
}

// ---------------- 插入排序 ----------------
function insertionSteps(data) {
  const a = [...data], steps = [], sorted = [0]
  push(steps, a, sorted, 1, '初始数组（a[0] 视为已排序）')
  for (let i = 1; i < a.length; i++) {
    const key = a[i]
    let j = i - 1
    push(steps, a, sorted, 3, `取出 key = a[${i}] = ${key}`, { pivot: i })
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j]
      push(steps, a, sorted, 5, `a[${j}]=${a[j]} 右移到 a[${j + 1}]`, { swap: [j, j + 1] })
      j--
    }
    a[j + 1] = key
    sorted.push(i)
    push(steps, a, sorted, 6, `把 key 插入到 a[${j + 1}]`, { pivot: j + 1 })
  }
  push(steps, a, sorted, 7, '排序完成')
  return steps
}

// ---------------- 快速排序 ----------------
function quickSteps(data) {
  const a = [...data], steps = [], sorted = []
  push(steps, a, sorted, 1, '初始数组')

  function partition(low, high) {
    const pivot = a[low]
    push(steps, a, sorted, 3, `选枢轴 pivot = a[${low}] = ${pivot}`, { pivot: low })
    let i = low, j = high
    while (i < j) {
      while (i < j && a[j] >= pivot) {
        j--
        push(steps, a, sorted, 5, `j 左移找小于 pivot 的元素 → j=${j}`, { compare: [j], pivot: low })
      }
      if (i < j) {
        a[i] = a[j]
        push(steps, a, sorted, 6, `a[${i}] = a[${j}] = ${a[i]}`, { swap: [i, j], pivot: low })
      }
      while (i < j && a[i] <= pivot) {
        i++
        push(steps, a, sorted, 7, `i 右移找大于 pivot 的元素 → i=${i}`, { compare: [i], pivot: low })
      }
      if (i < j) {
        a[j] = a[i]
        push(steps, a, sorted, 8, `a[${j}] = a[${i}] = ${a[j]}`, { swap: [i, j], pivot: low })
      }
    }
    a[i] = pivot
    push(steps, a, sorted, 9, `枢轴归位到 a[${i}] = ${pivot}`, { pivot: i })
    return i
  }

  function qsort(low, high) {
    if (low >= high) {
      if (low === high) {
        sorted.push(low)
        push(steps, a, sorted, 10, `a[${low}] 已就位`)
      }
      return
    }
    const p = partition(low, high)
    sorted.push(p)
    push(steps, a, sorted, 10, `a[${p}] 已就位`)
    qsort(low, p - 1)
    qsort(p + 1, high)
  }

  qsort(0, a.length - 1)
  push(steps, a, sorted, 12, '排序完成')
  return steps
}

// ---------------- 归并排序 ----------------
function mergeSteps(data) {
  const a = [...data], steps = [], sorted = []
  push(steps, a, sorted, 1, '初始数组')

  function mergeArr(l, mid, r) {
    const tmp = []
    let i = l, j = mid + 1
    while (i <= mid && j <= r) {
      push(steps, a, sorted, 5, `比较 a[${i}]=${a[i]} 与 a[${j}]=${a[j]}`, { compare: [i, j] })
      if (a[i] <= a[j]) tmp.push(a[i++])
      else tmp.push(a[j++])
    }
    while (i <= mid) tmp.push(a[i++])
    while (j <= r) tmp.push(a[j++])
    for (let k = 0; k < tmp.length; k++) {
      a[l + k] = tmp[k]
      push(steps, a, sorted, 7, `把 ${tmp[k]} 写回 a[${l + k}]`, { swap: [l + k] })
    }
    push(steps, a, sorted, 8, `[${l},${r}] 合并完成`)
  }

  function mergeSort(l, r) {
    if (l >= r) return
    const mid = (l + r) >> 1
    push(steps, a, sorted, 3, `分解 [${l},${r}] → [${l},${mid}] 与 [${mid + 1},${r}]`)
    mergeSort(l, mid)
    mergeSort(mid + 1, r)
    mergeArr(l, mid, r)
  }

  mergeSort(0, a.length - 1)
  for (let k = 0; k < a.length; k++) sorted.push(k)
  push(steps, a, sorted, 10, '排序完成')
  return steps
}

// ---------------- 堆排序 ----------------
function heapSteps(data) {
  const a = [...data], steps = [], sorted = []
  const n = a.length
  push(steps, a, sorted, 1, '初始数组（视为完全二叉树）')

  function siftDown(start, end) {
    let root = start
    while (root * 2 + 1 <= end) {
      let child = root * 2 + 1
      if (child + 1 <= end) {
        push(steps, a, sorted, 4, `比较左右孩子 a[${child}] 与 a[${child + 1}]`, { compare: [child, child + 1], pivot: root })
        if (a[child] < a[child + 1]) child++
      }
      push(steps, a, sorted, 5, `比较 a[${root}]=${a[root]} 与 a[${child}]=${a[child]}`, { compare: [root, child] })
      if (a[root] < a[child]) {
        ;[a[root], a[child]] = [a[child], a[root]]
        push(steps, a, sorted, 6, `交换 a[${root}] 与 a[${child}]`, { swap: [root, child] })
        root = child
      } else break
    }
  }

  for (let i = (n >> 1) - 1; i >= 0; i--) {
    push(steps, a, sorted, 3, `对结点 a[${i}] 下滤建堆`, { pivot: i })
    siftDown(i, n - 1)
  }
  push(steps, a, sorted, 3, '建堆完成（大顶堆）')

  for (let end = n - 1; end > 0; end--) {
    ;[a[0], a[end]] = [a[end], a[0]]
    push(steps, a, sorted, 8, `交换堆顶 a[0] 与末尾 a[${end}]`, { swap: [0, end] })
    sorted.push(end)
    push(steps, a, sorted, 9, `a[${end}]=${a[end]} 已就位`)
    siftDown(0, end - 1)
  }
  sorted.push(0)
  push(steps, a, sorted, 11, '排序完成')
  return steps
}

// ---------------- 二分查找 ----------------
function binarySteps(data, target) {
  const a = [...data].sort((x, y) => x - y)
  const steps = []
  push(steps, a, [], 1, `在有序数组中查找 ${target}`)
  let l = 0, r = a.length - 1
  while (l <= r) {
    const mid = (l + r) >> 1
    push(steps, a, [], 3, `mid = (${l}+${r})/2 = ${mid}`, { pivot: mid })
    push(steps, a, [], 4, `比较 a[${mid}]=${a[mid]} 与 ${target}`, { compare: [mid] })
    if (a[mid] === target) {
      return steps.concat([{ array: [...a], sorted: [mid], codeLine: 5, desc: `找到！位置在 a[${mid}]` }])
    } else if (a[mid] < target) {
      l = mid + 1
      push(steps, a, [], 7, `${a[mid]} < ${target}，向右半边找`, { pivot: mid })
    } else {
      r = mid - 1
      push(steps, a, [], 6, `${a[mid]} > ${target}，向左半边找`, { pivot: mid })
    }
  }
  push(steps, a, [], 9, '查找结束，目标不存在')
  return steps
}

// ---------------- 树 / 图（预定义结构） ----------------

const BST = {
  nodes: [
    { id: 0, value: 8, left: 1, right: 2, x: 320, y: 46 },
    { id: 1, value: 3, left: 3, right: 4, x: 180, y: 126 },
    { id: 2, value: 10, left: null, right: 5, x: 460, y: 126 },
    { id: 3, value: 1, left: null, right: null, x: 110, y: 206 },
    { id: 4, value: 6, left: 6, right: 7, x: 250, y: 206 },
    { id: 5, value: 14, left: null, right: null, x: 530, y: 206 },
    { id: 6, value: 4, left: null, right: null, x: 210, y: 286 },
    { id: 7, value: 7, left: null, right: null, x: 290, y: 286 },
  ],
  root: 0,
}

const GRAPH = {
  nodes: [
    { id: 0, label: 'A', x: 140, y: 90 },
    { id: 1, label: 'B', x: 330, y: 40 },
    { id: 2, label: 'C', x: 330, y: 170 },
    { id: 3, label: 'D', x: 520, y: 90 },
    { id: 4, label: 'E', x: 520, y: 210 },
    { id: 5, label: 'F', x: 220, y: 260 },
  ],
  edges: [
    { from: 0, to: 1, w: 4 },
    { from: 0, to: 2, w: 2 },
    { from: 1, to: 3, w: 5 },
    { from: 2, to: 1, w: 1 },
    { from: 2, to: 4, w: 10 },
    { from: 3, to: 4, w: 2 },
    { from: 2, to: 5, w: 3 },
    { from: 5, to: 4, w: 7 },
  ],
}

function treeNodeMap() {
  const m = {}
  BST.nodes.forEach((n) => { m[n.id] = n })
  return m
}
function graphLabel(id) {
  const n = GRAPH.nodes.find((x) => x.id === id)
  return n ? n.label : id
}
function graphAdj(id) {
  return GRAPH.edges
    .filter((e) => e.from === id || e.to === id)
    .map((e) => ({ to: e.from === id ? e.to : e.from, w: e.w }))
}

function preorderSteps() {
  const steps = [], visited = [], nodeOf = treeNodeMap()
  steps.push({ highlight: null, visited: [], codeLine: 1, desc: '从根节点 8 开始前序遍历（根 → 左 → 右）' })
  function t(id) {
    if (id == null) return
    const n = nodeOf[id]
    visited.push(id)
    steps.push({ highlight: id, visited: [...visited], codeLine: 3, desc: `访问节点 ${n.value}` })
    t(n.left)
    t(n.right)
  }
  t(BST.root)
  steps.push({ highlight: null, visited: [...visited], codeLine: 6, desc: '前序遍历完成：8 3 1 6 4 7 10 14' })
  return steps
}

function inorderSteps() {
  const steps = [], visited = [], nodeOf = treeNodeMap()
  steps.push({ highlight: null, visited: [], codeLine: 1, desc: '从根节点 8 开始中序遍历（左 → 根 → 右）' })
  function t(id) {
    if (id == null) return
    const n = nodeOf[id]
    t(n.left)
    visited.push(id)
    steps.push({ highlight: id, visited: [...visited], codeLine: 4, desc: `访问节点 ${n.value}` })
    t(n.right)
  }
  t(BST.root)
  steps.push({ highlight: null, visited: [...visited], codeLine: 6, desc: '中序遍历完成：1 3 4 6 7 8 10 14（升序）' })
  return steps
}

function postorderSteps() {
  const steps = [], visited = [], nodeOf = treeNodeMap()
  steps.push({ highlight: null, visited: [], codeLine: 1, desc: '从根节点 8 开始后序遍历（左 → 右 → 根）' })
  function t(id) {
    if (id == null) return
    const n = nodeOf[id]
    t(n.left)
    t(n.right)
    visited.push(id)
    steps.push({ highlight: id, visited: [...visited], codeLine: 5, desc: `访问节点 ${n.value}` })
  }
  t(BST.root)
  steps.push({ highlight: null, visited: [...visited], codeLine: 6, desc: '后序遍历完成：1 4 7 6 3 14 10 8' })
  return steps
}

function levelorderSteps() {
  const steps = [], visited = [], nodeOf = treeNodeMap()
  const q = [BST.root]
  steps.push({ highlight: null, queue: [BST.root], visited: [], codeLine: 2, desc: '根节点 8 入队' })
  while (q.length) {
    const id = q.shift()
    const n = nodeOf[id]
    visited.push(id)
    steps.push({ highlight: id, queue: [...q], visited: [...visited], codeLine: 4, desc: `出队访问节点 ${n.value}` })
    if (n.left != null) {
      q.push(n.left)
      steps.push({ highlight: id, queue: [...q], visited: [...visited], codeLine: 5, desc: `左孩子 ${nodeOf[n.left].value} 入队` })
    }
    if (n.right != null) {
      q.push(n.right)
      steps.push({ highlight: id, queue: [...q], visited: [...visited], codeLine: 6, desc: `右孩子 ${nodeOf[n.right].value} 入队` })
    }
  }
  steps.push({ highlight: null, visited: [...visited], codeLine: 7, desc: '层序遍历完成：8 3 10 1 6 14 4 7' })
  return steps
}

function bstSearchSteps(_data, target) {
  const tv = target ?? 6
  const steps = [], visited = [], nodeOf = treeNodeMap()
  let id = BST.root
  steps.push({ highlight: id, visited: [], codeLine: 1, desc: `从根节点开始查找 ${tv}` })
  while (id != null) {
    const n = nodeOf[id]
    steps.push({ highlight: id, visited: [...visited], codeLine: 2, desc: `比较 ${n.value} 与 ${tv}` })
    if (n.value === tv) {
      visited.push(id)
      steps.push({ highlight: id, visited: [...visited], codeLine: 3, desc: `找到目标 ${tv}！` })
      return steps
    } else if (tv < n.value) {
      visited.push(id)
      steps.push({ highlight: id, visited: [...visited], codeLine: 4, desc: `${tv} < ${n.value}，进入左子树` })
      id = n.left
    } else {
      visited.push(id)
      steps.push({ highlight: id, visited: [...visited], codeLine: 5, desc: `${tv} > ${n.value}，进入右子树` })
      id = n.right
    }
  }
  steps.push({ highlight: null, visited: [...visited], codeLine: 7, desc: '未找到目标' })
  return steps
}

function bfsSteps() {
  const steps = [], visited = new Set([0]), q = [0]
  steps.push({ current: 0, queue: [...q], visited: [...visited], codeLine: 2, desc: '从 A 开始：A 入队并标记已访问' })
  while (q.length) {
    const u = q.shift()
    steps.push({ current: u, queue: [...q], visited: [...visited], codeLine: 4, desc: `出队访问 ${graphLabel(u)}` })
    for (const nb of graphAdj(u)) {
      if (!visited.has(nb.to)) {
        visited.add(nb.to)
        q.push(nb.to)
        steps.push({ current: u, queue: [...q], visited: [...visited], codeLine: 6, desc: `发现新节点 ${graphLabel(nb.to)}，入队` })
      }
    }
  }
  steps.push({ current: null, queue: [], visited: [...visited], codeLine: 8, desc: 'BFS 遍历完成' })
  return steps
}

function dfsSteps() {
  const steps = [], visited = new Set()
  steps.push({ current: null, visited: [], codeLine: 1, desc: '从 A 开始深度优先遍历' })
  function dfs(u) {
    visited.add(u)
    steps.push({ current: u, visited: [...visited], codeLine: 3, desc: `访问节点 ${graphLabel(u)}` })
    for (const nb of graphAdj(u)) {
      if (!visited.has(nb.to)) {
        steps.push({ current: u, visited: [...visited], codeLine: 4, desc: `发现 ${graphLabel(nb.to)}，递归深入` })
        dfs(nb.to)
      }
    }
    steps.push({ current: u, visited: [...visited], codeLine: 5, desc: `${graphLabel(u)} 的邻接已访问完，回溯` })
  }
  dfs(0)
  steps.push({ current: null, visited: [...visited], codeLine: 6, desc: 'DFS 遍历完成' })
  return steps
}

function dijkstraSteps() {
  const n = GRAPH.nodes.length
  const dist = Array(n).fill(Infinity)
  const done = new Set()
  dist[0] = 0
  const steps = []
  steps.push({ current: 0, dist: [...dist], done: [...done], codeLine: 1, desc: '初始化：dist[A]=0，其余为 ∞' })
  for (let k = 0; k < n; k++) {
    let u = -1, mn = Infinity
    for (let i = 0; i < n; i++) if (!done.has(i) && dist[i] < mn) { mn = dist[i]; u = i }
    if (u === -1) break
    done.add(u)
    steps.push({ current: u, dist: [...dist], done: [...done], codeLine: 3, desc: `选距离最小的 ${graphLabel(u)}（dist=${dist[u]}），标记确定` })
    for (const nb of graphAdj(u)) {
      if (dist[u] + nb.w < dist[nb.to]) {
        dist[nb.to] = dist[u] + nb.w
        steps.push({ current: u, dist: [...dist], done: [...done], codeLine: 5, desc: `松弛 ${graphLabel(nb.to)}：dist=${dist[nb.to]}` })
      }
    }
  }
  steps.push({ current: null, dist: [...dist], done: [...done], codeLine: 7, desc: 'Dijkstra 完成，得到 A 到各点的最短距离' })
  return steps
}

// ---------------- 算法注册表 ----------------
export const ALGORITHMS = {
  bubble: {
    name: '冒泡排序',
    category: '排序',
    generate: bubbleSteps,
    code: [
      'for i = 0 to n-2:',
      '  # 第 i 趟把最大值冒到最后',
      '  for j = 0 to n-2-i:',
      '    if a[j] > a[j+1]:',
      '      swap(a[j], a[j+1])',
      '    end if',
      '  end for',
      'end for',
    ],
    codeMap: { compare: 4, swap: 5 },
  },
  selection: {
    name: '选择排序',
    category: '排序',
    generate: selectionSteps,
    code: [
      'for i = 0 to n-2:',
      '  # 每轮找未排序部分的最小值',
      '  min = i',
      '  for j = i+1 to n-1:',
      '    if a[j] < a[min]:',
      '      min = j',
      '    end if',
      '  end for',
      '  swap(a[i], a[min])',
      'end for',
    ],
  },
  insertion: {
    name: '插入排序',
    category: '排序',
    generate: insertionSteps,
    code: [
      'for i = 1 to n-1:',
      '  # 把 a[i] 插入已排序部分',
      '  key = a[i]',
      '  j = i - 1',
      '  while j >= 0 and a[j] > key:',
      '    a[j+1] = a[j]',
      '    j = j - 1',
      '  end while',
      '  a[j+1] = key',
      'end for',
    ],
  },
  quick: {
    name: '快速排序',
    category: '排序',
    generate: quickSteps,
    code: [
      'quicksort(low, high):',
      '  if low >= high: return',
      '  pivot = a[low]',
      '  i, j = low, high',
      '  while i < j:',
      '    while a[j] >= pivot: j--',
      '    a[i] = a[j]',
      '    while a[i] <= pivot: i++',
      '    a[j] = a[i]',
      '  a[i] = pivot',
      '  quicksort(low, i-1)',
      '  quicksort(i+1, high)',
    ],
  },
  merge: {
    name: '归并排序',
    category: '排序',
    generate: mergeSteps,
    code: [
      'mergesort(l, r):',
      '  if l >= r: return',
      '  mid = (l + r) / 2',
      '  mergesort(l, mid)',
      '  mergesort(mid+1, r)',
      '  # 合并两个有序子数组',
      '  merge(l, mid, r)',
    ],
  },
  heap: {
    name: '堆排序',
    category: '排序',
    generate: heapSteps,
    code: [
      'buildHeap():',
      '  for i = n/2-1 downto 0:',
      '    siftDown(i)',
      '  for end = n-1 downto 1:',
      '    swap(a[0], a[end])',
      '    siftDown(0, end-1)',
      'siftDown(root):',
      '  child = 2*root+1',
      '  if child+1 <= end:',
      '    child = max(child, child+1)',
      '  if a[root] < a[child]:',
      '    swap(a[root], a[child])',
      '    siftDown(child)',
    ],
  },
  binary: {
    name: '二分查找',
    category: '查找',
    generate: binarySteps,
    code: [
      'binarySearch(a, target):',
      '  l, r = 0, len(a)-1',
      '  while l <= r:',
      '    mid = (l + r) / 2',
      '    if a[mid] == target: return mid',
      '    elif a[mid] < target:',
      '      l = mid + 1',
      '    else:',
      '      r = mid - 1',
      '  return -1',
    ],
    needsTarget: true,
  },
  preorder: {
    name: '前序遍历',
    category: '树',
    renderer: 'tree',
    fixed: true,
    generate: preorderSteps,
    code: [
      'preorder(node):',
      '  if node == null: return',
      '  visit(node)',
      '  preorder(node.left)',
      '  preorder(node.right)',
      'end',
    ],
  },
  inorder: {
    name: '中序遍历',
    category: '树',
    renderer: 'tree',
    fixed: true,
    generate: inorderSteps,
    code: [
      'inorder(node):',
      '  if node == null: return',
      '  inorder(node.left)',
      '  visit(node)',
      '  inorder(node.right)',
      'end',
    ],
  },
  postorder: {
    name: '后序遍历',
    category: '树',
    renderer: 'tree',
    fixed: true,
    generate: postorderSteps,
    code: [
      'postorder(node):',
      '  if node == null: return',
      '  postorder(node.left)',
      '  postorder(node.right)',
      '  visit(node)',
      'end',
    ],
  },
  levelorder: {
    name: '层序遍历',
    category: '树',
    renderer: 'tree',
    fixed: true,
    generate: levelorderSteps,
    code: [
      'levelorder(root):',
      '  queue = [root]',
      '  while queue not empty:',
      '    node = queue.pop(); visit(node)',
      '    if node.left: queue.push(node.left)',
      '    if node.right: queue.push(node.right)',
      'end',
    ],
  },
  bst_search: {
    name: 'BST 查找',
    category: '树',
    renderer: 'tree',
    fixed: true,
    needsTarget: true,
    generate: bstSearchSteps,
    code: [
      'search(node, target):',
      '  if node == null: return null',
      '  if node.value == target: return node',
      '  if target < node.value:',
      '    return search(node.left, target)',
      '  return search(node.right, target)',
      'end',
    ],
  },
  bfs: {
    name: '广度优先 BFS',
    category: '图',
    renderer: 'graph',
    fixed: true,
    generate: bfsSteps,
    code: [
      'BFS(graph, start):',
      '  queue = [start]; visited = {start}',
      '  while queue not empty:',
      '    u = queue.pop()',
      '    visit(u)',
      '    for v in neighbors(u):',
      '      if v not in visited:',
      '        visited.add(v); queue.push(v)',
    ],
  },
  dfs: {
    name: '深度优先 DFS',
    category: '图',
    renderer: 'graph',
    fixed: true,
    generate: dfsSteps,
    code: [
      'DFS(u):',
      '  visited.add(u)',
      '  visit(u)',
      '  for v in neighbors(u):',
      '    if v not in visited: DFS(v)',
      'end',
    ],
  },
  dijkstra: {
    name: '最短路径 Dijkstra',
    category: '图',
    renderer: 'graph',
    fixed: true,
    generate: dijkstraSteps,
    code: [
      'dijkstra(graph, start):',
      '  dist[start] = 0, others = ∞',
      '  repeat n times:',
      '    u = min-dist unvisited node',
      '    mark u visited',
      '    for (v, w) in neighbors(u):',
      '      dist[v] = min(dist[v], dist[u] + w)',
    ],
  },
}

export const ALGORITHM_IDS = Object.keys(ALGORITHMS)

// 注入多语言代码（C/C++/Java/Python）与 codeLine→真实行号映射（见 algoCodes.js）
for (const id of ALGORITHM_IDS) {
  const entry = ALGO_CODES[id]
  if (entry) {
    ALGORITHMS[id].codes = entry.codes
    ALGORITHMS[id].lineMap = entry.lineMap
  }
}

export const TREE = BST
export const GRAPH_DATA = GRAPH

// 题目 → 算法演示匹配（按具体度排序，避免误匹配）
const ALGO_RULES = [
  ['快速排序', 'quick'], ['快排', 'quick'],
  ['归并排序', 'merge'], ['归并', 'merge'],
  ['堆排序', 'heap'], ['建堆', 'heap'], ['大顶堆', 'heap'], ['小顶堆', 'heap'],
  ['冒泡', 'bubble'],
  ['选择排序', 'selection'],
  ['插入排序', 'insertion'],
  ['二分查找', 'binary'], ['折半查找', 'binary'],
  ['前序遍历', 'preorder'], ['前序', 'preorder'],
  ['中序遍历', 'inorder'], ['中序', 'inorder'],
  ['后序遍历', 'postorder'], ['后序', 'postorder'],
  ['层序遍历', 'levelorder'], ['层次遍历', 'levelorder'],
  ['二叉排序树', 'bst_search'], ['二叉搜索树', 'bst_search'], ['bst', 'bst_search'],
  ['广度优先', 'bfs'], ['bfs', 'bfs'],
  ['深度优先', 'dfs'], ['dfs', 'dfs'],
  ['dijkstra', 'dijkstra'], ['迪杰斯特拉', 'dijkstra'], ['最短路径', 'dijkstra'],
]

/** 根据题目文本 + 知识点，匹配一个算法演示 id（无匹配返回 null）。 */
export function matchAlgo(question, knowledgePoints = []) {
  const text = ((question || '') + ' ' + (knowledgePoints || []).join(' ')).toLowerCase()
  for (const [kw, algo] of ALGO_RULES) {
    if (text.includes(kw)) return algo
  }
  return null
}
