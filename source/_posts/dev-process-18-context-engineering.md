---
title: AI研发流程深度解析（十八）：Context Engineering——从Claude Code提示词瘦身80%重新检视流程约束
description: 从Thariq披露的Claude Code系统提示词瘦身实验出发，重新检视前文提出的流程约束设计，提炼Context Engineering时代的6条新规则以及对综合方案的修正。
tags:
  - 研发流程
  - Context Engineering
  - Claude Code
  - 约束设计
date: '2026-08-01'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-08-01
> **核心问题：** Anthropic的Thariq披露Claude Code系统提示词被删掉80%以上、编码评测无任何损失——这个反直觉发现对我们前17篇提炼的流程约束设计意味着什么？Context Engineering是否构成了7节点框架之外的新维度？综合方案需要哪些修正？

---

![AI研发流程深度解析（十八）：Context Engineering——从Claude Code提示词瘦身80%重新检视流程约束](/images/dev-process/dev-process-18-context-engineering.png)

## 引言

本系列前17篇围绕"AI应该做什么"展开——从Explore到Archive的7个节点，从5个项目的对比到综合方案的提炼，再到Bun案例与Ponytail懒惰约束的检视。我们反复讨论"约束"——Superpowers的Iron Law、Rationalization表、HARD-GATE，gstack的21步ship流程和anti-footgun rules，ECC的delivery-gate hook。这些约束被视为塑造agent行为、防止常见失败模式的核心机制。

但2026年7月底，Anthropic创始团队成员、Claude Agent SDK核心负责人Thariq发了一篇长文，说了一件反直觉的事：**他们把Claude Code的系统提示词删掉了超过80%，在Claude Opus 5和Claude Fable 5等新模型上，编码评测没有任何可测量的损失。**

这不是"约束可有可无"的轻描淡写——这是Anthropic官方对自家产品做的最大规模简化实验。Thariq的结论是：他们曾经over-constraining了Claude Code，新模型已经有了足够的judgement，许多曾经的"必要约束"反而成了负担。

这个发现直接挑战了我们前文的部分核心假设。本篇以Thariq的文章为镜子，重新检视我们提炼的约束机制，讨论三个问题：

1. Thariq揭示的6个Then→Now转变，对我们前文的项目分析意味着什么？
2. Context Engineering是否构成了我们7节点框架遗漏的新维度？
3. 第十四篇的综合方案需要哪些修正？

需要强调：Thariq说的是Claude 5代际模型的行为，前文5个项目大多基于Claude 3代际或同代模型设计——它们的约束在当时是必要的。但模型能力在演进，流程设计必须随之演进。本篇不是否定前文，而是补全"模型能力拐点后"的演进方向。

---

## 1. Thariq实验的核心发现

### 1.1 80%瘦身无损失

Thariq的描述很直接：

> We removed over 80% of Claude Code's system prompt for models like Claude Opus 5 and Claude Fable 5 with no measurable loss on our coding evaluations.

这个数字本身已经足够震撼——一个产品的核心系统提示词删掉80%，功能评测不退反进。但更值得关注的是Thariq对原因的诊断：

> Generally, Claude can interpret the user's intent to get to the right answer, but Claude must think more carefully about these overlapping and conflicting messages before deciding what to do.

**关键洞察**：约束的代价不只是"占用context窗口"那么简单——当多条约束在同一请求中重叠或冲突时（比如"leave documentation as appropriate"和"DO NOT add comments"同时出现在system prompt、skills、CLAUDE.md中），模型必须在"思考该做什么"之前先"思考该听哪条规则"。这种元层面的判断消耗的是模型的有效推理能力。

这跟我们前文讨论的"context window稀缺"是两回事——context window是容量问题，而Thariq揭示的是**约束冲突的认知负担**问题。容量可以通过progressive disclosure缓解，认知负担只能通过减少约束本身来解决。

### 1.2 over-constraining的真实代价

Thariq列举了曾经的系统提示词：

> In code: default to writing no comments. Never write multi-paragraph docstrings or multi-line comment blocks — one short line max. Don't create planning, decision, or analysis documents unless the user asks for them — work from conversation context, not intermediate files.

