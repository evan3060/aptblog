<div align="center">
  <p>
    <img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version">
    <img src="https://img.shields.io/badge/Hexo-8.x-orange" alt="Hexo">
    <img src="https://img.shields.io/badge/theme-NexT-ff69b4" alt="Theme">
    <img src="https://img.shields.io/badge/license-MIT-yellow" alt="License">
  </p>
  <p>
    <a href="./README.md">English</a> |
    <a href="./README.zh-CN.md">简体中文</a>
  </p>
</div>

📝 **aptblog — 智研博客**

从 [aptbot](https://github.com/evan3060/aptbot) 项目延伸的独立技术博客，专注于 **Agent 实践**与 **AI 编程经验**的沉淀与分享。

它不是一个通用博客。它是一个从真实工程实践中诞生的知识库——18 篇深度文章，涵盖 Agent 架构设计、AI 编程工作流、系统演进路线。每篇文章都有中英文双语版本，配合全局语言切换器，让整个 UI 在你选择的语言下保持一致。

**目标：** 记录构建和迭代 AI 助理的旅程，让其他人能从架构决策、工作流约束和踩过的坑中学习。

> **状态：** v0.1.0 — 内容迁移（18 篇文章 × 双语）+ 全量 i18n 滑动开关切换 + CI/CD 自动部署 + 双语分类/标签。人工 UAT 验收通过。

## 从这里开始

| 你想... | 前往 |
|---|---|
| 阅读博客 | [https://blog.aptbot.de/](https://blog.aptbot.de/) |
| 切换语言 | 点击顶部菜单的中/EN 滑动开关 |
| 查看版本变更记录 | [更新日志](./CHANGELOG.md) |
| 从 aptbot 迁移内容 | [迁移脚本](./tools/migrate-from-aptbot.mjs) |
| 查看 i18n 设计方案 | [Spec](./docs/superpowers/specs/2026-07-10-i18n-redesign-design.md) |
| 查看实施计划 | [Plan](./docs/superpowers/plans/2026-07-10-i18n-redesign.md) |

## 🌐 国际化

aptblog 采用路径前缀方案实现完整的双语支持：

- **中文**（默认）：`/` — 无前缀，如 `https://blog.aptbot.de/01-dev-workflow.html`
- **英文**：`/en/` — 前缀，如 `https://blog.aptbot.de/en/01-dev-workflow.html`

### 实现原理

- 自定义 Hexo 生成器生成分离的中英文首页、归档、分类、标签页
- `template_locals` filter（优先级 20）覆盖英文页面的 `title`、`subtitle`、`description`
- 重写 `list_categories` 和 `tagcloud` helper，按 `page.lang` 过滤
- 禁用主题 partial 缓存，防止跨语言缓存污染
- 菜单栏的滑动开关让用户即时切换语言，配合 `localStorage` 持久化和首次访问浏览器语言探测

## 📖 内容

18 篇文章，分两个 Track，每篇都有中英文版本：

| Track | 文章数 | 主题 |
|---|---|---|
| Agent实践 | 12 | 什么是 Agent、aptbot 架构、Provider/Tool/Memory/Skills/Hook/Channel/Session/Security 内部原理、错误处理与流式 UX、未来路线图 |
| AI编程实践 | 6 | 开发工作流、编码准确率、规范文档管理、长期迭代、边界问题、持续改进 |

## 🏗️ 技术栈

| 组件 | 技术 |
|---|---|
| 静态站点生成器 | Hexo 8.x |
| 主题 | hexo-theme-next 8.28.0（Gemini scheme） |
| 国际化 | 路径前缀方案 + 自定义生成器 + 重写 helper |
| CI/CD | GitHub Actions + rsync 部署到 VPS |
| SSL | Let's Encrypt via nginx |
| 测试 | Vitest（18 个单元测试） |

## 🚀 本地开发

前置条件：Node.js 20+ 和 npm。

```bash
git clone https://github.com/evan3060/aptblog.git
cd aptblog
npm install
```

### 启动开发服务器

```bash
npx hexo server --port 4000
```

访问 [http://localhost:4000/](http://localhost:4000/) 查看中文站，或 [http://localhost:4000/en/](http://localhost:4000/en/) 查看英文站。

### 生产构建

```bash
npx hexo clean && npx hexo generate
```

输出到 `public/` 目录。

### 运行测试

```bash
npx vitest run
```

## 📦 内容迁移

文章从 aptbot 项目的 `src/learn/articles/` 目录通过自动化脚本迁移：

```bash
node tools/migrate-from-aptbot.mjs
```

脚本功能：
- 读取源文章（中文 `.md` + 英文 `.en.md`）
- 转换 frontmatter：添加 `lang` 字段，英文设置 `permalink`，中文翻译分类/标签
- 重写图片路径：从 `/learn/articles/images/` 改为 `/images/<slug>/`
- 幂等执行——可安全重复运行

## 🔧 项目结构

```
aptblog/
├── _config.yml              # Hexo 配置（标题、语言、permalink）
├── _config.next.yml         # NexT 主题配置（动画、自定义文件路径、缓存）
├── scripts/
│   └── i18n.cjs             # 自定义生成器 + helper + template_locals filter
├── source/
│   ├── _posts/              # 18 篇中文 (.md) + 18 篇英文 (.en.md) 文章
│   ├── _data/               # 自定义注入文件（header、bodyEnd、styles）
│   ├── about/               # 中文关于页
│   ├── en/                  # 英文页面（关于、分类、标签）
│   └── images/              # 文章图片，按 slug 分目录
├── tools/
│   └── migrate-from-aptbot.mjs  # 内容迁移脚本
├── tests/                   # Vitest 单元测试
├── docs/superpowers/        # 设计文档和实施计划
└── .github/workflows/       # CI/CD 流水线
```

## 📝 License

MIT
