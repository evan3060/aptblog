---
title: AI研发流程深度解析（六）：gstack深度拆解——虚拟工程团队
description: 深度拆解一个试图把Claude Code变成完整工程团队的项目，分析其sprint链式传递、全流程覆盖与工具重度依赖之间的关系。
tags:
  - 研发流程
  - gstack
  - Sprint
  - 工程团队
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 一个试图把Claude Code变成完整工程团队的项目，是如何设计sprint链式传递的？它的全流程覆盖与工具重度依赖之间是什么关系？

---

![AI研发流程深度解析（六）：gstack深度拆解——虚拟工程团队](/images/dev-process/dev-process-06-gstack-deep-dive.png)

## 1. 架构拆解

### 1.1定位与规模

gstack的自我定位是 **"turns Claude Code into a virtual engineering team"**（`README.md`）。这不是比喻——README列出了23个specialist skills和8个power tools，每个skill对应一个工程角色：CEO、Eng Manager、Senior Designer、Staff Engineer、QA Lead、Security Officer、Release Engineer、SRE等。Garry Tan（YC总裁）以个人身份构建，声称在60天内交付了3个生产服务、40+ 功能特性，逻辑代码变更速率是2013年的 ~810×。

这个定位的核心信号是：**这不是skill集合，而是一个软件工厂。** gstack明确拥有一个完整的sprint流程，每个skill在流程中有固定位置。这与ECC的"提供素材不定义流程"和mattpocock的"不拥有流程"形成了鲜明的立场差异。

### 1.2 Sprint结构

gstack的核心组织原则是 **sprint**——一个按工程团队节奏运行的流程（`README.md`）：

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

每个阶段对应一组skills：

| 阶段 | Skills | 角色 |
|------|--------|------|
| **Think** | `/office-hours` | YC Office Hours — 六个forcing questions |
| **Plan** | `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/plan-devex-review`, `/autoplan`, `/spec` | CEO、Eng Manager、Designer、DX Lead |
| **Build** | (隐含，由plan产出驱动) | — |
| **Review** | `/review`, `/codex`, `/cso` | Staff Engineer、Second Opinion、Security Officer |
| **Test** | `/qa`, `/qa-only`, `/benchmark`, `/investigate` | QA Lead、Performance Engineer、Debugger |
| **Ship** | `/ship`, `/land-and-deploy`, `/canary` | Release Engineer、SRE |
| **Reflect** | `/retro`, `/learn`, `/document-release` | Eng Manager、Memory、Technical Writer |

**设计考虑：** sprint结构不是松散的skill列表，而是一条**链式传递**的流水线——每个skill的产出喂给下一个。README明确指出："Each skill feeds into the next. `/office-hours` writes a design doc that `/plan-ceo-review` reads. `/plan-eng-review` writes a test plan that `/qa` picks up. `/review` catches bugs that `/ship` verifies are fixed."

### 1.3 Skill模板系统

gstack的SKILL.md文件不是手写的，而是从 `.tmpl` 模板**自动生成**的（`ARCHITECTURE.md`）：

```
SKILL.md.tmpl          (人类编写的 prose + 占位符)
       ↓
gen-skill-docs.ts      (读取源代码元数据)
       ↓
SKILL.md               (提交到 git，自动生成 sections)
```

占位符从源代码中填充：`{{COMMAND_REFERENCE}}` 从 `commands.ts` 生成命令表，`{{PREAMBLE}}` 生成启动块，`{{BASE_BRANCH_DETECT}}` 生成动态分支检测等。

**设计考虑：** 这个设计解决了"文档与代码漂移"的经典问题——如果命令存在于代码中，它就出现在文档中；如果不存在，就不能出现。CI通过 `gen:skill-docs --dry-run` + `git diff --exit-code` 在merge前捕获过时文档。

**取舍：** 模板系统增加了贡献者门槛——修改skill需要理解模板系统、resolver模块和生成管线。但换来的是文档与代码的结构性一致性。

### 1.4 Preamble共享块

每个skill都以一个 `{{PREAMBLE}}` 块开始，这是一个约170行的bash脚本，处理五件事（`ARCHITECTURE.md`）：

1. **Update check** — 调用 `gstack-update-check`，报告是否有升级
2. **Session tracking** — 触摸 `~/.gstack/sessions/$PPID`，计算活跃session数。当3+ 个session运行时，所有skill进入 "ELI16 mode"——每个问题都重新为用户建立上下文，因为他们正在多个窗口之间切换
3. **Operational self-improvement** — skill结束时，agent反思失败并将操作学习记录到项目的JSONL文件
4. **AskUserQuestion format** — 统一格式：context、question、`RECOMMENDATION: Choose X because ___`、字母选项
5. **Search Before Building** — 在构建不熟悉的模式前先搜索

**Preamble的结构：**
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

**设计考虑：** preamble是gstack的"操作系统"——它让每个skill都继承相同的基础设施（升级检查、遥测、学习、搜索），而不需要每个skill重复实现。ELI16 mode是一个独特的设计：当用户同时运行多个sprint时，每个skill自动降低假设的上下文量。这不是用户配置的，而是系统根据session数量自动激活的。

### 1.5多平台适配

gstack通过 `hosts/` 目录下的类型化配置文件适配10个AI编码代理（`README.md`）：

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
| OpenClaw | (ACP) | Claude Code session内使用 |

