---
title: AI研发流程深度解析（三）：OpenSpec深度拆解——Spec即共识契约
description: 一个在人与AI之间建立"先同意再构建"共识层的系统，是如何设计其核心抽象的？工具化程度到了什么水平？
tags:
  - 研发流程
  - OpenSpec
  - Spec
  - Delta
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> 一个在人与AI之间建立"先同意再构建"共识层的系统，是如何设计其核心抽象的？工具化程度到了什么水平？

---

## 1. 架构拆解

### 1.1三层架构：CLI工具 + 目录约定 + Slash Command

OpenSpec是一个 **npm CLI工具 + 目录约定 + slash command** 的三层架构。CLI是引擎（知道规则、验证、合并），slash commands是方向盘（引导AI按工作流行动）。

```
┌─────────────────────────────────────────────────┐
│                 用户交互层                        │
│  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  Terminal (CLI)   │  │  AI Chat (Slash)     │ │
│  │  openspec init    │  │  /opsx:propose       │ │
│  │  openspec list    │  │  /opsx:apply         │ │
│  │  openspec view    │  │  /opsx:archive       │ │
│  └────────┬─────────┘  └────────┬─────────────┘ │
│           │   CLI 是引擎          │  Slash 是方向盘 │
│           │   (规则、验证、合并)   │  (工作流引导)  │
│           ▼                      ▼               │
├─────────────────────────────────────────────────┤
│                 核心层                            │
│  ┌──────────────────────────────────────────┐   │
│  │  src/core/  (~41 个模块)                  │   │
│  │  artifact-graph / validation / parsers /  │   │
│  │  command-generation / store / archive ... │   │
│  └──────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│                 存储层                            │
│  ┌──────────────────────────────────────────┐   │
│  │  openspec/  (目录约定)                    │   │
│  │  specs/ (source of truth)                │   │
│  │  changes/ (proposed modifications)       │   │
│  │  config.yaml                             │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**设计考虑：** 这个分离使得OpenSpec能支持30+ AI工具——CLI是平台无关的，每个AI工具只需要不同的slash command适配器。代价是用户需要理解"终端命令"和"聊天命令"的区别，这是新用户最常见的困惑点（文档专门用一整页解释）。

### 1.2核心目录结构

```
openspec/
├── specs/                    # Source of Truth——系统当前行为
│   ├── auth/
│   │   └── spec.md
│   └── payments/
│       └── spec.md
├── changes/                  # 拟议变更（每个 change 一个文件夹）
│   ├── add-dark-mode/
│   │   ├── proposal.md       # 为什么 + 做什么
│   │   ├── design.md         # 怎么做（技术方案）
│   │   ├── tasks.md          # 实现清单
│   │   ├── .openspec.yaml    # 变更元数据（可选）
│   │   └── specs/            # Delta specs
│   │       └── ui/
│   │           └── spec.md
│   └── archive/              # 已归档变更（带日期前缀）
│       └── 2025-01-24-add-2fa/
├── config.yaml               # 项目配置
└── schemas/                  # 自定义 schema（可选）
```

**设计考虑：** `specs/` 和 `changes/` 的分离是OpenSpec的核心洞察——source of truth和proposed modifications物理隔离。多个change可以并行存在而不冲突，review在merge之前进行，archive后delta合并回source of truth。

### 1.3源码架构

`src/core/` 下约41个模块，核心包括：

| 模块 | 职责 | 关键文件 |
|------|------|---------|
| `artifact-graph/` | 依赖图、状态检测、指令生成 | `graph.ts`, `instruction-loader.ts`, `schema.ts`, `state.ts`, `resolver.ts` |
| `validation/` | Spec和change的结构验证 | `validator.ts`, `types.ts`, `constants.ts` |
| `parsers/` | Markdown解析 | `markdown-parser.ts`, `change-parser.ts`, `requirement-blocks.ts` |
| `command-generation/` | 多平台slash command生成 | `generator.ts`, `registry.ts`, `adapters/*.ts`（29+ 适配器） |
| `templates/` | Skill和command模板 | `skill-templates.ts`, `workflows/*.ts`（14个工作流模板） |
| `store/` | 跨repo spec共享（beta） | `foundation.ts`, `operations.ts`, `git.ts` |
| `archive.ts` | 归档流程 | delta合并、验证、move到archive |
| `specs-apply.ts` | Delta应用逻辑 | `findSpecUpdates`, `buildUpdatedSpec`, `writeUpdatedSpec` |

**关键文件：** `src/core/artifact-graph/instruction-loader.ts` 是连接CLI和AI的桥梁——`generateInstructions()` 函数将schema定义、项目配置（context + rules）、模板内容组合成AI可消费的指令JSON。

### 1.4 Agent Contract

`docs/agent-contract.md` 定义了所有CLI命令的 **JSON机器可读接口**：

- 每个命令都支持 `--json` 输出
- 输出结构包含 `status`（状态数组）和业务数据
- 退出码：0 = 成功，1 = 可恢复错误，2 = 严重错误
- 诊断码：`archive_validation_failed`、`archive_change_not_found` 等100+ 诊断码

**设计考虑：** Agent Contract让AI agent可以程序化地调用CLI、解析输出、做出决策。例如 `openspec status --change "name" --json` 返回的JSON包含 `applyRequires`（apply前必须完成的artifact ID列表）、`artifacts`（每个artifact的状态）和 `actionContext`（机器可读的动作约束），AI agent据此决定下一步做什么。不依赖AI解析自然语言输出来理解状态。

**取舍：** 这个设计增加了CLI的复杂度（每个命令需要维护两套输出：人类可读和机器可读），但使得AI集成变得确定性化。

---

## 2. Spec模型

### 2.1行为契约，不是实现计划

OpenSpec的spec模型有一个明确的核心原则（`docs/writing-specs.md`）：

> **"A spec says what your system *does*, in terms anyone could check — not how it's built."**

具体规则：
- Spec描述**外部可观察行为**，不描述内部实现
- "如果改了实现但不改外部可观察行为，那它不属于spec"
- 实现细节（类名、库选择、数据结构）放在 `design.md`，不放入spec

**设计考虑：** 这个分离解决了一个常见的spec腐化问题——当spec混入实现细节后，每次代码重构都需要更新spec，导致spec迅速过时。行为契约只在行为变化时才需要更新，与实现重构解耦。

### 2.2 Requirement + Scenario结构

Spec的基本单元是 **Requirement**（需求）+ **Scenario**（场景）：

```markdown
### Requirement: Session Timeout
The system SHALL expire a session after 30 minutes of inactivity.

#### Scenario: Idle timeout
- GIVEN an authenticated session
- WHEN 30 minutes pass with no activity
- THEN the session is invalidated and the user must re-authenticate
```

**关键元素：**

| 元素 | 目的 | RFC 2119关键字 |
|------|------|----------------|
| `### Requirement:` | 一个可观察的行为 | MUST/SHALL（强制）、SHOULD（推荐）、MAY（可选） |
| `#### Scenario:` | 需求的具体验证实例 | GIVEN/WHEN/THEN格式 |

**设计考虑：**

1. **一个Requirement一个SHALL/MUST**——如果包含三个 "and also" 分句，实际上是三个需求，必须拆分。这让每个需求可独立测试。

2. **Scenario必须真正exercise需求**——"复述需求的场景测试不了任何东西"。好的场景覆盖edge case而非只覆盖happy path："你最在意哪个case被破坏？确保有一个场景覆盖它。"

3. **RFC 2119关键字**——MUST/SHALL/SHOULD/MAY不是装饰，是明确语义强度。默认用MUST/SHALL，只有真正允许例外时才用SHOULD。

**取舍：** 结构化格式增加了编写成本，但换来了场景可映射为自动化测试（GIVEN/WHEN/THEN → 测试骨架）、需求可独立验证、语义强度明确、Review效率提升。

### 2.3 Progressive Rigor

OpenSpec不要求所有变更都使用相同级别的规格化（`docs/concepts.md`）：

| 级别 | 适用场景 | 内容要求 |
|------|---------|---------|
| **Lite spec（默认）** | 大多数变更 | 简短的行为需求 + 清晰的scope + 几个验收检查 |
| **Full spec** | 跨团队/API变更/迁移/安全隐私 | 完整的交叉引用、多场景覆盖、正式验证 |

> "Use the lightest level that still makes the change verifiable"

**设计考虑：** 这是对"流程过重"问题的回应——不是每个变更都需要完整的规格化。一行typo修复不需要三个Requirement和一个design doc。"Match the ceremony to the stakes."

### 2.4 Human + Agent协作模型

OpenSpec明确定义了人和AI的分工（`docs/concepts.md`）：

1. **人类提供**意图、上下文和约束
2. **Agent转换**为行为需求和场景
3. **Agent保持**实现细节在 `design.md` 和 `tasks.md`，不放入 `spec.md`
4. **验证**确认结构和清晰度

`docs/writing-specs.md` 进一步解释了如何引导AI产出好的spec：
- **State the intent and the boundary**——说清楚要做什么和**不做什么**
- **Name the cases you care about**——指出需要覆盖的场景
- **Then edit**——AI的初稿需要人工编辑

**设计考虑：** OpenSpec认识到AI擅长将自然语言转换为结构化格式，但不擅长判断"什么重要"——什么场景值得覆盖、什么行为值得规格化。因此人类负责"瞄准"，AI负责"填充"。

---

## 3. Delta机制

### 3.1 ADDED / MODIFIED / REMOVED

Delta spec是OpenSpec brownfield-first设计的核心（`docs/concepts.md`）。Delta spec描述"什么变了"而非重述全部：

```markdown
## ADDED Requirements
### Requirement: Two-Factor Authentication
The system MUST support TOTP-based two-factor authentication.

## MODIFIED Requirements
### Requirement: Session Expiration
The system MUST expire sessions after 15 minutes of inactivity.
(Previously: 30 minutes)

## REMOVED Requirements
### Requirement: Remember Me
(Deprecated in favor of 2FA.)
```

**Archive合并规则：**

| Delta类型 | 合并行为 |
|-----------|---------|
| ADDED | 追加到main spec |
| MODIFIED | 替换现有requirement（按header匹配） |
| REMOVED | 从main spec删除 |
| RENAMED | header重命名（FROM → TO） |

### 3.2为什么用Delta而非全文重写

从 `openspec/changes/archive/2025-08-19-adopt-delta-based-changes/proposal.md` 可以看到原始设计动机：

> **"The current approach of storing complete future states in change proposals creates a poor review experience. When reviewing changes on GitHub, reviewers see entire spec files (often 100+ lines) as 'added' in green, making it impossible to identify what actually changed."**

四个理由：

1. **清晰**——Delta只展示变更，reviewer不需要mental diff
2. **避免冲突**——两个change可以同时修改同一spec的不同requirement
3. **Review效率**——Reviewer只看变更，不看未变的上下文
4. **Brownfield适配**——大多数工作是修改现有行为，而非从零创建

**设计考虑：** Delta机制把"变更"从"状态"中分离出来。传统spec系统存储完整状态，reviewer需要对比才能发现变更；OpenSpec存储变更本身，reviewer直接看到的就是变更。

### 3.3 Delta应用逻辑

`src/core/specs-apply.ts` 实现了delta合并逻辑：

- **应用顺序**：RENAMED → REMOVED → MODIFIED → ADDED
- **原子性**：先在内存中应用所有操作，验证全部通过后才写入文件。任何验证失败都abort，不写部分结果
- **验证矩阵**：MODIFIED/REMOVED必须存在于main spec；ADDED不能已存在；RENAMED FROM必须存在且TO不存在；无跨section冲突
- **Header匹配**：按 `### Requirement: [Name]` 精确匹配（trim空格，大小写敏感）

**关键文件：** `src/core/archive.ts` 中的 `ArchiveCommand.run()` 方法展示了完整的归档流程：验证 → 检查任务完成 → 查找spec更新 → 构建更新后的spec → 验证重建的spec → 写入文件 → move change到archive。

### 3.4验证体系

`src/core/validation/validator.ts` 实现了多层验证：

1. **Spec验证**：检查Purpose长度、Requirement必须有SHALL/MUST、每个Requirement至少一个Scenario、Spec结构合规性
2. **Change验证**：检查delta描述长度、ADDED/MODIFIED必须有requirements
3. **Delta Spec验证**：每个ADDED/MODIFIED requirement必须有SHALL/MUST和至少一个scenario；REMOVED只需名称；无section内重复；无跨section冲突
4. **重建spec验证**：归档时重建完整spec后再验证一次，确保合并结果有效

**设计考虑：** 验证是 "Enablers not Gates" 哲学的体现——验证发现问题但不阻断操作。Archive可以在有validation error时使用 `--no-validate` 跳过。验证的目的是**暴露问题**，不是**阻止行动**。

---

## 4. Artifact Graph

### 4.1依赖图模型

Artifact之间形成有向无环图（DAG），由schema定义（`docs/concepts.md`）：

```
                    proposal
                   (root node)
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
      specs                       design
   (requires:                  (requires:
    proposal)                   proposal)
         │                           │
         └─────────────┬─────────────┘
                       │
                       ▼
                    tasks
                (requires:
                specs, design)
```

**关键文件：** `src/core/artifact-graph/types.ts` 定义了schema的Zod类型：`ArtifactSchema`（id、generates、template、instruction、requires）、`ApplyPhaseSchema`（apply阶段需要的artifact ID列表）、`SchemaYamlSchema`（完整的schema YAML结构）。

### 4.2 "Enablers, not Gates"

这是OpenSpec的核心哲学之一（`docs/concepts.md`）：

> **"Dependencies are enablers, not gates. They show what's possible to create, not what you must create next. You can skip design if you don't need it."**

**设计考虑：** 传统工作流用phase gate强制顺序——必须先完成planning才能开始implementation。OpenSpec认为真实工作不fit进盒子，因此用依赖图表示"可以做什么"而非"必须做什么"。如果你想跳过design直接写tasks，技术上可以。

**取舍：** 这个设计给了用户最大灵活性，但代价是没有强制流程保障。用户可能跳过重要步骤。OpenSpec的应对是——通过verify暴露问题，而不是通过gate阻止行动。

### 4.3 Schema系统

Schema定义了工作流的artifact类型和依赖关系（`docs/customization.md`）：

```yaml
name: spec-driven
artifacts:
  - id: proposal
    generates: proposal.md
    template: proposal.md
    instruction: |
      Create a proposal that explains WHY this change is needed.
    requires: []

  - id: specs
    generates: specs/**/*.md
    requires: [proposal]

  - id: design
    generates: design.md
    requires: [proposal]

  - id: tasks
    generates: tasks.md
    requires: [specs, design]

