---
title: AI 研发流程深度解析（四）：ECC 深度拆解——Agent 素材大全
description: 一个覆盖 261+ skills、跨 7+ 平台的素材库，是如何组织和管理如此庞大的素材体系的？它选择不定义流程的考虑是什么？
tags:
  - 研发流程
  - ECC
  - Agent
  - 素材库
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> 一个覆盖 261+ skills、跨 7+ 平台的素材库，是如何组织和管理如此庞大的素材体系的？它选择不定义流程的考虑是什么？

---

## 1. 架构拆解

### 1.1 素材分类体系

ECC（Enterprise Claude Code）的自我定位是 **"the agent harness operating system"**——一个跨 harness 的 agent 操作系统。它的架构不是围绕一个工作流设计的，而是围绕**素材供给**设计的。

```
ECC/
├── skills/           # 261+ 工作流定义和领域知识（主工作面）
├── agents/           # 67 个专门化 subagent（委托执行）
├── commands/         # 94 个 slash command shim（迁移兼容层）
├── hooks/            # 事件驱动自动化（6 种 hook 类型）
├── rules/            # Always-follow 规则（按语言组织）
├── contexts/         # 动态 system prompt 注入（dev/review/research 模式）
├── scripts/          # 跨平台 Node.js 脚本
├── tests/            # 测试套件（997+ 个内部测试）
├── examples/         # 示例配置
├── mcp-configs/      # MCP 服务器配置
├── schemas/          # 数据 schema 定义
└── config/           # 配置文件
```

`README.md` 明确描述了素材分类——Skills 是"primary workflow surface"，Commands 是"legacy slash-entry compatibility during migration"，Agents 是"specialized subagents for delegation"。

ECC 的素材分为五层，每层有明确的职责边界：

| 层次 | 职责 | 触发方式 | 示例 |
|------|------|---------|------|
| **Skills** | 工作流定义和领域知识 | AI 自动检测或用户调用 | `tdd-workflow/`、`security-review/` |
| **Agents** | 专门化 subagent | 主 agent 委托 | `planner.md`、`code-reviewer.md` |
| **Commands** | Slash command 入口 | 用户输入 `/` | `/plan`、`/code-review` |
| **Hooks** | 事件驱动自动化 | 工具调用生命周期 | PreToolUse、PostToolUse、Stop |
| **Rules** | 始终遵循的规则 | 系统提示注入 | `coding-style.md`、`testing.md` |

**设计考虑：** 五层分离使得每层可以独立演化——Skills 可以从 Commands 迁移而不影响 Hooks，Rules 可以按语言选择性安装。但代价是用户需要理解五层之间的关系，新用户面临陡峭的学习曲线。

### 1.2 Frontmatter 体系

ECC 使用 YAML frontmatter 标注每个素材的元数据：

**Skill frontmatter:**
```yaml
---
name: continuous-learning-v2
description: Instinct-based learning system...
metadata:
  origin: ECC
version: 2.1.0
---
```

**Agent frontmatter:**
```yaml
---
name: planner
description: Expert planning specialist...
tools: ["Read", "Grep", "Glob"]
model: opus
---
```

`origin` 字段区分 `ECC`（第一方）和 `community`（社区贡献），使得素材来源可追溯。Agent 的 `tools` 字段实现了权限隔离——planner 只有 Read/Grep/Glob 权限，不能修改文件。`model` 字段指定 agent 使用的模型层级。

`RULES.md` 定义了素材格式规范——Agent 文件名必须与 name 一致、Skills 必须包含 "When to Use" 段落、Hooks 应使用具体的 matcher 而非通配符。

### 1.3 安装管线

ECC v1.9.0 引入了 **manifest-driven selective install** 架构：

```
用户表达需求 → npx ecc consult "security reviews" → 匹配组件
 install-plan.js 生成安装计划 → install-apply.js 执行安装
 SQLite 状态存储记录已安装组件 → 支持增量更新
```

**三种安装 Profile:**

| Profile | 内容 | 适用场景 |
|---------|------|---------|
| `minimal` | 核心 skills + rules，排除 hooks-runtime | 低 context / 不需要运行时强制 |
| `core` | 默认，平衡的质量 + 安全检查 | 大多数用户 |
| `full` | 全部组件 | 需要完整功能 |

