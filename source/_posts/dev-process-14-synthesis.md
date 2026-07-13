---
title: AI 研发流程深度解析（十四）：综合总结——一个全面轻量的研发流程应该是怎样的
description: 综合各家的特色对比和逐节点深入分析，提炼全面轻量的 AI 辅助研发流程整体形态，明确各节点如何协作及需要什么约束机制。
tags:
  - 研发流程
  - 综合总结
  - 流程设计
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-13
> **核心问题：** 综合各家的特色对比和逐节点深入分析，一个全面轻量的 AI 辅助研发流程整体上应该是怎样的？各节点如何协作？需要什么约束机制？舍弃了什么？

---

## 引言

第七篇定义了 7 个通用节点（Explore → Spec → Plan → Execute → Review → Verify → Archive），后续六篇逐个节点对比了 5 个项目的设计差异和 tradeoff。本篇是综合平衡方案的最终形态探讨——从各家的特色对比和逐节点深入分析中提炼整体性的方案，明确我们选择了什么、放弃了什么、以及为什么。

需要强调：五个参考项目各自在自己的场景中都是合理的设计——Superpowers 在行为约束上最深入，OpenSpec 在 spec 治理上最独创，ECC 在场景覆盖上最丰富，mattpocock 在方法论轻量性上最精炼，gstack 在流程完整性上最全面。我们试图探索的，是在"全面覆盖"和"轻量使用"之间的一种综合平衡——取各家之长，避已知弯路，舍部分深度。这个平衡在某些方面不如专门优化的项目，但综合起来没有明显短板。

---

## 1. 流程整体框架

### 1.1 7 个节点的普遍性

第七篇的分析表明，尽管 5 个项目的规模差异巨大（mattpocock ~20 skills vs gstack 23+ skills + 8 tools），它们的流程都能映射到 7 个通用节点上。这不是巧合——7 个节点对应了软件研发的基本活动：

| 节点 | 基本问题 | 不可跳过的理由 |
|------|---------|-------------|
| **Explore** | 要解决什么问题？ | 跳过 → 方向错误，最高代价 |
| **Spec** | 系统应该做什么？ | 跳过 → 无验证基准，review 无依据 |
| **Plan** | 按什么顺序做？ | 跳过 → 执行混乱，依赖管理失控 |
| **Execute** | 实现代码 | 不可跳过（核心活动） |
| **Review** | 代码合格吗？ | 跳过 → 质量、安全、需求忠实度无保障 |
| **Verify** | 真的能用吗？ | 跳过 → 虚假完成声明，信任破裂 |
| **Archive** | 如何收尾？ | 跳过 → 分支残留、spec 过时、知识丢失 |

但"不可跳过"不意味着"必须重度执行"——节点的重要性在于"被思考过"而非"被完整走完"。OpenSpec 的"Enablers not Gates"哲学正是这个意思：每个节点都是一个"使能器"——它使你能做下一件事，但不阻止你跳过。

### 1.2 核心节点 vs 按需节点

从 5 个项目的实践中，可以提炼出节点的"必要性层次"：

**核心节点（所有项目都重度实现）：**
- **Spec**：所有项目都产出某种形式的设计/规格文档。这是"做什么"的定义——没有它，后续一切都失去基准。
- **Execute**：所有项目都实现代码。这是核心活动。
- **Review**：所有项目都有某种形式的代码审查。这是质量的基本保障。

**重要节点（所有项目都有但实现差异大）：**
- **Explore**：所有项目都有某种形式的"从模糊到精确"，但从 HARD-GATE 到自由对话差异极大。
- **Plan**：所有项目都将 spec 转化为任务，但从 bite-sized steps 到 tracer-bullet tickets 粒度差异达一个数量级。
- **Verify**：所有项目都有验证步骤，但从 Iron Law 到嵌入 TDD 独立性差异明显。

**闭环节点（差异最大的节点）：**
- **Archive**：从 OpenSpec 的 delta 合并到 mattpocock 的简单 commit，闭环深度差异极大。只有 OpenSpec 实现了 spec 的持续演进。

**实践方向**：核心节点（Spec、Execute、Review）应该有最低保障——即使最轻量的流程也不能完全跳过。重要节点（Explore、Plan、Verify）可以按风险等级调节深度。闭环节点（Archive）的价值在长期维护的项目中最大——短期项目可以轻量化。

### 1.3 步骤数的自然边界

第七篇的分析揭示了一个有趣的趋势——尽管项目规模差异巨大，显式步骤数都集中在 5-7 步：

| 项目 | 显式步骤数 | 角色数 |
|------|----------|-------|
| Superpowers | ~7 步 | 3（controller, implementer, reviewer） |
| OpenSpec | ~6 步 | 1（AI agent + 人类） |
| ECC | ~6 Phase + 2 GATE | 67 agents（但 pipeline 只有 6 Phase） |
| mattpocock | ~5 步 | 1-2（AI agent + 可选 subagent） |
| gstack | ~7 阶段 | 8+（但 sprint 只有 7 阶段） |

**关键洞察**：AI 研发流程的自然复杂度大约在 5-7 个节点。更多节点会增加认知负担和流程偏离风险（如某研发流程尝试的 38 phase 失败教训），更少节点会缺失关键环节。角色数也趋同——尽管 ECC 有 67 个 agents 和 gstack 有 8+ 个工程角色，实际在单个流程实例中活跃的角色通常在 2-3 个（如 Superpowers 的 controller + implementer + reviewer）。

