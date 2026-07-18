---
title: AI研发流程深度解析（四）：ECC深度拆解——Agent素材大全
description: 一个覆盖261+ skills、跨7+ 平台的素材库，是如何组织和管理如此庞大的素材体系的？它选择不定义流程的考虑是什么？
tags:
  - 研发流程
  - ECC
  - Agent
  - 素材库
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> 一个覆盖261+ skills、跨7+ 平台的素材库，是如何组织和管理如此庞大的素材体系的？它选择不定义流程的考虑是什么？

---

![AI研发流程深度解析（四）：ECC深度拆解——Agent素材大全](/images/dev-process/dev-process-04-ecc-deep-dive.png)

## 1. 架构拆解

### 1.1素材分类体系

ECC（Enterprise Claude Code）的自我定位是 **"the agent harness operating system"**——一个跨harness的agent操作系统。它的架构不是围绕一个工作流设计的，而是围绕**素材供给**设计的。

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

`README.md` 明确描述了素材分类——Skills是"primary workflow surface"，Commands是"legacy slash-entry compatibility during migration"，Agents是"specialized subagents for delegation"。

ECC的素材分为五层，每层有明确的职责边界：

| 层次 | 职责 | 触发方式 | 示例 |
|------|------|---------|------|
| **Skills** | 工作流定义和领域知识 | AI自动检测或用户调用 | `tdd-workflow/`、`security-review/` |
| **Agents** | 专门化subagent | 主agent委托 | `planner.md`、`code-reviewer.md` |
| **Commands** | Slash command入口 | 用户输入 `/` | `/plan`、`/code-review` |
| **Hooks** | 事件驱动自动化 | 工具调用生命周期 | PreToolUse、PostToolUse、Stop |
| **Rules** | 始终遵循的规则 | 系统提示注入 | `coding-style.md`、`testing.md` |

**设计考虑：** 五层分离使得每层可以独立演化——Skills可以从Commands迁移而不影响Hooks，Rules可以按语言选择性安装。但代价是用户需要理解五层之间的关系，新用户面临陡峭的学习曲线。

### 1.2 Frontmatter体系

ECC使用YAML frontmatter标注每个素材的元数据：

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

`origin` 字段区分 `ECC`（第一方）和 `community`（社区贡献），使得素材来源可追溯。Agent的 `tools` 字段实现了权限隔离——planner只有Read/Grep/Glob权限，不能修改文件。`model` 字段指定agent使用的模型层级。

`RULES.md` 定义了素材格式规范——Agent文件名必须与name一致、Skills必须包含 "When to Use" 段落、Hooks应使用具体的matcher而非通配符。

### 1.3安装管线

ECC v1.9.0引入了 **manifest-driven selective install** 架构：

```
用户表达需求 → npx ecc consult "security reviews" → 匹配组件
 install-plan.js 生成安装计划 → install-apply.js 执行安装
 SQLite 状态存储记录已安装组件 → 支持增量更新
```

**三种安装Profile:**

| Profile | 内容 | 适用场景 |
|---------|------|---------|
| `minimal` | 核心skills + rules，排除hooks-runtime | 低context / 不需要运行时强制 |
| `core` | 默认，平衡的质量 + 安全检查 | 大多数用户 |
| `full` | 全部组件 | 需要完整功能 |

**设计考虑：** Selective install解决了261+ skills带来的"context window污染"问题。`the-shortform-guide.md` 明确警告："你的200k context window在compaction前可能只有70k——太多tools启用会导致性能显著下降。" 建议保持 < 10个MCP启用、< 80个tools活跃。

**取舍：** Selective install给了用户精细控制，但增加了配置复杂度。用户需要知道"我需要哪些skills"，这对新手不友好。`npx ecc consult` 命令试图缓解这个问题，但本质上ECC假设用户知道自己需要什么。

### 1.4跨平台适配层

ECC支持Claude Code、Cursor、Codex (CLI + App)、OpenCode、Gemini、Zed、GitHub Copilot等7+ AI harness：

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

