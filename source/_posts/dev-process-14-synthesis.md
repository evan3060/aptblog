---
title: AI研发流程深度解析（十四）：综合总结——一个全面轻量的研发流程应该是怎样的
description: 综合各家的特色对比和逐节点深入分析，提炼全面轻量的AI辅助研发流程整体形态，明确各节点如何协作及需要什么约束机制。
tags:
  - 研发流程
  - 综合总结
  - 流程设计
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-13
> **核心问题：** 综合各家的特色对比和逐节点深入分析，一个全面轻量的AI辅助研发流程整体上应该是怎样的？各节点如何协作？需要什么约束机制？舍弃了什么？

---

## 引言

第七篇定义了7个通用节点（Explore → Spec → Plan → Execute → Review → Verify → Archive），后续六篇逐个节点对比了5个项目的设计差异和tradeoff。本篇是综合平衡方案的最终形态探讨——从各家的特色对比和逐节点深入分析中提炼整体性的方案，明确我们选择了什么、放弃了什么、以及为什么。

需要强调：五个参考项目各自在自己的场景中都是合理的设计——Superpowers在行为约束上最深入，OpenSpec在spec治理上最独创，ECC在场景覆盖上最丰富，mattpocock在方法论轻量性上最精炼，gstack在流程完整性上最全面。我们试图探索的，是在"全面覆盖"和"轻量使用"之间的一种综合平衡——取各家之长，避已知弯路，舍部分深度。这个平衡在某些方面不如专门优化的项目，但综合起来没有明显短板。

---

## 1. 流程整体框架

### 1.1 7个节点的普遍性

第七篇的分析表明，尽管5个项目的规模差异巨大（mattpocock ~20 skills vs gstack 23+ skills + 8 tools），它们的流程都能映射到7个通用节点上。这不是巧合——7个节点对应了软件研发的基本活动：

| 节点 | 基本问题 | 不可跳过的理由 |
|------|---------|-------------|
| **Explore** | 要解决什么问题？ | 跳过 → 方向错误，最高代价 |
| **Spec** | 系统应该做什么？ | 跳过 → 无验证基准，review无依据 |
| **Plan** | 按什么顺序做？ | 跳过 → 执行混乱，依赖管理失控 |
| **Execute** | 实现代码 | 不可跳过（核心活动） |
| **Review** | 代码合格吗？ | 跳过 → 质量、安全、需求忠实度无保障 |
| **Verify** | 真的能用吗？ | 跳过 → 虚假完成声明，信任破裂 |
| **Archive** | 如何收尾？ | 跳过 → 分支残留、spec过时、知识丢失 |

但"不可跳过"不意味着"必须重度执行"——节点的重要性在于"被思考过"而非"被完整走完"。OpenSpec的"Enablers not Gates"哲学正是这个意思：每个节点都是一个"使能器"——它使你能做下一件事，但不阻止你跳过。

### 1.2核心节点vs按需节点

从5个项目的实践中，可以提炼出节点的"必要性层次"：

**核心节点（所有项目都重度实现）：**
- **Spec**：所有项目都产出某种形式的设计/规格文档。这是"做什么"的定义——没有它，后续一切都失去基准。
- **Execute**：所有项目都实现代码。这是核心活动。
- **Review**：所有项目都有某种形式的代码审查。这是质量的基本保障。

**重要节点（所有项目都有但实现差异大）：**
- **Explore**：所有项目都有某种形式的"从模糊到精确"，但从HARD-GATE到自由对话差异极大。
- **Plan**：所有项目都将spec转化为任务，但从bite-sized steps到tracer-bullet tickets粒度差异达一个数量级。
- **Verify**：所有项目都有验证步骤，但从Iron Law到嵌入TDD独立性差异明显。

**闭环节点（差异最大的节点）：**
- **Archive**：从OpenSpec的delta合并到mattpocock的简单commit，闭环深度差异极大。只有OpenSpec实现了spec的持续演进。

**实践方向**：核心节点（Spec、Execute、Review）应该有最低保障——即使最轻量的流程也不能完全跳过。重要节点（Explore、Plan、Verify）可以按风险等级调节深度。闭环节点（Archive）的价值在长期维护的项目中最大——短期项目可以轻量化。

### 1.3步骤数的自然边界

第七篇的分析揭示了一个有趣的趋势——尽管项目规模差异巨大，显式步骤数都集中在5-7步：

| 项目 | 显式步骤数 | 角色数 |
|------|----------|-------|
| Superpowers | ~7步 | 3（controller, implementer, reviewer） |
| OpenSpec | ~6步 | 1（AI agent + 人类） |
| ECC | ~6 Phase + 2 GATE | 67 agents（但pipeline只有6 Phase） |
| mattpocock | ~5步 | 1-2（AI agent + 可选subagent） |
| gstack | ~7阶段 | 8+（但sprint只有7阶段） |