**实践方向**：流程步骤应控制在 ~7 步以内，核心角色应控制在 ~3 个以内。这并不意味着不能有更多的 skills 或 agents——而是指单个变更流程实例中，实际执行的步骤和活跃的角色应该在这个范围内。ECC 的 67 个 agents 是"素材库"而非"流程步骤"——用户按需选择，不是每次都用全部。

### 1.4 "Enablers not Gates" 在实践中意味着什么

OpenSpec 的"Enablers not Gates"是一个重要的设计哲学——依赖表示"使能"而非"门禁"。但 5 个项目的实践表明，完全无 gate 的流程存在风险：

- **OpenSpec 自身**：verify 明确"不阻断"，但用户可以忽略所有警告直接 archive，导致 spec 与代码不一致
- **mattpocock**：不拥有流程，用户完全自主——但缺乏质量保障
- **Superpowers**：HARD-GATE + Iron Law 强制每个节点——但简单变更也走完整流程（过重）

**实践方向**：纯 gate（Superpowers）和纯 enabler（OpenSpec）都不是最优——按风险等级调节可能是更平衡的方向。低风险变更用 enabler 模式（可以跳过），高风险变更用 gate 模式（不可跳过）。ECC 的 Size classifier（trivial 跳过 plan）和 OpenSpec 的 Progressive Rigor（Lite spec vs Full spec）都在这个方向上探索。但"风险等级由谁判断"本身是一个需要回答的问题——如果是 agent 判断，可能误判；如果是用户判断，可能低估风险。

### 1.5 Brownfield vs Greenfield 的流程路径

第七篇和第九篇都讨论了 Brownfield 和 Greenfield 的差异。综合来看：

**Greenfield 路径**：
```
Explore（产品方向 + 架构选择）→ Spec（从零描述系统）→ Plan → Execute → Review → Verify → Archive
```

**Brownfield 路径**：
```
（系统理解）→ Explore（变更意图）→ Spec（Delta：只描述变更）→ Plan → Execute → Review → Verify → Archive（Delta 合并回 source of truth）
```

Brownfield 路径的关键差异：
1. **需要"系统理解"子能力**：在 Explore 之前或之中，需要分析现有系统、确定影响范围。mattpocock 的 CONTEXT.md（共享词汇）和 ECC 的 codebase-onboarding 是两个不同方向的探索。
2. **Delta 机制的价值凸显**：只描述变更而非重述全部。OpenSpec 是唯一将 Brownfield 作为 first-class 概念的项目。
3. **Source of Truth 的长期价值**：spec 随变更有机增长，不会过时。

**实践方向**：Brownfield 场景可能需要在 Explore 和 Spec 之间增加一个"系统理解"子能力——不是独立节点，而是 Explore 的 Brownfield 扩展。这个子能力需要：构建共享词汇（mattpocock 的 CONTEXT.md 方向）、分析影响范围、理解现有行为。Delta 机制在 Brownfield 场景下的价值是显著的——但它的采用成本较高（需要结构化 spec + validator + 合并工具）。

---

## 2. 约束机制

### 2.1 三种流程控制范式

第七篇提炼了三种流程控制范式，后续六篇的逐节点分析进一步验证了这三种范式的特征：

**范式一：行为塑造（Superpowers）**
- 通过 SKILL.md 中的指令塑造 agent 行为——Iron Law、Rationalization 表、Red Flags
- 纯 Markdown 驱动，不依赖外部工具
- 强制程度最高——agent 被"绑定"到流程中
- 关键设计：HARD-GATE 阻止跳过探索、Iron Law 阻止虚假完成声明、Rationalization 表防御所有"跳过"借口
- 代价：简单变更也走完整流程（过重）；skill 触发率约 50-80%（不如 hook 100%）

**范式二：Artifact 治理（OpenSpec）**
- 通过结构化 artifact（change 文件夹 + delta specs）和 CLI 工具治理流程
- Artifact 是 source of truth——流程围绕 artifact 的创建、审查、合并展开
- 强制程度中等——工具验证 artifact 格式但不阻断用户行动
- 关键设计：validator 程序化验证格式、archive 程序化合并 delta、Artifact Graph 提供确定性查询
- 代价：编写成本高（需要理解结构化格式）；合并可能出错

**范式三：Sprint 链式（gstack）**
- 通过文件系统持久化 artifact + preamble 自动化 + Dashboard 可视化实现链式传递
- 每个 skill 的产出喂给下一个，形成流水线
- 强制程度中等——Dashboard 可视化但很少阻断
- 关键设计：Continuous Checkpoint 自动保存、Context Recovery 自动恢复、Review Readiness Dashboard 可视化
- 代价：重量级（23+ skills + 8 tools）；artifact 分散在多个路径

**ECC 是混合范式**：行为塑造（skills）+ 外部控制（hooks, GATE）+ agent 委托（67 agents）。delivery-gate 是唯一的机械化阻断——用 regex/mtime/disk 等确定性检查，不依赖 AI 推理。

**mattpocock 也是混合范式**：行为塑造（skills）+ 用户编排（不拥有流程）。

### 2.2 行为塑造的通用技巧