1. **所有hooks和scripts用Node.js重写**——不再依赖bash，确保Windows/macOS/Linux行为一致
2. **Package manager自动检测**——优先级：env var → project config → package.json → lock file → global config → fallback
3. **Agent data home隔离**——`ECC_AGENT_DATA_HOME` 环境变量让不同harness的数据互不干扰

v1.8.0将ECC重新定位为 "agent harness performance system, not just a config pack"。跨平台是ECC的核心优势之一——不绑定特定AI工具，用户可以自由选择。代价是维护成本——997+ 个内部测试反映了这个成本。

---

## 2. 素材组织哲学

### 2.1 "提供素材不定义流程"

ECC的核心设计理念：提供261+ skills、67 agents、94 commands，让用户自己组装工作流。没有强制流程、没有阶段门禁、没有工作流引擎。

`the-shortform-guide.md` 的描述最清楚：

> **"Skills are the primary workflow surface. They act like scoped workflow bundles: reusable prompts, structure, supporting files, and codemaps when you need a particular execution pattern."**

Skills是"独立的、可复用的工作流包"，而不是"工作流的一个阶段"。

**设计考虑：** ECC认为不同项目、不同团队、不同任务需要不同的工作流组合。强制一个固定流程会过重或过轻。提供素材让用户按需组装，比定义一个"one-size-fits-all"的流程更灵活。

**取舍：** 极大的灵活性带来了极大的发现成本——261+ skills中找到合适的那个并不容易。ECC的应对是：
1. Commands作为skills的"slash入口"（如 `/tdd` → `tdd-workflow` skill）
2. `npx ecc consult` 帮助发现匹配组件
3. Skills目录按领域命名（如 `django-tdd`、`laravel-tdd`、`springboot-tdd`）

### 2.2分类体系与检索

ECC的skills目录按**领域**组织，而非按**工作流阶段**：

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

**设计考虑：** 按领域组织而非按工作流阶段组织，反映了ECC的"素材库"定位——用户按"我在做什么"（如Django开发）检索，而非按"我在哪个阶段"（如spec阶段）检索。

**取舍：** 按领域组织方便领域内检索（Django开发者找 `django-*` 即可），但不利于跨领域的工作流理解。用户想知道"如何做code review"时，需要找到 `skills/security-review/`（安全审查）、`agents/code-reviewer.md`（审查agent）、`commands/code-review.md`（slash入口）三个地方。

### 2.3 Selective Install的多维度控制

Selective install是ECC管理素材规模的核心机制：

| 维度 | 选项 | 示例 |
|------|------|------|
| Profile | minimal / core / full | `--profile minimal` |
| Target harness | claude / cursor / codex / opencode | `--target claude` |
| Capability | 机器学习 / 安全 / 前端 / ... | `--with capability:machine-learning` |
| Module | hooks-runtime / specific skill | `--modules hooks-runtime` |
| Without | 排除特定模块 | `--without baseline:hooks` |

**状态存储：** SQLite状态存储跟踪已安装组件，支持：
- `node scripts/ecc.js list-installed`——查看已安装
- `node scripts/ecc.js doctor`——诊断问题
- `node scripts/ecc.js repair`——修复安装
- `node scripts/ecc.js uninstall --dry-run`——预览卸载

**设计考虑：** Selective install让ECC可以从"全量素材库"降维到"项目实际需要的子集"——ECC假设不同项目需要不同的素材组合。

---

## 3. Hooks自动化体系

### 3.1六种Hook类型

ECC的hooks体系覆盖了Claude Code的全部hook生命周期（`hooks/README.md`）：

