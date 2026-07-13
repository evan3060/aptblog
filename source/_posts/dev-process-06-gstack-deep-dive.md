---
title: AI 研发流程深度解析（六）：gstack 深度拆解——虚拟工程团队
description: 深度拆解一个试图把 Claude Code 变成完整工程团队的项目，分析其 sprint 链式传递、全流程覆盖与工具重度依赖之间的关系。
tags:
  - 研发流程
  - gstack
  - Sprint
  - 工程团队
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 一个试图把 Claude Code 变成完整工程团队的项目，是如何设计 sprint 链式传递的？它的全流程覆盖与工具重度依赖之间是什么关系？

---

## 1. 架构拆解

### 1.1 定位与规模

gstack 的自我定位是 **"turns Claude Code into a virtual engineering team"**（`README.md`）。这不是比喻——README 列出了 23 个 specialist skills 和 8 个 power tools，每个 skill 对应一个工程角色：CEO、Eng Manager、Senior Designer、Staff Engineer、QA Lead、Security Officer、Release Engineer、SRE 等。Garry Tan（YC 总裁）以个人身份构建，声称在 60 天内交付了 3 个生产服务、40+ 功能特性，逻辑代码变更速率是 2013 年的 ~810×。

这个定位的核心信号是：**这不是 skill 集合，而是一个软件工厂。** gstack 明确拥有一个完整的 sprint 流程，每个 skill 在流程中有固定位置。这与 ECC 的"提供素材不定义流程"和 mattpocock 的"不拥有流程"形成了鲜明的立场差异。

### 1.2 Sprint 结构

gstack 的核心组织原则是 **sprint**——一个按工程团队节奏运行的流程（`README.md`）：

```
Think → Plan → Build → Review → Test → Ship → Reflect
  │        │        │        │        │       │       │
  │        │        │        │        │       │       └── /retro, /learn, /document-release
  │        │        │        │        │       └── /ship, /land-and-deploy, /canary
  │        │        │        │        └── /qa, /qa-only, /benchmark, /investigate
  │        │        │        └── /review, /codex, /cso
  │        │        └── (由 plan 产出驱动)
  │        └── /plan-ceo-review, /plan-eng-review, /plan-design-review, /plan-devex-review, /autoplan, /spec
  └── /office-hours
```

每个阶段对应一组 skills：

| 阶段 | Skills | 角色 |
|------|--------|------|
| **Think** | `/office-hours` | YC Office Hours — 六个 forcing questions |
| **Plan** | `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/plan-devex-review`, `/autoplan`, `/spec` | CEO、Eng Manager、Designer、DX Lead |
| **Build** | (隐含，由 plan 产出驱动) | — |
| **Review** | `/review`, `/codex`, `/cso` | Staff Engineer、Second Opinion、Security Officer |
| **Test** | `/qa`, `/qa-only`, `/benchmark`, `/investigate` | QA Lead、Performance Engineer、Debugger |
| **Ship** | `/ship`, `/land-and-deploy`, `/canary` | Release Engineer、SRE |
| **Reflect** | `/retro`, `/learn`, `/document-release` | Eng Manager、Memory、Technical Writer |

**设计考虑：** sprint 结构不是松散的 skill 列表，而是一条**链式传递**的流水线——每个 skill 的产出喂给下一个。README 明确指出："Each skill feeds into the next. `/office-hours` writes a design doc that `/plan-ceo-review` reads. `/plan-eng-review` writes a test plan that `/qa` picks up. `/review` catches bugs that `/ship` verifies are fixed."

### 1.3 Skill 模板系统

gstack 的 SKILL.md 文件不是手写的，而是从 `.tmpl` 模板**自动生成**的（`ARCHITECTURE.md`）：

```
SKILL.md.tmpl          (人类编写的 prose + 占位符)
       ↓
gen-skill-docs.ts      (读取源代码元数据)
       ↓
SKILL.md               (提交到 git，自动生成 sections)
```

占位符从源代码中填充：`{{COMMAND_REFERENCE}}` 从 `commands.ts` 生成命令表，`{{PREAMBLE}}` 生成启动块，`{{BASE_BRANCH_DETECT}}` 生成动态分支检测等。

**设计考虑：** 这个设计解决了"文档与代码漂移"的经典问题——如果命令存在于代码中，它就出现在文档中；如果不存在，就不能出现。CI 通过 `gen:skill-docs --dry-run` + `git diff --exit-code` 在 merge 前捕获过时文档。

**取舍：** 模板系统增加了贡献者门槛——修改 skill 需要理解模板系统、resolver 模块和生成管线。但换来的是文档与代码的结构性一致性。

### 1.4 Preamble 共享块

每个 skill 都以一个 `{{PREAMBLE}}` 块开始，这是一个约 170 行的 bash 脚本，处理五件事（`ARCHITECTURE.md`）：

1. **Update check** — 调用 `gstack-update-check`，报告是否有升级
2. **Session tracking** — 触摸 `~/.gstack/sessions/$PPID`，计算活跃 session 数。当 3+ 个 session 运行时，所有 skill 进入 "ELI16 mode"——每个问题都重新为用户建立上下文，因为他们正在多个窗口之间切换
3. **Operational self-improvement** — skill 结束时，agent 反思失败并将操作学习记录到项目的 JSONL 文件
4. **AskUserQuestion format** — 统一格式：context、question、`RECOMMENDATION: Choose X because ___`、字母选项
5. **Search Before Building** — 在构建不熟悉的模式前先搜索

**Preamble 的结构：**
```bash
# === GSTACK PREAMBLE (auto-generated, do not edit) ===

# 1. Update check
gstack-update-check 2>/dev/null

# 2. Session tracking
_SESSIONS_DIR="${GSTACK_HOME:-$HOME/.gstack}/sessions"
mkdir -p "$_SESSIONS_DIR"
touch "$_SESSIONS_DIR/$PPID"
_ACTIVE=$(find "$_SESSIONS_DIR" -mmin -30 | wc -l)
if [ "$_ACTIVE" -ge 3 ]; then
  export GSTACK_ELI16=true
fi

# 3. Context Recovery
_PROJ="${GSTACK_HOME:-$HOME/.gstack}/projects/${SLUG:-unknown}"
find "$_PROJ/ceo-plans" "$_PROJ/checkpoints" -type f -name "*.md" 2>/dev/null | head -3
[ -f "$_PROJ/${_BRANCH}-reviews.jsonl" ] && echo "REVIEWS: ..."

# 4. Search Before Building
# (injected as instructions, not bash)

# 5. Operational self-improvement (on exit)
trap 'gstack-learning-record --skill "$0" --exit-code $?' EXIT
# === END PREAMBLE ===
```

