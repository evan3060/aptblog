# aptblog 迁移与部署设计

> **来源：** 基于 `2026-07-10-aptblog-blog-solution-design.md`（aptbot v0.3.2 讨论纪要）落地实施。本文档为 aptblog 项目首个 spec，聚焦 VPS gap 修复验证 + aptbot learn 文章迁移 + Hexo 站点初始化与首次部署。
>
> **状态：** 设计已确认，待 writing-plans 生成实施计划。

## 1. 范围与目标

### 1.1 本次覆盖

1. **VPS gap 修复验证**：确认设计 `2026-07-10-aptblog-blog-solution-design.md` §6 要求的环境项已就绪
2. **内容迁移**：aptbot `src/learn/articles/` 18 篇文章（Track 1 agent-practice 12 篇 + Track 2 ai-coding-practice 6 篇，中英双语 36 文件 + 配套图片）→ aptblog Hexo 站点，通过自动化脚本一次性完成。注：原始设计文档称"19 篇"系笔误，经 grep 实际验证为 18 篇（编号跳过 12）。
3. **Hexo 站点初始化与配置**：Next 主题、i18n 双语、Giscus 评论、SEO 插件
4. **首次手动部署**：本地构建 → git push → VPS pull + 重建 → 验证 `https://blog.aptbot.de/`

### 1.2 不在本次范围

- **wechatsync 集成**：运行时操作（浏览器扩展同步到公众号草稿），非迁移任务，站点上线后手动操作
- **CI/CD 自动部署**：设计 §7.1 的 GitHub Actions 延后，先跑通手动部署流程
- **aptbot 侧 learn 系统改动**：设计 §8 标注可选，延后处理
- **新文章写作**：仅迁移已有 18 篇，不写新内容

### 1.3 成功标准

- `https://blog.aptbot.de/` 可访问，首页列出迁移的 18 篇文章
- 文章 URL 稳定（基于 slug，permalink `:lang/:slug.html`）
- 中英双语可切换（`/zh/...` + `/en/...`）
- VPS 上 aptblog 用户可独立完成 `git pull && npm ci && npx hexo generate` 部署，无需 root
- 迁移脚本可重复执行，每次运行清空目标目录后重新生成

## 2. VPS 环境完备性检查结果

### 2.1 已就绪项（本次检查验证通过）

| 项 | 状态 | 验证方式 |
|----|------|---------|
| aptblog 用户 | ✅ | UID 1002，shell /bin/bash，home /home/aptblog |
| aptblog SSH 密钥登录 | ✅ | `ssh aptblog@aptbot.de` 成功（修复了 .ssh 目录属主 + sshd reload） |
| sshd_config AllowUsers | ✅ | `AllowUsers aptbot evan aptblog`，已 reload sshd |
| sshd_config Match User aptblog | ✅ | `PasswordAuthentication no`（仅密钥登录） |
| /var/www/aptblog 属主 | ✅ | `aptblog:aptblog 755` |
| /var/www/aptblog/public 属主 | ✅ | `aptblog:aptblog 755`，写权限验证通过 |
| sudoers aptblog | ✅ | `NOPASSWD: /usr/sbin/nginx -t` + `NOPASSWD: /usr/bin/systemctl reload nginx` |
| nginx 站点配置 | ✅ | `/etc/nginx/sites-available/aptblog` 已建并 symlink 启用，语法校验 OK |
| nginx 配置内容 | ✅ | 80→HTTPS 301、443 SSL、root `/var/www/aptblog/public`、SSL 证书路径正确 |
| DNS blog.aptbot.de | ✅ | A 记录已解析 |
| SSL 证书 | ✅ | `/etc/letsencrypt/live/blog.aptbot.de/` 已签发 |
| HTTP→HTTPS 跳转 | ✅ | `curl -I http://blog.aptbot.de/` 返回 301 |
| Node.js | ✅ | v20.20.2（/usr/bin/node） |
| npm | ✅ | 10.8.2（/usr/bin/npm） |

### 2.2 修复过程中发现并解决的问题

1. **.ssh 目录属主错误**：`/home/aptblog/.ssh` 原为 `root:root`，sshd StrictModes 拒绝读取。修复为 `aptblog:aptblog`，权限 700
2. **sshd 未 reload**：配置文件已含 aptblog，但运行中的 sshd 仍用旧配置。`systemctl reload ssh` 后生效

### 2.3 待执行项（依赖 aptblog 项目本地建好并 push）

| 项 | 执行者 | 命令 |
|----|--------|------|
| 克隆仓库到 VPS | aptblog 用户 | `git clone https://github.com/evan3060/aptblog.git /var/www/aptblog`（注意：public/ 已存在，需先处理冲突或克隆到临时目录再合并） |
| 安装依赖 | aptblog 用户 | `cd /var/www/aptblog && npm ci` |
| 首次构建 | aptblog 用户 | `npx hexo generate` |

**克隆冲突说明**：`/var/www/aptblog/public` 已存在（空目录，aptblog:aptblog）。git clone 到非空目录会失败。两种处理方式：
- 方式 A（推荐）：先删 public/，clone 后 Hexo 重新生成 public/
- 方式 B：clone 到临时目录，mv 内容到 /var/www/aptblog（保留 public/ 属主）