**设计考虑：** 添加一个新host只需要一个TypeScript配置文件，零代码修改（`docs/ADDING_A_HOST.md`）。这是通过将host差异隔离到配置层（安装路径、skill前缀、工具映射）实现的。

**关键文件：** `README.md`、`CLAUDE.md`、`ARCHITECTURE.md`、`ETHOS.md`

---

## 2. Sprint链式传递设计

### 2.1链式传递的实现

gstack的链式传递不是松散的"skill之间可以互相调用"，而是通过**持久化artifact + 主动读取**实现的。每个skill将产出写入 `~/.gstack/projects/$SLUG/` 下的文件，下游skill在preamble阶段主动读取这些文件。

主要artifact流：

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

**设计考虑：** 链式传递通过文件系统实现，不依赖context window传递。这意味着：
1. **跨session传递** — 即便session中断，artifact仍在磁盘上
2. **跨sprint传递** — 一个sprint的CEO计划可以被另一个sprint读取
3. **可审计** — 所有artifact都有时间戳和文件路径

### 2.2 Context Recovery

每个skill的preamble都包含Context Recovery块（`plan-ceo-review/SKILL.md`）：

```bash
_PROJ="${GSTACK_HOME:-$HOME/.gstack}/projects/${SLUG:-unknown}"
find "$_PROJ/ceo-plans" "$_PROJ/checkpoints" -type f -name "*.md" | head -3
[ -f "$_PROJ/${_BRANCH}-reviews.jsonl" ] && echo "REVIEWS: ..."
[ -f "$_PROJ/timeline.jsonl" ] && tail -5 "$_PROJ/timeline.jsonl"
```

这会在每次skill启动时恢复最近的artifact、审查记录、时间线和活跃决策。

**设计考虑：** Context Recovery解决了"context compaction后丢失上下文"的问题。当Claude Code的context window被compact后，skill重启时通过读取磁盘上的artifact恢复状态。gstack传递的是**工程状态**（设计文档、审查记录、决策日志），而非仅仅是对话摘要。

### 2.3 Review Readiness Dashboard

`/ship` 在Step 1会展示一个Review Readiness Dashboard（`ship/SKILL.md`）：

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

Dashboard从 `gstack-review-read` 读取审查日志，显示每种审查的运行次数、最后运行时间、状态。只有Eng Review是required（可通过 `skip_eng_review` 全局禁用），其他审查是informational。

**设计考虑：** Dashboard让链式传递的状态**可视化**——用户在ship前一眼看到哪些审查已运行、哪些缺失。Staleness detection还会比较审查时的commit与当前HEAD，提示审查是否可能过时。

### 2.4 Autoplan：自动化链式传递

`/autoplan` 是链式传递的自动化版本——一条命令运行CEO → design → eng → DX审查（`README.md`）：

> "One command, fully reviewed plan. Runs CEO → design → eng review automatically with encoded decision principles. Surfaces only taste decisions for your approval."

`/autoplan` 自动检测哪些审查适用（前端变更触发design review，API变更触发DX review），只将taste decisions呈现给用户。

**设计考虑：** autoplan解决了"用户忘记运行某个审查"的问题——一条命令覆盖所有计划阶段审查。encoded decision principles意味着gstack将一些常见的审查决策编码为自动规则，只有真正需要人类判断的taste call才暂停。

**关键文件：** `office-hours/SKILL.md`、`plan-ceo-review/SKILL.md`、`ship/SKILL.md`、`review/SKILL.md`、`ARCHITECTURE.md`

**取舍：** 链式传递的代价是**重量级**——每个skill都有170行preamble、多个on-demand section文件、复杂的artifact路径约定。但链式传递换来了跨session、跨sprint的工程状态持久化和可审计性。

---

## 3. 持久浏览器守护进程

### 3.1核心设计

gstack的浏览器是它的"hard part"——`ARCHITECTURE.md` 开篇就说："gstack gives Claude Code a persistent browser and a set of opinionated workflow skills. The browser is the hard part — everything else is Markdown."

核心洞察：AI agent与浏览器交互需要**亚秒级延迟**和**持久状态**。如果每次命令都冷启动浏览器，每次工具调用要等3-5秒。如果浏览器在命令间死亡，cookies、tabs和登录session全部丢失。

解决方案是**长驻Chromium守护进程**：

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
1. **持久状态** — 登录一次，保持登录。打开一个tab，它保持打开。localStorage跨命令持久化。
2. **亚秒级命令** — 首次调用后，每个命令只是一个HTTP POST。
3. **自动生命周期** — 首次使用自动启动，30分钟空闲后自动关闭。

### 3.2为什么选择Bun

`ARCHITECTURE.md` 解释了选择Bun而非Node.js的四个理由：

1. **编译二进制** — `bun build --compile` 生成 ~58MB单一可执行文件。运行时无需 `node_modules`、无需 `npx`、无需PATH配置。这很重要因为gstack安装到 `~/.claude/skills/` 用户不期望管理Node.js项目。
2. **原生SQLite** — Cookie解密直接读取Chromium的SQLite cookie数据库。Bun内置 `new Database()`，无需 `better-sqlite3`、无需原生插件编译。
3. **原生TypeScript** — 开发时 `bun run server.ts`，无需编译步骤。
4. **内置HTTP服务器** — `Bun.serve()` 快速、简单，不需要Express或Fastify。