**设计考虑：** preamble 是 gstack 的"操作系统"——它让每个 skill 都继承相同的基础设施（升级检查、遥测、学习、搜索），而不需要每个 skill 重复实现。ELI16 mode 是一个独特的设计：当用户同时运行多个 sprint 时，每个 skill 自动降低假设的上下文量。这不是用户配置的，而是系统根据 session 数量自动激活的。

### 1.5 多平台适配

gstack 通过 `hosts/` 目录下的类型化配置文件适配 10 个 AI 编码代理（`README.md`）：

| Agent | Flag | Skills install to |
|-------|------|-------------------|
| Claude Code | (default) | `~/.claude/skills/gstack-*/` |
| OpenAI Codex CLI | `--host codex` | `~/.codex/skills/gstack-*/` |
| Cursor | `--host cursor` | `~/.cursor/skills/gstack-*/` |
| Factory Droid | `--host factory` | `~/.factory/skills/gstack-*/` |
| Slate | `--host slate` | `~/.slate/skills/gstack-*/` |
| Kiro | `--host kiro` | `~/.kiro/skills/gstack-*/` |
| Hermes | `--host hermes` | `~/.hermes/skills/gstack-*/` |
| GBrain (mod) | `--host gbrain` | `~/.gbrain/skills/gstack-*/` |
| OpenCode | `--host opencode` | `~/.config/opencode/skills/gstack-*/` |
| OpenClaw | (ACP) | Claude Code session 内使用 |

**设计考虑：** 添加一个新 host 只需要一个 TypeScript 配置文件，零代码修改（`docs/ADDING_A_HOST.md`）。这是通过将 host 差异隔离到配置层（安装路径、skill 前缀、工具映射）实现的。

**关键文件：** `README.md`、`CLAUDE.md`、`ARCHITECTURE.md`、`ETHOS.md`

---

## 2. Sprint 链式传递设计

### 2.1 链式传递的实现

gstack 的链式传递不是松散的"skill 之间可以互相调用"，而是通过**持久化 artifact + 主动读取**实现的。每个 skill 将产出写入 `~/.gstack/projects/$SLUG/` 下的文件，下游 skill 在 preamble 阶段主动读取这些文件。

主要 artifact 流：

```
/office-hours
  → 写入 ~/.gstack/projects/$SLUG/*-design-*.md（设计文档）

/plan-ceo-review
  → 读取 design doc（PREREQUISITE SKILL OFFER 主动检查）
  → 写入 ~/.gstack/projects/$SLUG/ceo-plans/{date}-{feature}.md（CEO 计划）

/plan-eng-review
  → 读取 design doc + CEO 计划
  → 写入 test plan（嵌入 plan 文件）

/review
  → 读取 git diff
  → 写入 ~/.gstack/projects/$SLUG/$BRANCH-reviews.jsonl（审查日志）

/qa
  → 读取 test plan（从 plan 文件中）
  → 打开浏览器执行测试
  → 修复 bug + 生成回归测试（atomic commits）

/ship
  → 读取 review 日志（gstack-review-read）
  → 读取 learnings（gstack-learnings-search）
  → 读取 decisions（gstack-decision-search）
  → 执行 21 步 ship 流程
  → 写入 ship metrics 到 reviews.jsonl
```

**设计考虑：** 链式传递通过文件系统实现，不依赖 context window 传递。这意味着：
1. **跨 session 传递** — 即便 session 中断，artifact 仍在磁盘上
2. **跨 sprint 传递** — 一个 sprint 的 CEO 计划可以被另一个 sprint 读取
3. **可审计** — 所有 artifact 都有时间戳和文件路径

### 2.2 Context Recovery

每个 skill 的 preamble 都包含 Context Recovery 块（`plan-ceo-review/SKILL.md`）：

```bash
_PROJ="${GSTACK_HOME:-$HOME/.gstack}/projects/${SLUG:-unknown}"
find "$_PROJ/ceo-plans" "$_PROJ/checkpoints" -type f -name "*.md" | head -3
[ -f "$_PROJ/${_BRANCH}-reviews.jsonl" ] && echo "REVIEWS: ..."
[ -f "$_PROJ/timeline.jsonl" ] && tail -5 "$_PROJ/timeline.jsonl"
```

这会在每次 skill 启动时恢复最近的 artifact、审查记录、时间线和活跃决策。

**设计考虑：** Context Recovery 解决了"context compaction 后丢失上下文"的问题。当 Claude Code 的 context window 被 compact 后，skill 重启时通过读取磁盘上的 artifact 恢复状态。gstack 传递的是**工程状态**（设计文档、审查记录、决策日志），而非仅仅是对话摘要。

### 2.3 Review Readiness Dashboard

`/ship` 在 Step 1 会展示一个 Review Readiness Dashboard（`ship/SKILL.md`）：

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

Dashboard 从 `gstack-review-read` 读取审查日志，显示每种审查的运行次数、最后运行时间、状态。只有 Eng Review 是 required（可通过 `skip_eng_review` 全局禁用），其他审查是 informational。

**设计考虑：** Dashboard 让链式传递的状态**可视化**——用户在 ship 前一眼看到哪些审查已运行、哪些缺失。Staleness detection 还会比较审查时的 commit 与当前 HEAD，提示审查是否可能过时。

### 2.4 Autoplan：自动化链式传递

`/autoplan` 是链式传递的自动化版本——一条命令运行 CEO → design → eng → DX 审查（`README.md`）：

> "One command, fully reviewed plan. Runs CEO → design → eng review automatically with encoded decision principles. Surfaces only taste decisions for your approval."

`/autoplan` 自动检测哪些审查适用（前端变更触发 design review，API 变更触发 DX review），只将 taste decisions 呈现给用户。

**设计考虑：** autoplan 解决了"用户忘记运行某个审查"的问题——一条命令覆盖所有计划阶段审查。encoded decision principles 意味着 gstack 将一些常见的审查决策编码为自动规则，只有真正需要人类判断的 taste call 才暂停。

**关键文件：** `office-hours/SKILL.md`、`plan-ceo-review/SKILL.md`、`ship/SKILL.md`、`review/SKILL.md`、`ARCHITECTURE.md`

**取舍：** 链式传递的代价是**重量级**——每个 skill 都有 170 行 preamble、多个 on-demand section 文件、复杂的 artifact 路径约定。但链式传递换来了跨 session、跨 sprint 的工程状态持久化和可审计性。

---

## 3. 持久浏览器守护进程

### 3.1 核心设计

gstack 的浏览器是它的"hard part"——`ARCHITECTURE.md` 开篇就说："gstack gives Claude Code a persistent browser and a set of opinionated workflow skills. The browser is the hard part — everything else is Markdown."