| Hook类型 | 触发时机 | 能力 | ECC用途 |
|-----------|---------|------|---------|
| **PreToolUse** | 工具执行前 | 可阻断（exit 2）或警告（stderr） | dev server阻断、tmux提醒、git push提醒、pre-commit质量检查、文档文件警告、strategic compact |
| **PostToolUse** | 工具执行后 | 分析输出但不可阻断 | PR logger、build analysis、quality gate、design quality check、prettier format、TypeScript check、console.log警告 |
| **UserPromptSubmit** | 用户发送消息时 | — | 上下文注入 |
| **Stop** | Claude完成响应时 | — | console.log audit、session summary、pattern extraction、cost tracker、desktop notify |
| **PreCompact** | context compaction前 | 保存状态 | 状态保存 |
| **SessionStart/SessionEnd** | 会话生命周期 | — | 加载上下文、检测package manager、清理日志 |

**关键文件：** `hooks/hooks.json` 定义了所有hook的matcher和command。`hooks/memory-persistence/` 定义了会话生命周期的状态保存逻辑。

### 3.2与Skills的配合：确定性 + 概率性双层保障

ECC的hooks和skills形成了**确定性 + 概率性**的双层保障：

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

**关键设计：** Continuous Learning v2的文档明确解释了为什么用hooks而非skills来做观察（`skills/continuous-learning-v2/SKILL.md`）：

> **"v1 relied on skills to observe. Skills are probabilistic — they fire ~50-80% of the time based on Claude's judgment."**
> **"Hooks fire 100% of the time, deterministically."**

**取舍：** Hooks是确定性的但能力有限（只能基于matcher和exit code），Skills是灵活的但触发不可靠。ECC的策略是用hooks做必须保证的事情（安全检查、格式化、状态保存），用skills做需要判断的事情（TDD流程、code review、验证）。

### 3.3 Delivery Gate：机械化的质量门禁

`skills/delivery-gate/SKILL.md` 是一个独特的Stop hook——它在Claude尝试结束会话时执行**确定性检查**：

| 检查项 | 机制 | 触发条件 |
|--------|------|---------|
| Rationalization模式 | 正则匹配transcript尾部 | "skip tests for now"、"pre-existing bug" → 警告（不阻断） |
| 过期的学习库 | 文件mtime检查5个路径 | >=3个过期 + 复杂任务 → 阻断 |
| 磁盘空间 < 50GB | `shutil.disk_usage` | 警告 |
| 磁盘空间 < 15GB | `shutil.disk_usage` | 阻断 |

**设计考虑：** Delivery Gate的设计哲学是"mechanical gates check machine-verifiable facts"——机械门禁检查机器可验证的事实，而非依赖AI推理。实现方式是通过hook的exit code进行确定性阻断。AI推理的质量检查不可靠，因为AI可能rationalize跳过检查；但regex匹配和文件mtime检查不会"自我说服"。

### 3.4运行时控制

ECC提供了精细的hook运行时控制（`README.md`）：

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

**设计考虑：** 运行时控制让用户在不修改 `hooks.json` 的情况下调整hook行为。`minimal` profile只保留核心安全hook，`strict` 启用所有提醒和更严格的guardrails。这意味着同一个ECC安装可以适应不同的使用场景——从快速原型开发（minimal）到严格的生产环境（strict）。

---

## 4. Continuous Learning v2

### 4.1 Instinct模型

Continuous Learning v2是ECC最独特的设计——一个从会话中自动学习并形成可复用知识的系统（`skills/continuous-learning-v2/SKILL.md`）。

**Instinct是一个原子级的学习行为：**

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
- **Atomic**——一个trigger，一个action
- **Confidence-weighted**——0.3（试探性）到0.9（近确定）
- **Domain-tagged**——code-style、testing、git、debugging、workflow等
- **Evidence-backed**——记录观察来源
- **Scope-aware**——project（默认）或global

### 4.2学习管线

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

**设计考虑：** 学习管线的关键设计是**观察和提取分离**——hooks只负责捕获原始数据（100% 可靠），模式检测由后台Haiku agent完成（不影响主session性能）。`/evolve` 命令将成熟的instincts聚类为更高层级的skills/commands/agents，这是人工触发而非自动的——ECC认为从instincts到skills的提升需要人类判断。

