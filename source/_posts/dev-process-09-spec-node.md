---
title: AI研发流程深度解析（九）：Spec节点——从意图到行为契约
description: 对比5个项目如何将探索结果转化为可验证的行为规格，分析结构化程度、持久化策略和质量保障机制的关键差异。
tags:
  - 研发流程
  - Spec
  - 行为契约
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 5个项目如何将探索结果转化为可验证的行为规格？结构化程度、持久化策略和质量保障机制有什么关键差异？各项目走过哪些弯路？我们能从中学到什么？

---

![AI研发流程深度解析（九）：Spec节点——从意图到行为契约](/images/dev-process/dev-process-09-spec-node.png)

## 1. 对比分析

### 1.1 Superpowers：自由Markdown设计文档

Superpowers的Spec产出是brainstorming的输出——一份自由Markdown设计文档，保存到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`（`skills/brainstorming/SKILL.md`）。

**关键设计：**

- **Design for isolation and clarity**：每个单元应能独立理解和测试——"能否在不阅读内部实现的情况下理解一个单元做什么？能否在不破坏调用方的情况下修改内部实现？如果不能，说明边界需要调整。"（`SKILL.md` 第89-94行）
- **Working in existing codebases**：跟随现有模式，不提议无关重构——"不要提议无关的重构。专注于服务当前目标的内容。"（第99-100行）
- **Spec self-review**：4项inline自检——placeholder scan、internal consistency、scope check、ambiguity check。自检后直接inline修复——"直接inline修复任何问题。不需要重新审查——修复后继续。"（第111-119行）
- **User review gate**：spec写完后用户审查才进入plan——"等待用户回复。如果用户要求修改，做出修改并重新运行spec review loop。只有用户批准后才继续。"（第122-127行）
- **无固定格式**：按section complexity调节长度，包含architecture、components、data flow、error handling、testing
- **Scope check**：多子系统项目需要分解为多个设计单元——"如果请求描述了多个独立子系统，立即标记"（第68行）

**产出：** 设计文档（自由Markdown），保存到 `docs/superpowers/specs/`

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v5.0.0之前 | Spec review loop（dispatch subagent审查spec）存在于prose中但不在checklist和process flow diagram中——agent跟随diagram而非prose，导致spec review被完全跳过 (#677) | v5.0.1将spec review步骤添加到checklist和dot graph中 |
| v5.0.6 | Spec review loop（subagent dispatch + 3-iteration cap）执行时间约25分钟，但跨5个版本5次试验的回归测试显示质量分数与无review一致 | v5.0.6替换为inline Spec Self-Review checklist（placeholder scan、consistency、scope、ambiguity），30秒完成，质量相当 |
| v5.0.4 | Reviewer checklists过于关注格式（task syntax、chunk size）而非实质（buildability、spec alignment），max iterations为5导致过多轮次 | v5.0.4精简spec reviewer从7类到5类，max iterations从5减到3，添加Calibration section只标记会导致实际问题的问题 |
| v4.0.0 | Description字段包含workflow摘要时，agent跟随description而不读取skill正文——"The Description Trap" | description只描述触发条件（"Use when..."），绝不包含workflow摘要 |
| v5.0.1之前 | spec写完后直接进入writing-plans，没有用户审查点——用户无法在spec阶段叫停 (#565) | v5.0.1添加explicit User Review Gate——用户必须在spec完成后审批才能进入plan |

**核心教训：** Spec的质量保障机制经历了从"subagent审查"到"inline自检"的演进——25分钟的subagent审查与30秒的inline自检效果相同，但inline自检的摩擦低得多。关键洞察是：agent跟随checklist和process flow diagram的可靠性远高于跟随prose——如果一个步骤只存在于prose中，它会被跳过。

### 1.2 OpenSpec：结构化行为契约 + Delta机制

OpenSpec的Spec由 `/opsx:propose` 生成change文件夹（`docs/writing-specs.md`、`docs/concepts.md`）。Spec是**行为契约**——描述系统外部可观察行为，不包含实现细节。

**关键设计：**

- **Requirement（RFC 2119）**：使用MUST/SHALL/SHOULD，一个Requirement一个SHALL/MUST——"如果一个requirement包含三个'还有'子句，那它实际上是三个requirement。拆分它们。"（`writing-specs.md` 第27行）。可独立测试
- **Scenario（GIVEN/WHEN/THEN）**：必须真正exercise需求，覆盖edge case——"只是用另一种方式复述requirement的scenario什么也测试不了。"（第44行）
- **Delta机制**：ADDED/MODIFIED/REMOVED描述变更而非重述全部。Brownfield是first-class概念——"大部分工作是修改现有行为。Delta让修改变成一等公民，而非事后补充。"（`concepts.md` 第405行）
- **Progressive Rigor**：Lite spec（默认）vs Full spec（高风险变更）——"大部分变更应该保持在Lite模式。"（`concepts.md` 第169行）
- **Spec只描述外部行为**：类名、库选择放在design.md，不放入spec——"如果实现可以在不改变外部可见行为的情况下变更，那它很可能不属于spec。"（`concepts.md` 第153行）
- **Enablers not Gates**：artifact依赖是"使能"而非"门禁"——"依赖是使能器而非门禁。它们展示可以创建什么，而非必须接着创建什么。"（`concepts.md` 第455行）
- **Right-size the change**：一个change一个意图——"一个好的change有一个可以用一句话说清的意图。"（`writing-specs.md` 第65行）

**产出：** change文件夹（proposal.md + design.md + specs/ delta + tasks.md）

**历史踩坑：**

| 阶段 | 问题 | 修复 |
|------|------|------|
| 早期 | 过度结构化——探索阶段就要求结构化产出，限制了思考自由度 | 逐步放松为 "Enablers not Gates"，Explore定位为 "stance not workflow"，不创建change、不写artifact |
| 早期 | Review阻断导致用户用 `--no-validate` 完全跳过验证 | Verify不阻断Archive，暴露问题让人类决策——"Match the ceremony to the stakes" |
| 设计阶段 | Spec与实现细节混淆——spec中包含类名、库选择等实现信息 | 明确分离：spec只描述外部行为，实现细节放在design.md——"behavior, not code" |
| 持续存在 | AI生成的spec质量参差不齐——vague requirement、无scenario的requirement、scenario不测试requirement | writing-specs.md提供详细的good/bad示例 + quick checklist + "How to steer the AI toward a good draft" 指导 |
| 持续存在 | Spec过大——一个change试图同时做三件事 | "Right-size the change" 指导：识别过大change的信号（scope读起来像不相关功能列表、review需要一下午、两人无法并行），拆分为多个change |

**核心教训：** Spec的核心是"行为契约"而非"实现计划"。OpenSpec从"硬性约束"转向"柔性使能"的演进主线，核心洞察是：spec的价值不在于格式有多严格，而在于它是否准确描述了"系统应该做什么"——外部可观察的行为。Delta机制让spec在Brownfield场景下不再需要重述全部现有行为，只描述变更。

### 1.3 ECC：Acceptance Brief（AC-NNN）

ECC的Spec由 `intent-driven-development` 的Acceptance Brief承担（`skills/intent-driven-development/SKILL.md`）。

**关键设计：**

- **AC-NNN格式**：Scenario + Action + Expected + Must not + Verification + Priority。每个AC必须可观察——"不要使用'正确地'、'安全地'、'快速地'、'直觉的'或'健壮的'等词语而不定义可观察的证据"（`SKILL.md` 第188-189行）
- **产品/业务约束列为"supplied/assumed"**：不从代码推断——"代码仓库告诉你系统今天如何运作，而非业务要求它做什么。"（第157-160行）
- **两种深度**：Quick Capture（3-7个AC，低风险）vs Full Acceptance Brief（含Risk Review表 + Blocking Decisions，安全/数据/迁移变更）——"使用最小有用的输出。"（第100行）
- **Pass/Fail Rubric**：5项检查，任一no则修改——"只有每个回答都是'是'时brief才通过"（第335行）
- **不默认阻断实现**：只在blocking risk时等待确认——"默认不阻断实现。"（第73行）
- **AC revision机制**：实现中发现AC不可满足时，标记 `[revised]`、更新scope/verification、增量revision number、只re-present变更的AC——"不要静默丢弃或绕过它"（第91-96行）

**产出：** Acceptance Brief（一次性工作产物，无持久化spec存储、无Delta、无source of truth）

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| Skills概率性触发（50-80%）导致spec阶段的观察数据不可靠 | 改用PreToolUse/PostToolUse hooks（100% 可靠）捕获会话活动 |
| Agent自评倾向于"一切正常"，spec的自我检查走过场 | 5轴评分（Accuracy/Completeness/Correctness/Actionability/Conciseness），低分项必须引用具体证据，"Everything is a 5" 被明确禁止 |
| 无结构化的spec持续演进模型——AC是一次性工作产物，不随变更更新 | 未修复——ECC的设计取向是"提供素材不定义流程"，spec持续演进是OpenSpec的关注点 |
| intent-driven-development不默认阻断——足够清晰的请求记录标准后继续 | 这是有意为之——"够用的验收标准记录后继续实现"比"完整探索后才能动手"更实用 |
| AC revision被静默处理——实现中发现AC不可满足时直接workaround | 引入显式revision机制：标记 `[revised]`、更新scope/verification、增量revision number、re-present给用户 |

**核心教训：** Spec的深度应该跟风险匹配。ECC的两种深度（Quick Capture vs Full Brief）是对"一刀切"的直接回应——低风险变更不需要Full Brief，高风险变更不能只做Quick Capture。但AC作为一次性工作产物不持续演进，这意味着系统演进后AC不再描述当前行为——这是ECC有意识接受的tradeoff。

### 1.4 mattpocock-skills：PRD模板

mattpocock的Spec由 `/to-spec` 承担（`skills/engineering/to-spec/SKILL.md`）。将当前对话上下文综合为spec（PRD），发布到issue tracker。

**关键设计：**

- **不做grilling**：只综合已有对话，不做新的探索——"不要采访用户——只综合你已知的信息。"（`SKILL.md` 第7行）
- **Spec模板**：Problem Statement + Solution + User Stories（大量编号列表）+ Implementation Decisions + Testing Decisions + Out of Scope + Further Notes
- **明确禁止file paths和code snippets**："不要包含具体的文件路径或代码片段。它们很快就会过时。"（第55行）
- **例外**：prototype产出的编码了决策的snippet可以内联——"如果prototype产出了一个比文字描述更精确地编码了决策的snippet（状态机、reducer、schema、类型形状），将其内联"（第57行）
- **使用CONTEXT.md词汇和ADR约束**——"在整个spec中使用项目的领域术语词汇，并遵守所有ADR"（第13行）
- **disable-model-invocation: true**——用户手动触发，不自动调用

**产出：** PRD发布到issue tracker（一次性，无Delta、无source of truth、无archive合并）

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v1.1.0之前 | `to-prd`、`to-plan`、`to-issues` 三个skill在实际使用中总是连续调用，拆分反而增加了认知负担和上下文切换成本 | v1.1.0合并为 `to-spec`（原 `to-prd`）和 `to-tickets`（原 `to-plan` + `to-issues`），`to-issues` 被删除。"spec" 成为贯穿术语 |
| v1.1.0之前 | spec中包含file paths和code snippets，但代码变更后spec中的引用过时 | 明确禁止——"they go stale fast"。例外：prototype产出的编码了决策的snippet可以内联 |
| v1.0.0 | `to-prd` 的名称不够直觉——"PRD" 是产品术语，不是工程通用术语 | v1.1.0重命名为 `to-spec`——"spec" 是单一贯穿术语。保留"you may know this document as a PRD"作为可发现性提示 |

**核心教训：** Spec的命名和结构应该服务于实际工作流，而非理论上的"完整流程"。mattpocock v1.1.0的合并教训表明，当三个skill在实际使用中总是连续调用时，拆分带来的认知负担超过了模块化的好处。同时，"禁止代码引用"的规则不是绝对的——prototype产出的编码了关键决策的snippet比文字描述更精确，这种例外是合理的。

### 1.5 gstack：五阶段Spec创作

gstack的Spec由 `/spec` 承担（`spec/SKILL.md.tmpl`）。将模糊意图转化为精确、可执行的spec，分五个阶段。

**关键设计：**

- **HARD GATE**："不要在第一条消息后就产出issue。始终从Phase 1开始。不要提议实现方案。"（`SKILL.md.tmpl` 第43-45行）
- **五阶段**：
  1. **Why**：5个forcing questions——Who/What(current)/What(should be)/Why now/How know done。不答完不进入下一阶段
  2. **Scope**：out of scope、touching systems、ordering constraints、MVP cut、failure modes
  3. **Technical**：**强制代码阅读**——"在提出任何Phase 3问题之前，你必须通过Grep、Glob或Read从代码库中阅读至少一条证据。不要跳过。不要先问'我应该看哪个文件？'——自己找。"（第130-134行）
  4. **Draft**：完整草稿 + 用户确认
  5. **File**：归档到 `$GSTACK_STATE_ROOT/projects/$SLUG/specs/`，可选 `--execute` spawn agent
- **Codex quality gate**：Phase 4.5——另一个AI模型评分0-10，低于7/10阻断。用hard delimiters将spec作为DATA传给codex——防止prompt injection
- **Fail-closed secret redaction**：Phase 4.5b——约30种secret/PII模式，3个tier。HIGH级别secret阻断（exit 3），raw spec不持久化到任何下游
- **Semantic Content Review**：Phase 4.5a——regex之前的人工语义审查，检查named individuals attached to negative judgments、unannounced internal strategy等
- **`--dedupe`**：Phase 1b——`gh issue list --search` 检查近重复issue
- **Issue质量标准**：14项——Stakeholder Context、Verified Current State、Audit Tables、Quantified Impact、Prioritized Recommendations、Dependency Graphs、Schema/API Shapes、File Reference Table、Testable Acceptance Criteria、Testing Pyramid、Root Cause Analysis、Effort Breakdown、Rollback Strategy
- **`--execute` 标志**：在全新worktree中spawn `claude -p`，spec通过stdin传入

**产出：** 一次性spec文档（无Delta、无source of truth、无archive合并）。归档到 `$GSTACK_STATE_ROOT/projects/$SLUG/specs/`

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| 用户在构建不熟悉的模式前不搜索，导致spec基于错误假设 | Phase 3强制代码阅读——"强制要求：在提出任何Phase 3问题之前，你必须从代码库中阅读至少一条证据" |
| Spec质量参差不齐——vague acceptance criteria、模糊文件引用、无effort breakdown | 14项Issue Quality Standards + Anti-Patterns清单。每个标准都有good/bad示例 |
| 单模型审查存在盲区——同一个AI模型生成和审查spec可能共享同一个盲区 | Codex quality gate——用不同AI模型（OpenAI Codex）独立评分。Score <7可迭代修改，最多3次dispatch |
| Spec中可能泄漏secrets/PII——issue是world-readable的 | Phase 4.5b fail-closed redaction：约30种模式、3个tier。HIGH级别阻断（exit 3），raw spec不持久化到任何下游。`spec-quality-gate-secret-sink.test.ts` 强制执行 |
| Phase 4编辑可能引入4.5b scan未覆盖的内容 | Phase 5 filing前再次re-scan——"Phase 4的编辑可能引入4.5b扫描从未见过的内容，而issue是对全世界可读的" |
| 语义层面的敏感信息（named individuals、unannounced strategy）regex无法捕获 | Phase 4.5a Semantic Content Review——结构化语义重读，检查5类语义风险 |

**核心教训：** Spec的质量保障需要多层防御——强制代码阅读防止"凭空设计"，跨模型评分消除单模型盲区，fail-closed redaction防止信息泄漏，semantic review捕获regex无法覆盖的语义风险。gstack是唯一将"强制代码阅读"作为spec阶段硬性要求的项目——这对Brownfield场景尤为重要。

---

## 2. 关键差异

### 2.1格式化程度光谱

| 级别 | 代表项目 | 格式 | 可程序化解析 |
|------|---------|------|------------|
| **结构化行为契约** | OpenSpec | Requirement（RFC 2119）+ Scenario（GIVEN/WHEN/THEN）+ Delta | ✅ validator.ts程序化验证 |
| **半结构化AC** | ECC | AC-NNN（Scenario + Action + Expected + Must not + Verification） | ⚠️ 有模板但无程序化验证 |
| **模板化PRD** | mattpocock | Problem + Solution + User Stories + Decisions | ❌ 自由文本 |
| **五阶段渐进** | gstack | Why → Scope → Technical → Draft → File | ❌ 自由文本 |
| **自由Markdown** | Superpowers | 无固定格式，按section complexity调节 | ❌ 完全自由 |

**关键观察：** 只有OpenSpec的spec可以被程序化解析和验证。这意味着只有OpenSpec能实现"delta合并回source of truth"的自动化——其他项目的spec都需要人工理解才能维护。

### 2.2持久化策略对比

| 项目 | Spec持久化 | 随变更演进 | Source of Truth |
|------|-----------|-----------|----------------|
| **Superpowers** | ✅ 文件系统（docs/superpowers/specs/） | ❌ 一次性 | ❌ 无 |
| **OpenSpec** | ✅ change文件夹 + specs/ 目录 | ✅ Delta合并 | ✅ specs/ 是持续source of truth |
| **ECC** | ❌ 一次性工作产物 | ❌ | ❌ 无 |
| **mattpocock** | ✅ issue tracker（外部） | ❌ 一次性 | ❌ 无 |
| **gstack** | ✅ 文件系统（$GSTACK_STATE_ROOT/projects/） | ❌ 一次性 | ❌ 无 |

**关键观察：** 只有OpenSpec的spec是"系统当前行为的持续记录"。其他4个项目的spec都是"为当前变更服务的一次性文档"——描述"要做什么"而非"系统当前行为是什么"。

### 2.3质量保障机制对比

| 项目 | 质量保障 | 强制程度 |
|------|---------|---------|
| **Superpowers** | Spec self-review（placeholder scan, consistency, scope, ambiguity）+ User review gate | 中（self-review是自检，user gate是人工） |
| **OpenSpec** | validator.ts程序化验证（格式、一致性、依赖关系） | 高（程序化，不通过则propose失败） |
| **ECC** | Pass/Fail Rubric（5项检查） | 中（自检，不默认阻断） |
| **mattpocock** | 无显式质量保障 | 低 |
| **gstack** | Codex quality gate（7/10门槛）+ secret redaction + semantic review | 高（跨模型评分，低于7/10阻断） |

**关键观察：** 质量保障从"自检"（Superpowers, ECC）到"程序化验证"（OpenSpec）到"跨模型评分"（gstack）逐步升级。OpenSpec的程序化验证是最确定的——格式错误会被validator捕获，不依赖AI推理。gstack的跨模型评分是最全面的——用不同AI模型审查spec质量。

---

## 3. 历史踩坑汇总与经验教训

### 3.1踩坑类型分类

将五个项目在Spec节点的历史踩坑按类型归纳，可以发现一些反复出现的模式：

**类型一：Spec质量保障被跳过**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers v5.0.0前 | Spec review loop只存在于prose中，不在checklist/diagram中——agent跟随diagram跳过了review (#677) | agent跟随diagram和checklist的可靠性远高于prose | 将spec review添加到checklist和dot graph |
| Superpowers v5.0.6 | Spec review loop执行25分钟但质量与无review一致 | subagent dispatch + 3-iteration cap成本过高 | 替换为inline self-review（30秒，质量相当） |
| ECC | Agent自评倾向于"一切正常" | 无结构化反思要求 | 5轴评分，低分必须引用证据，禁止"Everything is a 5" |

**类型二：Spec包含不该包含的内容**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| mattpocock | Spec包含file paths和code snippets，代码变更后过时 | 没有明确禁止 | 明确禁止——"they go stale fast"。例外：prototype snippet可内联 |
| OpenSpec | Spec中包含类名、库选择等实现细节 | 行为与实现混淆 | 明确分离：spec只描述外部行为，实现放design.md |
| gstack | Spec中可能泄漏secrets/PII | issue是world-readable的 | Fail-closed redaction + semantic review |

**类型三：Spec过大或过小**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| OpenSpec | 一个change试图同时做三件事 | 缺少right-size指导 | "Right-size the change"——一个意图一句话能说完 |
| Superpowers | 多子系统项目在一个spec中 | 缺少scope check | Scope check——多子系统项目分解为多个spec→plan→implementation循环 |
| ECC | 所有变更都走同一种spec深度 | 缺少深度调节 | Quick Capture vs Full Brief |

**类型四：Spec不持续演进**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers | Design doc在项目演进后成为历史文档 | 无Delta机制 | 不修复——一次性文档设计 |
| ECC | AC是一次性工作产物，不随变更更新 | 无source of truth | 不修复——ECC的设计取向 |
| mattpocock | PRD发布到issue tracker后不随系统演进 | 无Delta机制 | 不修复——一次性文档设计 |
| gstack | Spec归档后不再更新 | 无Delta机制 | 不修复——一次性文档设计 |
| OpenSpec | Spec需要持续维护 | 有Delta机制 | ✅ Delta合并——每次archive将delta合并回source of truth |

**类型五：Spec命名和结构不适配实际工作流**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| mattpocock v1.1.0前 | to-prd/to-plan/to-issues三个skill总是连续调用 | 过度拆分 | 合并为to-spec + to-tickets |
| mattpocock v1.1.0前 | "PRD" 命名不够直觉 | 产品术语而非工程通用术语 | 重命名为 "spec" |

### 3.2经验教训总结

从五个项目的踩坑历史中，可以提炼出以下经验教训：

**教训一：Spec质量保障机制需要出现在agent实际遵循的地方**

Superpowers的 #677 bug是最有启发性的案例——spec review存在于prose中但被完全跳过，因为agent跟随checklist和process flow diagram而非prose。这意味着：任何质量保障步骤如果只存在于prose中，它会被跳过。必须将其放入checklist、diagram或其他agent实际遵循的结构中。

**教训二：Subagent审查不总是比inline自检好**

Superpowers v5.0.6的回归测试证明——25分钟的subagent spec review与30秒的inline self-review质量一致。这不意味着subagent审查无用，而是意味着在spec这种"文档审查"场景下，inline自检的性价比可能更高。subagent审查更适合需要认知隔离的场景（如code review）。

**教训三：Spec应该描述行为而非实现**

OpenSpec和mattpocock都在这个方向上做了明确约束——OpenSpec禁止spec包含类名和库选择（放在design.md），mattpocock禁止file paths和code snippets（"they go stale fast"）。这是共识：spec描述"系统应该做什么"，实现细节放在别处。

**教训四：Spec过大是常见问题**

OpenSpec的"Right-size the change"指导和Superpowers的scope check都指向同一个问题——AI倾向于在一个spec中塞入过多内容。一个好的spec应该有一个可以用一句话说清的意图。

**教训五：只有结构化spec才能持续演进**

OpenSpec是唯一实现spec持续演进的项目——这依赖于结构化格式（Requirement + Scenario）+ Delta机制 + validator + source of truth。其他4个项目的spec都是一次性的。这不是说一次性spec不好——对于短期项目，一次性spec更简单。但对于长期维护的项目，spec过时是必然的，除非有Delta机制。

---

## 4. 实践方向讨论

### 4.1结构化vs自由格式：Spec应该多结构化？

**OpenSpec的立场**：Spec必须结构化。Requirement + Scenario + RFC 2119关键词让spec可程序化解析、可独立验证、可映射测试。结构化是Delta机制的前提——只有结构化的spec才能程序化合并。

**Superpowers的立场**：Spec应该自由。探索阶段的设计文档需要包含架构图、数据流、错误处理等非结构化内容。过早结构化会限制探索的深度。

**tradeoff分析：**

- **结构化的优势**：可程序化解析、可独立验证、可映射测试、支持Delta自动合并
- **结构化的代价**：编写成本高（需要理解RFC 2119、GIVEN/WHEN/THEN格式）、限制表达力、可能不适合所有类型的设计（如UI设计、架构决策）
- **自由格式的优势**：低编写门槛、表达力强、适合模糊的探索阶段
- **自由格式的代价**：无法程序化验证、无法自动合并、依赖人工理解

**可能的好的实践方向**：分层结构化——Spec的核心行为描述用结构化格式（Requirement + Scenario），辅助设计文档用自由格式。OpenSpec已经这样做了——specs/ 是结构化的，design.md是自由的。但OpenSpec的结构化格式编写成本高，可能需要AI辅助生成（这正是 `/opsx:propose` 的功能）。

### 4.2 Delta机制：Spec应该描述全量还是变更？

**OpenSpec的Delta机制**是五个项目中唯一将Brownfield作为first-class概念的设计。

**Delta的价值链：**
1. Propose时：只描述要改的部分（ADDED/MODIFIED/REMOVED）
2. Apply时：开发者只关注变更
3. Review时：审查者只看delta，快速理解变更范围
4. Verify时：验证变更是否实现了delta中的requirement
5. Archive时：delta合并回source of truth

**其他项目都是全量spec：**
- Superpowers的design doc描述完整设计
- ECC的Acceptance Brief描述完整需求
- mattpocock的PRD描述完整方案
- gstack的 /spec描述完整技术方案

**全量spec的问题：** 在Brownfield场景下，全量spec要么重述大量现有行为（冗余），要么只描述新行为（但与现有行为的关系不明确）。Delta机制解决了这个问题——只描述变更，通过source of truth维护完整图景。

**可能的好的实践方向**：Brownfield场景下，Delta机制有显著优势。但Delta机制的前提是结构化spec（才能程序化合并）和source of truth（才能合并到）。这意味着Delta机制的采用成本较高——需要像OpenSpec那样的完整工具链（validator + archive + specs-apply）。对于不需要spec持续演进的项目，全量spec可能更简单。

### 4.3 Progressive Rigor：Spec的深度应该可调吗？

**ECC的两种深度**：Quick Capture（3-7个AC，低风险）vs Full Acceptance Brief（含Risk Review，高风险）。

**OpenSpec的Progressive Rigor**：Lite spec（默认）vs Full spec（高风险变更）。

**其他项目没有显式的深度调节**：Superpowers所有项目都走完整brainstorming；mattpocock所有spec都用同一个PRD模板；gstack所有spec都走五阶段。

**tradeoff分析：**

- **可调深度的优势**：低风险变更不延迟（Quick Capture / Lite spec），高风险变更有充分保障（Full Brief / Full spec）
- **可调深度的代价**：需要判断"什么算高风险"——判断错误会导致低风险变更走重流程（浪费）或高风险变更走轻流程（不足）
- **固定深度的优势**：简单——不需要判断风险等级
- **固定深度的代价**：要么所有变更都走重流程（门槛高），要么都走轻流程（保障不足）

**可能的好的实践方向**：可调深度是合理的方向，但需要明确的风险分级标准。ECC用"安全/数据/迁移变更"作为Full Brief的触发条件，OpenSpec用"高风险变更"作为Full spec的触发条件——两者都需要用户或agent判断风险等级。

### 4.4 Spec质量保障：自检vs程序化vs跨模型

三种质量保障机制代表了不同的确定性级别：

- **自检（Superpowers, ECC）**：AI自己检查自己的spec——速度最快但可能盲区
- **程序化验证（OpenSpec）**：工具检查spec格式——最确定但只能检查格式，不能检查内容质量
- **跨模型评分（gstack）**：另一个AI模型评分——最全面但成本最高

**tradeoff分析：**

- 自检的成本最低（30s）但效果依赖AI自我认知能力
- 程序化验证的成本中等但只覆盖格式层面（一个Requirement是否有SHALL/MUST，Scenario是否有GIVEN/WHEN/THEN）
- 跨模型评分的成本最高（需要两个AI服务）但能发现内容质量问题（逻辑漏洞、遗漏edge case）

**可能的好的实践方向**：组合使用——程序化验证确保格式正确（如OpenSpec），自检确保内容一致（如Superpowers），跨模型评分在高风险变更时启用（如gstack）。这形成了"格式 → 一致性 → 质量"的三层保障。

---

## 5. 案例映射

### 5.1 "Spec过时"的失败模式

全量spec的最大问题是过时——系统演进后，spec不再描述系统当前行为。

**OpenSpec的解决**：Delta机制让spec随变更有机增长——每次archive将delta合并回source of truth。spec不会过时，因为每次变更都更新了它。

**其他项目的问题**：Superpowers的design doc在项目演进后成为历史文档（不再描述当前状态）。ECC的Acceptance Brief是一次性的。mattpocock的PRD发布到issue tracker后不随系统演进。gstack的spec归档后不再更新。

**映射**：如果一个项目长期维护，spec过时是必然的——除非有Delta机制持续更新。但对于短期项目或一次性变更，全量spec可能足够。

### 5.2 "Spec包含代码"的失败模式

mattpocock明确禁止spec包含file paths和code snippets——"they go stale fast"。代码会变，但spec中的代码引用不会自动更新。

**OpenSpec的立场**：Spec只描述外部行为，不包含实现细节（类名、库选择放在design.md）。

**Superpowers的立场**：design doc可以包含架构细节但不包含具体代码——代码在writing-plans阶段产出。

**ECC的立场**：Acceptance Brief的Implementation Decisions包含模块/接口/架构但不含具体代码。

**映射**：共识是spec不应包含具体代码——但"实现细节"的边界在哪里？OpenSpec最严格（类名都不放），mattpocock允许"编码了决策的snippet"（来自prototype）。这个边界的把握需要判断力。

### 5.3 "凭空设计"的失败模式

gstack的 /spec Technical阶段强制代码阅读——"不允许凭空设计"。这是一个针对AI agent的设计：agent可能在不读现有代码的情况下"凭空"设计方案，导致方案与现有代码不兼容。

**映射到其他项目：**
- Superpowers的brainstorming有 "Working in existing codebases" 指令但不强制代码阅读
- OpenSpec的explore鼓励"调查代码库"但不强制
- ECC的intent-driven-development先检查上下文但不强制代码阅读
- mattpocock的grill-with-docs在grilling过程中读代码但不强制

gstack是唯一将"强制代码阅读"作为spec阶段硬性要求的项目。这对Brownfield场景尤为重要——不读代码就设计方案，几乎必然导致不兼容。

### 5.4 "Spec质量低但通过了"的失败模式

如果没有质量保障，低质量spec会流入下游——导致plan基于错误的spec，execute实现错误的方案。

**Superpowers的解决**：Spec self-review（placeholder scan, consistency, scope, ambiguity）+ User review gate。但self-review是AI自检——可能盲区。

**OpenSpec的解决**：validator.ts程序化验证格式。但格式正确不等于内容正确——一个格式完美的spec可能逻辑漏洞百出。

**gstack的解决**：Codex quality gate（7/10门槛）。用不同AI模型审查——能发现单个模型的盲区。但7/10门槛是主观的。

**映射**：每种质量保障都有盲区。自检盲于自我认知，程序化验证盲于内容质量，跨模型评分盲于"两个模型可能共享同一个盲区"。组合使用可能是最稳健的方案。

---

## 6. 总结：Spec节点的实践参考

> **声明：** 以下总结基于五个项目的实践经验和踩坑教训，试图提炼出一些有参考价值的结论。但这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中寻找一些相对普遍的规律，供读者参考和批判。

### 6.1总体要求

经过对五个项目的全面分析，我们认为Spec节点需要满足以下总体要求：

**要求一：将探索结果转化为可验证的行为描述**

这是Spec节点的核心使命——探索阶段产出的是"问题定义"和"方向共识"，Spec节点需要将其转化为"可以判断对错的行为描述"。五个项目虽然格式差异巨大（从自由Markdown到RFC 2119结构化契约），但都在做这件事——Superpowers的design doc、OpenSpec的Requirement+Scenario、ECC的AC-NNN、mattpocock的PRD、gstack的五阶段spec，本质上都是将模糊意图转化为可验证的规格。

**要求二：区分"行为"和"实现"**

OpenSpec的"behavior, not code"原则和mattpocock的"no file paths or code snippets"规则都指向同一个方向——Spec应该描述"系统应该做什么"而非"系统应该怎么实现"。实现细节（类名、库选择、代码片段）会随代码变更而过时，但行为描述更稳定。

**要求三：Spec质量需要有保障机制**

Superpowers的 #677 bug证明——如果质量保障步骤只存在于prose中而不在agent实际遵循的结构中，它会被跳过。ECC的"Everything is a 5"教训证明——没有结构化反思要求的自评会走过场。质量保障需要出现在agent实际会执行的地方。

**要求四：Spec深度应该跟风险匹配**

一刀切的spec深度要么过重（简单变更走完整spec），要么过浅（复杂变更只做快速spec）。ECC的两种深度和OpenSpec的Progressive Rigor都指向这个方向。

### 6.2应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **将质量保障步骤放入checklist/diagram** | agent跟随checklist和process flow diagram的可靠性远高于prose——只存在于prose中的步骤会被跳过 | Superpowers（#677修复） |
| **区分行为和实现** | 行为描述比实现细节更稳定——代码会变但行为不变。实现细节放design.md或不放入spec | OpenSpec、mattpocock |
| **按风险调节spec深度** | 低风险变更快速通过，高风险变更有充分保障 | ECC（Quick Capture vs Full Brief）、OpenSpec（Progressive Rigor） |
| **Brownfield场景下强制代码阅读** | 不读代码就设计方案，几乎必然导致不兼容 | gstack（Phase 3 mandatory code reading） |
| **Spec应有一个可以用一句话说清的意图** | 过大的spec难以审查、难以实现、难以理解 | OpenSpec（"Right-size the change"）、Superpowers（scope check） |
| **对高风险spec用跨模型审查** | 单模型审查存在盲区——不同AI模型可能系统性地忽略不同类型问题 | gstack（Codex quality gate） |
| **防止spec泄漏敏感信息** | spec可能发布到world-readable的issue tracker——secrets/PII需要在发布前redact | gstack（fail-closed redaction + semantic review） |
| **Inline自检优先于subagent审查** | 回归测试证明inline自检（30s）与subagent审查（25min）质量一致——文档审查场景下inline性价比更高 | Superpowers（v5.0.6） |
| **允许prototype snippet例外** | 编码了关键决策的snippet比文字描述更精确——完全禁止代码会损失表达力 | mattpocock |

### 6.3不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该让质量保障步骤只存在于prose中** | agent跟随checklist/diagram而非prose——只存在于prose中的步骤会被跳过 | Superpowers（#677） |
| **不应该在spec中包含具体代码和文件路径** | 代码会变但spec中的引用不会自动更新——"they go stale fast" | mattpocock（教训后的规则） |
| **不应该完全信任agent的"spec已充分"自评** | agent自评倾向于"一切正常"——没有结构化反思时会走过场 | ECC（"Everything is a 5"） |
| **不应该用一个spec覆盖多个不相关的意图** | 过大的spec难以审查、难以实现、难以理解 | OpenSpec（"Right-size the change"） |
| **不应该让spec阶段的description包含workflow摘要** | agent会跟随description而不读取skill正文——description只描述触发条件 | Superpowers（"The Description Trap"） |
| **不应该在spec发布到issue tracker前不做secret redaction** | issue是world-readable的——secrets/PII泄漏后果严重 | gstack（fail-closed redaction的存在本身就是教训） |
| **不应该在Brownfield场景下不读代码就写spec** | 不读代码就设计方案，几乎必然导致不兼容 | gstack（Phase 3强制代码阅读的存在本身就是教训） |
| **不应该将spec拆分为实际使用中总是连续调用的多个skill** | 拆分增加认知负担和上下文切换成本 | mattpocock（v1.1.0合并to-prd/to-plan/to-issues） |

### 6.4需要关注什么

在Spec节点的实践中，以下几个方面值得持续关注：

**关注点一：Spec的持续演进vs一次性使用**

只有OpenSpec实现了spec的持续演进（Delta机制 + source of truth）。其他4个项目的spec都是一次性的——系统演进后spec过时。对于长期维护的项目，spec过时是必然的——除非有Delta机制。但Delta机制的采用成本较高（需要结构化格式 + validator + 合并工具）。实践中需要权衡：项目是否需要spec持续演进？如果需要，是否愿意承担Delta机制的工具链成本？

**关注点二：Spec质量保障的"最后一公里"**

程序化验证（OpenSpec）能检查格式但不能检查内容质量。跨模型评分（gstack）能发现内容质量问题但成本高且依赖外部服务。inline自检（Superpowers）性价比高但可能盲区。三种机制都有盲区——组合使用可能是最稳健的方案，但组合的成本和复杂度也需要考虑。

**关注点三：Spec与Explore的边界**

Explore产出"问题定义"，Spec产出"行为契约"——但两者的边界并不总是清晰。Superpowers的brainstorming产出的是design doc（更接近Spec），而ECC的Quick Capture产出的是AC列表（更接近Explore）。在实践中需要明确：Spec的起点在哪里？是从探索结束开始，还是从第一个结构化产出开始？

**关注点四：Spec中"实现细节"的边界**

共识是spec不应包含具体代码——但"实现细节"的边界在哪里？OpenSpec最严格（类名都不放），mattpocock允许"编码了决策的snippet"（来自prototype），gstack的Issue质量标准包含"Schema, API Shapes, and Data Models"（接近代码但不是代码）。这个边界的把握需要判断力，取决于项目的复杂度和团队的习惯。

**关注点五：Spec阶段的prompt injection风险**

gstack是唯一显式处理spec阶段prompt injection风险的项目——用hard delimiters将spec作为DATA传给codex，防止spec内容被当作指令执行。其他项目没有显式处理这个风险。当spec发布到issue tracker或传给其他AI模型审查时，prompt injection是一个真实的风险。

### 6.5怎么观察效果

Spec阶段的效果可以通过以下信号观察：

**正面信号（Spec有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Plan阶段不需要"从头开始" | Spec为Plan提供了有效输入 | Plan阶段是否大量引用spec的行为描述 |
| 实现阶段没有出现"这不是要做的" | Spec准确描述了要做什么 | 实现阶段是否需要大幅返工 |
| Review/Verify阶段可以对照spec验证 | Spec是可验证的行为契约 | Reviewer是否能基于spec判断实现是否正确 |
| Spec的acceptance criteria被直接用作测试基准 | Spec中的AC有实际验证价值 | 测试是否引用spec中的scenario |
| Spec通过了质量保障（validator/quality gate/self-review） | 质量保障机制有效工作 | 检查质量保障是否实际执行 |

**负面信号（Spec有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Plan阶段重新定义spec中的内容 | Spec不够精确或不被信任 | Plan是否在重复spec已经讨论过的内容 |
| 实现阶段发现spec中的行为描述有歧义 | Spec的"可验证"性不足 | 实现时是否对spec的理解产生分歧 |
| Spec质量保障步骤被跳过 | 质量保障不在agent实际遵循的结构中 | 检查quality gate/self-review是否实际执行 |
| Spec中包含已过时的代码引用 | Spec包含了不该包含的实现细节 | 检查spec中的file paths/code snippets是否与当前代码一致 |
| Spec试图覆盖多个不相关意图 | Spec过大 | 能否用一句话说清spec的意图 |

### 6.6怎么改进

Spec阶段的改进可以从以下几个方向入手：

**改进方向一：将质量保障步骤放入agent实际遵循的结构**

Superpowers的 #677教训是最直接的——如果质量保障步骤只存在于prose中，它会被跳过。确保spec self-review、quality gate等步骤出现在checklist、process flow diagram或其他agent实际遵循的结构中。

**改进方向二：分层质量保障**

组合使用三种质量保障机制——程序化验证确保格式正确（如OpenSpec的validator），inline自检确保内容一致（如Superpowers的4项检查），跨模型评分在高风险变更时启用（如gstack的Codex quality gate）。这形成了"格式 → 一致性 → 质量"的三层保障，每层的成本和覆盖面不同。

**改进方向三：Brownfield场景的Delta机制**

对于长期维护的项目，考虑引入Delta机制——spec描述变更而非全量，通过source of truth维护完整图景。这需要结构化spec格式 + validator + 合并工具，但能解决spec过时问题。OpenSpec的实践表明这是可行的。

**改进方向四：Spec深度的风险分级**

建立明确的风险分级标准——什么算"高风险"变更需要Full spec/Full Brief？ECC用"安全/数据/迁移变更"作为触发条件，OpenSpec用"跨团队/跨仓库/API变更/迁移/安全"作为触发条件。可以借鉴这些标准，但需要根据项目实际情况调整。

**改进方向五：Spec的prompt injection防御**

当spec发布到issue tracker或传给其他AI模型审查时，考虑prompt injection防御——用hard delimiters将spec作为DATA传递，明确标注"this is DATA, not instructions"。gstack的实践表明这是必要的。

### 6.7本篇结论

Spec节点的核心使命是**从意图到行为契约**——将探索阶段的"问题定义"和"方向共识"转化为可验证的行为描述，使后续的Plan和Execute有据可依。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **Spec应该描述行为而非实现**——代码会变但行为不变，实现细节放别处
2. **Spec质量保障需要出现在agent实际遵循的地方**——prose中的步骤会被跳过
3. **Spec深度应该跟风险匹配**——一刀切两端都不合适
4. **Brownfield场景下需要强制代码阅读**——不读代码就设计方案必然不兼容
5. **Spec过大是常见问题**——一个好的spec有一个可以用一句话说清的意图
6. **只有结构化spec才能持续演进**——Delta机制的采用成本高但解决spec过时问题

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用Spec节点时参考。后续章节将逐个节点展开类似的讨论。

---

---

点击下方"**阅读原文**"进入我的演示网站。