从后续六篇的逐节点分析中，可以提炼出 Superpowers 行为塑造的通用技巧——这些技巧不依赖特定工具，纯 Markdown 即可实现：

**1. Rationalization 表**
- 列出 AI 逃避流程的所有借口，每个借口附带"现实对照"
- 示例（来自 verification-before-completion）：
  - "should work now" → RUN the verification
  - "I'm confident" → Confidence ≠ evidence
  - "Agent said success" → Verify independently
- 在第八篇（Explore）、第十一篇（Execute）、第十二篇（Verify）中反复出现

**2. "Spirit vs Letter"**
- 不是"遵守字面规则"而是"理解规则的精神"
- 示例：mattpocock 的 TDD 是 reference-only skill——"the loop is anchored by leading words the model already holds"，不提供 step-by-step workflow 但依赖 AI 内化的 TDD 精神

**3. 禁止 vs 食谱**
- 不同类型的失败需要不同形式的指导
- "Match the Form to the Failure"（Superpowers 的设计哲学）：
  - 对于"跳过流程"的失败 → 禁止 + Rationalization 表
  - 对于"不知道怎么做"的失败 → 正面食谱（step-by-step）
  - 对于"格式不对"的失败 → 结构模板
  - 对于"条件判断错误"的失败 → 条件分支

**4. Micro-test wording**
- 在跑完整压力测试前，先用 5+ 样本验证措辞
- Superpowers 的 94% PR 拒绝率部分归因于严格的 micro-test

**5. Red Flags**
- 列出 agent 行为中的"红旗信号"——如使用 "should" / "probably" / "seems to"
- 在验证前表达满意（"Great!" / "Perfect!" / "Done!"）是 Red Flag

**实践方向**：这些技巧是工具无关的——无论用 skill、CLI 还是纯文档，都可以应用。Rationalization 表可能是最有效的单一技巧——它直接针对 AI 最常见的失败模式（"自我合理化"）。但 Rationalization 表的维护成本不低——Superpowers 的 24 failure memories 来自真实失败案例，需要持续积累。

### 2.3 什么环节可能需要工具化？

从 5 个项目的实践来看，工具化在以下环节价值最高：

**高价值工具化（确定性检查 > AI 推理）：**
- **Spec 格式验证**（OpenSpec 的 validator.ts）：程序化检查格式比 AI 自检更确定
- **Delivery Gate**（ECC 的 delivery-gate hook）：regex 匹配 rationalization 文本、mtime 检查文件更新——hook 100% 触发，不依赖 AI
- **Delta 合并**（OpenSpec 的 archive.ts）：程序化合并比手动合并更可靠
- **Build/Type/Lint/Test**（ECC 的 verification-loop）：确定性命令比 AI 判断更可信

**中等价值工具化（AI 推理有优势但工具可以补充）：**
- **Code review**（ECC 的 PostToolUse hooks vs Superpowers 的 reviewer subagent）：hook 检查格式/类型（确定性），subagent 检查结构性问题（AI 推理）
- **Spec 质量评分**（gstack 的 Codex quality gate）：跨模型评分发现单模型盲区
- **Plan completion audit**（gstack 的 Plan Completion Audit）：程序化对照 plan 检查完成度

**低价值工具化（纯约定可能就够）：**
- **Explore 交互模式**（Socratic 对话 vs 自由对话）：不需要工具
- **Commit 策略**（每步 commit vs 完成后 commit）：约定即可
- **Worktree 清理**（Superpowers 的 provenance-based cleanup）：约定即可

**实践方向**：工具化的核心判断标准是"确定性检查是否优于 AI 推理"。对于格式验证、构建检查、合并操作等确定性任务，工具化价值最高。对于代码质量审查、设计合理性判断等需要推理的任务，AI 推理更有优势——但可以用工具作为补充（如 hook 确保底线，skill 提升上限）。纯约定（无工具）适合交互模式和 commit 策略等行为约定——但如果 agent 不遵守，约定就形同虚设。

### 2.4 纯 Markdown vs 工具强制的 tradeoff

这是一个贯穿所有节点的基本张力：

**纯 Markdown（Superpowers, mattpocock）**：
- 优势：零工具依赖、跨平台、低门槛、易于修改
- 代价：遵守依赖 agent 自律（skill 触发率 50-80%）；无法程序化验证；无法自动合并

**工具强制（OpenSpec, ECC hooks, gstack tools）**：
- 优势：确定性高（hook 100% 触发）、可程序化验证、可自动合并
- 代价：工具依赖、平台限制、门槛高、修改需要改代码

**实践方向**：纯 Markdown 和工具强制不是二选一——可以分层。核心行为约束用纯 Markdown（Rationalization 表、Iron Law），格式验证和机械化检查用工具（validator、delivery-gate hook）。Superpowers + OpenSpec 的组合（如 `superpowers-bridge` 社区 schema）正是这个思路——OpenSpec 管 spec 治理（工具化），Superpowers 管执行纪律（行为塑造）。但分层也增加了复杂度——用户需要同时理解两套系统。

---

## 3. Context 管理

### 3.1 Context 的三层挑战

AI 辅助研发流程中的 context 管理面临三层挑战：

**1. Token 效率——每个 skill 加载到 session 的成本**
- Superpowers 的 14 个 skills 不会同时加载——`using-superpowers` bootstrap 机制按需触发
- gstack 的 preamble 在每个 skill 开始时注入 Context Recovery——但这增加了 token 消耗
- OpenSpec 的 explore 不产出 artifact——探索结果留在 context window 中，context compaction 后丢失