**关键洞察**：AI研发流程的自然复杂度大约在5-7个节点。更多节点会增加认知负担和流程偏离风险（如某研发流程尝试的38 phase失败教训），更少节点会缺失关键环节。角色数也趋同——尽管ECC有67个agents和gstack有8+ 个工程角色，实际在单个流程实例中活跃的角色通常在2-3个（如Superpowers的controller + implementer + reviewer）。

**实践方向**：流程步骤应控制在 ~7步以内，核心角色应控制在 ~3个以内。这并不意味着不能有更多的skills或agents——而是指单个变更流程实例中，实际执行的步骤和活跃的角色应该在这个范围内。ECC的67个agents是"素材库"而非"流程步骤"——用户按需选择，不是每次都用全部。

### 1.4 "Enablers not Gates" 在实践中意味着什么

OpenSpec的"Enablers not Gates"是一个重要的设计哲学——依赖表示"使能"而非"门禁"。但5个项目的实践表明，完全无gate的流程存在风险：

- **OpenSpec自身**：verify明确"不阻断"，但用户可以忽略所有警告直接archive，导致spec与代码不一致
- **mattpocock**：不拥有流程，用户完全自主——但缺乏质量保障
- **Superpowers**：HARD-GATE + Iron Law强制每个节点——但简单变更也走完整流程（过重）

**实践方向**：纯gate（Superpowers）和纯enabler（OpenSpec）都不是最优——按风险等级调节可能是更平衡的方向。低风险变更用enabler模式（可以跳过），高风险变更用gate模式（不可跳过）。ECC的Size classifier（trivial跳过plan）和OpenSpec的Progressive Rigor（Lite spec vs Full spec）都在这个方向上探索。但"风险等级由谁判断"本身是一个需要回答的问题——如果是agent判断，可能误判；如果是用户判断，可能低估风险。

### 1.5 Brownfield vs Greenfield的流程路径

第七篇和第九篇都讨论了Brownfield和Greenfield的差异。综合来看：

**Greenfield路径**：
```
Explore（产品方向 + 架构选择）→ Spec（从零描述系统）→ Plan → Execute → Review → Verify → Archive
```

**Brownfield路径**：
```
（系统理解）→ Explore（变更意图）→ Spec（Delta：只描述变更）→ Plan → Execute → Review → Verify → Archive（Delta 合并回 source of truth）
```

Brownfield路径的关键差异：
1. **需要"系统理解"子能力**：在Explore之前或之中，需要分析现有系统、确定影响范围。mattpocock的CONTEXT.md（共享词汇）和ECC的codebase-onboarding是两个不同方向的探索。
2. **Delta机制的价值凸显**：只描述变更而非重述全部。OpenSpec是唯一将Brownfield作为first-class概念的项目。
3. **Source of Truth的长期价值**：spec随变更有机增长，不会过时。

**实践方向**：Brownfield场景可能需要在Explore和Spec之间增加一个"系统理解"子能力——不是独立节点，而是Explore的Brownfield扩展。这个子能力需要：构建共享词汇（mattpocock的CONTEXT.md方向）、分析影响范围、理解现有行为。Delta机制在Brownfield场景下的价值是显著的——但它的采用成本较高（需要结构化spec + validator + 合并工具）。

---

## 2. 约束机制

### 2.1三种流程控制范式

第七篇提炼了三种流程控制范式，后续六篇的逐节点分析进一步验证了这三种范式的特征：

**范式一：行为塑造（Superpowers）**
- 通过SKILL.md中的指令塑造agent行为——Iron Law、Rationalization表、Red Flags
- 纯Markdown驱动，不依赖外部工具
- 强制程度最高——agent被"绑定"到流程中
- 关键设计：HARD-GATE阻止跳过探索、Iron Law阻止虚假完成声明、Rationalization表防御所有"跳过"借口
- 代价：简单变更也走完整流程（过重）；skill触发率约50-80%（不如hook 100%）

**范式二：Artifact治理（OpenSpec）**
- 通过结构化artifact（change文件夹 + delta specs）和CLI工具治理流程
- Artifact是source of truth——流程围绕artifact的创建、审查、合并展开
- 强制程度中等——工具验证artifact格式但不阻断用户行动
- 关键设计：validator程序化验证格式、archive程序化合并delta、Artifact Graph提供确定性查询
- 代价：编写成本高（需要理解结构化格式）；合并可能出错

**范式三：Sprint链式（gstack）**
- 通过文件系统持久化artifact + preamble自动化 + Dashboard可视化实现链式传递
- 每个skill的产出喂给下一个，形成流水线
- 强制程度中等——Dashboard可视化但很少阻断
- 关键设计：Continuous Checkpoint自动保存、Context Recovery自动恢复、Review Readiness Dashboard可视化
- 代价：重量级（23+ skills + 8 tools）；artifact分散在多个路径

**ECC是混合范式**：行为塑造（skills）+ 外部控制（hooks, GATE）+ agent委托（67 agents）。delivery-gate是唯一的机械化阻断——用regex/mtime/disk等确定性检查，不依赖AI推理。