apply:
  requires: [tasks]
  tracks: tasks.md
```

**Schema解析顺序**（`src/core/artifact-graph/instruction-loader.ts`）：
1. CLI flag：`--schema <name>`
2. Change元数据：`.openspec.yaml` 中的schema字段
3. 项目配置：`openspec/config.yaml` 中的schema字段
4. 默认：`spec-driven`

**设计考虑：** 每层覆盖前一层，实现了四级定制化：CLI临时覆盖 → 单个变更级 → 项目级 → 内置默认。这意味着同一项目中不同变更可以使用不同工作流。

### 4.4自定义Schema

OpenSpec支持三种创建自定义schema的方式（`docs/customization.md`）：

1. **Fork**：从内置schema复制并修改——`openspec schema fork spec-driven my-workflow`
2. **Init**：从零创建——`openspec schema init research-first`
3. **Community**：从社区schema仓库安装

### 4.5 Profile系统

| Profile | 命令集 | 适用场景 |
|---------|--------|---------|
| **core（默认）** | explore, propose, apply, sync, archive | 大多数用户 |
| **expanded** | 额外增加new, continue, ff, verify, bulk-archive, onboard | 需要精细控制的工作流 |

**设计考虑：** core profile只有5个命令，降低了入门门槛。expanded增加了6个命令用于需要逐步控制artifact创建的场景。通过 `openspec config profile` 切换，然后 `openspec update` 重新生成slash command。

---

## 5. 工具化设计

### 5.1平台适配器

OpenSpec支持30+ AI编码助手（`docs/supported-tools.md`），包括Claude Code、Cursor、Windsurf、GitHub Copilot、Codex、Gemini、Cline、RooCode、Kimi等。

**集成方式：** 每个工具生成两类文件：
- **Skills**：`.../skills/openspec-*/SKILL.md`——跨工具标准，AI自动检测
- **Commands**：工具特定的slash command文件——如 `.claude/commands/opsx/<id>.md`、`.cursor/commands/opsx-<id>.md`

### 5.2 Command Generation机制

`src/core/command-generation/generator.ts` 的实现极其简洁：

```typescript
export function generateCommand(
  content: CommandContent,
  adapter: ToolCommandAdapter
): GeneratedCommand {
  return {
    path: adapter.getFilePath(content.id),
    fileContent: adapter.formatFile(content),
  };
}
```

核心思路是**工具无关的content + 工具特定的adapter = 工具特定的command文件**。这是一个经典的适配器模式应用。添加新平台支持只需要写一个新的adapter，不需要修改任何业务逻辑。每个adapter只需实现两个方法：`getFilePath`（文件放哪里）和 `formatFile`（文件格式是什么）。

### 5.3 Instruction Loader

`src/core/artifact-graph/instruction-loader.ts` 的 `generateInstructions()` 函数是连接CLI和AI的核心桥梁。

**指令注入顺序：**
1. `<context>`——项目配置中的context（技术栈、约定等），**约束AI但不放入输出**
2. `<rules>`——artifact特定的规则（如"包含回滚计划"），**约束AI但不放入输出**
3. `<template>`——schema模板内容，**这是输出格式**

**关键设计：** context和rules是"约束你（AI）的，不是输出文件的内容"。模板明确标注："Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact"。这防止了AI把项目背景信息机械地复制到proposal中。

### 5.4 Customization三层

| 层次 | 机制 | 适用场景 |
|------|------|---------|
| **Project Config** | `openspec/config.yaml`——默认schema、context注入、per-artifact rules | 大多数团队 |
| **Custom Schemas** | `openspec/schemas/`——完全自定义工作流 | 独特流程的团队 |
| **Global Overrides** | `~/.local/share/openspec/schemas/`——跨项目共享schema | 高级用户 |

**Context注入示例：**

```yaml
# openspec/config.yaml
context: |
  Tech stack: TypeScript, React, Node.js, PostgreSQL
  We value backwards compatibility for all public APIs