**设计考虑：** 瓶颈始终是Chromium，不是CLI或server。Bun的启动速度（~1ms编译二进制vs ~100ms Node）是nice-to-have，但编译二进制和原生SQLite才是选择Bun的真正原因。

### 3.3 Ref系统

gstack的Ref系统（`@e1`, `@e2`, `@c1`）是agent寻址页面元素的方式，无需写CSS选择器或XPath（`ARCHITECTURE.md`）：

1. Agent运行 `$B snapshot -i`
2. Server调用Playwright的 `page.accessibility.snapshot()`
3. 解析器遍历ARIA树，分配顺序ref：@e1, @e2, @e3...
4. 为每个ref构建Playwright Locator：`getByRole(role, { name }).nth(index)`
5. 返回带注释的树作为纯文本

**为什么用Locators而非DOM修改：**
- **CSP** — 许多生产站点阻止脚本修改DOM
- **框架水合** — React/Vue/Svelte调和可能剥离注入的属性
- **Shadow DOM** — 无法从外部触及shadow root

Playwright Locators独立于DOM，使用Chromium内部维护的accessibility tree。无DOM修改、无CSP问题、无框架冲突。

### 3.4安全模型

**Localhost only** — HTTP server绑定 `127.0.0.1`，不可从网络访问。

**Bearer token auth** — 每次server session生成随机UUID token，写入state file（mode 0o600）。每个修改浏览器状态的HTTP请求必须包含 `Authorization: Bearer <token>`。

**Dual-listener tunnel architecture** — 当 `pair-agent` 启动ngrok tunnel时，daemon绑定两个HTTP listener：
- **Local listener** — 始终绑定，服务完整命令面。永不转发。
- **Tunnel listener** — 惰性绑定，只服务锁定允许列表的端点。

安全属性来自**物理端口分离**：tunnel caller无法访问 `/health` 或 `/cookie-picker`，因为这些路径在那个TCP socket上不存在。

**Cookie安全：**
1. Keychain访问需要用户批准（macOS Keychain对话框）
2. 解密在进程内完成，明文永不写入磁盘
3. 数据库只读（复制到临时文件避免SQLite锁冲突）
4. Key缓存是per-session的（server关闭后缓存消失）
5. Cookie值永不出现在日志中

### 3.5 Prompt Injection防御

Chrome sidebar agent有工具（Bash、Read、Glob、Grep、WebFetch）并读取敌对网页，所以它是gstack最暴露于prompt injection的部分。防御是分层的（`ARCHITECTURE.md`）：

| Layer | 模块 | 功能 |
|-------|------|------|
| L1-L3 | `content-security.ts` | datamarking、hidden element strip、ARIA regex、URL blocklist、envelope wrapping |
| L4 | `security-classifier.ts` (TestSavantAI) | 22MB BERT-small ONNX模型，本地运行，扫描每条用户消息和工具输出 |
| L4b | transcript classifier | Claude Haiku pass，检查完整对话形状 |
| L5 | `security.ts` (canary) | 随机token注入system prompt，在输出中检测token泄漏 |
| L6 | `security.ts` (combineVerdict) | BLOCK需要两个ML分类器在 >= WARN (0.75) 一致 |

**设计考虑：** L6的ensemble rule是Stack Overflow误报缓解——单个分类器高置信度降级为WARN，因为"这个看起来像钓鱼"和"这是注入"难以区分。Canary leak始终BLOCK（确定性）。

### 3.6浏览器QA在流程中的角色

README中Garry Tan明确指出浏览器QA是他的 "massive unlock"：

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

**设计考虑：** 浏览器QA将"agent能看代码"扩展为"agent能看产品"。这是gstack的核心能力——agent拥有"眼睛"。Garry Tan声称这让他从6个并行worker扩展到12个，因为agent可以自主验证而不是依赖人工反馈。这意味着并行sprint的瓶颈从"人工验证速度"转移到了"模型API rate limit"——这是一个质的飞跃。

**关键文件：** `ARCHITECTURE.md`、`BROWSER.md`、`browse/src/commands.ts`、`browse/src/server.ts`

---

## 4. 设计哲学

### 4.1 Boil the Ocean

`ETHOS.md` 开篇就颠覆了传统工程智慧：

> "'Don't boil the ocean' was the right advice when engineering time was the bottleneck. That era is over. AI-assisted coding makes the marginal cost of completeness near-zero, so the old caution has quietly turned into an excuse."

核心论点：当完整实现比捷径只多花几分钟时，**每次都做完整的事**。

**Ocean, lakes first：** 海洋是目的地——100% 测试覆盖率、完整功能实现、所有edge case、完整错误路径。你一个湖一个湖地到达——每个湖是一个可沸腾的单元，不是天花板。"That's boiling the ocean" 不再是ship捷径的理由——沸腾海洋是目标。唯一仍然在scope外的是真正无关的工作：与当前任务无关的多季度平台迁移。

**反模式vs正确做法：**

