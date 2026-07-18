---
title: AI研发流程深度解析（一）：热门研发流程概览
description: 对当前主流AI辅助研发流程项目做全景扫描，理解每个项目解决什么问题、怎么解决、在流程设计上有什么独特考虑，为后续逐个节点的深度讨论建立参照系。
tags:
  - 研发流程
  - 方法论
  - 概览
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-11
> **目标：** 对当前主流AI辅助研发流程项目做一次全景扫描，理解每个项目解决什么问题、怎么解决、在流程设计上有什么独特考虑，为后续逐个节点的深度讨论建立参照系。

---

![AI研发流程深度解析（一）：热门研发流程概览](/images/dev-process/dev-process-01-workflows-overview.png)

## 1. 为什么需要流程

AI辅助编码正在经历一次范式转移。一个人借助AI agent可以达到过去一个团队的产出——gstack的作者Garry Tan声称自己的代码产出速度是2013年的810倍。ECC项目号称覆盖12+ 语言生态系统、跨7+ AI harness平台。Andrej Karpathy说自己"基本上没写过一行代码"。

但产量不是唯一的问题。当agent能以每分钟数百行的速度生成代码时，一个新的问题浮现了：**没有流程的agent是混乱的放大器。** gstack的README里有一句话说得很到位——"没有流程，十个agent是十个混乱源。有了流程，每个agent知道该做什么、什么时候停。"

这正是本系列要讨论的核心问题：**一个好的AI辅助研发流程应该是什么样子的？**

在回答这个问题之前，我们需要先理解当前有哪些实践、它们各自在解决什么问题、在流程设计上有什么考虑。本文对5个热门开源项目做概览级别的扫描。

---

## 2. 项目概览

### 2.1 OpenSpec——Spec即共识契约

**一句话定位：** 在人与AI之间建立"先同意再构建"的共识层。

OpenSpec是一个CLI工具（npm包）加Markdown约定的规范管理系统。它的核心抽象是 **Change**——每个变更是一个文件夹，包含proposal（为什么改）、specs（改什么行为）、design（怎么改）、tasks（改哪些）。Specs使用结构化的行为契约格式：`### Requirement:` + `#### Scenario:` + RFC 2119关键词（SHALL/MUST/SHOULD）。

**核心机制：**
- **Delta spec**：变更只描述ADDED / MODIFIED / REMOVED，不重写整个spec。天然适配已有项目——不需要先文档化整个系统再修改。
- **Source of truth**：`specs/` 目录持续演进，archive时delta合并回主spec，形成完整审计链。
- **Artifact Graph**：proposal → specs → design → tasks → implement，依赖图是"enablers, not gates"——表示"可以做什么"而非"必须做什么"。
- **CLI工具化**：17个命令，Agent Contract提供JSON机器可读接口，29+ 平台适配器自动生成slash commands。

**能力边界：** 擅长变更规格化、spec演进追踪、brownfield适配、变更可审计。不涉及开发执行流程（TDD、code review、subagent等）。

---

### 2.2 Superpowers——Skill即行为塑造

**一句话定位：** 用纯Markdown驱动AI agent可靠执行。

Superpowers是一组Skill集合（14个skill），每个skill是一个 `SKILL.md` 文件加支撑文件。它的设计哲学是"Skills are not prose — they are code that shapes agent behavior"——skill不是参考文档，是可执行的指令。

**核心机制：**
- **TDD Iron Law**：不写失败测试不写代码，违反则删除重来。用大量篇幅列举rationalization表来防止绕过。
- **Subagent驱动开发（SDD）**：每个task派发独立subagent，上下文隔离。单reviewer两个verdict（spec合规 + 代码质量）。
- **Brainstorming苏格拉底式对话**：一次一个问题，逐节确认。HARD-GATE：设计未批准前不写代码。
- **Plan极致细化**：每个step是2-5分钟操作，包含精确文件路径、完整代码、验证命令。
- **Inline Self-Review**：v5替代subagent review loop（25min → 30s，质量相当）。
- **File Handoffs + Progress Ledger**：artifact以文件传递不污染context；进度持久化抗context compaction。

