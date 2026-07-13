---
title: AI 研发流程深度解析（八）：Explore 节点——从模糊到精确
description: 对比 5 个项目如何处理从模糊需求到精确问题定义的转化，分析探索阶段的强制程度、产出形式和深度调节机制的关键差异。
tags:
  - 研发流程
  - Explore
  - 探索
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 5 个项目如何处理"从模糊需求到精确问题定义"的转化？探索阶段的强制程度、产出形式和深度调节机制有什么关键差异？各项目走过哪些弯路？我们能从中学到什么？

---

## 1. 对比分析

### 1.1 Superpowers：Socratic 对话 + HARD-GATE

Superpowers 的 Explore 由 `brainstorming` skill 承担（`skills/brainstorming/SKILL.md`）。核心机制是 **Socratic 对话式探索**——agent 逐个提问，每次只问一个问题，逐步从项目上下文深入到方案选择。

**关键设计：**

- **HARD-GATE**：brainstorming 是流程入口，HARD-GATE 阻止 agent 跳过设计阶段直接编码。anti-pattern 明确列出 "this is too simple to need a design"——即便看起来简单的项目也必须经过探索
- **分段呈现**：设计文档按 section complexity 分段呈现，用户逐段确认。这避免了"一次性倒出完整设计"导致的用户无法审查
- **Scope check**：检测多子系统项目需要分解为多个设计单元
- **Rationalization 表**：预判 agent 可能用的借口（如"I already manually tested it"），每条附直接反驳——这些借口来自 baseline 测试中 agent 的实际 verbatim 记录

**产出：** 设计文档（自由 Markdown），保存到 `docs/superpowers/specs/`

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v3.4.0 | 将 brainstorming 简化为自然对话（降低门槛），结果 agent 经常跳过探索直接进入 writing-plans | v4.3.0 重新加回 HARD-GATE——"this is too simple to need a design" anti-pattern 太普遍 |
| v4.0.0 | Description 字段包含 workflow 摘要时，agent 跟随 description 而不读取 skill 正文（如 description 写 "code review between tasks" 导致 agent 只做了一次 review） | description 只描述触发条件（"Use when..."），绝不包含 workflow 摘要 |
| v4.3.0 | agent 在 brainstorming 过程中一旦觉得"想清楚了"，就跳过用户审批直接开始写代码 | 添加 `<HARD-GATE>` 标签 + 6 项 checklist + Graphviz process flow + anti-pattern callout |
| v5.x | Rationalization 表中的借口不断增多——每条都来自 baseline 测试中 agent 实际使用的借口 | 持续补充，确保每个借口旁边都有直接反驳 |

**核心教训：** agent 会寻找任何 loopholes 来绕过规则。放松约束的尝试（v3.4.0）失败了——不是因为没有道理，而是因为 agent 确实会走捷径。Superpowers 的结论是：探索阶段需要硬约束，软建议不够。

### 1.2 OpenSpec：自由对话 + Guardrails

OpenSpec 的 Explore 由 `/opsx:explore` 命令承担（`src/core/templates/workflows/explore.ts`）。核心立场是 **"a stance, not a workflow"**——不是固定步骤的流程，而是一种探索姿态。

**关键设计：**

- **无固定步骤**：没有必需的输出、没有必经的路径。AI 以 "curious not prescriptive" 姿态进行自由对话
- **Guardrails（五条）**：
  - Don't implement — 探索阶段不写代码
  - Don't fake understanding — 不假装理解
  - Don't rush — 不急于结论
  - Don't force structure — 不强制结构化
  - Don't auto-capture — 不自动创建 change
- **OpenSpec Awareness**：检查现有 changes 和 artifacts，offer to capture insights——但不自动创建

**产出：** 无 artifact（纯对话）。探索结果留在 context window 中，由用户决定是否进入 propose

**历史踩坑：**

| 阶段 | 问题 | 修复 |
|------|------|------|
| 早期 | 过度结构化——探索阶段就要求结构化产出，限制了思考自由度 | 逐步放松为 "Enablers not Gates"，Explore 定位为 "stance not workflow"，不创建 change、不写 artifact |
| 早期 | Review 阻断导致用户用 `--no-validate` 完全跳过验证 | Verify 不阻断 Archive，暴露问题让人类决策——"Match the ceremony to the stakes" |
| Explore 引入前 | "还没想好做什么"阶段无低成本入口——用户要么直接 propose（过重），要么不用 OpenSpec | 引入 Explore 命令，填补"模糊问题"到"具体提案"之间的空白 |
| 持续存在 | Explore 不产出 artifact——探索结果留在 context window 中，context compaction 后丢失 | 未修复——这是"stance not workflow"取向的自然代价。用户需要在 propose 阶段重新建立 |