### 4.3 v1 → v2 → v2.1的演进

| 特性 | v1 | v2 | v2.1 |
|------|----|----|------|
| 观察 | Stop hook（会话结束时） | PreToolUse/PostToolUse（100% 可靠） | 同v2 + 项目检测 |
| 分析 | 主context | 后台agent（Haiku） | 同v2 |
| 粒度 | 完整skills | 原子instincts | 同v2 + project scope |
| 置信度 | 无 | 0.3-0.9加权 | 同v2 + 提升机制 |
| 演化 | 直接生成skill | instincts → 聚类 → skill/command/agent | 同v2 + project → global提升 |
| 共享 | 无 | 导出/导入instincts | 同v2 + 项目隔离 |
| 跨项目 | 污染风险 | 污染风险 | 默认隔离 + 自动提升 |

**关键设计决策：**

1. **从Stop hook到PreToolUse/PostToolUse**——v1依赖Stop hook在会话结束时提取模式，但skills是概率性触发的（50-80%）。v2改用hooks，100% 可靠。

2. **从完整skills到原子instincts**——v1直接生成完整skills，粒度太粗。v2先生成原子级instincts（一个trigger + 一个action），再通过 `/evolve` 聚类成skills。

3. **v2.1的project-scoped instincts**——React patterns留在React项目，Python conventions留在Python项目。当同一instinct在2+ 个项目中出现且平均置信度 >= 0.8时，自动提升为global。

### 4.4置信度演化

| 分数 | 含义 | 行为 |
|------|------|------|
| 0.3 | 试探性 | 建议但不强制 |
| 0.5 | 适度 | 相关时应用 |
| 0.7 | 强 | 自动批准应用 |
| 0.9 | 近确定 | 核心行为 |

**置信度增加：** 模式被重复观察、用户未纠正、其他来源的类似instinct一致。

**置信度降低：** 用户明确纠正、长时间未观察、出现矛盾证据。

**设计考虑：** 置信度模型让ECC的学习是渐进的——新模式先以0.3的置信度存在，只有被反复验证后才会成为核心行为。这避免了"一次误判成为永久规则"的问题。

**取舍：** 整个系统默认 `observer.enabled: false`——需要用户手动开启。这反映了ECC对自动学习的谨慎态度：自动写入行为可能引入错误的"学习"。代价是大多数用户可能永远不会开启这个功能。

---

## 5. Orchestration体系

### 5.1 orch-* 操作族

虽然ECC不定义流程，但它提供了一个**可选的**编排体系——`orch-*` skill family（`skills/orch-pipeline/SKILL.md`）：

| Skill | 操作 | 触发条件 | 第一步 |
|-------|------|---------|--------|
| `orch-add-feature` | feature | 能力不存在 | research + plan新切片 |
| `orch-change-feature` | tweak | 能工作但行为需要调整 | 修改现有行为及其测试 |
| `orch-fix-defect` | fix | 坏了，行为不对 | 重现为失败测试，然后修复 |
| `orch-refine-code` | refactor | 行为不变，结构改进 | 重构同时保持测试绿色 |
| `orch-build-mvp` | mvp | 从设计/spec文档引导 | 读取文档 → 垂直切片 |

**关键设计：** `orch-pipeline/SKILL.md` 是共享引擎，5个操作skill是"thin wrappers"——它们不重新实现工作，只是分类请求、选择哪些phase运行、委托给已有的ECC agent或command。

### 5.2共享管线

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

`skills/orch-pipeline/SKILL.md` 明确定义了"two gates"——GATE 1在Plan后（不写实现代码直到用户批准），GATE 2在Commit前（不提交直到用户确认）。两个gate之间的一切流式执行。

### 5.3 Size Classifier：仪式与影响范围匹配