rules:
  proposal:
    - Include rollback plan
    - Identify affected teams
  specs:
    - Use Given/When/Then format
```

**设计考虑：** Context出现在所有artifact中，Rules只出现在匹配的artifact中。这让项目约定（技术栈、编码风格）自动注入到每个AI生成的artifact，而不需要每次手动提醒。

### 5.5 Store机制（Beta）

Store是OpenSpec的跨repo spec共享方案（`src/core/store/`）：

- Planning住在独立的standalone repo
- 多个code repo可以引用同一个store
- 适用于：一个功能跨多个服务/仓库、一个团队owns requirements其他团队消费

**设计考虑：** Store解决的是monorepo之外的多repo协作问题。目前是beta状态，命令和状态可能变化。

---

## 6. 演进历程

### 6.1从Phase-Locked到Fluid Actions（2025-08）

**变更：** `openspec/changes/archive/2025-08-19-adopt-verb-noun-cli-structure/`

> "Traditional workflows force you through phases: first you plan, then you implement, then you're done. But real work doesn't fit neatly into boxes."

**为什么：** 传统工作流强制你经过阶段，但真实工作不fit进盒子。用户可能在implementation中发现需要修改spec，或者在design中发现需要回到proposal。

**取舍：** 流动性给了用户灵活性，但失去了流程的强制保障。OpenSpec的应对是——用依赖图表示"使能"而非"门禁"，用verify暴露问题而非阻断行动。

### 6.2采用Delta-Based Changes（2025-08）

**变更：** `openspec/changes/archive/2025-08-19-adopt-delta-based-changes/`

**为什么：** 之前存储完整future state，GitHub diff全绿（100+ 行 "added"），reviewer无法识别实际变更。

**结果：** Delta格式让GitHub diff只显示实际变更（25行代替150+），review效率大幅提升。同时让两个change可以并行修改同一spec的不同requirement。这是OpenSpec brownfield-first设计的基石——Delta让"修改现有行为"成为first-class概念。

### 6.3结构化Spec格式（2025-08）

**变更：** `openspec/changes/archive/2025-08-19-structured-spec-format/`

**为什么：** 之前spec是自由格式Markdown，无法程序化解析和验证。

**结果：** 引入 `### Requirement:` + `#### Scenario:` + RFC 2119关键字的标准格式，使得CLI可以验证spec结构、Delta合并可程序化执行（按header匹配）、场景可映射为测试。

