# aptblog 研发规范

> **适用范围：** aptblog 项目所有迭代（站点初始化 / 内容迁移 / 主题配置 / 后续文章发布）。
> **版本：** v1.0（2026-07-10，基于 aptbot dev-workflow v1.1 裁剪，适配 Hexo 静态站点特点）
> **superpower 流程：** brainstorming → spec → writing-plans → subagent-driven-development / executing-plans

---

## 0. superpower 标准流程

每个迭代必须按以下顺序执行，不得跳步：

```
1. brainstorming skill
   ↓ 产出 spec 文档：docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
   ↓ spec self-review（placeholder/一致性/范围/歧义 4 项检查）
   ↓ 等待 user review gate（必须等用户 approval）
2. writing-plans skill
   ↓ 产出 plan 文档：docs/superpowers/plans/YYYY-MM-DD-<topic>.md
   ↓ plan self-review（spec 覆盖/placeholder/类型一致性 3 项检查）
3. subagent-driven-development skill（或 executing-plans）
   ↓ 按 P0 准备 → A 每 task 循环 → B 封仓 执行
```

**禁止行为：**
- 跳过 brainstorming 直接写 plan
- 跳过 spec self-review 直接交付用户
- 跳过 user review gate 直接进入 writing-plans
- 用 Write 工具手动写 plan 而非 writing-plans skill 产出

---

## 1. 开发前准备（P0，启动前一次性执行）

| 步骤 | 动作 | 验证 |
|---|---|---|
| P1 | `git status` 检查工作区干净 | 无未提交变更（含 untracked） |
| P2 | `git checkout -b feat/<topic>` 创建开发分支 | 当前分支 = `feat/<topic>` |
| P3 | 确认本迭代相关 spec/plan 已就位 | 文件存在 |
| P4 | 提交 spec/plan 入版本库 | 提交成功 |
| P5 | `npm install` 确认依赖完整 | node_modules 就绪 |
| P6 | `npx hexo generate` 基线构建 | 构建成功，public/ 生成，无 ERROR |
| P7 | `npx hexo server` 本地预览 | `http://localhost:4000/` 可访问 |
| P8 | 启动 `subagent-driven-development` skill 推进 task 链 | 进入 Task 1 |

### P0 约束

- P1 不通过 → 先处理未提交变更或 stash，禁止在脏工作区开新分支
- P2 不通过 → 每个迭代新开 `feat/<topic>` 分支，禁止沿用上一迭代分支
- P6 不通过 → 修复 Hexo 构建错误后重跑，禁止带构建错误启动
- P6 作为基线：后续每次变更后 `hexo generate` 都应保持成功，相当于 aptbot 的 `npm test` 基线

### 与 aptbot 的差异说明

- 无 `npm test` 基线回归（aptblog 无业务测试套件）
- 无 `npx tsc --noEmit`（aptblog 无 TypeScript 业务代码；迁移脚本若用 .mjs 则为纯 JS，无类型检查）
- 基线改为 `hexo generate` 构建成功 + 本地预览可访问

---

## 2. 每 task 必做（A 循环）

aptblog 的 task 分两类，执行流程不同：

### 2.1 代码类 task（迁移脚本 / Hexo 配置 / 主题修改）

适用 TDD：迁移脚本有明确输入输出契约，可写测试。

| 步骤 | 动作 | 验证 |
|---|---|---|
| A1 | 编写失败测试（覆盖契约边界） | — |
| A2 | `npm run test -- <path>` 终端见证 RED | 测试失败 |
| A3 | 实现最小代码（TDD 驱动） | — |
| A4 | `npm run test -- <path>` 终端见证 GREEN | 测试通过 |
| A5 | `npx hexo generate` 构建无错 | 构建成功 |
| A6 | 调用 `requesting-code-review` skill 审查 | 审查通过 |
| A7 | 修复审查问题（如有）后重跑 A4/A5 | GREEN + 构建成功 |
| A8 | `git add <specific files>`（禁用 `git add -A`） | — |
| A9 | `git commit`（conventional commits，英文 message） | — |
| A10 | 更新 plan 文档对应 task checkbox 为 `[x]` | — |