| Tier | Files touched | New dep/contract | Design ambiguity | Phases that run |
|------|--------------|-----------------|-----------------|----------------|
| trivial | 1, a few lines | none | none | 4 → 5 → 6 |
| small | 1 file/func | none | clear once read | (1 light) → 4 → 5 → 6 |
| standard | 2-5 files | maybe new module | one real choice | 1 → 2 → 4 → 5 → 6 |
| large | many/cross | new ext dep/API | multiple Qs | 1 → 2 → (3) → 4 → 5 → 6 |

**设计考虑：** "Ceremony scales to blast radius"——仪式与影响范围匹配。trivial变更跳过research和plan，直接TDD + review + commit。large变更走完整管线。

**取舍：** Size classifier是ECC中最接近"工作流设计"的东西。但它仍然是可选的——用户可以不使用 `orch-*` 而直接调用单个skills。

### 5.4 Agent/Command Map

orch-* pipeline的每个phase委托给已有的ECC agent或command：

| Phase | Primary | Fallback/Escalation |
|-------|---------|---------------------|
| Intake | `code-explorer` | — |
| Plan | `planner` | `architect`、`code-architect` |
| Implement | `tdd-guide` (or `tdd-workflow` skill) | `build-error-resolver` / `/build-fix` |
| Review | `code-reviewer` / `/code-review` | 语言专用reviewer (`python-reviewer`, `typescript-reviewer`, ...) |
| Security | `security-reviewer` | — |
| MVP inner loop | `/gan-build` | drives `gan-generator` → `gan-evaluator` |

**设计考虑：** orch-* 是"composer"而非"implementer"——它组合已有的素材，不重新实现。这保持了ECC "提供素材不定义流程"的哲学：orch-* 是一个**可选的**组合方式，用户也可以自己组合。

### 5.5 Observer Loop Prevention

v1.9.0引入了确定性的harness audit scoring（`README.md` changelog）：

> "Harness audit scoring made deterministic, orchestration status and launcher compatibility hardened, observer loop prevention with 5-layer guard."

**设计考虑：** Orchestrator需要防止observer loop——orchestrator启动的subagent不应该再触发orchestrator。5-layer guard确保编排层级不无限递归。这是一个典型的递归终止条件设计——没有它，orchestrator会不断spawn subagent，每个subagent又触发orchestrator，最终耗尽资源。

---

## 6. 其他关键Skills

### 6.1 Intent-Driven Development

`skills/intent-driven-development/SKILL.md` 是ECC的需求澄清方法论——将模糊的产品/工程变更转化为可验证的验收标准。

**两种深度：**
- **Quick Capture**：3-7个验收标准，低/中风险
- **Full Acceptance Brief**：安全/数据/迁移/跨系统变更，完整模板

**关键设计：**
1. **先检查上下文**——读仓库、文档、schema、测试基础设施，能从代码推断的不问用户
2. **只问不能推断的问题**——产品/业务约束不能从代码推断（business rules, compliance, SLAs, pricing, retention policy）
3. **可观察的验收标准**——每个AC-NNN描述起始条件、触发、预期结果、禁止的副作用、验证方法、优先级
4. **不默认阻断实现**——足够清晰的请求记录标准后继续，只在阻塞风险时等待确认

**设计取舍：** ECC的intent-driven-development走的是轻量路线——不强制Socratic对话，不设HARD-GATE，不要求分段确认。它更像"记录够用的验收标准然后继续"。

### 6.2 Search-First

`skills/search-first/SKILL.md` 系统化了"先搜索再编码"的工作流：

```
Need Analysis → Parallel Search (npm/PyPI + MCP + GitHub) → Evaluate → Decide (Adopt/Extend/Build) → Implement
```

**设计考虑：** "Research-before-coding" 不是新概念，但ECC将其系统化为一个skill，提供了搜索渠道、评估标准（functionality, maintenance, community, docs, license, deps）和决策矩阵（exact match → Adopt, partial → Extend, nothing → Build）。

### 6.3 Agent Self-Evaluation

`skills/agent-self-evaluation/SKILL.md` 让AI在完成非平凡任务后自我评分：

**5个评估轴：**