**设计考虑：** Selective install 解决了 261+ skills 带来的"context window 污染"问题。`the-shortform-guide.md` 明确警告："你的 200k context window 在 compaction 前可能只有 70k——太多 tools 启用会导致性能显著下降。" 建议保持 < 10 个 MCP 启用、< 80 个 tools 活跃。

**取舍：** Selective install 给了用户精细控制，但增加了配置复杂度。用户需要知道"我需要哪些 skills"，这对新手不友好。`npx ecc consult` 命令试图缓解这个问题，但本质上 ECC 假设用户知道自己需要什么。

### 1.4 跨平台适配层

ECC 支持 Claude Code、Cursor、Codex (CLI + App)、OpenCode、Gemini、Zed、GitHub Copilot 等 7+ AI harness：

| Harness | 支持方式 |
|---------|---------|
| Claude Code | Plugin（`ecc@ecc`）或手动安装 |
| Cursor | 手动安装到 `~/.cursor/` |
| Codex (CLI + App) | `AGENTS.md` 适配 |
| OpenCode | 插件系统 |
| Gemini | 配置文件适配 |
| Zed | 配置文件适配 |
| GitHub Copilot | 配置文件适配 |

**跨平台实现策略：**

1. **所有 hooks 和 scripts 用 Node.js 重写**——不再依赖 bash，确保 Windows/macOS/Linux 行为一致
2. **Package manager 自动检测**——优先级：env var → project config → package.json → lock file → global config → fallback
3. **Agent data home 隔离**——`ECC_AGENT_DATA_HOME` 环境变量让不同 harness 的数据互不干扰

v1.8.0 将 ECC 重新定位为 "agent harness performance system, not just a config pack"。跨平台是 ECC 的核心优势之一——不绑定特定 AI 工具，用户可以自由选择。代价是维护成本——997+ 个内部测试反映了这个成本。

---

## 2. 素材组织哲学

### 2.1 "提供素材不定义流程"

ECC 的核心设计理念：提供 261+ skills、67 agents、94 commands，让用户自己组装工作流。没有强制流程、没有阶段门禁、没有工作流引擎。

`the-shortform-guide.md` 的描述最清楚：

> **"Skills are the primary workflow surface. They act like scoped workflow bundles: reusable prompts, structure, supporting files, and codemaps when you need a particular execution pattern."**

Skills 是"独立的、可复用的工作流包"，而不是"工作流的一个阶段"。

**设计考虑：** ECC 认为不同项目、不同团队、不同任务需要不同的工作流组合。强制一个固定流程会过重或过轻。提供素材让用户按需组装，比定义一个"one-size-fits-all"的流程更灵活。

**取舍：** 极大的灵活性带来了极大的发现成本——261+ skills 中找到合适的那个并不容易。ECC 的应对是：
1. Commands 作为 skills 的"slash 入口"（如 `/tdd` → `tdd-workflow` skill）
2. `npx ecc consult` 帮助发现匹配组件
3. Skills 目录按领域命名（如 `django-tdd`、`laravel-tdd`、`springboot-tdd`）

### 2.2 分类体系与检索

ECC 的 skills 目录按**领域**组织，而非按**工作流阶段**：

```
skills/
├── 框架/语言 patterns:  django-patterns/, laravel-patterns/, springboot-patterns/, golang-patterns/, ...
├── 测试:               tdd-workflow/, django-tdd/, laravel-tdd/, quarkus-tdd/, verification-loop/, ...
├── 安全:               security-review/, security-scan/, defi-amm-security/, ...
├── 基础设施:            docker-patterns/, kubernetes-patterns/, deployment-patterns/, ...
├── 学习:               continuous-learning-v2/, agent-self-evaluation/, eval-harness/, ...
├── 编排:               orch-add-feature/, orch-pipeline/, plan-orchestrate/, team-agent-orchestration/, ...
├── 前端:               frontend-patterns/, react-patterns/, vue-patterns/, frontend-a11y/, ...
└── 领域专用:            healthcare-phi-compliance/, hipaa-compliance/, nutrient-document-processing/, ...
```

**设计考虑：** 按领域组织而非按工作流阶段组织，反映了 ECC 的"素材库"定位——用户按"我在做什么"（如 Django 开发）检索，而非按"我在哪个阶段"（如 spec 阶段）检索。