这条规则看起来很合理——避免AI写无用注释、避免生成多余文档。但Thariq承认：

> For a certain subset of prompts, this guidance would be wrong. In the case of documentation, the user may have their own preferences, or specific parts of very complex code might need multi-line comment blocks.

这是over-constraining的典型模式——**用一条全局规则防御一种失败模式，但这条规则本身在另一个场景下就是错的**。老模型没有judgement区分场景，所以需要全局规则；新模型有judgement，全局规则反而成了阻碍。

新版系统提示词变成了：

> Write code that reads like the surrounding code: match its comment density, naming, and idiom.

**关键转变**：从"全局规则"到"上下文judgement"——让模型观察周围代码的风格并匹配。这条新规则更短、更通用、更不容易与其他规则冲突。

### 1.3 模型能力演进的拐点

Thariq的发现不是孤立的——它是第十五篇讨论的"模型能力与流程复杂度的反向关系"的强力佐证。第十五篇提出：

> 模型能力越强，流程可以越简单；模型能力越弱，流程需要越复杂来补偿。但这个关系有一个关键限制——流程不能弥补模型能力的不足。

Thariq的实验给出了这个反向关系的一个具体数据点：**当模型从Claude 3代际演进到Claude 5代际时，80%的约束可以被删除**。这不是渐进式的简化，而是阶跃式的拐点。

第十五篇还提到一个区分：

> 流程可以补偿模型能力的"习惯性不足"（如不运行验证、跳过探索），但不能补偿模型能力的"能力性不足"（如无法判断业务风险、无法做跨task结构性思考）。

Thariq的发现进一步细化了这个区分——**许多我们以为是"习惯性不足"的失败模式（如写无用注释、生成多余文档），在新模型上其实是"能力性已足"**——它们有了judgement，不再需要规则来代为决策。这意味着许多我们以为必要的约束，其实是给"已经能判断的模型"戴上"防止它不能判断"的枷锁。

---

## 2. Then vs Now：6个转变对我们的启发

Thariq文章的核心是6个Then→Now的转变。本节把这6个转变对照我们前文的项目分析，讨论每一个转变对流程设计的启发。

### 2.1 Rules → Judgement：Rationalization表的边界

| Thariq的转变 | 我们前文的对应 |
|------------|--------------|
| Then: Give Claude rules / Now: Let Claude use judgement | Superpowers的Rationalization表、Iron Law、HARD-GATE |

Superpowers的Rationalization表是"Rules"范式的极致——它列出AI逃避流程的所有借口，每个借口附"现实对照"：

- "should work now" → RUN the verification
- "I'm confident" → Confidence ≠ evidence
- "Agent said success" → Verify independently

我们在第十四篇评价："Rationalization表可能是最有效的单一技巧——它直接针对AI最常见的失败模式（自我合理化）。"这个评价在Claude 3代际是成立的——老模型确实会"自我合理化"跳过验证。

但Thariq的发现提出了一个问题：**Claude 5代际是否还会"自我合理化"？** 如果新模型的judgement足够好，它不需要一张"借口对照表"来识别"should work now"是逃避——它自己能识别。

**实践方向**：Rationalization表不是要全盘否定，而是要分场景。对于"模型能力性不足"导致的失败（如无法判断业务风险），Rationalization表无效，需要人工介入。对于"模型习惯性不足"导致的失败（如不运行验证），Rationalization表有效，但应该定期评估——随着模型演进，哪些条目可以从表中删除？Superpowers的94% PR拒绝率是高质量的标志，但也意味着它的约束可能比当前模型需要的更重。

### 2.2 Examples → Interface Design：mattpocock的example-heavy skill如何调整

| Thariq的转变 | 我们前文的对应 |
|------------|--------------|
| Then: Give Claude examples / Now: Design interfaces | mattpocock的example-heavy skill、Superpowers的micro-test wording |

Thariq说：

> The number one rule for tool usage was to give Claude examples on how to use them. With our newest models, we've found that giving examples actually constrains them to a certain exploration space.