**演进教训：** 从v4的两阶段subagent review（25分钟），到v5的inline self-review（30秒），再到v6的单reviewer两个verdict。核心趋势是**从复杂到简单**——每一步简化都有测试数据支撑。

**能力边界：** 擅长TDD执行、subagent驱动、code review、调试方法论、行为塑造。不擅长spec演进追踪、brownfield增量规格化、变更可审计。

---

### 2.3 ECC——Agent素材大全

**一句话定位：** Agent Harness操作系统——跨平台agent素材大全。

ECC (Everything Claude Code) 是一个庞大的素材库：261+ skills、47+ agents、79+ commands、hooks、rules，覆盖12+ 语言生态系统，跨7+ AI harness平台（Claude Code、Codex、Cursor、OpenCode、Gemini、Zed、Copilot）。它不定义固定流程，而是提供工具箱让用户自行编排。

**核心机制：**
- **Skills分类体系**：每个skill有 `SKILL.md` + frontmatter，包含When to Use / How it Works / Examples。
- **Hooks自动化**：PreToolUse / PostToolUse / UserPromptSubmit / Stop / PreCompact / Notification，6种hook类型。
- **Continuous Learning v2**：Instinct-based learning with confidence scoring，从session中自动提取模式。
- **Selective Install**：manifest驱动的安装管线，`npx ecc consult "topic"` 返回匹配组件。
- **Orchestration**：`orch-*` orchestrator family，harness audit scoring。

**能力边界：** 擅长素材覆盖广、跨平台、安装灵活、社区生态。不定义统一流程约束，没有spec管理，没有变更追踪。用户需要自己编排。

---

### 2.4 mattpocock-skills——小而可组合的工程师技能

**一句话定位：** 工程师日常技能——小、可组合、可改造。"Not vibe coding — real engineering."

Matt Pocock的skill集合约20个skill，分为engineering和productivity两类。与GSD、BMAD、Spec-Kit等试图"拥有流程"的项目不同，这些skill明确不拥有流程——用户自己编排。

**核心机制：**
- **User-invoked vs Model-invoked**：明确区分用户手动调用（`disable-model-invocation: true`）和模型自动触发的skill。
- **Grilling式需求澄清**：`/grill-me` 和 `/grill-with-docs` 对计划进行无情审问，逐个决策树分支解决。
- **Shared Language**：`CONTEXT.md` 建立项目领域语言（ubiquitous language），减少agent冗余表达。
- **Two-axis code review**：Standards（是否遵循编码标准）+ Spec（是否忠实实现需求），并行sub-agents独立运行。
- **Wayfinder**：超大工作规划为investigation tickets，逐个解决，"fog of war" 渐进式探索。
- **Tracer-bullet tickets**：`/to-tickets` 把计划拆为带blocking边的ticket，每个ticket是一个可独立交付的垂直切片。

**能力边界：** 擅长小巧可组合、工程基础扎实、领域语言建模。没有统一流程框架、spec演进追踪、自动化工具、多平台适配。

---

### 2.5 gstack——虚拟工程团队

**一句话定位：** 把Claude Code变成一个完整的工程团队。Think → Plan → Build → Review → Test → Ship → Reflect。

gstack是Y Combinator总裁Garry Tan的个人项目，包含23+ specialist skills和8个power tools。它的核心是sprint结构——每个skill的产出喂给下一个，从office-hours到ship形成完整链路。

**核心机制：**
- **Sprint链式传递**：`/office-hours`（产品审问）→ `/plan-ceo-review`（战略挑战）→ `/plan-eng-review`（架构锁定）→ `/review`（代码审查）→ `/qa`（浏览器测试）→ `/ship`（发布）。
- **持久浏览器**：长驻Chromium守护进程，~100ms命令延迟，cookie持久化。
- **Boil the Ocean**：AI时代完整实现的边际成本接近零，做完整的事。
- **User Sovereignty**：AI推荐，用户决策。这条规则覆盖所有其他规则。
- **跨模型审查**：`/codex` 获取OpenAI Codex CLI的独立审查，两个不同AI看同一份diff。
- **Continuous Checkpoint**：可选自动WIP commit + context restore。
- **并行sprint**：通过Conductor运行10-15个并行sprint。