**取舍：** 按领域组织方便领域内检索（Django 开发者找 `django-*` 即可），但不利于跨领域的工作流理解。用户想知道"如何做 code review"时，需要找到 `skills/security-review/`（安全审查）、`agents/code-reviewer.md`（审查 agent）、`commands/code-review.md`（slash 入口）三个地方。

### 2.3 Selective Install 的多维度控制

Selective install 是 ECC 管理素材规模的核心机制：

| 维度 | 选项 | 示例 |
|------|------|------|
| Profile | minimal / core / full | `--profile minimal` |
| Target harness | claude / cursor / codex / opencode | `--target claude` |
| Capability | 机器学习 / 安全 / 前端 / ... | `--with capability:machine-learning` |
| Module | hooks-runtime / specific skill | `--modules hooks-runtime` |
| Without | 排除特定模块 | `--without baseline:hooks` |

**状态存储：** SQLite 状态存储跟踪已安装组件，支持：
- `node scripts/ecc.js list-installed`——查看已安装
- `node scripts/ecc.js doctor`——诊断问题
- `node scripts/ecc.js repair`——修复安装
- `node scripts/ecc.js uninstall --dry-run`——预览卸载

**设计考虑：** Selective install 让 ECC 可以从"全量素材库"降维到"项目实际需要的子集"——ECC 假设不同项目需要不同的素材组合。

---

## 3. Hooks 自动化体系

### 3.1 六种 Hook 类型

ECC 的 hooks 体系覆盖了 Claude Code 的全部 hook 生命周期（`hooks/README.md`）：

| Hook 类型 | 触发时机 | 能力 | ECC 用途 |
|-----------|---------|------|---------|
| **PreToolUse** | 工具执行前 | 可阻断（exit 2）或警告（stderr） | dev server 阻断、tmux 提醒、git push 提醒、pre-commit 质量检查、文档文件警告、strategic compact |
| **PostToolUse** | 工具执行后 | 分析输出但不可阻断 | PR logger、build analysis、quality gate、design quality check、prettier format、TypeScript check、console.log 警告 |
| **UserPromptSubmit** | 用户发送消息时 | — | 上下文注入 |
| **Stop** | Claude 完成响应时 | — | console.log audit、session summary、pattern extraction、cost tracker、desktop notify |
| **PreCompact** | context compaction 前 | 保存状态 | 状态保存 |
| **SessionStart/SessionEnd** | 会话生命周期 | — | 加载上下文、检测 package manager、清理日志 |

**关键文件：** `hooks/hooks.json` 定义了所有 hook 的 matcher 和 command。`hooks/memory-persistence/` 定义了会话生命周期的状态保存逻辑。

### 3.2 与 Skills 的配合：确定性 + 概率性双层保障

ECC 的 hooks 和 skills 形成了**确定性 + 概率性**的双层保障：

```
Hooks（确定性，100% 触发）
  ├── PreToolUse: 阻断不安全操作（dev server 不在 tmux 中 → block）
  ├── PostToolUse: 自动格式化（Edit .ts → prettier + tsc）
  └── Stop: 会话状态保存、模式提取
           ↓
Skills（概率性，AI 判断触发）
  ├── tdd-workflow: AI 判断是否需要 TDD 流程
  ├── security-review: AI 判断是否需要安全审查
  └── verification-loop: AI 判断是否需要验证
```

**关键设计：** Continuous Learning v2 的文档明确解释了为什么用 hooks 而非 skills 来做观察（`skills/continuous-learning-v2/SKILL.md`）：

> **"v1 relied on skills to observe. Skills are probabilistic — they fire ~50-80% of the time based on Claude's judgment."**
> **"Hooks fire 100% of the time, deterministically."**

**取舍：** Hooks 是确定性的但能力有限（只能基于 matcher 和 exit code），Skills 是灵活的但触发不可靠。ECC 的策略是用 hooks 做必须保证的事情（安全检查、格式化、状态保存），用 skills 做需要判断的事情（TDD 流程、code review、验证）。

### 3.3 Delivery Gate：机械化的质量门禁

`skills/delivery-gate/SKILL.md` 是一个独特的 Stop hook——它在 Claude 尝试结束会话时执行**确定性检查**：