Thariq给出的例子是Todo工具——不靠example，而是靠status枚举（pending/in_progress/completed）和"keep one item in_progress"的接口设计，让模型自己推断用法。

这跟我们在第十一篇讨论的mattpocock的"reference-only TDD"是同一个方向——mattpocock明确不提供step-by-step workflow，依赖"AI内化的TDD精神"。但mattpocock的其他skill（如grill-me、to-tickets）仍然是example-heavy的。

**关键洞察**：从"Examples"到"Interface Design"的转变，要求我们重新思考skill的设计单位。前文的skill大多以"指令+示例"为单位——告诉模型做什么，给出几个例子。Thariq建议的设计单位是"接口契约"——定义参数空间、状态枚举、不变量，让模型在接口约束下自由探索。

这对我们前文的"行为塑造"范式是个修正——**行为塑造不只可以通过"写指令"实现，也可以通过"设计接口"实现**。后者的优势是：接口契约比自然语言指令更精确、更难冲突、更容易演进。Superpowers的File Handoffs机制（task-brief、report、review-package通过文件传递）其实已经隐含了这个方向——文件格式就是接口契约。

### 2.3 Upfront → Progressive Disclosure：gstack的preamble可以瘦身

| Thariq的转变 | 我们前文的对应 |
|------------|--------------|
| Then: Put it all upfront / Now: Use progressive disclosure | gstack的preamble、Claude Code的verification/code review skill化 |

Thariq说：

> Since then, Claude Code has gotten very competent at using progressive disclosure- loading the right context at the right times. For example, we moved verification and code review into their own skills that Claude Code could selectively call.

这跟我们在第十二篇讨论的gstack的preamble形成对比——gstack在每个skill开始时注入Context Recovery，但这增加了token消耗。Thariq的发现表明，**新模型可以可靠地"在需要时主动加载"上下文，而不需要"在开始时全部注入"**。

更值得注意的是Thariq提到的"deferred loading"工具——agent必须通过ToolSearch才能找到工具的完整定义：

> Some of our tools are 'deferred loading,' which means the agent must search for their full definitions using ToolSearch before using them. This allows us to have more tools (such as our Task tools) that don't take up context until they're needed.

这是一个比skill化更彻底的progressive disclosure——**工具本身也可以deferred loading**。我们前文讨论的"skill化"是把指令从system prompt抽到skill文件，deferred loading是把工具从tool列表抽到搜索空间。两者方向一致：减少默认加载，按需展开。

**实践方向**：gstack的preamble（每个skill开始时注入Context Recovery）在新模型上可能可以瘦身——只保留"当前skill产出物"和"上游skill关键决策"的指针，其余依赖agent主动查询。ECC的67个agents已经是这个方向——它们是"素材库"而非"流程步骤"，按需调用。

### 2.4 Repeat → Simple Tool Descriptions：重复约束的清理

| Thariq的转变 | 我们前文的对应 |
|------------|--------------|
| Then: Repeat yourself / Now: Simple tool descriptions | gstack的anti-footgun rules在多处重复 |

Thariq说：

> Earlier Claude models could sometimes need repeated instructions or be more likely to listen to instructions at the end of their context window than at the start. This meant our system prompt would sometimes have references to tools in the main system prompt as well as instructions in the tool description. We found we could delete these repeat examples and put instructions on how to use tools in the tool descriptions rather than the system prompt.

这跟我们在第十三篇讨论的gstack的21步ship流程形成对比——gstack的anti-footgun rules"永远不要在有非WIP commit时盲目 `git reset --soft`"在Step 15、Step 15.0、Step 15.1、历史踩坑表四个地方重复出现。我们当时评价这是"防御性设计"，但Thariq的发现表明——**新模型不需要重复约束，重复反而增加冲突的可能**。

**实践方向**：约束应该有"唯一归属地"——一条约束只在一个地方定义（system prompt / skill / tool description / CLAUDE.md），其他地方最多用指针引用。gstack的21步流程中，Step 15的anti-footgun rule与Step 15.0、Step 15.1的内容高度重叠——在新模型上可以合并为单一定义，其他地方只引用step编号。