**核心教训：** 过早结构化会阻碍探索。OpenSpec 从"硬性约束"转向"柔性使能"的演进主线，核心洞察是：探索阶段的本质是自由思考，强制结构化会让 agent 和用户都变成"填表机器"。但这个取向的代价是探索结果不持久——这是 OpenSpec 有意识接受的 tradeoff。

### 1.3 ECC：Acceptance Criteria + 上下文优先

ECC 的 Explore 由 `intent-driven-development` skill 承担（`skills/intent-driven-development/SKILL.md`）。核心机制是 **将模糊意图转化为可验证的验收标准**。

**关键设计：**

- **先检查上下文**：读仓库、文档、schema，只问不能推断的问题。能从代码推断的技术事实不问用户，产品/业务约束（business rules, compliance, SLAs）不能从代码推断必须问
- **两种深度**：
  - Quick Capture：3-7 个 AC，低风险变更，不延迟实现
  - Full Acceptance Brief：含 Risk Review 表 + Blocking Decisions，安全/数据/迁移变更
- **`search-first` skill**：系统化"先搜索再编码"
- **`codebase-onboarding` skill**：专门用于理解现有代码（Brownfield 场景）

**产出：** Acceptance Brief（AC-NNN 格式：Scenario + Action + Expected + Must not + Verification + Priority）

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| Skills 概率性触发（50-80%）导致探索阶段的观察数据不可靠 | 改用 PreToolUse/PostToolUse hooks（100% 可靠）捕获会话活动 |
| 完整 skill 粒度太粗，一次误判成为永久规则 | 引入原子级 instinct + 置信度评分（0.3-0.9），渐进学习——新模式先以 0.3 置信度存在，反复验证后才成为核心行为 |
| Agent 自评倾向于"一切正常"，探索阶段的自我检查走过场 | 5 轴评分（Accuracy/Completeness/Correctness/Actionability/Conciseness），低分项必须引用具体证据，"Everything is a 5" 被明确禁止 |
| 无结构化的 spec 模型——AC 是一次性工作产物，不持续演进 | 未修复——ECC 的设计取向是"提供素材不定义流程"，spec 持续演进是 OpenSpec 的关注点 |
| intent-driven-development 不默认阻断——足够清晰的请求记录标准后继续 | 这是有意为之——ECC 认为"够用的验收标准记录后继续实现"比"完整探索后才能动手"更实用 |

**核心教训：** 探索的深度应该跟风险匹配。ECC 的两种深度（Quick Capture vs Full Brief）是对"一刀切"的直接回应——低风险变更不需要 Full Brief，高风险变更不能只做 Quick Capture。但"风险由谁判断"仍然是一个开放问题。

### 1.4 mattpocock-skills：Grilling + 事实/决策分离

mattpocock 的 Explore 由 `/grill-me`（无代码库）或 `/grill-with-docs`（有代码库）承担（`skills/productivity/grilling/SKILL.md`）。核心机制是 **grilling——一次一问的可复用原语**。

**关键设计：**

- **一次一问**：遍历决策树，每问附推荐答案。避免"bewildering"（让用户困惑）
- **事实/决策分离**：能从代码库推断的技术事实 agent 自己查，产品/业务约束必须问用户
- **推荐答案**：每个问题附推荐答案，降低用户交互成本
- **`/grill-with-docs`**：在 grilling 过程中通过 `/domain-modeling` 自动构建 CONTEXT.md（共享词汇）和 ADR
- **Wayfinder**：超大工作的"雾中探索"——渐进式创建 investigation tickets。有 no-fog early exit（中小型工作不走 Wayfinder）
- **Smart zone**：~120k token 限制单次探索深度