| 检查项 | 机制 | 触发条件 |
|--------|------|---------|
| Rationalization 模式 | 正则匹配 transcript 尾部 | "skip tests for now"、"pre-existing bug" → 警告（不阻断） |
| 过期的学习库 | 文件 mtime 检查 5 个路径 | >=3 个过期 + 复杂任务 → 阻断 |
| 磁盘空间 < 50GB | `shutil.disk_usage` | 警告 |
| 磁盘空间 < 15GB | `shutil.disk_usage` | 阻断 |

**设计考虑：** Delivery Gate 的设计哲学是"mechanical gates check machine-verifiable facts"——机械门禁检查机器可验证的事实，而非依赖 AI 推理。实现方式是通过 hook 的 exit code 进行确定性阻断。AI 推理的质量检查不可靠，因为 AI 可能 rationalize 跳过检查；但 regex 匹配和文件 mtime 检查不会"自我说服"。

### 3.4 运行时控制

ECC 提供了精细的 hook 运行时控制（`README.md`）：

```bash
# 严格度 profile
export ECC_HOOK_PROFILE=minimal|standard|strict

# 禁用特定 hook
export ECC_DISABLED_HOOKS="pre:bash:tmux-reminder,post:edit:typecheck"

# SessionStart context 限制
export ECC_SESSION_START_MAX_CHARS=4000
export ECC_SESSION_START_CONTEXT=off

# Continuous Learning 控制
export ECC_MAX_INJECTED_INSTINCTS=6
export ECC_INSTINCT_CONFIDENCE_THRESHOLD=0.7
```

**设计考虑：** 运行时控制让用户在不修改 `hooks.json` 的情况下调整 hook 行为。`minimal` profile 只保留核心安全 hook，`strict` 启用所有提醒和更严格的 guardrails。这意味着同一个 ECC 安装可以适应不同的使用场景——从快速原型开发（minimal）到严格的生产环境（strict）。

---

## 4. Continuous Learning v2

### 4.1 Instinct 模型

Continuous Learning v2 是 ECC 最独特的设计——一个从会话中自动学习并形成可复用知识的系统（`skills/continuous-learning-v2/SKILL.md`）。

**Instinct 是一个原子级的学习行为：**

```yaml
---
id: prefer-functional-style
trigger: "when writing new functions"
confidence: 0.7
domain: "code-style"
source: "session-observation"
scope: project
project_id: "a1b2c3d4e5f6"
project_name: "my-react-app"
---

# Prefer Functional Style

## Action
Use functional patterns over classes when appropriate.

## Evidence
- Observed 5 instances of functional pattern preference
- User corrected class-based approach to functional on 2025-01-15
```

**核心属性：**
- **Atomic**——一个 trigger，一个 action
- **Confidence-weighted**——0.3（试探性）到 0.9（近确定）
- **Domain-tagged**——code-style、testing、git、debugging、workflow 等
- **Evidence-backed**——记录观察来源
- **Scope-aware**——project（默认）或 global

### 4.2 学习管线

```
会话活动（在 git repo 中）
    │
    │ Hooks 捕获 prompts + tool use（100% 可靠）
    │ + 检测项目上下文（git remote / repo path）
    ▼
observations.jsonl（prompts, tool calls, outcomes, project）
    │
    │ Observer agent 读取（后台，Haiku 模型）
    ▼
模式检测
    ├── 用户纠正 → instinct
    ├── 错误解决 → instinct
    ├── 重复工作流 → instinct
    └── scope 决策：project 还是 global？
    │
    │ 创建/更新
    ▼
instincts/personal/（project 或 global）
    │
    │ /evolve 聚类 + /promote 提升
    ▼
evolved/（skills/commands/agents）
```

**设计考虑：** 学习管线的关键设计是**观察和提取分离**——hooks 只负责捕获原始数据（100% 可靠），模式检测由后台 Haiku agent 完成（不影响主 session 性能）。`/evolve` 命令将成熟的 instincts 聚类为更高层级的 skills/commands/agents，这是人工触发而非自动的——ECC 认为从 instincts 到 skills 的提升需要人类判断。

### 4.3 v1 → v2 → v2.1 的演进