### 6.4多AI工具适配（2025-09）

**变更：** `openspec/changes/archive/2025-09-29-add-multi-agent-init/` 和多个 `add-*-support` 变更

**为什么：** 最初只支持Claude Code，但用户使用各种不同的AI工具。

**演进：** 从Claude Code单平台 → multi-agent init支持多平台 → 29+ 个平台适配器。每个平台只需要一个adapter（`getFilePath` + `formatFile`）。

### 6.5 Artifact Graph Core（2025-12）

**变更：** `openspec/changes/archive/2025-12-24-add-artifact-graph-core/`

**为什么：** 之前依赖约定和AI推断来决定artifact创建顺序，不够确定性。

> "The current OpenSpec system relies on conventions and AI inference for artifact ordering. A formal artifact graph with dependency awareness would enable deterministic 'what's ready?' queries."

**结果：** 引入 `ArtifactGraph` 类（基于DAG + 拓扑排序），提供 `getNextArtifacts()`（哪些可以创建）、`getBuildOrder()`（构建顺序）、`isComplete()`（是否全部完成）等确定性查询。

### 6.6 Project Config + Local Schemas（2025-12 ~ 2026-02）

**变更：** `openspec/changes/archive/2025-12-20-add-global-config-dir/`、`2025-12-21-add-config-command/`

