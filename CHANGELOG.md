# Changelog

## [0.1.0] - 2026-07-10

### 首个正式版本

aptblog 从 aptbot 项目延伸为独立技术博客，完成内容迁移、i18n 双语切换、CI/CD 自动部署。

### Features

- **内容迁移**：从 aptbot 迁移 18 篇文章（36 个中英文文件）及图片资源，迁移脚本支持幂等执行
- **i18n 全局语言切换**：路径前缀方案（中文默认无前缀，英文 `/en/` 前缀），中英文页面完全分离
  - 自定义 Hexo 生成器生成分离的中英文首页、归档、分类、标签页
  - 滑动开关式语言切换按钮（左中右 EN），localStorage 持久化，首次访问语言探测
  - 菜单、侧边栏、site-state、搜索框、描述文字全量 i18n
  - 禁用 theme cache 避免缓存导致语言串扰
- **分类/标签中英文分离**：中文分类页只显示中文分类（Agent实践/AI编程实践），英文只显示英文；67 个标签全部翻译为中文
- **站点标题**：中文「智研博客 / AI实战笔记」，英文「aptblog / Ai Practice Blog」
- **关于页**：显示站点概览侧边栏（与首页一致），双语内容
- **CI/CD**：GitHub Actions + rsync 自动部署到 VPS，部署专用 SSH key 安全限制
- **移除动画**：禁用 NexT 主题 motion 动画，直接展示内容

### Bug Fixes

- 修复语言代码 `zh` → `zh-CN` 不匹配主题 `zh-CN.yml` 的问题
- 修复 `:lang/:slug.html` permalink 导致中文文章带 `/zh/` 前缀的问题
- 修复 theme partial cache 导致英文页面复用中文缓存内容
- 修复英文子分类 `Core Features Deep Dive` 与 `Deep Dive into Core Features` 不一致
- 修复英文分类/标签列表页 404
- 修复英文页面 meta description、og:description 仍为中文

### Tests

- 9 个 i18n 生成器单元测试（filterPostsByLang、buildEnPath、buildZhPath）
- 9 个迁移脚本测试（convertFrontmatter、rewriteImagePaths、migrateAll 幂等性、错误处理）

### UAT

- 自动化验证：本地 26 项 + 线上 23 项全部通过
- 人工 UAT：用户验收通过