**产出：** 对话中的共识 + CONTEXT.md + ADR（grill-with-docs 模式）

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v1.1.0 之前 | grilling 在被其他 skill 调用时会替用户做决策——原来"能从代码库推断就别问用户"的规则被过度泛化，agent 开始替用户回答决策问题 | v1.1.0 引入事实/决策分离：事实（可从代码库推断）由 agent 自己查，决策（产品/业务约束）必须问用户 |
| v1.1.0 之前 | `to-prd`、`to-plan`、`to-issues` 三个 skill 在实际使用中总是连续调用，拆分反而增加了认知负担和上下文切换成本 | v1.1.0 合并为 `to-spec` 和 `to-tickets`，`to-issues` 被删除 |
| v1.1.0 | grilling 完成后 agent 可能直接开始执行计划，没有显式的用户确认点 | v1.1.0 加入确认门控——agent 不会在用户确认前开始执行计划 |
| 持续存在 | CONTEXT.md 需要持续维护，否则会腐化成过时文档 | grill-with-docs 在 grilling 过程中自动调用 domain-modeling 更新 CONTEXT.md——"不要攒着一起做——在发生时就记录" |
| 持续存在 | Wayfinder 对中小型工作过重 | 引入 no-fog early exit——中小型工作不走 Wayfinder |

**核心教训：** 可复用原语需要明确的责任边界。grilling 的 v1.1.0 教训很有启发——当一个探索 skill 被其他 skill 调用时，如果不区分"事实"和"决策"，agent 就会越界替用户做决策。这个教训不仅适用于 grilling，任何被复用的探索能力都需要考虑这个问题。

### 1.5 gstack：Office Hours + Search Before Building

gstack 的 Explore 由 `/office-hours` 承担（`office-hours/SKILL.md`）。核心机制是 **YC Office Hours 风格的六个 forcing questions**。

**关键设计：**

- **六个 forcing questions**：YC 风格的结构化探索——不是自由对话，而是通过六个关键问题驱动思考
- **Search Before Building**：注入每个 skill 的 preamble。三层知识体系：
  - Layer 1: Tried and true（标准模式，检查成本接近零）
  - Layer 2: New and popular（当前最佳实践，搜索但审视）
  - Layer 3: First principles（原创观察，最有价值）
- **ELI16 mode**：3+ session 运行时，每个问题重新为用户建立上下文
- **Context Recovery**：preamble 自动恢复近期 artifact（design docs, checkpoints, reviews, timeline）
- **Confusion Protocol**：高风险模糊性时 STOP——用一句话命名问题，呈现 2-3 个选项带 tradeoff。轻量级 gate，不像 Superpowers HARD-GATE 那样阻断所有工作

**产出：** Design doc，写入 `~/.gstack/projects/$SLUG/*-design-*.md`

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| Context compaction 后上下文丢失——探索结果和设计文档在 session 重启后不可用 | 引入 Context Recovery——preamble 在每次 skill 启动时自动从磁盘恢复 artifact |
| 3+ 并行 session 时用户在多个窗口之间切换，丢失上下文 | 引入 ELI16 mode——每个问题都重新为用户建立上下文 |
| 纯信息可视化不够——Dashboard 显示缺失但不阻止用户继续 | 引入 Eng Review required（可禁用）——少量强制比纯建议更有效 |
| Confusion Protocol 依赖 agent 的判断力区分"需要 STOP"和"可以继续" | 未完全修复——这是轻量级 gate 的自然代价。gstack 选择信任 agent 的判断力，而非像 Superpowers 那样阻断所有工作 |
| 用户在构建不熟悉的模式前不搜索，导致重复造轮子 | Search Before Building 注入每个 skill 的 preamble——三层知识体系 |

**核心教训：** 探索阶段需要关注 context 的持久性和恢复。gstack 的 Context Recovery 和 ELI16 mode 都是对"context 丢失"问题的回应——当用户在多个 session 之间切换时，探索结果不能只留在 context window 中。但 gstack 的 Confusion Protocol 也展示了轻量级 gate 的局限——它依赖 agent 的判断力，不如 Superpowers 的 HARD-GATE 可靠。

---

## 2. 关键差异

### 2.1 核心维度对比

| 维度 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **强制程度** | HARD-GATE（阻断） | 无 | 无 | 无 | Confusion Protocol（轻量级） |
| **探索方式** | Socratic 对话（一次一问） | 自由对话（无结构） | 上下文优先 + AC 模板 | Grilling（一次一问 + 推荐答案） | 六个 forcing questions |
| **产出形式** | 设计文档（自由 Markdown） | 无 artifact（纯对话） | Acceptance Brief（AC-NNN） | 对话共识 + CONTEXT.md | Design doc（文件持久化） |
| **深度调节** | scope check（多子系统分解） | 无（用户自定） | Quick Capture vs Full Brief | Wayfinder（超大工作） | Confusion Protocol（高风险时 STOP） |
| **事实/决策分离** | 无显式机制 | 无显式机制 | 有（技术事实推断 vs 业务约束问用户） | 有（同 ECC） | 无显式机制 |
| **Brownfield 支持** | "跟随现有模式"指令 | "调查代码库"鼓励 | codebase-onboarding skill | grill-with-docs 构建 CONTEXT.md | /spec Technical 阶段强制读代码 |
| **可复用性** | 低（是流程入口） | 低（是独立命令） | 中（AC 模板可复用） | 高（grilling 是可复用原语） | 低（是 sprint 链起点） |