**mattpocock也是混合范式**：行为塑造（skills）+ 用户编排（不拥有流程）。

### 2.2行为塑造的通用技巧

从后续六篇的逐节点分析中，可以提炼出Superpowers行为塑造的通用技巧——这些技巧不依赖特定工具，纯Markdown即可实现：

**1. Rationalization表**
- 列出AI逃避流程的所有借口，每个借口附带"现实对照"
- 示例（来自verification-before-completion）：
  - "should work now" → RUN the verification
  - "I'm confident" → Confidence ≠ evidence
  - "Agent said success" → Verify independently
- 在第八篇（Explore）、第十一篇（Execute）、第十二篇（Verify）中反复出现

**2. "Spirit vs Letter"**
- 不是"遵守字面规则"而是"理解规则的精神"
- 示例：mattpocock的TDD是reference-only skill——"the loop is anchored by leading words the model already holds"，不提供step-by-step workflow但依赖AI内化的TDD精神

**3. 禁止vs食谱**
- 不同类型的失败需要不同形式的指导
- "Match the Form to the Failure"（Superpowers的设计哲学）：
  - 对于"跳过流程"的失败 → 禁止 + Rationalization表
  - 对于"不知道怎么做"的失败 → 正面食谱（step-by-step）
  - 对于"格式不对"的失败 → 结构模板
  - 对于"条件判断错误"的失败 → 条件分支

**4. Micro-test wording**
- 在跑完整压力测试前，先用5+ 样本验证措辞
- Superpowers的94% PR拒绝率部分归因于严格的micro-test

**5. Red Flags**
- 列出agent行为中的"红旗信号"——如使用 "should" / "probably" / "seems to"
- 在验证前表达满意（"Great!" / "Perfect!" / "Done!"）是Red Flag

**实践方向**：这些技巧是工具无关的——无论用skill、CLI还是纯文档，都可以应用。Rationalization表可能是最有效的单一技巧——它直接针对AI最常见的失败模式（"自我合理化"）。但Rationalization表的维护成本不低——Superpowers的24 failure memories来自真实失败案例，需要持续积累。

### 2.3什么环节可能需要工具化？

从5个项目的实践来看，工具化在以下环节价值最高：

**高价值工具化（确定性检查 > AI推理）：**
- **Spec格式验证**（OpenSpec的validator.ts）：程序化检查格式比AI自检更确定
- **Delivery Gate**（ECC的delivery-gate hook）：regex匹配rationalization文本、mtime检查文件更新——hook 100% 触发，不依赖AI
- **Delta合并**（OpenSpec的archive.ts）：程序化合并比手动合并更可靠
- **Build/Type/Lint/Test**（ECC的verification-loop）：确定性命令比AI判断更可信

**中等价值工具化（AI推理有优势但工具可以补充）：**
- **Code review**（ECC的PostToolUse hooks vs Superpowers的reviewer subagent）：hook检查格式/类型（确定性），subagent检查结构性问题（AI推理）
- **Spec质量评分**（gstack的Codex quality gate）：跨模型评分发现单模型盲区
- **Plan completion audit**（gstack的Plan Completion Audit）：程序化对照plan检查完成度

**低价值工具化（纯约定可能就够）：**
- **Explore交互模式**（Socratic对话vs自由对话）：不需要工具
- **Commit策略**（每步commit vs完成后commit）：约定即可
- **Worktree清理**（Superpowers的provenance-based cleanup）：约定即可

**实践方向**：工具化的核心判断标准是"确定性检查是否优于AI推理"。对于格式验证、构建检查、合并操作等确定性任务，工具化价值最高。对于代码质量审查、设计合理性判断等需要推理的任务，AI推理更有优势——但可以用工具作为补充（如hook确保底线，skill提升上限）。纯约定（无工具）适合交互模式和commit策略等行为约定——但如果agent不遵守，约定就形同虚设。

### 2.4纯Markdown vs工具强制的tradeoff

这是一个贯穿所有节点的基本张力：

**纯Markdown（Superpowers, mattpocock）**：
- 优势：零工具依赖、跨平台、低门槛、易于修改
- 代价：遵守依赖agent自律（skill触发率50-80%）；无法程序化验证；无法自动合并

**工具强制（OpenSpec, ECC hooks, gstack tools）**：
- 优势：确定性高（hook 100% 触发）、可程序化验证、可自动合并
- 代价：工具依赖、平台限制、门槛高、修改需要改代码

**实践方向**：纯Markdown和工具强制不是二选一——可以分层。核心行为约束用纯Markdown（Rationalization表、Iron Law），格式验证和机械化检查用工具（validator、delivery-gate hook）。Superpowers + OpenSpec的组合（如 `superpowers-bridge` 社区schema）正是这个思路——OpenSpec管spec治理（工具化），Superpowers管执行纪律（行为塑造）。但分层也增加了复杂度——用户需要同时理解两套系统。

---

## 3. Context管理

### 3.1 Context的三层挑战

AI辅助研发流程中的context管理面临三层挑战：

