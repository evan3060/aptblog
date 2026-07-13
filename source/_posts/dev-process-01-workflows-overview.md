---
title: AI 研发流程深度解析（一）：热门研发流程概览
description: 对当前主流 AI 辅助研发流程项目做全景扫描，理解每个项目解决什么问题、怎么解决、在流程设计上有什么独特考虑，为后续逐个节点的深度讨论建立参照系。
tags:
  - 研发流程
  - 方法论
  - 概览
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-11
> **目标：** 对当前主流 AI 辅助研发流程项目做一次全景扫描，理解每个项目解决什么问题、怎么解决、在流程设计上有什么独特考虑，为后续逐个节点的深度讨论建立参照系。

---

## 1. 为什么需要流程

AI 辅助编码正在经历一次范式转移。一个人借助 AI agent 可以达到过去一个团队的产出——gstack 的作者 Garry Tan 声称自己的代码产出速度是 2013 年的 810 倍。ECC 项目号称覆盖 12+ 语言生态系统、跨 7+ AI harness 平台。Andrej Karpathy 说自己"基本上没写过一行代码"。

但产量不是唯一的问题。当 agent 能以每分钟数百行的速度生成代码时，一个新的问题浮现了：**没有流程的 agent 是混乱的放大器。** gstack 的 README 里有一句话说得很到位——"没有流程，十个 agent 是十个混乱源。有了流程，每个 agent 知道该做什么、什么时候停。"

这正是本系列要讨论的核心问题：**一个好的 AI 辅助研发流程应该是什么样子的？**

在回答这个问题之前，我们需要先理解当前有哪些实践、它们各自在解决什么问题、在流程设计上有什么考虑。本文对 5 个热门开源项目做概览级别的扫描。

---

## 2. 项目概览

### 2.1 OpenSpec——Spec 即共识契约

**一句话定位：** 在人与 AI 之间建立"先同意再构建"的共识层。

OpenSpec 是一个 CLI 工具（npm 包）加 Markdown 约定的规范管理系统。它的核心抽象是 **Change**——每个变更是一个文件夹，包含 proposal（为什么改）、specs（改什么行为）、design（怎么改）、tasks（改哪些）。Specs 使用结构化的行为契约格式：`### Requirement:` + `#### Scenario:` + RFC 2119 关键词（SHALL/MUST/SHOULD）。

**核心机制：**
- **Delta spec**：变更只描述 ADDED / MODIFIED / REMOVED，不重写整个 spec。天然适配已有项目——不需要先文档化整个系统再修改。
- **Source of truth**：`specs/` 目录持续演进，archive 时 delta 合并回主 spec，形成完整审计链。
- **Artifact Graph**：proposal → specs → design → tasks → implement，依赖图是"enablers, not gates"——表示"可以做什么"而非"必须做什么"。
- **CLI 工具化**：17 个命令，Agent Contract 提供 JSON 机器可读接口，29+ 平台适配器自动生成 slash commands。

**能力边界：** 擅长变更规格化、spec 演进追踪、brownfield 适配、变更可审计。不涉及开发执行流程（TDD、code review、subagent 等）。

---

### 2.2 Superpowers——Skill 即行为塑造

**一句话定位：** 用纯 Markdown 驱动 AI agent 可靠执行。

Superpowers 是一组 Skill 集合（14 个 skill），每个 skill 是一个 `SKILL.md` 文件加支撑文件。它的设计哲学是"Skills are not prose — they are code that shapes agent behavior"——skill 不是参考文档，是可执行的指令。

**核心机制：**
- **TDD Iron Law**：不写失败测试不写代码，违反则删除重来。用大量篇幅列举 rationalization 表来防止绕过。
- **Subagent 驱动开发（SDD）**：每个 task 派发独立 subagent，上下文隔离。单 reviewer 两个 verdict（spec 合规 + 代码质量）。
- **Brainstorming 苏格拉底式对话**：一次一个问题，逐节确认。HARD-GATE：设计未批准前不写代码。
- **Plan 极致细化**：每个 step 是 2-5 分钟操作，包含精确文件路径、完整代码、验证命令。
- **Inline Self-Review**：v5 替代 subagent review loop（25min → 30s，质量相当）。
- **File Handoffs + Progress Ledger**：artifact 以文件传递不污染 context；进度持久化抗 context compaction。

**演进教训：** 从 v4 的两阶段 subagent review（25 分钟），到 v5 的 inline self-review（30 秒），再到 v6 的单 reviewer 两个 verdict。核心趋势是**从复杂到简单**——每一步简化都有测试数据支撑。