**为什么：** 用户需要项目级定制——默认schema、技术栈context、per-artifact rules。

**结果：** `openspec/config.yaml` 支持context注入和rules配置。Schema可以fork到项目本地并自定义。

### 6.7 Explore命令的引入

在"还没想好做什么"的阶段提供低成本探索入口——不创建change、不写artifact、不修改代码。Explore是 "a stance, not a workflow"——没有固定步骤、没有必需输出、没有必经路径。填补了"模糊问题"到"具体提案"之间的空白。

---

## 7. Review机制

### 7.1两个Review时机

OpenSpec的review不在流程中的固定位置，而是可以在任何时候进行（`docs/reviewing-changes.md`）：

| 时机 | 做什么 | 价值 |
|------|--------|------|
| **Propose后（读计划）** | 读proposal → specs → tasks，检查方向是否正确 | "Catching a wrong turn in a one-paragraph plan is nearly free" |
| **Apply后（验证实现）** | 读代码diff，对照spec检查实现 | 确保实现匹配spec |

**关键设计：** Review阅读顺序是proposal → specs → tasks（如果proposal错了，不用往下读）。Review是人工的、轻量的——"Right-size review: 简单修改20秒扫一眼，关键修改仔细审"。不强制每次都做完整review。

### 7.2三个验证维度