### 2.5 CLAUDE.md Memory → Auto-memory：流程的"记忆节点"被产品接管

| Thariq的转变 | 我们前文的对应 |
|------------|--------------|
| Then: Memory in CLAUDE.md files / Now: Auto-memory | 我们没有专门讨论记忆节点，但第七篇的7节点框架隐含了"记忆"作为支撑能力 |

Thariq说：

> We used to encourage users to save things to Claude's memory, by using the # hotkey to write to their CLAUDE.md automatically. Instead, Claude now automatically saves memories that are relevant to the work and to you.

这是一个我们前文没有充分讨论的维度——**记忆管理**。我们的7节点框架（Explore → Spec → Plan → Execute → Review → Verify → Archive）是行为流程，没有把"记忆"作为独立节点。但前文多个项目都涉及记忆：

- ECC的Continuous Learning v2（instinct-based learning with confidence scoring）
- gstack的 `/learn` 命令（cross-session learnings）
- mattpocock的CONTEXT.md（ubiquitous language）
- Superpowers的Progress Ledger（抗context compaction）

这些都是"用户手动管理"或"工具辅助半自动管理"的记忆。Thariq的发现表明，**记忆管理正在从"流程的一部分"变成"产品的内置能力"**——Claude Code自动判断什么值得记、自动保存。

**关键洞察**：这暗示我们7节点框架的一个盲区——**记忆是横切所有节点的支撑能力，不是独立节点，但也不是可有可无的附属品**。当模型能力 + 产品能力（auto-memory）足够好时，记忆节点可以从流程中"隐式化"——agent自己管理，不需要流程显式规定"何时记、记什么"。但在那之前，记忆仍然是流程需要显式处理的问题。

### 2.6 Simple Specs → Rich References：spec形态的扩展

| Thariq的转变 | 我们前文的对应 |
|------------|--------------|
| Then: Simple specs / Now: Rich references | 第九篇的Spec节点讨论、OpenSpec的结构化spec |

Thariq说：

> We've found that Claude can handle increasingly more complicated references. Instead of simple markdown files, Claude can reference HTML artifacts created by our new artifacts feature. You may also give Claude references in the form of code. A spec may also be a detailed test suite, or a function in a different codebase that Claude might port.

这是对第九篇Spec节点讨论的重要补充。我们在第九篇主要讨论了OpenSpec的结构化spec（`### Requirement:` + `#### Scenario:` + RFC 2119）和mattpocock的CONTEXT.md——这些都是markdown格式。

Thariq指出spec可以是更丰富的形态：

- **HTML mockup**：优于描述或截图，因为是高保真指令
- **Test suite**：测试本身就是spec——"测什么"定义了"做什么"
- **Code in other codebase**：让Claude port一个已有函数
- **Rubrics**：动态工作流 + verifier agent用rubric校验taste

**关键洞察**：spec不是"用自然语言描述需求"——spec是"任何能让Claude高保真理解意图的载体"。代码比自然语言更精确，mockup比描述更具体，rubric比自由评测更可验证。这跟我们在第九篇对OpenSpec的"结构化spec"评价形成有趣的对话——结构化spec的优势不是"格式化了"，而是"接近代码的可执行性"。

**实践方向**：Spec节点的产出物应该按"保真度"排序选择——优先代码 > 测试 > mockup > 结构化spec > 自然语言spec。当可以用现有代码或测试作为spec时，不需要再写自然语言spec。这跟Bun案例（第十六篇）中"用Rust测试套件作为Zig→Rust迁移spec"的实践一致。

---

## 3. Context Engineering作为流程的新维度

### 3.1 7节点框架的盲区

第七篇定义了7个通用节点（Explore → Spec → Plan → Execute → Review → Verify → Archive），后续六篇逐个节点深入分析。但Thariq的文章揭示了一个我们遗漏的维度——**Context Engineering**。

Thariq说：

> But when you send a message to Claude, the prompt is only a small part of the context it gets. Much of your context is assembled from your system prompt, Skills, CLAUDE.md files, memory, and other sources. We call this context engineering, and it makes a big impact on the results you generate when using Claude Code or in building your own agents.