**能力边界：** 擅长 TDD 执行、subagent 驱动、code review、调试方法论、行为塑造。不擅长 spec 演进追踪、brownfield 增量规格化、变更可审计。

---

### 2.3 ECC——Agent 素材大全

**一句话定位：** Agent Harness 操作系统——跨平台 agent 素材大全。

ECC (Everything Claude Code) 是一个庞大的素材库：261+ skills、47+ agents、79+ commands、hooks、rules，覆盖 12+ 语言生态系统，跨 7+ AI harness 平台（Claude Code、Codex、Cursor、OpenCode、Gemini、Zed、Copilot）。它不定义固定流程，而是提供工具箱让用户自行编排。

**核心机制：**
- **Skills 分类体系**：每个 skill 有 `SKILL.md` + frontmatter，包含 When to Use / How it Works / Examples。
- **Hooks 自动化**：PreToolUse / PostToolUse / UserPromptSubmit / Stop / PreCompact / Notification，6 种 hook 类型。
- **Continuous Learning v2**：Instinct-based learning with confidence scoring，从 session 中自动提取模式。
- **Selective Install**：manifest 驱动的安装管线，`npx ecc consult "topic"` 返回匹配组件。
- **Orchestration**：`orch-*` orchestrator family，harness audit scoring。

**能力边界：** 擅长素材覆盖广、跨平台、安装灵活、社区生态。不定义统一流程约束，没有 spec 管理，没有变更追踪。用户需要自己编排。

---

### 2.4 mattpocock-skills——小而可组合的工程师技能

**一句话定位：** 工程师日常技能——小、可组合、可改造。"Not vibe coding — real engineering."

Matt Pocock 的 skill 集合约 20 个 skill，分为 engineering 和 productivity 两类。与 GSD、BMAD、Spec-Kit 等试图"拥有流程"的项目不同，这些 skill 明确不拥有流程——用户自己编排。

**核心机制：**
- **User-invoked vs Model-invoked**：明确区分用户手动调用（`disable-model-invocation: true`）和模型自动触发的 skill。
- **Grilling 式需求澄清**：`/grill-me` 和 `/grill-with-docs` 对计划进行无情审问，逐个决策树分支解决。
- **Shared Language**：`CONTEXT.md` 建立项目领域语言（ubiquitous language），减少 agent 冗余表达。
- **Two-axis code review**：Standards（是否遵循编码标准）+ Spec（是否忠实实现需求），并行 sub-agents 独立运行。
- **Wayfinder**：超大工作规划为 investigation tickets，逐个解决，"fog of war" 渐进式探索。
- **Tracer-bullet tickets**：`/to-tickets` 把计划拆为带 blocking 边的 ticket，每个 ticket 是一个可独立交付的垂直切片。

**能力边界：** 擅长小巧可组合、工程基础扎实、领域语言建模。没有统一流程框架、spec 演进追踪、自动化工具、多平台适配。

---

### 2.5 gstack——虚拟工程团队

**一句话定位：** 把 Claude Code 变成一个完整的工程团队。Think → Plan → Build → Review → Test → Ship → Reflect。

gstack 是 Y Combinator 总裁 Garry Tan 的个人项目，包含 23+ specialist skills 和 8 个 power tools。它的核心是 sprint 结构——每个 skill 的产出喂给下一个，从 office-hours 到 ship 形成完整链路。

**核心机制：**
- **Sprint 链式传递**：`/office-hours`（产品审问）→ `/plan-ceo-review`（战略挑战）→ `/plan-eng-review`（架构锁定）→ `/review`（代码审查）→ `/qa`（浏览器测试）→ `/ship`（发布）。
- **持久浏览器**：长驻 Chromium 守护进程，~100ms 命令延迟，cookie 持久化。
- **Boil the Ocean**：AI 时代完整实现的边际成本接近零，做完整的事。
- **User Sovereignty**：AI 推荐，用户决策。这条规则覆盖所有其他规则。
- **跨模型审查**：`/codex` 获取 OpenAI Codex CLI 的独立审查，两个不同 AI 看同一份 diff。
- **Continuous Checkpoint**：可选自动 WIP commit + context restore。
- **并行 sprint**：通过 Conductor 运行 10-15 个并行 sprint。

**能力边界：** 擅长全 sprint 覆盖、浏览器 QA、跨模型审查、设计探索、并行 sprint。重度依赖浏览器工具（Bun 编译二进制），偏 Web 产品开发。没有 spec 演进追踪、brownfield 规格化。