`/opsx:verify` 命令从三个维度验证实现（`docs/workflows.md` + `src/core/templates/workflows/verify-change.ts`）：

| 维度 | 检查内容 | 严重度分级 |
|------|---------|-----------|
| **Completeness** | 所有task完成、所有requirement实现、scenario覆盖 | CRITICAL（未完成的task） |
| **Correctness** | 实现匹配spec意图、edge case处理、scenario覆盖 | WARNING（spec/实现偏差） |
| **Coherence** | design决策在代码中体现、命名一致、模式一致 | SUGGESTION（模式偏差） |

**验证启发式规则：**
- Completeness：关注客观检查项（checkbox、requirement列表）
- Correctness：使用关键词搜索和文件路径分析，不要求完美确定性
- Coherence：寻找明显不一致，不吹毛求疵
- **False Positive策略**：不确定时优先SUGGESTION而非WARNING，优先WARNING而非CRITICAL
- **Graceful Degradation**：只有tasks.md → 只验证task完成；tasks + specs → 验证completeness和correctness；完整artifacts → 验证全部三个维度

### 7.3不阻断

> **"Verify won't block archive, but it surfaces issues you might want to address first."**

这是 "Enablers not Gates" 哲学的核心体现：

> **"leaves the call to you"**

Archive时：
- 验证有error → 警告但不阻止（除非使用 `--json` 模式）
- Task未完成 → 警告但可以继续（用 `--yes` 确认）
- Spec未sync → 询问是否sync，不强制