| 特性 | v1 | v2 | v2.1 |
|------|----|----|------|
| 观察 | Stop hook（会话结束时） | PreToolUse/PostToolUse（100% 可靠） | 同 v2 + 项目检测 |
| 分析 | 主 context | 后台 agent（Haiku） | 同 v2 |
| 粒度 | 完整 skills | 原子 instincts | 同 v2 + project scope |
| 置信度 | 无 | 0.3-0.9 加权 | 同 v2 + 提升机制 |
| 演化 | 直接生成 skill | instincts → 聚类 → skill/command/agent | 同 v2 + project → global 提升 |
| 共享 | 无 | 导出/导入 instincts | 同 v2 + 项目隔离 |
| 跨项目 | 污染风险 | 污染风险 | 默认隔离 + 自动提升 |

**关键设计决策：**

1. **从 Stop hook 到 PreToolUse/PostToolUse**——v1 依赖 Stop hook 在会话结束时提取模式，但 skills 是概率性触发的（50-80%）。v2 改用 hooks，100% 可靠。

2. **从完整 skills 到原子 instincts**——v1 直接生成完整 skills，粒度太粗。v2 先生成原子级 instincts（一个 trigger + 一个 action），再通过 `/evolve` 聚类成 skills。

3. **v2.1 的 project-scoped instincts**——React patterns 留在 React 项目，Python conventions 留在 Python 项目。当同一 instinct 在 2+ 个项目中出现且平均置信度 >= 0.8 时，自动提升为 global。

### 4.4 置信度演化

| 分数 | 含义 | 行为 |
|------|------|------|
| 0.3 | 试探性 | 建议但不强制 |
| 0.5 | 适度 | 相关时应用 |
| 0.7 | 强 | 自动批准应用 |
| 0.9 | 近确定 | 核心行为 |

**置信度增加：** 模式被重复观察、用户未纠正、其他来源的类似 instinct 一致。

**置信度降低：** 用户明确纠正、长时间未观察、出现矛盾证据。

**设计考虑：** 置信度模型让 ECC 的学习是渐进的——新模式先以 0.3 的置信度存在，只有被反复验证后才会成为核心行为。这避免了"一次误判成为永久规则"的问题。

**取舍：** 整个系统默认 `observer.enabled: false`——需要用户手动开启。这反映了 ECC 对自动学习的谨慎态度：自动写入行为可能引入错误的"学习"。代价是大多数用户可能永远不会开启这个功能。

---

## 5. Orchestration 体系

### 5.1 orch-* 操作族

虽然 ECC 不定义流程，但它提供了一个**可选的**编排体系——`orch-*` skill family（`skills/orch-pipeline/SKILL.md`）：

| Skill | 操作 | 触发条件 | 第一步 |
|-------|------|---------|--------|
| `orch-add-feature` | feature | 能力不存在 | research + plan 新切片 |
| `orch-change-feature` | tweak | 能工作但行为需要调整 | 修改现有行为及其测试 |
| `orch-fix-defect` | fix | 坏了，行为不对 | 重现为失败测试，然后修复 |
| `orch-refine-code` | refactor | 行为不变，结构改进 | 重构同时保持测试绿色 |
| `orch-build-mvp` | mvp | 从设计/spec 文档引导 | 读取文档 → 垂直切片 |

**关键设计：** `orch-pipeline/SKILL.md` 是共享引擎，5 个操作 skill 是"thin wrappers"——它们不重新实现工作，只是分类请求、选择哪些 phase 运行、委托给已有的 ECC agent 或 command。

### 5.2 共享管线

```
Phase 0: Intake（重述请求）
    │
    ▼
Phase 1: Research & Reuse（gh search repos/code → Context7 → package registries → Exa）
    │
    ▼
Phase 2: Plan（委托 planner agent → 输出 task_list）
    │
    ▼
★ GATE 1 — 用户审批计划 ★
    │
    ▼
Phase 3: Scaffold（仅 orch-build-mvp）
    │
    ▼
Phase 4: Implement (TDD)（tdd-guide agent: red → green → refactor）
    │
    ▼
Phase 5: Review（code-reviewer agent + security-reviewer 如果触发安全条件）
    │
    ▼
★ GATE 2 — 用户审批提交 ★
    │
    ▼
Phase 6: Commit（conventional commits，一个逻辑块一个提交）
```