| 轴 | 问题 | 捕获什么 |
|----|------|---------|
| Accuracy | 事实/声明/输出正确吗？ | 幻觉、错误API名、错误语法 |
| Completeness | 覆盖了用户要求的一切吗？ | 遗漏的edge case、未处理的错误路径 |
| Clarity | 解释可理解且结构良好吗？ | 混乱的解释、未定义的术语 |
| Actionability | 用户能立即行动吗？ | 模糊建议、缺失步骤 |
| Conciseness | 用了最少的词/token吗？ | 冗余、过度解释 |

**关键规则：** "Every score below 5 MUST cite specific evidence"——不能只说"可以更好"，必须说具体缺了什么。Anti-pattern "Everything is a 5" 被明确禁止。这解决了AI自评倾向于"一切正常"的问题——强制要求低分项必须引用证据，使得自评不是走过场。

---

## 7. 演进中的关键教训

| 教训 | 来源 | 修复 |
|------|------|------|
| Skills概率性触发（50-80%）导致观察数据不可靠 | CL v1 | 改用PreToolUse/PostToolUse hooks（100% 可靠）捕获会话活动 |
| 完整skill粒度太粗，一次误判成为永久规则 | CL v1 | 引入原子级instinct + 置信度评分（0.3-0.9），渐进学习 |
| 跨项目学习污染——React patterns被误用于Python项目 | CL v2 | v2.1引入project-scoped instincts，默认隔离 + 自动提升机制 |
| 261+ skills全量安装导致context window污染 | v1.9.0 | manifest-driven selective install，3种Profile + 多维度安装 |
| 平台方言限制了可移植性 | v1.8.0 | 所有hooks/scripts用Node.js重写，跨平台行为一致 |
| Observer自动写入行为可能引入错误的"学习" | CL v2设计 | 默认 `observer.enabled: false`，需用户手动开启 |
| orch-* 编排器启动的subagent不应再触发编排器 | v1.9.0 | 5-layer guard防止observer loop无限递归 |

**模式：** 从概率到确定——ECC的演进主线是从依赖skills的概率性触发，逐步迁移到依赖hooks的确定性执行，同时保持skills作为需要判断力的工作流载体。这个模式贯穿了Continuous Learning的v1→v2→v2.1演进，也影响了Delivery Gate的设计（用regex/mtime而非AI推理）。

---

## 8. 能力边界

### 8.1不提供Spec模型

ECC没有结构化的spec模型——没有Requirement/Scenario、没有RFC 2119关键字、没有Delta机制、没有source of truth。

**最接近的东西：**
- `intent-driven-development` 的Acceptance Brief（AC-NNN格式）
- `planner` agent的Implementation Plan（Phase + Step格式）
- `tdd-workflow` 的User Journeys

但这些都不是持久化的source of truth——它们是一次性的工作产物，不持续演进。

### 8.2不提供变更追踪

ECC没有change/delta的概念——没有 `changes/` 目录、没有archive机制、没有审计链。代码变更的历史完全依赖git。

### 8.3不强制执行流程

即使用 `orch-*` pipeline，两个GATE也是"gated, not autonomous"——需要用户审批。但 `orch-*` 本身是可选的，用户可以完全不用它。

ECC没有行为约束机制：
- 没有Iron Law
- 没有Rationalization表（虽然Delivery Gate检测rationalization模式，但只是警告）
- 没有HARD-GATE（hook的block是安全级别的，不是流程级别的）
- 没有SUBAGENT-STOP

### 8.4规模带来的发现成本

261+ skills是ECC的优势也是劣势：
- **优势：** 几乎覆盖了所有主流语言和框架的场景
- **劣势：** 用户发现"我需要哪个skill"的成本很高

ECC的应对策略：
1. Commands作为skills的slash入口
2. `npx ecc consult` 智能匹配
3. Selective install按需安装
4. Skills目录按领域命名

### 8.5跨平台维护成本