**1. Token效率——每个skill加载到session的成本**
- Superpowers的14个skills不会同时加载——`using-superpowers` bootstrap机制按需触发
- gstack的preamble在每个skill开始时注入Context Recovery——但这增加了token消耗
- OpenSpec的explore不产出artifact——探索结果留在context window中，context compaction后丢失

**2. 跨task / 跨session的状态传递**
- Superpowers：File handoffs（task-brief, report, review-package通过文件传递）+ Progress Ledger（compaction后恢复）
- gstack：Continuous Checkpoint（WIP commit自动保存Decisions/Remaining/Tried）+ Context Recovery（preamble读取磁盘artifact）
- OpenSpec：change文件夹（artifact在文件系统中持久化）
- mattpocock：handoff（手动触发的context传递，保存到临时目录）
- ECC：task_list（handoff artifact驱动实现循环）

**3. Subagent之间的信息隔离**
- Superpowers：fresh subagent per task——controller和implementer不共享context，只通过文件交换信息
- mattpocock：code-review用parallel sub-agents——两个轴独立运行，报告不合并
- gstack：Conductor并行sprint——每个sprint在隔离workspace
- 其他：无subagent隔离

### 3.2 Context管理策略对比

| 策略 | 代表项目 | 自动化程度 | 适用场景 |
|------|---------|-----------|---------|
| **File handoffs + Progress Ledger** | Superpowers | 结构化（controller维护） | 长任务序列（多个task在同一plan下执行） |
| **Continuous Checkpoint + Context Recovery** | gstack | 全自动 | 并行sprint + 长running任务 |
| **Change文件夹持久化** | OpenSpec | 半自动（CLI命令） | 需要spec持续演进的项目 |
| **Handoff文档** | mattpocock | 手动 | 跨session传递对话状态 |
| **无context管理** | OpenSpec (explore), ECC (无显式机制) | 无 | 短任务、单session |

**实践方向**：Context管理的自动化程度应该与任务序列长度匹配——短任务（1-2个task）不需要context管理，长任务需要自动机制。gstack的Continuous Checkpoint + Context Recovery是最完整的方案——自动保存、自动恢复、WIP commit过滤保持bisect干净。Superpowers的File handoffs + Progress Ledger是为subagent隔离设计的——如果不用subagent，这个方案的必要性降低。

关键洞察：**artifact持久化是context管理的基础**。无论是Superpowers的file handoffs、gstack的Continuous Checkpoint还是OpenSpec的change文件夹——核心思想都是"将重要信息写入文件系统，而非依赖context window"。这是因为context window会compaction、会丢失，而文件系统不会。

### 3.3 Subagent隔离的取舍

第十一篇深入讨论了subagent隔离的tradeoff。综合来看：

**Subagent隔离的优势**：
- 避免context pollution（前面task的错误信息不干扰后面task）
- Controller context保留用于协调（不被实现细节淹没）
- 可以按task选模型（简单task用便宜模型，判断task用强模型）

**Subagent隔离的代价**：
- 更多subagent调用成本
- File handoffs增加复杂度（生成task-brief、读取report、组装review-package）
- Controller需要更多prep work

**Superpowers SDD演进的教训**：
- v4→v5：subagent review loop → inline self-review（25min → 30s，质量相当）——不是所有环节都需要subagent
- v5→v6：两个reviewer → 一个reviewer（成本减半，质量不降）——subagent数量可以优化
- v6：file handoffs替代pasted text——"a pasted diff parks itself permanently in the most expensive context"

**实践方向**：Subagent隔离适合长任务序列（多个task需要在同一plan下执行）——避免context在多个task间累积。对于短任务（1-2个task），单context足够。Superpowers v4→v6的演进表明，subagent的使用应该精简——不是"越多越好"，而是"在必要时使用"。inline self-review替代subagent review loop的教训表明，30秒的自检可以替代25分钟的subagent review——这对context管理有重要启示。

---

## 4. 角色与协作

### 4.1角色数量的边界

第七篇的分析表明，角色数反映了流程的"分工程度"：

| 项目 | 角色数 | 分工方式 |
|------|-------|---------|
| Superpowers | 3 | controller（协调）+ implementer（实现）+ reviewer（审查） |
| OpenSpec | 1 | AI agent + 人类（无角色分工） |
| ECC | 67 agents | 按语言/功能/角色专门化（12语言reviewer + 15角色专家 + ...） |
| mattpocock | 1-2 | AI agent + 可选subagent（code-review双轴） |
| gstack | 8+ | CEO / Eng Manager / Designer / DX Lead / Staff Engineer / QA / Security / Release / SRE |

但实际在单个流程实例中活跃的角色通常在2-3个。ECC的67个agents是"素材库"——用户按需选择，不是每次都用全部。gstack的8+ 个角色分散在不同sprint阶段——单个sprint实例中活跃的角色也在2-3个。