`skills/orch-pipeline/SKILL.md` 明确定义了"two gates"——GATE 1 在 Plan 后（不写实现代码直到用户批准），GATE 2 在 Commit 前（不提交直到用户确认）。两个 gate 之间的一切流式执行。

### 5.3 Size Classifier：仪式与影响范围匹配

| Tier | Files touched | New dep/contract | Design ambiguity | Phases that run |
|------|--------------|-----------------|-----------------|----------------|
| trivial | 1, a few lines | none | none | 4 → 5 → 6 |
| small | 1 file/func | none | clear once read | (1 light) → 4 → 5 → 6 |
| standard | 2-5 files | maybe new module | one real choice | 1 → 2 → 4 → 5 → 6 |
| large | many/cross | new ext dep/API | multiple Qs | 1 → 2 → (3) → 4 → 5 → 6 |

**设计考虑：** "Ceremony scales to blast radius"——仪式与影响范围匹配。trivial 变更跳过 research 和 plan，直接 TDD + review + commit。large 变更走完整管线。

**取舍：** Size classifier 是 ECC 中最接近"工作流设计"的东西。但它仍然是可选的——用户可以不使用 `orch-*` 而直接调用单个 skills。

### 5.4 Agent/Command Map

orch-* pipeline 的每个 phase 委托给已有的 ECC agent 或 command：

| Phase | Primary | Fallback/Escalation |
|-------|---------|---------------------|
| Intake | `code-explorer` | — |
| Plan | `planner` | `architect`、`code-architect` |
| Implement | `tdd-guide` (or `tdd-workflow` skill) | `build-error-resolver` / `/build-fix` |
| Review | `code-reviewer` / `/code-review` | 语言专用 reviewer (`python-reviewer`, `typescript-reviewer`, ...) |
| Security | `security-reviewer` | — |
| MVP inner loop | `/gan-build` | drives `gan-generator` → `gan-evaluator` |

**设计考虑：** orch-* 是"composer"而非"implementer"——它组合已有的素材，不重新实现。这保持了 ECC "提供素材不定义流程"的哲学：orch-* 是一个**可选的**组合方式，用户也可以自己组合。

### 5.5 Observer Loop Prevention

v1.9.0 引入了确定性的 harness audit scoring（`README.md` changelog）：

> "Harness audit scoring made deterministic, orchestration status and launcher compatibility hardened, observer loop prevention with 5-layer guard."

**设计考虑：** Orchestrator 需要防止 observer loop——orchestrator 启动的 subagent 不应该再触发 orchestrator。5-layer guard 确保编排层级不无限递归。这是一个典型的递归终止条件设计——没有它，orchestrator 会不断 spawn subagent，每个 subagent 又触发 orchestrator，最终耗尽资源。

---

## 6. 其他关键 Skills

### 6.1 Intent-Driven Development

`skills/intent-driven-development/SKILL.md` 是 ECC 的需求澄清方法论——将模糊的产品/工程变更转化为可验证的验收标准。

**两种深度：**
- **Quick Capture**：3-7 个验收标准，低/中风险
- **Full Acceptance Brief**：安全/数据/迁移/跨系统变更，完整模板

**关键设计：**
1. **先检查上下文**——读仓库、文档、schema、测试基础设施，能从代码推断的不问用户
2. **只问不能推断的问题**——产品/业务约束不能从代码推断（business rules, compliance, SLAs, pricing, retention policy）
3. **可观察的验收标准**——每个 AC-NNN 描述起始条件、触发、预期结果、禁止的副作用、验证方法、优先级
4. **不默认阻断实现**——足够清晰的请求记录标准后继续，只在阻塞风险时等待确认

**设计取舍：** ECC 的 intent-driven-development 走的是轻量路线——不强制 Socratic 对话，不设 HARD-GATE，不要求分段确认。它更像"记录够用的验收标准然后继续"。

### 6.2 Search-First

`skills/search-first/SKILL.md` 系统化了"先搜索再编码"的工作流：

```
Need Analysis → Parallel Search (npm/PyPI + MCP + GitHub) → Evaluate → Decide (Adopt/Extend/Build) → Implement
```

**设计考虑：** "Research-before-coding" 不是新概念，但 ECC 将其系统化为一个 skill，提供了搜索渠道、评估标准（functionality, maintenance, community, docs, license, deps）和决策矩阵（exact match → Adopt, partial → Extend, nothing → Build）。