核心洞察：AI agent 与浏览器交互需要**亚秒级延迟**和**持久状态**。如果每次命令都冷启动浏览器，每次工具调用要等 3-5 秒。如果浏览器在命令间死亡，cookies、tabs 和登录 session 全部丢失。

解决方案是**长驻 Chromium 守护进程**：

```
Claude Code                     gstack
─────────                      ──────
                               ┌──────────────────────┐
  Tool call: $B snapshot -i    │  CLI (compiled binary)│
  ─────────────────────────→   │  • reads state file   │
                               │  • POST /command      │
                               │    to localhost:PORT   │
                               └──────────┬───────────┘
                                          │ HTTP
                               ┌──────────▼───────────┐
                               │  Server (Bun.serve)   │
                               │  • dispatches command  │
                               │  • talks to Chromium   │
                               │  • returns plain text  │
                               └──────────┬───────────┘
                                          │ CDP
                               ┌──────────▼───────────┐
                               │  Chromium (headless)   │
                               │  • persistent tabs     │
                               │  • cookies carry over  │
                               │  • 30min idle timeout  │
                               └───────────────────────┘
```

首次调用启动一切（~3s），之后每次调用 ~100-200ms。

**设计考虑：** 守护进程模型带来三个关键能力：
1. **持久状态** — 登录一次，保持登录。打开一个 tab，它保持打开。localStorage 跨命令持久化。
2. **亚秒级命令** — 首次调用后，每个命令只是一个 HTTP POST。
3. **自动生命周期** — 首次使用自动启动，30 分钟空闲后自动关闭。

### 3.2 为什么选择 Bun

`ARCHITECTURE.md` 解释了选择 Bun 而非 Node.js 的四个理由：

1. **编译二进制** — `bun build --compile` 生成 ~58MB 单一可执行文件。运行时无需 `node_modules`、无需 `npx`、无需 PATH 配置。这很重要因为 gstack 安装到 `~/.claude/skills/` 用户不期望管理 Node.js 项目。
2. **原生 SQLite** — Cookie 解密直接读取 Chromium 的 SQLite cookie 数据库。Bun 内置 `new Database()`，无需 `better-sqlite3`、无需原生插件编译。
3. **原生 TypeScript** — 开发时 `bun run server.ts`，无需编译步骤。
4. **内置 HTTP 服务器** — `Bun.serve()` 快速、简单，不需要 Express 或 Fastify。

**设计考虑：** 瓶颈始终是 Chromium，不是 CLI 或 server。Bun 的启动速度（~1ms 编译二进制 vs ~100ms Node）是 nice-to-have，但编译二进制和原生 SQLite 才是选择 Bun 的真正原因。

### 3.3 Ref 系统

gstack 的 Ref 系统（`@e1`, `@e2`, `@c1`）是 agent 寻址页面元素的方式，无需写 CSS 选择器或 XPath（`ARCHITECTURE.md`）：

1. Agent 运行 `$B snapshot -i`
2. Server 调用 Playwright 的 `page.accessibility.snapshot()`
3. 解析器遍历 ARIA 树，分配顺序 ref：@e1, @e2, @e3...
4. 为每个 ref 构建 Playwright Locator：`getByRole(role, { name }).nth(index)`
5. 返回带注释的树作为纯文本

**为什么用 Locators 而非 DOM 修改：**
- **CSP** — 许多生产站点阻止脚本修改 DOM
- **框架水合** — React/Vue/Svelte 调和可能剥离注入的属性
- **Shadow DOM** — 无法从外部触及 shadow root

Playwright Locators 独立于 DOM，使用 Chromium 内部维护的 accessibility tree。无 DOM 修改、无 CSP 问题、无框架冲突。

### 3.4 安全模型

**Localhost only** — HTTP server 绑定 `127.0.0.1`，不可从网络访问。

**Bearer token auth** — 每次 server session 生成随机 UUID token，写入 state file（mode 0o600）。每个修改浏览器状态的 HTTP 请求必须包含 `Authorization: Bearer <token>`。

**Dual-listener tunnel architecture** — 当 `pair-agent` 启动 ngrok tunnel 时，daemon 绑定两个 HTTP listener：
- **Local listener** — 始终绑定，服务完整命令面。永不转发。
- **Tunnel listener** — 惰性绑定，只服务锁定允许列表的端点。

安全属性来自**物理端口分离**：tunnel caller 无法访问 `/health` 或 `/cookie-picker`，因为这些路径在那个 TCP socket 上不存在。

**Cookie 安全：**
1. Keychain 访问需要用户批准（macOS Keychain 对话框）
2. 解密在进程内完成，明文永不写入磁盘
3. 数据库只读（复制到临时文件避免 SQLite 锁冲突）
4. Key 缓存是 per-session 的（server 关闭后缓存消失）
5. Cookie 值永不出现在日志中

### 3.5 Prompt Injection 防御

Chrome sidebar agent 有工具（Bash、Read、Glob、Grep、WebFetch）并读取敌对网页，所以它是 gstack 最暴露于 prompt injection 的部分。防御是分层的（`ARCHITECTURE.md`）：

| Layer | 模块 | 功能 |
|-------|------|------|
| L1-L3 | `content-security.ts` | datamarking、hidden element strip、ARIA regex、URL blocklist、envelope wrapping |
| L4 | `security-classifier.ts` (TestSavantAI) | 22MB BERT-small ONNX 模型，本地运行，扫描每条用户消息和工具输出 |
| L4b | transcript classifier | Claude Haiku pass，检查完整对话形状 |
| L5 | `security.ts` (canary) | 随机 token 注入 system prompt，在输出中检测 token 泄漏 |
| L6 | `security.ts` (combineVerdict) | BLOCK 需要两个 ML 分类器在 >= WARN (0.75) 一致 |

**设计考虑：** L6 的 ensemble rule 是 Stack Overflow 误报缓解——单个分类器高置信度降级为 WARN，因为"这个看起来像钓鱼"和"这是注入"难以区分。Canary leak 始终 BLOCK（确定性）。

### 3.6 浏览器 QA 在流程中的角色

README 中 Garry Tan 明确指出浏览器 QA 是他的 "massive unlock"：

> "`/qa` was a massive unlock. It let me go from 6 to 12 parallel workers. Claude Code saying 'I SEE THE ISSUE' and then actually fixing it, generating a regression test, and verifying the fix — that changed how I work. The agent has eyes now."

`/qa` 的完整流程：
```
1. 打开真实浏览器（复用持久 daemon）
2. 读取 test plan（从 plan-eng-review 产出）
3. 点击通过用户流程
4. 发现 bug（agent 看到 UI 不对）
5. 修复 bug（atomic commits——每个 fix 一个 commit）
6. 生成回归测试（确保 bug 不再重现）
7. 重新验证修复（再次运行用户流程确认）
```

