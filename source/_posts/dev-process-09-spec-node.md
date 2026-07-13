---
title: AI 研发流程深度解析（九）：Spec 节点——从意图到行为契约
description: 对比 5 个项目如何将探索结果转化为可验证的行为规格，分析结构化程度、持久化策略和质量保障机制的关键差异。
tags:
  - 研发流程
  - Spec
  - 行为契约
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 5 个项目如何将探索结果转化为可验证的行为规格？结构化程度、持久化策略和质量保障机制有什么关键差异？各项目走过哪些弯路？我们能从中学到什么？

---

## 1. 对比分析

### 1.1 Superpowers：自由 Markdown 设计文档

Superpowers 的 Spec 产出是 brainstorming 的输出——一份自由 Markdown 设计文档，保存到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`（`skills/brainstorming/SKILL.md`）。

**关键设计：**

- **Design for isolation and clarity**：每个单元应能独立理解和测试——"能否在不阅读内部实现的情况下理解一个单元做什么？能否在不破坏调用方的情况下修改内部实现？如果不能，说明边界需要调整。"（`SKILL.md` 第 89-94 行）
- **Working in existing codebases**：跟随现有模式，不提议无关重构——"不要提议无关的重构。专注于服务当前目标的内容。"（第 99-100 行）
- **Spec self-review**：4 项 inline 自检——placeholder scan、internal consistency、scope check、ambiguity check。自检后直接 inline 修复——"直接 inline 修复任何问题。不需要重新审查——修复后继续。"（第 111-119 行）
- **User review gate**：spec 写完后用户审查才进入 plan——"等待用户回复。如果用户要求修改，做出修改并重新运行 spec review loop。只有用户批准后才继续。"（第 122-127 行）
- **无固定格式**：按 section complexity 调节长度，包含 architecture、components、data flow、error handling、testing
- **Scope check**：多子系统项目需要分解为多个设计单元——"如果请求描述了多个独立子系统，立即标记"（第 68 行）

**产出：** 设计文档（自由 Markdown），保存到 `docs/superpowers/specs/`

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v5.0.0 之前 | Spec review loop（dispatch subagent 审查 spec）存在于 prose 中但不在 checklist 和 process flow diagram 中——agent 跟随 diagram 而非 prose，导致 spec review 被完全跳过 (#677) | v5.0.1 将 spec review 步骤添加到 checklist 和 dot graph 中 |
| v5.0.6 | Spec review loop（subagent dispatch + 3-iteration cap）执行时间约 25 分钟，但跨 5 个版本 5 次试验的回归测试显示质量分数与无 review 一致 | v5.0.6 替换为 inline Spec Self-Review checklist（placeholder scan、consistency、scope、ambiguity），30 秒完成，质量相当 |
| v5.0.4 | Reviewer checklists 过于关注格式（task syntax、chunk size）而非实质（buildability、spec alignment），max iterations 为 5 导致过多轮次 | v5.0.4 精简 spec reviewer 从 7 类到 5 类，max iterations 从 5 减到 3，添加 Calibration section 只标记会导致实际问题的问题 |
| v4.0.0 | Description 字段包含 workflow 摘要时，agent 跟随 description 而不读取 skill 正文——"The Description Trap" | description 只描述触发条件（"Use when..."），绝不包含 workflow 摘要 |
| v5.0.1 之前 | spec 写完后直接进入 writing-plans，没有用户审查点——用户无法在 spec 阶段叫停 (#565) | v5.0.1 添加 explicit User Review Gate——用户必须在 spec 完成后审批才能进入 plan |

**核心教训：** Spec 的质量保障机制经历了从"subagent 审查"到"inline 自检"的演进——25 分钟的 subagent 审查与 30 秒的 inline 自检效果相同，但 inline 自检的摩擦低得多。关键洞察是：agent 跟随 checklist 和 process flow diagram 的可靠性远高于跟随 prose——如果一个步骤只存在于 prose 中，它会被跳过。

### 1.2 OpenSpec：结构化行为契约 + Delta 机制

OpenSpec 的 Spec 由 `/opsx:propose` 生成 change 文件夹（`docs/writing-specs.md`、`docs/concepts.md`）。Spec 是**行为契约**——描述系统外部可观察行为，不包含实现细节。

**关键设计：**

- **Requirement（RFC 2119）**：使用 MUST/SHALL/SHOULD，一个 Requirement 一个 SHALL/MUST——"如果一个 requirement 包含三个'还有'子句，那它实际上是三个 requirement。拆分它们。"（`writing-specs.md` 第 27 行）。可独立测试
- **Scenario（GIVEN/WHEN/THEN）**：必须真正 exercise 需求，覆盖 edge case——"只是用另一种方式复述 requirement 的 scenario 什么也测试不了。"（第 44 行）
- **Delta 机制**：ADDED/MODIFIED/REMOVED 描述变更而非重述全部。Brownfield 是 first-class 概念——"大部分工作是修改现有行为。Delta 让修改变成一等公民，而非事后补充。"（`concepts.md` 第 405 行）
- **Progressive Rigor**：Lite spec（默认）vs Full spec（高风险变更）——"大部分变更应该保持在 Lite 模式。"（`concepts.md` 第 169 行）
- **Spec 只描述外部行为**：类名、库选择放在 design.md，不放入 spec——"如果实现可以在不改变外部可见行为的情况下变更，那它很可能不属于 spec。"（`concepts.md` 第 153 行）
- **Enablers not Gates**：artifact 依赖是"使能"而非"门禁"——"依赖是使能器而非门禁。它们展示可以创建什么，而非必须接着创建什么。"（`concepts.md` 第 455 行）
- **Right-size the change**：一个 change 一个意图——"一个好的 change 有一个可以用一句话说清的意图。"（`writing-specs.md` 第 65 行）

**产出：** change 文件夹（proposal.md + design.md + specs/ delta + tasks.md）

**历史踩坑：**

| 阶段 | 问题 | 修复 |
|------|------|------|
| 早期 | 过度结构化——探索阶段就要求结构化产出，限制了思考自由度 | 逐步放松为 "Enablers not Gates"，Explore 定位为 "stance not workflow"，不创建 change、不写 artifact |
| 早期 | Review 阻断导致用户用 `--no-validate` 完全跳过验证 | Verify 不阻断 Archive，暴露问题让人类决策——"Match the ceremony to the stakes" |
| 设计阶段 | Spec 与实现细节混淆——spec 中包含类名、库选择等实现信息 | 明确分离：spec 只描述外部行为，实现细节放在 design.md——"behavior, not code" |
| 持续存在 | AI 生成的 spec 质量参差不齐——vague requirement、无 scenario 的 requirement、scenario 不测试 requirement | writing-specs.md 提供详细的 good/bad 示例 + quick checklist + "How to steer the AI toward a good draft" 指导 |
| 持续存在 | Spec 过大——一个 change 试图同时做三件事 | "Right-size the change" 指导：识别过大 change 的信号（scope 读起来像不相关功能列表、review 需要一下午、两人无法并行），拆分为多个 change |

**核心教训：** Spec 的核心是"行为契约"而非"实现计划"。OpenSpec 从"硬性约束"转向"柔性使能"的演进主线，核心洞察是：spec 的价值不在于格式有多严格，而在于它是否准确描述了"系统应该做什么"——外部可观察的行为。Delta 机制让 spec 在 Brownfield 场景下不再需要重述全部现有行为，只描述变更。

### 1.3 ECC：Acceptance Brief（AC-NNN）

ECC 的 Spec 由 `intent-driven-development` 的 Acceptance Brief 承担（`skills/intent-driven-development/SKILL.md`）。

**关键设计：**

- **AC-NNN 格式**：Scenario + Action + Expected + Must not + Verification + Priority。每个 AC 必须可观察——"不要使用'正确地'、'安全地'、'快速地'、'直觉的'或'健壮的'等词语而不定义可观察的证据"（`SKILL.md` 第 188-189 行）
- **产品/业务约束列为"supplied/assumed"**：不从代码推断——"代码仓库告诉你系统今天如何运作，而非业务要求它做什么。"（第 157-160 行）
- **两种深度**：Quick Capture（3-7 个 AC，低风险）vs Full Acceptance Brief（含 Risk Review 表 + Blocking Decisions，安全/数据/迁移变更）——"使用最小有用的输出。"（第 100 行）
- **Pass/Fail Rubric**：5 项检查，任一 no 则修改——"只有每个回答都是'是'时 brief 才通过"（第 335 行）
- **不默认阻断实现**：只在 blocking risk 时等待确认——"默认不阻断实现。"（第 73 行）
- **AC revision 机制**：实现中发现 AC 不可满足时，标记 `[revised]`、更新 scope/verification、增量 revision number、只 re-present 变更的 AC——"不要静默丢弃或绕过它"（第 91-96 行）

**产出：** Acceptance Brief（一次性工作产物，无持久化 spec 存储、无 Delta、无 source of truth）

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| Skills 概率性触发（50-80%）导致 spec 阶段的观察数据不可靠 | 改用 PreToolUse/PostToolUse hooks（100% 可靠）捕获会话活动 |
| Agent 自评倾向于"一切正常"，spec 的自我检查走过场 | 5 轴评分（Accuracy/Completeness/Correctness/Actionability/Conciseness），低分项必须引用具体证据，"Everything is a 5" 被明确禁止 |
| 无结构化的 spec 持续演进模型——AC 是一次性工作产物，不随变更更新 | 未修复——ECC 的设计取向是"提供素材不定义流程"，spec 持续演进是 OpenSpec 的关注点 |
| intent-driven-development 不默认阻断——足够清晰的请求记录标准后继续 | 这是有意为之——"够用的验收标准记录后继续实现"比"完整探索后才能动手"更实用 |
| AC revision 被静默处理——实现中发现 AC 不可满足时直接 workaround | 引入显式 revision 机制：标记 `[revised]`、更新 scope/verification、增量 revision number、re-present 给用户 |

**核心教训：** Spec 的深度应该跟风险匹配。ECC 的两种深度（Quick Capture vs Full Brief）是对"一刀切"的直接回应——低风险变更不需要 Full Brief，高风险变更不能只做 Quick Capture。但 AC 作为一次性工作产物不持续演进，这意味着系统演进后 AC 不再描述当前行为——这是 ECC 有意识接受的 tradeoff。

### 1.4 mattpocock-skills：PRD 模板

mattpocock 的 Spec 由 `/to-spec` 承担（`skills/engineering/to-spec/SKILL.md`）。将当前对话上下文综合为 spec（PRD），发布到 issue tracker。

**关键设计：**

- **不做 grilling**：只综合已有对话，不做新的探索——"不要采访用户——只综合你已知的信息。"（`SKILL.md` 第 7 行）
- **Spec 模板**：Problem Statement + Solution + User Stories（大量编号列表）+ Implementation Decisions + Testing Decisions + Out of Scope + Further Notes
- **明确禁止 file paths 和 code snippets**："不要包含具体的文件路径或代码片段。它们很快就会过时。"（第 55 行）
- **例外**：prototype 产出的编码了决策的 snippet 可以内联——"如果 prototype 产出了一个比文字描述更精确地编码了决策的 snippet（状态机、reducer、schema、类型形状），将其内联"（第 57 行）
- **使用 CONTEXT.md 词汇和 ADR 约束**——"在整个 spec 中使用项目的领域术语词汇，并遵守所有 ADR"（第 13 行）
- **disable-model-invocation: true**——用户手动触发，不自动调用

**产出：** PRD 发布到 issue tracker（一次性，无 Delta、无 source of truth、无 archive 合并）

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v1.1.0 之前 | `to-prd`、`to-plan`、`to-issues` 三个 skill 在实际使用中总是连续调用，拆分反而增加了认知负担和上下文切换成本 | v1.1.0 合并为 `to-spec`（原 `to-prd`）和 `to-tickets`（原 `to-plan` + `to-issues`），`to-issues` 被删除。"spec" 成为贯穿术语 |
| v1.1.0 之前 | spec 中包含 file paths 和 code snippets，但代码变更后 spec 中的引用过时 | 明确禁止——"they go stale fast"。例外：prototype 产出的编码了决策的 snippet 可以内联 |
| v1.0.0 | `to-prd` 的名称不够直觉——"PRD" 是产品术语，不是工程通用术语 | v1.1.0 重命名为 `to-spec`——"spec" 是单一贯穿术语。保留"you may know this document as a PRD"作为可发现性提示 |

**核心教训：** Spec 的命名和结构应该服务于实际工作流，而非理论上的"完整流程"。mattpocock v1.1.0 的合并教训表明，当三个 skill 在实际使用中总是连续调用时，拆分带来的认知负担超过了模块化的好处。同时，"禁止代码引用"的规则不是绝对的——prototype 产出的编码了关键决策的 snippet 比文字描述更精确，这种例外是合理的。

### 1.5 gstack：五阶段 Spec 创作

gstack 的 Spec 由 `/spec` 承担（`spec/SKILL.md.tmpl`）。将模糊意图转化为精确、可执行的 spec，分五个阶段。

**关键设计：**

- **HARD GATE**："不要在第一条消息后就产出 issue。始终从 Phase 1 开始。不要提议实现方案。"（`SKILL.md.tmpl` 第 43-45 行）
- **五阶段**：
  1. **Why**：5 个 forcing questions——Who/What(current)/What(should be)/Why now/How know done。不答完不进入下一阶段
  2. **Scope**：out of scope、touching systems、ordering constraints、MVP cut、failure modes
  3. **Technical**：**强制代码阅读**——"在提出任何 Phase 3 问题之前，你必须通过 Grep、Glob 或 Read 从代码库中阅读至少一条证据。不要跳过。不要先问'我应该看哪个文件？'——自己找。"（第 130-134 行）
  4. **Draft**：完整草稿 + 用户确认
  5. **File**：归档到 `$GSTACK_STATE_ROOT/projects/$SLUG/specs/`，可选 `--execute` spawn agent
- **Codex quality gate**：Phase 4.5——另一个 AI 模型评分 0-10，低于 7/10 阻断。用 hard delimiters 将 spec 作为 DATA 传给 codex——防止 prompt injection
- **Fail-closed secret redaction**：Phase 4.5b——约 30 种 secret/PII 模式，3 个 tier。HIGH 级别 secret 阻断（exit 3），raw spec 不持久化到任何下游
- **Semantic Content Review**：Phase 4.5a——regex 之前的人工语义审查，检查 named individuals attached to negative judgments、unannounced internal strategy 等
- **`--dedupe`**：Phase 1b——`gh issue list --search` 检查近重复 issue
- **Issue 质量标准**：14 项——Stakeholder Context、Verified Current State、Audit Tables、Quantified Impact、Prioritized Recommendations、Dependency Graphs、Schema/API Shapes、File Reference Table、Testable Acceptance Criteria、Testing Pyramid、Root Cause Analysis、Effort Breakdown、Rollback Strategy
- **`--execute` 标志**：在全新 worktree 中 spawn `claude -p`，spec 通过 stdin 传入

**产出：** 一次性 spec 文档（无 Delta、无 source of truth、无 archive 合并）。归档到 `$GSTACK_STATE_ROOT/projects/$SLUG/specs/`

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| 用户在构建不熟悉的模式前不搜索，导致 spec 基于错误假设 | Phase 3 强制代码阅读——"强制要求：在提出任何 Phase 3 问题之前，你必须从代码库中阅读至少一条证据" |
| Spec 质量参差不齐——vague acceptance criteria、模糊文件引用、无 effort breakdown | 14 项 Issue Quality Standards + Anti-Patterns 清单。每个标准都有 good/bad 示例 |
| 单模型审查存在盲区——同一个 AI 模型生成和审查 spec 可能共享同一个盲区 | Codex quality gate——用不同 AI 模型（OpenAI Codex）独立评分。Score <7 可迭代修改，最多 3 次 dispatch |
| Spec 中可能泄漏 secrets/PII——issue 是 world-readable 的 | Phase 4.5b fail-closed redaction：约 30 种模式、3 个 tier。HIGH 级别阻断（exit 3），raw spec 不持久化到任何下游。`spec-quality-gate-secret-sink.test.ts` 强制执行 |
| Phase 4 编辑可能引入 4.5b scan 未覆盖的内容 | Phase 5 filing 前再次 re-scan——"Phase 4 的编辑可能引入 4.5b 扫描从未见过的内容，而 issue 是对全世界可读的" |
| 语义层面的敏感信息（named individuals、unannounced strategy）regex 无法捕获 | Phase 4.5a Semantic Content Review——结构化语义重读，检查 5 类语义风险 |

**核心教训：** Spec 的质量保障需要多层防御——强制代码阅读防止"凭空设计"，跨模型评分消除单模型盲区，fail-closed redaction 防止信息泄漏，semantic review 捕获 regex 无法覆盖的语义风险。gstack 是唯一将"强制代码阅读"作为 spec 阶段硬性要求的项目——这对 Brownfield 场景尤为重要。

---

## 2. 关键差异

### 2.1 格式化程度光谱

| 级别 | 代表项目 | 格式 | 可程序化解析 |
|------|---------|------|------------|
| **结构化行为契约** | OpenSpec | Requirement（RFC 2119）+ Scenario（GIVEN/WHEN/THEN）+ Delta | ✅ validator.ts 程序化验证 |
| **半结构化 AC** | ECC | AC-NNN（Scenario + Action + Expected + Must not + Verification） | ⚠️ 有模板但无程序化验证 |
| **模板化 PRD** | mattpocock | Problem + Solution + User Stories + Decisions | ❌ 自由文本 |
| **五阶段渐进** | gstack | Why → Scope → Technical → Draft → File | ❌ 自由文本 |
| **自由 Markdown** | Superpowers | 无固定格式，按 section complexity 调节 | ❌ 完全自由 |

**关键观察：** 只有 OpenSpec 的 spec 可以被程序化解析和验证。这意味着只有 OpenSpec 能实现"delta 合并回 source of truth"的自动化——其他项目的 spec 都需要人工理解才能维护。

### 2.2 持久化策略对比

| 项目 | Spec 持久化 | 随变更演进 | Source of Truth |
|------|-----------|-----------|----------------|
| **Superpowers** | ✅ 文件系统（docs/superpowers/specs/） | ❌ 一次性 | ❌ 无 |
| **OpenSpec** | ✅ change 文件夹 + specs/ 目录 | ✅ Delta 合并 | ✅ specs/ 是持续 source of truth |
| **ECC** | ❌ 一次性工作产物 | ❌ | ❌ 无 |
| **mattpocock** | ✅ issue tracker（外部） | ❌ 一次性 | ❌ 无 |
| **gstack** | ✅ 文件系统（$GSTACK_STATE_ROOT/projects/） | ❌ 一次性 | ❌ 无 |

**关键观察：** 只有 OpenSpec 的 spec 是"系统当前行为的持续记录"。其他 4 个项目的 spec 都是"为当前变更服务的一次性文档"——描述"要做什么"而非"系统当前行为是什么"。

### 2.3 质量保障机制对比

| 项目 | 质量保障 | 强制程度 |
|------|---------|---------|
| **Superpowers** | Spec self-review（placeholder scan, consistency, scope, ambiguity）+ User review gate | 中（self-review 是自检，user gate 是人工） |
| **OpenSpec** | validator.ts 程序化验证（格式、一致性、依赖关系） | 高（程序化，不通过则 propose 失败） |
| **ECC** | Pass/Fail Rubric（5 项检查） | 中（自检，不默认阻断） |
| **mattpocock** | 无显式质量保障 | 低 |
| **gstack** | Codex quality gate（7/10 门槛）+ secret redaction + semantic review | 高（跨模型评分，低于 7/10 阻断） |

**关键观察：** 质量保障从"自检"（Superpowers, ECC）到"程序化验证"（OpenSpec）到"跨模型评分"（gstack）逐步升级。OpenSpec 的程序化验证是最确定的——格式错误会被 validator 捕获，不依赖 AI 推理。gstack 的跨模型评分是最全面的——用不同 AI 模型审查 spec 质量。

---

## 3. 历史踩坑汇总与经验教训

### 3.1 踩坑类型分类

将五个项目在 Spec 节点的历史踩坑按类型归纳，可以发现一些反复出现的模式：

**类型一：Spec 质量保障被跳过**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers v5.0.0 前 | Spec review loop 只存在于 prose 中，不在 checklist/diagram 中——agent 跟随 diagram 跳过了 review (#677) | agent 跟随 diagram 和 checklist 的可靠性远高于 prose | 将 spec review 添加到 checklist 和 dot graph |
| Superpowers v5.0.6 | Spec review loop 执行 25 分钟但质量与无 review 一致 | subagent dispatch + 3-iteration cap 成本过高 | 替换为 inline self-review（30 秒，质量相当） |
| ECC | Agent 自评倾向于"一切正常" | 无结构化反思要求 | 5 轴评分，低分必须引用证据，禁止"Everything is a 5" |

**类型二：Spec 包含不该包含的内容**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| mattpocock | Spec 包含 file paths 和 code snippets，代码变更后过时 | 没有明确禁止 | 明确禁止——"they go stale fast"。例外：prototype snippet 可内联 |
| OpenSpec | Spec 中包含类名、库选择等实现细节 | 行为与实现混淆 | 明确分离：spec 只描述外部行为，实现放 design.md |
| gstack | Spec 中可能泄漏 secrets/PII | issue 是 world-readable 的 | Fail-closed redaction + semantic review |

**类型三：Spec 过大或过小**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| OpenSpec | 一个 change 试图同时做三件事 | 缺少 right-size 指导 | "Right-size the change"——一个意图一句话能说完 |
| Superpowers | 多子系统项目在一个 spec 中 | 缺少 scope check | Scope check——多子系统项目分解为多个 spec→plan→implementation 循环 |
| ECC | 所有变更都走同一种 spec 深度 | 缺少深度调节 | Quick Capture vs Full Brief |

**类型四：Spec 不持续演进**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers | Design doc 在项目演进后成为历史文档 | 无 Delta 机制 | 不修复——一次性文档设计 |
| ECC | AC 是一次性工作产物，不随变更更新 | 无 source of truth | 不修复——ECC 的设计取向 |
| mattpocock | PRD 发布到 issue tracker 后不随系统演进 | 无 Delta 机制 | 不修复——一次性文档设计 |
| gstack | Spec 归档后不再更新 | 无 Delta 机制 | 不修复——一次性文档设计 |
| OpenSpec | Spec 需要持续维护 | 有 Delta 机制 | ✅ Delta 合并——每次 archive 将 delta 合并回 source of truth |

**类型五：Spec 命名和结构不适配实际工作流**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| mattpocock v1.1.0 前 | to-prd/to-plan/to-issues 三个 skill 总是连续调用 | 过度拆分 | 合并为 to-spec + to-tickets |
| mattpocock v1.1.0 前 | "PRD" 命名不够直觉 | 产品术语而非工程通用术语 | 重命名为 "spec" |

### 3.2 经验教训总结

从五个项目的踩坑历史中，可以提炼出以下经验教训：

**教训一：Spec 质量保障机制需要出现在 agent 实际遵循的地方**

Superpowers 的 #677 bug 是最有启发性的案例——spec review 存在于 prose 中但被完全跳过，因为 agent 跟随 checklist 和 process flow diagram 而非 prose。这意味着：任何质量保障步骤如果只存在于 prose 中，它会被跳过。必须将其放入 checklist、diagram 或其他 agent 实际遵循的结构中。

**教训二：Subagent 审查不总是比 inline 自检好**

Superpowers v5.0.6 的回归测试证明——25 分钟的 subagent spec review 与 30 秒的 inline self-review 质量一致。这不意味着 subagent 审查无用，而是意味着在 spec 这种"文档审查"场景下，inline 自检的性价比可能更高。subagent 审查更适合需要认知隔离的场景（如 code review）。

**教训三：Spec 应该描述行为而非实现**

OpenSpec 和 mattpocock 都在这个方向上做了明确约束——OpenSpec 禁止 spec 包含类名和库选择（放在 design.md），mattpocock 禁止 file paths 和 code snippets（"they go stale fast"）。这是共识：spec 描述"系统应该做什么"，实现细节放在别处。

**教训四：Spec 过大是常见问题**

OpenSpec 的"Right-size the change"指导和 Superpowers 的 scope check 都指向同一个问题——AI 倾向于在一个 spec 中塞入过多内容。一个好的 spec 应该有一个可以用一句话说清的意图。

**教训五：只有结构化 spec 才能持续演进**

OpenSpec 是唯一实现 spec 持续演进的项目——这依赖于结构化格式（Requirement + Scenario）+ Delta 机制 + validator + source of truth。其他 4 个项目的 spec 都是一次性的。这不是说一次性 spec 不好——对于短期项目，一次性 spec 更简单。但对于长期维护的项目，spec 过时是必然的，除非有 Delta 机制。

---

## 4. 实践方向讨论

### 4.1 结构化 vs 自由格式：Spec 应该多结构化？

**OpenSpec 的立场**：Spec 必须结构化。Requirement + Scenario + RFC 2119 关键词让 spec 可程序化解析、可独立验证、可映射测试。结构化是 Delta 机制的前提——只有结构化的 spec 才能程序化合并。

**Superpowers 的立场**：Spec 应该自由。探索阶段的设计文档需要包含架构图、数据流、错误处理等非结构化内容。过早结构化会限制探索的深度。

**tradeoff 分析：**

- **结构化的优势**：可程序化解析、可独立验证、可映射测试、支持 Delta 自动合并
- **结构化的代价**：编写成本高（需要理解 RFC 2119、GIVEN/WHEN/THEN 格式）、限制表达力、可能不适合所有类型的设计（如 UI 设计、架构决策）
- **自由格式的优势**：低编写门槛、表达力强、适合模糊的探索阶段
- **自由格式的代价**：无法程序化验证、无法自动合并、依赖人工理解

**可能的好的实践方向**：分层结构化——Spec 的核心行为描述用结构化格式（Requirement + Scenario），辅助设计文档用自由格式。OpenSpec 已经这样做了——specs/ 是结构化的，design.md 是自由的。但 OpenSpec 的结构化格式编写成本高，可能需要 AI 辅助生成（这正是 `/opsx:propose` 的功能）。

### 4.2 Delta 机制：Spec 应该描述全量还是变更？

**OpenSpec 的 Delta 机制**是五个项目中唯一将 Brownfield 作为 first-class 概念的设计。

**Delta 的价值链：**
1. Propose 时：只描述要改的部分（ADDED/MODIFIED/REMOVED）
2. Apply 时：开发者只关注变更
3. Review 时：审查者只看 delta，快速理解变更范围
4. Verify 时：验证变更是否实现了 delta 中的 requirement
5. Archive 时：delta 合并回 source of truth

**其他项目都是全量 spec：**
- Superpowers 的 design doc 描述完整设计
- ECC 的 Acceptance Brief 描述完整需求
- mattpocock 的 PRD 描述完整方案
- gstack 的 /spec 描述完整技术方案

**全量 spec 的问题：** 在 Brownfield 场景下，全量 spec 要么重述大量现有行为（冗余），要么只描述新行为（但与现有行为的关系不明确）。Delta 机制解决了这个问题——只描述变更，通过 source of truth 维护完整图景。

**可能的好的实践方向**：Brownfield 场景下，Delta 机制有显著优势。但 Delta 机制的前提是结构化 spec（才能程序化合并）和 source of truth（才能合并到）。这意味着 Delta 机制的采用成本较高——需要像 OpenSpec 那样的完整工具链（validator + archive + specs-apply）。对于不需要 spec 持续演进的项目，全量 spec 可能更简单。

### 4.3 Progressive Rigor：Spec 的深度应该可调吗？

**ECC 的两种深度**：Quick Capture（3-7 个 AC，低风险）vs Full Acceptance Brief（含 Risk Review，高风险）。

**OpenSpec 的 Progressive Rigor**：Lite spec（默认）vs Full spec（高风险变更）。

**其他项目没有显式的深度调节**：Superpowers 所有项目都走完整 brainstorming；mattpocock 所有 spec 都用同一个 PRD 模板；gstack 所有 spec 都走五阶段。

**tradeoff 分析：**

- **可调深度的优势**：低风险变更不延迟（Quick Capture / Lite spec），高风险变更有充分保障（Full Brief / Full spec）
- **可调深度的代价**：需要判断"什么算高风险"——判断错误会导致低风险变更走重流程（浪费）或高风险变更走轻流程（不足）
- **固定深度的优势**：简单——不需要判断风险等级
- **固定深度的代价**：要么所有变更都走重流程（门槛高），要么都走轻流程（保障不足）

**可能的好的实践方向**：可调深度是合理的方向，但需要明确的风险分级标准。ECC 用"安全/数据/迁移变更"作为 Full Brief 的触发条件，OpenSpec 用"高风险变更"作为 Full spec 的触发条件——两者都需要用户或 agent 判断风险等级。

### 4.4 Spec 质量保障：自检 vs 程序化 vs 跨模型

三种质量保障机制代表了不同的确定性级别：

- **自检（Superpowers, ECC）**：AI 自己检查自己的 spec——速度最快但可能盲区
- **程序化验证（OpenSpec）**：工具检查 spec 格式——最确定但只能检查格式，不能检查内容质量
- **跨模型评分（gstack）**：另一个 AI 模型评分——最全面但成本最高

**tradeoff 分析：**

- 自检的成本最低（30s）但效果依赖 AI 自我认知能力
- 程序化验证的成本中等但只覆盖格式层面（一个 Requirement 是否有 SHALL/MUST，Scenario 是否有 GIVEN/WHEN/THEN）
- 跨模型评分的成本最高（需要两个 AI 服务）但能发现内容质量问题（逻辑漏洞、遗漏 edge case）

**可能的好的实践方向**：组合使用——程序化验证确保格式正确（如 OpenSpec），自检确保内容一致（如 Superpowers），跨模型评分在高风险变更时启用（如 gstack）。这形成了"格式 → 一致性 → 质量"的三层保障。

---

## 5. 案例映射

### 5.1 "Spec 过时"的失败模式

全量 spec 的最大问题是过时——系统演进后，spec 不再描述系统当前行为。

**OpenSpec 的解决**：Delta 机制让 spec 随变更有机增长——每次 archive 将 delta 合并回 source of truth。spec 不会过时，因为每次变更都更新了它。

**其他项目的问题**：Superpowers 的 design doc 在项目演进后成为历史文档（不再描述当前状态）。ECC 的 Acceptance Brief 是一次性的。mattpocock 的 PRD 发布到 issue tracker 后不随系统演进。gstack 的 spec 归档后不再更新。

**映射**：如果一个项目长期维护，spec 过时是必然的——除非有 Delta 机制持续更新。但对于短期项目或一次性变更，全量 spec 可能足够。

### 5.2 "Spec 包含代码"的失败模式

mattpocock 明确禁止 spec 包含 file paths 和 code snippets——"they go stale fast"。代码会变，但 spec 中的代码引用不会自动更新。

**OpenSpec 的立场**：Spec 只描述外部行为，不包含实现细节（类名、库选择放在 design.md）。

**Superpowers 的立场**：design doc 可以包含架构细节但不包含具体代码——代码在 writing-plans 阶段产出。

**ECC 的立场**：Acceptance Brief 的 Implementation Decisions 包含模块/接口/架构但不含具体代码。

**映射**：共识是 spec 不应包含具体代码——但"实现细节"的边界在哪里？OpenSpec 最严格（类名都不放），mattpocock 允许"编码了决策的 snippet"（来自 prototype）。这个边界的把握需要判断力。

### 5.3 "凭空设计"的失败模式

gstack 的 /spec Technical 阶段强制代码阅读——"不允许凭空设计"。这是一个针对 AI agent 的设计：agent 可能在不读现有代码的情况下"凭空"设计方案，导致方案与现有代码不兼容。

**映射到其他项目：**
- Superpowers 的 brainstorming 有 "Working in existing codebases" 指令但不强制代码阅读
- OpenSpec 的 explore 鼓励"调查代码库"但不强制
- ECC 的 intent-driven-development 先检查上下文但不强制代码阅读
- mattpocock 的 grill-with-docs 在 grilling 过程中读代码但不强制

gstack 是唯一将"强制代码阅读"作为 spec 阶段硬性要求的项目。这对 Brownfield 场景尤为重要——不读代码就设计方案，几乎必然导致不兼容。

### 5.4 "Spec 质量低但通过了"的失败模式

如果没有质量保障，低质量 spec 会流入下游——导致 plan 基于错误的 spec，execute 实现错误的方案。

**Superpowers 的解决**：Spec self-review（placeholder scan, consistency, scope, ambiguity）+ User review gate。但 self-review 是 AI 自检——可能盲区。

**OpenSpec 的解决**：validator.ts 程序化验证格式。但格式正确不等于内容正确——一个格式完美的 spec 可能逻辑漏洞百出。

**gstack 的解决**：Codex quality gate（7/10 门槛）。用不同 AI 模型审查——能发现单个模型的盲区。但 7/10 门槛是主观的。

**映射**：每种质量保障都有盲区。自检盲于自我认知，程序化验证盲于内容质量，跨模型评分盲于"两个模型可能共享同一个盲区"。组合使用可能是最稳健的方案。

---

## 6. 总结：Spec 节点的实践参考

> **声明：** 以下总结基于五个项目的实践经验和踩坑教训，试图提炼出一些有参考价值的结论。但这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中寻找一些相对普遍的规律，供读者参考和批判。

### 6.1 总体要求

经过对五个项目的全面分析，我们认为 Spec 节点需要满足以下总体要求：

**要求一：将探索结果转化为可验证的行为描述**

这是 Spec 节点的核心使命——探索阶段产出的是"问题定义"和"方向共识"，Spec 节点需要将其转化为"可以判断对错的行为描述"。五个项目虽然格式差异巨大（从自由 Markdown 到 RFC 2119 结构化契约），但都在做这件事——Superpowers 的 design doc、OpenSpec 的 Requirement+Scenario、ECC 的 AC-NNN、mattpocock 的 PRD、gstack 的五阶段 spec，本质上都是将模糊意图转化为可验证的规格。

**要求二：区分"行为"和"实现"**

OpenSpec 的"behavior, not code"原则和 mattpocock 的"no file paths or code snippets"规则都指向同一个方向——Spec 应该描述"系统应该做什么"而非"系统应该怎么实现"。实现细节（类名、库选择、代码片段）会随代码变更而过时，但行为描述更稳定。

**要求三：Spec 质量需要有保障机制**

Superpowers 的 #677 bug 证明——如果质量保障步骤只存在于 prose 中而不在 agent 实际遵循的结构中，它会被跳过。ECC 的"Everything is a 5"教训证明——没有结构化反思要求的自评会走过场。质量保障需要出现在 agent 实际会执行的地方。

**要求四：Spec 深度应该跟风险匹配**

一刀切的 spec 深度要么过重（简单变更走完整 spec），要么过浅（复杂变更只做快速 spec）。ECC 的两种深度和 OpenSpec 的 Progressive Rigor 都指向这个方向。

### 6.2 应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **将质量保障步骤放入 checklist/diagram** | agent 跟随 checklist 和 process flow diagram 的可靠性远高于 prose——只存在于 prose 中的步骤会被跳过 | Superpowers（#677 修复） |
| **区分行为和实现** | 行为描述比实现细节更稳定——代码会变但行为不变。实现细节放 design.md 或不放入 spec | OpenSpec、mattpocock |
| **按风险调节 spec 深度** | 低风险变更快速通过，高风险变更有充分保障 | ECC（Quick Capture vs Full Brief）、OpenSpec（Progressive Rigor） |
| **Brownfield 场景下强制代码阅读** | 不读代码就设计方案，几乎必然导致不兼容 | gstack（Phase 3 mandatory code reading） |
| **Spec 应有一个可以用一句话说清的意图** | 过大的 spec 难以审查、难以实现、难以理解 | OpenSpec（"Right-size the change"）、Superpowers（scope check） |
| **对高风险 spec 用跨模型审查** | 单模型审查存在盲区——不同 AI 模型可能系统性地忽略不同类型问题 | gstack（Codex quality gate） |
| **防止 spec 泄漏敏感信息** | spec 可能发布到 world-readable 的 issue tracker——secrets/PII 需要在发布前 redact | gstack（fail-closed redaction + semantic review） |
| **Inline 自检优先于 subagent 审查** | 回归测试证明 inline 自检（30s）与 subagent 审查（25min）质量一致——文档审查场景下 inline 性价比更高 | Superpowers（v5.0.6） |
| **允许 prototype snippet 例外** | 编码了关键决策的 snippet 比文字描述更精确——完全禁止代码会损失表达力 | mattpocock |

### 6.3 不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该让质量保障步骤只存在于 prose 中** | agent 跟随 checklist/diagram 而非 prose——只存在于 prose 中的步骤会被跳过 | Superpowers（#677） |
| **不应该在 spec 中包含具体代码和文件路径** | 代码会变但 spec 中的引用不会自动更新——"they go stale fast" | mattpocock（教训后的规则） |
| **不应该完全信任 agent 的"spec 已充分"自评** | agent 自评倾向于"一切正常"——没有结构化反思时会走过场 | ECC（"Everything is a 5"） |
| **不应该用一个 spec 覆盖多个不相关的意图** | 过大的 spec 难以审查、难以实现、难以理解 | OpenSpec（"Right-size the change"） |
| **不应该让 spec 阶段的 description 包含 workflow 摘要** | agent 会跟随 description 而不读取 skill 正文——description 只描述触发条件 | Superpowers（"The Description Trap"） |
| **不应该在 spec 发布到 issue tracker 前不做 secret redaction** | issue 是 world-readable 的——secrets/PII 泄漏后果严重 | gstack（fail-closed redaction 的存在本身就是教训） |
| **不应该在 Brownfield 场景下不读代码就写 spec** | 不读代码就设计方案，几乎必然导致不兼容 | gstack（Phase 3 强制代码阅读的存在本身就是教训） |
| **不应该将 spec 拆分为实际使用中总是连续调用的多个 skill** | 拆分增加认知负担和上下文切换成本 | mattpocock（v1.1.0 合并 to-prd/to-plan/to-issues） |

### 6.4 需要关注什么

在 Spec 节点的实践中，以下几个方面值得持续关注：

**关注点一：Spec 的持续演进 vs 一次性使用**

只有 OpenSpec 实现了 spec 的持续演进（Delta 机制 + source of truth）。其他 4 个项目的 spec 都是一次性的——系统演进后 spec 过时。对于长期维护的项目，spec 过时是必然的——除非有 Delta 机制。但 Delta 机制的采用成本较高（需要结构化格式 + validator + 合并工具）。实践中需要权衡：项目是否需要 spec 持续演进？如果需要，是否愿意承担 Delta 机制的工具链成本？

**关注点二：Spec 质量保障的"最后一公里"**

程序化验证（OpenSpec）能检查格式但不能检查内容质量。跨模型评分（gstack）能发现内容质量问题但成本高且依赖外部服务。inline 自检（Superpowers）性价比高但可能盲区。三种机制都有盲区——组合使用可能是最稳健的方案，但组合的成本和复杂度也需要考虑。

**关注点三：Spec 与 Explore 的边界**

Explore 产出"问题定义"，Spec 产出"行为契约"——但两者的边界并不总是清晰。Superpowers 的 brainstorming 产出的是 design doc（更接近 Spec），而 ECC 的 Quick Capture 产出的是 AC 列表（更接近 Explore）。在实践中需要明确：Spec 的起点在哪里？是从探索结束开始，还是从第一个结构化产出开始？

**关注点四：Spec 中"实现细节"的边界**

共识是 spec 不应包含具体代码——但"实现细节"的边界在哪里？OpenSpec 最严格（类名都不放），mattpocock 允许"编码了决策的 snippet"（来自 prototype），gstack 的 Issue 质量标准包含"Schema, API Shapes, and Data Models"（接近代码但不是代码）。这个边界的把握需要判断力，取决于项目的复杂度和团队的习惯。

**关注点五：Spec 阶段的 prompt injection 风险**

gstack 是唯一显式处理 spec 阶段 prompt injection 风险的项目——用 hard delimiters 将 spec 作为 DATA 传给 codex，防止 spec 内容被当作指令执行。其他项目没有显式处理这个风险。当 spec 发布到 issue tracker 或传给其他 AI 模型审查时，prompt injection 是一个真实的风险。

### 6.5 怎么观察效果

Spec 阶段的效果可以通过以下信号观察：

**正面信号（Spec 有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Plan 阶段不需要"从头开始" | Spec 为 Plan 提供了有效输入 | Plan 阶段是否大量引用 spec 的行为描述 |
| 实现阶段没有出现"这不是要做的" | Spec 准确描述了要做什么 | 实现阶段是否需要大幅返工 |
| Review/Verify 阶段可以对照 spec 验证 | Spec 是可验证的行为契约 | Reviewer 是否能基于 spec 判断实现是否正确 |
| Spec 的 acceptance criteria 被直接用作测试基准 | Spec 中的 AC 有实际验证价值 | 测试是否引用 spec 中的 scenario |
| Spec 通过了质量保障（validator/quality gate/self-review） | 质量保障机制有效工作 | 检查质量保障是否实际执行 |

**负面信号（Spec 有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Plan 阶段重新定义 spec 中的内容 | Spec 不够精确或不被信任 | Plan 是否在重复 spec 已经讨论过的内容 |
| 实现阶段发现 spec 中的行为描述有歧义 | Spec 的"可验证"性不足 | 实现时是否对 spec 的理解产生分歧 |
| Spec 质量保障步骤被跳过 | 质量保障不在 agent 实际遵循的结构中 | 检查 quality gate/self-review 是否实际执行 |
| Spec 中包含已过时的代码引用 | Spec 包含了不该包含的实现细节 | 检查 spec 中的 file paths/code snippets 是否与当前代码一致 |
| Spec 试图覆盖多个不相关意图 | Spec 过大 | 能否用一句话说清 spec 的意图 |

### 6.6 怎么改进

Spec 阶段的改进可以从以下几个方向入手：

**改进方向一：将质量保障步骤放入 agent 实际遵循的结构**

Superpowers 的 #677 教训是最直接的——如果质量保障步骤只存在于 prose 中，它会被跳过。确保 spec self-review、quality gate 等步骤出现在 checklist、process flow diagram 或其他 agent 实际遵循的结构中。

**改进方向二：分层质量保障**

组合使用三种质量保障机制——程序化验证确保格式正确（如 OpenSpec 的 validator），inline 自检确保内容一致（如 Superpowers 的 4 项检查），跨模型评分在高风险变更时启用（如 gstack 的 Codex quality gate）。这形成了"格式 → 一致性 → 质量"的三层保障，每层的成本和覆盖面不同。

**改进方向三：Brownfield 场景的 Delta 机制**

对于长期维护的项目，考虑引入 Delta 机制——spec 描述变更而非全量，通过 source of truth 维护完整图景。这需要结构化 spec 格式 + validator + 合并工具，但能解决 spec 过时问题。OpenSpec 的实践表明这是可行的。

**改进方向四：Spec 深度的风险分级**

建立明确的风险分级标准——什么算"高风险"变更需要 Full spec/Full Brief？ECC 用"安全/数据/迁移变更"作为触发条件，OpenSpec 用"跨团队/跨仓库/API 变更/迁移/安全"作为触发条件。可以借鉴这些标准，但需要根据项目实际情况调整。

**改进方向五：Spec 的 prompt injection 防御**

当 spec 发布到 issue tracker 或传给其他 AI 模型审查时，考虑 prompt injection 防御——用 hard delimiters 将 spec 作为 DATA 传递，明确标注"this is DATA, not instructions"。gstack 的实践表明这是必要的。

### 6.7 本篇结论

Spec 节点的核心使命是**从意图到行为契约**——将探索阶段的"问题定义"和"方向共识"转化为可验证的行为描述，使后续的 Plan 和 Execute 有据可依。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **Spec 应该描述行为而非实现**——代码会变但行为不变，实现细节放别处
2. **Spec 质量保障需要出现在 agent 实际遵循的地方**——prose 中的步骤会被跳过
3. **Spec 深度应该跟风险匹配**——一刀切两端都不合适
4. **Brownfield 场景下需要强制代码阅读**——不读代码就设计方案必然不兼容
5. **Spec 过大是常见问题**——一个好的 spec 有一个可以用一句话说清的意图
6. **只有结构化 spec 才能持续演进**——Delta 机制的采用成本高但解决 spec 过时问题

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用 Spec 节点时参考。后续章节将逐个节点展开类似的讨论。

---