**2. 跨 task / 跨 session 的状态传递**
- Superpowers：File handoffs（task-brief, report, review-package 通过文件传递）+ Progress Ledger（compaction 后恢复）
- gstack：Continuous Checkpoint（WIP commit 自动保存 Decisions/Remaining/Tried）+ Context Recovery（preamble 读取磁盘 artifact）
- OpenSpec：change 文件夹（artifact 在文件系统中持久化）
- mattpocock：handoff（手动触发的 context 传递，保存到临时目录）
- ECC：task_list（handoff artifact 驱动实现循环）

**3. Subagent 之间的信息隔离**
- Superpowers：fresh subagent per task——controller 和 implementer 不共享 context，只通过文件交换信息
- mattpocock：code-review 用 parallel sub-agents——两个轴独立运行，报告不合并
- gstack：Conductor 并行 sprint——每个 sprint 在隔离 workspace
- 其他：无 subagent 隔离

### 3.2 Context 管理策略对比

| 策略 | 代表项目 | 自动化程度 | 适用场景 |
|------|---------|-----------|---------|
| **File handoffs + Progress Ledger** | Superpowers | 结构化（controller 维护） | 长任务序列（多个 task 在同一 plan 下执行） |
| **Continuous Checkpoint + Context Recovery** | gstack | 全自动 | 并行 sprint + 长 running 任务 |
| **Change 文件夹持久化** | OpenSpec | 半自动（CLI 命令） | 需要 spec 持续演进的项目 |
| **Handoff 文档** | mattpocock | 手动 | 跨 session 传递对话状态 |
| **无 context 管理** | OpenSpec (explore), ECC (无显式机制) | 无 | 短任务、单 session |

**实践方向**：Context 管理的自动化程度应该与任务序列长度匹配——短任务（1-2 个 task）不需要 context 管理，长任务需要自动机制。gstack 的 Continuous Checkpoint + Context Recovery 是最完整的方案——自动保存、自动恢复、WIP commit 过滤保持 bisect 干净。Superpowers 的 File handoffs + Progress Ledger 是为 subagent 隔离设计的——如果不用 subagent，这个方案的必要性降低。

关键洞察：**artifact 持久化是 context 管理的基础**。无论是 Superpowers 的 file handoffs、gstack 的 Continuous Checkpoint 还是 OpenSpec 的 change 文件夹——核心思想都是"将重要信息写入文件系统，而非依赖 context window"。这是因为 context window 会 compaction、会丢失，而文件系统不会。

### 3.3 Subagent 隔离的取舍

第十一篇深入讨论了 subagent 隔离的 tradeoff。综合来看：

**Subagent 隔离的优势**：
- 避免 context pollution（前面 task 的错误信息不干扰后面 task）
- Controller context 保留用于协调（不被实现细节淹没）
- 可以按 task 选模型（简单 task 用便宜模型，判断 task 用强模型）

**Subagent 隔离的代价**：
- 更多 subagent 调用成本
- File handoffs 增加复杂度（生成 task-brief、读取 report、组装 review-package）
- Controller 需要更多 prep work

**Superpowers SDD 演进的教训**：
- v4→v5：subagent review loop → inline self-review（25min → 30s，质量相当）——不是所有环节都需要 subagent
- v5→v6：两个 reviewer → 一个 reviewer（成本减半，质量不降）——subagent 数量可以优化
- v6：file handoffs 替代 pasted text——"a pasted diff parks itself permanently in the most expensive context"

**实践方向**：Subagent 隔离适合长任务序列（多个 task 需要在同一 plan 下执行）——避免 context 在多个 task 间累积。对于短任务（1-2 个 task），单 context 足够。Superpowers v4→v6 的演进表明，subagent 的使用应该精简——不是"越多越好"，而是"在必要时使用"。inline self-review 替代 subagent review loop 的教训表明，30 秒的自检可以替代 25 分钟的 subagent review——这对 context 管理有重要启示。

---

## 4. 角色与协作

### 4.1 角色数量的边界

第七篇的分析表明，角色数反映了流程的"分工程度"：

| 项目 | 角色数 | 分工方式 |
|------|-------|---------|
| Superpowers | 3 | controller（协调）+ implementer（实现）+ reviewer（审查） |
| OpenSpec | 1 | AI agent + 人类（无角色分工） |
| ECC | 67 agents | 按语言/功能/角色专门化（12 语言 reviewer + 15 角色专家 + ...） |
| mattpocock | 1-2 | AI agent + 可选 subagent（code-review 双轴） |
| gstack | 8+ | CEO / Eng Manager / Designer / DX Lead / Staff Engineer / QA / Security / Release / SRE |

但实际在单个流程实例中活跃的角色通常在 2-3 个。ECC 的 67 个 agents 是"素材库"——用户按需选择，不是每次都用全部。gstack 的 8+ 个角色分散在不同 sprint 阶段——单个 sprint 实例中活跃的角色也在 2-3 个。

**关键洞察**：角色分工的价值在于"认知隔离"——不同角色关注不同维度，避免一个角色同时做实现和审查（利益冲突）。但角色过多会增加协调开销。某研发流程尝试的 10 角色教训表明，角色数超过 3-4 个后，协调成本会急剧上升。