Context Engineering不是7节点之一——它是横切所有节点的支撑维度。每个节点的执行都依赖context：Explore需要context理解现有系统，Spec需要context理解需求背景，Execute需要context理解plan，Review需要context理解标准。但context本身不是节点产出物，而是节点执行的前提。

我们在第十四篇讨论过"Context管理"作为独立章节，但当时主要讨论的是"context window的容量管理"（File handoffs、Continuous Checkpoint、subagent隔离）——这是容量视角。Thariq的Context Engineering是更广的视角——**包括容量管理，但更核心的是"在context中放什么、不放什么、什么时候放"**。

**关键洞察**：7节点框架回答"做什么"，Context Engineering回答"用什么信息做"。两者正交——同一个节点可以用不同的Context Engineering策略执行。比如Execute节点，可以一次性加载所有plan + spec + 相关代码（upfront），也可以按task逐步加载（progressive disclosure）。前者context丰富但易冲突，后者context精简但需要模型主动查询。

### 3.2 Context Engineering与7节点的关系

Context Engineering不是替代7节点，而是7节点的"第二轴"。可以用一个二维框架理解：

```
                Context Engineering策略
                (upfront) ←─────────────→ (progressive disclosure)
                ↑
        Explore |    高保真但易冲突         |    按需加载现有系统信息
        Spec    |    一次性加载全部需求     |    按issue逐步澄清
        Plan    |    一次性加载全部spec     |    按task逐步细化
7节点   Execute |    一次性加载全部plan     |    按task逐步加载
        Review  |    一次性加载全部代码     |    按diff范围加载
        Verify  |    一次性加载全部测试     |    按变更影响加载
        Archive |    一次性加载全部历史     |    按合并需求加载
                ↓
```

5个项目在这个二维框架中的位置：

- **Superpowers**：偏upfront——HARD-GATE要求在Spec阶段就完整定义，File Handoffs一次性传递artifact
- **OpenSpec**：偏progressive disclosure——Artifact Graph支持任意阶段修改任意artifact，CLI按需查询
- **gstack**：偏upfront——preamble在每个skill开始时注入Context Recovery
- **mattpocock**：偏progressive disclosure——skill小而可组合，用户按需调用
- **ECC**：偏progressive disclosure——67个agents按需选择，不全部加载

**实践方向**：随着模型能力演进（Thariq揭示的judgement提升），Context Engineering的最优策略正在从upfront向progressive disclosure移动。但移动速度因节点而异——Spec节点可能仍需要相对upfront（需求理解需要全局上下文），Execute节点更适合progressive disclosure（按task加载减少冲突）。

### 3.3 新维度的实践原则

综合Thariq的建议和前文的项目分析，Context Engineering的实践原则可以归纳为4条：

**原则1：约束最小化**
- 删除任何"防御一种失败模式但在另一场景下是错的"的全局规则
- 用"match the surrounding code"代替"DO NOT add comments"——让模型用judgement而非规则
- 定期评估约束的必要性——随着模型演进，哪些约束可以删除？

**原则2：Progressive Disclosure**
- system prompt只放产品上下文（"这是Claude Code，你在做编码"）
- skill放特定领域知识，按需加载
- CLAUDE.md只放"gotchas"——避免陈述"obvious"的事物
- 工具deferred loading——通过ToolSearch按需发现

**原则3：接口优于示例**
- 工具设计优先考虑参数空间和状态枚举，而非示例
- skill设计优先考虑"接口契约"（输入、输出、不变量），而非step-by-step示例
- 当模型judgement足够时，接口约束比示例约束更鲁棒

**原则4：Reference形态多样化**
- spec不一定是markdown——可以是代码、测试、mockup、rubric
- 优先高保真reference：代码 > 测试 > mockup > 结构化spec > 自然语言
- `@mention`文件作为reference，让模型直接读取而非通过描述传递

---

## 4. 对前文项目的重新检视

### 4.1 Superpowers：行为塑造范式的边界

我们在第十四篇评价Superpowers："强制程度最高——agent被'绑定'到流程中。代价：简单变更也走完整流程（过重）；skill触发率约50-80%（不如hook 100%）。"