## 3. 迁移脚本设计

### 3.1 脚本职责

读取 aptbot 源文章 → 转换 frontmatter → 重写图片路径 → 输出到 aptblog 目录结构。可重复执行，每次运行清空目标目录后重新生成。

### 3.2 脚本位置与调用

- 脚本路径：`aptblog/scripts/migrate-from-aptbot.mjs`
- 源目录参数：默认 `../aptbot/src/learn/articles/`（可通过 CLI 参数覆盖）
- 输出目录：`aptblog/source/`（_posts/、_posts-en/、images/）

### 3.3 frontmatter 映射规则

源文章 frontmatter 由 zod schema 约束（见 aptbot `src/learn/article-types.ts` ArticleMetaSchema），格式统一。

| 源字段 | 目标字段 | 处理说明 |
|--------|---------|---------|
| `title` | `title` | 直接映射 |
| `description` | `description` | 直接映射 |
| `tags` | `tags` | 直接映射 |
| `lastUpdated` | `date` | 格式 `YYYY-MM-DD`，直接映射 |
| `track` + `chapter` | `categories` | track 作一级分类，chapter 作二级分类 |
| `slug` | 文件名 + `permalink` | slug 作文件名，permalink 设为 `:lang/:slug.html`（配合 i18n） |
| `difficulty` | `difficulty` | 保留为 frontmatter 自定义字段 |
| `estimatedReadingTime` | `reading_time` | 保留为自定义字段 |
| `prerequisites` | `prerequisites` | 保留为 slug 列表 |
| `order` | 丢弃 | Hexo 按日期排序 |
| `status: published` | 移入 `_posts/`（zh）或 `_posts-en/`（en） | |
| `status: planned` | 移入 `_drafts/` | |

### 3.4 图片迁移

- 源：`aptbot/src/learn/articles/images/<name>.png` + `<name>-gpt.png` + `<name>.md`（图表说明）
- 源文章图片引用格式统一为 `/learn/articles/images/<name>.png`（aptbot 站点绝对路径，经 grep 验证 30 处引用格式完全一致）
- 源图片所有文件同目录存放（不按 slug 分子目录），文件名与文章 slug 不对应（如 `dev-workflow.png` 对应文章 `01-dev-workflow`）
- 目标：`aptblog/source/images/<article-slug>/<name>.png`（按文章 slug 分子目录）
- `*-gpt.png` 保留，与人工版并列存放
- `*.md`（图表说明文件）：丢弃（图表说明已在正文中引用，独立 .md 是冗余）
- 文章内图片引用路径：从 `/learn/articles/images/<name>.png` 改为 Hexo 绝对路径 `/images/<slug>/<name>.png`
- 图片归属逻辑：通过图片文件名匹配文章 slug（如 `dev-workflow.png` → 匹配含 `dev-workflow` 的 slug → 归入该文章子目录）；无法匹配的图片归入 `source/images/misc/`

### 3.5 双语处理（i18n 方案）

- 中文 `.md` → `source/_posts/<slug>.md`
- 英文 `.en.md` → `source/_posts-en/<slug>.md`
- 通过 `hexo-generator-i18n` 插件配置多 source，URL 结构 `/zh/:slug.html` + `/en/:slug.html`
- 主题切换语言通过 i18n 插件的前缀路由实现

### 3.6 脚本接口契约

脚本作为 Node.js ES module 运行，依赖 gray-matter（在 aptblog 项目 `package.json` 中声明，Hexo 初始化后随依赖安装）。其余仅用 Node.js 内置模块（fs/path/url）。

**输入**：
- CLI 参数 `--source=<path>`（可选，默认 `../aptbot/src/learn/articles/`）
- CLI 参数 `--dry-run`（可选，仅打印将执行的操作，不写文件）

**输出**：
- 退出码 0 成功，非 0 失败
- stdout 打印迁移统计：处理文章数、图片数、跳过数
- 写入 `source/_posts/`、`source/_posts-en/`、`source/images/`

**幂等性**：每次运行先清空目标目录（`source/_posts/`、`source/_posts-en/`、`source/images/`），再重新生成。

**错误处理**：
- 源目录不存在 → 报错退出
- 单篇文章 frontmatter 解析失败 → 警告 + 跳过，继续处理其他文章
- 图片文件缺失 → 警告 + 跳过该图片，文章内引用保留原路径

## 4. Hexo 站点配置

### 4.1 初始化

- `npx hexo init .` 在 aptblog 项目根目录初始化
- 安装 Next 主题：通过 npm（`npm install hexo-theme-next`）或 git clone 主题仓库到 `themes/next`，实施时参照 Next 主题官方文档确认推荐安装方式
- 安装插件：`hexo-generator-i18n`、`hexo-generator-sitemap`、`hexo-generator-feed`、`hexo-generator-search`

### 4.2 核心配置（_config.yml）