**关键洞察**：角色分工的价值在于"认知隔离"——不同角色关注不同维度，避免一个角色同时做实现和审查（利益冲突）。但角色过多会增加协调开销。某研发流程尝试的10角色教训表明，角色数超过3-4个后，协调成本会急剧上升。

**实践方向**：核心角色应控制在 ~3个以内——一个"执行者"、一个"审查者"、一个"协调者"（可选）。gstack的多角色审查（CEO + Eng + Design + DX）是独特的——适合需要多维度评估的大型变更，但对中小型变更过重。Superpowers的3角色（controller + implementer + reviewer）可能是最平衡的分工——足够隔离但不过度。

### 4.2 Human-in-the-Loop的分布

5个项目在人工检查点的分布上形成了光谱：

| 项目 | 人工检查点 | 自动化程度 |
|------|-----------|-----------|
| Superpowers | Explore审查（user review gate）| 行为强制（HARD-GATE + Iron Law），无人工GATE |
| OpenSpec | Review（人工读Markdown）| 半自动（CLI命令驱动，verify不阻断） |
| ECC | GATE 1（Plan审批）+ GATE 2（Commit确认）| "Gated, not autonomous" |
| mattpocock | 用户编排（决定何时调用skill）+ tickets审查 | 低自动化（用户驱动） |
| gstack | taste decisions（plan阶段）+ stop条件（ship阶段）| 高自动化（全自动ship） |

**关键观察**：
1. **Superpowers是"行为强制但无人工GATE"**——流程一旦启动就自动运行到结束，但每步都有行为约束。这意味着流程纪律依赖agent遵守skill约束，而非人类审批。
2. **ECC是"人工GATE最明确"**——两个GATE在关键节点（Plan后 + Commit前）要求人类确认。这是"阀门"模式——不阻断执行但要求人类确认。
3. **gstack是"高自动化但有人工stop条件"**——/ship全自动执行，但遇到特定条件（merge conflict、test failure、ASK items）时STOP。
4. **OpenSpec和mattpocock是"用户驱动"**——不强制人工检查点，依赖用户自律。

**实践方向**：人工检查点应该分布在"方向决策"和"质量确认"两个关键位置——对应ECC的GATE 1（Plan后，方向决策）和GATE 2（Commit前，质量确认）。Superpowers的"无人工GATE"模式适合信任度高的场景（如个人开发 + AI agent），ECC的"双GATE"模式适合需要质量保障的场景。持续执行vs人工检查点的平衡应该按风险等级调节——低风险变更可以全自动，高风险变更需要人工审批。

### 4.3持续执行vs暂停确认

Superpowers的"持续执行"原则——不在task之间暂停问"要不要继续"——是一个重要的设计决策。它的逻辑是：如果plan已经批准，执行就应该连续进行，暂停只会增加延迟而不增加价值。

但这与ECC的"Gated, not autonomous"和gstack的stop条件形成对比。

**持续执行的优势**：
- 减少latency——不在task之间等待用户响应
- 保持context连贯性——暂停后context可能被compaction
- 适合个人开发场景（用户可能离开后回来）

**持续执行的代价**：
- 如果plan方向错误，浪费的是完整执行的成本
- 用户无法在中间介入修正

**实践方向**：持续执行的前提是plan质量足够高——如果plan经过充分审查（如ECC的GATE 1或gstack的多角色审查），持续执行的风险就降低了。Superpowers没有人工plan审批但依赖brainstorming的HARD-GATE和writing-plans的self-review——这是另一种保障plan质量的方式。一个可能的实践方向是：在plan审批后持续执行，但在review发现Critical问题时暂停（如Superpowers的per-task review gate）。

---

## 5. 实践方向的综合提炼

### 5.1各节点反复出现的核心张力

从后续六篇的逐节点讨论中，可以提炼出贯穿所有节点的核心张力：

| 节点 | 核心张力 | 两端 | 可能的平衡点 |
|------|---------|------|-----------|
| Explore | 强制vs自由 | HARD-GATE（Superpowers）vs自由对话（OpenSpec） | 按风险等级调节（ECC的两种深度） |
| Spec | 结构化vs自由格式 | Requirement+Scenario（OpenSpec）vs自由Markdown（Superpowers） | 分层结构化（spec结构化 + design自由） |
| Plan | 精细vs粗粒度 | bite-sized 2-5min（Superpowers）vs tracer-bullet一个context window（mattpocock） | 与执行者匹配（subagent需细粒度，完整context需粗粒度） |
| Execute | 强制纪律vs信任agent | Iron Law + SDD（Superpowers）vs纯checkbox（OpenSpec） | 按变更类型匹配（逻辑变更强制TDD，UI/配置不强制） |
| Review | 阻断vs信息 | per-task gate（Superpowers）vs人工扫一眼（OpenSpec） | 分层（per-task gate + final review） |
| Verify | 独立vs嵌入 | 独立skill + Iron Law（Superpowers）vs嵌入implement TDD（mattpocock） | 组合（delivery-gate式hook确保 + Iron Law式skill提升） |
| Archive | spec闭环vs知识归档 | delta合并（OpenSpec）vs instinct提取（ECC） | 两者正交——可同时需要 |