Thariq的发现补充了一个新的代价维度——**Rationalization表本身的认知负担**。当模型需要先"判断该听哪条rationalization对照"再"做实际决策"时，它的有效推理能力被消耗在元层面。对于Claude 3代际，这种消耗是必要的——模型不识别"should work now"是逃避，所以需要对照表。但对于Claude 5代际，这种消耗可能成为负担——模型能识别，对照表反而让它在"是不是该查表"上犹豫。

**修正**：Superpowers的Rationalization表不是错误——它是特定模型能力下的合理设计。但它的演进方向应该是**逐步瘦身**——定期评估哪些条目在新模型上已经"内化"，可以从表中删除。Superpowers的eval体系（drill harness + 压力测试）正好可以做这件事——在新模型上跑eval，如果删除某条rationalization后eval通过率不降，就可以删除。

### 4.2 gstack：21步流程的简化空间

我们在第十三篇详细分析了gstack的21步ship流程，注意到它有大量重复约束（Step 15、Step 15.0、Step 15.1、历史踩坑表四处重复anti-footgun rules）。

Thariq的发现表明，**这些重复在新模型上可以大幅简化**：

- **重复约束合并**：anti-footgun rules只在一处定义（建议在Step 15主体），其他地方只引用"见Step 15"
- **Rules→Judgement**：部分"永远不要X"的规则可以改为"在X情况下，根据Y判断"——让模型用judgement而非遵守绝对禁令
- **Examples→Interface**：Step 9的specialist dispatch（security变更触发Security Officer等）可以改为接口设计——变更类型枚举 + reviewer映射表，让模型自己推断

但gstack的简化空间是有限的——它的21步流程中，许多步骤是机械化操作（如Step 12 version bump、Step 13 CHANGELOG生成），这些不依赖模型judgement，约束简化对它们无效。

**修正**：gstack的21步流程不是"过度约束"，而是"约束集中在错误的地方"。机械步骤（version、changelog、push、PR创建）的详细约束是必要的——它们不消耗模型judgement，只消耗执行步骤。可以简化的是**判断性步骤**的约束（如Step 9 specialist dispatch、Step 11 adversarial review）——这些步骤依赖模型judgement，约束过重反而阻碍。

### 4.3 ECC：素材库vs约束库

我们在第四篇和第十四篇评价ECC："覆盖最广但深度最浅——261+ skills但不定义流程约束。"

Thariq的发现表明，ECC的"不定义流程约束"可能反而是符合演进方向的——当模型judgement足够好时，**提供素材让模型按需调用**比**定义流程让模型遵守**更有效。ECC的67个agents已经是"deferred loading"的实践——它们不全部加载，按需选择。

但ECC的局限也很明显——它的skills本身仍然是"Rules + Examples"范式，没有转向"Interface Design"范式。ECC的演进方向应该是：保留素材库的灵活性，但将每个skill的内部设计从"指令+示例"转向"接口契约+不变量"。

**修正**：ECC的"素材库不定义流程"不是缺陷，而是符合Context Engineering方向的设计选择。但素材本身的形态需要演进——从"行为塑造skills"到"接口契约skills"。

### 4.4 OpenSpec：Artifact治理的优势显现

我们在第二篇和第十四篇评价OpenSpec："强制程度中等——工具验证artifact格式但不阻断用户行动。"

Thariq的发现让OpenSpec的Artifact治理范式显示出独特优势——**Artifact本身就是接口契约**。OpenSpec的spec格式（`### Requirement:` + `#### Scenario:` + RFC 2119关键词）是一种"接近代码的接口契约"——它比自然语言spec更精确、更难冲突。OpenSpec的Delta机制（ADDED/MODIFIED/REMOVED/RENAMED）是状态枚举——比"修改spec"的自然语言指令更鲁棒。

这跟Thariq的建议"Interface Design优于Examples"完全一致——OpenSpec的整个设计就是Interface Design范式。它的spec不是"给Claude看的自然语言描述"，而是"程序可解析的结构化契约"——validator可以程序化检查，archive可以程序化合并。