| 反模式 | 正确做法 | 理由 |
|-------|---------|------|
| "选择B——它覆盖90% 且代码更少" | 如果A多70行，选A | 10% 的edge case在生产中会出问题 |
| "把测试推迟到后续PR" | 测试是最便宜的湖 | 测试延迟的成本远高于即时编写 |
| "这需要2周" | "2周人力 / ~1小时AI辅助" | AI改变了时间估算的基本假设 |

**设计考虑：** Boil the Ocean哲学被注入到每个skill的preamble中。`Completeness Principle` 要求在选项覆盖度不同时标注 `Completeness: X/10`（10 = 完整，7 = happy path，3 = 捷径）。这不只是口号，而是编码到了AskUserQuestion的格式规范中——每个决策都必须标注完整性评分，让用户在选择时明确知道"我在用多少完整性换取简洁性"。

**取舍：** Boil the Ocean的风险是**范围蔓延**——"完整"的定义可能无限膨胀。gstack的缓解是"唯一在scope外的是真正无关的工作"——但判断"无关"本身是主观的。User Sovereignty原则在这里起到了制衡作用——即使用户说"只做最小版本"，用户赢。

### 4.2 User Sovereignty

`ETHOS.md` 的第三条原则是覆盖所有其他规则的**一票否决权**：

> "AI models recommend. Users decide. This is the one rule that overrides all others."

核心论点：两个AI模型同意一个变更是一个强信号，但不是命令。用户始终有模型缺乏的上下文：领域知识、业务关系、战略时机、个人品味、未分享的未来计划。当Claude和Codex都说"合并这两个东西"而用户说"不，保持分开"——用户是对的。总是。

**generation-verification loop：** AI生成推荐 → 用户验证和决策 → AI永不因为自信而跳过验证步骤。

**规则：** 当你和另一个模型同意改变用户已说明方向时——呈现推荐、解释为什么你们都认为更好、说明你可能缺少什么上下文、然后问。永不擅自行动。

**设计考虑：** User Sovereignty体现在多个层面：
- AskUserQuestion格式要求每个决策都有 `Recommendation` 和 `(recommended)` 标签，但最终选择权在用户
- `/plan-ceo-review` 的Expansion opt-in ceremony：每个扩展提案都是单独的AskUserQuestion，用户opt in或out
- `/codex` 的跨模型审查结果被标记为"recommendation, not decision"
- 这意味着即便Boil the Ocean说"做完整的事"，如果用户说"只做最小版本"，用户赢。

### 4.3跨模型审查

`/codex` skill获取来自OpenAI Codex CLI的独立审查——一个完全不同的AI看同一个diff（`README.md`）。三种模式：

1. **review** — pass/fail gate代码审查
2. **adversarial challenge** — 主动尝试打破你的代码
3. **open consultation** — 带session连续性的开放咨询

当 `/review`（Claude）和 `/codex`（OpenAI）都审查了同一分支时，gstack生成**跨模型分析**——显示哪些发现重叠、哪些是各自独有的。

**设计考虑：** 跨模型审查的核心价值是**模型偏差消除**——Claude可能系统性地忽略某类问题，Codex可能忽略另一类。两个不同模型的交叉验证比单个模型的两次审查更有价值。

**取舍：** 跨模型审查需要两个AI服务的API key，增加了成本和配置复杂度。Codex审查的E2E测试使用Codex自己的auth（`~/.codex/` config），不需要 `OPENAI_API_KEY` env var——这降低了配置门槛但仍依赖Codex CLI安装。

### 4.4 Continuous Checkpoint

设置 `gstack-config set checkpoint_mode continuous` 后，skill在工作过程中自动commit（`README.md`）：

```
WIP: <concise description of what changed>

[gstack-context]
Decisions: <key choices made this step>
Remaining: <what's left in the logical unit>
Tried: <failed approaches worth recording> (omit if none)
Skill: </skill-name-if-running>
[/gstack-context]
```

- `/context-restore` 读取这些commit重建session状态
- `/ship` 在PR前过滤压缩WIP commit（保留非WIP commit），保持bisect干净
- Push是opt-in的（`checkpoint_push=true`）——默认只本地commit，不触发CI

**设计考虑：** Continuous Checkpoint解决了两个问题：
1. **Crash恢复** — session崩溃后，WIP commit保留了工作进度和决策上下文
2. **Context切换** — 在10-15个并行sprint之间切换时，`[gstack-context]` 块记录了"做到哪了、还剩什么、试过什么"

### 4.5 Search Before Building

`ETHOS.md` 的第二条原则——**1000x工程师的第一反应是"有人已经解决了吗？"而非"让我从头设计"**。

三层知识：
1. **Layer 1: Tried and true** — 标准模式、久经考验的方法。检查成本接近零。
2. **Layer 2: New and popular** — 当前最佳实践、博客文章、生态趋势。搜索但审视——人群对新事物和旧事物一样可能出错。
3. **Layer 3: First principles** — 从对特定问题的推理中得出的原创观察。最有价值。 Prize them above everything else.

**Eureka Moment：** 搜索的最有价值结果不是找到可复制的方案，而是：(1) 理解大家在做什么和为什么（Layer 1+2），(2) 对他们的假设应用第一性原理推理（Layer 3），(3) 发现常规方法为什么错的清晰理由。这是11 out of 10。

**设计考虑：** Search Before Building被注入到每个skill的preamble中。在构建不熟悉的模式前，agent被指示先搜索。当第一性原理推理与常规智慧矛盾时，agent被要求"命名eureka moment"并记录到 `~/.gstack/analytics/eureka.jsonl`。