**关键洞察**：每个节点的核心张力都不是"二选一"而是"光谱上的位置选择"。实践方向不是选择某一端，而是找到适合具体场景的平衡点。而平衡点的选择应该基于三个因素：
1. **变更风险等级**：高风险 → 偏强制端，低风险 → 偏自由端
2. **执行者能力**：subagent → 需细粒度，完整context agent → 粗粒度够
3. **项目生命周期**：长期维护 → 需要spec持续演进，短期项目 → 一次性spec够

### 5.2反复出现的有效实践模式

从后续六篇的讨论中，以下实践模式被多个项目独立验证为有效：

**1. 事实/决策分离**
- ECC和mattpocock都实现了：能从代码推断的技术事实agent自己查，产品/业务约束必须问用户
- 价值：减少交互成本、明确责任边界、防止agent替用户做决策
- 适用：Explore节点（但原则可扩展到所有节点）

**2. Progressive Rigor（渐进式rigor）**
- ECC的Quick Capture vs Full Brief、OpenSpec的Lite spec vs Full spec
- 价值：低风险变更不延迟，高风险变更有保障
- 适用：Explore、Spec、Verify节点

**3. Rationalization防御**
- Superpowers的Rationalization表、Red Flags
- 价值：直接针对AI最常见的失败模式（自我合理化）
- 适用：Execute（TDD逃避）、Verify（虚假完成声明）、Review（跳过审查）

**4. File handoffs（artifact以文件传递）**
- Superpowers的task-brief/report/review-package、OpenSpec的change文件夹、gstack的 ~/.gstack/ artifact
- 价值：跨session持久化、抗context compaction、subagent间信息隔离
- 适用：所有节点的artifact传递

**5. 分层审查**
- Superpowers的per-task + whole-branch、OpenSpec的propose后 + apply后
- 价值：per-task保证早期发现，final/apply后保证全局一致性
- 适用：Review节点

**6. 机械化检查 + AI推理互补**
- ECC的delivery-gate（hook 100% 触发）+ code-reviewer（AI推理）
- 价值：hook确保底线（格式、rationalization文本），AI推理提升上限（结构性问题）
- 适用：Verify、Review节点

**7. Scope drift检测**
- gstack的Plan Completion Audit、mattpocock的Spec轴、OpenSpec的propose后审查
- 价值：防止AI"多做一点"（scope creep）或"少做一点"（missing requirements）
- 适用：Review节点（但最早可在Spec阶段检测）

**8. 质量保障必须放入agent实际遵循的结构**
- Superpowers #677的教训：spec review步骤只存在于prose中，但agent跟随checklist和process flow diagram而非prose——导致spec review被完全跳过
- 修复：将质量保障步骤添加到checklist和dot graph中
- 价值：确保质量条款不只是"写了"而是"被遵循"——agent对checklist/diagram的遵循可靠性远高于prose
- 适用：所有节点的质量保障步骤

**9. 高价值功能应默认开启**
- gstack的outside voice（Codex跨模型审查）最初需要手动opt-in——大多数用户不知道有这个选项，错过了跨模型审查的价值
- 修复：改为自动运行——"跨 /review、/ship、/plan-ceo-review、/plan-eng-review、/plan-design-review、/plan-devex-review、/document-release和 /autoplan的Codex review。plan-review的outside voice自动运行。"
- 价值：减少用户认知负担——让用户opt-out而非opt-in
- 适用：Explore（brainstorming）、Verify（独立验证）、Plan（跨模型审查）等高价值但非强制步骤

**10. 安全检查应fail closed**
- gstack的 `/ship` pre-push guard在git error时最初fail open——secret可能泄漏
- 修复：改为fail closed——"现在在git error时fail closed"
- 价值：安全检查在error时应该fail closed而非fail open——fail open等于没有检查
- 适用：Verify节点的安全相关检查（secret redaction、adversarial review等）

### 5.3被证伪或存疑的实践

**1. 过多角色协调**
- 某研发流程尝试的10角色教训：角色数超过3-4个后，协调成本急剧上升
- gstack的8+ 角色在中小型变更中过重——autoplan的encoded decision principles是缓解但非解决

**2. 过多流程步骤**
- 某研发流程尝试的38 phase失败教训：步骤数超过 ~7步后，agent偏离概率急剧上升
- 5个项目的显式步骤数都集中在5-7步——这是自然边界

**3. 评分阈值**
- 某研发流程尝试的三层验证 + 评分阈值教训：假精确——评分看起来客观但实际依赖AI主观判断
- gstack的7/10门槛也有类似风险——"7/10"看起来精确但实际是AI主观评分
- 替代方案：Superpowers的"通过/不通过 + 具体问题"更诚实

**4. subagent review loop**
- Superpowers v4→v5教训：25分钟的subagent review loop没有比30秒的inline self-review更好
- 启示：不是所有环节都需要subagent——自检可能足够