**实践方向**：核心角色应控制在 ~3 个以内——一个"执行者"、一个"审查者"、一个"协调者"（可选）。gstack 的多角色审查（CEO + Eng + Design + DX）是独特的——适合需要多维度评估的大型变更，但对中小型变更过重。Superpowers 的 3 角色（controller + implementer + reviewer）可能是最平衡的分工——足够隔离但不过度。

### 4.2 Human-in-the-Loop 的分布

5 个项目在人工检查点的分布上形成了光谱：

| 项目 | 人工检查点 | 自动化程度 |
|------|-----------|-----------|
| Superpowers | Explore 审查（user review gate）| 行为强制（HARD-GATE + Iron Law），无人工 GATE |
| OpenSpec | Review（人工读 Markdown）| 半自动（CLI 命令驱动，verify 不阻断） |
| ECC | GATE 1（Plan 审批）+ GATE 2（Commit 确认）| "Gated, not autonomous" |
| mattpocock | 用户编排（决定何时调用 skill）+ tickets 审查 | 低自动化（用户驱动） |
| gstack | taste decisions（plan 阶段）+ stop 条件（ship 阶段）| 高自动化（全自动 ship） |

**关键观察**：
1. **Superpowers 是"行为强制但无人工 GATE"**——流程一旦启动就自动运行到结束，但每步都有行为约束。这意味着流程纪律依赖 agent 遵守 skill 约束，而非人类审批。
2. **ECC 是"人工 GATE 最明确"**——两个 GATE 在关键节点（Plan 后 + Commit 前）要求人类确认。这是"阀门"模式——不阻断执行但要求人类确认。
3. **gstack 是"高自动化但有人工 stop 条件"**——/ship 全自动执行，但遇到特定条件（merge conflict、test failure、ASK items）时 STOP。
4. **OpenSpec 和 mattpocock 是"用户驱动"**——不强制人工检查点，依赖用户自律。

**实践方向**：人工检查点应该分布在"方向决策"和"质量确认"两个关键位置——对应 ECC 的 GATE 1（Plan 后，方向决策）和 GATE 2（Commit 前，质量确认）。Superpowers 的"无人工 GATE"模式适合信任度高的场景（如个人开发 + AI agent），ECC 的"双 GATE"模式适合需要质量保障的场景。持续执行 vs 人工检查点的平衡应该按风险等级调节——低风险变更可以全自动，高风险变更需要人工审批。

### 4.3 持续执行 vs 暂停确认

Superpowers 的"持续执行"原则——不在 task 之间暂停问"要不要继续"——是一个重要的设计决策。它的逻辑是：如果 plan 已经批准，执行就应该连续进行，暂停只会增加延迟而不增加价值。

但这与 ECC 的"Gated, not autonomous"和 gstack 的 stop 条件形成对比。

**持续执行的优势**：
- 减少 latency——不在 task 之间等待用户响应
- 保持 context 连贯性——暂停后 context 可能被 compaction
- 适合个人开发场景（用户可能离开后回来）

**持续执行的代价**：
- 如果 plan 方向错误，浪费的是完整执行的成本
- 用户无法在中间介入修正

**实践方向**：持续执行的前提是 plan 质量足够高——如果 plan 经过充分审查（如 ECC 的 GATE 1 或 gstack 的多角色审查），持续执行的风险就降低了。Superpowers 没有人工 plan 审批但依赖 brainstorming 的 HARD-GATE 和 writing-plans 的 self-review——这是另一种保障 plan 质量的方式。一个可能的实践方向是：在 plan 审批后持续执行，但在 review 发现 Critical 问题时暂停（如 Superpowers 的 per-task review gate）。

---

## 5. 实践方向的综合提炼

### 5.1 各节点反复出现的核心张力

从后续六篇的逐节点讨论中，可以提炼出贯穿所有节点的核心张力：

| 节点 | 核心张力 | 两端 | 可能的平衡点 |
|------|---------|------|-----------|
| Explore | 强制 vs 自由 | HARD-GATE（Superpowers）vs 自由对话（OpenSpec） | 按风险等级调节（ECC 的两种深度） |
| Spec | 结构化 vs 自由格式 | Requirement+Scenario（OpenSpec）vs 自由 Markdown（Superpowers） | 分层结构化（spec 结构化 + design 自由） |
| Plan | 精细 vs 粗粒度 | bite-sized 2-5min（Superpowers）vs tracer-bullet 一个 context window（mattpocock） | 与执行者匹配（subagent 需细粒度，完整 context 需粗粒度） |
| Execute | 强制纪律 vs 信任 agent | Iron Law + SDD（Superpowers）vs 纯 checkbox（OpenSpec） | 按变更类型匹配（逻辑变更强制 TDD，UI/配置不强制） |
| Review | 阻断 vs 信息 | per-task gate（Superpowers）vs 人工扫一眼（OpenSpec） | 分层（per-task gate + final review） |
| Verify | 独立 vs 嵌入 | 独立 skill + Iron Law（Superpowers）vs 嵌入 implement TDD（mattpocock） | 组合（delivery-gate 式 hook 确保 + Iron Law 式 skill 提升） |
| Archive | spec 闭环 vs 知识归档 | delta 合并（OpenSpec）vs instinct 提取（ECC） | 两者正交——可同时需要 |