---

## 3. 各项目在流程设计上的考虑

> 这一节是本文的重点。我们不只看每个项目"有什么功能"，更要理解它们在流程设计上**各自考虑了什么、做了什么取舍**。只有理解了这些考虑，后续讨论"一个好的流程应该是什么样子"时，才能做到有取有舍、有理有据。

### 3.1 OpenSpec：如何让变更可追溯、可共识

OpenSpec 的流程设计考虑集中在**变更治理**上。

**考虑一：先达成共识，再构建。** OpenSpec 的整个流程围绕"在写代码之前把变更想清楚"展开。proposal 写意图和范围，specs 写行为变更，design 写技术方案，tasks 写执行清单。每个 artifact 有明确的角色——specs 说"做什么"，design 说"怎么做"，两者分离。这个考虑的出发点是：AI agent 跳过"想清楚"直接写代码是最大的浪费来源。

**考虑二：描述变更，而非整个系统。** Delta 机制（ADDED/MODIFIED/REMOVED）是 OpenSpec 的核心设计。它的考虑是：现实世界中绝大多数开发是 brownfield——在已有系统上修改。如果要求先文档化整个系统再修改，成本不可接受。Delta 让你只文档化要改的部分，同时通过 source of truth 保持"系统当前怎么工作"的完整记录。

**考虑三：依赖是使能，不是门禁。** Artifact Graph 的设计哲学是"enablers, not gates"——你可以按 proposal → specs → design → tasks 的顺序走，也可以在任意阶段修改任意 artifact。没有瀑布式锁定。这个考虑的出发点是：真实工作不 fit 进线性盒子，强制顺序反而让人绕过流程。

**考虑四：不阻断，只暴露。** verify 命令不阻断 archive，只暴露问题。这个考虑是：不同变更需要的审查深度不同——简单修改 20 秒扫一眼，关键修改仔细审。强制 gate 会让简单变更的流程过重，导致用户整体放弃流程。

### 3.2 Superpowers：如何让 agent 可靠执行

Superpowers 的流程设计考虑集中在**行为塑造**上。

**考虑一：Skill 不是文档，是代码。** Superpowers 把每个 skill 当作"可执行的指令"而非"参考文档"。这意味着 skill 的措辞、结构、措辞的精确性都直接影响 agent 行为。它甚至用 TDD 方法论来写 skill——先写 baseline 测试（测 agent 在压力下是否会绕过规则），再写 skill 正文，再堵漏洞。这个考虑的出发点是：agent 会走捷径，模糊的指导等于没有指导。

**考虑二：不同类型的失败需要不同形式的指导。** "Match the Form to the Failure"是 Superpowers 的核心设计原则。禁止类规则用"禁止 + 合理化对照表"（rationalization 表），正面指导用"食谱式步骤"，结构性约束用"模板"，条件性指导用"分支判断"。这个考虑的出发点是：一种形式不能覆盖所有失败模式。

**考虑三：从复杂到简化的演进。** Superpowers 的演进历史本身就是流程设计的教材。v4 的两阶段 subagent review 花了 25 分钟但没提升质量，被 v5 的 30 秒 inline self-review 替代。v4 的 brainstorming 有 6 个正式阶段 + checklist，v5 回到自然对话。这个考虑的出发点是：流程复杂度不是质量保证，过重的环节会被证明无效然后被砍掉。

**考虑四：Context 是稀缺资源。** File handoffs（artifact 以文件传递不污染 context）、model selection（简单 task 用便宜模型）、progress ledger（持久化进度抗 context compaction）——这些都来自同一个考虑：agent 的 context window 是有限的，必须精打细算。

### 3.3 ECC：素材覆盖 vs 流程约束

ECC 的流程设计考虑与前面两个项目根本不同——**它选择不定义流程**。

**考虑一：提供素材，让用户自行编排。** ECC 有 261+ skills 覆盖几乎所有开发场景，但它不规定"先用哪个、再用哪个"。这个考虑的出发点是：不同项目、不同团队、不同场景需要的流程不同，预设流程反而限制了适用性。

**考虑二：跨平台兼容优先。** ECC 支持 7+ AI harness 平台。这个考虑意味着它不能依赖任何特定平台的特性——hook 机制、skill 触发方式、agent 定义格式都需要适配层。

**考虑三：选择性安装。** manifest 驱动的安装管线让用户只安装需要的组件。这个考虑的出发点是：261+ skills 全部加载会撑爆 context window，用户需要按需选择。