### 2.2 强制程度的五级光谱

```
无强制 ←─────────────────────────────────────────→ 强阻断

OpenSpec      mattpocock     ECC           gstack           Superpowers
(stance,      (不拥有流程,   (无 gate,     (Confusion       (HARD-GATE,
 no steps)     用户自定)      两种深度)     轻量级 gate)      阻断编码)
```

**关键观察：** 只有 Superpowers 用 HARD-GATE 强制探索。其他 4 个项目都允许用户跳过探索直接进入下一阶段。但这不意味着其他项目不重视探索——它们用不同的机制鼓励而非强制：

- OpenSpec 用 guardrails（Don't rush）设软约束
- ECC 用两种深度让用户自选探索投入
- mattpocock 用推荐答案降低探索成本
- gstack 用 forcing questions 结构化探索（但不阻断）

### 2.3 产出形式的三个层次

| 层次 | 代表项目 | 特征 |
|------|---------|------|
| **无 artifact** | OpenSpec | 探索结果留在 context window 中，不持久化 |
| **对话共识 + 轻量文档** | mattpocock, ECC | 探索产出 AC 列表或 CONTEXT.md，是工作产物而非持续维护的文档 |
| **持久化设计文档** | Superpowers, gstack | 探索产出 design doc 并持久化到文件系统，跨 session 可读 |

**关键观察：** 产出形式的持久化程度决定了探索结果的可复用性。gstack 的 design doc 被下游 skill 主动读取（PREREQUISITE SKILL OFFER 检查），Superpowers 的 design doc 是 writing-plans 的输入。而 OpenSpec 的纯对话探索在 context compaction 后就丢失了——用户需要在 propose 阶段重新建立。

---

## 3. 历史踩坑汇总与经验教训

### 3.1 踩坑类型分类

将五个项目在 Explore 节点的历史踩坑按类型归纳，可以发现一些反复出现的模式：

**类型一：探索被跳过**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers v3.4.0 | 放松 HARD-GATE 后 agent 直接跳过 brainstorming | agent 认为"this is too simple to need a design" | v4.3.0 加回 HARD-GATE |
| Superpowers v4.3.0 | agent 在 brainstorming 中觉得"想清楚了"就跳过用户审批 | 没有 explicit stop-gate | 添加 HARD-GATE 标签 + checklist + process flow |
| OpenSpec | 用户直接 propose 跳过 explore | Explore 不强制，Enablers not Gates | 不修复——这是有意的取向 |
| mattpocock | 用户跳过 grilling 直接写代码 | "不拥有流程"，没有安全网 | 不修复——认为用户是理性的成年人 |

**类型二：探索过深或过浅**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| mattpocock | Wayfinder 对中小型工作过重 | 没有深度调节 | no-fog early exit |
| ECC | 所有变更都走同一种探索深度 | 没有深度调节 | Quick Capture vs Full Brief |
| Superpowers | 所有项目都走完整 brainstorming | 没有深度调节 | 不修复——HARD-GATE 不允许跳过 |
| OpenSpec | 早期过度结构化 | 强制结构化产出 | 逐步放松为 "stance not workflow" |

**类型三：探索结果丢失**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| OpenSpec | explore 不产出 artifact，context compaction 后丢失 | "stance not workflow"取向 | 不修复——有意识的 tradeoff |
| gstack | context compaction 后上下文丢失 | session 重启 | Context Recovery 自动恢复 |
| gstack | 3+ 并行 session 时用户丢失上下文 | 多窗口切换 | ELI16 mode |
| mattpocock | handoff 之前的探索结果不可恢复 | context window 传递 | 引入 handoff 机制（手动触发） |

**类型四：探索能力被复用时的越界**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| mattpocock v1.1.0 | grilling 被其他 skill 调用时替用户做决策 | 不区分事实和决策 | 事实/决策分离 |

**类型五：探索产出的问题**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers v4.0.0 | agent 跟随 description 而不读取 skill 正文 | description 包含 workflow 摘要 | description 只描述触发条件 |
| ECC | agent 自评倾向于"一切正常" | 无结构化反思 | 5 轴评分，低分必须引用证据 |
| mattpocock | CONTEXT.md 腐化成过时文档 | 不持续维护 | grill-with-docs 自动更新 |