**能力边界：** 擅长全sprint覆盖、浏览器QA、跨模型审查、设计探索、并行sprint。重度依赖浏览器工具（Bun编译二进制），偏Web产品开发。没有spec演进追踪、brownfield规格化。

---

## 3. 各项目在流程设计上的考虑

> 这一节是本文的重点。我们不只看每个项目"有什么功能"，更要理解它们在流程设计上**各自考虑了什么、做了什么取舍**。只有理解了这些考虑，后续讨论"一个好的流程应该是什么样子"时，才能做到有取有舍、有理有据。

### 3.1 OpenSpec：如何让变更可追溯、可共识

OpenSpec的流程设计考虑集中在**变更治理**上。

**考虑一：先达成共识，再构建。** OpenSpec的整个流程围绕"在写代码之前把变更想清楚"展开。proposal写意图和范围，specs写行为变更，design写技术方案，tasks写执行清单。每个artifact有明确的角色——specs说"做什么"，design说"怎么做"，两者分离。这个考虑的出发点是：AI agent跳过"想清楚"直接写代码是最大的浪费来源。

**考虑二：描述变更，而非整个系统。** Delta机制（ADDED/MODIFIED/REMOVED）是OpenSpec的核心设计。它的考虑是：现实世界中绝大多数开发是brownfield——在已有系统上修改。如果要求先文档化整个系统再修改，成本不可接受。Delta让你只文档化要改的部分，同时通过source of truth保持"系统当前怎么工作"的完整记录。

**考虑三：依赖是使能，不是门禁。** Artifact Graph的设计哲学是"enablers, not gates"——你可以按proposal → specs → design → tasks的顺序走，也可以在任意阶段修改任意artifact。没有瀑布式锁定。这个考虑的出发点是：真实工作不fit进线性盒子，强制顺序反而让人绕过流程。

**考虑四：不阻断，只暴露。** verify命令不阻断archive，只暴露问题。这个考虑是：不同变更需要的审查深度不同——简单修改20秒扫一眼，关键修改仔细审。强制gate会让简单变更的流程过重，导致用户整体放弃流程。

### 3.2 Superpowers：如何让agent可靠执行

Superpowers的流程设计考虑集中在**行为塑造**上。

**考虑一：Skill不是文档，是代码。** Superpowers把每个skill当作"可执行的指令"而非"参考文档"。这意味着skill的措辞、结构、措辞的精确性都直接影响agent行为。它甚至用TDD方法论来写skill——先写baseline测试（测agent在压力下是否会绕过规则），再写skill正文，再堵漏洞。这个考虑的出发点是：agent会走捷径，模糊的指导等于没有指导。

**考虑二：不同类型的失败需要不同形式的指导。** "Match the Form to the Failure"是Superpowers的核心设计原则。禁止类规则用"禁止 + 合理化对照表"（rationalization表），正面指导用"食谱式步骤"，结构性约束用"模板"，条件性指导用"分支判断"。这个考虑的出发点是：一种形式不能覆盖所有失败模式。

**考虑三：从复杂到简化的演进。** Superpowers的演进历史本身就是流程设计的教材。v4的两阶段subagent review花了25分钟但没提升质量，被v5的30秒inline self-review替代。v4的brainstorming有6个正式阶段 + checklist，v5回到自然对话。这个考虑的出发点是：流程复杂度不是质量保证，过重的环节会被证明无效然后被砍掉。

**考虑四：Context是稀缺资源。** File handoffs（artifact以文件传递不污染context）、model selection（简单task用便宜模型）、progress ledger（持久化进度抗context compaction）——这些都来自同一个考虑：agent的context window是有限的，必须精打细算。

### 3.3 ECC：素材覆盖vs流程约束

ECC的流程设计考虑与前面两个项目根本不同——**它选择不定义流程**。