**5. 过度结构化**
- 某研发流程尝试的Contract DSL教训：过度结构化的spec格式增加了编写成本但未显著提升质量
- OpenSpec的结构化格式（Requirement + Scenario）是合理的——因为它支持程序化解析和Delta合并。但如果不需要程序化解析，结构化的价值就大打折扣

**6. TDD的step-by-step workflow冗余**
- mattpocock的教训：TDD skill原本有完整的step-by-step Workflow和per-cycle checklist——但red-green循环是AI已经内化的，step-by-step只是重复
- 修复：重塑为reference-only skill——"删除了Workflow和per-cycle checklist；将它们唯一持久有效的理念——垂直切片 / tracer bullets——折叠到Anti-patterns部分和一个简短的Rules-of-the-loop列表中"
- 启示：对于AI已内化的方法论，提供reference（规则、anti-patterns）比提供workflow（step-by-step）更有效

**7. TDD包含refactor阶段导致职责不清**
- mattpocock的教训：TDD原本包含refactor阶段（Red → Green → Refactor）——但refactor属于review阶段，放在TDD中导致职责不清
- 修复：删除refactor阶段——"TDD现在是red → green；refactoring属于review阶段，因此refactor规则和refactoring.md已移出（它的归属是code-review）"
- 启示：TDD应聚焦于Red-Green（写测试 + 实现），refactor移到Review——这简化了TDD循环，使职责更清晰

### 5.4仍未解决的问题

**1. "风险等级由谁判断？"**
- Progressive Rigor需要判断变更的风险等级——但由谁判断？
- 如果是agent判断，可能误判（尤其是对业务影响不敏感）
- 如果是用户判断，可能低估风险（"这只是一个简单的改动"）
- OpenSpec的方案：用户决定用Lite spec还是Full spec。ECC的方案：Size classifier自动判断（trivial跳过plan）。两者都没有完美解决。

**2. "纯Markdown约定的遵守度"**
- 纯Markdown的优势是零工具依赖——但如果agent不遵守，约定就形同虚设
- Superpowers的skill触发率约50-80%（vs hook 100%）——这意味着20-50% 的情况下agent可能跳过
- ECC的delivery-gate用hook解决了这个问题——但hook是平台特定的
- 纯Markdown如何提高遵守度？目前没有项目给出完美答案

**3. "Spec腐化的处理"**
- 即使有Delta机制（OpenSpec），spec也可能与代码不一致——如果开发者改了代码但忘了更新spec
- OpenSpec的verify检查spec与代码的一致性，但基于启发式推理（关键词搜索），不是确定性证明
- 定期spec审计是一种可能的解决方案——但谁来做？什么时候做？成本如何？

**4. "手动Delta合并的可持续性"**
- OpenSpec的Delta合并是程序化的——但需要结构化spec + validator + 合并工具
- 如果不用工具（纯Markdown），Delta合并需要手动——这在spec数量增加后是否可持续？
- 目前没有项目在纯Markdown下实现Delta合并——这是一个未解决的挑战

**5. "跨模型审查的成本效益"**
- gstack的跨模型审查需要两个AI服务——成本翻倍
- 价值：消除单模型偏差——Claude和Codex可能系统性地忽略不同类型问题
- 但"两个模型可能共享同一个盲区"——跨模型不等于无盲区
- 成本效益的平衡点在哪里？目前没有项目给出定量分析

**6. "Context compaction后的恢复可靠性"**
- Superpowers的Progress Ledger和gstack的Continuous Checkpoint都试图解决context compaction后的恢复
- 但恢复的可靠性如何？如果Progress Ledger或WIP commit本身不完整怎么办？
- 目前没有项目给出compaction后恢复成功率的定量数据

---

## 6. 一个全面轻量的研发流程的可能形态

综合以上讨论，一个全面轻量的AI辅助研发流程可能具备以下特征。这是综合平衡方案的最终形态探讨——取各家之长，避已知弯路，舍部分深度。

### 6.1流程结构

- **7个节点**：Explore → Spec → Plan → Execute → Review → Verify → Archive
- **步骤数 ≤ ~7步**：在AI可靠执行的范围内
- **核心角色 ≤ ~3个**：执行者 + 审查者 + 协调者（可选）
- **按风险等级调节深度**：低风险变更轻量化，高风险变更全流程
- **Brownfield支持**：Delta机制 + 系统理解子能力

### 6.2约束机制

- **行为塑造 + 工具强制分层**：核心行为约束用纯Markdown（Rationalization表、Iron Law），格式验证和机械化检查用工具（validator、hook）
- **Rationalization防御**：在每个关键节点列出AI可能的"跳过"借口及现实对照
- **质量保障放入agent实际遵循的结构**：不只在prose中描述，必须出现在checklist、diagram或其他agent实际遵循的结构中（Superpowers #677教训）
- **机械化检查确保底线**：hook 100% 触发的确定性检查（如delivery-gate），安全检查fail closed（gstack教训）
- **AI推理提升上限**：subagent或inline self-review检查结构性问题
- **高价值功能默认开启**：跨模型审查、独立验证等高价值步骤opt-out而非opt-in（gstack教训）
- **人工GATE在关键位置**：Plan后（方向决策）+ Commit前（质量确认）