### 6.3 Agent Self-Evaluation

`skills/agent-self-evaluation/SKILL.md` 让 AI 在完成非平凡任务后自我评分：

**5 个评估轴：**

| 轴 | 问题 | 捕获什么 |
|----|------|---------|
| Accuracy | 事实/声明/输出正确吗？ | 幻觉、错误 API 名、错误语法 |
| Completeness | 覆盖了用户要求的一切吗？ | 遗漏的 edge case、未处理的错误路径 |
| Clarity | 解释可理解且结构良好吗？ | 混乱的解释、未定义的术语 |
| Actionability | 用户能立即行动吗？ | 模糊建议、缺失步骤 |
| Conciseness | 用了最少的词/token 吗？ | 冗余、过度解释 |

**关键规则：** "Every score below 5 MUST cite specific evidence"——不能只说"可以更好"，必须说具体缺了什么。Anti-pattern "Everything is a 5" 被明确禁止。这解决了 AI 自评倾向于"一切正常"的问题——强制要求低分项必须引用证据，使得自评不是走过场。

---

## 7. 演进中的关键教训

| 教训 | 来源 | 修复 |
|------|------|------|
| Skills 概率性触发（50-80%）导致观察数据不可靠 | CL v1 | 改用 PreToolUse/PostToolUse hooks（100% 可靠）捕获会话活动 |
| 完整 skill 粒度太粗，一次误判成为永久规则 | CL v1 | 引入原子级 instinct + 置信度评分（0.3-0.9），渐进学习 |
| 跨项目学习污染——React patterns 被误用于 Python 项目 | CL v2 | v2.1 引入 project-scoped instincts，默认隔离 + 自动提升机制 |
| 261+ skills 全量安装导致 context window 污染 | v1.9.0 | manifest-driven selective install，3 种 Profile + 多维度安装 |
| 平台方言限制了可移植性 | v1.8.0 | 所有 hooks/scripts 用 Node.js 重写，跨平台行为一致 |
| Observer 自动写入行为可能引入错误的"学习" | CL v2 设计 | 默认 `observer.enabled: false`，需用户手动开启 |
| orch-* 编排器启动的 subagent 不应再触发编排器 | v1.9.0 | 5-layer guard 防止 observer loop 无限递归 |

**模式：** 从概率到确定——ECC 的演进主线是从依赖 skills 的概率性触发，逐步迁移到依赖 hooks 的确定性执行，同时保持 skills 作为需要判断力的工作流载体。这个模式贯穿了 Continuous Learning 的 v1→v2→v2.1 演进，也影响了 Delivery Gate 的设计（用 regex/mtime 而非 AI 推理）。

---

## 8. 能力边界

### 8.1 不提供 Spec 模型

ECC 没有结构化的 spec 模型——没有 Requirement/Scenario、没有 RFC 2119 关键字、没有 Delta 机制、没有 source of truth。

**最接近的东西：**
- `intent-driven-development` 的 Acceptance Brief（AC-NNN 格式）
- `planner` agent 的 Implementation Plan（Phase + Step 格式）
- `tdd-workflow` 的 User Journeys

但这些都不是持久化的 source of truth——它们是一次性的工作产物，不持续演进。

### 8.2 不提供变更追踪

ECC 没有 change/delta 的概念——没有 `changes/` 目录、没有 archive 机制、没有审计链。代码变更的历史完全依赖 git。

### 8.3 不强制执行流程

即使用 `orch-*` pipeline，两个 GATE 也是"gated, not autonomous"——需要用户审批。但 `orch-*` 本身是可选的，用户可以完全不用它。

ECC 没有行为约束机制：
- 没有 Iron Law
- 没有 Rationalization 表（虽然 Delivery Gate 检测 rationalization 模式，但只是警告）
- 没有 HARD-GATE（hook 的 block 是安全级别的，不是流程级别的）
- 没有 SUBAGENT-STOP

### 8.4 规模带来的发现成本

261+ skills 是 ECC 的优势也是劣势：
- **优势：** 几乎覆盖了所有主流语言和框架的场景
- **劣势：** 用户发现"我需要哪个 skill"的成本很高

ECC 的应对策略：
1. Commands 作为 skills 的 slash 入口
2. `npx ecc consult` 智能匹配
3. Selective install 按需安装
4. Skills 目录按领域命名