**设计考虑：** 浏览器 QA 将"agent 能看代码"扩展为"agent 能看产品"。这是 gstack 的核心能力——agent 拥有"眼睛"。Garry Tan 声称这让他从 6 个并行 worker 扩展到 12 个，因为 agent 可以自主验证而不是依赖人工反馈。这意味着并行 sprint 的瓶颈从"人工验证速度"转移到了"模型 API rate limit"——这是一个质的飞跃。

**关键文件：** `ARCHITECTURE.md`、`BROWSER.md`、`browse/src/commands.ts`、`browse/src/server.ts`

---

## 4. 设计哲学

### 4.1 Boil the Ocean

`ETHOS.md` 开篇就颠覆了传统工程智慧：

> "'Don't boil the ocean' was the right advice when engineering time was the bottleneck. That era is over. AI-assisted coding makes the marginal cost of completeness near-zero, so the old caution has quietly turned into an excuse."

核心论点：当完整实现比捷径只多花几分钟时，**每次都做完整的事**。

**Ocean, lakes first：** 海洋是目的地——100% 测试覆盖率、完整功能实现、所有 edge case、完整错误路径。你一个湖一个湖地到达——每个湖是一个可沸腾的单元，不是天花板。"That's boiling the ocean" 不再是 ship 捷径的理由——沸腾海洋是目标。唯一仍然在 scope 外的是真正无关的工作：与当前任务无关的多季度平台迁移。

**反模式 vs 正确做法：**

| 反模式 | 正确做法 | 理由 |
|-------|---------|------|
| "选择 B——它覆盖 90% 且代码更少" | 如果 A 多 70 行，选 A | 10% 的 edge case 在生产中会出问题 |
| "把测试推迟到后续 PR" | 测试是最便宜的湖 | 测试延迟的成本远高于即时编写 |
| "这需要 2 周" | "2 周人力 / ~1 小时 AI 辅助" | AI 改变了时间估算的基本假设 |

**设计考虑：** Boil the Ocean 哲学被注入到每个 skill 的 preamble 中。`Completeness Principle` 要求在选项覆盖度不同时标注 `Completeness: X/10`（10 = 完整，7 = happy path，3 = 捷径）。这不只是口号，而是编码到了 AskUserQuestion 的格式规范中——每个决策都必须标注完整性评分，让用户在选择时明确知道"我在用多少完整性换取简洁性"。

**取舍：** Boil the Ocean 的风险是**范围蔓延**——"完整"的定义可能无限膨胀。gstack 的缓解是"唯一在 scope 外的是真正无关的工作"——但判断"无关"本身是主观的。User Sovereignty 原则在这里起到了制衡作用——即使用户说"只做最小版本"，用户赢。

### 4.2 User Sovereignty

`ETHOS.md` 的第三条原则是覆盖所有其他规则的**一票否决权**：

> "AI models recommend. Users decide. This is the one rule that overrides all others."

核心论点：两个 AI 模型同意一个变更是一个强信号，但不是命令。用户始终有模型缺乏的上下文：领域知识、业务关系、战略时机、个人品味、未分享的未来计划。当 Claude 和 Codex 都说"合并这两个东西"而用户说"不，保持分开"——用户是对的。总是。

**generation-verification loop：** AI 生成推荐 → 用户验证和决策 → AI 永不因为自信而跳过验证步骤。

**规则：** 当你和另一个模型同意改变用户已说明方向时——呈现推荐、解释为什么你们都认为更好、说明你可能缺少什么上下文、然后问。永不擅自行动。

**设计考虑：** User Sovereignty 体现在多个层面：
- AskUserQuestion 格式要求每个决策都有 `Recommendation` 和 `(recommended)` 标签，但最终选择权在用户
- `/plan-ceo-review` 的 Expansion opt-in ceremony：每个扩展提案都是单独的 AskUserQuestion，用户 opt in 或 out
- `/codex` 的跨模型审查结果被标记为"recommendation, not decision"
- 这意味着即便 Boil the Ocean 说"做完整的事"，如果用户说"只做最小版本"，用户赢。

### 4.3 跨模型审查

`/codex` skill 获取来自 OpenAI Codex CLI 的独立审查——一个完全不同的 AI 看同一个 diff（`README.md`）。三种模式：

1. **review** — pass/fail gate 代码审查
2. **adversarial challenge** — 主动尝试打破你的代码
3. **open consultation** — 带 session 连续性的开放咨询

当 `/review`（Claude）和 `/codex`（OpenAI）都审查了同一分支时，gstack 生成**跨模型分析**——显示哪些发现重叠、哪些是各自独有的。

**设计考虑：** 跨模型审查的核心价值是**模型偏差消除**——Claude 可能系统性地忽略某类问题，Codex 可能忽略另一类。两个不同模型的交叉验证比单个模型的两次审查更有价值。

**取舍：** 跨模型审查需要两个 AI 服务的 API key，增加了成本和配置复杂度。Codex 审查的 E2E 测试使用 Codex 自己的 auth（`~/.codex/` config），不需要 `OPENAI_API_KEY` env var——这降低了配置门槛但仍依赖 Codex CLI 安装。

### 4.4 Continuous Checkpoint

设置 `gstack-config set checkpoint_mode continuous` 后，skill 在工作过程中自动 commit（`README.md`）：

```
WIP: <concise description of what changed>

[gstack-context]
Decisions: <key choices made this step>
Remaining: <what's left in the logical unit>
Tried: <failed approaches worth recording> (omit if none)
Skill: </skill-name-if-running>
[/gstack-context]
```

- `/context-restore` 读取这些 commit 重建 session 状态
- `/ship` 在 PR 前过滤压缩 WIP commit（保留非 WIP commit），保持 bisect 干净
- Push 是 opt-in 的（`checkpoint_push=true`）——默认只本地 commit，不触发 CI

**设计考虑：** Continuous Checkpoint 解决了两个问题：
1. **Crash 恢复** — session 崩溃后，WIP commit 保留了工作进度和决策上下文
2. **Context 切换** — 在 10-15 个并行 sprint 之间切换时，`[gstack-context]` 块记录了"做到哪了、还剩什么、试过什么"

### 4.5 Search Before Building

`ETHOS.md` 的第二条原则——**1000x 工程师的第一反应是"有人已经解决了吗？"而非"让我从头设计"**。

三层知识：
1. **Layer 1: Tried and true** — 标准模式、久经考验的方法。检查成本接近零。
2. **Layer 2: New and popular** — 当前最佳实践、博客文章、生态趋势。搜索但审视——人群对新事物和旧事物一样可能出错。
3. **Layer 3: First principles** — 从对特定问题的推理中得出的原创观察。最有价值。 Prize them above everything else.