**代价：** 没有流程约束意味着 ECC 无法保证执行质量。用户需要自己对"什么时候用 TDD、什么时候做 review、什么时候 verify"做出决策。这适合有经验的用户，但对新手来说门槛较高。

### 3.4 mattpocock-skills：用户控制 vs 流程拥有

Matt Pocock 的流程设计考虑围绕**一个核心立场：不拥有流程**。

**考虑一：小而可组合。** 每个 skill 解决一个问题，约 20 个 skill 可以自由组合。README 明确对比了 GSD、BMAD、Spec-Kit 等"拥有流程"的项目——"它们拿走了你的控制权，让流程中的 bug 难以修复"。这个考虑的出发点是：流程应该服务于用户，而非用户服务于流程。

**考虑二：先澄清需求，再动手。** Grilling 式审问（`/grill-me`、`/grill-with-docs`）是 mattpocock 最核心的实践。一次一个问题，逐个决策树分支解决，每个问题附推荐答案。这个考虑的出发点是引用 The Pragmatic Programmer 的话："没有人确切知道自己想要什么。"

**考虑三：建立共享语言。** `CONTEXT.md` 建立项目的 ubiquitous language。这个考虑来自 DDD——agent 被丢进项目后需要"猜术语"，用 20 个词表达 1 个概念。共享语言让变量名、函数名、文件名一致，agent 花更少 token 思考，代码库更易导航。

**考虑四：两轴分离的代码审查。** Standards（编码标准）和 Spec（需求忠实度）由两个并行 sub-agent 独立审查。这个考虑的出发点是：一个变更可以标准合格但需求偏离，也可以需求忠实但标准违规——合并审查会让一个轴掩盖另一个。

### 3.5 gstack：Sprint 全流程 vs 工具重度依赖

gstack 的流程设计考虑最接近"完整工程团队"的模拟。

**考虑一：每个 skill 的产出喂给下一个。** gstack 的 sprint 结构不是松散的 skill 集合，而是链式传递——office-hours 写设计文档，plan-ceo-review 读它，plan-eng-review 读 CEO 的输出，review 读 plan，qa 读 review 结果。这个考虑的出发点是：没有衔接的 skill 是孤岛，有衔接的 skill 形成流水线。

**考虑二：流程让并行可管理。** gstack 支持 10-15 个并行 sprint。Garry Tan 的原话："没有流程，十个 agent 是十个混乱源。有了流程——think, plan, build, review, test, ship——每个 agent 知道该做什么和什么时候停。"这个考虑的出发点是：并行的前提是每个单元有明确的开始和结束。

**考虑三：做完整的事。** "Boil the Ocean"原则认为 AI 时代完整实现的边际成本接近零。过去跳过的"最后 10% 完整性"现在成本是几秒钟。这个考虑影响了 gstack 的流程设计——`/ship` 会自动跑覆盖率审计，`/qa` 的每个 bug fix 自动生成回归测试，`/document-release` 自动更新所有文档。

**考虑四：AI 推荐，用户决策。** User Sovereignty 是覆盖所有其他规则的最高原则。即使两个不同 AI 模型都同意某件事，如果用户说"不"，那就是"不"。这个考虑的出发点是：用户有模型没有的上下文——领域知识、业务关系、战略时机、个人品味。

**代价：** gstack 重度依赖浏览器工具（Bun 编译二进制 + Chromium 守护进程），技术形态较重。它偏 Web 产品开发，spec 管理和 brownfield 规格化不是它的关注点。

---

## 4. 横向对比

### 4.1 流程覆盖

| 节点 | OpenSpec | Superpowers | ECC | mattpocock | gstack |
|------|---------|------------|-----|-----------|--------|
| 需求探索 | ✅ explore | ✅ brainstorming | ⚠️ 素材 | ✅ grill-with-docs | ✅ office-hours |
| 规格定义 | ✅ propose+specs | ⚠️ 设计文档 | ⚠️ 素材 | ✅ to-spec | ✅ /spec |
| 任务分解 | ✅ tasks | ✅ writing-plans | ⚠️ /plan | ✅ to-tickets | ✅ plan-*-review |
| 执行实现 | ✅ apply | ✅ SDD+TDD | ⚠️ /tdd | ✅ implement | ⚠️ (隐含) |
| 代码审查 | ✅ reviewing | ✅ code-review | ⚠️ /code-review | ✅ code-review | ✅ /review |
| 测试验证 | ✅ verify | ✅ verification | ⚠️ verification-loop | ⚠️ (隐含) | ✅ /qa |
| 归档发布 | ✅ archive | ✅ finishing | ❌ | ⚠️ handoff | ✅ /ship |

