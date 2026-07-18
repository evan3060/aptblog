---
title: AI研发流程深度解析（十）：Plan节点——从规格到任务
description: 对比5个项目如何将spec分解为可执行的任务序列，分析任务粒度、代码包含策略、依赖表达和Plan审查机制的关键差异。
tags:
  - 研发流程
  - Plan
  - 任务分解
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 5个项目如何将spec分解为可执行的任务序列？任务粒度、代码包含策略、依赖表达和Plan审查机制有什么关键差异？各项目走过哪些弯路？我们能从中学到什么？

---

![AI研发流程深度解析（十）：Plan节点——从规格到任务](/images/dev-process/dev-process-10-plan-node.png)

## 1. 对比分析

### 1.1 Superpowers：Bite-Sized Tasks + Global Constraints

Superpowers的Plan由 `writing-plans` skill承担（`skills/writing-plans/SKILL.md`）。核心机制是将设计拆解为 **bite-sized tasks（2-5分钟每步）**，每个task包含完整的代码、测试和commit指令。

**关键设计：**

- **Bite-Sized Granularity**：每步一个动作（2-5分钟）——"写失败测试"、"运行确认它失败"、"实现最小代码使测试通过"、"运行测试确认通过"、"Commit"各自独立成step（`SKILL.md` 第47-52行）
- **No Placeholders**：每个步骤必须包含实际内容——"这些是plan的失败——永远不要写：'TBD'、'TODO'、'稍后实现'、'添加适当的错误处理'、'为上述内容写测试'（没有实际测试代码）、'类似Task N'"（第130-136行）
- **Task Right-Sizing**：最小可独立测试单元——"一个task是携带自身测试周期并值得一个新reviewer gate的最小单元。只在reviewer可以有意义地拒绝一个task同时批准其邻居的地方拆分。"（第38-42行）
- **Global Constraints**：plan头部声明跨任务约束——"spec中项目级别的需求——版本下限、依赖限制、命名和文案规则、平台要求——每项一行，从spec中逐字复制精确值。每个task的需求隐式包含此部分。"（第71-74行）
- **Plan中包含完整代码**：不是占位符，是实际代码——"每步包含完整代码——如果一个step修改代码，展示代码"（第141行）
- **Self-Review**：3项inline自检——spec coverage、placeholder scan、type consistency——"写完完整plan后，用新视角审视spec并对照检查plan。这是你自己运行的checklist——不是subagent dispatch。"（第146-147行）
- **Pre-flight plan review**：执行前检查冲突——"在第一个task之前，controller检查plan的内部冲突——以及plan中reviewer会标记为缺陷的任何内容——然后一次性全部提出，而不是在运行中途不断碰到。"（RELEASE-NOTES.md第78行）
- **强制TDD**：每个step都有write test → verify fail → implement → verify pass → commit