**考虑一：提供素材，让用户自行编排。** ECC有261+ skills覆盖几乎所有开发场景，但它不规定"先用哪个、再用哪个"。这个考虑的出发点是：不同项目、不同团队、不同场景需要的流程不同，预设流程反而限制了适用性。

**考虑二：跨平台兼容优先。** ECC支持7+ AI harness平台。这个考虑意味着它不能依赖任何特定平台的特性——hook机制、skill触发方式、agent定义格式都需要适配层。

**考虑三：选择性安装。** manifest驱动的安装管线让用户只安装需要的组件。这个考虑的出发点是：261+ skills全部加载会撑爆context window，用户需要按需选择。

**代价：** 没有流程约束意味着ECC无法保证执行质量。用户需要自己对"什么时候用TDD、什么时候做review、什么时候verify"做出决策。这适合有经验的用户，但对新手来说门槛较高。

### 3.4 mattpocock-skills：用户控制vs流程拥有

Matt Pocock的流程设计考虑围绕**一个核心立场：不拥有流程**。

**考虑一：小而可组合。** 每个skill解决一个问题，约20个skill可以自由组合。README明确对比了GSD、BMAD、Spec-Kit等"拥有流程"的项目——"它们拿走了你的控制权，让流程中的bug难以修复"。这个考虑的出发点是：流程应该服务于用户，而非用户服务于流程。

**考虑二：先澄清需求，再动手。** Grilling式审问（`/grill-me`、`/grill-with-docs`）是mattpocock最核心的实践。一次一个问题，逐个决策树分支解决，每个问题附推荐答案。这个考虑的出发点是引用The Pragmatic Programmer的话："没有人确切知道自己想要什么。"

**考虑三：建立共享语言。** `CONTEXT.md` 建立项目的ubiquitous language。这个考虑来自DDD——agent被丢进项目后需要"猜术语"，用20个词表达1个概念。共享语言让变量名、函数名、文件名一致，agent花更少token思考，代码库更易导航。

**考虑四：两轴分离的代码审查。** Standards（编码标准）和Spec（需求忠实度）由两个并行sub-agent独立审查。这个考虑的出发点是：一个变更可以标准合格但需求偏离，也可以需求忠实但标准违规——合并审查会让一个轴掩盖另一个。

### 3.5 gstack：Sprint全流程vs工具重度依赖

gstack的流程设计考虑最接近"完整工程团队"的模拟。

**考虑一：每个skill的产出喂给下一个。** gstack的sprint结构不是松散的skill集合，而是链式传递——office-hours写设计文档，plan-ceo-review读它，plan-eng-review读CEO的输出，review读plan，qa读review结果。这个考虑的出发点是：没有衔接的skill是孤岛，有衔接的skill形成流水线。

**考虑二：流程让并行可管理。** gstack支持10-15个并行sprint。Garry Tan的原话："没有流程，十个agent是十个混乱源。有了流程——think, plan, build, review, test, ship——每个agent知道该做什么和什么时候停。"这个考虑的出发点是：并行的前提是每个单元有明确的开始和结束。

**考虑三：做完整的事。** "Boil the Ocean"原则认为AI时代完整实现的边际成本接近零。过去跳过的"最后10% 完整性"现在成本是几秒钟。这个考虑影响了gstack的流程设计——`/ship` 会自动跑覆盖率审计，`/qa` 的每个bug fix自动生成回归测试，`/document-release` 自动更新所有文档。

**考虑四：AI推荐，用户决策。** User Sovereignty是覆盖所有其他规则的最高原则。即使两个不同AI模型都同意某件事，如果用户说"不"，那就是"不"。这个考虑的出发点是：用户有模型没有的上下文——领域知识、业务关系、战略时机、个人品味。

**代价：** gstack重度依赖浏览器工具（Bun编译二进制 + Chromium守护进程），技术形态较重。它偏Web产品开发，spec管理和brownfield规格化不是它的关注点。

---

## 4. 横向对比

### 4.1流程覆盖

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

### 4.2设计哲学光谱

