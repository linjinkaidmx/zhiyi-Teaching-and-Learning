import{_ as H,b as d,g as p,v as et,L as nt,o as ot,d as a,t as w,F as O,h as P,i as tt,n as vt,x as I,M as V,ap as ht,e as D,f as z,w as X,U as Q,m as C,r as N,c as B,j as ct,ao as W,aa as kt,ab as rt,aq as lt,a7 as Pt,ar as A,a8 as Mt,J as Dt,R as F,Q as Vt,V as _t}from"./index-Dor4m76Q.js";import{U as Bt}from"./UiSegmented-DPNouorl.js";import{U as at}from"./UiSelect-DbUOKa8n.js";import{U as Tt}from"./UiNumber-CqGmVUth.js";import{M as U}from"./MathText-1n8ldrLl.js";import{U as yt}from"./UiTag-BJRypAco.js";import"./mhchem-3aPi3bCc.js";const qt=[{key:"c",label:"C"},{key:"cpp",label:"C++"},{key:"java",label:"Java"},{key:"python",label:"Python"}],Et={bubble:{codes:{c:["void bubbleSort(int a[], int n) {","    for (int i = 0; i < n - 1; i++) {","        for (int j = 0; j < n - 1 - i; j++) {","            if (a[j] > a[j + 1]) {","                int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;","            }","        }","    }","}"],cpp:["void bubbleSort(int a[], int n) {","    for (int i = 0; i < n - 1; i++) {","        for (int j = 0; j < n - 1 - i; j++) {","            if (a[j] > a[j + 1]) {","                std::swap(a[j], a[j + 1]);","            }","        }","    }","}"],java:["void bubbleSort(int[] a) {","    int n = a.length;","    for (int i = 0; i < n - 1; i++) {","        for (int j = 0; j < n - 1 - i; j++) {","            if (a[j] > a[j + 1]) {","                int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;","            }","        }","    }","}"],python:["def bubble_sort(a):","    n = len(a)","    for i in range(n - 1):","        for j in range(n - 1 - i):","            if a[j] > a[j + 1]:","                a[j], a[j + 1] = a[j + 1], a[j]"]},lineMap:{c:{1:1,4:4,5:5,2:7,7:8},cpp:{1:1,4:4,5:5,2:7,7:8},java:{1:3,4:5,5:6,2:8,7:9},python:{1:1,4:5,5:6,2:4,7:6}}},selection:{codes:{c:["void selectionSort(int a[], int n) {","    for (int i = 0; i < n - 1; i++) {","        int min = i;","        for (int j = i + 1; j < n; j++) {","            if (a[j] < a[min]) {","                min = j;","            }","        }","        int t = a[i]; a[i] = a[min]; a[min] = t;","    }","}"],cpp:["void selectionSort(int a[], int n) {","    for (int i = 0; i < n - 1; i++) {","        int min = i;","        for (int j = i + 1; j < n; j++) {","            if (a[j] < a[min]) {","                min = j;","            }","        }","        std::swap(a[i], a[min]);","    }","}"],java:["void selectionSort(int[] a) {","    int n = a.length;","    for (int i = 0; i < n - 1; i++) {","        int min = i;","        for (int j = i + 1; j < n; j++) {","            if (a[j] < a[min]) {","                min = j;","            }","        }","        int t = a[i]; a[i] = a[min]; a[min] = t;","    }","}"],python:["def selection_sort(a):","    n = len(a)","    for i in range(n - 1):","        m = i","        for j in range(i + 1, n):","            if a[j] < a[m]:","                m = j","        a[i], a[m] = a[m], a[i]"]},lineMap:{c:{1:1,3:3,4:5,5:6,6:9,2:8,8:10},cpp:{1:1,3:3,4:5,5:6,6:9,2:8,8:10},java:{1:3,3:4,4:6,5:7,6:10,2:9,8:11},python:{1:1,3:4,4:6,5:7,6:8,2:5,8:8}}},insertion:{codes:{c:["void insertionSort(int a[], int n) {","    for (int i = 1; i < n; i++) {","        int key = a[i];","        int j = i - 1;","        while (j >= 0 && a[j] > key) {","            a[j + 1] = a[j];","            j--;","        }","        a[j + 1] = key;","    }","}"],cpp:["void insertionSort(int a[], int n) {","    for (int i = 1; i < n; i++) {","        int key = a[i];","        int j = i - 1;","        while (j >= 0 && a[j] > key) {","            a[j + 1] = a[j];","            j--;","        }","        a[j + 1] = key;","    }","}"],java:["void insertionSort(int[] a) {","    int n = a.length;","    for (int i = 1; i < n; i++) {","        int key = a[i];","        int j = i - 1;","        while (j >= 0 && a[j] > key) {","            a[j + 1] = a[j];","            j--;","        }","        a[j + 1] = key;","    }","}"],python:["def insertion_sort(a):","    for i in range(1, len(a)):","        key = a[i]","        j = i - 1","        while j >= 0 and a[j] > key:","            a[j + 1] = a[j]","            j -= 1","        a[j + 1] = key"]},lineMap:{c:{1:1,3:3,5:6,6:9,7:10},cpp:{1:1,3:3,5:6,6:9,7:10},java:{1:3,3:4,5:7,6:10,7:11},python:{1:1,3:3,5:6,6:8,7:8}}},quick:{codes:{c:["void quickSort(int a[], int low, int high) {","    if (low >= high) return;","    int pivot = a[low];","    int i = low, j = high;","    while (i < j) {","        while (i < j && a[j] >= pivot) j--;","        a[i] = a[j];","        while (i < j && a[i] <= pivot) i++;","        a[j] = a[i];","    }","    a[i] = pivot;","    quickSort(a, low, i - 1);","    quickSort(a, i + 1, high);","}"],cpp:["void quickSort(int a[], int low, int high) {","    if (low >= high) return;","    int pivot = a[low];","    int i = low, j = high;","    while (i < j) {","        while (i < j && a[j] >= pivot) j--;","        a[i] = a[j];","        while (i < j && a[i] <= pivot) i++;","        a[j] = a[i];","    }","    a[i] = pivot;","    quickSort(a, low, i - 1);","    quickSort(a, i + 1, high);","}"],java:["void quickSort(int[] a, int low, int high) {","    if (low >= high) return;","    int pivot = a[low];","    int i = low, j = high;","    while (i < j) {","        while (i < j && a[j] >= pivot) j--;","        a[i] = a[j];","        while (i < j && a[i] <= pivot) i++;","        a[j] = a[i];","    }","    a[i] = pivot;","    quickSort(a, low, i - 1);","    quickSort(a, i + 1, high);","}"],python:["def quick_sort(a, low, high):","    if low >= high:","        return","    pivot = a[low]","    i, j = low, high","    while i < j:","        while i < j and a[j] >= pivot:","            j -= 1","        a[i] = a[j]","        while i < j and a[i] <= pivot:","            i += 1","        a[j] = a[i]","    a[i] = pivot","    quick_sort(a, low, i - 1)","    quick_sort(a, i + 1, high)"]},lineMap:{c:{1:1,3:3,5:6,6:7,7:8,8:9,9:11,10:12,12:13},cpp:{1:1,3:3,5:6,6:7,7:8,8:9,9:11,10:12,12:13},java:{1:1,3:3,5:6,6:7,7:8,8:9,9:11,10:12,12:13},python:{1:1,3:4,5:7,6:9,7:10,8:12,9:13,10:14,12:15}}},merge:{codes:{c:["void merge(int a[], int l, int mid, int r) {","    int i = l, j = mid + 1;","    while (i <= mid && j <= r) {","        if (a[i] <= a[j]) i++;","        else j++;","    }","    // 合并结果写回 a[l..r]","}","void mergeSort(int a[], int l, int r) {","    if (l >= r) return;","    int mid = (l + r) / 2;","    mergeSort(a, l, mid);","    mergeSort(a, mid + 1, r);","    merge(a, l, mid, r);","}"],cpp:["void merge(int a[], int l, int mid, int r) {","    int i = l, j = mid + 1;","    while (i <= mid && j <= r) {","        if (a[i] <= a[j]) i++;","        else j++;","    }","    // 合并结果写回 a[l..r]","}","void mergeSort(int a[], int l, int r) {","    if (l >= r) return;","    int mid = (l + r) / 2;","    mergeSort(a, l, mid);","    mergeSort(a, mid + 1, r);","    merge(a, l, mid, r);","}"],java:["void merge(int[] a, int l, int mid, int r) {","    int i = l, j = mid + 1;","    while (i <= mid && j <= r) {","        if (a[i] <= a[j]) i++;","        else j++;","    }","    // 合并结果写回 a[l..r]","}","void mergeSort(int[] a, int l, int r) {","    if (l >= r) return;","    int mid = (l + r) / 2;","    mergeSort(a, l, mid);","    mergeSort(a, mid + 1, r);","    merge(a, l, mid, r);","}"],python:["def merge(a, l, mid, r):","    i, j = l, mid + 1","    while i <= mid and j <= r:","        if a[i] <= a[j]:","            i += 1","        else:","            j += 1","    # 合并结果写回 a[l..r]","def merge_sort(a, l, r):","    if l >= r:","        return","    mid = (l + r) // 2","    merge_sort(a, l, mid)","    merge_sort(a, mid + 1, r)","    merge(a, l, mid, r)"]},lineMap:{c:{1:9,3:11,5:4,7:7,8:8,10:13},cpp:{1:9,3:11,5:4,7:7,8:8,10:13},java:{1:9,3:11,5:4,7:7,8:8,10:13},python:{1:9,3:12,5:4,7:8,8:8,10:14}}},heap:{codes:{c:["void siftDown(int a[], int n, int root) {","    while (2 * root + 1 < n) {","        int child = 2 * root + 1;","        if (child + 1 < n && a[child] < a[child + 1]) child++;","        if (a[root] < a[child]) {","            int t = a[root]; a[root] = a[child]; a[child] = t;","            root = child;","        } else break;","    }","}","void heapSort(int a[], int n) {","    for (int i = n / 2 - 1; i >= 0; i--) siftDown(a, n, i);","    for (int end = n - 1; end > 0; end--) {","        int t = a[0]; a[0] = a[end]; a[end] = t;","        siftDown(a, end, 0);","    }","}"],cpp:["void siftDown(int a[], int n, int root) {","    while (2 * root + 1 < n) {","        int child = 2 * root + 1;","        if (child + 1 < n && a[child] < a[child + 1]) child++;","        if (a[root] < a[child]) {","            std::swap(a[root], a[child]);","            root = child;","        } else break;","    }","}","void heapSort(int a[], int n) {","    for (int i = n / 2 - 1; i >= 0; i--) siftDown(a, n, i);","    for (int end = n - 1; end > 0; end--) {","        std::swap(a[0], a[end]);","        siftDown(a, end, 0);","    }","}"],java:["void siftDown(int[] a, int n, int root) {","    while (2 * root + 1 < n) {","        int child = 2 * root + 1;","        if (child + 1 < n && a[child] < a[child + 1]) child++;","        if (a[root] < a[child]) {","            int t = a[root]; a[root] = a[child]; a[child] = t;","            root = child;","        } else break;","    }","}","void heapSort(int[] a) {","    int n = a.length;","    for (int i = n / 2 - 1; i >= 0; i--) siftDown(a, n, i);","    for (int end = n - 1; end > 0; end--) {","        int t = a[0]; a[0] = a[end]; a[end] = t;","        siftDown(a, end, 0);","    }","}"],python:["def sift_down(a, n, root):","    while 2 * root + 1 < n:","        child = 2 * root + 1","        if child + 1 < n and a[child] < a[child + 1]:","            child += 1","        if a[root] < a[child]:","            a[root], a[child] = a[child], a[root]","            root = child","        else:","            break","def heap_sort(a):","    n = len(a)","    for i in range(n // 2 - 1, -1, -1):","        sift_down(a, n, i)","    for end in range(n - 1, 0, -1):","        a[0], a[end] = a[end], a[0]","        sift_down(a, end, 0)"]},lineMap:{c:{1:11,3:12,4:4,5:5,6:6,8:14,9:15,11:16},cpp:{1:11,3:12,4:4,5:5,6:6,8:14,9:15,11:16},java:{1:11,3:13,4:4,5:5,6:6,8:15,9:16,11:17},python:{1:11,3:13,4:4,5:6,6:7,8:16,9:17,11:17}}},binary:{codes:{c:["int binarySearch(int a[], int n, int target) {","    int l = 0, r = n - 1;","    while (l <= r) {","        int mid = (l + r) / 2;","        if (a[mid] == target) return mid;","        if (a[mid] < target) l = mid + 1;","        else r = mid - 1;","    }","    return -1;","}"],cpp:["int binarySearch(int a[], int n, int target) {","    int l = 0, r = n - 1;","    while (l <= r) {","        int mid = (l + r) / 2;","        if (a[mid] == target) return mid;","        if (a[mid] < target) l = mid + 1;","        else r = mid - 1;","    }","    return -1;","}"],java:["int binarySearch(int[] a, int target) {","    int n = a.length;","    int l = 0, r = n - 1;","    while (l <= r) {","        int mid = (l + r) / 2;","        if (a[mid] == target) return mid;","        if (a[mid] < target) l = mid + 1;","        else r = mid - 1;","    }","    return -1;","}"],python:["def binary_search(a, target):","    l, r = 0, len(a) - 1","    while l <= r:","        mid = (l + r) // 2","        if a[mid] == target:","            return mid","        if a[mid] < target:","            l = mid + 1","        else:","            r = mid - 1","    return -1"]},lineMap:{c:{1:1,3:4,4:5,5:5,7:6,6:7,9:9},cpp:{1:1,3:4,4:5,5:5,7:6,6:7,9:9},java:{1:1,3:5,4:6,5:6,7:7,6:8,9:10},python:{1:1,3:4,4:5,5:5,7:7,6:9,9:11}}},preorder:{codes:{c:["// 节点结构 Node { left, right, val } 已定义","void preorder(Node* node) {","    if (node == NULL) return;","    visit(node);              // 访问当前节点","    preorder(node->left);","    preorder(node->right);","}"],cpp:["// 节点结构 Node { left, right, val } 已定义","void preorder(Node* node) {","    if (node == nullptr) return;","    visit(node);              // 访问当前节点","    preorder(node->left);","    preorder(node->right);","}"],java:["// 节点类 Node { left, right, val } 已定义","void preorder(Node node) {","    if (node == null) return;","    visit(node);              // 访问当前节点","    preorder(node.left);","    preorder(node.right);","}"],python:["# 节点类 Node（含 left/right/val）已定义","def preorder(node):","    if node is None:","        return","    visit(node)      # 访问当前节点","    preorder(node.left)","    preorder(node.right)"]},lineMap:{c:{1:2,3:4,6:6},cpp:{1:2,3:4,6:6},java:{1:2,3:4,6:6},python:{1:2,3:5,6:7}}},inorder:{codes:{c:["// 节点结构 Node { left, right, val } 已定义","void inorder(Node* node) {","    if (node == NULL) return;","    inorder(node->left);","    visit(node);              // 访问当前节点","    inorder(node->right);","}"],cpp:["// 节点结构 Node { left, right, val } 已定义","void inorder(Node* node) {","    if (node == nullptr) return;","    inorder(node->left);","    visit(node);              // 访问当前节点","    inorder(node->right);","}"],java:["// 节点类 Node { left, right, val } 已定义","void inorder(Node node) {","    if (node == null) return;","    inorder(node.left);","    visit(node);              // 访问当前节点","    inorder(node.right);","}"],python:["# 节点类 Node（含 left/right/val）已定义","def inorder(node):","    if node is None:","        return","    inorder(node.left)","    visit(node)      # 访问当前节点","    inorder(node.right)"]},lineMap:{c:{1:2,4:5,6:6},cpp:{1:2,4:5,6:6},java:{1:2,4:5,6:6},python:{1:2,4:6,6:7}}},postorder:{codes:{c:["// 节点结构 Node { left, right, val } 已定义","void postorder(Node* node) {","    if (node == NULL) return;","    postorder(node->left);","    postorder(node->right);","    visit(node);              // 访问当前节点","}"],cpp:["// 节点结构 Node { left, right, val } 已定义","void postorder(Node* node) {","    if (node == nullptr) return;","    postorder(node->left);","    postorder(node->right);","    visit(node);              // 访问当前节点","}"],java:["// 节点类 Node { left, right, val } 已定义","void postorder(Node node) {","    if (node == null) return;","    postorder(node.left);","    postorder(node.right);","    visit(node);              // 访问当前节点","}"],python:["# 节点类 Node（含 left/right/val）已定义","def postorder(node):","    if node is None:","        return","    postorder(node.left)","    postorder(node.right)","    visit(node)      # 访问当前节点"]},lineMap:{c:{1:2,5:6,6:6},cpp:{1:2,5:6,6:6},java:{1:2,5:6,6:6},python:{1:2,5:7,6:7}}},levelorder:{codes:{c:["// 节点结构 Node { left, right, val } 已定义；队列 Queue 已定义","void levelorder(Node* root) {","    enqueue(root);","    while (!queueEmpty()) {","        Node* node = dequeue();","        visit(node);              // 访问当前节点","        if (node->left) enqueue(node->left);","        if (node->right) enqueue(node->right);","    }","}"],cpp:["// 节点结构 Node { left, right, val } 已定义；队列 std::queue 已定义","void levelorder(Node* root) {","    queue<Node*> q; q.push(root);","    while (!q.empty()) {","        Node* node = q.front(); q.pop();","        visit(node);              // 访问当前节点","        if (node->left) q.push(node->left);","        if (node->right) q.push(node->right);","    }","}"],java:["// 节点类 Node { left, right, val } 已定义；队列 Queue 已定义","void levelorder(Node root) {","    Queue<Node> q = new LinkedList<>(); q.add(root);","    while (!q.isEmpty()) {","        Node node = q.poll();","        visit(node);              // 访问当前节点","        if (node.left != null) q.add(node.left);","        if (node.right != null) q.add(node.right);","    }","}"],python:["# 节点类 Node（含 left/right/val）已定义","def levelorder(root):","    queue = [root]","    while queue:","        node = queue.pop(0)","        visit(node)      # 访问当前节点","        if node.left:","            queue.append(node.left)","        if node.right:","            queue.append(node.right)"]},lineMap:{c:{2:3,4:6,5:7,6:8,7:9},cpp:{2:3,4:6,5:7,6:8,7:9},java:{2:3,4:6,5:7,6:8,7:9},python:{2:3,4:6,5:7,6:9,7:10}}},bst_search:{codes:{c:["// 节点结构 Node { left, right, val } 已定义","Node* search(Node* node, int target) {","    if (node == NULL) return NULL;","    if (node->val == target) return node;   // 找到","    if (target < node->val) return search(node->left, target);","    return search(node->right, target);","}"],cpp:["// 节点结构 Node { left, right, val } 已定义","Node* search(Node* node, int target) {","    if (node == nullptr) return nullptr;","    if (node->val == target) return node;   // 找到","    if (target < node->val) return search(node->left, target);","    return search(node->right, target);","}"],java:["// 节点类 Node { left, right, val } 已定义","Node search(Node node, int target) {","    if (node == null) return null;","    if (node.val == target) return node;   // 找到","    if (target < node.val) return search(node.left, target);","    return search(node.right, target);","}"],python:["# 节点类 Node（含 left/right/val）已定义","def search(node, target):","    if node is None:","        return None","    if node.val == target:","        return node","    if target < node.val:","        return search(node.left, target)","    return search(node.right, target)"]},lineMap:{c:{1:2,2:4,3:4,4:5,5:6,7:3},cpp:{1:2,2:4,3:4,4:5,5:6,7:3},java:{1:2,2:4,3:4,4:5,5:6,7:3},python:{1:2,2:5,3:5,4:7,5:9,7:3}}},bfs:{codes:{c:["// 图以邻接表表示；队列 Queue 已定义；visited[] 标记","void bfs(int start) {","    enqueue(start); visited[start] = 1;","    while (!queueEmpty()) {","        int u = dequeue();","        visit(u);              // 访问当前节点","        for (每个邻居 v of u) {","            if (!visited[v]) {","                visited[v] = 1; enqueue(v);","            }","        }","    }","}"],cpp:["// 图以邻接表表示；队列 std::queue 已定义；visited[] 标记","void bfs(int start) {","    queue<int> q; q.push(start); visited[start] = 1;","    while (!q.empty()) {","        int u = q.front(); q.pop();","        visit(u);              // 访问当前节点","        for (int v : adj[u]) {","            if (!visited[v]) {","                visited[v] = 1; q.push(v);","            }","        }","    }","}"],java:["// 图以邻接表表示；队列 Queue 已定义；visited[] 标记","void bfs(int start) {","    Queue<Integer> q = new LinkedList<>(); q.add(start); visited[start] = 1;","    while (!q.isEmpty()) {","        int u = q.poll();","        visit(u);              // 访问当前节点","        for (int v : adj[u]) {","            if (visited[v] == 0) {","                visited[v] = 1; q.add(v);","            }","        }","    }","}"],python:["# 图以邻接表 adj 表示；visited 为集合","def bfs(start):","    queue = [start]","    visited.add(start)","    while queue:","        u = queue.pop(0)","        visit(u)       # 访问当前节点","        for v in adj[u]:","            if v not in visited:","                visited.add(v)","                queue.append(v)"]},lineMap:{c:{2:3,4:6,6:9,8:12},cpp:{2:3,4:6,6:9,8:12},java:{2:3,4:6,6:9,8:12},python:{2:3,4:7,6:9,8:11}}},dfs:{codes:{c:["// 图以邻接表表示；visited[] 标记","void dfs(int u) {","    visited[u] = 1;","    visit(u);              // 访问当前节点","    for (每个邻居 v of u) {","        if (!visited[v]) {","            dfs(v);        // 递归深入","        }","    }","    // u 的邻接访问完，回溯","}"],cpp:["// 图以邻接表表示；visited[] 标记","void dfs(int u) {","    visited[u] = 1;","    visit(u);              // 访问当前节点","    for (int v : adj[u]) {","        if (!visited[v]) {","            dfs(v);        // 递归深入","        }","    }","    // u 的邻接访问完，回溯","}"],java:["// 图以邻接表表示；visited[] 标记","void dfs(int u) {","    visited[u] = 1;","    visit(u);              // 访问当前节点","    for (int v : adj[u]) {","        if (visited[v] == 0) {","            dfs(v);        // 递归深入","        }","    }","    // u 的邻接访问完，回溯","}"],python:["# 图以邻接表 adj 表示；visited 为集合","def dfs(u):","    visited.add(u)","    visit(u)       # 访问当前节点","    for v in adj[u]:","        if v not in visited:","            dfs(v)      # 递归深入","    # u 的邻接访问完，回溯"]},lineMap:{c:{1:2,3:4,4:7,5:10,6:9},cpp:{1:2,3:4,4:7,5:10,6:9},java:{1:2,3:4,4:7,5:10,6:9},python:{1:2,3:4,4:7,5:8,6:8}}},dijkstra:{codes:{c:["// 图以邻接表表示（边带权 w）；dist[] 初始 INF，done[] 标记已确定","void dijkstra(int start) {","    dist[start] = 0;","    for (int k = 0; k < n; k++) {","        int u = -1;","        for (int i = 0; i < n; i++)","            if (!done[i] && (u == -1 || dist[i] < dist[u])) u = i;","        done[u] = 1;","        for (每个邻居 (v, w) of u) {","            if (dist[u] + w < dist[v]) {","                dist[v] = dist[u] + w;   // 松弛","            }","        }","    }","}"],cpp:["// 图以邻接表表示（边带权 w）；dist[] 初始 INF，done[] 标记已确定","void dijkstra(int start) {","    dist[start] = 0;","    for (int k = 0; k < n; k++) {","        int u = -1;","        for (int i = 0; i < n; i++)","            if (!done[i] && (u == -1 || dist[i] < dist[u])) u = i;","        done[u] = 1;","        for (每个邻居 (v, w) of u) {","            if (dist[u] + w < dist[v]) {","                dist[v] = dist[u] + w;   // 松弛","            }","        }","    }","}"],java:["// 图以邻接表表示（边带权 w）；dist[] 初始为无穷大，done[] 标记已确定","void dijkstra(int start) {","    dist[start] = 0;","    for (int k = 0; k < n; k++) {","        int u = -1;","        for (int i = 0; i < n; i++)","            if (done[i] == 0 && (u == -1 || dist[i] < dist[u])) u = i;","        done[u] = 1;","        for (每个邻居 (v, w) of u) {","            if (dist[u] + w < dist[v]) {","                dist[v] = dist[u] + w;   // 松弛","            }","        }","    }","}"],python:["# 图以邻接表 adj 表示（边带权 w）；dist 初始为无穷大，done 标记已确定","def dijkstra(start):","    dist[start] = 0","    for _ in range(n):","        u = -1","        for i in range(n):","            if not done[i] and (u == -1 or dist[i] < dist[u]):","                u = i","        done[u] = True","        for v, w in adj[u]:","            if dist[u] + w < dist[v]:","                dist[v] = dist[u] + w   # 松弛"]},lineMap:{c:{1:3,3:8,5:11,7:14},cpp:{1:3,3:8,5:11,7:14},java:{1:3,3:8,5:11,7:14},python:{1:3,3:9,5:12,7:12}}}};function y(s,t,i,n,o,r={}){s.push({array:[...t],sorted:[...i],codeLine:n,desc:o,...r})}function Ft(s){const t=[...s],i=[],n=[];y(i,t,n,1,"初始数组");for(let o=0;o<t.length-1;o++){for(let r=0;r<t.length-1-o;r++)y(i,t,n,4,`比较 a[${r}]=${t[r]} 与 a[${r+1}]=${t[r+1]}`,{compare:[r,r+1]}),t[r]>t[r+1]&&([t[r],t[r+1]]=[t[r+1],t[r]],y(i,t,n,5,`交换 a[${r}] 与 a[${r+1}]`,{swap:[r,r+1]}));n.push(t.length-1-o),y(i,t,n,2,`第 ${o+1} 趟结束，a[${t.length-1-o}]=${t[t.length-1-o]} 已就位`)}return n.push(0),y(i,t,n,7,"排序完成"),i}function Xt(s){const t=[...s],i=[],n=[];y(i,t,n,1,"初始数组");for(let o=0;o<t.length-1;o++){let r=o;y(i,t,n,3,`假设最小值在 a[${o}]`,{pivot:o});for(let e=o+1;e<t.length;e++)y(i,t,n,4,`比较 a[${e}]=${t[e]} 与当前最小 a[${r}]=${t[r]}`,{compare:[e,r]}),t[e]<t[r]&&(r=e,y(i,t,n,5,`更新最小值下标为 ${e}`,{pivot:e}));r!==o&&([t[o],t[r]]=[t[r],t[o]],y(i,t,n,6,`把最小值换到 a[${o}]`,{swap:[o,r]})),n.push(o),y(i,t,n,2,`a[${o}] 已就位`)}return n.push(t.length-1),y(i,t,n,8,"排序完成"),i}function It(s){const t=[...s],i=[],n=[0];y(i,t,n,1,"初始数组（a[0] 视为已排序）");for(let o=1;o<t.length;o++){const r=t[o];let e=o-1;for(y(i,t,n,3,`取出 key = a[${o}] = ${r}`,{pivot:o});e>=0&&t[e]>r;)t[e+1]=t[e],y(i,t,n,5,`a[${e}]=${t[e]} 右移到 a[${e+1}]`,{swap:[e,e+1]}),e--;t[e+1]=r,n.push(o),y(i,t,n,6,`把 key 插入到 a[${e+1}]`,{pivot:e+1})}return y(i,t,n,7,"排序完成"),i}function Ut(s){const t=[...s],i=[],n=[];y(i,t,n,1,"初始数组");function o(e,c){const m=t[e];y(i,t,n,3,`选枢轴 pivot = a[${e}] = ${m}`,{pivot:e});let f=e,j=c;for(;f<j;){for(;f<j&&t[j]>=m;)j--,y(i,t,n,5,`j 左移找小于 pivot 的元素 → j=${j}`,{compare:[j],pivot:e});for(f<j&&(t[f]=t[j],y(i,t,n,6,`a[${f}] = a[${j}] = ${t[f]}`,{swap:[f,j],pivot:e}));f<j&&t[f]<=m;)f++,y(i,t,n,7,`i 右移找大于 pivot 的元素 → i=${f}`,{compare:[f],pivot:e});f<j&&(t[j]=t[f],y(i,t,n,8,`a[${j}] = a[${f}] = ${t[j]}`,{swap:[f,j],pivot:e}))}return t[f]=m,y(i,t,n,9,`枢轴归位到 a[${f}] = ${m}`,{pivot:f}),f}function r(e,c){if(e>=c){e===c&&(n.push(e),y(i,t,n,10,`a[${e}] 已就位`));return}const m=o(e,c);n.push(m),y(i,t,n,10,`a[${m}] 已就位`),r(e,m-1),r(m+1,c)}return r(0,t.length-1),y(i,t,n,12,"排序完成"),i}function Qt(s){const t=[...s],i=[],n=[];y(i,t,n,1,"初始数组");function o(e,c,m){const f=[];let j=e,q=c+1;for(;j<=c&&q<=m;)y(i,t,n,5,`比较 a[${j}]=${t[j]} 与 a[${q}]=${t[q]}`,{compare:[j,q]}),t[j]<=t[q]?f.push(t[j++]):f.push(t[q++]);for(;j<=c;)f.push(t[j++]);for(;q<=m;)f.push(t[q++]);for(let l=0;l<f.length;l++)t[e+l]=f[l],y(i,t,n,7,`把 ${f[l]} 写回 a[${e+l}]`,{swap:[e+l]});y(i,t,n,8,`[${e},${m}] 合并完成`)}function r(e,c){if(e>=c)return;const m=e+c>>1;y(i,t,n,3,`分解 [${e},${c}] → [${e},${m}] 与 [${m+1},${c}]`),r(e,m),r(m+1,c),o(e,m,c)}r(0,t.length-1);for(let e=0;e<t.length;e++)n.push(e);return y(i,t,n,10,"排序完成"),i}function Rt(s){const t=[...s],i=[],n=[],o=t.length;y(i,t,n,1,"初始数组（视为完全二叉树）");function r(e,c){let m=e;for(;m*2+1<=c;){let f=m*2+1;if(f+1<=c&&(y(i,t,n,4,`比较左右孩子 a[${f}] 与 a[${f+1}]`,{compare:[f,f+1],pivot:m}),t[f]<t[f+1]&&f++),y(i,t,n,5,`比较 a[${m}]=${t[m]} 与 a[${f}]=${t[f]}`,{compare:[m,f]}),t[m]<t[f])[t[m],t[f]]=[t[f],t[m]],y(i,t,n,6,`交换 a[${m}] 与 a[${f}]`,{swap:[m,f]}),m=f;else break}}for(let e=(o>>1)-1;e>=0;e--)y(i,t,n,3,`对结点 a[${e}] 下滤建堆`,{pivot:e}),r(e,o-1);y(i,t,n,3,"建堆完成（大顶堆）");for(let e=o-1;e>0;e--)[t[0],t[e]]=[t[e],t[0]],y(i,t,n,8,`交换堆顶 a[0] 与末尾 a[${e}]`,{swap:[0,e]}),n.push(e),y(i,t,n,9,`a[${e}]=${t[e]} 已就位`),r(0,e-1);return n.push(0),y(i,t,n,11,"排序完成"),i}function Gt(s,t){const i=[...s].sort((e,c)=>e-c),n=[];y(n,i,[],1,`在有序数组中查找 ${t}`);let o=0,r=i.length-1;for(;o<=r;){const e=o+r>>1;if(y(n,i,[],3,`mid = (${o}+${r})/2 = ${e}`,{pivot:e}),y(n,i,[],4,`比较 a[${e}]=${i[e]} 与 ${t}`,{compare:[e]}),i[e]===t)return n.concat([{array:[...i],sorted:[e],codeLine:5,desc:`找到！位置在 a[${e}]`}]);i[e]<t?(o=e+1,y(n,i,[],7,`${i[e]} < ${t}，向右半边找`,{pivot:e})):(r=e-1,y(n,i,[],6,`${i[e]} > ${t}，向左半边找`,{pivot:e}))}return y(n,i,[],9,"查找结束，目标不存在"),n}const G={nodes:[{id:0,value:8,left:1,right:2,x:320,y:46},{id:1,value:3,left:3,right:4,x:180,y:126},{id:2,value:10,left:null,right:5,x:460,y:126},{id:3,value:1,left:null,right:null,x:110,y:206},{id:4,value:6,left:6,right:7,x:250,y:206},{id:5,value:14,left:null,right:null,x:530,y:206},{id:6,value:4,left:null,right:null,x:210,y:286},{id:7,value:7,left:null,right:null,x:290,y:286}],root:0},st={nodes:[{id:0,label:"A",x:140,y:90},{id:1,label:"B",x:330,y:40},{id:2,label:"C",x:330,y:170},{id:3,label:"D",x:520,y:90},{id:4,label:"E",x:520,y:210},{id:5,label:"F",x:220,y:260}],edges:[{from:0,to:1,w:4},{from:0,to:2,w:2},{from:1,to:3,w:5},{from:2,to:1,w:1},{from:2,to:4,w:10},{from:3,to:4,w:2},{from:2,to:5,w:3},{from:5,to:4,w:7}]};function it(){const s={};return G.nodes.forEach(t=>{s[t.id]=t}),s}function Y(s){const t=st.nodes.find(i=>i.id===s);return t?t.label:s}function ft(s){return st.edges.filter(t=>t.from===s||t.to===s).map(t=>({to:t.from===s?t.to:t.from,w:t.w}))}function Wt(){const s=[],t=[],i=it();s.push({highlight:null,visited:[],codeLine:1,desc:"从根节点 8 开始前序遍历（根 → 左 → 右）"});function n(o){if(o==null)return;const r=i[o];t.push(o),s.push({highlight:o,visited:[...t],codeLine:3,desc:`访问节点 ${r.value}`}),n(r.left),n(r.right)}return n(G.root),s.push({highlight:null,visited:[...t],codeLine:6,desc:"前序遍历完成：8 3 1 6 4 7 10 14"}),s}function Yt(){const s=[],t=[],i=it();s.push({highlight:null,visited:[],codeLine:1,desc:"从根节点 8 开始中序遍历（左 → 根 → 右）"});function n(o){if(o==null)return;const r=i[o];n(r.left),t.push(o),s.push({highlight:o,visited:[...t],codeLine:4,desc:`访问节点 ${r.value}`}),n(r.right)}return n(G.root),s.push({highlight:null,visited:[...t],codeLine:6,desc:"中序遍历完成：1 3 4 6 7 8 10 14（升序）"}),s}function Ht(){const s=[],t=[],i=it();s.push({highlight:null,visited:[],codeLine:1,desc:"从根节点 8 开始后序遍历（左 → 右 → 根）"});function n(o){if(o==null)return;const r=i[o];n(r.left),n(r.right),t.push(o),s.push({highlight:o,visited:[...t],codeLine:5,desc:`访问节点 ${r.value}`})}return n(G.root),s.push({highlight:null,visited:[...t],codeLine:6,desc:"后序遍历完成：1 4 7 6 3 14 10 8"}),s}function Kt(){const s=[],t=[],i=it(),n=[G.root];for(s.push({highlight:null,queue:[G.root],visited:[],codeLine:2,desc:"根节点 8 入队"});n.length;){const o=n.shift(),r=i[o];t.push(o),s.push({highlight:o,queue:[...n],visited:[...t],codeLine:4,desc:`出队访问节点 ${r.value}`}),r.left!=null&&(n.push(r.left),s.push({highlight:o,queue:[...n],visited:[...t],codeLine:5,desc:`左孩子 ${i[r.left].value} 入队`})),r.right!=null&&(n.push(r.right),s.push({highlight:o,queue:[...n],visited:[...t],codeLine:6,desc:`右孩子 ${i[r.right].value} 入队`}))}return s.push({highlight:null,visited:[...t],codeLine:7,desc:"层序遍历完成：8 3 10 1 6 14 4 7"}),s}function Jt(s,t){const i=t??6,n=[],o=[],r=it();let e=G.root;for(n.push({highlight:e,visited:[],codeLine:1,desc:`从根节点开始查找 ${i}`});e!=null;){const c=r[e];if(n.push({highlight:e,visited:[...o],codeLine:2,desc:`比较 ${c.value} 与 ${i}`}),c.value===i)return o.push(e),n.push({highlight:e,visited:[...o],codeLine:3,desc:`找到目标 ${i}！`}),n;i<c.value?(o.push(e),n.push({highlight:e,visited:[...o],codeLine:4,desc:`${i} < ${c.value}，进入左子树`}),e=c.left):(o.push(e),n.push({highlight:e,visited:[...o],codeLine:5,desc:`${i} > ${c.value}，进入右子树`}),e=c.right)}return n.push({highlight:null,visited:[...o],codeLine:7,desc:"未找到目标"}),n}function Zt(){const s=[],t=new Set([0]),i=[0];for(s.push({current:0,queue:[...i],visited:[...t],codeLine:2,desc:"从 A 开始：A 入队并标记已访问"});i.length;){const n=i.shift();s.push({current:n,queue:[...i],visited:[...t],codeLine:4,desc:`出队访问 ${Y(n)}`});for(const o of ft(n))t.has(o.to)||(t.add(o.to),i.push(o.to),s.push({current:n,queue:[...i],visited:[...t],codeLine:6,desc:`发现新节点 ${Y(o.to)}，入队`}))}return s.push({current:null,queue:[],visited:[...t],codeLine:8,desc:"BFS 遍历完成"}),s}function te(){const s=[],t=new Set;s.push({current:null,visited:[],codeLine:1,desc:"从 A 开始深度优先遍历"});function i(n){t.add(n),s.push({current:n,visited:[...t],codeLine:3,desc:`访问节点 ${Y(n)}`});for(const o of ft(n))t.has(o.to)||(s.push({current:n,visited:[...t],codeLine:4,desc:`发现 ${Y(o.to)}，递归深入`}),i(o.to));s.push({current:n,visited:[...t],codeLine:5,desc:`${Y(n)} 的邻接已访问完，回溯`})}return i(0),s.push({current:null,visited:[...t],codeLine:6,desc:"DFS 遍历完成"}),s}function ee(){const s=st.nodes.length,t=Array(s).fill(1/0),i=new Set;t[0]=0;const n=[];n.push({current:0,dist:[...t],done:[...i],codeLine:1,desc:"初始化：dist[A]=0，其余为 ∞"});for(let o=0;o<s;o++){let r=-1,e=1/0;for(let c=0;c<s;c++)!i.has(c)&&t[c]<e&&(e=t[c],r=c);if(r===-1)break;i.add(r),n.push({current:r,dist:[...t],done:[...i],codeLine:3,desc:`选距离最小的 ${Y(r)}（dist=${t[r]}），标记确定`});for(const c of ft(r))t[r]+c.w<t[c.to]&&(t[c.to]=t[r]+c.w,n.push({current:r,dist:[...t],done:[...i],codeLine:5,desc:`松弛 ${Y(c.to)}：dist=${t[c.to]}`}))}return n.push({current:null,dist:[...t],done:[...i],codeLine:7,desc:"Dijkstra 完成，得到 A 到各点的最短距离"}),n}const K={bubble:{name:"冒泡排序",category:"排序",generate:Ft,code:["for i = 0 to n-2:","  # 第 i 趟把最大值冒到最后","  for j = 0 to n-2-i:","    if a[j] > a[j+1]:","      swap(a[j], a[j+1])","    end if","  end for","end for"],codeMap:{compare:4,swap:5}},selection:{name:"选择排序",category:"排序",generate:Xt,code:["for i = 0 to n-2:","  # 每轮找未排序部分的最小值","  min = i","  for j = i+1 to n-1:","    if a[j] < a[min]:","      min = j","    end if","  end for","  swap(a[i], a[min])","end for"]},insertion:{name:"插入排序",category:"排序",generate:It,code:["for i = 1 to n-1:","  # 把 a[i] 插入已排序部分","  key = a[i]","  j = i - 1","  while j >= 0 and a[j] > key:","    a[j+1] = a[j]","    j = j - 1","  end while","  a[j+1] = key","end for"]},quick:{name:"快速排序",category:"排序",generate:Ut,code:["quicksort(low, high):","  if low >= high: return","  pivot = a[low]","  i, j = low, high","  while i < j:","    while a[j] >= pivot: j--","    a[i] = a[j]","    while a[i] <= pivot: i++","    a[j] = a[i]","  a[i] = pivot","  quicksort(low, i-1)","  quicksort(i+1, high)"]},merge:{name:"归并排序",category:"排序",generate:Qt,code:["mergesort(l, r):","  if l >= r: return","  mid = (l + r) / 2","  mergesort(l, mid)","  mergesort(mid+1, r)","  # 合并两个有序子数组","  merge(l, mid, r)"]},heap:{name:"堆排序",category:"排序",generate:Rt,code:["buildHeap():","  for i = n/2-1 downto 0:","    siftDown(i)","  for end = n-1 downto 1:","    swap(a[0], a[end])","    siftDown(0, end-1)","siftDown(root):","  child = 2*root+1","  if child+1 <= end:","    child = max(child, child+1)","  if a[root] < a[child]:","    swap(a[root], a[child])","    siftDown(child)"]},binary:{name:"二分查找",category:"查找",generate:Gt,code:["binarySearch(a, target):","  l, r = 0, len(a)-1","  while l <= r:","    mid = (l + r) / 2","    if a[mid] == target: return mid","    elif a[mid] < target:","      l = mid + 1","    else:","      r = mid - 1","  return -1"],needsTarget:!0},preorder:{name:"前序遍历",category:"树",renderer:"tree",fixed:!0,generate:Wt,code:["preorder(node):","  if node == null: return","  visit(node)","  preorder(node.left)","  preorder(node.right)","end"]},inorder:{name:"中序遍历",category:"树",renderer:"tree",fixed:!0,generate:Yt,code:["inorder(node):","  if node == null: return","  inorder(node.left)","  visit(node)","  inorder(node.right)","end"]},postorder:{name:"后序遍历",category:"树",renderer:"tree",fixed:!0,generate:Ht,code:["postorder(node):","  if node == null: return","  postorder(node.left)","  postorder(node.right)","  visit(node)","end"]},levelorder:{name:"层序遍历",category:"树",renderer:"tree",fixed:!0,generate:Kt,code:["levelorder(root):","  queue = [root]","  while queue not empty:","    node = queue.pop(); visit(node)","    if node.left: queue.push(node.left)","    if node.right: queue.push(node.right)","end"]},bst_search:{name:"BST 查找",category:"树",renderer:"tree",fixed:!0,needsTarget:!0,generate:Jt,code:["search(node, target):","  if node == null: return null","  if node.value == target: return node","  if target < node.value:","    return search(node.left, target)","  return search(node.right, target)","end"]},bfs:{name:"广度优先 BFS",category:"图",renderer:"graph",fixed:!0,generate:Zt,code:["BFS(graph, start):","  queue = [start]; visited = {start}","  while queue not empty:","    u = queue.pop()","    visit(u)","    for v in neighbors(u):","      if v not in visited:","        visited.add(v); queue.push(v)"]},dfs:{name:"深度优先 DFS",category:"图",renderer:"graph",fixed:!0,generate:te,code:["DFS(u):","  visited.add(u)","  visit(u)","  for v in neighbors(u):","    if v not in visited: DFS(v)","end"]},dijkstra:{name:"最短路径 Dijkstra",category:"图",renderer:"graph",fixed:!0,generate:ee,code:["dijkstra(graph, start):","  dist[start] = 0, others = ∞","  repeat n times:","    u = min-dist unvisited node","    mark u visited","    for (v, w) in neighbors(u):","      dist[v] = min(dist[v], dist[u] + w)"]}},ne=Object.keys(K);for(const s of ne){const t=Et[s];t&&(K[s].codes=t.codes,K[s].lineMap=t.lineMap)}const dt=G,ut=st,ie=["value","min","max","step","disabled"],ae={__name:"UiSlider",props:{modelValue:{type:Number,default:0},min:{type:Number,default:0},max:{type:Number,default:100},step:{type:Number,default:1},disabled:{type:Boolean,default:!1}},emits:["update:modelValue","change"],setup(s,{emit:t}){const i=s,n=t;function o(r){const e=Number(r.target.value);e!==i.modelValue&&n("update:modelValue",e)}return(r,e)=>(d(),p("input",{class:"ui-slider",type:"range",value:s.modelValue,min:s.min,max:s.max,step:s.step,disabled:s.disabled,onInput:o,onChange:e[0]||(e[0]=c=>r.$emit("change",Number(c.target.value)))},null,40,ie))}},re=H(ae,[["__scopeId","data-v-09bb475b"]]),oe={class:"algo-player"},se={class:"main-row"},le={class:"code-panel"},de={class:"panel-title"},ue={class:"line-no"},ce={class:"line-text"},fe={class:"bar-val"},pe={key:1,viewBox:"0 0 640 320",class:"svg-canvas"},me=["x1","y1","x2","y2"],ge=["cx","cy"],xe=["x","y"],ve={key:2,viewBox:"0 0 640 300",class:"svg-canvas"},he=["x1","y1","x2","y2"],_e=["x","y"],ye=["cx","cy"],be=["x","y"],we=["x","y"],ke={class:"desc"},qe={class:"legend"},je={key:0,class:"lg"},Se={class:"controls"},$e={class:"stats"},bt=240,Ae={__name:"AlgoPlayer",props:{algorithm:{type:Object,required:!0},data:{type:Array,required:!0},target:{type:Number,default:null},lang:{type:String,default:"c"}},setup(s){const t=[{label:"0.5×",value:.5},{label:"1×",value:1},{label:"2×",value:2},{label:"4×",value:4}],i=s,n=N(0),o=N(!1),r=N(1);let e=null;const c=C(()=>i.algorithm.renderer||"array"),m=C(()=>(qt.find(_=>_.key===i.lang)||{}).label||i.lang),f=C(()=>{var _;return((_=i.algorithm.codes)==null?void 0:_[i.lang])||[]}),j=C(()=>{var g,x;const _=(x=(g=i.algorithm.lineMap)==null?void 0:g[i.lang])==null?void 0:x[L.value.codeLine];return _==null?[]:Array.isArray(_)?_:[_]});function q(_){return j.value.includes(_+1)}const l=C(()=>{const _=i.algorithm,g=[...i.data];return _.needsTarget?_.generate(g,i.target):_.generate(g)}),L=C(()=>l.value[Math.min(n.value,l.value.length-1)]||l.value[0]),M=C(()=>L.value.array||[]),$=C(()=>Math.max(...M.value,1)),u=N(null),S=N(560);function h(){u.value&&(S.value=u.value.clientWidth||560)}const b=C(()=>{const _=M.value.length;return Math.max(12,Math.min(42,(S.value-(_+1)*6)/_))});function v(_,g){M.value.length;const x=6,E=g*(b.value+x)+x,Ct=Math.max(14,_/$.value*(bt-46)+16);return{left:E+"px",width:b.value+"px",height:Ct+"px"}}function k(_){const g=L.value;return g.sorted&&g.sorted.includes(_)?"sorted":g.swap&&g.swap.includes(_)?"swap":g.pivot===_?"pivot":g.compare&&g.compare.includes(_)?"compare":""}const T=C(()=>{const _={};dt.nodes.forEach(x=>{_[x.id]=x});const g=[];for(const x of dt.nodes)x.left!=null&&g.push({x1:x.x,y1:x.y,x2:_[x.left].x,y2:_[x.left].y}),x.right!=null&&g.push({x1:x.x,y1:x.y,x2:_[x.right].x,y2:_[x.right].y});return g});function pt(_){const g=L.value;return g.highlight===_?"current":g.visited&&g.visited.includes(_)?"visited":"normal"}function R(_){return ut.nodes.find(x=>x.id===_)||{x:0,y:0}}function jt(_){const g=L.value;return g.current===_?"current":g.done&&g.done.includes(_)||g.visited&&g.visited.includes(_)?"visited":g.queue&&g.queue.includes(_)?"queued":"normal"}const mt=C(()=>L.value.dist!=null);function St(_){const g=L.value.dist?L.value.dist[_]:1/0;return g===1/0?"∞":String(g)}const $t=C(()=>{let _=0;for(let g=0;g<=n.value;g++)l.value[g].compare&&_++;return _}),At=C(()=>{let _=0;for(let g=0;g<=n.value;g++)l.value[g].swap&&_++;return _});function J(){e&&(clearTimeout(e),e=null)}function gt(){J(),e=setTimeout(()=>{if(n.value>=l.value.length-1){o.value=!1;return}n.value++,o.value&&gt()},500/r.value)}function Ot(){o.value?(o.value=!1,J()):(n.value>=l.value.length-1&&(n.value=0),o.value=!0,gt())}function Lt(){n.value<l.value.length-1&&n.value++}function zt(){n.value>0&&n.value--}function xt(){o.value=!1,J(),n.value=0}function Nt(){o.value=!1,J()}return et(()=>[i.data,i.algorithm,i.target],()=>{xt()},{deep:!0}),nt(()=>{h(),window.addEventListener("resize",h)}),ot(()=>{J(),window.removeEventListener("resize",h)}),(_,g)=>(d(),p("div",oe,[a("div",se,[a("div",le,[a("div",de,w(s.algorithm.name)+" · "+w(m.value),1),(d(!0),p(O,null,P(f.value,(x,E)=>(d(),p("div",{key:E,class:tt(["code-line",{active:q(E)}])},[a("span",ue,w(E+1),1),a("span",ce,w(x),1)],2))),128))]),a("div",{ref_key:"canvasRef",ref:u,class:"canvas"},[c.value==="array"?(d(),p("div",{key:0,class:"bars",style:vt({height:bt+"px"})},[(d(!0),p(O,null,P(M.value,(x,E)=>(d(),p("div",{key:E,class:tt(["bar",k(E)]),style:vt(v(x,E))},[a("span",fe,w(x),1)],6))),128))],4)):c.value==="tree"?(d(),p("svg",pe,[(d(!0),p(O,null,P(T.value,(x,E)=>(d(),p("line",{key:"tl"+E,x1:x.x1,y1:x.y1,x2:x.x2,y2:x.y2,class:"edge"},null,8,me))),128)),(d(!0),p(O,null,P(I(dt).nodes,x=>(d(),p("g",{key:x.id},[a("circle",{cx:x.x,cy:x.y,r:"18",class:tt(pt(x.id))},null,10,ge),a("text",{x:x.x,y:x.y,class:"node-val","dominant-baseline":"central","text-anchor":"middle"},w(x.value),9,xe)]))),128))])):(d(),p("svg",ve,[(d(!0),p(O,null,P(I(ut).edges,(x,E)=>(d(),p("g",{key:"ge"+E},[a("line",{x1:R(x.from).x,y1:R(x.from).y,x2:R(x.to).x,y2:R(x.to).y,class:"edge"},null,8,he),a("text",{x:(R(x.from).x+R(x.to).x)/2,y:(R(x.from).y+R(x.to).y)/2-4,class:"edge-w","text-anchor":"middle"},w(x.w),9,_e)]))),128)),(d(!0),p(O,null,P(I(ut).nodes,x=>(d(),p("g",{key:x.id},[a("circle",{cx:x.x,cy:x.y,r:"22",class:tt(jt(x.id))},null,10,ye),a("text",{x:x.x,y:x.y,class:"node-val","dominant-baseline":"central","text-anchor":"middle"},w(x.label),9,be),mt.value?(d(),p("text",{key:0,x:x.x,y:x.y+38,class:"dist-val","text-anchor":"middle"},w(St(x.id)),9,we)):V("",!0)]))),128))])),a("div",ke,w(L.value.desc),1),a("div",qe,[c.value==="array"?(d(),p(O,{key:0},[g[2]||(g[2]=ht('<span class="lg" data-v-e3caed66><i class="dot compare" data-v-e3caed66></i>比较</span><span class="lg" data-v-e3caed66><i class="dot swap" data-v-e3caed66></i>交换/移动</span><span class="lg" data-v-e3caed66><i class="dot sorted" data-v-e3caed66></i>已就位</span><span class="lg" data-v-e3caed66><i class="dot pivot" data-v-e3caed66></i>枢轴/当前</span>',4))],64)):c.value==="tree"?(d(),p(O,{key:1},[g[3]||(g[3]=a("span",{class:"lg"},[a("i",{class:"dot current"}),D("当前访问")],-1)),g[4]||(g[4]=a("span",{class:"lg"},[a("i",{class:"dot visited"}),D("已访问")],-1))],64)):(d(),p(O,{key:2},[g[6]||(g[6]=ht('<span class="lg" data-v-e3caed66><i class="dot current" data-v-e3caed66></i>当前</span><span class="lg" data-v-e3caed66><i class="dot visited" data-v-e3caed66></i>已访问</span><span class="lg" data-v-e3caed66><i class="dot queued" data-v-e3caed66></i>队列中</span>',3)),mt.value?(d(),p("span",je,[...g[5]||(g[5]=[a("i",{class:"dot normal"},null,-1),D("下方数字 = 最短距离",-1)])])):V("",!0)],64))])],512)]),a("div",Se,[z(Q,{variant:"ghost",size:"sm",disabled:n.value<=0,onClick:zt},{default:X(()=>[...g[7]||(g[7]=[D("◀ 上一步",-1)])]),_:1},8,["disabled"]),z(Q,{variant:"primary",size:"sm",onClick:Ot},{default:X(()=>[D(w(o.value?"⏸ 暂停":"▶ 播放"),1)]),_:1}),z(Q,{variant:"ghost",size:"sm",disabled:n.value>=l.value.length-1,onClick:Lt},{default:X(()=>[...g[8]||(g[8]=[D("下一步 ▶",-1)])]),_:1},8,["disabled"]),z(Bt,{modelValue:r.value,"onUpdate:modelValue":g[0]||(g[0]=x=>r.value=x),options:t,"aria-label":"播放速度"},null,8,["modelValue"]),z(Q,{variant:"ghost",size:"sm",onClick:xt},{default:X(()=>[...g[9]||(g[9]=[D("⟳ 重置",-1)])]),_:1}),a("span",$e,"比较 "+w($t.value)+" · 交换 "+w(At.value)+" · 步 "+w(n.value+1)+"/"+w(l.value.length),1)]),z(re,{modelValue:n.value,"onUpdate:modelValue":g[1]||(g[1]=x=>n.value=x),min:0,max:l.value.length-1,onChange:Nt},null,8,["modelValue","max"])]))}},Oe=H(Ae,[["__scopeId","data-v-e3caed66"]]),Le={class:"algo"},ze={class:"algo__toolbar"},Ne={class:"algo__select"},Ce={class:"algo__lang"},Pe={class:"algo__size"},Me={class:"t-label"},De={class:"algo__target"},Ve={key:0,class:"t-label algo__data"},Be={key:1,class:"t-label algo__data"},Te={__name:"AlgoDemo",props:{initialAlgo:{type:String,default:null}},setup(s){const t=s,i=N("bubble"),n=N("c"),o=N(10),r=N([]),e=N(6),c=C(()=>K[i.value]),m=C(()=>!!c.value.fixed),f=$=>Object.entries(K).filter(([,u])=>u.category===$).map(([u,S])=>({label:S.name,value:u})),j=C(()=>[{label:"排序",options:f("排序")},{label:"查找",options:f("查找")},{label:"树",options:f("树")},{label:"图",options:f("图")}].filter($=>$.options.length)),q=[{label:"6 个",value:6},{label:"10 个",value:10},{label:"15 个",value:15},{label:"20 个",value:20}],l=qt.map($=>({label:$.label,value:$.key}));function L(){const $=[];for(let u=0;u<Number(o.value);u++)$.push(Math.floor(Math.random()*90)+10);c.value.needsTarget&&!c.value.fixed&&($.sort((u,S)=>u-S),e.value=$[Math.floor($.length/2)]),r.value=$}function M(){c.value.fixed?(c.value.needsTarget&&(e.value=6),r.value=[]):L()}return et(i,M),nt(M),et(()=>t.initialAlgo,$=>{$&&K[$]&&(i.value=$)},{immediate:!0}),($,u)=>(d(),p("div",Le,[a("div",ze,[a("div",Ne,[z(at,{modelValue:i.value,"onUpdate:modelValue":u[0]||(u[0]=S=>i.value=S),options:j.value},null,8,["modelValue","options"])]),a("div",Ce,[z(at,{modelValue:n.value,"onUpdate:modelValue":u[1]||(u[1]=S=>n.value=S),options:I(l),"aria-label":"代码语言"},null,8,["modelValue","options"])]),m.value?V("",!0):(d(),p(O,{key:0},[z(Q,{variant:"ghost",size:"sm",onClick:L},{default:X(()=>[...u[4]||(u[4]=[D("⟳ 随机数据",-1)])]),_:1}),a("div",Pe,[z(at,{modelValue:o.value,"onUpdate:modelValue":u[2]||(u[2]=S=>o.value=S),modelModifiers:{number:!0},size:"sm",options:q,onChange:L},null,8,["modelValue"])])],64)),c.value.needsTarget?(d(),p(O,{key:1},[a("span",Me,w(m.value?"目标值":"查找目标"),1),a("div",De,[z(Tt,{modelValue:e.value,"onUpdate:modelValue":u[3]||(u[3]=S=>e.value=S),min:0,max:99,size:"sm"},null,8,["modelValue"])])],64)):V("",!0)]),m.value?(d(),p("p",Be,w(c.value.name)+"使用预定义结构，播放下方动画即可。 ",1)):(d(),p("p",Ve," 当前数据：["+w(r.value.join(", "))+"]（"+w(r.value.length)+" 个） ",1)),(d(),B(Oe,{key:i.value+":"+(m.value?"fixed":r.value.join("-")),algorithm:c.value,data:r.value,target:e.value,lang:n.value},null,8,["algorithm","data","target","lang"]))]))}},Ee=H(Te,[["__scopeId","data-v-5d1a028b"]]),Fe={class:"cd surface-standard"},Xe={class:"cd__grid"},Ie={class:"cd__col"},Ue={class:"cd__col"},Qe={class:"cd__col cd__col--full"},Re={class:"cd__ops"},Ge={key:0,class:"cd__result"},We={class:"cd__result-head"},Ye={key:0,class:"cd__block"},He={key:1,class:"cd__block"},Ke={key:2,class:"cd__block"},Je={key:3,class:"cd__block"},Ze={key:4,class:"cd__block"},tn={class:"cd__tags"},en={key:5,class:"cd__block"},nn={__name:"CodeDebug",setup(s){const t=[{label:"Python",value:"python"},{label:"C",value:"c"},{label:"C++",value:"cpp"},{label:"Java",value:"java"}],i=N(null),n=N(""),o=N(""),r=N(""),e=N(null),c=N(!1);let m=null;nt(()=>{window.CodeMirror&&(m=window.CodeMirror.fromTextArea(i.value,{mode:"text/x-python",lineNumbers:!0,indentUnit:4,tabSize:4,lineWrapping:!1,viewportMargin:12,placeholder:"// 在这里粘贴你的代码"}))}),ot(()=>{m&&(m.toTextArea(),m=null)});function f(q){return q.includes("语法")?"error":q.includes("逻辑")?"warning":q.includes("运行")?"error":(q.includes("性能"),"info")}async function j(){const q=Date.now(),l=m?m.getValue():"";if(!l.trim()){W.warning("请先粘贴代码");return}c.value=!0,e.value=null;try{e.value=await kt.debug(l,o.value,n.value,r.value),W.success("诊断完成"),rt("debug",{title:r.value||"代码诊断",brief:n.value||"自动识别",minutes:(Date.now()-q)/6e4})}catch(L){W.error(L.message)}finally{c.value=!1}}return(q,l)=>(d(),p("div",Fe,[l[14]||(l[14]=a("h3",{class:"t-h2 cd__title"},"代码诊断",-1)),l[15]||(l[15]=a("p",{class:"t-body-2 cd__desc"},"贴上你的代码（和报错信息），AI 帮你定位错误、解释原因、给出修正后的代码。",-1)),l[16]||(l[16]=a("p",{class:"t-label cd__label"},"你的代码",-1)),a("textarea",{ref_key:"ta",ref:i},null,512),a("div",Xe,[a("label",Ie,[l[3]||(l[3]=a("span",{class:"t-label cd__label"},"语言（可选，不填自动识别）",-1)),z(at,{modelValue:n.value,"onUpdate:modelValue":l[0]||(l[0]=L=>n.value=L),options:t,placeholder:"自动识别"},null,8,["modelValue"])]),a("label",Ue,[l[4]||(l[4]=a("span",{class:"t-label cd__label"},"报错信息（可选）",-1)),z(ct,{modelValue:o.value,"onUpdate:modelValue":l[1]||(l[1]=L=>o.value=L),type:"textarea",rows:2,placeholder:"如编译器/运行时的报错，或「输出不对」等"},null,8,["modelValue"])])]),a("label",Qe,[l[5]||(l[5]=a("span",{class:"t-label cd__label"},"想做什么 / 哪里卡住了（可选）",-1)),z(ct,{modelValue:r.value,"onUpdate:modelValue":l[2]||(l[2]=L=>r.value=L),type:"textarea",rows:2,placeholder:"例如：想实现冒泡排序，但结果不对"},null,8,["modelValue"])]),a("div",Re,[z(Q,{variant:"primary",loading:c.value,onClick:j},{default:X(()=>[...l[6]||(l[6]=[D("开始诊断",-1)])]),_:1},8,["loading"])]),e.value?(d(),p("div",Ge,[a("div",We,[l[7]||(l[7]=a("h3",{class:"t-h2 cd__title"},"诊断结果",-1)),e.value.error_type?(d(),B(yt,{key:0,variant:f(e.value.error_type)},{default:X(()=>[D(w(e.value.error_type),1)]),_:1},8,["variant"])):V("",!0)]),e.value.error_location?(d(),p("section",Ye,[l[8]||(l[8]=a("p",{class:"t-label cd__label"},"错误位置",-1)),z(U,{content:e.value.error_location},null,8,["content"])])):V("",!0),e.value.reason?(d(),p("section",He,[l[9]||(l[9]=a("p",{class:"t-label cd__label"},"错误原因",-1)),z(U,{content:e.value.reason},null,8,["content"])])):V("",!0),e.value.fix?(d(),p("section",Ke,[l[10]||(l[10]=a("p",{class:"t-label cd__label"},"修改建议",-1)),z(U,{content:e.value.fix},null,8,["content"])])):V("",!0),e.value.corrected_code?(d(),p("section",Je,[l[11]||(l[11]=a("p",{class:"t-label cd__label"},"修正后的代码",-1)),z(U,{content:e.value.corrected_code},null,8,["content"])])):V("",!0),e.value.knowledge_points&&e.value.knowledge_points.length?(d(),p("section",Ze,[l[12]||(l[12]=a("p",{class:"t-label cd__label"},"涉及知识点",-1)),a("div",tn,[(d(!0),p(O,null,P(e.value.knowledge_points,L=>(d(),B(yt,{key:L,variant:"neutral"},{default:X(()=>[D(w(L),1)]),_:2},1024))),128))])])):V("",!0),e.value.tips?(d(),p("section",en,[l[13]||(l[13]=a("p",{class:"t-label cd__label"},"避坑建议",-1)),z(U,{content:e.value.tips},null,8,["content"])])):V("",!0)])):V("",!0)]))}},an=H(nn,[["__scopeId","data-v-87c61608"]]),rn={class:"code-editor"},on={class:"toolbar"},sn={class:"ce__lang"},ln={class:"io-row"},dn={class:"io-col"},un={key:0,class:"output-block"},cn={key:0,class:"out-ok"},fn={key:1,class:"out-err"},pn={__name:"CodeEditor",props:{code:{type:String,default:""},language:{type:String,default:"python"}},setup(s){const t=s,i=N(t.language),n=N(null),o=N(""),r=N(""),e=N(""),c=N(!1);let m=null;function f(q){return q==="c"?"text/x-csrc":"text/x-python"}nt(()=>{window.CodeMirror&&(m=window.CodeMirror.fromTextArea(n.value,{mode:f(i.value),lineNumbers:!0,indentUnit:4,tabSize:4,lineWrapping:!1,viewportMargin:12}),m.setValue(t.code||""))}),et(i,q=>{m&&m.setOption("mode",f(q))}),et(()=>t.code,q=>{m&&q&&m.getValue()!==q&&m.setValue(q)}),ot(()=>{m&&(m.toTextArea(),m=null)});async function j(){const q=m?m.getValue():t.code;if(!q.trim()){W.warning("代码为空");return}c.value=!0,r.value="",e.value="";try{const l=await kt.run(i.value,q,o.value);l.ok?(r.value=l.stdout||"(程序运行结束，无输出)",l.stderr&&(e.value=l.stderr),rt("run")):e.value=l.error+(l.stderr?`

`+l.stderr:"")}catch(l){e.value=l.message}finally{c.value=!1}}return(q,l)=>{const L=lt("UiSelect"),M=lt("UiButton"),$=lt("UiInput");return d(),p("div",rn,[a("div",on,[a("div",sn,[z(L,{modelValue:i.value,"onUpdate:modelValue":l[0]||(l[0]=u=>i.value=u),size:"sm",options:q.LANGS},null,8,["modelValue","options"])]),z(M,{variant:"primary",size:"sm",loading:c.value,onClick:j},{default:X(()=>[...l[2]||(l[2]=[D("运行 ▶",-1)])]),_:1},8,["loading"]),l[3]||(l[3]=a("span",{class:"muted"},"可直接修改代码运行，查看真实输出（超时 8 秒自动终止）",-1))]),a("textarea",{ref_key:"ta",ref:n},null,512),a("div",ln,[a("div",dn,[l[4]||(l[4]=a("div",{class:"label"},"输入 stdin（可选）",-1)),z($,{modelValue:o.value,"onUpdate:modelValue":l[1]||(l[1]=u=>o.value=u),type:"textarea",rows:2,placeholder:"程序若有输入，在这里填"},null,8,["modelValue"])])]),r.value||e.value?(d(),p("div",un,[l[5]||(l[5]=a("div",{class:"label"},"运行结果",-1)),r.value?(d(),p("pre",cn,w(r.value),1)):V("",!0),e.value?(d(),p("pre",fn,w(e.value),1)):V("",!0)])):V("",!0)])}}},mn=H(pn,[["__scopeId","data-v-7bea801a"]]),gn={key:"calc",name:"高等数学",type:"formula",groups:[{title:"极限与连续",items:[{name:"等价无穷小（x→0）",tex:String.raw`\sin x\sim x,\quad \tan x\sim x,\quad \arcsin x\sim x,\quad \arctan x\sim x`,note:"「光对，对不出」：\\(1-\\cos x\\sim \\frac{x^2}{2}\\)、\\(\\ln(1+x)\\sim x\\)、\\(e^x-1\\sim x\\)、\\((1+x)^a-1\\sim ax\\)、\\(\\sqrt[n]{1+x}-1\\sim \\frac{x}{n}\\)"},{name:"两个重要极限",tex:String.raw`\lim_{x\to 0}\frac{\sin x}{x}=1,\qquad \lim_{x\to\infty}\left(1+\frac{1}{x}\right)^{x}=e,\qquad \lim_{x\to 0}(1+x)^{\frac{1}{x}}=e`,note:"幂指函数一律化为 u^v = e^{v\\ln u} 处理，1^\\infty 型先取对数再算"},{name:"泰勒（麦克劳林）展开",tex:String.raw`e^x=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots,\qquad \ln(1+x)=x-\frac{x^2}{2}+\frac{x^3}{3}-\cdots`,note:"\\sin x=x-\\frac{x^3}{3!}+\\frac{x^5}{5!}-\\cdots,\\ \\cos x=1-\\frac{x^2}{2!}+\\frac{x^4}{4!}-\\cdots,\\ (1+x)^a=1+ax+\\frac{a(a-1)}{2!}x^2+\\cdots,\\ \\frac{1}{1-x}=1+x+x^2+\\cdots"},{name:"洛必达法则",tex:String.raw`\lim_{x\to a}\frac{f(x)}{g(x)}=\lim_{x\to a}\frac{f'(x)}{g'(x)}\qquad\left(\frac{0}{0}\ \text{或}\ \frac{\infty}{\infty}\right)`,note:"每用一步都要验证条件；0·∞、∞-∞、1^∞、0^0、∞^0 先转化为 0/0 或 ∞/∞ 再洛"},{name:"无穷小的阶与替换原则",tex:String.raw`\beta=o(\alpha)\ \Leftrightarrow\ \lim\frac{\beta}{\alpha}=0;\qquad \alpha\sim\beta\ \Leftrightarrow\ \lim\frac{\alpha}{\beta}=1`,note:"乘除可整体替换；加减替换需保证替换后主部未被抵消（保险做法是泰勒展到足够阶）"},{name:"夹逼准则与单调有界准则",tex:String.raw`g(x)\le f(x)\le h(x),\ \lim g=\lim h=A\ \Longrightarrow\ \lim f=A`,note:"数列极限「单调有界必收敛」常用来证明递推数列收敛，先证界再证单调"},{name:"常用极限结论",tex:String.raw`\lim_{x\to 0}\frac{a^x-1}{x}=\ln a,\qquad \lim_{n\to\infty}\sqrt[n]{n}=1,\qquad \lim_{x\to+\infty}\frac{x^k}{e^{x}}=0,\qquad \lim_{x\to+\infty}\frac{\ln x}{x}=0`,note:"指数增长 > 幂函数增长 > 对数增长，比较阶时直接用"},{name:"连续与间断点分类",tex:String.raw`\text{连续}:\ \lim_{x\to x_0^-}f=\lim_{x\to x_0^+}f=f(x_0)`,note:"第一类：可去（左右极限存在且相等但不等于函数值）、跳跃（左右极限不等）；第二类：无穷、振荡"}]},{title:"导数与微分",items:[{name:"基本导数表",tex:String.raw`(x^a)'=ax^{a-1},\quad (a^x)'=a^x\ln a,\quad (\log_a x)'=\frac{1}{x\ln a},\quad (\sin x)'=\cos x,\quad (\cos x)'=-\sin x`,note:"(\\tan x)'=\\sec^2x,\\ (\\cot x)'=-\\csc^2x,\\ (\\sec x)'=\\sec x\\tan x,\\ (\\arcsin x)'=\\frac{1}{\\sqrt{1-x^2}},\\ (\\arctan x)'=\\frac{1}{1+x^2}"},{name:"四则运算与链式法则",tex:String.raw`(uv)'=u'v+uv',\qquad \left(\frac{u}{v}\right)'=\frac{u'v-uv'}{v^2},\qquad \frac{dy}{dx}=\frac{dy}{du}\cdot\frac{du}{dx}`,note:"复合函数层层剥：从外到内，每层乘上内层导数"},{name:"隐函数与参数方程求导",tex:String.raw`F(x,y)=0\ \Longrightarrow\ y'=-\frac{F_x}{F_y};\qquad \begin{cases}x=\varphi(t)\\ y=\psi(t)\end{cases}\Longrightarrow\ \frac{dy}{dx}=\frac{\psi'(t)}{\varphi'(t)}`,note:"隐函数直接两边对 x 求导、把 y 当 x 的函数解出 y′，通常比套公式更稳"},{name:"高阶导数常用结果",tex:String.raw`(e^{ax})^{(n)}=a^ne^{ax},\quad (\sin x)^{(n)}=\sin\!\left(x+n\frac{\pi}{2}\right),\quad \left(\frac{1}{1+x}\right)^{(n)}=\frac{(-1)^nn!}{(1+x)^{n+1}}`,note:"乘积高阶导用莱布尼茨公式 (uv)^{(n)}=\\sum_{k=0}^{n}\\binom{n}{k}u^{(k)}v^{(n-k)}"},{name:"微分中值定理",tex:String.raw`f(b)-f(a)=f'(\xi)(b-a);\qquad \frac{f(b)-f(a)}{g(b)-g(a)}=\frac{f'(\xi)}{g'(\xi)}`,note:"罗尔（f(a)=f(b) 时存在 f′(ξ)=0）→ 拉格朗日 → 柯西，证明题里最常用的是「构造辅助函数再用罗尔」"},{name:"泰勒公式（带余项）",tex:String.raw`f(x)=\sum_{k=0}^{n}\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k+\frac{f^{(n+1)}(\xi)}{(n+1)!}(x-x_0)^{n+1}`,note:"证明不等式用拉格朗日余项（可定号）；求极限用佩亚诺余项 o((x-x_0)^n)"},{name:"单调性、极值、凹凸与拐点",tex:String.raw`f'>0\ \text{增},\ f'<0\ \text{减};\qquad f''>0\ \text{凹(上凹)},\ f''<0\ \text{凸};\qquad f''\ \text{变号处为拐点}`,note:"极值判别：f′(x₀)=0 且 f″(x₀)<0 为极大，>0 为极小；f″=0 不一定是拐点（要看变号）"},{name:"渐近线",tex:String.raw`\text{斜渐近线}:\ k=\lim_{x\to\infty}\frac{f(x)}{x},\ b=\lim_{x\to\infty}[f(x)-kx],\ y=kx+b`,note:"先找无定义点看垂直渐近线，再算水平/斜（k=0 即水平）"},{name:"曲率与曲率半径",tex:String.raw`K=\frac{|y''|}{(1+y'^2)^{3/2}},\qquad R=\frac{1}{K}`,note:"参数方程形式 K=\\frac{|\\varphi'\\psi''-\\varphi''\\psi'|}{(\\varphi'^2+\\psi'^2)^{3/2}}"}]},{title:"一元函数积分",items:[{name:"基本积分表（必背）",tex:String.raw`\int x^a dx=\frac{x^{a+1}}{a+1}+C\ (a\ne-1),\quad \int\frac{dx}{x}=\ln|x|+C,\quad \int e^xdx=e^x+C,\quad \int a^xdx=\frac{a^x}{\ln a}+C`,note:"\\int\\sin x\\,dx=-\\cos x+C,\\ \\int\\cos x\\,dx=\\sin x+C,\\ \\int\\sec^2x\\,dx=\\tan x+C,\\ \\int\\frac{dx}{1+x^2}=\\arctan x+C,\\ \\int\\frac{dx}{\\sqrt{1-x^2}}=\\arcsin x+C"},{name:"含参数的常用积分",tex:String.raw`\int\frac{dx}{a^2+x^2}=\frac{1}{a}\arctan\frac{x}{a}+C,\quad \int\frac{dx}{\sqrt{a^2-x^2}}=\arcsin\frac{x}{a}+C,\quad \int\frac{dx}{x^2-a^2}=\frac{1}{2a}\ln\left|\frac{x-a}{x+a}\right|+C`,note:"\\int\\frac{dx}{\\sqrt{x^2\\pm a^2}}=\\ln\\left|x+\\sqrt{x^2\\pm a^2}\\right|+C,\\ \\int\\tan x\\,dx=-\\ln|\\cos x|+C"},{name:"换元法（含三角代换）",tex:String.raw`\int f(\varphi(x))\varphi'(x)\,dx=\int f(u)\,du;\qquad \sqrt{a^2-x^2}\to x=a\sin t,\ \ \sqrt{a^2+x^2}\to x=a\tan t,\ \ \sqrt{x^2-a^2}\to x=a\sec t`,note:"换元后一定要换回原变量（定积分换元则同步换限，不必换回）"},{name:"分部积分",tex:String.raw`\int u\,dv=uv-\int v\,du`,note:"口诀「反对幂指三」：排序靠后的先凑进微分（如 ∫x eˣdx 取 u=x, dv=eˣdx）"},{name:"变限积分求导",tex:String.raw`\frac{d}{dx}\int_{a(x)}^{b(x)}f(t)\,dt=f(b(x))\,b'(x)-f(a(x))\,a'(x)`,note:"被积函数含 x 时要先换元把 x 移出去再求导"},{name:"定积分性质与中值定理",tex:String.raw`\int_a^bf(x)dx=F(b)-F(a);\qquad \int_a^bf(x)\,dx=f(\xi)(b-a),\ \xi\in[a,b]`,note:"保号性、估值、区间可加是证明题主力；积分中值定理常与极限结合"},{name:"对称与周期性技巧",tex:String.raw`\int_{-a}^{a}f\,dx=\begin{cases}0,&f\ \text{奇}\\ 2\int_0^{a}f\,dx,&f\ \text{偶}\end{cases}`,note:"周期为 T 时 \\int_a^{a+T}f=\\int_0^Tf；常配 x\\to a+b-x 的区间再现换元（如 \\int_0^{\\pi}x f(\\sin x)dx）"},{name:"Wallis（点火）公式",tex:String.raw`\int_0^{\frac{\pi}{2}}\sin^n x\,dx=\int_0^{\frac{\pi}{2}}\cos^n x\,dx=\begin{cases}\frac{n-1}{n}\cdot\frac{n-3}{n-2}\cdots\frac{1}{2}\cdot\frac{\pi}{2},&n\ \text{偶}\\[2mm]\frac{n-1}{n}\cdot\frac{n-3}{n-2}\cdots\frac{2}{3},&n\ \text{奇}\end{cases}`,note:"先凑成 0 到 π/2 的形式再用；对称区间 + 奇偶性经常配合使用"},{name:"有理函数与三角有理式",tex:String.raw`\int \frac{P_n(x)}{Q_m(x)}dx\ \text{→ 部分分式;} \qquad \int R(\sin x,\cos x)dx\ \xrightarrow{t=\tan\frac{x}{2}} \int \frac{2}{1+t^2}R\!\left(\frac{2t}{1+t^2},\frac{1-t^2}{1+t^2}\right)dt`,note:"万能代换是兜底方案，能用凑微分/积化和差就优先用，避免复杂有理式"},{name:"反常积分与 Γ 函数",tex:String.raw`\int_1^{\infty}\frac{dx}{x^p}\ \text{收敛}\Leftrightarrow p>1;\qquad \int_0^{1}\frac{dx}{x^p}\ \text{收敛}\Leftrightarrow p<1;\qquad \Gamma(n+1)=n!,\ \Gamma\!\left(\tfrac12\right)=\sqrt{\pi}`,note:"判别用比较法：与 p 积分比；Γ 函数可秒算 \\int_0^\\infty x^ne^{-x}dx=n!"},{name:"定积分的几何应用",tex:String.raw`S=\int_a^b|f|\,dx;\quad V_x=\pi\int_a^bf^2dx;\quad V_y=2\pi\int_a^bx|f|\,dx;\quad s=\int_a^b\sqrt{1+y'^2}\,dx`,note:"旋转体另有两种思路：绕 x 轴用圆盘法，绕 y 轴用柱壳法（看哪种积分好算）；曲面面积用 S=2\\pi\\int|f|\\sqrt{1+y'^2}dx"},{name:"形心与转动惯量",tex:String.raw`\bar{x}=\frac{1}{A}\int_a^b x|f|dx,\qquad I_y=\int_a^bx^2|f(x)|dx`,note:"物理应用题先画图、写微元 dA 或 dV，再化成定积分"}]},{title:"多元微分学",items:[{name:"偏导数与全微分",tex:String.raw`dz=\frac{\partial z}{\partial x}dx+\frac{\partial z}{\partial y}dy;\qquad \frac{\partial^2 z}{\partial x\partial y}=\frac{\partial^2 z}{\partial y\partial x}\ (\text{连续时})`,note:"可微 ⇒ 偏导存在 ⇒ 连续，反向都不成立；判断可微用 \\lim\\frac{\\Delta z-dz}{\\rho}=0"},{name:"复合函数求导（链式法则）",tex:String.raw`z=f(u,v),\ u=u(x,y),\ v=v(x,y)\ \Longrightarrow\ \frac{\partial z}{\partial x}=\frac{\partial f}{\partial u}\frac{\partial u}{\partial x}+\frac{\partial f}{\partial v}\frac{\partial v}{\partial x}`,note:"画变量关系树，每条路径相乘、各路径相加，不易错"},{name:"隐函数求导公式",tex:String.raw`\frac{\partial z}{\partial x}=-\frac{F_x}{F_z},\qquad \frac{\partial z}{\partial y}=-\frac{F_y}{F_z}\qquad(F(x,y,z)=0)`,note:"求二阶偏导时，把 z 视为 x,y 的函数继续求导，别漏 F_x 里隐含的 z"},{name:"方向导数与梯度",tex:String.raw`\frac{\partial f}{\partial \vec{l}}=\nabla f\cdot \vec{e}_l=|\nabla f|\cos\theta;\qquad \nabla f=(f_x,f_y,f_z)`,note:"梯度方向是增长最快的方向，模是最大变化率；沿梯度的方向导数取到最大值"},{name:"几何应用：切平面与法线",tex:String.raw`F_x(x_0)(x-x_0)+F_y(y_0)(y-y_0)+F_z(z_0)(z-z_0)=0`,note:"曲面 F=0 的法向量 (F_x,F_y,F_z)；曲线参数式的切向量 (φ′,ψ′,ω′)；切平面也可写成 z-z_0=f_x(x-x_0)+f_y(y-y_0)"},{name:"无条件极值判别（AC-B²）",tex:String.raw`A=f_{xx},\ B=f_{xy},\ C=f_{yy};\quad AC-B^2>0\Rightarrow\text{极值}(A>0\ \text{极小},\ A<0\ \text{极大});\quad <0\Rightarrow\text{非极值}`,note:"先解 f_x=f_y=0 求驻点；AC-B²=0 时判别失效，需另想办法"},{name:"条件极值：拉格朗日乘数法",tex:String.raw`L(x,y,\lambda)=f(x,y)+\lambda\,\varphi(x,y);\qquad \begin{cases}L_x=0\\ L_y=0\\ \varphi=0\end{cases}`,note:"多个约束就多个乘子；实际问题可结合边界与几何意义判断是最大还是最小"},{name:"有界闭区域上的最值",tex:String.raw`z_{\max}=\max\{\text{内部驻点值},\ \text{边界上的最值}\}`,note:"边界用代入法降为一元函数，或用参数化；千万别漏边界"}]},{title:"重积分与曲线曲面积分",items:[{name:"二重积分（直角与极坐标）",tex:String.raw`\iint_D f\,dxdy=\int_\alpha^\beta\!\!\int_{r_1(\theta)}^{r_2(\theta)}f(r\cos\theta,r\sin\theta)\,r\,dr\,d\theta`,note:"区域是圆/扇形/环形优先极坐标；别忘了 Jacobi 因子 r"},{name:"三重积分（柱面与球面坐标）",tex:String.raw`\text{柱面}: dV=r\,dr\,d\theta\,dz;\qquad \text{球面}: dV=\rho^2\sin\varphi\,d\rho\,d\varphi\,d\theta`,note:"含 x²+y²+z² 用球面，含 x²+y² 用柱面；投影法定限最稳"},{name:"曲线积分（两类）",tex:String.raw`\int_L f(x,y)\,ds=\int_a^b f(\varphi(t),\psi(t))\sqrt{\varphi'^2+\psi'^2}\,dt;\qquad \int_L P\,dx+Q\,dy=\int_a^b\!\left(P\varphi'+Q\psi'\right)dt`,note:"第一类与方向无关；第二类与方向有关（反向变号）"},{name:"格林公式",tex:String.raw`\oint_L P\,dx+Q\,dy=\iint_D\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dx\,dy`,note:"L 取正向（区域在左侧）；有奇点先挖去小圆；\\frac{\\partial Q}{\\partial x}=\\frac{\\partial P}{\\partial y} 时积分与路径无关（存在 u 使 du=Pdx+Qdy）"},{name:"第一、二类曲面积分",tex:String.raw`\iint_\Sigma f\,dS=\iint_{D_{xy}}f(x,y,z(x,y))\sqrt{1+z_x^2+z_y^2}\,dxdy;\qquad \iint_\Sigma R\,dxdy=\pm\iint_{D_{xy}}R\,dxdy`,note:"第二类取 + 还是 − 取决于法向量与坐标轴夹角（上侧取正）"},{name:"高斯公式",tex:String.raw`\oiint_\Sigma P\,dydz+Q\,dzdx+R\,dxdy=\iiint_\Omega\left(\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}+\frac{\partial R}{\partial z}\right)dV`,note:"Σ 取外侧；不闭合就补面（通常补平面，注意补面那一份要减掉）"},{name:"斯托克斯公式",tex:String.raw`\oint_\Gamma P\,dx+Q\,dy+R\,dz=\iint_\Sigma \mathrm{rot}\,\vec{F}\cdot d\vec{S}`,note:"\\mathrm{rot}\\vec{F}=(R_y-Q_z,\\ P_z-R_x,\\ Q_x-P_y)；平面曲线直接用格林公式更快"},{name:"体积与曲面面积",tex:String.raw`V=\iiint_\Omega dV;\qquad A=\iint_D\sqrt{1+z_x^2+z_y^2}\,dxdy`,note:"旋转体/柱体也可用「先一后二、先二后一」灵活选择积分次序"}]},{title:"无穷级数",items:[{name:"三个基准级数",tex:String.raw`\sum_{n=1}^{\infty}aq^n\ \text{收敛}\Leftrightarrow|q|<1;\qquad \sum\frac{1}{n^p}\ \text{收敛}\Leftrightarrow p>1;\qquad \sum\frac{1}{n\ln^pn}\ \text{收敛}\Leftrightarrow p>1`,note:"比较判别法都是拿它们当标尺；调和级数 \\sum 1/n 发散是最常用的反例"},{name:"正项级数判别法",tex:String.raw`\text{比值}:\lim\frac{u_{n+1}}{u_n}=l;\qquad \text{根值}:\lim\sqrt[n]{u_n}=l;\qquad l<1\ \text{收敛},\ l>1\ \text{发散}`,note:"l=1 时失效（此时改用比较或积分判别）；含 n!、a^n 优先比值，含 n 次方优先根值"},{name:"交错级数与绝对收敛",tex:String.raw`\sum(-1)^{n-1}u_n\ (u_n\downarrow 0)\ \text{收敛（莱布尼茨）}`,note:"绝对收敛 ⇒ 收敛；条件收敛（如 \\sum(-1)^n/n）只能靠莱布尼茨，且重新排列可能改变和"},{name:"幂级数收敛半径",tex:String.raw`R=\lim_{n\to\infty}\left|\frac{a_n}{a_{n+1}}\right|\quad\text{或}\quad R=\frac{1}{\lim\sqrt[n]{|a_n|}}`,note:"端点必须单独判别（常出现一端收敛一端发散）；缺项级数直接用比值法对 x 求"},{name:"常用幂级数展开",tex:String.raw`\frac{1}{1-x}=\sum_{n=0}^\infty x^n\ (|x|<1),\quad e^x=\sum\frac{x^n}{n!},\quad \ln(1+x)=\sum_{n=1}^\infty(-1)^{n-1}\frac{x^n}{n}\ (x\in(-1,1])`,note:"\\sin x=\\sum\\frac{(-1)^nx^{2n+1}}{(2n+1)!},\\ \\cos x=\\sum\\frac{(-1)^nx^{2n}}{(2n)!},\\ \\arctan x=\\sum\\frac{(-1)^nx^{2n+1}}{2n+1}\\ (|x|\\le1)"},{name:"求和函数三板斧",tex:String.raw`\sum_{n=1}^\infty nx^{n-1}=\frac{1}{(1-x)^2}\ (|x|<1);\qquad \sum_{n=0}^\infty\frac{x^n}{n!}=e^x`,note:"① 拆项凑成已知展开 ② 逐项积分/求导后再求和 ③ 先求导再积分还原（注意常数项）"},{name:"傅里叶级数（周期 2π）",tex:String.raw`f(x)\sim\frac{a_0}{2}+\sum_{n=1}^\infty(a_n\cos nx+b_n\sin nx),\quad a_n=\frac{1}{\pi}\int_{-\pi}^{\pi}f\cos nx\,dx,\quad b_n=\frac{1}{\pi}\int_{-\pi}^{\pi}f\sin nx\,dx`,note:"奇函数只留 sin（正弦级数），偶函数只留 cos；逐点收敛到 \\frac{f(x^-)+f(x^+)}{2}（跳跃点取平均）"},{name:"周期 2l 与狄利克雷定理",tex:String.raw`a_n=\frac{1}{l}\int_{-l}^{l}f(x)\cos\frac{n\pi x}{l}dx,\qquad b_n=\frac{1}{l}\int_{-l}^{l}f(x)\sin\frac{n\pi x}{l}dx`,note:"记法：把 \\frac{\\pi x}{l} 当作变量；间断点收敛到左右极限平均值，这是求特殊级数和（如 \\sum 1/n^2）的常用手段"}]},{title:"微分方程",items:[{name:"可分离变量方程",tex:String.raw`\frac{dy}{dx}=f(x)g(y)\ \Longrightarrow\ \int\frac{dy}{g(y)}=\int f(x)\,dx`,note:"注意 g(y)=0 的常数解可能被除法丢掉"},{name:"齐次方程",tex:String.raw`\frac{dy}{dx}=f\!\left(\frac{y}{x}\right)\ \xrightarrow{u=\frac{y}{x}}\ x\frac{du}{dx}+u=f(u)`,note:"判据：分子分母同次；化为可分离变量后用 u 积分，最后换回 y/x"},{name:"一阶线性方程通解公式",tex:String.raw`y'+P(x)y=Q(x)\ \Longrightarrow\ y=e^{-\int P\,dx}\left(\int Q\,e^{\int P\,dx}dx+C\right)`,note:"先化成标准形（y′ 系数为 1）再套；记忆法：一边乘 e^{∫P} 凑成 (ye^{∫P})′ = Qe^{∫P}"},{name:"伯努利方程",tex:String.raw`y'+P(x)y=Q(x)y^n\ (n\ne0,1)\ \xrightarrow{z=y^{1-n}}\ z'+(1-n)Pz=(1-n)Q`,note:"n>0 时 y=0 也是解，别丢"},{name:"可降阶的二阶方程",tex:String.raw`y''=f(x):\ \text{两次积分};\quad y''=f(x,y')\ \xrightarrow{p=y'};\quad y''=f(y,y')\ \xrightarrow{p=y',\ y''=p\frac{dp}{dy}}`,note:"缺 y 用 p=y′（对 x）；缺 x 用 p 对 y 求导，这是最典型的两种换法"},{name:"二阶常系数齐次方程",tex:String.raw`y''+py'+qy=0,\ \ r^2+pr+q=0:\ \ \begin{cases}r_1\ne r_2:& y=C_1e^{r_1x}+C_2e^{r_2x}\\ r_1=r_2:& y=(C_1+C_2x)e^{rx}\\ r=\alpha\pm\beta i:& y=e^{\alpha x}(C_1\cos\beta x+C_2\sin\beta x)\end{cases}`,note:"先解特征方程，三种情况分别对应；虚根时记得带 e^{αx}"},{name:"二阶常系数非齐次（待定系数）",tex:String.raw`f(x)=e^{\lambda x}P_m(x)\ \Rightarrow\ y^*=x^k e^{\lambda x}Q_m(x)`,note:"k = λ 作为特征根的重数（0/1/2）；若 f 含三角项，用 e^{λx}(A\\cos\\omega x+B\\sin\\omega x) 形式，λ±ωi 是根则乘 x^k"},{name:"欧拉方程",tex:String.raw`x^2y''+pxy'+qy=f(x)\ \xrightarrow{x=e^t}\ \frac{d^2y}{dt^2}+(p-1)\frac{dy}{dt}+qy=f(e^t)`,note:"x<0 时取 |x|；化完按常系数二阶处理，最后换回 x"},{name:"一阶差分方程（补充）",tex:String.raw`y_{t+1}-ay_t=b\ \Longrightarrow\ y_t=C a^t+\frac{b}{1-a}\ (a\ne1)`,note:"形式上与一阶线性方程一致，把求导换成差分即可"}]}]},xn={key:"linear",name:"线性代数",type:"formula",groups:[{title:"行列式与矩阵",items:[{name:"行列式基本性质",tex:String.raw`|A^T|=|A|;\qquad |kA|=k^n|A|;\qquad |AB|=|A||B|`,note:"交换两行变号、某行乘 k 则整体乘 k、行倍加不变——用这三条把行列式化成三角"},{name:"按行（列）展开与范德蒙德",tex:String.raw`|A|=\sum_{j=1}^{n}a_{ij}A_{ij};\qquad V_n=\prod_{1\le i<j\le n}(x_j-x_i)`,note:"A_{ij} 是代数余子式 (A_{ij}=(-1)^{i+j}M_{ij})；Vandermonde 常见于插值与特征值题"},{name:"逆矩阵与伴随矩阵",tex:String.raw`AA^*=A^*A=|A|E;\qquad A^{-1}=\frac{1}{|A|}A^*\quad(|A|\ne0);\qquad (AB)^{-1}=B^{-1}A^{-1}`,note:"A^* 的每个元素是「转置后的代数余子式」，顺序别写反；(|A|E)^{-1} 类题常用 A A^* = |A| E 过渡"},{name:"秩的性质",tex:String.raw`r(A)=r(A^T);\qquad r(AB)\le\min\{r(A),r(B)\};\qquad r(A+B)\le r(A)+r(B)`,note:"A 可逆时 r(AB)=r(B)；r(A)=n ⇔ |A|≠0 ⇔ 列向量线性无关；常与方程组解的判定连用"},{name:"初等行变换求逆与解方程",tex:String.raw`[A\mid E]\xrightarrow{\ \text{行变换}\ }[E\mid A^{-1}];\qquad [A\mid B]\xrightarrow{\ \text{行变换}\ }\text{行最简形}`,note:"只能行变换（求逆时不能列变换）；解方程用行最简形直接读出解"},{name:"克拉默法则",tex:String.raw`x_j=\frac{|A_j|}{|A|}\qquad(|A|\ne0)`,note:"A_j 是把 A 的第 j 列换成常数列 b；只适用于方程个数=未知数个数且 |A|≠0"},{name:"分块矩阵求逆",tex:String.raw`\begin{pmatrix}A&0\\0&B\end{pmatrix}^{-1}=\begin{pmatrix}A^{-1}&0\\0&B^{-1}\end{pmatrix},\qquad \begin{pmatrix}0&A\\B&0\end{pmatrix}^{-1}=\begin{pmatrix}0&B^{-1}\\A^{-1}&0\end{pmatrix}`,note:"上（下）三角分块的逆保持同型，非零块逐个求逆并调整位置"}]},{title:"向量组与线性方程组",items:[{name:"线性相关判定",tex:String.raw`\alpha_1,\dots,\alpha_s\ (\alpha_1\ne0)\ \text{线性相关}\ \Leftrightarrow\ \text{存在}\ \alpha_i\ \text{可由其余线性表示}`,note:"含零向量必相关；部分相关则整体相关；向量个数 > 维数必相关；整体无关则部分无关"},{name:"极大无关组与秩",tex:String.raw`r(\alpha_1,\dots,\alpha_s)=\text{极大无关组中向量个数}=\text{矩阵的秩}`,note:"把向量按列（或按行，看题目问法）拼成矩阵，行最简形中主元所在列即极大无关组"},{name:"齐次方程组解的结构",tex:String.raw`Ax=0:\ \text{基础解系含}\ n-r(A)\ \text{个解},\qquad x=k_1\xi_1+\cdots+k_{n-r}\xi_{n-r}`,note:"n 是未知数个数；只有零解 ⇔ r(A)=n；基础解系必须线性无关且个数正好 n-r(A)"},{name:"非齐次方程组",tex:String.raw`Ax=b\ \text{有解}\Leftrightarrow r(A)=r(\bar A);\qquad x=\eta+\sum k_i\xi_i`,note:"唯一解 ⇔ r(A)=r(Ā)=n；无穷多解 ⇔ r(A)=r(Ā)<n；通解=特解+齐次通解"},{name:"内积、夹角、正交",tex:String.raw`(\alpha,\beta)=\sum a_ib_i;\qquad \cos\theta=\frac{(\alpha,\beta)}{|\alpha||\beta|};\qquad (\alpha,\beta)=0\Leftrightarrow \text{正交}`,note:"正交矩阵满足 Q^TQ=E（即 Q^{-1}=Q^T），其行列式为 ±1，且保持长度与内积"},{name:"施密特正交化",tex:String.raw`\beta_1=\alpha_1,\qquad \beta_k=\alpha_k-\sum_{i=1}^{k-1}\frac{(\alpha_k,\beta_i)}{(\beta_i,\beta_i)}\beta_i`,note:"再单位化得标准正交组；实对称矩阵的相似对角化题必用"}]},{title:"特征值、二次型",items:[{name:"特征值的性质",tex:String.raw`\sum_{i=1}^n\lambda_i=\mathrm{tr}(A),\qquad \prod_{i=1}^n\lambda_i=|A|`,note:"不同特征值对应的特征向量线性无关；A 可逆时 A^{-1} 特征值为 1/λ，A^k 为 λ^k，f(A) 为 f(λ)"},{name:"相似对角化条件",tex:String.raw`A\sim\Lambda\ \Leftrightarrow\ A\ \text{有}\ n\ \text{个线性无关的特征向量}\ \Leftrightarrow\ \text{每个}\ \lambda_i\ \text{的几何重数=代数重数}`,note:"n 个特征值互不相同则必可对角化；实对称矩阵一定可正交对角化（且特征值全为实数）"},{name:"实对称矩阵的正交对角化",tex:String.raw`Q^TAQ=\Lambda,\qquad Q^{-1}=Q^T`,note:"不同特征值的特征向量已经正交，同一特征值的多个向量做施密特正交化，最后单位化组成 Q"},{name:"二次型标准形与惯性定理",tex:String.raw`f=x^TAx\ \xrightarrow{x=Qy}\ y^T(Q^TAQ)y=\lambda_1y_1^2+\cdots+\lambda_ny_n^2`,note:"正交变换不改变特征值；配方法得到的标准形不唯一，但正负惯性指数唯一（惯性定理）；规范形中系数只有 1、-1、0"},{name:"正定判别",tex:String.raw`f\ \text{正定}\ \Leftrightarrow\ \text{顺序主子式全}>0\ \Leftrightarrow\ \text{特征值全}>0\ \Leftrightarrow\ A\simeq E`,note:"必要条件：主对角元全 >0、|A|>0；负定则奇数阶顺序主子式 <0 且偶数阶 >0"},{name:"相似、合同、等价",tex:String.raw`\text{等价}:PAQ=B;\quad \text{相似}:P^{-1}AP=B;\quad \text{合同}:C^TAC=B`,note:"相似 ⇒ 等价且同秩同迹同行列式（特征值相同）；合同只看正负惯性指数；实对称矩阵「相似 ⇔ 合同」"}]}]},vn={key:"prob",name:"概率论与数理统计",type:"formula",groups:[{title:"概率基础",items:[{name:"古典概型与计数",tex:String.raw`P(A)=\frac{\text{有利样本点数}}{\text{样本点总数}};\qquad A_n^m=\frac{n!}{(n-m)!},\quad C_n^m=\frac{n!}{m!(n-m)!}`,note:"「至少」类问题用对立事件：P(至少一个)=1-P(一个都没有)"},{name:"条件概率与乘法公式",tex:String.raw`P(A\mid B)=\frac{P(AB)}{P(B)};\qquad P(AB)=P(A)P(B\mid A)`,note:"P(B)≠0 才定义；多事件连乘展开 P(A₁A₂A₃)=P(A₁)P(A₂|A₁)P(A₃|A₁A₂)"},{name:"全概率与贝叶斯公式",tex:String.raw`P(A)=\sum_i P(B_i)P(A\mid B_i);\qquad P(B_i\mid A)=\frac{P(B_i)P(A\mid B_i)}{\sum_j P(B_j)P(A\mid B_j)}`,note:"关键动作：找完备事件组 B₁…B_n（划分）；贝叶斯是「由结果反推原因」"},{name:"独立性与伯努利概型",tex:String.raw`A,B\ \text{独立}\Leftrightarrow P(AB)=P(A)P(B);\qquad P_n(k)=C_n^kp^k(1-p)^{n-k}`,note:"两两独立 ≠ 相互独立；n 重伯努利中「恰好 k 次」用二项分布"}]},{title:"随机变量与分布",items:[{name:"分布函数与密度",tex:String.raw`F(x)=P(X\le x);\qquad F(x)=\int_{-\infty}^{x}f(t)\,dt,\qquad f(x)=F'(x)`,note:"F 单调不减、右连续、F(-∞)=0、F(+∞)=1；连续型 P(X=a)=0"},{name:"离散型常见分布",tex:String.raw`P(X=k)=C_n^kp^kq^{n-k}\ (\text{二项});\qquad P(X=k)=\frac{\lambda^ke^{-\lambda}}{k!}\ (\text{泊松});\qquad P(X=k)=q^{k-1}p\ (\text{几何})`,note:"0-1 分布是二项的特例；泊松常用来近似二项（n 大 p 小，λ=np）"},{name:"连续型常见分布",tex:String.raw`f(x)=\frac{1}{b-a}\ (a<x<b);\qquad f(x)=\lambda e^{-\lambda x}\ (x>0);\qquad f(x)=\frac{1}{\sqrt{2\pi}\sigma}e^{-\frac{(x-\mu)^2}{2\sigma^2}}`,note:"指数分布无记忆性 P(X>s+t|X>s)=P(X>t)；均匀分布注意区间端点不影响概率"},{name:"正态分布标准化",tex:String.raw`X\sim N(\mu,\sigma^2)\ \Longrightarrow\ \frac{X-\mu}{\sigma}\sim N(0,1);\qquad P(|X-\mu|<3\sigma)\approx0.9974`,note:"标准正态用 Φ 查表：P(a<X<b)=Φ((b-μ)/σ)-Φ((a-μ)/σ)；Φ(-x)=1-Φ(x)"},{name:"二维分布与独立性",tex:String.raw`f_X(x)=\int_{-\infty}^{+\infty}f(x,y)\,dy;\qquad X,Y\ \text{独立}\Leftrightarrow f(x,y)=f_X(x)f_Y(y)`,note:"联合分布能推出边缘，反之不然；两正态的线性组合仍正态（需独立才能直接相加方差）"}]},{title:"数字特征与统计",items:[{name:"期望与方差性质",tex:String.raw`E(aX+b)=aE(X)+b;\qquad D(aX)=a^2D(X);\qquad D(X)=E(X^2)-[E(X)]^2`,note:"E 对加减总是线性；D 只有在独立时才有 D(X±Y)=D(X)+D(Y)（一般情形要加协方差项）"},{name:"协方差与相关系数",tex:String.raw`\mathrm{Cov}(X,Y)=E(XY)-E(X)E(Y);\qquad \rho=\frac{\mathrm{Cov}(X,Y)}{\sqrt{D(X)}\sqrt{D(Y)}}`,note:"独立 ⇒ 不相关，反之不成立（但对二维正态来说两者等价）；|ρ|≤1"},{name:"常见分布的 E 与 D 速查",tex:String.raw`0\text{-}1:\ p,\ pq;\quad \text{二项}:\ np,\ npq;\quad \text{泊松}:\ \lambda,\ \lambda;\quad \text{均匀}:\ \frac{a+b}{2},\ \frac{(b-a)^2}{12}`,note:"指数：1/λ 与 1/λ²；正态：μ 与 σ²；几何（次数型）：1/p 与 q/p²"},{name:"大数定律与中心极限定理",tex:String.raw`\bar{X}_n\xrightarrow{P}\mu;\qquad \frac{\sum X_i-n\mu}{\sqrt{n}\sigma}\ \xrightarrow{d}\ N(0,1)`,note:"CLT 是「n 个独立同分布变量之和近似正态」的依据，估概率题多用它（注意标准化）"},{name:"常用统计量分布",tex:String.raw`\frac{(n-1)S^2}{\sigma^2}\sim\chi^2(n-1);\qquad \frac{\bar{X}-\mu}{S/\sqrt{n}}\sim t(n-1);\qquad \frac{S_1^2/\sigma_1^2}{S_2^2/\sigma_2^2}\sim F(n_1-1,n_2-1)`,note:"μ 未知用 t（用 S 替代 σ）；χ² 用于方差推断；F 用于两方差比"},{name:"矩估计与最大似然估计",tex:String.raw`\hat{\mu}_k=\frac{1}{n}\sum X_i^k;\qquad L(\theta)=\prod_{i=1}^nf(x_i;\theta),\qquad \frac{d\ln L}{d\theta}=0`,note:"MLE 三步：写似然 → 取对数 → 求导令 0；参数是区间上界的题，MLE 常取 max{xᵢ}（不能用求导法）"},{name:"区间估计与假设检验",tex:String.raw`\mu\in\left[\bar{X}\pm t_{\frac{\alpha}{2}}(n-1)\frac{S}{\sqrt{n}}\right]`,note:"σ 已知用 z 分位、未知用 t；假设检验：写出 H₀/H₁ → 选统计量 → 定拒绝域 → 下结论（两类错误：弃真 α、取伪 β）"}]}]},hn=[{key:"quicksort",name:"快速排序（随机基准）",tags:["排序","分治"],lang:"c",complexity:"平均 O(n log n)，最坏 O(n²)；空间 O(log n)（递归栈）",pitfalls:"基准取首元素 + 数据有序 → 退化为 O(n²)，故取随机基准；递归边界是 (l,p) 与 (p+1,r)，写错会死循环",usage:"需要原地排序、常数小；课程手写排序的首选",code:String.raw`#include <stdio.h>
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
}`},{key:"mergesort",name:"归并排序 + 逆序对计数",tags:["排序","分治","逆序对"],lang:"c",complexity:"O(n log n)；空间 O(n)（辅助数组）",pitfalls:"合并时用 <= 才稳定；逆序对只在 a[i] > a[j] 时累加 a[i..mid] 的数量（mid-i+1）",usage:"要求稳定排序、或需要在 O(n log n) 内统计逆序对/求「左侧比它大的个数」",code:String.raw`#include <stdio.h>

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
}`},{key:"binarysearch",name:"二分查找（三种边界写法）",tags:["查找","二分"],lang:"c",complexity:"O(log n)",pitfalls:"死循环根源：区间开闭没写对。记住「找值用闭区间 l<=r，找边界用左闭右开 l<r」；mid 用 l+(r-l)/2 防溢出",usage:"有序数组找值、找第一个 ≥ x（lower_bound）、找最后一个 ≤ x",code:String.raw`#include <stdio.h>

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
}`},{key:"binaryanswer",name:"二分答案（整数 + 浮点）",tags:["二分","最值"],lang:"c",complexity:"O(log(值域) × 判定代价)",pitfalls:"必须先确认「单调性」：判定函数 ok(x) 随 x 的变化必须是单调的；浮点二分固定迭代 100 次比 while(r-l>eps) 更稳",usage:"「最大化最小值 / 最小化最大值」类问题（切木棍、分蛋糕、跳石头、装载问题）",code:String.raw`#include <stdio.h>

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
}`},{key:"prefixdiff",name:"前缀和与差分",tags:["前缀和","差分","技巧"],lang:"c",complexity:"预处理 O(n)，区间查询/区间加 O(1)",pitfalls:"统一用 1-based 存数据；差分还原必须从前往后累加；二维差分四个角要加减成对",usage:"多次区间求和（前缀和）／多次区间整体加减最后统一查询（差分）",code:String.raw`#include <stdio.h>

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
}`},{key:"slidewindow",name:"双指针 / 滑动窗口",tags:["双指针","滑动窗口"],lang:"c",complexity:"O(n)（左右指针各走一遍，均摊）",pitfalls:"窗口收缩条件写成 if 还是 while，取决于题目要求「恰好」还是「最长」；注意左指针只能右移、不能回退",usage:"「最长/最短满足条件的连续子数组」类问题（无重复子串、和 ≥ target 的最短长度）",code:String.raw`#include <stdio.h>
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
}`},{key:"dfs-backtrack",name:"DFS 回溯（全排列 + 剪枝）",tags:["DFS","回溯","搜索"],lang:"c",complexity:"全排列 O(n!)，剪枝后远小于此",pitfalls:"「恢复现场」必须与递归调用成对出现，漏掉会让后续分支拿不到元素；剪枝条件写错是隐性超时主因",usage:"求所有方案（全排列、子集、n 皇后、数独、组合总和）",code:String.raw`#include <stdio.h>
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
}`},{key:"bfs",name:"BFS（网格最短路）",tags:["BFS","最短路"],lang:"c",complexity:"O(V + E)；网格上即 O(nm)",pitfalls:"入队时就要标记 visited（不是出队时），否则同一格会重复入队导致超时/内存爆；BFS 只保证边权为 1 时是最短路",usage:"无权图/网格的「最少步数」，层序遍历，多源扩散（腐烂的橘子、岛屿数量变体）",code:String.raw`#include <stdio.h>
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
}`},{key:"dsu",name:"并查集（路径压缩 + 按秩合并）",tags:["并查集","图"],lang:"c",complexity:"近 O(1)（阿克曼反函数 α(n)）",pitfalls:"find 里路径压缩要沿链改父指针；合并必须按秩/按大小，否则退化成链；删边问题不能直接用并查集",usage:"连通性判定、Kruskal 求最小生成树、朋友圈/亲戚问题、判环",code:String.raw`#include <stdio.h>

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
}`},{key:"dijkstra",name:"Dijkstra 最短路（堆优化）",tags:["图","最短路","堆"],lang:"c",complexity:"O((V + E) log V)",pitfalls:"不能处理负权边（负权用 Bellman-Ford/SPFA）；用「懒删除」出堆时才判断 done，不要在入堆时去重",usage:"单源最短路、边权非负（地图导航、费用最小路径）",code:String.raw`#include <stdio.h>
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
}`},{key:"toposort",name:"拓扑排序（Kahn）",tags:["图","DAG","拓扑"],lang:"c",complexity:"O(V + E)",pitfalls:"入度表要按边初始化；输出序列长度 < n 说明有环；**输出顺序不唯一**（与建边/邻接表顺序有关，只要满足所有先后约束即可），要固定顺序就换成优先队列",usage:"任务调度/课程先修、判断有向图有无环、DAG 上 DP 定序",code:String.raw`#include <stdio.h>
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
}`},{key:"knapsack",name:"背包 DP（0-1 / 完全 / 恰好装满）",tags:["DP","背包"],lang:"c",complexity:"O(nW) 时间，O(W) 空间（滚动数组）",pitfalls:"0-1 背包体积必须倒序（否则同一件被用多次）；完全背包正序；「恰好装满」把 dp 初始化为 -INF、dp[0]=0",usage:"选或不选的最优值问题（装箱、预算分配、零钱兑换、凑数）",code:String.raw`#include <stdio.h>
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
}`},{key:"lis",name:"最长上升子序列 LIS（O(n log n)）",tags:["DP","二分","贪心"],lang:"c",complexity:"O(n log n)（贪心 + 二分维护 tails）",pitfalls:"tails[k] 的含义是「长度 k+1 的子序列的最小结尾」，不是最终答案序列本身；严格上升用 >= 找下界，非严格改 >",usage:"LIS 长度、导弹拦截（最长不上升子序列）、套信封问题",code:String.raw`#include <stdio.h>

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
}`},{key:"lcs",name:"最长公共子序列 LCS",tags:["DP","字符串"],lang:"c",complexity:"O(nm) 时间，O(nm) 空间（可滚动到 O(min(n,m))）",pitfalls:"dp 数组要开 n+1 × m+1 并留出第 0 行/列；比较时用 a[i-1] 与 b[j-1]（下标偏移容易错）",usage:"字符串相似度、diff 算法、最短编辑距离的前置",code:String.raw`#include <stdio.h>
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
}`},{key:"editdist",name:"编辑距离（Levenshtein）",tags:["DP","字符串"],lang:"c",complexity:"O(nm)",pitfalls:"边界 dp[i][0]=i、dp[0][j]=j 不能漏；三种操作取最小（删除/插入/替换）",usage:"拼写纠错、相似度、DNA 比对、模糊匹配",code:String.raw`#include <stdio.h>
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
}`},{key:"kmp",name:"KMP 字符串匹配",tags:["字符串","匹配"],lang:"c",complexity:"O(n + m)",pitfalls:"next[0] = -1 的写法里，主串指针永不回退；build_next 循环条件是 i < m-1（少写一个会越界）",usage:"找子串位置、求最小循环节（m - next[m]）、前缀出现次数",code:String.raw`#include <stdio.h>
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
}`},{key:"fastpow",name:"快速幂 / 快速幂取模",tags:["数论","位运算"],lang:"c",complexity:"O(log b)",pitfalls:"底数先取模；乘法可能溢出（long long 内 a*a 需 < 9.2e18，模数很大时要用 __int128）；指数为 0 时结果 1",usage:"大指数幂取模、矩阵快速幂加速递推（斐波那契）、费马小定理求逆元",code:String.raw`#include <stdio.h>

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
}`},{key:"monostack",name:"单调栈（下一个更大元素）",tags:["栈","单调栈"],lang:"c",complexity:"O(n)（每个元素最多进出栈一次）",pitfalls:"「找右边更大」要倒序遍历；弹栈条件是 <= 还是 < 决定重复元素处理方式；栈里存下标才能算距离/宽度",usage:"下一个更大/更小元素、柱状图最大矩形、接雨水、滑动窗口最大值（单调队列）",code:String.raw`#include <stdio.h>

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
}`},{key:"travtree",name:"二叉树遍历（前中后序非递归 + 层序）",tags:["树","遍历","栈"],lang:"c",complexity:"O(n)；空间 O(h)（h 为树高）",pitfalls:"前序压栈要「先右后左」才能先访问左子树；后序非递归需 last 记录上次访问节点，判断右子树是否已处理",usage:"树的遍历输出、非递归改写（机试常考）、层序求树宽/深度",code:String.raw`#include <stdio.h>

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
}`},{key:"trie",name:"字典树 Trie（插入 / 前缀查询）",tags:["字符串","树"],lang:"c",complexity:"插入/查询 O(L)（L 为串长）",pitfalls:"节点数上限 ≈ 所有串长度之和 + 1，开小会越界；root 用 0 表示，ch[u][c]==0 即「不存在」；小写字母才够用 26 个字母表",usage:"前缀检索、自动补全、单词统计、最大异或对（二进制 Trie）",code:String.raw`#include <stdio.h>

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
}`},{key:"numbertheory",name:"数论：gcd / 扩展欧几里得 / 线性筛",tags:["数论","素数"],lang:"c",complexity:"gcd O(log n)；线性筛 O(n)",pitfalls:"exgcd 递归返回时要同步更新 x、y（顺序别写反）；逆元要求 gcd(a,m)=1；线性筛 break 条件 i % p == 0 必须写，否则退化为 O(n log log n)",usage:"最大公约数、不定方程 ax+by=c、求模逆元、素数表、同余问题",code:String.raw`#include <stdio.h>

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
}`}],_n=[{key:"sort",name:"排序算法对比",columns:["算法","平均时间","最坏时间","空间","稳定性"],rows:[["冒泡排序","O(n²)","O(n²)","O(1)","稳定"],["选择排序","O(n²)","O(n²)","O(1)","不稳定"],["插入排序","O(n²)","O(n²)","O(1)","稳定"],["希尔排序","O(n^1.3)","O(n²)","O(1)","不稳定"],["归并排序","O(n log n)","O(n log n)","O(n)","稳定"],["快速排序","O(n log n)","O(n²)","O(log n)","不稳定"],["堆排序","O(n log n)","O(n log n)","O(1)","不稳定"],["计数排序","O(n + k)","O(n + k)","O(k)","稳定"],["基数排序","O(d(n + k))","O(d(n + k))","O(n + k)","稳定"],["桶排序","O(n + k)","O(n²)","O(n + k)","稳定"]],note:"「稳定」= 相等元素的相对次序不变。考点：快排最坏 O(n²) 的触发条件（数据有序 + 基准取首元素）、堆排序空间 O(1)、何时必须用稳定排序（多关键字排序）"},{key:"ds",name:"数据结构操作复杂度",columns:["结构","查找","插入","删除","备注"],rows:[["数组（按下标）","O(1)","O(n)","O(n)","尾部插入均摊 O(1)"],["链表","O(n)","O(1)","O(1)","需已拿到该结点指针"],["栈 / 队列","—","O(1)","O(1)","只在一端操作"],["哈希表","O(1) 平均","O(1) 平均","O(1) 平均","最坏 O(n)，取决于冲突处理"],["二叉搜索树","O(h)","O(h)","O(h)","h 为树高；退化成链时 O(n)"],["平衡树（AVL/红黑）","O(log n)","O(log n)","O(log n)","保证 h = O(log n)"],["堆（优先队列）","O(1) 取顶","O(log n)","O(log n)","找任意元素 O(n)"],["并查集","α(n)≈O(1)","α(n)≈O(1)","不支持","路径压缩 + 按秩合并"],["Trie","O(L)","O(L)","O(L)","L 为串长"]],note:"考点：哈希平均 O(1) 的最坏情况、BST 退化、堆为什么能 O(1) 取极值"},{key:"graph",name:"图算法对比",columns:["算法","复杂度","适用场景","注意"],rows:[["BFS","O(V + E)","无权图最短路、层序遍历","入队即标记"],["DFS","O(V + E)","连通性、拓扑、回溯搜索","深递归需防爆栈"],["Dijkstra","O((V+E)log V)","单源最短路，边权 ≥ 0","不能有负权边"],["Bellman-Ford","O(VE)","含负权边、判负环","负环 → 最短路不存在"],["Floyd","O(V³)","多源最短路、传递闭包","三重循环顺序 k-i-j 不能乱"],["拓扑排序","O(V + E)","DAG 任务定序、判环","输出数 < V 说明有环"],["Kruskal","O(E log E)","最小生成树（稀疏图）","先排序边，用并查集判环"],["Prim","O(E log V)","最小生成树（稠密图）","从点集扩展，用堆选最小边"],["二叉树 LCA / Tarjan","O(n) / O(n α)","树上路径问题","倍增预处理 O(n log n)"]],note:"选型口诀：边权为 1 用 BFS；非负权用 Dijkstra；有负权用 Bellman-Ford/SPFA；多源小图用 Floyd；稀疏图 Kruskal、稠密图 Prim"},{key:"growth",name:"复杂度量级对照（做题估算用）",columns:["复杂度","n = 10","n = 100","n = 1000","n = 10⁵"],rows:[["O(1)","1","1","1","1"],["O(log n)","3","7","10","17"],["O(n)","10","100","10³","10⁵"],["O(n log n)","33","7×10²","10⁴","1.7×10⁶"],["O(n²)","100","10⁴","10⁶","10¹⁰ ❌"],["O(n³)","10³","10⁶","10⁹ ❌","10¹⁵ ❌"],["O(2ⁿ)","10³","10³⁰ ❌","—","—"],["O(n!)","3.6×10⁶","—","—","—"]],note:"经验值：C 语言 1 秒约 10⁸ 次基本操作。n ≤ 20 可指数级；n ≤ 500 可 O(n³)；n ≤ 5000 可 O(n²)；n ≤ 10⁵ 需 O(n log n) 或更好——看题目数据范围就能反推该用什么算法"}],Z=[gn,xn,vn,{key:"algo",name:"算法代码模板",type:"code",items:hn},{key:"complexity",name:"复杂度速查",type:"table",tables:_n}];function yn(s){return s.type==="formula"?s.groups.reduce((t,i)=>t+i.items.length,0):s.type==="code"?s.items.length:s.tables.length}function wt(s){return"```"+(s.lang||"c")+`
`+s.code+"\n```"}const bn={class:"zr-root surface-standard"},wn={class:"zr-head"},kn={class:"zr-tools"},qn={class:"zr-search"},jn={class:"zr-chips"},Sn=["onClick"],$n={class:"zr-chip-n"},An={class:"muted",style:{margin:"12px 0 4px"}},On={class:"zr-group-t"},Ln={class:"zr-group-t"},zn={key:0,class:"pe-overlay"},Nn={class:"pe-toolbar"},Cn={class:"pe-tip"},Pn={class:"pe-actions"},Mn={class:"pe-paper"},Dn={class:"pe-head"},Vn={class:"pe-sub"},Bn={class:"pe-subject"},Tn={class:"zpr-gt"},En={class:"zpr-code-name"},Fn={class:"zpr-meta"},Xn={class:"zpr-meta"},In={class:"zr-code"},Un={__name:"Reference",setup(s){const t={props:{item:{type:Object,required:!0}},setup(h){return()=>A("div",{class:"zr-fx"},[A("div",{class:"zr-name"},h.item.name),A("div",{class:"zr-formula"},[A(U,{content:"$$"+h.item.tex+"$$"})]),h.item.note?A("div",{class:"zr-note"},[A(U,{content:h.item.note})]):null])}},i={props:{item:{type:Object,required:!0},running:Boolean},emits:["toggle","copy"],setup(h,{emit:b}){return()=>A("div",{class:"zr-code-card"},[A("div",{class:"zr-code-head"},[A("div",{class:"zr-name"},h.item.name),A("div",{class:"zr-tags"},h.item.tags.map(v=>A("span",{class:"zr-tag"},v)))]),A("div",{class:"zr-meta"},[A("span",{class:"zr-k"},"复杂度"),h.item.complexity]),A("div",{class:"zr-meta"},[A("span",{class:"zr-k"},"易错"),h.item.pitfalls]),A("div",{class:"zr-meta"},[A("span",{class:"zr-k"},"适用"),h.item.usage]),A("div",{class:"zr-code"},[A(U,{content:wt(h.item)})]),A("div",{class:"zr-code-ops"},[A("button",{class:"zr-btn",onClick:()=>b("copy")},"复制代码"),A("button",{class:"zr-btn",onClick:()=>b("toggle")},h.running?"收起编辑器":"在编辑器里试跑")]),h.running?A(mn,{code:h.item.code,language:h.item.lang}):null])}},n={props:{table:{type:Object,required:!0}},setup(h){return()=>A("div",{class:"zr-group"},[A("div",{class:"zr-group-t"},h.table.name),A("table",{class:"zr-table"},[A("thead",[A("tr",h.table.columns.map(b=>A("th",b)))]),A("tbody",h.table.rows.map(b=>A("tr",b.map(v=>A("td",v)))))]),h.table.note?A("div",{class:"zr-note"},h.table.note):null])}},o=N("calc"),r=N(""),e=N({}),c=N(!1),m=N("current"),f=C(()=>Z.find(h=>h.key===o.value)||Z[0]),j=C(()=>m.value==="all"?Z:[f.value]),q=C(()=>{const h=r.value.trim().toLowerCase();if(!h)return[];const b=[];for(const v of Z)if(v.type==="formula")for(const k of v.groups)for(const T of k.items)(T.name+" "+k.title+" "+(T.note||"")+" "+T.tex).toLowerCase().includes(h)&&b.push({section:v,sub:k.title,kind:"fx",item:T});else if(v.type==="code")for(const k of v.items)(k.name+" "+k.tags.join(" ")+" "+k.complexity+" "+k.pitfalls+" "+k.usage+" "+k.code).toLowerCase().includes(h)&&b.push({section:v,sub:"代码模板",kind:"code",item:k});else for(const k of v.tables)(k.name+" "+k.note+" "+k.rows.flat().join(" ")).toLowerCase().includes(h)&&b.push({section:v,sub:"速查表",kind:"table",table:k});return b}),l=C(()=>{const h=new Date,b=k=>String(k).padStart(2,"0");return`${`${h.getFullYear()}-${b(h.getMonth()+1)}-${b(h.getDate())} ${b(h.getHours())}:${b(h.getMinutes())}`} 导出 · ${m.value==="all"?"全部分类":f.value.name}`});function L(h){o.value=h,r.value="",rt("ref",{category:h})}function M(h){e.value={...e.value,[h]:!e.value[h]}}async function $(h){try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(h),W.success("代码已复制");return}}catch{}try{const b=document.createElement("textarea");b.value=h,b.style.position="fixed",b.style.top="-9999px",b.style.opacity="0",document.body.appendChild(b),b.focus(),b.select();const v=document.execCommand("copy");document.body.removeChild(b),W[v?"success":"warning"](v?"代码已复制":"复制失败，请手动选择复制")}catch{W.warning("复制失败，请手动选择复制")}}function u(h){m.value=h,c.value=!0}function S(){document.body.classList.add("zy-printing");const h=()=>document.body.classList.remove("zy-printing");window.addEventListener("afterprint",h,{once:!0}),setTimeout(h,6e4),window.print()}return nt(()=>{rt("ref",{category:o.value})}),ot(()=>document.body.classList.remove("zy-printing")),(h,b)=>(d(),p("div",bn,[a("div",wn,[b[6]||(b[6]=a("h3",{class:"section-title",style:{margin:"0"}},"考前速查（公式大全 + 算法模板）",-1)),a("div",kn,[a("div",qn,[z(ct,{modelValue:r.value,"onUpdate:modelValue":b[0]||(b[0]=v=>r.value=v),placeholder:"搜关键词：泰勒、换元、二分、背包…"},null,8,["modelValue"])]),z(Q,{variant:"ghost",size:"sm",onClick:b[1]||(b[1]=v=>u("current"))},{default:X(()=>[...b[4]||(b[4]=[D("打印本类",-1)])]),_:1}),z(Q,{variant:"primary",size:"sm",onClick:b[2]||(b[2]=v=>u("all"))},{default:X(()=>[...b[5]||(b[5]=[D("打印全部",-1)])]),_:1})])]),a("div",jn,[(d(!0),p(O,null,P(I(Z),v=>(d(),p("button",{key:v.key,class:tt(["zr-chip",{active:!r.value.trim()&&o.value===v.key}]),onClick:k=>L(v.key)},[D(w(v.name),1),a("span",$n,w(I(yn)(v)),1)],10,Sn))),128))]),r.value.trim()?(d(),p(O,{key:0},[a("div",An,w(q.value.length?`找到 ${q.value.length} 条与「${r.value.trim()}」相关的内容`:"没有匹配的内容，换个关键词试试"),1),(d(!0),p(O,null,P(q.value,(v,k)=>(d(),p("div",{key:v.section.key+"-"+k,class:"zr-group"},[a("div",On,w(v.section.name)+" · "+w(v.sub),1),v.kind==="fx"?(d(),B(t,{key:0,item:v.item},null,8,["item"])):v.kind==="code"?(d(),B(i,{key:1,item:v.item,running:!!e.value[v.item.key],onToggle:T=>M(v.item.key),onCopy:T=>$(v.item.code)},null,8,["item","running","onToggle","onCopy"])):(d(),B(n,{key:2,table:v.table},null,8,["table"]))]))),128))],64)):(d(),p(O,{key:1},[f.value.type==="formula"?(d(!0),p(O,{key:0},P(f.value.groups,v=>(d(),p("div",{key:v.title,class:"zr-group"},[a("div",Ln,w(v.title),1),(d(!0),p(O,null,P(v.items,k=>(d(),B(t,{key:k.name,item:k},null,8,["item"]))),128))]))),128)):f.value.type==="code"?(d(),p(O,{key:1},[b[7]||(b[7]=a("div",{class:"muted",style:{margin:"12px 0 0"}}," 模板均为完整可编译程序（C99），点「在编辑器里试跑」可直接改参数运行；复杂度与易错点按考点整理。 ",-1)),(d(!0),p(O,null,P(f.value.items,v=>(d(),B(i,{key:v.key,item:v,running:!!e.value[v.key],onToggle:k=>M(v.key),onCopy:k=>$(v.code)},null,8,["item","running","onToggle","onCopy"]))),128))],64)):(d(!0),p(O,{key:2},P(f.value.tables,v=>(d(),B(n,{key:v.key,table:v},null,8,["table"]))),128))],64)),(d(),B(Pt,{to:"body"},[c.value?(d(),p("div",zn,[a("div",Nn,[a("div",Cn,w(m.value==="all"?"全部速查内容":f.value.name)+" · 点「打印」后在对话框中选择「另存为 PDF」即可 ",1),a("div",Pn,[a("button",{class:"pe-btn pe-btn-primary",onClick:S},"打印 / 保存 PDF"),a("button",{class:"pe-btn",onClick:b[3]||(b[3]=v=>c.value=!1)},"关闭")])]),a("div",Mn,[a("div",Dn,[b[8]||(b[8]=a("div",{class:"pe-title"},"知一 · 考前速查",-1)),a("div",Vn,w(l.value),1)]),(d(!0),p(O,null,P(j.value,v=>(d(),p(O,{key:v.key},[a("div",Bn,w(v.name),1),v.type==="formula"?(d(!0),p(O,{key:0},P(v.groups,k=>(d(),p(O,{key:k.title},[a("div",Tn,w(k.title),1),(d(!0),p(O,null,P(k.items,T=>(d(),p("div",{key:T.name,class:"zpr-fx"},[z(t,{item:T},null,8,["item"])]))),128))],64))),128)):v.type==="code"?(d(!0),p(O,{key:1},P(v.items,k=>(d(),p("div",{key:k.key,class:"zpr-code"},[a("div",En,w(k.name),1),a("div",Fn,"复杂度："+w(k.complexity),1),a("div",Xn,"易错："+w(k.pitfalls),1),a("div",In,[z(U,{content:I(wt)(k)},null,8,["content"])])]))),128)):(d(!0),p(O,{key:2},P(v.tables,k=>(d(),B(n,{key:k.key,table:k},null,8,["table"]))),128))],64))),128))])])):V("",!0)]))]))}},Qn=H(Un,[["__scopeId","data-v-03acd3d5"]]),Rn={class:"zy-container zy-page more"},Gn={class:"more__toolbar"},Wn={class:"t-h3"},Yn={class:"more__toolbody"},Hn={class:"more__section"},Kn={class:"more__list"},Jn={class:"more__row-label"},Zn={class:"more__section"},ti={class:"more__list"},ei={class:"more__section"},ni={class:"more__grid"},ii=["onClick"],ai={class:"more__card-title"},ri={class:"more__card-desc"},oi={class:"more__section"},si={class:"more__list"},li=["onClick"],di={class:"more__row-label"},ui={class:"more__row-desc"},ci={class:"more__section"},fi={class:"more__list"},pi={class:"more__section"},mi={class:"more__list"},gi=["onClick"],xi={class:"more__row-label"},vi={class:"more__row-desc"},hi={key:0,class:"more__badge"},_i={class:"more__build"},yi={__name:"MorePage",setup(s){const t="202609210920",i=Mt(),n=Dt(),o=C(()=>_t.space==="account"),r=C(()=>o.value?`我的（${_t.userId||"已登录"}）`:"我的（未登录）"),e=[{key:"exam",title:"模拟考试",desc:"生成 100 分卷子，交卷 AI 判分",icon:"clipboard"},{key:"algo",title:"算法演示",desc:"21 个经典算法的分步动画",icon:"play"},{key:"debug",title:"代码诊断",desc:"贴代码 + 报错，定位错在哪、怎么改",icon:"settings"},{key:"ref",title:"考前速查",desc:"公式大全与算法模板，可打印",icon:"book"}],c=[{label:"学习数据",desc:"时长、题量、错题趋势、知识点掌握度",path:F.data},{label:"学习记录",desc:"每次讲解、追问与练习的记录",path:F.records},{label:"我的课程",desc:"手动添加课程、章节与知识点",path:F.course},{label:"课程表",desc:"周课表与节次安排",path:F.timetable},{label:"考试安排",desc:"记录考试日期，课表与首页自动提醒",path:F.exams}],m=[{label:"产品介绍",desc:"知一是什么、适合谁、怎么用",path:F.about},{label:"帮助与反馈",desc:"常见问题与意见反馈",path:F.help}],f=C(()=>{const $=String(i.query.tool||"");return e.some(u=>u.key===$)?$:""}),j=C(()=>{var $;return(($=e.find(u=>u.key===f.value))==null?void 0:$.title)||""}),q=C(()=>i.query.algo?String(i.query.algo):null);function l($){if($==="exam"){n.push(F.simExam);return}n.push({path:F.more,query:{tool:$}})}function L(){n.push({path:F.more})}function M($){n.push($)}return($,u)=>(d(),p("div",Rn,[f.value?(d(),p(O,{key:0},[a("div",Gn,[z(Q,{variant:"ghost",size:"sm",onClick:L},{default:X(()=>[...u[3]||(u[3]=[D("← 返回更多",-1)])]),_:1}),a("span",Wn,w(j.value),1)]),a("div",Yn,[f.value==="algo"?(d(),B(Ee,{key:0,"initial-algo":q.value},null,8,["initial-algo"])):f.value==="debug"?(d(),B(an,{key:1})):(d(),B(Qn,{key:2}))])],64)):(d(),p(O,{key:1},[u[17]||(u[17]=a("header",{class:"more__head"},[a("h1",{class:"t-h1"},"更多"),a("p",{class:"t-body-2"},"学习工具、课程与学习数据，都收在这里。")],-1)),a("section",Hn,[u[6]||(u[6]=a("h2",{class:"t-h3 more__section-title"},"账号",-1)),a("div",Kn,[a("button",{class:"more__row",type:"button",onClick:u[0]||(u[0]=S=>M(I(F).mine))},[a("span",Jn,w(r.value),1),u[4]||(u[4]=a("span",{class:"more__row-desc"},"账号与登录、偏好设置、每日目标、数据管理",-1)),u[5]||(u[5]=a("span",{class:"more__card-arrow","aria-hidden":"true"},"→",-1))])])]),a("section",Zn,[u[8]||(u[8]=a("h2",{class:"t-h3 more__section-title"},"班级",-1)),a("div",ti,[a("button",{class:"more__row",type:"button",onClick:u[1]||(u[1]=S=>M(I(F).classPage))},[...u[7]||(u[7]=[a("span",{class:"more__row-label"},"我的班级",-1),a("span",{class:"more__row-desc"},"老师建班布置作业，学生拍照提交，AI 一键批改",-1),a("span",{class:"more__card-arrow","aria-hidden":"true"},"→",-1)])])])]),a("section",ei,[u[10]||(u[10]=a("h2",{class:"t-h3 more__section-title"},"学习工具",-1)),a("div",ni,[(d(),p(O,null,P(e,S=>a("button",{key:S.key,class:"more__card surface-standard",type:"button",onClick:h=>l(S.key)},[z(Vt,{name:S.icon,size:20},null,8,["name"]),a("span",ai,w(S.title),1),a("span",ri,w(S.desc),1),u[9]||(u[9]=a("span",{class:"more__card-arrow","aria-hidden":"true"},"→",-1))],8,ii)),64))])]),a("section",oi,[u[12]||(u[12]=a("h2",{class:"t-h3 more__section-title"},"课程与数据",-1)),a("div",si,[(d(),p(O,null,P(c,S=>a("button",{key:S.path,class:"more__row",type:"button",onClick:h=>M(S.path)},[a("span",di,w(S.label),1),a("span",ui,w(S.desc),1),u[11]||(u[11]=a("span",{class:"more__card-arrow","aria-hidden":"true"},"→",-1))],8,li)),64))])]),a("section",ci,[u[14]||(u[14]=a("h2",{class:"t-h3 more__section-title"},"社区",-1)),a("div",fi,[a("button",{class:"more__row",type:"button",onClick:u[2]||(u[2]=S=>M(I(F).community))},[...u[13]||(u[13]=[a("span",{class:"more__row-label"},"知一社区",-1),a("span",{class:"more__row-desc"},"论坛讨论与学习小组",-1),a("span",{class:"more__card-arrow","aria-hidden":"true"},"→",-1)])])])]),a("section",pi,[u[16]||(u[16]=a("h2",{class:"t-h3 more__section-title"},"关于",-1)),a("div",mi,[(d(),p(O,null,P(m,S=>a("button",{key:S.path,class:"more__row",type:"button",onClick:h=>M(S.path)},[a("span",xi,w(S.label),1),a("span",vi,w(S.desc),1),S.badge?(d(),p("span",hi,w(S.badge),1)):V("",!0),u[15]||(u[15]=a("span",{class:"more__card-arrow","aria-hidden":"true"},"→",-1))],8,gi)),64))])])],64)),a("p",_i,[u[18]||(u[18]=D("当前构建 ",-1)),a("b",null,w(I(t)),1),u[19]||(u[19]=D(" · 若这里不是最新版本，请强制刷新（Ctrl/Cmd+Shift+R）",-1))])]))}},Ai=H(yi,[["__scopeId","data-v-b9e1a995"]]);export{Ai as default};
