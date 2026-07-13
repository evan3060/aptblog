---
title: AI 研发流程深度解析（十）：Plan 节点——从规格到任务
description: 对比 5 个项目如何将 spec 分解为可执行的任务序列，分析任务粒度、代码包含策略、依赖表达和 Plan 审查机制的关键差异。
tags:
  - 研发流程
  - Plan
  - 任务分解
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 5 个项目如何将 spec 分解为可执行的任务序列？任务粒度、代码包含策略、依赖表达和 Plan 审查机制有什么关键差异？各项目走过哪些弯路？我们能从中学到什么？

---

## 1. 对比分析

### 1.1 Superpowers：Bite-Sized Tasks + Global Constraints

Superpowers 的 Plan 由 `writing-plans` skill 承担（`skills/writing-plans/SKILL.md`）。核心机制是将设计拆解为 **bite-sized tasks（2-5 分钟每步）**，每个 task 包含完整的代码、测试和 commit 指令。

**关键设计：**

- **Bite-Sized Granularity**：每步一个动作（2-5 分钟）——"写失败测试"、"运行确认它失败"、"实现最小代码使测试通过"、"运行测试确认通过"、"Commit"各自独立成 step（`SKILL.md` 第 47-52 行）
- **No Placeholders**：每个步骤必须包含实际内容——"这些是 plan 的失败——永远不要写：'TBD'、'TODO'、'稍后实现'、'添加适当的错误处理'、'为上述内容写测试'（没有实际测试代码）、'类似 Task N'"（第 130-136 行）
- **Task Right-Sizing**：最小可独立测试单元——"一个 task 是携带自身测试周期并值得一个新 reviewer gate 的最小单元。只在 reviewer 可以有意义地拒绝一个 task 同时批准其邻居的地方拆分。"（第 38-42 行）
- **Global Constraints**：plan 头部声明跨任务约束——"spec 中项目级别的需求——版本下限、依赖限制、命名和文案规则、平台要求——每项一行，从 spec 中逐字复制精确值。每个 task 的需求隐式包含此部分。"（第 71-74 行）
- **Plan 中包含完整代码**：不是占位符，是实际代码——"每步包含完整代码——如果一个 step 修改代码，展示代码"（第 141 行）
- **Self-Review**：3 项 inline 自检——spec coverage、placeholder scan、type consistency——"写完完整 plan 后，用新视角审视 spec 并对照检查 plan。这是你自己运行的 checklist——不是 subagent dispatch。"（第 146-147 行）
- **Pre-flight plan review**：执行前检查冲突——"在第一个 task 之前，controller 检查 plan 的内部冲突——以及 plan 中 reviewer 会标记为缺陷的任何内容——然后一次性全部提出，而不是在运行中途不断碰到。"（RELEASE-NOTES.md 第 78 行）
- **强制 TDD**：每个 step 都有 write test → verify fail → implement → verify pass → commit