**关键洞察**：每个节点的核心张力都不是"二选一"而是"光谱上的位置选择"。实践方向不是选择某一端，而是找到适合具体场景的平衡点。而平衡点的选择应该基于三个因素：
1. **变更风险等级**：高风险 → 偏强制端，低风险 → 偏自由端
2. **执行者能力**：subagent → 需细粒度，完整 context agent → 粗粒度够
3. **项目生命周期**：长期维护 → 需要 spec 持续演进，短期项目 → 一次性 spec 够

### 5.2 反复出现的有效实践模式

从后续六篇的讨论中，以下实践模式被多个项目独立验证为有效：

**1. 事实/决策分离**
- ECC 和 mattpocock 都实现了：能从代码推断的技术事实 agent 自己查，产品/业务约束必须问用户
- 价值：减少交互成本、明确责任边界、防止 agent 替用户做决策
- 适用：Explore 节点（但原则可扩展到所有节点）

**2. Progressive Rigor（渐进式 rigor）**
- ECC 的 Quick Capture vs Full Brief、OpenSpec 的 Lite spec vs Full spec
- 价值：低风险变更不延迟，高风险变更有保障
- 适用：Explore、Spec、Verify 节点

**3. Rationalization 防御**
- Superpowers 的 Rationalization 表、Red Flags
- 价值：直接针对 AI 最常见的失败模式（自我合理化）
- 适用：Execute（TDD 逃避）、Verify（虚假完成声明）、Review（跳过审查）

**4. File handoffs（artifact 以文件传递）**
- Superpowers 的 task-brief/report/review-package、OpenSpec 的 change 文件夹、gstack 的 ~/.gstack/ artifact
- 价值：跨 session 持久化、抗 context compaction、subagent 间信息隔离
- 适用：所有节点的 artifact 传递

**5. 分层审查**
- Superpowers 的 per-task + whole-branch、OpenSpec 的 propose 后 + apply 后
- 价值：per-task 保证早期发现，final/apply 后保证全局一致性
- 适用：Review 节点

**6. 机械化检查 + AI 推理互补**
- ECC 的 delivery-gate（hook 100% 触发）+ code-reviewer（AI 推理）
- 价值：hook 确保底线（格式、rationalization 文本），AI 推理提升上限（结构性问题）
- 适用：Verify、Review 节点

**7. Scope drift 检测**
- gstack 的 Plan Completion Audit、mattpocock 的 Spec 轴、OpenSpec 的 propose 后审查
- 价值：防止 AI"多做一点"（scope creep）或"少做一点"（missing requirements）
- 适用：Review 节点（但最早可在 Spec 阶段检测）

**8. 质量保障必须放入 agent 实际遵循的结构**
- Superpowers #677 的教训：spec review 步骤只存在于 prose 中，但 agent 跟随 checklist 和 process flow diagram 而非 prose——导致 spec review 被完全跳过
- 修复：将质量保障步骤添加到 checklist 和 dot graph 中
- 价值：确保质量条款不只是"写了"而是"被遵循"——agent 对 checklist/diagram 的遵循可靠性远高于 prose
- 适用：所有节点的质量保障步骤

**9. 高价值功能应默认开启**
- gstack 的 outside voice（Codex 跨模型审查）最初需要手动 opt-in——大多数用户不知道有这个选项，错过了跨模型审查的价值
- 修复：改为自动运行——"跨 /review、/ship、/plan-ceo-review、/plan-eng-review、/plan-design-review、/plan-devex-review、/document-release 和 /autoplan 的 Codex review。plan-review 的 outside voice 自动运行。"
- 价值：减少用户认知负担——让用户 opt-out 而非 opt-in
- 适用：Explore（brainstorming）、Verify（独立验证）、Plan（跨模型审查）等高价值但非强制步骤

**10. 安全检查应 fail closed**
- gstack 的 `/ship` pre-push guard 在 git error 时最初 fail open——secret 可能泄漏
- 修复：改为 fail closed——"现在在 git error 时 fail closed"
- 价值：安全检查在 error 时应该 fail closed 而非 fail open——fail open 等于没有检查
- 适用：Verify 节点的安全相关检查（secret redaction、adversarial review 等）

### 5.3 被证伪或存疑的实践

**1. 过多角色协调**
- 某研发流程尝试的 10 角色教训：角色数超过 3-4 个后，协调成本急剧上升
- gstack 的 8+ 角色在中小型变更中过重——autoplan 的 encoded decision principles 是缓解但非解决

**2. 过多流程步骤**
- 某研发流程尝试的 38 phase 失败教训：步骤数超过 ~7 步后，agent 偏离概率急剧上升
- 5 个项目的显式步骤数都集中在 5-7 步——这是自然边界

**3. 评分阈值**
- 某研发流程尝试的三层验证 + 评分阈值教训：假精确——评分看起来客观但实际依赖 AI 主观判断
- gstack 的 7/10 门槛也有类似风险——"7/10"看起来精确但实际是 AI 主观评分
- 替代方案：Superpowers 的"通过/不通过 + 具体问题"更诚实

**4. subagent review loop**
- Superpowers v4→v5 教训：25 分钟的 subagent review loop 没有比 30 秒的 inline self-review 更好
- 启示：不是所有环节都需要 subagent——自检可能足够