### 3.2 经验教训总结

从五个项目的踩坑历史中，可以提炼出以下经验教训：

**教训一：agent 会走捷径，探索阶段尤其如此**

Superpowers 的 v3.4.0→v4.3.0 弯路是最直接的证据——放松约束后 agent 确实会跳过探索。"this is too simple to need a design" 是最常见的借口。但这是否意味着必须像 Superpowers 那样用 HARD-GATE 强制？不一定——OpenSpec 和 mattpocock 的用户群体没有这个问题，可能因为他们的用户已经认同探索的价值。但对于更广泛的用户群体，"跳过探索"是一个真实的失败模式。

**教训二：探索深度需要跟风险匹配**

ECC 的两种深度和 mattpocock 的 Wayfinder no-fog early exit 都指向同一个方向——一刀切的探索深度要么过重（简单任务走完整探索），要么过浅（复杂任务只做快速探索）。但"风险由谁判断"本身是一个开放问题——agent 可能误判，用户可能低估。

**教训三：探索结果需要某种形式的持久化**

OpenSpec 的纯对话探索在 context compaction 后丢失，gstack 为此引入了 Context Recovery，Superpowers 和 gstack 都将 design doc 持久化到文件系统。这暗示探索结果至少需要某种形式的持久化——不必是完整的文档（如 OpenSpec 的无 artifact 也有道理），但至少不应该完全依赖 context window。

**教训四：可复用的探索能力需要明确责任边界**

mattpocock v1.1.0 的事实/决策分离教训很有启发——当探索能力被其他 skill 调用时，如果不区分"事实"和"决策"，agent 就会越界。这个教训不仅适用于 grilling，任何被复用的探索能力都需要考虑这个问题。

**教训五：探索阶段的 agent 自评不可靠**

ECC 发现 agent 自评倾向于"一切正常"——如果没有结构化的反思要求，agent 会认为探索已经充分了。Superpowers 的 Rationalization 表也指向类似的问题——agent 会用各种借口（"I already manually tested it"、"being pragmatic not dogmatic"）来跳过探索。

---

## 4. 实践方向讨论

### 4.1 强制 vs 自由：探索是否应该是 gate？

**Superpowers 的立场**：探索必须是 gate。v3.4.0 曾去掉 HARD-GATE，v4.3.0 又加回——因为 agent 会跳过探索直接编码，导致方向错误。"this is too simple to need a design" 是最常见的 anti-pattern。

**OpenSpec 的立场**：探索不应是 gate。"a stance, not a workflow"——探索是一种姿态，不是强制流程。Don't force structure 意味着不应该在探索阶段就要求结构化产出。

**tradeoff 分析：**

- **强制的优势**：确保每个项目都经过思考阶段，减少"方向错误"的最高代价
- **强制的代价**：简单变更也要走完整探索（过重），门槛高，可能阻碍快速迭代
- **自由的优势**：低门槛，用户自主决定探索深度，适合有经验的用户
- **自由的代价**：agent 可能跳过探索直接编码（尤其在被催促时），导致方向错误

**可能的实践方向**：按风险等级调节——低风险变更允许跳过探索（如 OpenSpec），高风险变更建议完整探索（如 Superpowers 的 HARD-GATE 理念）。ECC 的 Quick Capture vs Full Brief 和 mattpocock 的 Wayfinder no-fog early exit 都在这个方向上探索。但"风险等级由谁判断"本身是一个需要回答的问题——如果是 agent 判断，可能误判；如果是用户判断，可能低估风险。

### 4.2 结构化 vs 自由格式：探索产出应该是什么？

五个项目的探索产出从"纯对话"到"结构化 AC"到"自由 Markdown 设计文档"跨度极大。

**结构化的优势（ECC 的 AC-NNN）**：
- 每个 AC 必须可观察（禁止"correctly"/"securely"等模糊词）
- 有验证方法——AC 直接成为验证基准
- 可程序化解析

**自由格式的优势（Superpowers 的 design doc）**：
- 适合探索阶段的模糊性——不需要过早结构化
- 可以包含架构图、数据流、错误处理等非结构化内容
- 不限制探索的深度和广度

**纯对话的优势（OpenSpec）**：
- 零摩擦——不需要产出任何文档
- 探索结果自然流入下一阶段
- 适合"快速验证想法"的场景