**修正**：OpenSpec的Artifact治理范式在Context Engineering时代显示出独特价值——它本身就是Thariq建议的"Interface Design"方向。前文对OpenSpec"编写成本高"的评价仍然成立，但需要补充："编写成本高"的代价换来的是"约束冲突少、可程序化验证"的优势——这个交易在模型judgement提升、约束简化的大趋势下越来越划算。

---

## 5. 简化的勇气：流程迭代的启示

### 5.1 删除80%无损失是一个强信号

Thariq的80%瘦身不是渐进式的"减少10%"——而是阶跃式的"删除80%"。这种简化幅度在工程实践中罕见——大多数简化是渐进的，因为不敢一次删太多。

Anthropic敢于删除80%的底气来自他们的eval体系——编码评测可以量化验证"无损失"。这跟我们在第十五篇讨论的Superpowers的eval方法（drill harness + 压力测试 + 94% PR拒绝率）是同一思路——**简化的前提是可衡量**。

**关键洞察**：流程简化的最大障碍不是"不知道什么可以删"，而是"不敢删"——担心删除后出现问题。这种担心只能用eval数据消除。没有eval体系的简化是赌博，有eval体系的简化是工程。

### 5.2 简化的判断标准

综合Thariq的发现和前文分析，可以提炼简化的判断标准：

**可以简化的约束**：
- 防御"模型习惯性不足"的规则——当模型judgement提升后，这些规则成为负担
- 重复定义的约束——只在一处保留，其他改为引用
- 与其他约束冲突的规则——任选其一，删除其他
- 防御"已不存在的失败模式"的规则——老模型的失败模式在新模型上不出现

**不应简化的约束**：
- 防御"模型能力性不足"的规则——业务风险判断、跨task结构性思考，这些模型judgement仍不足
- 机械步骤的约束——version bump、changelog生成等不依赖judgement的步骤
- 程序化验证的约束——validator、delivery-gate hook等确定性检查
- 安全相关的约束——credential检查、文件删除保护等

**判断方法**：用eval体系量化——删除约束前后跑eval，通过率不降则可删。没有eval的约束简化只能凭经验判断，风险较高。

### 5.3 claude doctor的启发：自动化简化

Thariq提到了一个新命令——`claude doctor`，用于自动rightsizing skills和CLAUDE.md文件：

> We rolled out a new command called `claude doctor,` which will help you do this automatically as well.

这是一个有趣的方向——**简化本身也可以工具化**。前文的5个项目都有"约束膨胀"的倾向（Superpowers的24 failure memories持续积累、gstack的21步流程逐步加step、ECC的261+ skills持续增长），但没有项目提供"简化工具"——简化都依赖人工评审。

`claude doctor`的启发是：**简化可以是程序化的**——分析CLAUDE.md和skill文件，识别重复约束、冲突约束、过时约束，建议删除。这跟OpenSpec的validator是同一思路——程序化检查比人工评审更确定。

**实践方向**：流程工具链应该包含"简化工具"——不只是"添加约束"的工具（如validator、delivery-gate），还要有"删除约束"的工具（如doctor）。前者防止约束不足，后者防止约束过度。两者缺一不可。

---

## 6. 对第十四篇综合方案的修正

### 6.1 约束机制章节的更新

第十四篇2.1节提出了三种流程控制范式（行为塑造、Artifact治理、Sprint链式），并评价行为塑造"强制程度最高"。

**修正**：增加第四种范式——**Interface Design（接口契约）**。这种范式不通过指令塑造行为，也不通过artifact治理流程，而是通过设计接口（参数空间、状态枚举、不变量）约束模型行为。Thariq的Todo工具示例（status枚举 + "keep one item in_progress"）是这种范式的典型。

Interface Design范式的特征：
- 强制程度中等——接口约束明确，但模型在接口内有judgement空间
- 工具依赖——需要程序化解析接口契约
- 关键设计：参数枚举、状态机、不变量、类型约束
- 代价：接口设计本身需要工程能力；不适用于所有约束（如"运行验证"难以接口化）