**5. 过度结构化**
- 某研发流程尝试的 Contract DSL 教训：过度结构化的 spec 格式增加了编写成本但未显著提升质量
- OpenSpec 的结构化格式（Requirement + Scenario）是合理的——因为它支持程序化解析和 Delta 合并。但如果不需要程序化解析，结构化的价值就大打折扣

**6. TDD 的 step-by-step workflow 冗余**
- mattpocock 的教训：TDD skill 原本有完整的 step-by-step Workflow 和 per-cycle checklist——但 red-green 循环是 AI 已经内化的，step-by-step 只是重复
- 修复：重塑为 reference-only skill——"删除了 Workflow 和 per-cycle checklist；将它们唯一持久有效的理念——垂直切片 / tracer bullets——折叠到 Anti-patterns 部分和一个简短的 Rules-of-the-loop 列表中"
- 启示：对于 AI 已内化的方法论，提供 reference（规则、anti-patterns）比提供 workflow（step-by-step）更有效

**7. TDD 包含 refactor 阶段导致职责不清**
- mattpocock 的教训：TDD 原本包含 refactor 阶段（Red → Green → Refactor）——但 refactor 属于 review 阶段，放在 TDD 中导致职责不清
- 修复：删除 refactor 阶段——"TDD 现在是 red → green；refactoring 属于 review 阶段，因此 refactor 规则和 refactoring.md 已移出（它的归属是 code-review）"
- 启示：TDD 应聚焦于 Red-Green（写测试 + 实现），refactor 移到 Review——这简化了 TDD 循环，使职责更清晰

### 5.4 仍未解决的问题

**1. "风险等级由谁判断？"**
- Progressive Rigor 需要判断变更的风险等级——但由谁判断？
- 如果是 agent 判断，可能误判（尤其是对业务影响不敏感）
- 如果是用户判断，可能低估风险（"这只是一个简单的改动"）
- OpenSpec 的方案：用户决定用 Lite spec 还是 Full spec。ECC 的方案：Size classifier 自动判断（trivial 跳过 plan）。两者都没有完美解决。

**2. "纯 Markdown 约定的遵守度"**
- 纯 Markdown 的优势是零工具依赖——但如果 agent 不遵守，约定就形同虚设
- Superpowers 的 skill 触发率约 50-80%（vs hook 100%）——这意味着 20-50% 的情况下 agent 可能跳过
- ECC 的 delivery-gate 用 hook 解决了这个问题——但 hook 是平台特定的
- 纯 Markdown 如何提高遵守度？目前没有项目给出完美答案

**3. "Spec 腐化的处理"**
- 即使有 Delta 机制（OpenSpec），spec 也可能与代码不一致——如果开发者改了代码但忘了更新 spec
- OpenSpec 的 verify 检查 spec 与代码的一致性，但基于启发式推理（关键词搜索），不是确定性证明
- 定期 spec 审计是一种可能的解决方案——但谁来做？什么时候做？成本如何？

**4. "手动 Delta 合并的可持续性"**
- OpenSpec 的 Delta 合并是程序化的——但需要结构化 spec + validator + 合并工具
- 如果不用工具（纯 Markdown），Delta 合并需要手动——这在 spec 数量增加后是否可持续？
- 目前没有项目在纯 Markdown 下实现 Delta 合并——这是一个未解决的挑战

**5. "跨模型审查的成本效益"**
- gstack 的跨模型审查需要两个 AI 服务——成本翻倍
- 价值：消除单模型偏差——Claude 和 Codex 可能系统性地忽略不同类型问题
- 但"两个模型可能共享同一个盲区"——跨模型不等于无盲区
- 成本效益的平衡点在哪里？目前没有项目给出定量分析

**6. "Context compaction 后的恢复可靠性"**
- Superpowers 的 Progress Ledger 和 gstack 的 Continuous Checkpoint 都试图解决 context compaction 后的恢复
- 但恢复的可靠性如何？如果 Progress Ledger 或 WIP commit 本身不完整怎么办？
- 目前没有项目给出 compaction 后恢复成功率的定量数据

---

## 6. 一个全面轻量的研发流程的可能形态

综合以上讨论，一个全面轻量的 AI 辅助研发流程可能具备以下特征。这是综合平衡方案的最终形态探讨——取各家之长，避已知弯路，舍部分深度。

### 6.1 流程结构

- **7 个节点**：Explore → Spec → Plan → Execute → Review → Verify → Archive
- **步骤数 ≤ ~7 步**：在 AI 可靠执行的范围内
- **核心角色 ≤ ~3 个**：执行者 + 审查者 + 协调者（可选）
- **按风险等级调节深度**：低风险变更轻量化，高风险变更全流程
- **Brownfield 支持**：Delta 机制 + 系统理解子能力

### 6.2 约束机制

- **行为塑造 + 工具强制分层**：核心行为约束用纯 Markdown（Rationalization 表、Iron Law），格式验证和机械化检查用工具（validator、hook）
- **Rationalization 防御**：在每个关键节点列出 AI 可能的"跳过"借口及现实对照
- **质量保障放入 agent 实际遵循的结构**：不只在 prose 中描述，必须出现在 checklist、diagram 或其他 agent 实际遵循的结构中（Superpowers #677 教训）
- **机械化检查确保底线**：hook 100% 触发的确定性检查（如 delivery-gate），安全检查 fail closed（gstack 教训）
- **AI 推理提升上限**：subagent 或 inline self-review 检查结构性问题
- **高价值功能默认开启**：跨模型审查、独立验证等高价值步骤 opt-out 而非 opt-in（gstack 教训）
- **人工 GATE 在关键位置**：Plan 后（方向决策）+ Commit 前（质量确认）