---

## 5. 并行sprint管理

### 5.1 Conductor并行

gstack与 [Conductor](https://conductor.build) 深度集成——Conductor运行多个Claude Code session并行，每个在自己的隔离workspace（`README.md`）：

> "I regularly run 10-15 parallel sprints — that's the practical max right now."

Garry Tan的场景描述：一个session运行 `/office-hours` 探索新想法，另一个做 `/review` 审查PR，第三个实现功能，第四个在staging上运行 `/qa`，还有六个在其他分支上。全部同时进行。

### 5.2并行的前提：Sprint结构

README明确指出并行的前提是流程结构：

> "The sprint structure is what makes parallelism work. Without a process, ten agents is ten sources of chaos. With a process — think, plan, build, review, test, ship — each agent knows exactly what to do and when to stop. You manage them the way a CEO manages a team: check in on the decisions that matter, let the rest run."

**设计考虑：** 流程是并行的基础——没有流程，10个agent是10个混乱源。sprint结构让每个agent知道"做什么和何时停止"。

### 5.3并行基础设施

gstack为并行sprint提供了多项基础设施：

**ELI16 mode：** 当3+ 个session运行时，所有skill进入ELI16 mode——每个AskUserQuestion都重新为用户建立上下文（项目名、分支名、当前任务），因为用户正在多个窗口之间切换。

**gstack-detach：** 长running任务（如eval套件）通过 `gstack-detach` 运行而非普通background bash——它创建新session（逃逸process group SIGTERM）并包装在 `caffeinate -i` 中（阻止idle-sleep）。detached run即使watcher被回收也能在日志中检查。

**Machine-wide eval lock：** 共享dev box上的多个Conductor worktree会rate-limit model API。eval lock让第二个run等待而非碰撞。

**Workspace-aware ship：** `gstack-next-version` 检测其他worktree是否已claim同一版本号，避免版本冲突。

**Random port selection：** 浏览器daemon使用10000-60000的随机端口（最多重试5次），意味着10个Conductor workspace各自运行自己的browse daemon，零配置、零端口冲突。

### 5.4 Cross-session Decision Memory

gstack维护一个append-only、event-sourced的决策存储（`CLAUDE.md`）：

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

**设计考虑：** 决策存储解决了一个独特的并行问题——当10个sprint同时运行时，一个sprint做的架构决策不应该被另一个sprint重新讨论。决策存储让"已决定的事不再重新讨论"成为可能。`--supersede <id>` 允许反转先前的决策，但要求显式声明——这确保了决策变更是可审计的，而不是静默的覆盖。append-only的设计意味着历史决策永远不会被删除，只能被supersede——这为团队回顾提供了完整的决策演化轨迹。

### 5.5 GBrain：持久知识库

GBrain是gstack的可选持久知识库——AI agent跨session保留的记忆（`README.md`）：

- **PGLite local** — 零账号、零网络，~30秒
- **Supabase existing URL** — 云端agent已provisioned的brain
- **Supabase auto-provision** — 自动创建新项目
- **Remote gbrain MCP** — brain运行在另一台机器上

`/sync-gbrain` 将repo代码重新索引到gbrain，在CLAUDE.md中写入 `## GBrain Search Guidance` 块，让agent优先使用 `gbrain search` 而非Grep。

**Per-remote trust policy：** 每个repo有三种信任级别：
- `read-write` — agent可以搜索brain并从这个repo写回新页面
- `read-only` — agent可以搜索但不能写（适合多客户顾问：搜索共享brain，不污染客户A的工作）
- `deny` — 无gbrain交互

**设计考虑：** GBrain解决了并行sprint的知识共享问题——一个sprint学到的代码库模式可以被另一个sprint搜索到。Per-remote trust policy处理了多客户场景的知识隔离。

---

## 6. 其他关键设计模式

### 6.1 AskUserQuestion格式

gstack定义了一套极其详细的AskUserQuestion格式规范（`plan-ceo-review/SKILL.md`）。这是gstack将"如何向用户提问"从隐性的最佳实践提升为显性的结构化规范的核心机制。

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

**5+ 选项处理：** AskUserQuestion限制每次调用最多4个选项。gstack要求**永不丢弃**选项——要么batch成 ≤4组，要么split成per-option调用（D3.1, D3.2, ...）。split chain的question_id永不被AUTO_DECIDE——用户的选项集是神圣的。

**Conductor兼容：** Conductor禁用native AUQ且其MCP变体不稳定，gstack检测Conductor环境并自动切换到prose fallback——将决策brief渲染为markdown消息而非工具调用。

**设计考虑：** 这套格式规范解决了一个真实问题——AI的提问经常模糊、缺少推荐、无法让用户快速决策。gstack将提问结构化为"decision brief"，要求每个问题都有ELI10、推荐、完整性评分、pros/cons和net tradeoff。

### 6.2 Confusion Protocol

对于高风险的模糊性（架构、数据模型、破坏性scope、缺失上下文），skill被指示STOP——用一句话命名问题，呈现2-3个选项带tradeoff，然后问。不用于常规编码或明显变更。

**设计考虑：** Confusion Protocol是一个轻量级gate——只在"高风险模糊性"时触发。它依赖agent的判断力区分"需要STOP"和"可以继续"。

### 6.3 Slop-scan

gstack使用 [slop-scan](https://github.com/benvinegar/slop-scan) 检测AI生成代码的质量问题（`CLAUDE.md`）：

> "We use slop-scan to catch patterns where AI-generated code is genuinely worse than what a human would write. We are NOT trying to pass as human code. We are AI-coded and proud of it. The goal is code quality."

**What to fix：** 空catch块（用 `safeUnlink()` 代替）、冗余 `return await`、类型化异常捕获。

**What NOT to fix：** 错误消息字符串匹配（Playwright/Chrome可能改变措辞）、为通过slop-scan豁免而添加的注释、扩展catch-and-log转selective rethrow。

**设计考虑：** slop-scan的哲学是"AI代码质量，不是AI代码隐藏"——不试图伪装成人类代码，而是确保AI生成的代码不比人类写的差。这与gstack的 "AI-coded and proud of it" 立场一致。

### 6.4 Redaction Guard

共享redaction引擎在credentials、PII和法律/损害性内容到达外部sink（codex dispatch、GitHub issue/PR body、pushed commit）之前捕获它们（`CLAUDE.md`）。

三个级别：
- **HIGH** — 真正的秘密凭证，阻断
- **MEDIUM** — PII/法律/内部 + 高FP凭证形状，通过AskUserQuestion确认
- **LOW** — FYI

**设计考虑：** Redaction Guard是"guardrail, not airtight enforcement"——`git push --no-verify` 等方式可以绕过。它捕获事故和粗心，99% 的情况。

### 6.5 Domain Skills

`$B domain-skill save` 让agent保存per-site笔记（如"LinkedIn的Apply按钮在iframe中"），下次访问该hostname时自动触发（`README.md`）。

隔离 → 3次成功使用后激活 → 可选通过 `$B domain-skill promote-to-global` 跨项目提升。

**设计考虑：** Domain Skills让浏览器agent **随时间积累站点知识**——第一次访问LinkedIn时发现按钮在iframe中，之后每次访问都自动知道。这是"agent变聪明"的具体体现。

### 6.6 `/spec` 五阶段spec创作

`/spec` 将模糊意图转化为精确、可执行的spec，分五个阶段（`README.md`）：

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

`--execute` 标志在全新worktree中spawn `claude -p`；`/ship` 在merge时自动关闭源issue。

**设计考虑：** `/spec` 的Technical阶段强制代码阅读——不允许凭空设计。这是gstack "Search Before Building" 原则在spec阶段的具体体现。Codex quality gate在File阶段前阻断低于7/10的spec——这确保了归档的spec有最低质量保障。Fail-closed secret redaction在写入前阻断HIGH级别秘密——即使spec中不小心包含了凭证，也不会被写入磁盘。

**取舍：** `/spec` 的五阶段流程比mattpocock的 `to-spec`（一行指令）重得多。但gstack的立场是"拥有完整流程"——spec阶段的严谨性是后续阶段质量的保证。

---

## 7. 演进中的关键教训

| 教训 | 来源 | 修复 |
|------|------|------|
| 浏览器冷启动延迟（3-5s/命令）导致agent交互不可行 | 初始设计 | 长驻Chromium守护进程，首次 ~3s后续 ~100-200ms |
| 每次命令后浏览器死亡导致cookies/tabs丢失 | 初始设计 | 守护进程模型，30min idle timeout，持久状态 |
| 多session并行时用户忘记当前窗口上下文 | 并行sprint场景 | ELI16 mode，3+ session时每个问题重新建立上下文 |
| 长running任务被process group SIGTERM杀死 | Conductor并行 | gstack-detach创建新session + caffeinate -i阻止idle-sleep |
| 并行worktree rate-limit model API碰撞 | 并行eval场景 | Machine-wide eval lock，第二个run等待而非碰撞 |
| 并行worktree版本号冲突 | 并行ship场景 | gstack-next-version检测其他worktree已claim的版本号 |
| 并行sprint重复讨论已决定的架构 | 多sprint场景 | Cross-session decision memory（decisions.jsonl） |
| 文档与代码漂移 | skill维护 | SKILL.md从 .tmpl模板自动生成，CI检测过时文档 |
| context compaction后丢失工程状态 | 长时间session | Context Recovery块，preamble读取磁盘artifact恢复状态 |
| prompt injection通过浏览器攻击agent | 浏览器QA场景 | 6层防御：datamarking → ARIA regex → ML分类器 → canary → ensemble |
| 单个ML分类器误报率高（Stack Overflow内容） | 安全分类器 | Ensemble rule：BLOCK需要两个分类器一致，单高置信度降级为WARN |
| tunnel暴露完整命令面给远程caller | pair-agent场景 | Dual-listener tunnel，tunnel listener只服务允许列表端点 |

**模式：** 从单skill到并行工厂——gstack的演进主线是从单个浏览器工具（`/browse`、`/qa`），逐步扩展为覆盖完整sprint的23+ skills体系，核心驱动力是并行sprint场景带来的新约束（ELI16、detach、eval lock、decision memory）。

---

## 8. 能力边界

### 7.1擅长

- **全sprint覆盖**：从Think到Reflect的完整7阶段流程，23+ skills覆盖每个阶段
- **浏览器QA**：持久Chromium守护进程 + Ref系统 + prompt injection防御，agent有"眼睛"
- **跨模型审查**：`/codex` 获取OpenAI独立审查，跨模型分析显示重叠和独有发现
- **设计探索**：`/design-shotgun`（4-6个AI mockup变体 + 比较板）→ `/design-html`（生产质量HTML）
- **并行sprint**：Conductor 10-15并行 + ELI16 mode + gstack-detach + workspace-aware ship
- **持久记忆**：learnings.jsonl + decisions.jsonl + timeline.jsonl + GBrain语义搜索
- **多agent协调**：`/pair-agent` 跨agent共享浏览器，scoped tokens + tab隔离 + rate limiting
- **安全防御**：dual-listener tunnel + 6层prompt injection防御 + redaction guard
- **iOS QA**：`/ios-qa` 驱动真实iPhone（USB CoreDevice），`--tailnet` 暴露给远程agent

### 7.2不擅长

- **Spec演进追踪**：`/spec` 产出一次性spec文档，没有delta机制、没有source of truth、没有archive合并
- **Brownfield增量规格化**：没有"只文档化要改的部分"的能力——spec是全量的而非增量的
- **变更可审计**：没有change文件夹完整保留机制——artifact分散在多个路径
- **轻量入门**：23+ skills + 8 power tools + preamble + section文件，学习曲线陡峭
- **跨平台一致性**：虽然适配10个host，但浏览器能力（核心卖点）依赖Playwright + Bun，在某些平台（Windows）有已知问题
- **流程弹性**：sprint结构是强约束——Dashboard会显示缺失的审查，流程弹性有限

### 7.3演进特征

从README和CLAUDE.md可以看出gstack的演进特征：

1. **从单一skill到sprint流程**：最初可能只有 `/browse` 和 `/qa`，逐步扩展到23+ skills覆盖完整sprint
2. **从Claude-only到多平台**：最初只支持Claude Code，逐步适配Codex、Cursor、Factory等10个host
3. **从简单浏览器到安全浏览器**：从基本Playwright驱动到6层prompt injection防御 + dual-listener tunnel + domain skills
4. **从手动到自动化**：从手动运行每个skill到 `/autoplan` 自动化计划阶段 + Continuous Checkpoint自动commit
5. **从单sprint到并行sprint**：从单session到Conductor 10-15并行 + ELI16 mode + workspace-aware ship

---

## 9. 设计决策清单

以下是从源码分析中提取的gstack的核心设计决策：

| # | 设计决策 | 为什么这么做 | 之前出了什么问题 |
|---|---------|-------------|----------------|
| 1 | Sprint结构（Think→Plan→Build→Review→Test→Ship→Reflect） | "without a process, ten agents is ten sources of chaos" | 无流程时并行agent是混乱源，无法管理 |
| 2 | 链式传递通过文件系统持久化 | 跨session、跨sprint传递工程状态 | context window内传递在compaction后丢失 |
| 3 | SKILL.md从 .tmpl模板自动生成 | 文档与代码结构性一致 | 手写文档与代码漂移，命令变更后文档过时 |
| 4 | Preamble共享块（170行bash） | 每个skill继承相同基础设施 | 无共享块时每个skill重复实现升级检查/遥测/学习 |
| 5 | Boil the Ocean哲学 | "AI makes completeness cheap" | "Don't boil the ocean" 在AI时代变成借口语 |
| 6 | User Sovereignty覆盖所有规则 | "AI models recommend. Users decide." | AI自信地跳过用户验证，做出错误决策 |
| 7 | 跨模型审查（/codex） | 模型偏差消除——两个不同模型交叉验证 | 单模型审查有系统性盲区 |
| 8 | Continuous Checkpoint（WIP commit） | Crash恢复 + context切换 | session崩溃后工作进度和决策上下文丢失 |
| 9 | 持久浏览器守护进程 | 亚秒级延迟 + 持久状态 | 冷启动浏览器每次命令3-5s延迟，状态丢失 |
| 10 | Bun编译二进制 | 单一可执行文件，无需node_modules | Node.js项目需要用户管理node_modules和PATH |
| 11 | Ref系统（@e1, @e2） | 无DOM修改、无CSP冲突、无框架冲突 | DOM修改被CSP阻止或框架水合剥离 |
| 12 | Dual-listener tunnel architecture | 物理端口分离——tunnel caller无法访问local-only端点 | 单listener时tunnel暴露完整命令面 |
| 13 | 6层prompt injection防御 | sidebar agent暴露于敌对网页 | 无防御时agent被网页内容注入攻击 |
| 14 | Ensemble rule（2-of-3一致才BLOCK） | Stack Overflow误报缓解 | 单分类器高置信度误报率高 |
| 15 | ELI16 mode（3+ session时） | 用户在多窗口间切换时重新建立上下文 | 多session时用户忘记当前窗口的项目/分支/任务 |
| 16 | gstack-detach（SIGTERM-proof） | 长running任务逃逸process group SIGTERM | 普通background bash被process group信号杀死 |
| 17 | Machine-wide eval lock | 防止并行worktree rate-limit model API | 无lock时并行eval碰撞导致API rate-limit |
| 18 | Workspace-aware ship（版本冲突检测） | 并行worktree避免版本号冲突 | 无检测时多个worktree claim同一版本号 |
| 19 | Cross-session decision memory（decisions.jsonl） | 并行sprint不重新讨论已决定的架构 | 无记忆时不同sprint重复讨论同一架构决策 |
| 20 | GBrain持久知识库 | 跨session、跨机器的语义搜索 | 无知识库时每个session从零开始理解代码库 |
| 21 | Per-remote trust policy（read-write/read-only/deny） | 多客户顾问的知识隔离 | 无隔离时客户A的工作污染客户B的知识库 |
| 22 | AskUserQuestion格式（D<N> + ELI10 + Completeness） | 结构化决策brief，防止模糊提问 | 无格式规范时AI提问模糊、缺少推荐 |
| 23 | 5+ 选项split而非drop | "用户的选项集是神圣的" | 超过4个选项时丢弃低优先级选项 |
| 24 | Conductor prose fallback | Conductor AUQ不稳定，prose是可靠路径 | Conductor的native AUQ和MCP变体不稳定 |
| 25 | Confusion Protocol | 高风险模糊性时STOP | 无STOP机制时agent在模糊场景中盲目推进 |
| 26 | Autoplan自动化计划阶段 | 一条命令覆盖所有计划审查 | 用户忘记运行某个计划审查 |
| 27 | Review Readiness Dashboard | 链式传递状态可视化 | 无Dashboard时用户不知道哪些审查已运行 |
| 28 | Context Recovery（preamble读取artifact） | context compaction后恢复工程状态 | compaction后skill不知道之前的工程状态 |
| 29 | Domain Skills（per-site笔记） | agent随时间积累站点知识 | 每次访问同一站点都要重新发现其特性 |
| 30 | /spec五阶段（含强制代码阅读） | 不允许凭空设计 | 无代码阅读要求时spec脱离实际代码库 |
| 31 | Redaction Guard（HIGH/MEDIUM/LOW） | 捕获事故和粗心——99% 的情况 | 无guard时凭证和PII被推送到外部 |
| 32 | slop-scan AI代码质量检测 | "AI code quality, not AI code hiding" | 无检测时AI生成代码含空catch块等质量问题 |
| 33 | Search Before Building（三层知识） | "1000x engineer's first instinct: has someone solved this?" | 无搜索要求时agent从头设计已有解决方案的问题 |
| 34 | /pair-agent跨agent浏览器共享 | 不同vendor的AI agent通过共享浏览器协调 | 无共享机制时不同AI agent无法协作 |
| 35 | /ios-qa真实设备QA | 驱动真实iPhone over USB CoreDevice | 仅模拟器测试无法覆盖真实设备问题 |
| 36 | /design-shotgun视觉探索 | "show me options"而非用文字描述愿景 | 用文字描述视觉设计导致理解偏差 |
| 37 | /design-html生产质量HTML | Pretext计算文本布局——text reflows on resize | 标准AI生成HTML在resize时布局崩溃 |
| 38 | /document-release自动文档同步 | 读取每个doc文件，对照diff更新漂移的文档 | 手动更新文档遗漏或滞后于代码变更 |
| 39 | /retro团队回顾 | per-person breakdowns + shipping streaks + test health trends | 无回顾机制时团队无法从sprint中学习 |
| 40 | /learn记忆管理 | learnings compound across sessions——agent变聪明 | 无记忆时每个session从零开始，不积累经验 |

---

## 10. 总结

gstack的核心贡献不在于单个skill的设计（虽然许多skill设计精良），而在于：

1. **Sprint链式传递**：通过文件系统持久化artifact，实现了跨session、跨sprint的工程状态传递。每个skill的产出喂给下一个，Dashboard可视化流程状态。

2. **持久浏览器守护进程**：长驻Chromium + Ref系统 + 6层prompt injection防御，让agent拥有"眼睛"——这是gstack区别于所有其他项目的核心能力。

3. **并行sprint管理**：Conductor 10-15并行 + ELI16 mode + gstack-detach + workspace-aware ship + cross-session decision memory。流程是并行的基础——"without a process, ten agents is ten sources of chaos."

4. **设计哲学体系**：Boil the Ocean（完整是目标）、User Sovereignty（用户决策覆盖一切）、Search Before Building（三层知识）、跨模型审查（模型偏差消除）、Continuous Checkpoint（自动WIP commit）。这些不是口号，而是编码到了preamble、AskUserQuestion格式和skill工作流中。

5. **全栈覆盖**：从设计探索（`/design-shotgun`）到iOS QA（`/ios-qa`），从安全审计（`/cso`）到文档同步（`/document-release`），23+ skills覆盖完整工程团队的所有角色。

它的局限也很明确：缺乏spec演进追踪（没有delta机制和source of truth）、重量级（学习曲线陡峭）、流程弹性有限（sprint结构是强约束）。这些局限是"拥有完整流程"立场的必然结果——如果你拥有流程，就需要维护流程的每个环节。

gstack是五个项目中最接近"虚拟工程团队"愿景的。它的设计决策围绕一个核心信念：**AI时代，一个人可以做一个团队的事，但前提是工具链足够完整和自动化。** Boil the Ocean不是鼓励过度工程，而是指出"完整的边际成本接近零"这一新现实。

---

点击下方"**阅读原文**"进入我的演示网站。