### 6.3 Context管理

- **artifact以文件传递**：不依赖context window持久化重要信息
- **自动context保存**：类似gstack的Continuous Checkpoint或Superpowers的Progress Ledger
- **subagent隔离在长任务序列中使用**：短任务单context足够
- **inline self-review优先于subagent review**：30秒自检可能足够（Superpowers v5教训）

### 6.4各节点的实践方向

| 节点 | 实践方向 | 关键tradeoff |
|------|---------|-------------|
| Explore | 事实/决策分离 + 按风险调节深度 | 强制（防方向错误）vs自由（低门槛） |
| Spec | 分层结构化（行为契约结构化 + 设计文档自由）+ Delta机制 + 质量保障放入结构 | 结构化（可验证可合并）vs自由格式（低编写成本） |
| Plan | 描述"做什么"和"关键设计决策"而非完整代码 + Global Constraints | 精细（消除歧义）vs粗粒度（保护TDD） |
| Execute | TDD按变更类型匹配（Red-Green，不含Refactor）+ subagent隔离在长任务中使用 + 自动context保存 | 强制纪律（质量保障）vs信任agent（效率） |
| Review | 分层审查（per-task + final）+ scope drift检测 + 审查者独立性 + refactor归属此阶段 | 阻断（早期发现）vs信息（不延迟） |
| Verify | 机械化检查（hook，fail closed）+ AI推理（skill）互补 + evidence before claims | 独立（确定性）vs嵌入（轻量） |
| Archive | spec闭环（Delta合并）+ 知识归档（learnings）+ 分支管理 | spec持续演进（长期价值）vs一次性spec（简单） |

### 6.5舍弃了什么

综合平衡意味着有取有舍。以下是这个方案相比各参考项目舍弃的部分，以及舍弃的理由：

**舍弃了Superpowers的绝对行为约束纪律**
- Superpowers对所有变更强制HARD-GATE + Iron Law——即使简单变更也走完整流程
- 我们选择按风险等级调节深度——低风险变更可以跳过部分步骤
- 代价：放弃了"所有变更都走完整流程"的纪律保障。如果风险判断失误，低风险变更可能遗漏关键步骤
- 理由：简单变更走完整流程的延迟成本（Superpowers的过重问题）超过了纪律收益

**舍弃了OpenSpec的完整Delta工具链**
- OpenSpec有validator.ts（程序化格式验证）+ archive.ts（程序化Delta合并）——spec治理完全工具化
- 我们选择纯Markdown + 手动合并——降低工具依赖和使用门槛
- 代价：放弃了程序化验证和自动合并的确定性。spec格式错误不会被自动捕获，Delta合并需要手动操作
- 理由：工具链的编写和维护成本较高，在spec数量不大的场景下手动操作的负担可以接受

**舍弃了ECC的67 agents专门化覆盖**
- ECC有12种语言reviewer + 15角色专家 + 功能agents——几乎每个场景都有专门化agent
- 我们选择 ~3个核心角色——执行者 + 审查者 + 协调者
- 代价：放弃了语言/功能/角色的精细分工。TypeScript审查和Python审查用同一个reviewer，而不是专门的typescript-reviewer和python-reviewer
- 理由：67 agents的协调成本和维护负担对中小型项目过重。2-3个角色的分工已足够实现认知隔离

**舍弃了mattpocock的极度简洁**
- mattpocock的implement skill只有16行——极度精简，依赖AI内化习惯
- 我们增加了约束层（Rationalization表、质量保障结构、人工GATE）——比mattpocock更重
- 代价：放弃了极致轻量。用户需要理解更多约束规则，流程启动成本更高
- 理由：mattpocock的简洁依赖用户的专家判断和AI的充分训练——在通用场景下，缺乏约束可能导致质量失控

**舍弃了gstack的全自动化ship + 浏览器QA**
- gstack的 `/ship` 全自动执行（review → test → push → merge），且有浏览器端QA
- 我们保留人工GATE（Plan后 + Commit前）——不追求全自动执行
- 代价：放弃了全自动执行的效率。人工GATE增加了延迟
- 理由：全自动执行的前提是流程纪律足够高——在约束机制还不完善的阶段，人工检查点是安全底线

### 6.6未解决的挑战

一个全面轻量的研发流程需要诚实面对未解决的问题：
- 风险等级由谁判断？
- 纯Markdown约定的遵守度如何提高？
- Spec腐化如何检测和处理？
- 手动Delta合并在纯Markdown下的可持续性？
- 跨模型审查的成本效益平衡点在哪里？
- Context compaction后恢复的可靠性如何验证？

这些问题的答案可能需要在实际使用中逐步探索——这正是后续文章将要讨论的主题。

---