```
流程约束强 ◄──────────────────────────────────────► 流程约束弱

Superpowers    OpenSpec     gstack    mattpocock    ECC
(Iron Law)    (Delta+SoT)  (Sprint)  (可组合)    (素材库)
```

- **Superpowers**：最强约束——TDD Iron Law、HARD-GATE、rationalization表
- **OpenSpec**：中等约束——结构化格式、delta机制、但不阻断
- **gstack**：中等约束——sprint链式传递、质量门控
- **mattpocock**：弱约束——skill可组合、用户自行编排
- **ECC**：无约束——纯素材库、用户全自行决定

### 4.3技术形态光谱

```
纯 Markdown ◄──────────────────────────────────────► 重度工具依赖

mattpocock    Superpowers    OpenSpec      gstack
(纯 MD)      (纯 MD+hooks)  (CLI+npm)   (Bun二进制
                                          +浏览器)
```

### 4.4复杂度光谱

```
流程步骤少 ◄──────────────────────────────────────► 流程步骤多

OpenSpec      mattpocock     Superpowers     gstack
(~5 步)      (~5 步)        (~15 步)       (~8 步)
```

---

## 5. 关键观察

从以上概览和对比中，浮现出几个值得在后续笔记中深入讨论的观察：

**观察一：流程覆盖的广度与深度存在张力。** Superpowers在执行阶段（TDD + review + verification）做得很深，但不覆盖spec管理。OpenSpec在spec管理上做得很深，但不覆盖执行。gstack试图覆盖全流程但每个节点的深度不如前两者。ECC覆盖最广但深度最浅。没有一个项目在所有节点上都做到了足够的深度。

**观察二：约束方式与技术形态强相关。** 纯Markdown的项目（Superpowers、mattpocock）依赖skill措辞和行为塑造来约束agent行为。有CLI工具的项目（OpenSpec）可以用机器可读接口和schema校验。有重度工具的项目（gstack）可以用脚本和守护进程强制执行。约束越强，技术依赖越重——这是一个根本性的张力。

**观察三：每个项目都在"流程拥有"与"用户控制"之间做了明确选择。** gstack和OpenSpec选择"拥有流程"——定义完整的步骤链路。mattpocock明确选择"不拥有流程"——用户自行编排。ECC选择"提供素材不定义流程"。Superpowers在中间——定义了执行流程但不覆盖全链路。这个选择直接影响项目的适用场景。

**观察四：所有成熟项目都在向简化方向演进。** Superpowers从v4的25分钟subagent review简化到v5的30秒inline self-review。OpenSpec从phase-locked演进到fluid actions。这个共同趋势暗示：**流程的自然倾向是膨胀，需要主动简化。**

---

## 6. 系列路线图

本文是系列的第一篇，建立了全景参照系。后续笔记的计划：

| 篇号 | 主题 | 做什么 |
|------|------|--------|
| 2 | Superpowers深度拆解 | Skill即行为塑造——每个设计决策的"为什么"和演进教训 |
| 3 | OpenSpec深度拆解 | Spec即共识契约——核心抽象的设计逻辑和工具化程度 |
| 4 | ECC深度拆解 | Agent素材大全——跨平台素材体系与选择性安装机制 |
| 5 | mattpocock-skills深度拆解 | 小而可组合——工程基础技能与需求澄清方法论 |
| 6 | gstack深度拆解 | 虚拟工程团队——Sprint链式传递与全流程覆盖 |
| 7 | 流程全景图 | 把所有项目放在一张图上，定义通用节点 |
| 8-13 | 逐个节点讨论 | Explore / Spec / Plan / Execute / Review & Verify / Archive |
| 14 | 综合总结 | 好的研发流程整体应该是怎样的 |
| 15 | 衡量与迭代 | 如何判断流程是否有效，如何持续改进 |

本篇的贡献是建立了参照系和识别了关键张力。后续笔记将在这些张力的框架下，逐个节点深入讨论"什么可能是好的实践方向"。

---

点击下方"**阅读原文**"进入我的演示网站。
