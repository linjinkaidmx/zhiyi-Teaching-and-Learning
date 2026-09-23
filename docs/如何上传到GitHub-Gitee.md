# 如何把知一 2.0 上传到 GitHub / Gitee

> 你的仓库**已经在本地建好了**：350 个文件 / 3.5MB / 8 个提交，分支名 `main`。
> 现在只差最后一步：**把它推到网上**。

---

## 先做选择：Gitee 还是 GitHub？

| | Gitee（码云） | GitHub |
|---|---|---|
| 国内访问速度 | **快** | 慢，可能需要处理网络 |
| 注册门槛 | 手机号即可 | 邮箱即可 |
| 密码推送 | **可以用账号密码** | **不能用密码，必须用 Token** |
| 赛事是否接受 | ✅ 手册明确写了「GitHub/Gitee 链接」 | ✅ |

**推荐 Gitee**：国内推送稳定、不用折腾 Token，官方也接受。下面路线 A 就是它。

---

## 路线 A：Gitee（推荐，约 5 分钟）

### 第 1 步：注册 / 登录

打开 `https://gitee.com` → 注册（手机号 + 验证码即可）→ 登录

### 第 2 步：新建一个空仓库

1. 登录后点右上角 **`+`** → **新建仓库**
2. **仓库名称**：填 `zhiyi`（或 `zhiyi-2.0`，英文即可）
3. **仓库介绍**：可填「面向大学理工科的 AI 拍题讲解 + 错题自测 + 班级教学平台」
4. **是否开源**：选 **公开**（评委要能直接打开）
5. ⚠️ **不要勾选**「使用 Readme 文件初始化这个仓库」、也不要选 `.gitignore` 模板 —— 因为本地已经有这些文件了，勾了会冲突
6. 点 **创建**

### 第 3 步：复制仓库地址

创建完成后，页面上会显示仓库地址，形如：

```
https://gitee.com/你的用户名/zhiyi.git
```

把这一串复制下来（点旁边的复制按钮）。

### 第 4 步：在本地推送（三条命令）

打开终端（Windows 上可以用 Git Bash，或用我这边直接执行也行），依次执行：

```bash
cd E:/知一2.0

git remote add origin https://gitee.com/你的用户名/zhiyi.git

git push -u origin main
```

- 第三条命令执行后会**弹出窗口要账号密码** → 输入你的 Gitee 账号和密码
- 等待 1~2 分钟（只有 3.5MB，很快）
- 看到类似这样的输出就成功了：

```
branch 'main' set up to track 'origin/main'.
```

### 第 5 步：验证

回到 Gitee 仓库页面刷新 → 应该能看到 350 个文件、README 自动展示在首页、提交历史有 8 条。

---

## 路线 B：GitHub（需要用到 Token）

### 和 Gitee 的唯一区别：密码换成 Token

GitHub 从 2021 年起**不再允许用账号密码推送**，必须用 **Personal Access Token（PAT）**。

1. 到 `https://github.com` 注册/登录
2. 右上角 **`+`** → **New repository**
   - Repository name：`zhiyi`
   - ⚠️ **不要勾** "Add a README file"
   - 选 **Public**
   - 点 **Create repository**
3. **生成 Token**：
   - 右上角头像 → **Settings**
   - 左侧菜单拉到最底 → **Developer settings**
   - **Personal access tokens** → **Tokens (classic)**
   - **Generate new token (classic)**
   - Note 填 `zhiyi`，Expiration 选 90 days
   - 勾选 **repo**（这一项就够）
   - 点最下面 **Generate token**
   - ⚠️ **立刻复制保存**（页面关掉就再也看不到了）
4. 复制仓库地址（`https://github.com/你的用户名/zhiyi.git`），然后同样的三条命令推送：

```bash
cd E:/知一2.0
git remote add origin https://github.com/你的用户名/zhiyi.git
git push -u origin main
```

5. 弹窗要求输入时：
   - 用户名 → 你的 GitHub 用户名
   - **密码 → 粘贴刚才那个 Token**（不是账号密码）

### 如果推送卡住 / 超时

GitHub 在国内可能连不上。三个办法，按推荐顺序：

1. **直接改用 Gitee**（最省事，官方也接受）
2. **用 GitHub Desktop**（见路线 C，自带重试）
3. 等网络好的时段再推（比如深夜）

---

## 路线 C：GitHub Desktop（完全不想碰命令行）

1. 下载安装：`https://desktop.github.com`
2. 打开 → 登录 GitHub 账号
3. 菜单 **File → Add local repository** → 选择 `E:\知一2.0`
   - 它会自动识别出这是一个已经建好的 git 仓库
4. 点右上角 **Publish repository**
5. 弹窗里：
   - Name 填 `zhiyi`
   - ⚠️ **取消勾选** "Keep this code private"（要公开）
   - 点 **Publish repository**
6. 等进度条走完 → 完成

---

## 推送成功后

1. **把仓库地址发我** —— 我把它补进 PPT 尾页和 Demo 视频尾页（各重出一次，约 4 分钟）
2. 到赛事专区（LearnBuddy → 【赛事】→ 粤港大湾区 AI coding 创新大赛）提交材料
3. **用无痕窗口打开你的仓库地址验证一下** —— 确保未登录状态也能看到代码（评委不会登录你的账号）

---

## 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| `Authentication failed` | GitHub 不能用密码 | 用 Token 当密码（路线 B 第 3 步） |
| `failed to push some refs` | 远程仓库不是空的（建仓库时勾了 README） | 删掉远程仓库重建（记得**不勾**初始化），或先 `git pull --rebase origin main` 再推 |
| 推送进度一直不动 / 超时 | 网络到 GitHub 不通 | 换 Gitee，或用 GitHub Desktop |
| `src refspec main does not match any` | 本地分支名不是 main | 执行 `git branch -M main` 后重推 |
| 反复弹窗要密码 | 凭据没被记住 | 推送成功一次后会记住；Gitee 可在 Windows「凭据管理器」里保存 |
| 提示某个文件太大 | 单文件超 100MB（GitHub 上限） | 你的仓库最大文件只有 675KB，不会遇到 |

---

## 关于隐私：可以放心推

我在建仓库时已经做过这些处理：

- **`backend/.env`（含真实 API Key）已排除**，不会上传
- **本地 SQLite 数据库**（含账号、错题数据）已排除
- **测试账号 token 文件**（`_qa_accounts.json`）已排除
- **服务器密码从未写入任何文件**（一直是环境变量传递，我全盘扫过确认）
- 构建产物、QA 截图、缓存、`node_modules`、参赛素材（含 32MB 视频）均已排除

仓库里就是**纯源码 + 文档**，350 个文件、3.5MB。