- `url: https://blog.aptbot.de`
- `root: /`
- `permalink: :lang/:slug.html`（配合 i18n）
- `language: [zh, en]`
- `theme: next`
- `source_dir: source`
- `public_dir: public`
- i18n 插件配置：多 source（`_posts` 为 zh，`_posts-en` 为 en）

### 4.3 主题配置（_config.next.yml）

- 语言切换菜单
- 代码高亮（highlight.js）
- TOC（文章目录）
- Giscus 评论集成（配置 GitHub repo + category）
- 移动端响应式（Next 内置）
- 搜索框（基于 hexo-generator-search）

### 4.4 仓库结构（最终）

```
aptblog/
├── source/
│   ├── _posts/           ← 中文文章（18 篇）
│   ├── _posts-en/        ← 英文文章（18 篇）
│   ├── _drafts/          ← 草稿
│   ├── about/            ← 关于页
│   └── images/<slug>/    ← 按文章 slug 分目录的图片
├── themes/next/          ← Next 主题
├── scripts/
│   └── migrate-from-aptbot.mjs  ← 迁移脚本
├── _config.yml           ← Hexo 主配置
├── _config.next.yml      ← Next 主题配置
├── package.json
├── .gitignore
└── docs/superpowers/
    └── specs/            ← 设计文档
```

## 5. 部署流程

### 5.1 首次部署

1. 本地：迁移脚本生成内容 → `npx hexo generate` 预览 → `npx hexo server` 本地验证
2. 本地：git add + commit + push 到 GitHub `aptblog` 仓库
3. VPS（aptblog 用户 SSH 登录）：
   - 处理 public/ 冲突（删除空 public/ 或克隆到临时目录）
   - `git clone https://github.com/evan3060/aptblog.git /var/www/aptblog`
   - `cd /var/www/aptblog && npm ci`
   - `npx hexo generate`
4. 验证：`curl -I https://blog.aptbot.de/` 返回 200，首页列出文章

### 5.2 日常更新流程

1. 本地：写/改文章 → `npx hexo generate` 预览 → git push
2. VPS：`cd /var/www/aptblog && git pull && npm ci && npx hexo generate`
3. nginx 无需 reload（静态文件直接生效，nginx 每次请求从磁盘读取）

### 5.3 CI/CD（延后）

站点手动跑通后再配 GitHub Actions（设计 §7.1）：
- 触发：push to main
- 步骤：checkout → setup-node → npm ci → hexo generate → rsync public/ 到 VPS
- VPS 配置部署专用 SSH key（authorized_keys 用 `command=` 限制）

## 6. 错误处理与边界条件

### 6.1 迁移脚本

- 源文章 frontmatter 不符合 zod schema → 脚本不应崩溃，警告 + 跳过
- 图片引用路径格式统一为 `/learn/articles/images/<name>.png`（经 grep 验证），脚本用单一正则匹配即可
- slug 含特殊字符 → 源 zod 已约束 `^[a-z0-9-]+$`，无需额外处理
- 中英文章 slug 相同 → i18n 通过目录区分（_posts/ vs _posts-en/），不冲突
- 图片文件名与 slug 部分匹配（如 `dev-workflow.png` 与 slug `01-dev-workflow`）→ 脚本用包含关系匹配，无匹配的图片归入 misc/

### 6.2 部署

- git clone 到非空目录失败 → 见 §2.3 处理方式
- npm ci 失败（lockfile 不一致）→ 用 npm install 兜底，后续固定 lockfile
- hexo generate 失败 → 检查主题/插件配置，nginx 仍服务旧的 public/（不影响线上）

### 6.3 双语路由

- i18n 插件未正确配置 → 文章 404，需验证 `_config.yml` 的 i18n 配置
- 默认语言访问 `/` 应重定向到 `/zh/` 或显示中文首页（i18n 插件行为）

## 7. 测试策略

### 7.1 迁移脚本测试

脚本作为可重复执行的独立模块，需验证：
- 给定固定输入（aptbot 真实文章），输出符合预期 frontmatter 映射
- 图片路径重写正确
- 幂等性：二次运行结果一致
- dry-run 模式不写文件

测试方式：先在真实 aptbot 文章上执行 dry-run，人工核对输出；再执行实际迁移，本地 `hexo server` 验证渲染。

### 7.2 站点验证

- 本地 `hexo server` 预览：首页、文章页、中英切换、图片显示、代码高亮
- VPS 部署后：`curl -I` 验证 200、浏览器访问验证渲染、移动端响应式

## 8. 参考资料

- 原始设计文档：`2026-07-10-aptblog-blog-solution-design.md`（aptblog 项目根目录）
- aptbot learn 源文章：`aptbot/src/learn/articles/`
- aptbot 文章 schema：`aptbot/src/learn/article-types.ts` ArticleMetaSchema
- aptbot 文章加载器：`aptbot/src/learn/article-loader.ts`（参考 frontmatter 解析逻辑）
- Hexo 官方文档：https://hexo.io/
- Hexo Next 主题：https://theme-next.js.org/
- hexo-generator-i18n：npm 包，实施时 `npm search hexo-generator-i18n` 确认维护版本
- Giscus：https://giscus.app/