### 6.3 Context 管理

- **artifact 以文件传递**：不依赖 context window 持久化重要信息
- **自动 context 保存**：类似 gstack 的 Continuous Checkpoint 或 Superpowers 的 Progress Ledger
- **subagent 隔离在长任务序列中使用**：短任务单 context 足够
- **inline self-review 优先于 subagent review**：30 秒自检可能足够（Superpowers v5 教训）

### 6.4 各节点的实践方向

| 节点 | 实践方向 | 关键 tradeoff |
|------|---------|-------------|
| Explore | 事实/决策分离 + 按风险调节深度 | 强制（防方向错误）vs 自由（低门槛） |
| Spec | 分层结构化（行为契约结构化 + 设计文档自由）+ Delta 机制 + 质量保障放入结构 | 结构化（可验证可合并）vs 自由格式（低编写成本） |
| Plan | 描述"做什么"和"关键设计决策"而非完整代码 + Global Constraints | 精细（消除歧义）vs 粗粒度（保护 TDD） |
| Execute | TDD 按变更类型匹配（Red-Green，不含 Refactor）+ subagent 隔离在长任务中使用 + 自动 context 保存 | 强制纪律（质量保障）vs 信任 agent（效率） |
| Review | 分层审查（per-task + final）+ scope drift 检测 + 审查者独立性 + refactor 归属此阶段 | 阻断（早期发现）vs 信息（不延迟） |
| Verify | 机械化检查（hook，fail closed）+ AI 推理（skill）互补 + evidence before claims | 独立（确定性）vs 嵌入（轻量） |
| Archive | spec 闭环（Delta 合并）+ 知识归档（learnings）+ 分支管理 | spec 持续演进（长期价值）vs 一次性 spec（简单） |

### 6.5 舍弃了什么

综合平衡意味着有取有舍。以下是这个方案相比各参考项目舍弃的部分，以及舍弃的理由：

**舍弃了 Superpowers 的绝对行为约束纪律**
- Superpowers 对所有变更强制 HARD-GATE + Iron Law——即使简单变更也走完整流程
- 我们选择按风险等级调节深度——低风险变更可以跳过部分步骤
- 代价：放弃了"所有变更都走完整流程"的纪律保障。如果风险判断失误，低风险变更可能遗漏关键步骤
- 理由：简单变更走完整流程的延迟成本（Superpowers 的过重问题）超过了纪律收益

**舍弃了 OpenSpec 的完整 Delta 工具链**
- OpenSpec 有 validator.ts（程序化格式验证）+ archive.ts（程序化 Delta 合并）——spec 治理完全工具化
- 我们选择纯 Markdown + 手动合并——降低工具依赖和使用门槛
- 代价：放弃了程序化验证和自动合并的确定性。spec 格式错误不会被自动捕获，Delta 合并需要手动操作
- 理由：工具链的编写和维护成本较高，在 spec 数量不大的场景下手动操作的负担可以接受

**舍弃了 ECC 的 67 agents 专门化覆盖**
- ECC 有 12 种语言 reviewer + 15 角色专家 + 功能 agents——几乎每个场景都有专门化 agent
- 我们选择 ~3 个核心角色——执行者 + 审查者 + 协调者
- 代价：放弃了语言/功能/角色的精细分工。TypeScript 审查和 Python 审查用同一个 reviewer，而不是专门的 typescript-reviewer 和 python-reviewer
- 理由：67 agents 的协调成本和维护负担对中小型项目过重。2-3 个角色的分工已足够实现认知隔离

**舍弃了 mattpocock 的极度简洁**
- mattpocock 的 implement skill 只有 16 行——极度精简，依赖 AI 内化习惯
- 我们增加了约束层（Rationalization 表、质量保障结构、人工 GATE）——比 mattpocock 更重
- 代价：放弃了极致轻量。用户需要理解更多约束规则，流程启动成本更高
- 理由：mattpocock 的简洁依赖用户的专家判断和 AI 的充分训练——在通用场景下，缺乏约束可能导致质量失控

**舍弃了 gstack 的全自动化 ship + 浏览器 QA**
- gstack 的 `/ship` 全自动执行（review → test → push → merge），且有浏览器端 QA
- 我们保留人工 GATE（Plan 后 + Commit 前）——不追求全自动执行
- 代价：放弃了全自动执行的效率。人工 GATE 增加了延迟
- 理由：全自动执行的前提是流程纪律足够高——在约束机制还不完善的阶段，人工检查点是安全底线

### 6.6 未解决的挑战

一个全面轻量的研发流程需要诚实面对未解决的问题：
- 风险等级由谁判断？
- 纯 Markdown 约定的遵守度如何提高？
- Spec 腐化如何检测和处理？
- 手动 Delta 合并在纯 Markdown 下的可持续性？
- 跨模型审查的成本效益平衡点在哪里？
- Context compaction 后恢复的可靠性如何验证？

这些问题的答案可能需要在实际使用中逐步探索——这正是后续文章将要讨论的主题。

---