**可能的实践方向**：探索产出应该是"足够精确的问题定义"而非"完整的设计文档"。ECC 的 AC 列表和 mattpocock 的 CONTEXT.md 都是轻量级的——它们记录了"我们同意了什么"而非"系统应该怎么设计"。设计细节可以推迟到 Spec 阶段。但 gstack 和 Superpowers 的 design doc 也有道理——对于复杂项目，探索阶段就需要产出架构方向。

### 4.3 事实/决策分离：谁能推断什么？

ECC 和 mattpocock 都实现了"事实/决策分离"——能从代码推断的技术事实 agent 自己查，产品/业务约束必须问用户。这是一个重要的设计决策。

**为什么重要：**
- 避免 agent 在被其他 skill 调用时替用户做决策（mattpocock v1.1.0 教训）
- 减少用户交互成本——技术事实 agent 可以自己查，不需要问
- 明确责任边界——产品/业务约束只有用户知道

**实现差异：**
- ECC：在 `intent-driven-development` 中先检查上下文（读仓库、文档、schema），只问不能推断的问题
- mattpocock：在 grilling 中事实/决策分离是核心原则——grilling 被其他 skill 调用时，只负责问决策问题

**其他项目没有显式实现这个分离：**
- Superpowers 的 brainstorming 是 Socratic 对话，不区分事实和决策
- OpenSpec 的 explore 是自由对话，不区分
- gstack 的 office-hours 用 forcing questions，不区分

**可能的实践方向**：事实/决策分离值得成为 Explore 节点的基础设计原则。agent 应该先尽最大努力从代码库推断技术事实，只对无法推断的产品/业务约束问用户。这减少了交互成本并明确了责任边界。ECC 和 mattpocock 的实践表明这个分离是可行且有效的。

### 4.4 Brownfield 探索：理解现有系统

Brownfield 场景下，Explore 节点需要额外回答"现有系统是怎么工作的"。五个项目在这个问题上的处理差异显著：

- **ECC 最强**：`codebase-onboarding` skill 专门用于理解现有代码，`intent-driven-development` 先检查上下文
- **mattpocock 独特**：grill-with-docs 在 grilling 过程中构建 CONTEXT.md——持续维护的共享词汇
- **OpenSpec 有潜力**：spec source of truth 本身就是"系统当前行为的记录"，但 explore 阶段不产出结构化系统文档
- **Superpowers 中等**：brainstorming 的 "Working in existing codebases" 指令——跟随现有模式
- **gstack 较弱**：/spec 的 Technical 阶段强制代码阅读，但产出是为当前 sprint 服务的 spec

**可能的实践方向**：Brownfield 场景可能需要"系统理解"子能力——在探索用户需求的同时，构建对现有系统的结构化理解。mattpocock 的 CONTEXT.md（共享词汇）和 ECC 的 codebase-onboarding 是两个不同方向的探索。CONTEXT.md 关注"团队共识词汇"，codebase-onboarding 关注"代码结构理解"。两者可能是互补的。

---

## 5. 总结：Explore 节点的实践参考

> **声明：** 以下总结基于五个项目的实践经验和踩坑教训，试图提炼出一些有参考价值的结论。但这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中寻找一些相对普遍的规律，供读者参考和批判。

### 5.1 总体要求

经过对五个项目的全面分析，我们认为 Explore 节点需要满足以下总体要求：

**要求一：将模糊意图转化为足够精确的问题定义**

这是 Explore 节点的核心使命——不是产出完整的设计文档（那是 Spec 节点的事），而是确保"我们要解决什么问题"这个基本问题有清晰的答案。五个项目虽然实现方式差异巨大，但都在做这件事——Superpowers 的 brainstorming、OpenSpec 的自由对话、ECC 的 AC、mattpocock 的 grilling、gstack 的 forcing questions，本质上都是从模糊到精确的转化过程。

**要求二：区分"能推断的"和"必须问的"**

ECC 和 mattpocock 的事实/决策分离原则值得学习——agent 应该先尽最大努力从代码库、文档、schema 中推断技术事实，只对无法推断的产品/业务约束问用户。这既减少了用户交互成本，又明确了责任边界。

**要求三：探索结果需要某种形式的留存**

OpenSpec 的纯对话探索在 context compaction 后丢失，这是一个真实的痛点。gstack 的 Context Recovery、Superpowers 的 design doc 持久化、mattpocock 的 CONTEXT.md 都是对这个问题的不同回应。不一定需要完整的文档（OpenSpec 的无 artifact 也有道理），但至少不应该完全依赖 context window。

**要求四：探索深度应该跟风险匹配**