### 2.2 内容类 task（文章迁移 / 主题配置 / about 页）

不适用 TDD：内容变更靠本地预览验证。

| 步骤 | 动作 | 验证 |
|---|---|---|
| A1 | 执行内容变更（迁移 / 配置修改 / 写作） | — |
| A2 | `npx hexo generate` 构建 | 构建成功，无 ERROR/WARN |
| A3 | `npx hexo server` 本地预览 | `http://localhost:4000/` 可访问 |
| A4 | 浏览器核验变更点：文章渲染 / 图片显示 / 中英切换 / 代码高亮 / 链接有效 | 人工确认无异常 |
| A5 | `git add <specific files>` | — |
| A6 | `git commit`（conventional commits，英文 message） | — |
| A7 | 更新 plan 文档对应 task checkbox 为 `[x]` | — |

### A 循环约束

- **task 类型判定**：plan 中每个 task 应标注类型（code / content），决定走 2.1 还是 2.2
- **git add 精确**：禁用 `git add -A` / `git add .`，必须按文件名添加
- **commit message 英文**：遵循 conventional commits（feat / fix / refactor / docs / chore）
- **构建必须通过**：无论哪类 task，`hexo generate` 必须无 ERROR
- **本地预览强制**：内容类 task 的 A4 浏览器核验不可跳过

### 外部资源可访问性

- 禁止引用被 GFW 阻断的外部资源（Google Fonts / Google APIs 等），必须用国内 CDN 或本地 fallback
- 主题/插件若引入外部 `<link>` / `<script src>`，需验证大陆可访问
- 违反此规则会导致移动端浏览器「网站有风险」提示（aptbot 0.3.1 教训）

---

## 3. 封仓流程（B 循环，全部 task 完成后）

| 步骤 | 动作 | 验证 |
|---|---|---|
| B1 | `npx hexo clean && npx hexo generate` 全量构建 | 构建成功，无 ERROR |
| B2 | `npx hexo server` 本地全站预览 | 首页 / 文章页 / 中英切换 / 图片 / 404 页正常 |
| B3 | **人工 UAT 核验**（详见第 4 节） | 用户验收通过 |
| B4 | `CHANGELOG.md` 添加本迭代章节（若有版本号） | — |
| B5 | 同步变更到 `README.md`（若涉及部署方式 / 配置项变化） | — |
| B6 | plan 文档顶部状态更新为 `✅ COMPLETED` | — |
| B7 | 打 git tag（若使用版本号） | — |
| B8 | `finishing-a-development-branch` skill 执行最终封仓 | — |
| B9 | VPS 部署验证（详见第 4.4 节） | 线上验证通过 |
| B10 | 全站外部资源引用检查（`grep -r "fonts.googleapis\|googleapis" public/`） | 引用计数为 0 |

### B 循环约束

- B3 必须在 B1/B2 通过后进行（不允许带构建错误做 UAT）
- B4-B7 文档更新必须在 B8 封仓 skill 之前完成
- B9 VPS 验证发现的问题走 hotfix 流程，不阻塞封仓
- B10 必须在 B9 VPS 部署后执行

---

## 4. UAT 核验

### 4.1 时机

本地构建 + 预览通过后、封仓前（B3 步骤）。

### 4.2 范围（4 项必做）

| 范围 | 内容 |
|---|---|
| **自动化验证** | 浏览器自动化 + HTTP 批量检查（详见 4.3） |
| **本地视觉核验** | 排版 / 代码高亮配色 / 图片清晰度 / 主题交互（TOC/搜索/评论） |
| **VPS 线上验证** | `https://blog.aptbot.de/` 可访问，渲染正常，HTTPS 证书有效 |
| **新内容逐项验证** | 本迭代每个新增/迁移的内容实际可见 |