**设计考虑：** OpenSpec认为review和verify的价值在于**暴露信息**，让人类做决策，而不是代替人类做决策。

**取舍：** 非阻断设计给了用户最大灵活性，但代价是——用户可以忽略所有警告直接archive，导致spec与代码不一致。OpenSpec的赌注是：用户会做出合理的判断，而流程的轻量性会让用户更愿意使用。

### 7.4 Reviewing in Pull Requests

OpenSpec的team workflow（`docs/team-workflow.md`）建议将review嵌入PR流程：

```
git switch -c add-dark-mode
/opsx:propose add-dark-mode
REVIEW THE PLAN (读 proposal + specs + tasks)
/opsx:apply
git commit && open a PR (PR 包含 spec delta + 代码)
teammate reviews, merges
/opsx:archive
```

**关键设计：** "OpenSpec doesn't touch git"——OpenSpec从不commit、branch、push或pull。它只读写Markdown文件。所有git操作是用户的职责。这个设计让OpenSpec能无缝融入任何现有的git工作流，而不是替代它。

---

## 8. 演进中的关键教训

| 教训 | 来源 | 修复 |
|------|------|------|
| 全量future state导致GitHub diff全绿，reviewer无法识别实际变更 | 2025-08 | 采用Delta（ADDED/MODIFIED/REMOVED），只展示变更 |
| 自由格式spec无法程序化解析和验证 | 2025-08 | 引入 `### Requirement:` + `#### Scenario:` + RFC 2119结构化格式 |
| Phase gate强制顺序阻碍自然迭代工作流 | 2025-08 | Enablers not Gates——依赖图表示"能做什么"而非"必须做什么" |
| 绑定单一AI工具限制用户选择 | 2025-09 | 29+ 平台适配器（Adapter Pattern），添加新平台只需两个方法 |
| 约定和AI推断决定artifact顺序不够确定性 | 2025-12 | 引入Artifact Graph（DAG + 拓扑排序），提供确定性查询 |
| 用户需要项目级定制（默认schema、技术栈context、rules） | 2025-12 | `config.yaml` 支持context注入和per-artifact rules |
| "还没想好做什么"阶段无低成本入口 | Explore命令引入 | Explore是stance not workflow，不创建change、不写artifact |
| Review阻断导致用户用 `--no-validate` 完全跳过验证 | Verify设计 | Verify不阻断Archive，暴露问题让人类决策 |
| 一刀切规格化对简单变更过重 | Progressive Rigor | Lite spec（默认）vs Full spec（高风险），"Match the ceremony to the stakes" |
| Legacy工作流硬编码instruction无法迭代 | OPSX替代Legacy | Schema YAML + templates可编辑、即时生效、可fork |
| 同一项目中不同变更需要不同工作流 | Per-Change Schema | 每个change的 `.openspec.yaml` 可指定自己的schema |
| 多repo协作需要跨repo的planning | Store / Workspace | spec生活在独立git仓库，多个code repo通过 `ref:` 引用 |

**模式：** 从约束到使能——OpenSpec的演进主线是从"硬性约束"（phase gate、固定工作流、全量spec）转向"柔性使能"（enablers、可定制schema、delta），通过暴露问题而非阻断行动来引导质量。

---

## 9. 能力边界

### 9.1不处理开发执行流程

OpenSpec的流程止于 `/opsx:apply`——按tasks.md逐项实现。它不涉及TDD约束、subagent驱动、代码审查、调试方法论。`/opsx:apply` 的任务模板只是一个简单的"读tasks.md → 逐项实现 → 勾选checkbox"流程。

**设计考虑：** OpenSpec有意将执行阶段留给其他工具。它定位为共识层，不是执行层。

### 9.2不处理行为约束

OpenSpec没有行为约束机制——没有Iron Law、没有Rationalization表、没有Red Flags、没有HARD-GATE。Slash command模板中有Guardrails段落（如explore的"Don't implement / Don't rush"），但这些是建议性的，不是强制的。

**设计考虑：** OpenSpec假设用户会合理使用工具，而不是假设用户（或AI）会试图绕过流程。

### 9.3验证的精度有限

`/opsx:verify` 基于启发式规则而非确定性验证：
- Correctness维度使用"关键词搜索和文件路径分析"，承认"不要求完美确定性"
- Scenario覆盖检查是"检查条件是否在代码中处理"，不是运行测试