**产出：** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v5.0.6 之前 | Plan Review Loop（dispatch subagent 审查 plan）执行时间约 25 分钟，但跨 5 个版本 5 次试验的回归测试显示质量分数与无 review 一致——"执行时间翻倍（约 25 分钟开销）但没有可测量地提升 plan 质量" | v5.0.6 替换为 inline Self-Review checklist（spec coverage、placeholder scan、type consistency），与 spec review 同批替换 |
| v5.0.4 | Plan reviewer 从 7 类检查精简到 4 类——格式相关检查（task syntax、chunk size）被移除，替换为实质检查（buildability、spec alignment）。同时 max iterations 从 5 减到 3——"只标记会在实现过程中导致真实问题的 issue。措辞上的小问题、风格偏好和格式吹毛求疵不应阻断批准。" | v5.0.4 精简 reviewer checklist，添加 Calibration section |
| v5.0.4 之前 | Plan reviewer 按 chunk 逐段审查（chunk-by-chunk），每个 chunk 一次 dispatch——token 消耗大、速度慢 | v5.0.4 替换为 single whole-plan review——"plan reviewer 现在一次审查完整 plan 而非逐段审查。移除了所有 chunk 相关概念" |
| 早期 | Plan 中允许"类似 Task N"的引用——但 engineer 可能不按顺序读取 task，导致上下文断裂 | 添加 "No Placeholders" section，明确禁止"Similar to Task N"——"重复代码——engineer 可能不按顺序读取 task" |
| v5.0.1 之前 | Spec 写完后直接进入 writing-plans，没有用户审查点——用户无法在 spec→plan 之间叫停 (#565) | v5.0.1 添加 explicit User Review Gate——spec 完成后用户审批才能进入 plan |

**核心教训：** Plan 的质量保障机制与 Spec 走了完全相同的弯路——subagent review loop（25 分钟）与 inline self-review（30 秒）效果一致，但 inline 摩擦低得多。这印证了一个跨节点的规律：文档审查场景下，inline 自检的性价比远高于 subagent dispatch。另一个关键教训是 chunk-based review 被彻底移除——"移除了所有 chunk 相关概念"——因为分段审查增加 token 消耗但不提升质量。

### 1.2 OpenSpec：Checkbox 清单 + Artifact Graph

OpenSpec 的 Plan 产出是 `tasks.md`——change 文件夹中的一个 artifact（`src/core/artifact-graph/graph.ts`、`docs/concepts.md`）。tasks.md 是一个简单的 checkbox 清单，不包含代码，只描述"做什么"。

**关键设计：**

- **Checkbox 格式**：简单的实现清单——"- [ ] implement user registration form"、"- [ ] add validation for email field"。Mark 完成的 task 为 `- [x]`（`docs/concepts.md`）
- **Artifact Graph（DAG）**：`ArtifactGraph.getNextArtifacts(completed)` 提供确定性"什么可以创建"查询——使用 Kahn's 算法计算拓扑排序（`graph.ts` 第 72-113 行）。tasks.md `requires: [specs, design]`（`concepts.md` 第 430-431 行）
- **Enablers not Gates**：依赖表示"使能"而非"门禁"——"依赖是使能器而非门禁。它们展示可以创建什么，而非必须接着创建什么。如果不需要可以跳过 design。"（`concepts.md` 第 455 行）
- **Schema 四级解析**：CLI→change→project→default，允许同一项目不同变更使用不同工作流
- **tasks.md 不包含代码**：只描述"做什么"——与 spec 的"behavior, not code"原则一脉相承
- **Incomplete-task gate**：archive 时检查 tasks.md 的 checkbox 是否全部完成——未完成则阻止归档（`archive-change.ts` 第 47 行）

**产出：** `changes/<change-name>/tasks.md`

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| #1202 | project-local schema 配置 `generates: "**/tasks.md"` 时，`status` 命令通过 glob 查找嵌套 tasks.md 文件，但 `view` 和 `archive` 命令硬编码了 `changes/<name>/tasks.md` 路径——导致嵌套 tasks.md 的 change 在 `view` 中显示为 Draft（看不到 task 进度），在 `archive` 中未完成 task 的 gate 被完全绕过，change 被直接归档 | 修复：`view`/`archive`/`list` 通过 tracked-tasks artifact 的 `generates` glob 解析 task 文件——与 `status` 使用相同的文件解析逻辑 |
| 早期 | `apply.tracks` 被误解为 glob 模式，实际它是文件名——用于选择 artifact，glob 是该 artifact 的 `generates` 字段 | 文档明确："apply.tracks 是一个选择 artifact 的文件名，它不是 glob" |

**核心教训：** OpenSpec 的 tasks.md 极度轻量（只是 checkbox 清单），但轻量带来的是实现时的"自由度"——agent 需要自己决定如何实现每个 task。当 tasks.md 与 artifact graph 配合使用时，DAG 提供了确定性进度追踪。但 #1202 的 bug 暴露了一个设计风险：当多个命令对"task 文件在哪里"有不同的理解时，gate 可能被绕过——这是数据安全问题。

### 1.3 ECC：Planner Agent + Phase/Step/Risk

ECC 的 Plan 由 `planner` agent 承担（`agents/planner.md`）——使用 Opus 模型、只读权限（`tools: ["Read", "Grep", "Glob"]`）。

**关键设计：**

- **Phase + Step 格式**：每个 Step 包含 File path、Action、Why、Dependencies、Risk——"清晰、具体的动作 / 文件路径和位置 / 步骤间依赖 / 预估复杂度 / 潜在风险"（`planner.md` 第 42-47 行）
- **Plan 包含具体文件路径和函数名**：不使用占位符——"要具体：使用确切的文件路径、函数名、变量名"（第 102 行）
- **Phase 分解支持独立交付**：大功能拆分为 MVP → Core → Edge cases → Optimization——"Phase 1: 最小可行——提供价值的最小切片 / Phase 2: 核心体验——完整 happy path / Phase 3: 边缘情况 / Phase 4: 优化"（第 199-205 行）。每个 Phase 可独立 merge——"每个 phase 应能独立 merge。避免需要所有 phase 全部完成后才能工作的 plan。"（第 206 行）
- **Red Flags 检查**：>50 行函数、>4 层嵌套、重复代码、缺失错误处理、硬编码值、缺失测试、性能瓶颈、无测试策略的 plan、无清晰文件路径的 step、不能独立交付的 Phase（第 209-219 行）
- **Worked Example**：planner.md 包含一个完整的 Stripe Subscription Billing 示例——展示期望的详细程度
- **GATE 1**：用户审批计划后才进入实现——ECC 的 orchestrator 流程是"Phase 1: RESEARCH → Phase 2: PLAN → Phase 3: IMPLEMENT"，Plan 阶段产出 plan.md 后需要人工审批

**产出：** `plan.md`（包含 Phase/Step 结构）

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| 早期 | Planner agent 没有 model 限制，使用 default model 时 plan 质量不稳定 | 显式指定 `model: opus`——planner 使用最强模型确保 plan 质量 |
| 早期 | Planner agent 有写权限，可能在 Plan 阶段就修改代码——违反"先想清楚再执行"原则 | 限制为只读权限：`tools: ["Read", "Grep", "Glob"]`——plan 阶段不允许修改代码 |
| v1.x | 缺乏多 session 规划能力——大型项目需要跨 session 的计划追踪 | 添加 `blueprint` skill——"多 session 构建规划"，产出 `plans/` 目录下的自包含 plan 文件 |

**核心教训：** ECC 的 Plan 节点设计体现了"角色隔离"原则——planner 使用 Opus 模型（最强推理能力）、只读权限（不会在 plan 阶段修改代码）、明确的 Phase 分解（支持增量交付）。Red Flags 检查列表是一个好的实践——它在 plan 编写时就捕获常见代码质量问题，而非等到 review 阶段。

### 1.4 mattpocock-skills：Tracer-Bullet Tickets + DAG

mattpocock 的 Plan 由 `/to-tickets` 承担（`skills/engineering/to-tickets/SKILL.md`）。将 plan/spec/对话分解为 **tracer-bullet tickets**——垂直切片，每个 ticket 穿过所有层。

**关键设计：**

- **垂直而非水平切片**：每个 ticket 穿过 schema/API/UI/tests 所有层，可独立 demo/验证——"每个切片穿透每一层（schema、API、UI、tests）的一条窄但完整的路径——是垂直切片，不是单层的水平切片。完成的切片可以独立 demo 或验证"（`SKILL.md` 第 31-33 行）
- **一个 ticket 适配一个 context window**：粒度标准是 context window 大小——"每个切片的大小适配一个全新的 context window"（第 34 行）
- **Blocking edges（DAG）**：每个 ticket 声明依赖——"给每个 ticket 设置 blocking edges——必须在它开始之前完成的其他 ticket。没有 blocker 的 ticket 可以立即开始。"（第 38 行）。优先使用 tracker 原生依赖关系
- **"让变更变容易，再做容易的变更"**：prefactoring 先做——"寻找机会预先重构代码以简化实现。"（第 23 行）
- **Wide refactor 例外**：机械式变更用 expand-contract 模式——"wide refactor 是一个机械式变更——重命名一列、改变一个共享符号的类型——其影响范围蔓延整个代码库。不要强制把它塞入 tracer bullet；用 expand-contract 模式排列。"（第 40 行）
- **明确禁止 file paths 和 code snippets**——"避免具体的文件路径或代码片段——它们很快就会过时。例外：如果 prototype 产出了一个比文字描述更精确地编码了决策的 snippet"（第 105 行）
- **用户审查 breakdown 后发布到 issue tracker**——"将拟议的分解呈现为编号列表...问用户：粒度感觉合适吗？Blocking edges 正确吗？是否需要合并或进一步拆分某些 ticket？迭代直到用户批准分解。"（第 44-56 行）

**产出：** 发布到 issue tracker（GitHub/Linear）或本地 `.scratch/<feature-slug>/issues/` 目录

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v1.1.0 之前 | 三个独立 skill `to-prd`、`to-plan`、`to-issues` 分别负责 PRD 生成、plan 分解、issue 发布——实际使用中总是连续调用，拆分增加了认知负担和上下文切换成本 | v1.1.0 合并为一个 `to-tickets` skill——"to-plan 和 to-issues 合并为一个 to-tickets skill，to-issues 被删除"。同时 `to-prd` 重命名为 `to-spec` |
| v1.1.0 之前 | `to-issues` 不支持 wide refactor——机械式重命名/类型变更的 blast radius 跨整个代码库，无法放入单个 tracer bullet，强制放入导致 CI 红 | v1.1.0 添加 wide refactor 支持——expand-contract 模式："先扩展：在旧形式旁边添加新形式，确保不破坏任何东西。然后按 blast radius 分批次迁移调用点。最后收缩：一旦没有调用者剩余，删除旧形式。" |
| v1.1.0 | `wayfinder` skill 硬编码了 `docs/agents/issue-tracker.md` 路径——在其他 repo 中 issue tracker 配置在别处时，wayfinder 静默回退到 local-markdown tracker，即使 CLAUDE.md 明确声明使用 GitHub issues | 修复：wayfinder 通过 CLAUDE.md/AGENTS.md 中的 `### Issue tracker` block 解析 tracker 文档路径——与其他 skill 保持一致的间接寻址 |

**核心教训：** mattpocock 的 Plan 节点走了从"三 skill 拆分"到"单 skill 合并"的弯路——实际使用中总是连续调用的 skill 不应该拆分。更重要的是 wide refactor 的 expand-contract 模式——当变更 blast radius 跨整个代码库时，强制垂直切片会导致 CI 红，expand-contract 是更安全的替代方案。

### 1.5 gstack：多角色审查 + Autoplan

gstack 的 Plan 由多个 skills 承担——`plan-ceo-review/SKILL.md`（商业方向审查）、`plan-eng-review/SKILL.md`（技术方案审查）、`plan-design-review/SKILL.md`（UI/UX 审查）、`plan-devex-review/SKILL.md`（开发者体验审查）。

**关键设计：**

- **多角色审查**：每个角色关注不同维度——CEO review 关注商业方向和 scope ambition（"重新思考问题，寻找 10 星级产品，挑战前提，在能创造更好产品时扩大 scope"），Eng review 关注架构和技术方案（"锁定执行计划——架构、数据流、图表、边缘情况、测试覆盖、性能"）
- **四种审查模式**：SCOPE EXPANSION（dream big）、SELECTIVE EXPANSION（hold scope + cherry-pick）、HOLD SCOPE（maximum rigor）、SCOPE REDUCTION（strip to essentials）——"一旦选定，全力投入。不要默默偏移。"（`plan-ceo-review/SKILL.md` 第 879 行）
- **`/autoplan`**：自动运行所有计划阶段审查——`/autoplan` 的 dual-voice eval 验证 Claude review subagent 和 Codex outside voice 都实际触发
- **Ask-first scope gate**：Plan review 的第一步是确认审查目标——"在这个 skill 中做任何其他事情之前——你的第一个工具调用必须是 AskUserQuestion，确认审查目标。"（`plan-eng-review/SKILL.md` 第 814 行）
- **Implementation Alternatives（MANDATORY）**：至少 2-3 个实现方案——"至少需要 2 个方案。非平凡 plan 推荐 3 个。一个必须是'最小可行'方案。一个必须是'理想架构'方案"（`plan-ceo-review/SKILL.md` 第 1232-1235 行）
- **AskUserQuestion 格式**：D<N> + ELI10 + Completeness + Pros/Cons + Net——每个决策都有推荐项和完整 tradeoff 分析
- **plan-eng-review 产出 test plan**：嵌入 plan 文件供 `/qa` 读取
- **Token 优化**：plan-ceo-review 从 138,838 B 缩减到 80,731 B（-42%），plan-eng-review 从 106,984 B 缩减到 54,892 B（-48.7%）——"always-loaded 的骨架加上一个按需加载的 sections/ 文件，agent 只在到达相关工作时才打开"

**产出：** Plan 文件 + GSTACK REVIEW REPORT（包含 Runs/Status/Findings 表和 VERDICT 行）

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| 早期 | Plan review 的 outside voice（Codex review）需要用户手动 opt-in——大多数用户不知道有这个选项，错过了跨模型审查的价值 | 改为自动运行——"跨 /review、/ship、/plan-ceo-review、/plan-eng-review、/plan-design-review、/plan-devex-review、/document-release 和 /autoplan 的 Codex review。plan-review 的 outside voice 自动运行。" |
| 早期 | `/plan-eng-review` 和 `/plan-design-review` 不先确认审查目标就扫描整个 repo——在空 repo 上浪费大量时间 | 添加 ask-first scope gate——"第一个动作确认审查目标（branch diff / 粘贴的 plan / 特定路径），然后才进行任何 repo 探索或审计" |
| 早期 | Plan review 结束后不告诉用户是否有未解决的决策——用户以为 review 完成了，实际上还有未确认的决策 | 添加 unresolved decisions status line——"每个 plan review 现在结束时用一行告诉你是否还有未解决的决策" |
| 早期 | `/plan-devex-review` 从未写入 review log——gate 无法检查它是否实际执行了 review | 修复 review log 写入——"/plan-devex-review 从未写入 review 条目。它承载了审批 gate 但..." |
| 早期 | Plan review skill 过于庞大（138K-112K bytes），消耗大量 context | Token 缩减：skeleton + on-demand sections——"五个最重的 skill 现在是一个小的 always-loaded 骨架加上一个按需加载的 sections/ 文件" |
| 早期 | /autoplan 的 dual-voice eval 在 sandbox 中无法触发 Claude Code 2.x 的 slash-command resolution | 修复：eval sandbox 在 project-level `.claude/skills/` 安装 skill——匹配真实的 slash-command 解析路径 |

**核心教训：** gstack 的 Plan 节点走了从"手动 opt-in"到"自动运行"的弯路——outside voice（跨模型审查）的价值很大，但手动 opt-in 导致大多数用户错过。另一个教训是 plan review skill 过大（138K bytes）会消耗大量 context——skeleton + on-demand sections 模式可以在不损失功能的前提下缩减 42-49%。

---

## 2. 关键差异

### 2.1 任务粒度对比

| 项目 | 粒度单位 | 典型大小 | 包含代码 | 粒度标准 |
|------|---------|---------|---------|---------|
| **Superpowers** | Step | 2-5 分钟 | ✅ 完整代码 | 最小可独立测试单元 |
| **OpenSpec** | Checkbox 项 | 不定 | ❌ 只描述"做什么" | 无明确标准 |
| **ECC** | Step（在 Phase 内） | 不定 | ✅ 文件路径和函数名 | Phase 可独立 merge |
| **mattpocock** | Ticket | 一个 context window | ❌ 禁止代码 | 垂直切片可独立 demo |
| **gstack** | Plan（多角色审查） | 不定 | ❌ 自由格式 | 按 scope mode 调节 |

**关键观察：** 粒度从最精细（Superpowers 的 2-5 分钟）到最粗（mattpocock 的一个 context window）差异达**一个数量级以上**。粒度的选择不是随意的——它与执行者匹配：Superpowers 的执行者是 fresh subagent（每步一个动作），mattpocock 的执行者是完整 context window 的 agent。粒度还与并行需求匹配：mattpocock 的 frontier tickets 可以并行，Superpowers 的线性 step 序列不支持并行。

### 2.2 Plan 审查机制对比

| 项目 | Plan 审查 | 阻断性 | 审查者 | 审查内容 |
|------|---------|-------|--------|---------|
| **Superpowers** | Self-Review + Pre-flight | ❌ 自动进入 SDD | AI 自检 | spec coverage、placeholder scan、type consistency |
| **OpenSpec** | 无显式审查 | ❌ Enablers not Gates | 无 | — |
| **ECC** | GATE 1 | ✅ 用户审批 | 人类 | plan.md 整体审查 |
| **mattpocock** | 用户审查 breakdown | ✅ 用户审查后发布 | 人类 | 粒度、blocking edges、是否需要 merge/split |
| **gstack** | 多角色审查 + autoplan | ⚠️ taste decisions 需确认 | AI 多角色 + 人类（taste） | 架构、商业方向、UI/UX、DX + Implementation Alternatives |

**关键观察：** ECC 和 mattpocock 有人在 Plan 阶段审查——ECC 的 GATE 1 和 mattpocock 的"用户审查 breakdown"都是人工审批点。Superpowers 和 OpenSpec 自动进入下一阶段。gstack 是混合——AI 多角色审查 + 人类只审 taste decisions。审查的深度也不同：gstack 的 plan-ceo-review 包含 Implementation Alternatives（强制 2-3 个方案对比），其他项目不要求方案对比。

### 2.3 依赖表达方式对比

| 项目 | 依赖表达 | 支持并行 | 机制 |
|------|---------|---------|------|
| **Superpowers** | 线性序列（step 顺序执行） | ❌ 不支持 | Step 内的 Interfaces block 传递 |
| **OpenSpec** | Artifact Graph DAG | ✅ `getNextArtifacts()` 查询 | Kahn's 算法拓扑排序 |
| **ECC** | Phase 顺序 + Step Dependencies | ⚠️ Phase 间顺序，Step 间有依赖 | Step 的 Dependencies 字段 |
| **mattpocock** | Blocking edges（DAG） | ✅ frontier tickets 可并行 | Ticket 间的 blocking 声明 |
| **gstack** | Sprint 链式（顺序传递） | ⚠️ sprint 内顺序 | 按顺序传递给下一个 review |

**关键观察：** OpenSpec 和 mattpocock 都使用 DAG 表达依赖——但 OpenSpec 的 DAG 是 artifact 级别（specs→design→tasks），mattpocock 的 DAG 是 ticket 级别（更细粒度）。Superpowers 的线性序列最简单但最不灵活——不支持并行执行。DAG 的优势是 frontier tickets/artifacts 可以并行执行——这在多 agent 场景下很有价值。

### 2.4 Plan 中代码包含策略对比

| 项目 | 代码包含 | 理由 | 风险 |
|------|---------|------|------|
| **Superpowers** | ✅ 完整代码 | 消除歧义、plan 即可执行 | plan 很长、代码过时风险 |
| **OpenSpec** | ❌ 不含代码 | 与 spec 的"behavior, not code"一致 | 实现时需要重新做设计决策 |
| **ECC** | ⚠️ 文件路径和函数名 | 明确位置但不限制实现 | 介于两者之间 |
| **mattpocock** | ❌ 禁止代码 | "they go stale fast"、保护 TDD | 可能有歧义 |
| **gstack** | ❌ 自由格式 | 由 plan review 的内容决定 | 无约束 |

**关键观察：** 这是 Plan 节点最根本的分歧——Superpowers 包含完整代码，mattpocock 明确禁止。两者的理由都有道理：包含代码消除歧义但增加 context 消耗和过时风险；不含代码保护 TDD 但可能有歧义。ECC 的折中（文件路径和函数名）是一个有参考价值的中间方案。

---

## 3. 好的实践方向讨论

### 3.1 Plan 中是否包含代码？

**Superpowers 的立场**：Plan 中包含完整代码消除了实现时的歧义。No Placeholders 原则要求每个步骤有实际内容——如果 plan 不包含代码，实现时 agent 需要重新做设计决策，这违背了"先想清楚再执行"的原则。Superpowers 的执行者是 fresh subagent——它只看到自己的 task，不看到其他 task 的上下文，因此 plan 中的代码是它唯一的信息来源。

**mattpocock 的立场**：Plan 中不含代码保护了 TDD——如果 plan 已有代码，实现者倾向于直接复制而非先写测试。"they go stale fast"——代码会变但 plan 中的代码不会自动更新。但 mattpocock 留了一个例外：prototype 产生的 snippet 如果"encodes a decision more precisely than prose can"可以内联。

**tradeoff 分析：**

- **包含代码的优势**：消除歧义、减少实现时的决策、plan 即可执行
- **包含代码的代价**：plan 很长（增加 context 消耗）、代码过时风险、可能抑制 TDD
- **不含代码的优势**：plan 轻量、保护 TDD、plan 不随代码过时
- **不含代码的代价**：实现时需要重新做设计决策、可能有歧义

**可能的好的实践方向：** Plan 应该描述"做什么"和"关键设计决策"而非"完整代码"。粒度也是一个因素——如果是 bite-sized step（Superpowers），包含代码是合理的因为每步只改几行；如果是 tracer-bullet ticket（mattpocock），包含代码不现实因为一个 ticket 可能涉及大量代码。ECC 的折中——plan 包含文件路径和函数名（明确位置）但不包含完整代码（留出实现空间）——可能是一个通用的方案。

### 3.2 任务粒度：Bite-Sized vs Tracer-Bullet

**Superpowers 的 bite-sized（2-5 分钟）**：每步一个动作。优势是精确控制——agent 每步 commit、每步验证。代价是 plan 极长（一个功能可能几十个 step）。但 Superpowers 的 Self-Review 从 chunk-based（逐段审查）改为 single whole-plan review——这表明长 plan 不是问题，分段审查才是问题。

**mattpocock 的 tracer-bullet（一个 context window）**：每个 ticket 是完整垂直切片。优势是独立可验证——每个 ticket 可以独立 demo。代价是粒度大——一个 ticket 内部的进度难以跟踪。但 mattpocock 的 blocking edges（DAG）允许 frontier tickets 并行执行——这是 bite-sized 无法做到的。

**tradeoff 分析：**

- **细粒度的优势**：精确控制、每步可验证、问题定位精确
- **细粒度的代价**：plan 冗长、context 消耗大、可能过度规划
- **粗粒度的优势**：plan 轻量、独立可 demo、适合并行执行
- **粗粒度的代价**：内部进度难跟踪、问题定位不精确

**可能的好的实践方向：** 粒度应该与执行者匹配——如果执行者是 fresh subagent（Superpowers SDD），需要细粒度（每步一个动作）；如果执行者是完整 context window 的 agent（mattpocock），粗粒度足够。粒度还应与并行需求匹配——如果需要并行执行（mattpocock 的 frontier tickets），需要粗粒度的独立 ticket。

### 3.3 Global Constraints：跨任务的约束

Superpowers 是唯一显式定义 Global Constraints 的项目——跨任务的约束如编码标准、测试要求。这些约束在 plan 头部声明，对所有 task 生效——"每个 task 的需求隐式包含此部分"。

**其他项目没有显式的 Global Constraints：**
- OpenSpec 的 tasks.md 没有约束声明
- ECC 的 plan 有 Phase 级约束但没有全局约束
- mattpocock 的 tickets 没有跨 ticket 约束
- gstack 的 preamble 包含全局行为（如 Search Before Building）但不约束具体任务

**为什么重要：** Global Constraints 确保所有 task 遵循相同的标准——如"所有 public API 必须有 JSDoc"、"所有数据库访问必须通过 repository pattern"。如果没有全局约束，每个 task 可能做出不一致的选择——ECC 的 Red Flags 检查（>50 行函数、>4 层嵌套）是在 plan 编写时检查，但如果这些标准不在 Global Constraints 中声明，不同 task 的标准可能不一致。

**可能的好的实践方向：** Global Constraints 是一个好的实践——它让 plan 不仅仅是一组任务，而是一组在共享约束下的任务。Superpowers 的实践表明这可以显著减少实现时的不一致。

### 3.4 Plan 审查：自动 vs 人工 vs 多角色

**三种 Plan 审查范式：**

- **自动（Superpowers, OpenSpec）**：AI 自检或不审查，自动进入执行。Superpowers 的 Self-Review（spec coverage、placeholder scan、type consistency）是 inline 的 30 秒检查——与 spec 的 inline self-review 同源。优势是快；代价是可能基于错误的 plan 执行
- **人工（ECC, mattpocock）**：人类审查 plan 后才执行。ECC 的 GATE 1 在 Plan→Execute 之间。mattpocock 的"用户审查 breakdown"在发布到 issue tracker 前。优势是方向正确；代价是延迟
- **多角色（gstack）**：AI 多角色审查 + 人类只审 taste decisions。gstack 的 plan-ceo-review 包含 Implementation Alternatives（强制 2-3 个方案对比）、Prime Directives（zero silent failures、every error has a name 等）、Cognitive Patterns（CEO/Eng Manager 思维模型）。优势是全面；代价是复杂——plan-ceo-review 有 1477 行

**tradeoff 分析：**

- 自动审查适合低风险变更——快速进入执行
- 人工审查适合高风险变更——确保方向正确
- 多角色审查适合需要多维度评估的变更——商业、技术、设计、DX

**可能的好的实践方向：** 按风险等级选择审查方式——低风险自动通过，中风险 AI 自检，高风险人工审批，需要多维评估时多角色审查。gstack 的 autoplan 是一个有趣的探索——encoded decision principles 处理常见决策，只 taste decisions 需要人类。但 gstack 的复杂度也是一个警示——1477 行的 plan-ceo-review 经过 token 缩减后才降到 80K bytes。

### 3.5 垂直切片 vs 水平切片

mattpocock 是唯一显式讨论切片策略的项目——tracer-bullet tickets 是垂直切片，每个 ticket 穿过所有层（schema/API/UI/tests）。

**为什么重要：** 水平切片（先做所有 schema，再做所有 API，再做所有 UI）的问题在于：每个层不能独立 demo——只有全部完成后才能验证。垂直切片的每个 ticket 可以独立 demo/验证。

**其他项目的处理：**
- Superpowers 的 SDD 按 task 顺序执行，不显式区分水平和垂直
- ECC 的 Phase 分解支持独立交付（每个 Phase 可独立 merge）——这接近垂直切片的理念
- OpenSpec 的 tasks.md 不处理切片策略
- gstack 的 sprint 结构不显式处理切片策略

**可能的好的实践方向：** 垂直切片是一个值得采纳的实践——它确保每个 task/ticket 可以独立验证，减少"全部完成后才发现问题"的风险。但 wide refactor 是例外——机械式变更（重命名、类型变更）的 blast radius 跨整个代码库，强制垂直切片会导致 CI 红，expand-contract 模式是更安全的替代。

---

## 4. 案例映射

### 4.1 "Plan 过于详细"的失败模式

Superpowers 的 bite-sized steps 可能导致 plan 极长——一个中等功能可能有 30-50 个 step。这增加了 plan 编写时间和 context 消耗。

**映射到其他项目：** OpenSpec 的 tasks.md 和 mattpocock 的 tracer-bullet tickets 都更轻量。但轻量的代价是实现时需要更多判断——agent 需要自己决定如何实现每个 task。ECC 的 Phase 分解介于两者之间——Phase 是粗粒度的，但 Phase 内的 Step 包含文件路径和 Risk。

**Superpowers 自己的缓解措施：** Self-Review 从 chunk-based 改为 single whole-plan——这表明 Superpowers 认为长 plan 不是问题，分段审查才是问题。Pre-flight check 在执行前一次性检查所有冲突——而不是在执行过程中逐个发现。

### 4.2 "Plan 不含代码导致歧义"的失败模式

mattpocock 禁止 plan 包含代码——但实现时 agent 可能不知道应该用什么模式、什么接口。

**映射到其他项目：** Superpowers 的完整代码消除了歧义。ECC 的文件路径和函数名提供了位置指引。OpenSpec 和 mattpocock 一样不含代码——但 OpenSpec 有 spec 作为行为基准（实现时可以对照 spec 判断是否正确）。

**mattpocock 的缓解措施：** 允许 prototype 产生的 snippet 例外——"if a prototype produced a snippet that encodes a decision more precisely than prose can, inline it and note briefly that it came from a prototype"。这比完全禁止代码更灵活。

### 4.3 "水平切片导致无法独立验证"的失败模式

如果 plan 按层分解（先做所有 schema，再做所有 API，再做所有 UI），每个层不能独立 demo——只有全部完成后才能验证。

**mattpocock 的解决**：tracer-bullet tickets 是垂直切片——每个 ticket 穿过所有层，可独立 demo/验证。"让变更变容易，再做容易的变更"——prefactoring 先做机械式变更让功能变更更容易。

**映射到其他项目：** Superpowers 的 SDD 按 task 顺序执行，不显式区分水平和垂直。ECC 的 Phase 分解支持独立交付（每个 Phase 可独立 merge）——这接近垂直切片的理念。gstack 的 sprint 结构不显式处理切片策略。

### 4.4 "Plan 未审查导致方向错误"的失败模式

如果 plan 未经审查就进入执行，方向错误可能在执行很久后才被发现——浪费大量工作。

**ECC 的解决**：GATE 1 在 Plan→Execute 之间——用户审批计划后才进入实现。这确保方向错误在执行前被捕获。

**Superpowers 的问题**：自动进入 SDD——plan 完成后立即开始执行，没有人工审批点。如果 plan 方向错误，浪费的是 SDD 的 subagent 调用成本。但 Superpowers 的 Pre-flight check（检查内部冲突）是一个部分缓解——它在执行前一次性检查所有冲突。

**gstack 的折中**：多角色审查在 plan 阶段内完成，autoplan 的 encoded decision principles 处理常见决策。但 taste decisions 需要人类确认——这是 plan 阶段的唯一人工点。

### 4.5 "Plan 审查 gate 被绕过"的失败模式

OpenSpec 的 #1202 bug 暴露了一个隐蔽的问题——`view` 和 `archive` 命令对 task 文件的位置有不同的理解，导致 incomplete-task gate 被完全绕过——未完成的 change 被直接归档。

**根本原因：** `apply.tracks` 被误解为 glob 模式，实际它是文件名——用于选择 artifact，glob 是该 artifact 的 `generates` 字段。多个命令对同一概念有不同的实现。

**映射到其他项目：** 其他项目没有类似的 gate 绕过问题——因为它们的 gate 机制更简单（人工审批或自动通过）。但这个 bug 提醒我们：当 gate 依赖文件解析逻辑时，多个命令必须使用相同的解析逻辑——否则 gate 可能被绕过。

---

## 5. 历史踩坑总结

| 项目 | 踩坑 | 根因 | 教训 |
|------|------|------|------|
| **Superpowers** | Plan Review Loop（25 分钟 subagent 审查）与无 review 质量一致 | subagent 审查在文档审查场景下不如 inline 自检有效 | 文档审查用 inline 自检，subagent 审查留给代码审查 |
| **Superpowers** | Chunk-based plan review 增加 token 消耗但不提升质量 | 分段审查打破 plan 的整体性 | 一次性审查完整 plan，不分段 |
| **Superpowers** | Plan 中允许"类似 Task N"引用导致上下文断裂 | 假设 engineer 按顺序读取 task | 重复代码——engineer 可能不按顺序读取 |
| **OpenSpec** | `view`/`archive` 与 `status` 对 task 文件位置的理解不一致，gate 被绕过 | `apply.tracks` 被误解为 glob | 多个命令必须使用相同的文件解析逻辑 |
| **ECC** | Planner 有写权限时可能在 Plan 阶段修改代码 | 未限制工具权限 | Plan 阶段的 agent 应该只读 |
| **mattpocock** | 三个 skill（to-prd/to-plan/to-issues）总是连续调用，拆分增加认知负担 | 过度拆分 | 实际使用中总是连续调用的 skill 不应该拆分 |
| **mattpocock** | Wide refactor 无法放入 tracer bullet | 垂直切片假设变更可以穿过所有层——机械式重命名不行 | 对 wide refactor 使用 expand-contract 模式 |
| **mattpocock** | wayfinder 硬编码 issue tracker 路径 | 未通过 CLAUDE.md 间接寻址 | 通过配置文件间接寻址，不硬编码路径 |
| **gstack** | Outside voice（Codex review）需要手动 opt-in，大多数用户错过 | 默认不运行高价值功能 | 高价值功能应该默认开启，让用户 opt-out 而非 opt-in |
| **gstack** | Plan review 不先确认审查目标就扫描整个 repo | 无 scope gate | 第一步确认审查目标——避免在空 repo 上浪费时间 |
| **gstack** | Plan review 结束后不告诉用户是否有未解决决策 | 缺少 closing status | 每个 review 必须以一行 status 结束——是否有未解决决策 |
| **gstack** | Plan review skill 过大（138K bytes）消耗大量 context | 所有内容都 always-loaded | skeleton + on-demand sections 模式 |

---

## 6. 本篇总结

### 6.1 总体要求

Plan 节点的核心使命是**从规格到任务**——将 Spec 节点产出的"行为契约"分解为可执行的任务序列，使 Execute 节点有据可依。五个项目在这个使命上的实现方式差异巨大，但都在做同一件事——将"系统应该做什么"转化为"按什么顺序做哪些事"。

**要求一：Plan 的粒度应该与执行者匹配**

Superpowers 的 bite-sized（2-5 分钟）匹配 fresh subagent——每个 subagent 只看一个 task，需要完整代码。mattpocock 的 tracer-bullet（一个 context window）匹配完整 context window 的 agent——粒度大但可独立 demo。粒度不是越细越好——过细导致 plan 冗长，过粗导致进度难跟踪。

**要求二：Plan 的代码包含策略需要权衡**

包含代码（Superpowers）消除歧义但增加 context 消耗和过时风险；不含代码（mattpocock）保护 TDD 但可能有歧义。折中方案（ECC 的文件路径和函数名）可能更通用——明确位置但不限制实现。

**要求三：Plan 审查应该跟风险匹配**

低风险变更自动通过（Superpowers Self-Review），高风险变更人工审批（ECC GATE 1），需要多维评估时多角色审查（gstack autoplan）。一刀切的审查方式要么过重要么过轻。

**要求四：依赖表达应该支持并行**

线性序列（Superpowers）最简单但不支持并行。DAG（OpenSpec artifact graph、mattpocock blocking edges）支持并行执行——在多 agent 场景下很有价值。

### 6.2 应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **声明 Global Constraints** | 确保所有 task 遵循相同标准——减少实现时的不一致 | Superpowers |
| **按风险等级选择审查方式** | 低风险自动、高风险人工、多维评估用多角色——一刀切两端都不合适 | Superpowers（Self-Review）、ECC（GATE 1）、gstack（autoplan） |
| **使用垂直切片** | 每个 task 可独立 demo/验证——减少"全部完成后才发现问题"的风险 | mattpocock（tracer-bullet） |
| **对 wide refactor 用 expand-contract** | 机械式变更的 blast radius 跨整个代码库——强制垂直切片会导致 CI 红 | mattpocock |
| **Plan 包含文件路径和函数名** | 明确位置但不限制实现——介于完整代码和不含代码之间的折中 | ECC |
| **Plan 审查结束时有 status line** | 告诉用户是否有未解决的决策——避免"以为完成了实际没完成" | gstack |
| **强制 Implementation Alternatives** | 至少 2-3 个实现方案对比——避免"只有一种做法"的思维定势 | gstack（plan-ceo-review） |
| **Plan 阶段的 agent 应只读** | 防止在 Plan 阶段修改代码——违反"先想清楚再执行"原则 | ECC（`tools: ["Read", "Grep", "Glob"]`） |
| **Inline 自检优先于 subagent 审查** | 回归测试证明 inline 自检（30s）与 subagent 审查（25min）质量一致 | Superpowers（v5.0.6） |
| **高价值功能默认开启** | outside voice（跨模型审查）opt-out 而非 opt-in——大多数用户不会主动 opt-in | gstack |

### 6.3 不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该分段审查 plan** | 分段审查打破 plan 整体性——一次性审查完整 plan 更有效 | Superpowers（chunk-based review 被移除） |
| **不应该在 plan 中用"类似 Task N"引用** | engineer 可能不按顺序读取 task——上下文断裂 | Superpowers（No Placeholders 的教训） |
| **不应该让多个命令对同一概念有不同的解析逻辑** | gate 可能被绕过——未完成的 change 被归档 | OpenSpec（#1202） |
| **不应该让 Plan 阶段的 agent 有写权限** | 可能在 Plan 阶段修改代码——违反"先想清楚再执行" | ECC（限制为只读的教训） |
| **不应该将总是连续调用的 skill 拆分** | 拆分增加认知负担和上下文切换成本 | mattpocock（三 skill 合并为一） |
| **不应该对 wide refactor 强制垂直切片** | 机械式变更的 blast radius 跨整个代码库——CI 会红 | mattpocock（expand-contract 的教训） |
| **不应该让高价值功能需要手动 opt-in** | 大多数用户不会主动 opt-in——错过了价值 | gstack（outside voice 改为自动） |
| **不应该在 Plan review 不确认审查目标就扫描 repo** | 在空 repo 或错误目标上浪费时间 | gstack（ask-first scope gate 的教训） |
| **不应该让 Plan review 结束时不告诉用户是否有未解决决策** | 用户以为完成了实际没完成 | gstack（unresolved decisions status line 的教训） |
| **不应该让 Plan review skill 过于庞大** | 消耗大量 context——skeleton + on-demand sections 更高效 | gstack（token 缩减 42-49%） |

### 6.4 需要关注什么

在 Plan 节点的实践中，以下几个方面值得持续关注：

**关注点一：Plan 的持续有效性 vs 一次性使用**

所有 5 个项目的 plan 都是一次性的——代码变更后 plan 过时。对于需要追溯"为什么这样设计"的场景，plan 过时是一个问题。但没有项目像 OpenSpec 的 spec Delta 机制那样为 plan 设计持续演进机制——这可能是因为 plan 的价值在于"执行时的指导"，执行完成后 plan 的历史价值有限。

**关注点二：Plan 审查的 ROI**

Superpowers 的回归测试证明 plan review loop（25 分钟）与 inline self-review（30 秒）质量一致——但这个结论可能只适用于文档审查。代码审查（Review & Verify 节点）是否也有同样的结论？subagent 审查在代码审查中可能比文档审查更有价值——因为代码有可执行的测试作为客观标准。

**关注点三：粒度与并行执行的 tradeoff**

细粒度（Superpowers）不支持并行，粗粒度（mattpocock）支持并行但内部进度难跟踪。在多 agent 场景下，DAG + 粗粒度的组合（mattpocock 的 frontier tickets）可能更有优势——但需要 issue tracker 的原生支持。在单 agent 场景下，线性序列 + 细粒度（Superpowers SDD）更简单可靠。

**关注点四：Plan 中的代码包含与 TDD 的冲突**

mattpocock 认为 plan 中包含代码会抑制 TDD——实现者倾向于直接复制代码而非先写测试。但 Superpowers 的 plan 中包含的代码就是 TDD 的测试代码——"Write the failing test" 是 step 1，"Implement the minimal code" 是 step 3。这表明代码包含和 TDD 不一定冲突——关键是 plan 中的代码结构是否遵循 TDD 的 red-green 循环。

**关注点五：多角色审查的复杂度 vs 收益**

gstack 的 plan-ceo-review 有 1477 行，包含 CEO 认知模式、Implementation Alternatives、Prime Directives 等——非常全面但也非常复杂。经过 token 缩减后仍有 80K bytes。多角色审查的收益是否值得这个复杂度？对于需要商业、技术、设计、DX 多维评估的大型项目可能是值得的，但对于简单的 bug fix 可能是过度的。

### 6.5 怎么观察效果

Plan 阶段的效果可以通过以下信号观察：

**正面信号（Plan 有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Execute 阶段不需要"从头开始" | Plan 为 Execute 提供了有效输入 | Execute 阶段是否大量引用 plan 的 task 描述 |
| Execute 阶段没有出现"这不是要做的" | Plan 准确描述了要做什么 | Execute 阶段是否需要大幅返工 |
| 每个 task 可以独立验证 | Plan 的任务分解有效 | 每个 task 完成后是否可以独立测试 |
| Plan 中的 Global Constraints 被遵守 | 全局约束有效 | 检查实现是否遵循 plan 头部的约束 |
| Plan 审查捕获了方向错误 | 审查机制有效 | 审查是否在执行前发现了问题 |
| 并行执行有效（如果使用 DAG） | 依赖表达正确 | frontier tickets 是否可以同时执行 |

**负面信号（Plan 有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Execute 阶段重新定义 plan 中的内容 | Plan 不够精确或不被信任 | Execute 是否在重复 plan 已经讨论过的内容 |
| Execute 阶段发现 plan 中的 task 有歧义 | Plan 的"无歧义"性不足 | 实现时是否对 plan 的理解产生分歧 |
| task 之间出现不一致的实现风格 | 缺少 Global Constraints | 不同 task 的代码风格是否不一致 |
| Plan 审查被跳过 | 审查不在 agent 实际遵循的结构中 | 检查 Self-Review / GATE 是否实际执行 |
| Plan 中包含已过时的代码引用 | Plan 包含了不该包含的代码 | 检查 plan 中的 code 是否与当前代码一致 |
| 所有 task 完成后才能验证 | 水平切片导致无法增量验证 | 是否有 task 可以独立 demo |

### 6.6 怎么改进

Plan 阶段的改进可以从以下几个方向入手：

**改进方向一：按风险等级选择审查方式**

建立明确的风险分级标准——什么算"低风险"变更可以自动通过（Self-Review），什么算"高风险"变更需要人工审批（GATE），什么算"需要多维评估"需要多角色审查。ECC 用 size classifier 决定 phase 运行范围（trivial 跳过 plan），gstack 用 scope mode 决定审查深度——可以借鉴这些分级机制。

**改进方向二：引入 Global Constraints**

在 plan 头部声明跨任务约束——编码标准、测试要求、命名规则等。这确保所有 task 遵循相同标准，减少实现时的不一致。Superpowers 的实践表明这可以显著减少实现时的不一致。

**改进方向三：垂直切片 + DAG 依赖**

将 plan 的任务分解为垂直切片（每个 task 穿过所有层，可独立 demo），用 DAG 表达依赖关系。这支持并行执行（frontier tickets）和增量验证（每个 task 完成后可独立 demo）。对 wide refactor 使用 expand-contract 模式。

**改进方向四：Plan 审查的 status line**

每个 plan review 必须以一行 status 结束——"NO UNRESOLVED DECISIONS" 或未解决决策列表。这避免用户以为 review 完成了实际还有未确认的决策。gstack 的实践表明这是必要的。

**改进方向五：Plan skill 的 token 优化**

如果 plan skill 过于庞大，考虑 skeleton + on-demand sections 模式——always-loaded skeleton 包含 Step 0 和 live interview，deep review body 移到 on-demand sections 文件中。gstack 的实践表明这可以缩减 42-49% 的 context 消耗而不损失功能。

### 6.7 本篇结论

Plan 节点的核心使命是**从规格到任务**——将 Spec 节点产出的"行为契约"分解为可执行的任务序列。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **Plan 的粒度应该与执行者匹配**——fresh subagent 需要细粒度，完整 context window 的 agent 适合粗粒度
2. **Plan 的代码包含策略需要权衡**——包含代码消除歧义但增加 context 消耗和过时风险
3. **Plan 审查应该跟风险匹配**——低风险自动、高风险人工、多维评估用多角色
4. **垂直切片优于水平切片**——每个 task 可独立 demo/验证，但 wide refactor 需要 expand-contract
5. **Inline 自检优先于 subagent 审查**——文档审查场景下 inline 性价比更高
6. **高价值功能应该默认开启**——让用户 opt-out 而非 opt-in
7. **Plan 审查需要有 status line**——告诉用户是否有未解决的决策

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用 Plan 节点时参考。后续章节将逐个节点展开类似的讨论。

---