### 4.3 自动化 UAT（强制）

**适用场景：** 内容迁移后、封仓前，必须启动独立子 agent 执行自动化验证。

**强制流程：**

1. 代码/内容修改完成 + `npx hexo generate` 构建无 ERROR
2. `npx hexo server` 启动本地预览（或连接已运行实例）
3. **启动独立子 agent**（`subagent_type: general_purpose_task`）执行自动化 UAT，覆盖：
   - **HTTP 批量检查**：所有文章页（zh + en）返回 200、所有图片资源返回 200、无 broken link（爬取 `<a href>` 验证）
   - **frontmatter 断言**：迁移后文章数 = 预期值（如 18 篇 × 2 语言 = 36）、slug 映射正确、categories/date 字段存在
   - **构建输出检查**：`hexo generate` 输出无 ERROR/WARN
   - **Playwright 浏览器验证**（若涉及交互）：中英切换链接有效、TOC 展开、搜索框可用、评论组件加载
4. 验收通过后在对话中明确报告验收结果

**禁止行为：**
- 禁止仅凭 `hexo generate` 构建成功就声称迁移完成
- 禁止跳过 HTTP 批量检查直接交付（36 篇文章逐页人工核验不现实）
- 禁止用"应该能工作"等推测代替实际验证

**Chrome DevTools MCP 集成：** 若需检查网络请求 / 控制台日志 / 渲染细节，可使用 Chrome DevTools MCP 完成相关联功能测试。

### 4.4 人工视觉核验

自动化验证覆盖不到的视觉/交互项，人工浏览器核验：
- 文章排版（标题层级、段落间距、引用块样式）
- 代码高亮配色
- 图片清晰度与尺寸
- 主题交互（TOC 展开/收起、搜索框、移动端响应式、评论组件加载）

### 4.5 记录

- **核验清单文件**：`docs/superpowers/plans/<topic>-uat-checklist.md`
- 自动化结果 + 人工核验结果均记入清单文件
- 不通过项标记为 ❌，必须修复后重新 UAT

### 4.6 VPS 部署验证清单（B9 步骤细化）

aptblog 为纯静态站点，VPS 验证比 aptbot 简单（无 systemctl / API / WebSocket）：

| 检查项 | 命令 | 期望结果 |
|--------|------|----------|
| 静态文件存在 | `ssh aptblog@aptbot.de 'ls /var/www/aptblog/public/index.html'` | 文件存在 |
| HTTPS GET | `curl -s -o /dev/null -w "%{http_code}" https://blog.aptbot.de/` | 200 |
| HTTPS HEAD | `curl -sI https://blog.aptbot.de/` | 200（非 403/404） |
| HTTP 重定向 | `curl -s -o /dev/null -w "%{http_code}" http://blog.aptbot.de/` | 301 |
| 文章页 HEAD | `curl -sI https://blog.aptbot.de/zh/<slug>.html` | 200 |
| 英文页 HEAD | `curl -sI https://blog.aptbot.de/en/<slug>.html` | 200 |
| 图片资源 | `curl -sI https://blog.aptbot.de/images/<slug>/<name>.png` | 200 |
| SSL 证书有效期 | `echo \| openssl s_client -connect blog.aptbot.de:443 2>/dev/null \| openssl x509 -noout -dates` | notAfter 在未来 |
| 外部资源引用 | `curl -s https://blog.aptbot.de/ \| grep -c "fonts.googleapis"` | 0 |

### 4.7 与 aptbot UAT 的差异