**设计考虑：** OpenSpec的verify是"reasonable inference"而非"proof"。它承认AI无法完美地判断代码是否匹配spec，因此选择了宽松的验证策略。

### 9.4 Delta合并的手动风险

Delta合并虽然程序化执行，但以下风险仍然存在：
- **Spec腐化**——代码变更但spec未更新，archive时spec与现实不一致
- **合并顺序**——bulk archive时多个change修改同一spec，按时间顺序合并，但可能不是语义正确的顺序
- **手动编辑风险**——用户手动编辑spec文件可能破坏结构（虽然validate会检查）

### 9.5平台适配的维护成本

29+ 个平台适配器意味着每个新命令或命令变更需要同步更新所有适配器。虽然适配器模式让添加新平台容易，但维护已有平台的兼容性是一个持续成本。

---

## 10. 设计决策清单

| # | 设计决策 | 为什么这么做 | 之前出了什么问题 |
|---|---------|-------------|----------------|
| 1 | CLI + Slash双层架构 | CLI平台无关，Slash适配各AI工具 | 纯Markdown skill依赖平台hook，可移植性受限 |
| 2 | Spec = 行为契约，非实现计划 | 行为契约只在行为变化时更新，与实现重构解耦 | Spec混入实现细节后随代码重构迅速过时 |
| 3 | Requirement + Scenario + RFC 2119 | 场景可映射为测试，需求可独立验证，语义强度明确 | 自由格式Markdown无法程序化解析和验证 |
| 4 | Delta（ADDED/MODIFIED/REMOVED） | 只展示变更，review效率高，支持并行变更 | 存储完整future state导致GitHub diff全绿，无法识别实际变更 |
| 5 | Delta应用顺序RENAMED→REMOVED→MODIFIED→ADDED | 先删除再修改再添加，避免名称冲突 | 无序应用可能导致header匹配失败 |
| 6 | 原子性合并（先验证后写入） | 避免部分写入导致spec损坏 | 无原子性保障时，中途失败留下不一致状态 |
| 7 | Enablers not Gates | 真实工作不fit进phase box，用户需要灵活性 | Phase gate强制顺序导致用户绕过流程或放弃使用 |
| 8 | Verify不阻断Archive | 暴露问题让人类决策，不代替人类决策 | 强制阻断导致用户用 `--no-validate` 完全跳过验证 |
| 9 | Progressive Rigor（Lite vs Full） | 一行typo修复不需要完整规格化 | 统一规格化级别导致简单变更流程过重 |
| 10 | Schema系统可自定义 + 可fork | 不同团队/变更需要不同工作流 | 固定工作流无法适应多样化需求 |
| 11 | Schema四级解析（CLI→change→project→default） | 同一项目中不同变更可用不同工作流 | 单一schema无法满足多场景需求 |
| 12 | 29+ 平台适配器（Adapter Pattern） | 添加新平台只需实现两个方法 | 每个平台单独实现导致维护成本高 |
| 13 | Agent Contract（JSON机器可读接口） | AI agent可程序化调用CLI并解析输出 | AI解析自然语言CLI输出不可靠 |
| 14 | Context + Rules注入但不放入输出 | 项目约定自动注入AI prompt，但不污染artifact | AI会机械复制项目背景到proposal中 |
| 15 | Explore是stance not workflow | 探索应是自由对话，非结构化流程 | 结构化探索流程限制了思考自由度 |
| 16 | OpenSpec doesn't touch git | 无缝融入任何现有git工作流 | 替代git工作流导致兼容性问题和用户抗拒 |
| 17 | Change是文件夹（proposal+design+tasks+specs） | 一切在一起、支持并行、clean history、review-friendly | 分散存储导致hunting through different locations |
| 18 | Archive保留完整上下文 | 可回溯每个变更的"为什么" | 只有git log无法理解设计决策的来龙去脉 |
| 19 | Bulk archive + 冲突检测 | 并行变更归档时检测spec冲突 | 多个change同时修改同一spec时静默合并不安全 |
| 20 | 82个归档变更的演进记录 | 每个变更都是一次设计决策的实验 | 从演进历史中学习什么有效什么无效 |