**Eureka Moment：** 搜索的最有价值结果不是找到可复制的方案，而是：(1) 理解大家在做什么和为什么（Layer 1+2），(2) 对他们的假设应用第一性原理推理（Layer 3），(3) 发现常规方法为什么错的清晰理由。这是 11 out of 10。

**设计考虑：** Search Before Building 被注入到每个 skill 的 preamble 中。在构建不熟悉的模式前，agent 被指示先搜索。当第一性原理推理与常规智慧矛盾时，agent 被要求"命名 eureka moment"并记录到 `~/.gstack/analytics/eureka.jsonl`。

---

## 5. 并行 sprint 管理

### 5.1 Conductor 并行

gstack 与 [Conductor](https://conductor.build) 深度集成——Conductor 运行多个 Claude Code session 并行，每个在自己的隔离 workspace（`README.md`）：

> "I regularly run 10-15 parallel sprints — that's the practical max right now."

Garry Tan 的场景描述：一个 session 运行 `/office-hours` 探索新想法，另一个做 `/review` 审查 PR，第三个实现功能，第四个在 staging 上运行 `/qa`，还有六个在其他分支上。全部同时进行。

### 5.2 并行的前提：Sprint 结构

README 明确指出并行的前提是流程结构：

> "The sprint structure is what makes parallelism work. Without a process, ten agents is ten sources of chaos. With a process — think, plan, build, review, test, ship — each agent knows exactly what to do and when to stop. You manage them the way a CEO manages a team: check in on the decisions that matter, let the rest run."

**设计考虑：** 流程是并行的基础——没有流程，10 个 agent 是 10 个混乱源。sprint 结构让每个 agent 知道"做什么和何时停止"。

### 5.3 并行基础设施

gstack 为并行 sprint 提供了多项基础设施：

**ELI16 mode：** 当 3+ 个 session 运行时，所有 skill 进入 ELI16 mode——每个 AskUserQuestion 都重新为用户建立上下文（项目名、分支名、当前任务），因为用户正在多个窗口之间切换。

**gstack-detach：** 长 running 任务（如 eval 套件）通过 `gstack-detach` 运行而非普通 background bash——它创建新 session（逃逸 process group SIGTERM）并包装在 `caffeinate -i` 中（阻止 idle-sleep）。detached run 即使 watcher 被回收也能在日志中检查。

**Machine-wide eval lock：** 共享 dev box 上的多个 Conductor worktree 会 rate-limit model API。eval lock 让第二个 run 等待而非碰撞。

**Workspace-aware ship：** `gstack-next-version` 检测其他 worktree 是否已 claim 同一版本号，避免版本冲突。

**Random port selection：** 浏览器 daemon 使用 10000-60000 的随机端口（最多重试 5 次），意味着 10 个 Conductor workspace 各自运行自己的 browse daemon，零配置、零端口冲突。

### 5.4 Cross-session Decision Memory

gstack 维护一个 append-only、event-sourced 的决策存储（`CLAUDE.md`）：

```bash
# 捕获持久决策
~/.claude/skills/gstack/bin/gstack-decision-log \
  '{"decision":"use PostgreSQL for audit log",
    "rationale":"need ACID + JSONB",
    "scope":"repo",
    "source":"user",
    "confidence":9}'

# 检索过去决策
~/.claude/skills/gstack/bin/gstack-decision-search --recent 5

# 反转先前决策（显式声明）
~/.claude/skills/gstack/bin/gstack-decision-log \
  '{"decision":"switch to MongoDB for audit log",
    "rationale":"write volume too high for PG",
    "supersedes":"<previous-decision-id>"}'
```

**决策记录结构：**
```jsonl
{"id":"dec-001","timestamp":"2026-03-15T10:00:00Z","decision":"use PostgreSQL for audit log","rationale":"need ACID + JSONB","scope":"repo","source":"user","confidence":9}
{"id":"dec-002","timestamp":"2026-03-16T14:00:00Z","decision":"use event sourcing pattern","rationale":"need full audit trail","scope":"branch","source":"skill:plan-ceo-review","confidence":8}
{"id":"dec-003","timestamp":"2026-03-17T09:00:00Z","decision":"switch to MongoDB for audit log","rationale":"write volume too high for PG","supersedes":"dec-001","scope":"repo","source":"user","confidence":10}
```

**设计考虑：** 决策存储解决了一个独特的并行问题——当 10 个 sprint 同时运行时，一个 sprint 做的架构决策不应该被另一个 sprint 重新讨论。决策存储让"已决定的事不再重新讨论"成为可能。`--supersede <id>` 允许反转先前的决策，但要求显式声明——这确保了决策变更是可审计的，而不是静默的覆盖。append-only 的设计意味着历史决策永远不会被删除，只能被 supersede——这为团队回顾提供了完整的决策演化轨迹。

### 5.5 GBrain：持久知识库

GBrain 是 gstack 的可选持久知识库——AI agent 跨 session 保留的记忆（`README.md`）：

- **PGLite local** — 零账号、零网络，~30 秒
- **Supabase existing URL** — 云端 agent 已 provisioned 的 brain
- **Supabase auto-provision** — 自动创建新项目
- **Remote gbrain MCP** — brain 运行在另一台机器上

`/sync-gbrain` 将 repo 代码重新索引到 gbrain，在 CLAUDE.md 中写入 `## GBrain Search Guidance` 块，让 agent 优先使用 `gbrain search` 而非 Grep。

**Per-remote trust policy：** 每个 repo 有三种信任级别：
- `read-write` — agent 可以搜索 brain 并从这个 repo 写回新页面
- `read-only` — agent 可以搜索但不能写（适合多客户顾问：搜索共享 brain，不污染客户 A 的工作）
- `deny` — 无 gbrain 交互

**设计考虑：** GBrain 解决了并行 sprint 的知识共享问题——一个 sprint 学到的代码库模式可以被另一个 sprint 搜索到。Per-remote trust policy 处理了多客户场景的知识隔离。

---

## 6. 其他关键设计模式

### 6.1 AskUserQuestion 格式

gstack 定义了一套极其详细的 AskUserQuestion 格式规范（`plan-ceo-review/SKILL.md`）。这是 gstack 将"如何向用户提问"从隐性的最佳实践提升为显性的结构化规范的核心机制。

**格式模板：**
```
D<N> — <one-line question title>
Project/branch/task: <1 short grounding sentence using _BRANCH>
ELI10: <plain English a 16-year-old could follow, 2-4 sentences, name the stakes>
Stakes if we pick wrong: <one sentence on what breaks, what user sees, what's lost>
Recommendation: <choice> because <one-line reason>
Completeness: A=X/10, B=Y/10
Pros / cons:
A) <option label> (recommended)
  ✅ <pro — concrete, observable, ≥40 chars>
  ❌ <con — honest, ≥40 chars>
B) <option label>
  ✅ <pro>
  ❌ <con>
Net: <one-line synthesis of what you're actually trading off>
```

**实际示例：**
```
D2 — How should we handle session storage?
Project/branch: feature/auth on checkout-service
ELI10: When a user logs in, we need to remember who they are across 
requests. We can store sessions in Redis (fast, separate) or JWT 
(stateless, no lookup needed). The choice affects scaling and logout.
Stakes if we pick wrong: If we pick JWT and need server-side logout, 
we'll need a revocation list — effectively building Redis anyway.
Recommendation: A because we need instant logout for compliance.
Completeness: A=9/10, B=7/10
Pros / cons:
A) Redis-based sessions (recommended)
  ✅ Server-side logout is instant — delete the key and the session is dead
  ❌ Adds Redis as a dependency — one more thing to monitor and scale
B) JWT-based sessions
  ✅ No session store needed — stateless means horizontal scaling is trivial
  ❌ Logout is soft — token lives until expiry unless we add revocation list
Net: You're trading operational simplicity (B) for compliance control (A).
```

**5+ 选项处理：** AskUserQuestion 限制每次调用最多 4 个选项。gstack 要求**永不丢弃**选项——要么 batch 成 ≤4 组，要么 split 成 per-option 调用（D3.1, D3.2, ...）。split chain 的 question_id 永不被 AUTO_DECIDE——用户的选项集是神圣的。

**Conductor 兼容：** Conductor 禁用 native AUQ 且其 MCP 变体不稳定，gstack 检测 Conductor 环境并自动切换到 prose fallback——将决策 brief 渲染为 markdown 消息而非工具调用。

**设计考虑：** 这套格式规范解决了一个真实问题——AI 的提问经常模糊、缺少推荐、无法让用户快速决策。gstack 将提问结构化为"decision brief"，要求每个问题都有 ELI10、推荐、完整性评分、pros/cons 和 net tradeoff。

### 6.2 Confusion Protocol

对于高风险的模糊性（架构、数据模型、破坏性 scope、缺失上下文），skill 被指示 STOP——用一句话命名问题，呈现 2-3 个选项带 tradeoff，然后问。不用于常规编码或明显变更。

**设计考虑：** Confusion Protocol 是一个轻量级 gate——只在"高风险模糊性"时触发。它依赖 agent 的判断力区分"需要 STOP"和"可以继续"。

### 6.3 Slop-scan

gstack 使用 [slop-scan](https://github.com/benvinegar/slop-scan) 检测 AI 生成代码的质量问题（`CLAUDE.md`）：

> "We use slop-scan to catch patterns where AI-generated code is genuinely worse than what a human would write. We are NOT trying to pass as human code. We are AI-coded and proud of it. The goal is code quality."

**What to fix：** 空 catch 块（用 `safeUnlink()` 代替）、冗余 `return await`、类型化异常捕获。

**What NOT to fix：** 错误消息字符串匹配（Playwright/Chrome 可能改变措辞）、为通过 slop-scan 豁免而添加的注释、扩展 catch-and-log 转 selective rethrow。

**设计考虑：** slop-scan 的哲学是"AI 代码质量，不是 AI 代码隐藏"——不试图伪装成人类代码，而是确保 AI 生成的代码不比人类写的差。这与 gstack 的 "AI-coded and proud of it" 立场一致。

### 6.4 Redaction Guard

共享 redaction 引擎在 credentials、PII 和法律/损害性内容到达外部 sink（codex dispatch、GitHub issue/PR body、pushed commit）之前捕获它们（`CLAUDE.md`）。

三个级别：
- **HIGH** — 真正的秘密凭证，阻断
- **MEDIUM** — PII/法律/内部 + 高 FP 凭证形状，通过 AskUserQuestion 确认
- **LOW** — FYI

**设计考虑：** Redaction Guard 是"guardrail, not airtight enforcement"——`git push --no-verify` 等方式可以绕过。它捕获事故和粗心，99% 的情况。

### 6.5 Domain Skills

`$B domain-skill save` 让 agent 保存 per-site 笔记（如"LinkedIn 的 Apply 按钮在 iframe 中"），下次访问该 hostname 时自动触发（`README.md`）。

隔离 → 3 次成功使用后激活 → 可选通过 `$B domain-skill promote-to-global` 跨项目提升。

**设计考虑：** Domain Skills 让浏览器 agent **随时间积累站点知识**——第一次访问 LinkedIn 时发现按钮在 iframe 中，之后每次访问都自动知道。这是"agent 变聪明"的具体体现。

### 6.6 `/spec` 五阶段 spec 创作

`/spec` 将模糊意图转化为精确、可执行的 spec，分五个阶段（`README.md`）：

```
Phase 1: Why
  │  └── 问题陈述：为什么要做这个？解决什么痛点？
  ▼
Phase 2: Scope
  │  └── 范围定义：做什么、不做什么、边界在哪里？
  ▼
Phase 3: Technical
  │  └── 技术方案（强制代码阅读）
  │      ├── 读取现有代码理解当前架构
  │      ├── 识别需要修改的模块
  │      └── 不允许凭空设计
  ▼
Phase 4: Draft
  │  └── 草稿：整合前三个阶段的输出为完整 spec 文档
  ▼
Phase 5: File
     └── 归档到 $GSTACK_STATE_ROOT/projects/$SLUG/specs/
         └── Codex quality gate：低于 7/10 的 spec 被阻断
```

`--execute` 标志在全新 worktree 中 spawn `claude -p`；`/ship` 在 merge 时自动关闭源 issue。

**设计考虑：** `/spec` 的 Technical 阶段强制代码阅读——不允许凭空设计。这是 gstack "Search Before Building" 原则在 spec 阶段的具体体现。Codex quality gate 在 File 阶段前阻断低于 7/10 的 spec——这确保了归档的 spec 有最低质量保障。Fail-closed secret redaction 在写入前阻断 HIGH 级别秘密——即使 spec 中不小心包含了凭证，也不会被写入磁盘。

**取舍：** `/spec` 的五阶段流程比 mattpocock 的 `to-spec`（一行指令）重得多。但 gstack 的立场是"拥有完整流程"——spec 阶段的严谨性是后续阶段质量的保证。

---

## 7. 演进中的关键教训

| 教训 | 来源 | 修复 |
|------|------|------|
| 浏览器冷启动延迟（3-5s/命令）导致 agent 交互不可行 | 初始设计 | 长驻 Chromium 守护进程，首次 ~3s 后续 ~100-200ms |
| 每次命令后浏览器死亡导致 cookies/tabs 丢失 | 初始设计 | 守护进程模型，30min idle timeout，持久状态 |
| 多 session 并行时用户忘记当前窗口上下文 | 并行 sprint 场景 | ELI16 mode，3+ session 时每个问题重新建立上下文 |
| 长 running 任务被 process group SIGTERM 杀死 | Conductor 并行 | gstack-detach 创建新 session + caffeinate -i 阻止 idle-sleep |
| 并行 worktree rate-limit model API 碰撞 | 并行 eval 场景 | Machine-wide eval lock，第二个 run 等待而非碰撞 |
| 并行 worktree 版本号冲突 | 并行 ship 场景 | gstack-next-version 检测其他 worktree 已 claim 的版本号 |
| 并行 sprint 重复讨论已决定的架构 | 多 sprint 场景 | Cross-session decision memory（decisions.jsonl） |
| 文档与代码漂移 | skill 维护 | SKILL.md 从 .tmpl 模板自动生成，CI 检测过时文档 |
| context compaction 后丢失工程状态 | 长时间 session | Context Recovery 块，preamble 读取磁盘 artifact 恢复状态 |
| prompt injection 通过浏览器攻击 agent | 浏览器 QA 场景 | 6 层防御：datamarking → ARIA regex → ML 分类器 → canary → ensemble |
| 单个 ML 分类器误报率高（Stack Overflow 内容） | 安全分类器 | Ensemble rule：BLOCK 需要两个分类器一致，单高置信度降级为 WARN |
| tunnel 暴露完整命令面给远程 caller | pair-agent 场景 | Dual-listener tunnel，tunnel listener 只服务允许列表端点 |

**模式：** 从单 skill 到并行工厂——gstack 的演进主线是从单个浏览器工具（`/browse`、`/qa`），逐步扩展为覆盖完整 sprint 的 23+ skills 体系，核心驱动力是并行 sprint 场景带来的新约束（ELI16、detach、eval lock、decision memory）。

---

## 8. 能力边界

### 7.1 擅长

- **全 sprint 覆盖**：从 Think 到 Reflect 的完整 7 阶段流程，23+ skills 覆盖每个阶段
- **浏览器 QA**：持久 Chromium 守护进程 + Ref 系统 + prompt injection 防御，agent 有"眼睛"
- **跨模型审查**：`/codex` 获取 OpenAI 独立审查，跨模型分析显示重叠和独有发现
- **设计探索**：`/design-shotgun`（4-6 个 AI mockup 变体 + 比较板）→ `/design-html`（生产质量 HTML）
- **并行 sprint**：Conductor 10-15 并行 + ELI16 mode + gstack-detach + workspace-aware ship
- **持久记忆**：learnings.jsonl + decisions.jsonl + timeline.jsonl + GBrain 语义搜索
- **多 agent 协调**：`/pair-agent` 跨 agent 共享浏览器，scoped tokens + tab 隔离 + rate limiting
- **安全防御**：dual-listener tunnel + 6 层 prompt injection 防御 + redaction guard
- **iOS QA**：`/ios-qa` 驱动真实 iPhone（USB CoreDevice），`--tailnet` 暴露给远程 agent

### 7.2 不擅长

- **Spec 演进追踪**：`/spec` 产出一次性 spec 文档，没有 delta 机制、没有 source of truth、没有 archive 合并
- **Brownfield 增量规格化**：没有"只文档化要改的部分"的能力——spec 是全量的而非增量的
- **变更可审计**：没有 change 文件夹完整保留机制——artifact 分散在多个路径
- **轻量入门**：23+ skills + 8 power tools + preamble + section 文件，学习曲线陡峭
- **跨平台一致性**：虽然适配 10 个 host，但浏览器能力（核心卖点）依赖 Playwright + Bun，在某些平台（Windows）有已知问题
- **流程弹性**：sprint 结构是强约束——Dashboard 会显示缺失的审查，流程弹性有限

### 7.3 演进特征

从 README 和 CLAUDE.md 可以看出 gstack 的演进特征：

1. **从单一 skill 到 sprint 流程**：最初可能只有 `/browse` 和 `/qa`，逐步扩展到 23+ skills 覆盖完整 sprint
2. **从 Claude-only 到多平台**：最初只支持 Claude Code，逐步适配 Codex、Cursor、Factory 等 10 个 host
3. **从简单浏览器到安全浏览器**：从基本 Playwright 驱动到 6 层 prompt injection 防御 + dual-listener tunnel + domain skills
4. **从手动到自动化**：从手动运行每个 skill 到 `/autoplan` 自动化计划阶段 + Continuous Checkpoint 自动 commit
5. **从单 sprint 到并行 sprint**：从单 session 到 Conductor 10-15 并行 + ELI16 mode + workspace-aware ship

---

## 9. 设计决策清单

以下是从源码分析中提取的 gstack 的核心设计决策：

| # | 设计决策 | 为什么这么做 | 之前出了什么问题 |
|---|---------|-------------|----------------|
| 1 | Sprint 结构（Think→Plan→Build→Review→Test→Ship→Reflect） | "without a process, ten agents is ten sources of chaos" | 无流程时并行 agent 是混乱源，无法管理 |
| 2 | 链式传递通过文件系统持久化 | 跨 session、跨 sprint 传递工程状态 | context window 内传递在 compaction 后丢失 |
| 3 | SKILL.md 从 .tmpl 模板自动生成 | 文档与代码结构性一致 | 手写文档与代码漂移，命令变更后文档过时 |
| 4 | Preamble 共享块（170 行 bash） | 每个 skill 继承相同基础设施 | 无共享块时每个 skill 重复实现升级检查/遥测/学习 |
| 5 | Boil the Ocean 哲学 | "AI makes completeness cheap" | "Don't boil the ocean" 在 AI 时代变成借口语 |
| 6 | User Sovereignty 覆盖所有规则 | "AI models recommend. Users decide." | AI 自信地跳过用户验证，做出错误决策 |
| 7 | 跨模型审查（/codex） | 模型偏差消除——两个不同模型交叉验证 | 单模型审查有系统性盲区 |
| 8 | Continuous Checkpoint（WIP commit） | Crash 恢复 + context 切换 | session 崩溃后工作进度和决策上下文丢失 |
| 9 | 持久浏览器守护进程 | 亚秒级延迟 + 持久状态 | 冷启动浏览器每次命令 3-5s 延迟，状态丢失 |
| 10 | Bun 编译二进制 | 单一可执行文件，无需 node_modules | Node.js 项目需要用户管理 node_modules 和 PATH |
| 11 | Ref 系统（@e1, @e2） | 无 DOM 修改、无 CSP 冲突、无框架冲突 | DOM 修改被 CSP 阻止或框架水合剥离 |
| 12 | Dual-listener tunnel architecture | 物理端口分离——tunnel caller 无法访问 local-only 端点 | 单 listener 时 tunnel 暴露完整命令面 |
| 13 | 6 层 prompt injection 防御 | sidebar agent 暴露于敌对网页 | 无防御时 agent 被网页内容注入攻击 |
| 14 | Ensemble rule（2-of-3 一致才 BLOCK） | Stack Overflow 误报缓解 | 单分类器高置信度误报率高 |
| 15 | ELI16 mode（3+ session 时） | 用户在多窗口间切换时重新建立上下文 | 多 session 时用户忘记当前窗口的项目/分支/任务 |
| 16 | gstack-detach（SIGTERM-proof） | 长 running 任务逃逸 process group SIGTERM | 普通 background bash 被 process group 信号杀死 |
| 17 | Machine-wide eval lock | 防止并行 worktree rate-limit model API | 无 lock 时并行 eval 碰撞导致 API rate-limit |
| 18 | Workspace-aware ship（版本冲突检测） | 并行 worktree 避免版本号冲突 | 无检测时多个 worktree claim 同一版本号 |
| 19 | Cross-session decision memory（decisions.jsonl） | 并行 sprint 不重新讨论已决定的架构 | 无记忆时不同 sprint 重复讨论同一架构决策 |
| 20 | GBrain 持久知识库 | 跨 session、跨机器的语义搜索 | 无知识库时每个 session 从零开始理解代码库 |
| 21 | Per-remote trust policy（read-write/read-only/deny） | 多客户顾问的知识隔离 | 无隔离时客户 A 的工作污染客户 B 的知识库 |
| 22 | AskUserQuestion 格式（D<N> + ELI10 + Completeness） | 结构化决策 brief，防止模糊提问 | 无格式规范时 AI 提问模糊、缺少推荐 |
| 23 | 5+ 选项 split 而非 drop | "用户的选项集是神圣的" | 超过 4 个选项时丢弃低优先级选项 |
| 24 | Conductor prose fallback | Conductor AUQ 不稳定，prose 是可靠路径 | Conductor 的 native AUQ 和 MCP 变体不稳定 |
| 25 | Confusion Protocol | 高风险模糊性时 STOP | 无 STOP 机制时 agent 在模糊场景中盲目推进 |
| 26 | Autoplan 自动化计划阶段 | 一条命令覆盖所有计划审查 | 用户忘记运行某个计划审查 |
| 27 | Review Readiness Dashboard | 链式传递状态可视化 | 无 Dashboard 时用户不知道哪些审查已运行 |
| 28 | Context Recovery（preamble 读取 artifact） | context compaction 后恢复工程状态 | compaction 后 skill 不知道之前的工程状态 |
| 29 | Domain Skills（per-site 笔记） | agent 随时间积累站点知识 | 每次访问同一站点都要重新发现其特性 |
| 30 | /spec 五阶段（含强制代码阅读） | 不允许凭空设计 | 无代码阅读要求时 spec 脱离实际代码库 |
| 31 | Redaction Guard（HIGH/MEDIUM/LOW） | 捕获事故和粗心——99% 的情况 | 无 guard 时凭证和 PII 被推送到外部 |
| 32 | slop-scan AI 代码质量检测 | "AI code quality, not AI code hiding" | 无检测时 AI 生成代码含空 catch 块等质量问题 |
| 33 | Search Before Building（三层知识） | "1000x engineer's first instinct: has someone solved this?" | 无搜索要求时 agent 从头设计已有解决方案的问题 |
| 34 | /pair-agent 跨 agent 浏览器共享 | 不同 vendor 的 AI agent 通过共享浏览器协调 | 无共享机制时不同 AI agent 无法协作 |
| 35 | /ios-qa 真实设备 QA | 驱动真实 iPhone over USB CoreDevice | 仅模拟器测试无法覆盖真实设备问题 |
| 36 | /design-shotgun 视觉探索 | "show me options"而非用文字描述愿景 | 用文字描述视觉设计导致理解偏差 |
| 37 | /design-html 生产质量 HTML | Pretext 计算文本布局——text reflows on resize | 标准 AI 生成 HTML 在 resize 时布局崩溃 |
| 38 | /document-release 自动文档同步 | 读取每个 doc 文件，对照 diff 更新漂移的文档 | 手动更新文档遗漏或滞后于代码变更 |
| 39 | /retro 团队回顾 | per-person breakdowns + shipping streaks + test health trends | 无回顾机制时团队无法从 sprint 中学习 |
| 40 | /learn 记忆管理 | learnings compound across sessions——agent 变聪明 | 无记忆时每个 session 从零开始，不积累经验 |

---

## 10. 总结

gstack 的核心贡献不在于单个 skill 的设计（虽然许多 skill 设计精良），而在于：

1. **Sprint 链式传递**：通过文件系统持久化 artifact，实现了跨 session、跨 sprint 的工程状态传递。每个 skill 的产出喂给下一个，Dashboard 可视化流程状态。

2. **持久浏览器守护进程**：长驻 Chromium + Ref 系统 + 6 层 prompt injection 防御，让 agent 拥有"眼睛"——这是 gstack 区别于所有其他项目的核心能力。

3. **并行 sprint 管理**：Conductor 10-15 并行 + ELI16 mode + gstack-detach + workspace-aware ship + cross-session decision memory。流程是并行的基础——"without a process, ten agents is ten sources of chaos."

4. **设计哲学体系**：Boil the Ocean（完整是目标）、User Sovereignty（用户决策覆盖一切）、Search Before Building（三层知识）、跨模型审查（模型偏差消除）、Continuous Checkpoint（自动 WIP commit）。这些不是口号，而是编码到了 preamble、AskUserQuestion 格式和 skill 工作流中。

5. **全栈覆盖**：从设计探索（`/design-shotgun`）到 iOS QA（`/ios-qa`），从安全审计（`/cso`）到文档同步（`/document-release`），23+ skills 覆盖完整工程团队的所有角色。

它的局限也很明确：缺乏 spec 演进追踪（没有 delta 机制和 source of truth）、重量级（学习曲线陡峭）、流程弹性有限（sprint 结构是强约束）。这些局限是"拥有完整流程"立场的必然结果——如果你拥有流程，就需要维护流程的每个环节。

gstack 是五个项目中最接近"虚拟工程团队"愿景的。它的设计决策围绕一个核心信念：**AI 时代，一个人可以做一个团队的事，但前提是工具链足够完整和自动化。** Boil the Ocean 不是鼓励过度工程，而是指出"完整的边际成本接近零"这一新现实。