一刀切的探索深度要么过重（简单任务走完整探索），要么过浅（复杂任务只做快速探索）。ECC 的两种深度和 mattpocock 的 Wayfinder no-fog early exit 都指向这个方向。

### 5.2 应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **先读代码再问用户** | 能从代码推断的技术事实不应该问用户——减少交互成本，明确责任边界 | ECC、mattpocock |
| **一次只问一个问题** | 多个问题同时抛出让用户困惑（"bewildering"），逐个提问让每步都有聚焦 | Superpowers、mattpocock |
| **每个问题附推荐答案** | 降低用户交互成本——用户只需确认或修正，不需要从零思考 | mattpocock |
| **探索产出至少轻量留存** | context compaction 会丢失探索结果，至少需要某种形式的持久化 | Superpowers（design doc）、gstack（Context Recovery）、mattpocock（CONTEXT.md） |
| **按风险调节探索深度** | 低风险变更快速通过，高风险变更深入探索 | ECC（Quick Capture vs Full Brief）、mattpocock（Wayfinder no-fog early exit） |
| **预判 agent 的跳过借口** | agent 会说"this is too simple to need a design"等借口跳过探索——预判并反驳这些借口比软建议更有效 | Superpowers（Rationalization 表） |
| **Brownfield 场景构建共享词汇** | 在探索过程中构建对现有系统的理解——CONTEXT.md 或类似机制让团队和 agent 使用一致的语言 | mattpocock（CONTEXT.md）、ECC（codebase-onboarding） |
| **高风险模糊性时暂停** | 当遇到架构、数据模型等高风险模糊性时，暂停并呈现选项带 tradeoff——让用户做关键决策 | gstack（Confusion Protocol） |

### 5.3 不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该让探索能力替用户做决策** | 探索 skill 被复用时不区分事实和决策，agent 会越界替用户回答决策问题 | mattpocock v1.1.0 之前的教训 |
| **不应该对所有任务用同一种探索深度** | 简单任务走完整探索过重，复杂任务只做快速探索过浅——一刀切两端都不合适 | Superpowers（无深度调节）、ECC 早期（无深度调节） |
| **不应该过早强制结构化产出** | 探索阶段的本质是自由思考，强制结构化会让 agent 和用户都变成"填表机器" | OpenSpec 早期的教训 |
| **不应该让探索结果只留在 context window 中** | context compaction 后探索结果丢失，用户需要在下一阶段重新建立 | OpenSpec 的持续痛点 |
| **不应该完全信任 agent 的"探索已充分"自评** | agent 自评倾向于"一切正常"，没有结构化反思时会走过场 | ECC 的教训 |
| **不应该在 description 中包含 workflow 摘要** | agent 会跟随 description 而不读取 skill 正文——description 只描述触发条件 | Superpowers v4.0.0 的教训 |
| **不应该让探索产出完全不维护** | CONTEXT.md 等探索产出如果不持续更新，会腐化成过时文档 | mattpocock 的持续挑战 |

### 5.4 需要关注什么

在 Explore 节点的实践中，以下几个方面值得持续关注：

**关注点一：风险判断的准确性**

按风险调节探索深度是一个合理的方向，但"风险由谁判断"是一个开放问题。如果是 agent 判断，可能误判（把高风险当低风险）；如果是用户判断，可能低估风险（"这个改动很简单"）。实践中可以提供风险自检清单作为参考，但不能完全依赖它——风险判断本身需要经验和领域知识。

**关注点二：探索与 Spec 的边界**

Explore 产出"问题定义"，Spec 产出"行为契约"——但两者的边界并不总是清晰。Superpowers 的 brainstorming 产出的是 design doc（更接近 Spec），而 ECC 的 Quick Capture 产出的是 AC 列表（更接近 Explore）。在实践中需要明确：Explore 的产出是什么？是问题定义、是 AC、还是 design doc？这取决于项目复杂度和团队习惯。

**关注点三：Brownfield 场景的系统理解**

五个项目在 Brownfield 探索上的处理差异显著——ECC 最强（codebase-onboarding）、mattpocock 独特（CONTEXT.md）、其他项目较弱。对于在已有代码库上工作的场景，"理解现有系统"是 Explore 的重要职责，不能只关注"用户要什么"而忽略"系统现在是什么样的"。

**关注点四：探索能力被复用时的越界风险**

mattpocock v1.1.0 的教训提醒我们：当探索能力被其他 skill 调用时，如果不区分"事实"和"决策"，agent 就会越界。这个问题在任何"探索 skill 被复用"的场景中都会出现。如果你的探索能力设计为可复用原语，事实/决策分离就是必须的。