（✅ = 核心能力，⚠️ = 部分覆盖/素材级，❌ = 不涉及）

### 4.2 设计哲学光谱

```
流程约束强 ◄──────────────────────────────────────► 流程约束弱

Superpowers    OpenSpec     gstack    mattpocock    ECC
(Iron Law)    (Delta+SoT)  (Sprint)  (可组合)    (素材库)
```

- **Superpowers**：最强约束——TDD Iron Law、HARD-GATE、rationalization 表
- **OpenSpec**：中等约束——结构化格式、delta 机制、但不阻断
- **gstack**：中等约束——sprint 链式传递、质量门控
- **mattpocock**：弱约束——skill 可组合、用户自行编排
- **ECC**：无约束——纯素材库、用户全自行决定

### 4.3 技术形态光谱

```
纯 Markdown ◄──────────────────────────────────────► 重度工具依赖

mattpocock    Superpowers    OpenSpec      gstack
(纯 MD)      (纯 MD+hooks)  (CLI+npm)   (Bun二进制
                                          +浏览器)
```

### 4.4 复杂度光谱

```
流程步骤少 ◄──────────────────────────────────────► 流程步骤多

OpenSpec      mattpocock     Superpowers     gstack
(~5 步)      (~5 步)        (~15 步)       (~8 步)
```

---

## 5. 关键观察

从以上概览和对比中，浮现出几个值得在后续笔记中深入讨论的观察：

**观察一：流程覆盖的广度与深度存在张力。** Superpowers 在执行阶段（TDD + review + verification）做得很深，但不覆盖 spec 管理。OpenSpec 在 spec 管理上做得很深，但不覆盖执行。gstack 试图覆盖全流程但每个节点的深度不如前两者。ECC 覆盖最广但深度最浅。没有一个项目在所有节点上都做到了足够的深度。

**观察二：约束方式与技术形态强相关。** 纯 Markdown 的项目（Superpowers、mattpocock）依赖 skill 措辞和行为塑造来约束 agent 行为。有 CLI 工具的项目（OpenSpec）可以用机器可读接口和 schema 校验。有重度工具的项目（gstack）可以用脚本和守护进程强制执行。约束越强，技术依赖越重——这是一个根本性的张力。

**观察三：每个项目都在"流程拥有"与"用户控制"之间做了明确选择。** gstack 和 OpenSpec 选择"拥有流程"——定义完整的步骤链路。mattpocock 明确选择"不拥有流程"——用户自行编排。ECC 选择"提供素材不定义流程"。Superpowers 在中间——定义了执行流程但不覆盖全链路。这个选择直接影响项目的适用场景。

**观察四：所有成熟项目都在向简化方向演进。** Superpowers 从 v4 的 25 分钟 subagent review 简化到 v5 的 30 秒 inline self-review。OpenSpec 从 phase-locked 演进到 fluid actions。这个共同趋势暗示：**流程的自然倾向是膨胀，需要主动简化。**

---

## 6. 系列路线图

本文是系列的第一篇，建立了全景参照系。后续笔记的计划：

| 篇号 | 主题 | 做什么 |
|------|------|--------|
| 2 | Superpowers 深度拆解 | Skill 即行为塑造——每个设计决策的"为什么"和演进教训 |
| 3 | OpenSpec 深度拆解 | Spec 即共识契约——核心抽象的设计逻辑和工具化程度 |
| 4 | ECC 深度拆解 | Agent 素材大全——跨平台素材体系与选择性安装机制 |
| 5 | mattpocock-skills 深度拆解 | 小而可组合——工程基础技能与需求澄清方法论 |
| 6 | gstack 深度拆解 | 虚拟工程团队——Sprint 链式传递与全流程覆盖 |
| 7 | 流程全景图 | 把所有项目放在一张图上，定义通用节点 |
| 8-13 | 逐个节点讨论 | Explore / Spec / Plan / Execute / Review & Verify / Archive |
| 14 | 综合总结 | 好的研发流程整体应该是怎样的 |
| 15 | 衡量与迭代 | 如何判断流程是否有效，如何持续改进 |

本篇的贡献是建立了参照系和识别了关键张力。后续笔记将在这些张力的框架下，逐个节点深入讨论"什么可能是好的实践方向"。