**产出：** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v5.0.6之前 | Plan Review Loop（dispatch subagent审查plan）执行时间约25分钟，但跨5个版本5次试验的回归测试显示质量分数与无review一致——"执行时间翻倍（约25分钟开销）但没有可测量地提升plan质量" | v5.0.6替换为inline Self-Review checklist（spec coverage、placeholder scan、type consistency），与spec review同批替换 |
| v5.0.4 | Plan reviewer从7类检查精简到4类——格式相关检查（task syntax、chunk size）被移除，替换为实质检查（buildability、spec alignment）。同时max iterations从5减到3——"只标记会在实现过程中导致真实问题的issue。措辞上的小问题、风格偏好和格式吹毛求疵不应阻断批准。" | v5.0.4精简reviewer checklist，添加Calibration section |
| v5.0.4之前 | Plan reviewer按chunk逐段审查（chunk-by-chunk），每个chunk一次dispatch——token消耗大、速度慢 | v5.0.4替换为single whole-plan review——"plan reviewer现在一次审查完整plan而非逐段审查。移除了所有chunk相关概念" |
| 早期 | Plan中允许"类似Task N"的引用——但engineer可能不按顺序读取task，导致上下文断裂 | 添加 "No Placeholders" section，明确禁止"Similar to Task N"——"重复代码——engineer可能不按顺序读取task" |
| v5.0.1之前 | Spec写完后直接进入writing-plans，没有用户审查点——用户无法在spec→plan之间叫停 (#565) | v5.0.1添加explicit User Review Gate——spec完成后用户审批才能进入plan |

**核心教训：** Plan的质量保障机制与Spec走了完全相同的弯路——subagent review loop（25分钟）与inline self-review（30秒）效果一致，但inline摩擦低得多。这印证了一个跨节点的规律：文档审查场景下，inline自检的性价比远高于subagent dispatch。另一个关键教训是chunk-based review被彻底移除——"移除了所有chunk相关概念"——因为分段审查增加token消耗但不提升质量。

### 1.2 OpenSpec：Checkbox清单 + Artifact Graph

OpenSpec的Plan产出是 `tasks.md`——change文件夹中的一个artifact（`src/core/artifact-graph/graph.ts`、`docs/concepts.md`）。tasks.md是一个简单的checkbox清单，不包含代码，只描述"做什么"。

**关键设计：**

- **Checkbox格式**：简单的实现清单——"- [ ] implement user registration form"、"- [ ] add validation for email field"。Mark完成的task为 `- [x]`（`docs/concepts.md`）
- **Artifact Graph（DAG）**：`ArtifactGraph.getNextArtifacts(completed)` 提供确定性"什么可以创建"查询——使用Kahn's算法计算拓扑排序（`graph.ts` 第72-113行）。tasks.md `requires: [specs, design]`（`concepts.md` 第430-431行）
- **Enablers not Gates**：依赖表示"使能"而非"门禁"——"依赖是使能器而非门禁。它们展示可以创建什么，而非必须接着创建什么。如果不需要可以跳过design。"（`concepts.md` 第455行）
- **Schema四级解析**：CLI→change→project→default，允许同一项目不同变更使用不同工作流
- **tasks.md不包含代码**：只描述"做什么"——与spec的"behavior, not code"原则一脉相承
- **Incomplete-task gate**：archive时检查tasks.md的checkbox是否全部完成——未完成则阻止归档（`archive-change.ts` 第47行）

**产出：** `changes/<change-name>/tasks.md`

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| #1202 | project-local schema配置 `generates: "**/tasks.md"` 时，`status` 命令通过glob查找嵌套tasks.md文件，但 `view` 和 `archive` 命令硬编码了 `changes/<name>/tasks.md` 路径——导致嵌套tasks.md的change在 `view` 中显示为Draft（看不到task进度），在 `archive` 中未完成task的gate被完全绕过，change被直接归档 | 修复：`view`/`archive`/`list` 通过tracked-tasks artifact的 `generates` glob解析task文件——与 `status` 使用相同的文件解析逻辑 |
| 早期 | `apply.tracks` 被误解为glob模式，实际它是文件名——用于选择artifact，glob是该artifact的 `generates` 字段 | 文档明确："apply.tracks是一个选择artifact的文件名，它不是glob" |

**核心教训：** OpenSpec的tasks.md极度轻量（只是checkbox清单），但轻量带来的是实现时的"自由度"——agent需要自己决定如何实现每个task。当tasks.md与artifact graph配合使用时，DAG提供了确定性进度追踪。但 #1202的bug暴露了一个设计风险：当多个命令对"task文件在哪里"有不同的理解时，gate可能被绕过——这是数据安全问题。

### 1.3 ECC：Planner Agent + Phase/Step/Risk

ECC的Plan由 `planner` agent承担（`agents/planner.md`）——使用Opus模型、只读权限（`tools: ["Read", "Grep", "Glob"]`）。

**关键设计：**

- **Phase + Step格式**：每个Step包含File path、Action、Why、Dependencies、Risk——"清晰、具体的动作 / 文件路径和位置 / 步骤间依赖 / 预估复杂度 / 潜在风险"（`planner.md` 第42-47行）
- **Plan包含具体文件路径和函数名**：不使用占位符——"要具体：使用确切的文件路径、函数名、变量名"（第102行）
- **Phase分解支持独立交付**：大功能拆分为MVP → Core → Edge cases → Optimization——"Phase 1: 最小可行——提供价值的最小切片 / Phase 2: 核心体验——完整happy path / Phase 3: 边缘情况 / Phase 4: 优化"（第199-205行）。每个Phase可独立merge——"每个phase应能独立merge。避免需要所有phase全部完成后才能工作的plan。"（第206行）
- **Red Flags检查**：>50行函数、>4层嵌套、重复代码、缺失错误处理、硬编码值、缺失测试、性能瓶颈、无测试策略的plan、无清晰文件路径的step、不能独立交付的Phase（第209-219行）
- **Worked Example**：planner.md包含一个完整的Stripe Subscription Billing示例——展示期望的详细程度
- **GATE 1**：用户审批计划后才进入实现——ECC的orchestrator流程是"Phase 1: RESEARCH → Phase 2: PLAN → Phase 3: IMPLEMENT"，Plan阶段产出plan.md后需要人工审批

**产出：** `plan.md`（包含Phase/Step结构）

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| 早期 | Planner agent没有model限制，使用default model时plan质量不稳定 | 显式指定 `model: opus`——planner使用最强模型确保plan质量 |
| 早期 | Planner agent有写权限，可能在Plan阶段就修改代码——违反"先想清楚再执行"原则 | 限制为只读权限：`tools: ["Read", "Grep", "Glob"]`——plan阶段不允许修改代码 |
| v1.x | 缺乏多session规划能力——大型项目需要跨session的计划追踪 | 添加 `blueprint` skill——"多session构建规划"，产出 `plans/` 目录下的自包含plan文件 |

**核心教训：** ECC的Plan节点设计体现了"角色隔离"原则——planner使用Opus模型（最强推理能力）、只读权限（不会在plan阶段修改代码）、明确的Phase分解（支持增量交付）。Red Flags检查列表是一个好的实践——它在plan编写时就捕获常见代码质量问题，而非等到review阶段。

### 1.4 mattpocock-skills：Tracer-Bullet Tickets + DAG

mattpocock的Plan由 `/to-tickets` 承担（`skills/engineering/to-tickets/SKILL.md`）。将plan/spec/对话分解为 **tracer-bullet tickets**——垂直切片，每个ticket穿过所有层。

**关键设计：**

- **垂直而非水平切片**：每个ticket穿过schema/API/UI/tests所有层，可独立demo/验证——"每个切片穿透每一层（schema、API、UI、tests）的一条窄但完整的路径——是垂直切片，不是单层的水平切片。完成的切片可以独立demo或验证"（`SKILL.md` 第31-33行）
- **一个ticket适配一个context window**：粒度标准是context window大小——"每个切片的大小适配一个全新的context window"（第34行）
- **Blocking edges（DAG）**：每个ticket声明依赖——"给每个ticket设置blocking edges——必须在它开始之前完成的其他ticket。没有blocker的ticket可以立即开始。"（第38行）。优先使用tracker原生依赖关系
- **"让变更变容易，再做容易的变更"**：prefactoring先做——"寻找机会预先重构代码以简化实现。"（第23行）
- **Wide refactor例外**：机械式变更用expand-contract模式——"wide refactor是一个机械式变更——重命名一列、改变一个共享符号的类型——其影响范围蔓延整个代码库。不要强制把它塞入tracer bullet；用expand-contract模式排列。"（第40行）
- **明确禁止file paths和code snippets**——"避免具体的文件路径或代码片段——它们很快就会过时。例外：如果prototype产出了一个比文字描述更精确地编码了决策的snippet"（第105行）
- **用户审查breakdown后发布到issue tracker**——"将拟议的分解呈现为编号列表...问用户：粒度感觉合适吗？Blocking edges正确吗？是否需要合并或进一步拆分某些ticket？迭代直到用户批准分解。"（第44-56行）

**产出：** 发布到issue tracker（GitHub/Linear）或本地 `.scratch/<feature-slug>/issues/` 目录

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v1.1.0之前 | 三个独立skill `to-prd`、`to-plan`、`to-issues` 分别负责PRD生成、plan分解、issue发布——实际使用中总是连续调用，拆分增加了认知负担和上下文切换成本 | v1.1.0合并为一个 `to-tickets` skill——"to-plan和to-issues合并为一个to-tickets skill，to-issues被删除"。同时 `to-prd` 重命名为 `to-spec` |
| v1.1.0之前 | `to-issues` 不支持wide refactor——机械式重命名/类型变更的blast radius跨整个代码库，无法放入单个tracer bullet，强制放入导致CI红 | v1.1.0添加wide refactor支持——expand-contract模式："先扩展：在旧形式旁边添加新形式，确保不破坏任何东西。然后按blast radius分批次迁移调用点。最后收缩：一旦没有调用者剩余，删除旧形式。" |
| v1.1.0 | `wayfinder` skill硬编码了 `docs/agents/issue-tracker.md` 路径——在其他repo中issue tracker配置在别处时，wayfinder静默回退到local-markdown tracker，即使CLAUDE.md明确声明使用GitHub issues | 修复：wayfinder通过CLAUDE.md/AGENTS.md中的 `### Issue tracker` block解析tracker文档路径——与其他skill保持一致的间接寻址 |

**核心教训：** mattpocock的Plan节点走了从"三skill拆分"到"单skill合并"的弯路——实际使用中总是连续调用的skill不应该拆分。更重要的是wide refactor的expand-contract模式——当变更blast radius跨整个代码库时，强制垂直切片会导致CI红，expand-contract是更安全的替代方案。

### 1.5 gstack：多角色审查 + Autoplan

gstack的Plan由多个skills承担——`plan-ceo-review/SKILL.md`（商业方向审查）、`plan-eng-review/SKILL.md`（技术方案审查）、`plan-design-review/SKILL.md`（UI/UX审查）、`plan-devex-review/SKILL.md`（开发者体验审查）。

**关键设计：**

- **多角色审查**：每个角色关注不同维度——CEO review关注商业方向和scope ambition（"重新思考问题，寻找10星级产品，挑战前提，在能创造更好产品时扩大scope"），Eng review关注架构和技术方案（"锁定执行计划——架构、数据流、图表、边缘情况、测试覆盖、性能"）
- **四种审查模式**：SCOPE EXPANSION（dream big）、SELECTIVE EXPANSION（hold scope + cherry-pick）、HOLD SCOPE（maximum rigor）、SCOPE REDUCTION（strip to essentials）——"一旦选定，全力投入。不要默默偏移。"（`plan-ceo-review/SKILL.md` 第879行）
- **`/autoplan`**：自动运行所有计划阶段审查——`/autoplan` 的dual-voice eval验证Claude review subagent和Codex outside voice都实际触发
- **Ask-first scope gate**：Plan review的第一步是确认审查目标——"在这个skill中做任何其他事情之前——你的第一个工具调用必须是AskUserQuestion，确认审查目标。"（`plan-eng-review/SKILL.md` 第814行）
- **Implementation Alternatives（MANDATORY）**：至少2-3个实现方案——"至少需要2个方案。非平凡plan推荐3个。一个必须是'最小可行'方案。一个必须是'理想架构'方案"（`plan-ceo-review/SKILL.md` 第1232-1235行）
- **AskUserQuestion格式**：D<N> + ELI10 + Completeness + Pros/Cons + Net——每个决策都有推荐项和完整tradeoff分析
- **plan-eng-review产出test plan**：嵌入plan文件供 `/qa` 读取
- **Token优化**：plan-ceo-review从138,838 B缩减到80,731 B（-42%），plan-eng-review从106,984 B缩减到54,892 B（-48.7%）——"always-loaded的骨架加上一个按需加载的sections/ 文件，agent只在到达相关工作时才打开"

**产出：** Plan文件 + GSTACK REVIEW REPORT（包含Runs/Status/Findings表和VERDICT行）

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| 早期 | Plan review的outside voice（Codex review）需要用户手动opt-in——大多数用户不知道有这个选项，错过了跨模型审查的价值 | 改为自动运行——"跨 /review、/ship、/plan-ceo-review、/plan-eng-review、/plan-design-review、/plan-devex-review、/document-release和 /autoplan的Codex review。plan-review的outside voice自动运行。" |
| 早期 | `/plan-eng-review` 和 `/plan-design-review` 不先确认审查目标就扫描整个repo——在空repo上浪费大量时间 | 添加ask-first scope gate——"第一个动作确认审查目标（branch diff / 粘贴的plan / 特定路径），然后才进行任何repo探索或审计" |
| 早期 | Plan review结束后不告诉用户是否有未解决的决策——用户以为review完成了，实际上还有未确认的决策 | 添加unresolved decisions status line——"每个plan review现在结束时用一行告诉你是否还有未解决的决策" |
| 早期 | `/plan-devex-review` 从未写入review log——gate无法检查它是否实际执行了review | 修复review log写入——"/plan-devex-review从未写入review条目。它承载了审批gate但..." |
| 早期 | Plan review skill过于庞大（138K-112K bytes），消耗大量context | Token缩减：skeleton + on-demand sections——"五个最重的skill现在是一个小的always-loaded骨架加上一个按需加载的sections/ 文件" |
| 早期 | /autoplan的dual-voice eval在sandbox中无法触发Claude Code 2.x的slash-command resolution | 修复：eval sandbox在project-level `.claude/skills/` 安装skill——匹配真实的slash-command解析路径 |

**核心教训：** gstack的Plan节点走了从"手动opt-in"到"自动运行"的弯路——outside voice（跨模型审查）的价值很大，但手动opt-in导致大多数用户错过。另一个教训是plan review skill过大（138K bytes）会消耗大量context——skeleton + on-demand sections模式可以在不损失功能的前提下缩减42-49%。

---

## 2. 关键差异

### 2.1任务粒度对比

| 项目 | 粒度单位 | 典型大小 | 包含代码 | 粒度标准 |
|------|---------|---------|---------|---------|
| **Superpowers** | Step | 2-5分钟 | ✅ 完整代码 | 最小可独立测试单元 |
| **OpenSpec** | Checkbox项 | 不定 | ❌ 只描述"做什么" | 无明确标准 |
| **ECC** | Step（在Phase内） | 不定 | ✅ 文件路径和函数名 | Phase可独立merge |
| **mattpocock** | Ticket | 一个context window | ❌ 禁止代码 | 垂直切片可独立demo |
| **gstack** | Plan（多角色审查） | 不定 | ❌ 自由格式 | 按scope mode调节 |

**关键观察：** 粒度从最精细（Superpowers的2-5分钟）到最粗（mattpocock的一个context window）差异达**一个数量级以上**。粒度的选择不是随意的——它与执行者匹配：Superpowers的执行者是fresh subagent（每步一个动作），mattpocock的执行者是完整context window的agent。粒度还与并行需求匹配：mattpocock的frontier tickets可以并行，Superpowers的线性step序列不支持并行。

### 2.2 Plan审查机制对比

| 项目 | Plan审查 | 阻断性 | 审查者 | 审查内容 |
|------|---------|-------|--------|---------|
| **Superpowers** | Self-Review + Pre-flight | ❌ 自动进入SDD | AI自检 | spec coverage、placeholder scan、type consistency |
| **OpenSpec** | 无显式审查 | ❌ Enablers not Gates | 无 | — |
| **ECC** | GATE 1 | ✅ 用户审批 | 人类 | plan.md整体审查 |
| **mattpocock** | 用户审查breakdown | ✅ 用户审查后发布 | 人类 | 粒度、blocking edges、是否需要merge/split |
| **gstack** | 多角色审查 + autoplan | ⚠️ taste decisions需确认 | AI多角色 + 人类（taste） | 架构、商业方向、UI/UX、DX + Implementation Alternatives |

**关键观察：** ECC和mattpocock有人在Plan阶段审查——ECC的GATE 1和mattpocock的"用户审查breakdown"都是人工审批点。Superpowers和OpenSpec自动进入下一阶段。gstack是混合——AI多角色审查 + 人类只审taste decisions。审查的深度也不同：gstack的plan-ceo-review包含Implementation Alternatives（强制2-3个方案对比），其他项目不要求方案对比。

### 2.3依赖表达方式对比

| 项目 | 依赖表达 | 支持并行 | 机制 |
|------|---------|---------|------|
| **Superpowers** | 线性序列（step顺序执行） | ❌ 不支持 | Step内的Interfaces block传递 |
| **OpenSpec** | Artifact Graph DAG | ✅ `getNextArtifacts()` 查询 | Kahn's算法拓扑排序 |
| **ECC** | Phase顺序 + Step Dependencies | ⚠️ Phase间顺序，Step间有依赖 | Step的Dependencies字段 |
| **mattpocock** | Blocking edges（DAG） | ✅ frontier tickets可并行 | Ticket间的blocking声明 |
| **gstack** | Sprint链式（顺序传递） | ⚠️ sprint内顺序 | 按顺序传递给下一个review |

**关键观察：** OpenSpec和mattpocock都使用DAG表达依赖——但OpenSpec的DAG是artifact级别（specs→design→tasks），mattpocock的DAG是ticket级别（更细粒度）。Superpowers的线性序列最简单但最不灵活——不支持并行执行。DAG的优势是frontier tickets/artifacts可以并行执行——这在多agent场景下很有价值。

### 2.4 Plan中代码包含策略对比

| 项目 | 代码包含 | 理由 | 风险 |
|------|---------|------|------|
| **Superpowers** | ✅ 完整代码 | 消除歧义、plan即可执行 | plan很长、代码过时风险 |
| **OpenSpec** | ❌ 不含代码 | 与spec的"behavior, not code"一致 | 实现时需要重新做设计决策 |
| **ECC** | ⚠️ 文件路径和函数名 | 明确位置但不限制实现 | 介于两者之间 |
| **mattpocock** | ❌ 禁止代码 | "they go stale fast"、保护TDD | 可能有歧义 |
| **gstack** | ❌ 自由格式 | 由plan review的内容决定 | 无约束 |

**关键观察：** 这是Plan节点最根本的分歧——Superpowers包含完整代码，mattpocock明确禁止。两者的理由都有道理：包含代码消除歧义但增加context消耗和过时风险；不含代码保护TDD但可能有歧义。ECC的折中（文件路径和函数名）是一个有参考价值的中间方案。

---

## 3. 好的实践方向讨论

### 3.1 Plan中是否包含代码？

**Superpowers的立场**：Plan中包含完整代码消除了实现时的歧义。No Placeholders原则要求每个步骤有实际内容——如果plan不包含代码，实现时agent需要重新做设计决策，这违背了"先想清楚再执行"的原则。Superpowers的执行者是fresh subagent——它只看到自己的task，不看到其他task的上下文，因此plan中的代码是它唯一的信息来源。

**mattpocock的立场**：Plan中不含代码保护了TDD——如果plan已有代码，实现者倾向于直接复制而非先写测试。"they go stale fast"——代码会变但plan中的代码不会自动更新。但mattpocock留了一个例外：prototype产生的snippet如果"encodes a decision more precisely than prose can"可以内联。

**tradeoff分析：**

- **包含代码的优势**：消除歧义、减少实现时的决策、plan即可执行
- **包含代码的代价**：plan很长（增加context消耗）、代码过时风险、可能抑制TDD
- **不含代码的优势**：plan轻量、保护TDD、plan不随代码过时
- **不含代码的代价**：实现时需要重新做设计决策、可能有歧义

**可能的好的实践方向：** Plan应该描述"做什么"和"关键设计决策"而非"完整代码"。粒度也是一个因素——如果是bite-sized step（Superpowers），包含代码是合理的因为每步只改几行；如果是tracer-bullet ticket（mattpocock），包含代码不现实因为一个ticket可能涉及大量代码。ECC的折中——plan包含文件路径和函数名（明确位置）但不包含完整代码（留出实现空间）——可能是一个通用的方案。

### 3.2任务粒度：Bite-Sized vs Tracer-Bullet

**Superpowers的bite-sized（2-5分钟）**：每步一个动作。优势是精确控制——agent每步commit、每步验证。代价是plan极长（一个功能可能几十个step）。但Superpowers的Self-Review从chunk-based（逐段审查）改为single whole-plan review——这表明长plan不是问题，分段审查才是问题。

**mattpocock的tracer-bullet（一个context window）**：每个ticket是完整垂直切片。优势是独立可验证——每个ticket可以独立demo。代价是粒度大——一个ticket内部的进度难以跟踪。但mattpocock的blocking edges（DAG）允许frontier tickets并行执行——这是bite-sized无法做到的。

**tradeoff分析：**

- **细粒度的优势**：精确控制、每步可验证、问题定位精确
- **细粒度的代价**：plan冗长、context消耗大、可能过度规划
- **粗粒度的优势**：plan轻量、独立可demo、适合并行执行
- **粗粒度的代价**：内部进度难跟踪、问题定位不精确

**可能的好的实践方向：** 粒度应该与执行者匹配——如果执行者是fresh subagent（Superpowers SDD），需要细粒度（每步一个动作）；如果执行者是完整context window的agent（mattpocock），粗粒度足够。粒度还应与并行需求匹配——如果需要并行执行（mattpocock的frontier tickets），需要粗粒度的独立ticket。

### 3.3 Global Constraints：跨任务的约束

Superpowers是唯一显式定义Global Constraints的项目——跨任务的约束如编码标准、测试要求。这些约束在plan头部声明，对所有task生效——"每个task的需求隐式包含此部分"。

**其他项目没有显式的Global Constraints：**
- OpenSpec的tasks.md没有约束声明
- ECC的plan有Phase级约束但没有全局约束
- mattpocock的tickets没有跨ticket约束
- gstack的preamble包含全局行为（如Search Before Building）但不约束具体任务

**为什么重要：** Global Constraints确保所有task遵循相同的标准——如"所有public API必须有JSDoc"、"所有数据库访问必须通过repository pattern"。如果没有全局约束，每个task可能做出不一致的选择——ECC的Red Flags检查（>50行函数、>4层嵌套）是在plan编写时检查，但如果这些标准不在Global Constraints中声明，不同task的标准可能不一致。

**可能的好的实践方向：** Global Constraints是一个好的实践——它让plan不仅仅是一组任务，而是一组在共享约束下的任务。Superpowers的实践表明这可以显著减少实现时的不一致。

### 3.4 Plan审查：自动vs人工vs多角色

**三种Plan审查范式：**

- **自动（Superpowers, OpenSpec）**：AI自检或不审查，自动进入执行。Superpowers的Self-Review（spec coverage、placeholder scan、type consistency）是inline的30秒检查——与spec的inline self-review同源。优势是快；代价是可能基于错误的plan执行
- **人工（ECC, mattpocock）**：人类审查plan后才执行。ECC的GATE 1在Plan→Execute之间。mattpocock的"用户审查breakdown"在发布到issue tracker前。优势是方向正确；代价是延迟
- **多角色（gstack）**：AI多角色审查 + 人类只审taste decisions。gstack的plan-ceo-review包含Implementation Alternatives（强制2-3个方案对比）、Prime Directives（zero silent failures、every error has a name等）、Cognitive Patterns（CEO/Eng Manager思维模型）。优势是全面；代价是复杂——plan-ceo-review有1477行

**tradeoff分析：**

- 自动审查适合低风险变更——快速进入执行
- 人工审查适合高风险变更——确保方向正确
- 多角色审查适合需要多维度评估的变更——商业、技术、设计、DX

**可能的好的实践方向：** 按风险等级选择审查方式——低风险自动通过，中风险AI自检，高风险人工审批，需要多维评估时多角色审查。gstack的autoplan是一个有趣的探索——encoded decision principles处理常见决策，只taste decisions需要人类。但gstack的复杂度也是一个警示——1477行的plan-ceo-review经过token缩减后才降到80K bytes。

### 3.5垂直切片vs水平切片

mattpocock是唯一显式讨论切片策略的项目——tracer-bullet tickets是垂直切片，每个ticket穿过所有层（schema/API/UI/tests）。

**为什么重要：** 水平切片（先做所有schema，再做所有API，再做所有UI）的问题在于：每个层不能独立demo——只有全部完成后才能验证。垂直切片的每个ticket可以独立demo/验证。

**其他项目的处理：**
- Superpowers的SDD按task顺序执行，不显式区分水平和垂直
- ECC的Phase分解支持独立交付（每个Phase可独立merge）——这接近垂直切片的理念
- OpenSpec的tasks.md不处理切片策略
- gstack的sprint结构不显式处理切片策略

**可能的好的实践方向：** 垂直切片是一个值得采纳的实践——它确保每个task/ticket可以独立验证，减少"全部完成后才发现问题"的风险。但wide refactor是例外——机械式变更（重命名、类型变更）的blast radius跨整个代码库，强制垂直切片会导致CI红，expand-contract模式是更安全的替代。

---

## 4. 案例映射

### 4.1 "Plan过于详细"的失败模式

Superpowers的bite-sized steps可能导致plan极长——一个中等功能可能有30-50个step。这增加了plan编写时间和context消耗。

**映射到其他项目：** OpenSpec的tasks.md和mattpocock的tracer-bullet tickets都更轻量。但轻量的代价是实现时需要更多判断——agent需要自己决定如何实现每个task。ECC的Phase分解介于两者之间——Phase是粗粒度的，但Phase内的Step包含文件路径和Risk。

**Superpowers自己的缓解措施：** Self-Review从chunk-based改为single whole-plan——这表明Superpowers认为长plan不是问题，分段审查才是问题。Pre-flight check在执行前一次性检查所有冲突——而不是在执行过程中逐个发现。

### 4.2 "Plan不含代码导致歧义"的失败模式

mattpocock禁止plan包含代码——但实现时agent可能不知道应该用什么模式、什么接口。

**映射到其他项目：** Superpowers的完整代码消除了歧义。ECC的文件路径和函数名提供了位置指引。OpenSpec和mattpocock一样不含代码——但OpenSpec有spec作为行为基准（实现时可以对照spec判断是否正确）。

**mattpocock的缓解措施：** 允许prototype产生的snippet例外——"if a prototype produced a snippet that encodes a decision more precisely than prose can, inline it and note briefly that it came from a prototype"。这比完全禁止代码更灵活。

### 4.3 "水平切片导致无法独立验证"的失败模式

如果plan按层分解（先做所有schema，再做所有API，再做所有UI），每个层不能独立demo——只有全部完成后才能验证。

**mattpocock的解决**：tracer-bullet tickets是垂直切片——每个ticket穿过所有层，可独立demo/验证。"让变更变容易，再做容易的变更"——prefactoring先做机械式变更让功能变更更容易。

**映射到其他项目：** Superpowers的SDD按task顺序执行，不显式区分水平和垂直。ECC的Phase分解支持独立交付（每个Phase可独立merge）——这接近垂直切片的理念。gstack的sprint结构不显式处理切片策略。

### 4.4 "Plan未审查导致方向错误"的失败模式

如果plan未经审查就进入执行，方向错误可能在执行很久后才被发现——浪费大量工作。

**ECC的解决**：GATE 1在Plan→Execute之间——用户审批计划后才进入实现。这确保方向错误在执行前被捕获。

**Superpowers的问题**：自动进入SDD——plan完成后立即开始执行，没有人工审批点。如果plan方向错误，浪费的是SDD的subagent调用成本。但Superpowers的Pre-flight check（检查内部冲突）是一个部分缓解——它在执行前一次性检查所有冲突。

**gstack的折中**：多角色审查在plan阶段内完成，autoplan的encoded decision principles处理常见决策。但taste decisions需要人类确认——这是plan阶段的唯一人工点。

### 4.5 "Plan审查gate被绕过"的失败模式

OpenSpec的 #1202 bug暴露了一个隐蔽的问题——`view` 和 `archive` 命令对task文件的位置有不同的理解，导致incomplete-task gate被完全绕过——未完成的change被直接归档。

**根本原因：** `apply.tracks` 被误解为glob模式，实际它是文件名——用于选择artifact，glob是该artifact的 `generates` 字段。多个命令对同一概念有不同的实现。

**映射到其他项目：** 其他项目没有类似的gate绕过问题——因为它们的gate机制更简单（人工审批或自动通过）。但这个bug提醒我们：当gate依赖文件解析逻辑时，多个命令必须使用相同的解析逻辑——否则gate可能被绕过。

---

## 5. 历史踩坑总结

| 项目 | 踩坑 | 根因 | 教训 |
|------|------|------|------|
| **Superpowers** | Plan Review Loop（25分钟subagent审查）与无review质量一致 | subagent审查在文档审查场景下不如inline自检有效 | 文档审查用inline自检，subagent审查留给代码审查 |
| **Superpowers** | Chunk-based plan review增加token消耗但不提升质量 | 分段审查打破plan的整体性 | 一次性审查完整plan，不分段 |
| **Superpowers** | Plan中允许"类似Task N"引用导致上下文断裂 | 假设engineer按顺序读取task | 重复代码——engineer可能不按顺序读取 |
| **OpenSpec** | `view`/`archive` 与 `status` 对task文件位置的理解不一致，gate被绕过 | `apply.tracks` 被误解为glob | 多个命令必须使用相同的文件解析逻辑 |
| **ECC** | Planner有写权限时可能在Plan阶段修改代码 | 未限制工具权限 | Plan阶段的agent应该只读 |
| **mattpocock** | 三个skill（to-prd/to-plan/to-issues）总是连续调用，拆分增加认知负担 | 过度拆分 | 实际使用中总是连续调用的skill不应该拆分 |
| **mattpocock** | Wide refactor无法放入tracer bullet | 垂直切片假设变更可以穿过所有层——机械式重命名不行 | 对wide refactor使用expand-contract模式 |
| **mattpocock** | wayfinder硬编码issue tracker路径 | 未通过CLAUDE.md间接寻址 | 通过配置文件间接寻址，不硬编码路径 |
| **gstack** | Outside voice（Codex review）需要手动opt-in，大多数用户错过 | 默认不运行高价值功能 | 高价值功能应该默认开启，让用户opt-out而非opt-in |
| **gstack** | Plan review不先确认审查目标就扫描整个repo | 无scope gate | 第一步确认审查目标——避免在空repo上浪费时间 |
| **gstack** | Plan review结束后不告诉用户是否有未解决决策 | 缺少closing status | 每个review必须以一行status结束——是否有未解决决策 |
| **gstack** | Plan review skill过大（138K bytes）消耗大量context | 所有内容都always-loaded | skeleton + on-demand sections模式 |

---

## 6. 本篇总结

### 6.1总体要求

Plan节点的核心使命是**从规格到任务**——将Spec节点产出的"行为契约"分解为可执行的任务序列，使Execute节点有据可依。五个项目在这个使命上的实现方式差异巨大，但都在做同一件事——将"系统应该做什么"转化为"按什么顺序做哪些事"。

**要求一：Plan的粒度应该与执行者匹配**

Superpowers的bite-sized（2-5分钟）匹配fresh subagent——每个subagent只看一个task，需要完整代码。mattpocock的tracer-bullet（一个context window）匹配完整context window的agent——粒度大但可独立demo。粒度不是越细越好——过细导致plan冗长，过粗导致进度难跟踪。

**要求二：Plan的代码包含策略需要权衡**

包含代码（Superpowers）消除歧义但增加context消耗和过时风险；不含代码（mattpocock）保护TDD但可能有歧义。折中方案（ECC的文件路径和函数名）可能更通用——明确位置但不限制实现。

**要求三：Plan审查应该跟风险匹配**

低风险变更自动通过（Superpowers Self-Review），高风险变更人工审批（ECC GATE 1），需要多维评估时多角色审查（gstack autoplan）。一刀切的审查方式要么过重要么过轻。

**要求四：依赖表达应该支持并行**

线性序列（Superpowers）最简单但不支持并行。DAG（OpenSpec artifact graph、mattpocock blocking edges）支持并行执行——在多agent场景下很有价值。

### 6.2应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **声明Global Constraints** | 确保所有task遵循相同标准——减少实现时的不一致 | Superpowers |
| **按风险等级选择审查方式** | 低风险自动、高风险人工、多维评估用多角色——一刀切两端都不合适 | Superpowers（Self-Review）、ECC（GATE 1）、gstack（autoplan） |
| **使用垂直切片** | 每个task可独立demo/验证——减少"全部完成后才发现问题"的风险 | mattpocock（tracer-bullet） |
| **对wide refactor用expand-contract** | 机械式变更的blast radius跨整个代码库——强制垂直切片会导致CI红 | mattpocock |
| **Plan包含文件路径和函数名** | 明确位置但不限制实现——介于完整代码和不含代码之间的折中 | ECC |
| **Plan审查结束时有status line** | 告诉用户是否有未解决的决策——避免"以为完成了实际没完成" | gstack |
| **强制Implementation Alternatives** | 至少2-3个实现方案对比——避免"只有一种做法"的思维定势 | gstack（plan-ceo-review） |
| **Plan阶段的agent应只读** | 防止在Plan阶段修改代码——违反"先想清楚再执行"原则 | ECC（`tools: ["Read", "Grep", "Glob"]`） |
| **Inline自检优先于subagent审查** | 回归测试证明inline自检（30s）与subagent审查（25min）质量一致 | Superpowers（v5.0.6） |
| **高价值功能默认开启** | outside voice（跨模型审查）opt-out而非opt-in——大多数用户不会主动opt-in | gstack |

### 6.3不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该分段审查plan** | 分段审查打破plan整体性——一次性审查完整plan更有效 | Superpowers（chunk-based review被移除） |
| **不应该在plan中用"类似Task N"引用** | engineer可能不按顺序读取task——上下文断裂 | Superpowers（No Placeholders的教训） |
| **不应该让多个命令对同一概念有不同的解析逻辑** | gate可能被绕过——未完成的change被归档 | OpenSpec（#1202） |
| **不应该让Plan阶段的agent有写权限** | 可能在Plan阶段修改代码——违反"先想清楚再执行" | ECC（限制为只读的教训） |
| **不应该将总是连续调用的skill拆分** | 拆分增加认知负担和上下文切换成本 | mattpocock（三skill合并为一） |
| **不应该对wide refactor强制垂直切片** | 机械式变更的blast radius跨整个代码库——CI会红 | mattpocock（expand-contract的教训） |
| **不应该让高价值功能需要手动opt-in** | 大多数用户不会主动opt-in——错过了价值 | gstack（outside voice改为自动） |
| **不应该在Plan review不确认审查目标就扫描repo** | 在空repo或错误目标上浪费时间 | gstack（ask-first scope gate的教训） |
| **不应该让Plan review结束时不告诉用户是否有未解决决策** | 用户以为完成了实际没完成 | gstack（unresolved decisions status line的教训） |
| **不应该让Plan review skill过于庞大** | 消耗大量context——skeleton + on-demand sections更高效 | gstack（token缩减42-49%） |

### 6.4需要关注什么

在Plan节点的实践中，以下几个方面值得持续关注：

**关注点一：Plan的持续有效性vs一次性使用**

所有5个项目的plan都是一次性的——代码变更后plan过时。对于需要追溯"为什么这样设计"的场景，plan过时是一个问题。但没有项目像OpenSpec的spec Delta机制那样为plan设计持续演进机制——这可能是因为plan的价值在于"执行时的指导"，执行完成后plan的历史价值有限。

**关注点二：Plan审查的ROI**

Superpowers的回归测试证明plan review loop（25分钟）与inline self-review（30秒）质量一致——但这个结论可能只适用于文档审查。代码审查（Review & Verify节点）是否也有同样的结论？subagent审查在代码审查中可能比文档审查更有价值——因为代码有可执行的测试作为客观标准。

**关注点三：粒度与并行执行的tradeoff**

细粒度（Superpowers）不支持并行，粗粒度（mattpocock）支持并行但内部进度难跟踪。在多agent场景下，DAG + 粗粒度的组合（mattpocock的frontier tickets）可能更有优势——但需要issue tracker的原生支持。在单agent场景下，线性序列 + 细粒度（Superpowers SDD）更简单可靠。

**关注点四：Plan中的代码包含与TDD的冲突**

mattpocock认为plan中包含代码会抑制TDD——实现者倾向于直接复制代码而非先写测试。但Superpowers的plan中包含的代码就是TDD的测试代码——"Write the failing test" 是step 1，"Implement the minimal code" 是step 3。这表明代码包含和TDD不一定冲突——关键是plan中的代码结构是否遵循TDD的red-green循环。

**关注点五：多角色审查的复杂度vs收益**

gstack的plan-ceo-review有1477行，包含CEO认知模式、Implementation Alternatives、Prime Directives等——非常全面但也非常复杂。经过token缩减后仍有80K bytes。多角色审查的收益是否值得这个复杂度？对于需要商业、技术、设计、DX多维评估的大型项目可能是值得的，但对于简单的bug fix可能是过度的。

### 6.5怎么观察效果

Plan阶段的效果可以通过以下信号观察：

**正面信号（Plan有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Execute阶段不需要"从头开始" | Plan为Execute提供了有效输入 | Execute阶段是否大量引用plan的task描述 |
| Execute阶段没有出现"这不是要做的" | Plan准确描述了要做什么 | Execute阶段是否需要大幅返工 |
| 每个task可以独立验证 | Plan的任务分解有效 | 每个task完成后是否可以独立测试 |
| Plan中的Global Constraints被遵守 | 全局约束有效 | 检查实现是否遵循plan头部的约束 |
| Plan审查捕获了方向错误 | 审查机制有效 | 审查是否在执行前发现了问题 |
| 并行执行有效（如果使用DAG） | 依赖表达正确 | frontier tickets是否可以同时执行 |

**负面信号（Plan有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Execute阶段重新定义plan中的内容 | Plan不够精确或不被信任 | Execute是否在重复plan已经讨论过的内容 |
| Execute阶段发现plan中的task有歧义 | Plan的"无歧义"性不足 | 实现时是否对plan的理解产生分歧 |
| task之间出现不一致的实现风格 | 缺少Global Constraints | 不同task的代码风格是否不一致 |
| Plan审查被跳过 | 审查不在agent实际遵循的结构中 | 检查Self-Review / GATE是否实际执行 |
| Plan中包含已过时的代码引用 | Plan包含了不该包含的代码 | 检查plan中的code是否与当前代码一致 |
| 所有task完成后才能验证 | 水平切片导致无法增量验证 | 是否有task可以独立demo |

### 6.6怎么改进

Plan阶段的改进可以从以下几个方向入手：

**改进方向一：按风险等级选择审查方式**

建立明确的风险分级标准——什么算"低风险"变更可以自动通过（Self-Review），什么算"高风险"变更需要人工审批（GATE），什么算"需要多维评估"需要多角色审查。ECC用size classifier决定phase运行范围（trivial跳过plan），gstack用scope mode决定审查深度——可以借鉴这些分级机制。

**改进方向二：引入Global Constraints**

在plan头部声明跨任务约束——编码标准、测试要求、命名规则等。这确保所有task遵循相同标准，减少实现时的不一致。Superpowers的实践表明这可以显著减少实现时的不一致。

**改进方向三：垂直切片 + DAG依赖**

将plan的任务分解为垂直切片（每个task穿过所有层，可独立demo），用DAG表达依赖关系。这支持并行执行（frontier tickets）和增量验证（每个task完成后可独立demo）。对wide refactor使用expand-contract模式。

**改进方向四：Plan审查的status line**

每个plan review必须以一行status结束——"NO UNRESOLVED DECISIONS" 或未解决决策列表。这避免用户以为review完成了实际还有未确认的决策。gstack的实践表明这是必要的。

**改进方向五：Plan skill的token优化**

如果plan skill过于庞大，考虑skeleton + on-demand sections模式——always-loaded skeleton包含Step 0和live interview，deep review body移到on-demand sections文件中。gstack的实践表明这可以缩减42-49% 的context消耗而不损失功能。

### 6.7本篇结论

Plan节点的核心使命是**从规格到任务**——将Spec节点产出的"行为契约"分解为可执行的任务序列。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **Plan的粒度应该与执行者匹配**——fresh subagent需要细粒度，完整context window的agent适合粗粒度
2. **Plan的代码包含策略需要权衡**——包含代码消除歧义但增加context消耗和过时风险
3. **Plan审查应该跟风险匹配**——低风险自动、高风险人工、多维评估用多角色
4. **垂直切片优于水平切片**——每个task可独立demo/验证，但wide refactor需要expand-contract
5. **Inline自检优先于subagent审查**——文档审查场景下inline性价比更高
6. **高价值功能应该默认开启**——让用户opt-out而非opt-in
7. **Plan审查需要有status line**——告诉用户是否有未解决的决策

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用Plan节点时参考。后续章节将逐个节点展开类似的讨论。

---

---

点击下方"**阅读原文**"进入我的演示网站。