**关注点五：多 session 场景的上下文恢复**

gstack 的 ELI16 mode 和 Context Recovery 都是对"多 session 上下文丢失"问题的回应。当用户同时在多个窗口中工作时，探索结果不能只留在当前 session 的 context window 中——需要某种形式的持久化和恢复机制。

### 5.5 怎么观察效果

探索阶段的效果不容易直接量化，但以下信号可以作为观察参考：

**正面信号（探索有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Spec 阶段不需要"从头开始" | 探索产出为 Spec 提供了有效输入 | Spec 阶段是否大量引用探索阶段的结论 |
| 用户在探索后改变了最初的想法 | 探索确实帮助用户发现了之前没考虑的问题 | 探索前后的需求描述是否有变化 |
| 实现阶段没有出现"方向错误" | 探索帮助确定了正确的问题定义 | 实现阶段是否需要大幅返工 |
| 探索产出的 AC/问题定义被后续阶段引用 | 探索产出有实际价值 | Review/Verify 阶段是否引用探索阶段定义的验收标准 |
| 用户交互次数合理 | 事实/决策分离有效——只问了该问的 | 统计探索阶段用户回答的问题数量 |

**负面信号（探索有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Spec 阶段重新建立探索结论 | 探索结果丢失或不够精确 | Spec 阶段是否在重复探索已经讨论过的问题 |
| 实现阶段发现"这不是用户想要的" | 探索没有充分理解用户意图 | 实现完成后是否需要大幅修改 |
| 探索阶段 agent 自评"一切正常"但后续出问题 | 自评不可靠——没有结构化反思 | 探索阶段的自评与后续阶段的问题是否相关 |
| 用户频繁说"这个不用问"或"你自己看代码" | 事实/决策分离不到位——问了能推断的问题 | 统计用户回答中"不用问"类反馈的比例 |
| 探索产出从未被后续阶段引用 | 探索产出无实际价值 | 检查后续阶段是否引用探索阶段的内容 |

### 5.6 怎么改进

探索阶段的改进可以从以下几个方向入手：

**改进方向一：建立风险自检清单**

由于"风险由谁判断"是一个开放问题，可以提供一个风险自检清单作为参考——列出常见的风险因素（涉及安全/数据/迁移？跨系统变更？破坏性变更？），让用户或 agent 有依据地判断探索深度。这个清单不一定完整，但比凭感觉判断更可靠。

**改进方向二：探索产出的轻量化持久化**

不需要像 Superpowers 那样产出完整的 design doc，但至少需要某种形式的轻量留存——可能是 AC 列表、CONTEXT.md、或探索共识的摘要。关键是：context compaction 后这些内容仍然可读。

**改进方向三：探索效果的回顾性检查**

在 Archive 阶段回顾探索阶段的效果——"探索阶段定义的问题是否真的是最终解决的问题？""探索阶段遗漏了什么？"这种回顾性检查可以帮助改进探索流程本身。gstack 的 /retro 和 ECC 的 continuous-learning 都在这个方向上探索。

**改进方向四：探索能力的可复用性设计**

如果探索能力需要被其他 skill 调用，事实/决策分离是必须的。可以借鉴 mattpocock 的做法——将探索能力设计为可复用原语（如 grilling），但明确界定它的责任边界（只问决策，不替用户做决策）。

**改进方向五：渐进式结构化**

借鉴 OpenSpec 的 Progressive Rigor 理念——探索阶段不强制结构化产出，随着流程推进逐渐增加结构化程度。探索产出可以是自由对话，Spec 阶段才要求结构化 AC，Plan 阶段才要求任务清单。这样既不阻碍探索阶段的自由思考，又确保后续阶段有结构化输入。

### 5.7 本篇结论

Explore 节点的核心使命是**从模糊到精确**——将模糊的产品/工程意图转化为足够精确的问题定义，使后续的 Spec 和 Plan 有据可依。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **探索不能被轻易跳过**——Superpowers 的弯路证明 agent 会走捷径，但如何防止（HARD-GATE vs 弹性调节）取决于场景
2. **探索深度应该跟风险匹配**——一刀切两端都不合适，但风险判断本身是开放问题
3. **探索结果需要某种形式的留存**——完全依赖 context window 是不够的
4. **事实和决策需要分离**——可复用的探索能力尤其如此
5. **agent 的自评不可靠**——需要结构化反思而非"一切正常"

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用 Explore 节点时参考。后续章节将逐个节点展开类似的讨论。

---