- **自动化范围不同**：aptblog 侧重 HTTP 批量检查 + frontmatter 断言（静态产物可批量验证），aptbot 侧重 Playwright 交互测试（动态应用）
- **无 systemctl 服务检查**：aptblog 无常驻进程
- **无 API/WebSocket 验证**：纯静态
- **部署验证简化**：git pull + hexo generate 即完成部署，无需重启服务
- **自动化仍强制**：36 篇文章 × 2 语言的逐页验证必须自动化，人工核验只覆盖视觉/交互

---

## 5. 熔断机制

### 5.1 触发条件

- 代码类 task：3 次连续不可修复的测试失败
- 内容类 task：3 次连续不可修复的构建失败（hexo generate ERROR）

### 5.2 触发后行为

1. 立即停止当前 task
2. 打印错误栈
3. 标记 task 为 `failed`
4. 记录依赖关系
5. 切换到其他无依赖 task
6. 全部其他 task 完成后再回来修复

### 5.3 修复后

- 修复失败 task 后，重置熔断计数
- 重新走 A6-A9（代码类）或 A5-A7（内容类）提交流程

---

## 6. subagent-driven-development 集成

### 6.1 流程链路

```
P1-P7 环境就绪 → P8 启动 subagent-driven-development
                      ↓
                每 task 循环 A1-A10（代码类）或 A1-A7（内容类）
                      ↓
                全部 task 完成 → B1-B10 封仓
```

### 6.2 多 agent 并行

- **独立 task 可并行 dispatch**：无依赖关系的 task 可同时启动多个 implementer subagent
- **依赖 task 串行**：如"迁移脚本"完成后才能跑"内容迁移"
- **文件冲突避免**：同时修改同一文件的 task 必须串行

### 6.3 progress ledger

每个迭代启动时在 `.superpowers/sdd/progress.md` 记录：
- Branch / Started / Base commit / Baseline build
- 每 task 完成后追加一行：`Task N: complete (commits <base7>..<head7>, type: code/content)`
- 熔断 task 标记：`Task N: FAILED (error stack, dependencies)`

### 6.4 skill 调用顺序

1. `brainstorming`（spec 产出）
2. `writing-plans`（plan 产出）
3. `subagent-driven-development`（执行）
   - 代码类 task 内部嵌套 `test-driven-development`
   - 代码类 task 审查调用 `requesting-code-review`
4. `finishing-a-development-branch`（封仓）

---

## 7. 版本号约定

aptblog 是内容站点，版本号可选。两种模式：

### 7.1 轻量模式（日常文章发布）

- 不打版本号，不建 feat 分支
- 直接在 main 分支写文章 → `hexo generate` 预览 → git push → VPS pull + 重建
- 适用于：单篇文章发布、小配置调整、typo 修复

### 7.2 正式模式（重大变更）

- 遵循 P0/A/B 完整流程
- 版本号格式：`v<YYYY.MM>.<patch>`（如 `v2026.07.0`）或语义化 `0.x.y`
- 适用于：站点初始化、大规模内容迁移、主题更换、架构性配置变更

### 7.3 文档对应

- 正式模式：每个迭代对应一个 plan + 一个 spec
- 轻量模式：无需 plan/spec，直接 commit

---

## 8. 跨项目迁移（本项目核心场景）

aptblog 源自 aptbot learn 系统迁移，此节为常态流程。

### 8.1 迁移前检查

| 检查项 | 动作 |
|--------|------|
| 内容清点 | 列出所有待迁移文件（含中英双语 / 图片 / frontmatter） |
| 依赖分析 | 检查迁移内容是否被原项目其他模块引用（路由 / 链接 / 测试） |
| 格式映射 | 确认 frontmatter / 图片路径 / 内部链接的映射规则 |
| 数量核对 | grep 验证实际文件数与设计文档一致（aptbot learn 经验证为 18 篇非 19 篇） |

### 8.2 迁移后原项目（aptbot）兼容性