### 8.5 跨平台维护成本

7+ 个 AI harness 的适配意味着：
- 每个 hook 变更需要跨平台测试
- 每个 agent 定义需要适配不同 harness 的格式
- 997+ 个内部测试反映维护成本
- Plugin 系统的限制（如 Claude Code plugin 不能分发 rules）需要 workaround

### 8.6 Continuous Learning 的实际效果未验证

Continuous Learning v2 的设计很精巧，但：
- Observer 默认关闭（`observer.enabled: false`）
- 需要后台 Haiku agent 运行（成本）
- Instinct 质量依赖观察质量（garbage in, garbage out）
- 没有公开的 eval 数据证明学习效果

---

## 9. 设计决策清单

| # | 设计决策 | 为什么这么做 | 之前出了什么问题 |
|---|---------|-------------|----------------|
| 1 | 素材五层分离（skills/agents/commands/hooks/rules） | 每层可独立演化、独立安装 | 单一目录结构导致职责边界模糊，迁移困难 |
| 2 | "提供素材不定义流程" | 不同项目/团队/任务需要不同工作流组合 | 强制流程对某些项目过重，对另一些过轻 |
| 3 | Skills 为 primary surface，Commands 为 legacy shim | 持久逻辑应在 skills 中 | 迁移期间两套入口共存可能混淆 |
| 4 | Selective install（manifest-driven） | 261+ skills 全量安装会污染 context window | 用户不知道需要哪些 skills，配置复杂度高 |
| 5 | 跨平台 Node.js 重写所有 hooks/scripts | Windows/macOS/Linux 行为一致 | bash 脚本在 Windows 上不可用 |
| 6 | Agent 的 tools 权限隔离 | 最小权限原则（planner 只有 Read/Grep/Glob） | 无权限隔离时 agent 可能意外修改文件 |
| 7 | Hooks（确定性）+ Skills（概率性）双层保障 | 必须保证的用 hooks，需要判断的用 skills | 单靠 skills 触发率只有 50-80% |
| 8 | Continuous Learning v2 用 PreToolUse/PostToolUse | Hooks 100% 可靠 vs Skills 50-80% | CL v1 依赖 Stop hook，概率性触发导致观察数据不可靠 |
| 9 | Instinct 原子级 + 置信度评分 | 渐进学习，避免"一次误判成为永久规则" | CL v1 直接生成完整 skills，粒度太粗 |
| 10 | v2.1 project-scoped instincts | React patterns 留在 React 项目，避免跨项目污染 | CL v2 无 scope 隔离，跨项目学习相互污染 |
| 11 | orch-* pipeline 可选 | 保持"不定义流程"哲学的同时提供组合方式 | 用户可能不知道 orch-* 的存在 |
| 12 | Size classifier（trivial/small/standard/large） | Ceremony scales to blast radius | 一刀切流程对 trivial 变更过重 |
| 13 | Two gates（Plan 后 + Commit 前） | "Gated, not autonomous"——人在关键决策点介入 | 无 gate 时 agent 可能自主提交不合适的变更 |
| 14 | Delivery Gate 用确定性检查（regex/mtime/disk） | 机械门禁检查机器可验证的事实，不依赖 AI 推理 | 依赖 AI 推理的质量检查不可靠 |
| 15 | Agent Self-Evaluation 5 轴评分 | 结构化反思捕获遗漏、标记过度自信 | 无结构化反思时 agent 自评倾向于"一切正常" |
| 16 | intent-driven-development 不默认阻断 | 够用的验收标准记录后继续实现 | 无 AC 记录时实现偏离意图 |
| 17 | 7+ harness 跨平台适配 | 不绑定特定 AI 工具，用户选择自由 | 每个新功能需跨平台测试，维护成本线性增长 |
| 18 | origin 字段区分 ECC/community | 素材来源可追溯 | 无来源标记时社区贡献质量不可控 |
| 19 | Rules 按语言组织（common/typescript/python/golang/...） | 选择性安装，只加载相关语言的规则 | 跨语言项目需要安装多个 rules 目录 |
| 20 | Observer loop prevention（5-layer guard） | orchestrator 启动的 subagent 不应再触发 orchestrator | 无 guard 时编排层级无限递归 |