**4种范式的演进关系**：随着模型judgement提升，最优范式从行为塑造 → Sprint链式 → Artifact治理 → Interface Design移动。但不是替代关系——不同节点适合不同范式。Spec节点适合Artifact治理（结构化spec），Execute节点适合行为塑造（TDD Iron Law），Archive节点适合Interface Design（接口化合并操作）。

### 6.2 Context Engineering作为新增维度

第十四篇2.4节讨论了"纯Markdown vs工具强制的tradeoff"，但没有把Context Engineering作为独立维度。

**修正**：增加Context Engineering作为流程设计的第二轴。流程设计不只是"做什么节点"（7节点框架）和"用什么约束"（约束机制），还包括"用什么context策略"（Context Engineering）。三者正交：

- **7节点框架**：行为流程的时序——Explore → Spec → ... → Archive
- **约束机制**：行为流程的控制——行为塑造 / Artifact治理 / Sprint链式 / Interface Design
- **Context Engineering**：行为流程的信息——upfront / progressive disclosure / deferred loading

完整流程设计需要三个维度都做选择。比如OpenSpec：7节点 + Artifact治理 + progressive disclosure。Superpowers：7节点 + 行为塑造 + upfront（HARD-GATE要求前置定义）。Claude Code新设计：7节点 + Interface Design + progressive disclosure。

### 6.3 简化原则的强化

第十四篇的"实践方向"中提到了"流程的自然倾向是膨胀，需要主动简化"（来自第十五篇的观察4），但没有把简化作为独立原则。

**修正**：将简化提升为流程设计的第一原则——**任何约束的添加都应该附带eval基线，定期评估是否可以删除**。这跟Thariq的`claude doctor`思路一致——简化不是一次性活动，而是持续过程。

具体原则：
- **添加约束时记录eval基线**——后续可以量化评估约束的必要性
- **定期跑eval评估约束**——删除通过率不降的约束
- **约束必须有"唯一归属地"**——避免重复定义
- **新模型发布时优先评估约束简化**——模型能力拐点是简化窗口

---

## 7. 结论

Thariq的80%瘦身实验是本系列的一个重要外部参照点。它不否定前17篇的分析——前文的项目都基于当时的模型能力设计，约束在当时是必要的。但它揭示了模型能力演进后流程设计需要调整的方向：

**调整1：约束的代价不只是context容量，还有认知负担**。多条约束重叠或冲突时，模型消耗有效推理能力在"判断该听哪条"上。简化约束不只是释放context，更是释放judgement。

**调整2：Context Engineering是流程设计的第二轴**。7节点框架回答"做什么"，约束机制回答"用什么控制"，Context Engineering回答"用什么信息"。三者正交，完整流程设计需要三个维度都做选择。

**调整3：Interface Design是约束机制的新范式**。除了行为塑造、Artifact治理、Sprint链式，Interface Design通过设计接口（参数空间、状态枚举、不变量）约束模型——它在模型judgement提升后越来越有效。

**调整4：简化是流程设计的第一原则**。任何约束的添加都应该附带eval基线，定期评估是否可以删除。简化不是一次性活动，而是持续过程——`claude doctor`的启发是简化本身也可以工具化。

**调整5：Reference形态多样化**。spec不一定是markdown——可以是代码、测试、mockup、rubric。优先高保真reference——代码 > 测试 > mockup > 结构化spec > 自然语言spec。

需要强调的边界：Thariq的发现基于Claude 5代际模型——Opus 5、Fable 5。在Claude 3代际或同代模型上，前文的约束设计仍然成立。流程设计必须跟随模型能力演进——这本身就是第十五篇"模型能力与流程复杂度的反向关系"的实践印证。

本系列到此告一段落。17篇正文 + 本篇外部参照检视，覆盖了从全景扫描到逐节点深入、从综合方案到案例验证、从懒惰约束到Context Engineering的完整探索。流程设计没有终点——模型在演进，工具在演进，最佳实践也在演进。我们能做的，是建立"可衡量、可简化、可演进"的流程框架，让它随时代调整。

---

点击下方"**阅读原文**"进入我的演示网站。