| 检查项 | 动作 | 时机 |
|--------|------|------|
| 路由兼容 | aptbot learn 路由是否保留重定向 / 404 处理 | aptblog 上线后视情况决定 |
| 引用清理 | aptbot 中指向 learn 的链接 / 导航项是否更新 | aptblog 上线后 |
| 测试回归 | aptbot `npm test` + `npx tsc --noEmit` 全绿 | 迁移不删源文件时无需 |
| 部署验证 | aptbot VPS 部署后无 broken link | aptblog 上线后 |

> **注：** 本次迁移采用"复制"策略（aptbot learn 暂不删，aptblog 建副本），8.2 大部分项延后处理。

### 8.3 新项目（aptblog）部署兼容性

| 检查项 | 动作 | 状态 |
|--------|------|------|
| VPS 共存 | nginx server_name 路由隔离（blog.aptbot.de vs aptbot.de） | ✅ 已验证 |
| 端口冲突 | aptblog 纯静态，不占用 aptbot 的 8080 端口 | ✅ 无冲突 |
| 用户隔离 | aptblog 独立系统用户，sudoers 仅 nginx -t / reload | ✅ 已配置 |
| SSL 证书 | blog.aptbot.de 证书签发不影响 aptbot.de 续期 | ✅ 已签发 |
| 外部资源 | aptblog 也禁止引用 GFW 阻断资源 | B10 检查 |

### 8.4 迁移流程

```
1. 迁移前检查（8.1）→ 确认无阻塞
2. 新项目初始化 + 部署验证（8.3）→ VPS gap 修复
3. 迁移脚本开发（代码类 task，TDD）
4. 内容迁移执行（内容类 task，本地预览验证）
5. VPS 首次部署 + 验证
6. 原项目兼容性处理（8.2）— 延后，视保留策略而定
```

---

## 附录：与 aptbot dev-workflow 的差异说明

| 维度 | aptbot | aptblog | 调整理由 |
|------|--------|---------|---------|
| 基线检查 | `npm test` + `tsc --noEmit` | `hexo generate` 构建 | aptblog 无业务测试套件 |
| TDD | 所有 task 强制 | 仅代码类 task（迁移脚本） | 内容/配置不适合 TDD |
| UAT | Playwright 交互测试 | HTTP 批量检查 + frontmatter 断言 + Playwright（交互项） | 静态产物可批量验证，自动化范围不同但同样强制 |
| VPS 验证 | systemctl + API + WebSocket | curl HEAD + 文件存在 | 无常驻进程 |
| 版本号 | 严格 0.x.y | 轻量模式 / 正式模式双轨 | 内容站点迭代节奏不同 |
| 安全 headers | 强制 4 项 | nginx 配置层处理（静态站点） | aptblog 由 nginx 统一配置 |
| 文档同步触发 | A11 ARCHITECTURE / A12 README / A13 design-notes | B5 README（条件触发） | aptblog 无 ARCHITECTURE.md |
| 第 8 节迁移 | 通用规则 | 本项目核心场景，常态流程 | aptblog 源自迁移 |

## 附录：决策来源

| 决策 | 来源 | 日期 |
|---|---|---|
| superpower 标准流程 | brainstorming skill 强制要求 | 2026-07-10 |
| P0 环境准备 | aptbot dev-workflow v1.1 | 2026-07-10 |
| task 分类（code/content） | aptblog 特点：迁移脚本有逻辑可 TDD，内容不可 | 2026-07-10 |
| 基线改为 hexo generate | aptblog 无 npm test 套件 | 2026-07-10 |
| UAT 自动化保留（范围适配） | 36 篇文章逐页人工核验不现实，HTTP 批量检查 + frontmatter 断言必须自动化 | 2026-07-10 |
| 版本号双轨制 | 内容站点日常发布无需正式流程 | 2026-07-10 |
| 第 8 节强化 | aptblog 源自 aptbot learn 迁移 | 2026-07-10 |
| 外部资源可访问性 | aptbot 0.3.1 教训（Google Fonts 被阻断） | 2026-07-10 |