7+ 个AI harness的适配意味着：
- 每个hook变更需要跨平台测试
- 每个agent定义需要适配不同harness的格式
- 997+ 个内部测试反映维护成本
- Plugin系统的限制（如Claude Code plugin不能分发rules）需要workaround

### 8.6 Continuous Learning的实际效果未验证

Continuous Learning v2的设计很精巧，但：
- Observer默认关闭（`observer.enabled: false`）
- 需要后台Haiku agent运行（成本）
- Instinct质量依赖观察质量（garbage in, garbage out）
- 没有公开的eval数据证明学习效果

---

## 9. 设计决策清单

| # | 设计决策 | 为什么这么做 | 之前出了什么问题 |
|---|---------|-------------|----------------|
| 1 | 素材五层分离（skills/agents/commands/hooks/rules） | 每层可独立演化、独立安装 | 单一目录结构导致职责边界模糊，迁移困难 |
| 2 | "提供素材不定义流程" | 不同项目/团队/任务需要不同工作流组合 | 强制流程对某些项目过重，对另一些过轻 |
| 3 | Skills为primary surface，Commands为legacy shim | 持久逻辑应在skills中 | 迁移期间两套入口共存可能混淆 |
| 4 | Selective install（manifest-driven） | 261+ skills全量安装会污染context window | 用户不知道需要哪些skills，配置复杂度高 |
| 5 | 跨平台Node.js重写所有hooks/scripts | Windows/macOS/Linux行为一致 | bash脚本在Windows上不可用 |
| 6 | Agent的tools权限隔离 | 最小权限原则（planner只有Read/Grep/Glob） | 无权限隔离时agent可能意外修改文件 |
| 7 | Hooks（确定性）+ Skills（概率性）双层保障 | 必须保证的用hooks，需要判断的用skills | 单靠skills触发率只有50-80% |
| 8 | Continuous Learning v2用PreToolUse/PostToolUse | Hooks 100% 可靠vs Skills 50-80% | CL v1依赖Stop hook，概率性触发导致观察数据不可靠 |
| 9 | Instinct原子级 + 置信度评分 | 渐进学习，避免"一次误判成为永久规则" | CL v1直接生成完整skills，粒度太粗 |
| 10 | v2.1 project-scoped instincts | React patterns留在React项目，避免跨项目污染 | CL v2无scope隔离，跨项目学习相互污染 |
| 11 | orch-* pipeline可选 | 保持"不定义流程"哲学的同时提供组合方式 | 用户可能不知道orch-* 的存在 |
| 12 | Size classifier（trivial/small/standard/large） | Ceremony scales to blast radius | 一刀切流程对trivial变更过重 |
| 13 | Two gates（Plan后 + Commit前） | "Gated, not autonomous"——人在关键决策点介入 | 无gate时agent可能自主提交不合适的变更 |
| 14 | Delivery Gate用确定性检查（regex/mtime/disk） | 机械门禁检查机器可验证的事实，不依赖AI推理 | 依赖AI推理的质量检查不可靠 |
| 15 | Agent Self-Evaluation 5轴评分 | 结构化反思捕获遗漏、标记过度自信 | 无结构化反思时agent自评倾向于"一切正常" |
| 16 | intent-driven-development不默认阻断 | 够用的验收标准记录后继续实现 | 无AC记录时实现偏离意图 |
| 17 | 7+ harness跨平台适配 | 不绑定特定AI工具，用户选择自由 | 每个新功能需跨平台测试，维护成本线性增长 |
| 18 | origin字段区分ECC/community | 素材来源可追溯 | 无来源标记时社区贡献质量不可控 |
| 19 | Rules按语言组织（common/typescript/python/golang/...） | 选择性安装，只加载相关语言的规则 | 跨语言项目需要安装多个rules目录 |
| 20 | Observer loop prevention（5-layer guard） | orchestrator启动的subagent不应再触发orchestrator | 无guard时编排层级无限递归 |

---

点击下方"**阅读原文**"进入我的演示网站。
