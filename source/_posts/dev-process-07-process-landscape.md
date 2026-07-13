---
title: AI 研发流程深度解析（七）：横向对比与流程体系探讨——承上启下
description: 对五个项目做全景式横向对比，理解各自的设计取向和取舍，尝试探索一种相对全面而不失灵活的 AI 研发流程思路。
tags:
  - 研发流程
  - 横向对比
  - 流程设计
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-12
> **核心问题：** 五个项目各自的设计取向和取舍是什么？我们能从各自走过的弯路中学到什么？如何尝试探索一种相对全面而不失灵活的 AI 研发流程思路？

---

## 1. 五项目横向对比

前五篇笔记分别深度拆解了 Superpowers、OpenSpec、ECC、mattpocock-skills 和 gstack 的架构、设计哲学和实践细节。在进入节点级设计之前，我们需要先做一个全景式的横向对比——理解每个项目的关注侧重点、解决的核心问题、设计亮点与取舍代价。需要强调的是，每个项目的"取舍"都不是缺点，而是其独特定位下的合理选择——正如一个专注于行为约束的系统不应该被批评"不够灵活"，因为灵活性从来不是它的设计目标。

### 1.1 关注侧重点对比

五个项目虽然都涉及 AI 辅助研发流程，但它们的关注焦点截然不同：

| 项目 | 核心关注点 | 一句话定位 |
|------|-----------|-----------|
| **Superpowers** | 行为塑造——如何用纯 Markdown 指令可靠地约束 agent 行为 | Skill 即行为塑造 |
| **OpenSpec** | 共识管理——如何在人机之间建立"先同意再构建"的契约 | Spec 即共识契约 |
| **ECC** | 素材供给——如何提供足够丰富的 agent 素材覆盖所有场景 | Agent 素材大全 |
| **mattpocock** | 方法论原语——如何提供小巧可组合的工程师技能 | 小而可组合的工程师技能 |
| **gstack** | 全流程覆盖——如何把 AI 变成完整的虚拟工程团队 | 虚拟工程团队 |

这些定位不是标签，而是深刻的设计决策——每个项目都在自己的问题空间中做出了深思熟虑的选择：

- **Superpowers** 的所有设计都围绕一个问题：agent 不可靠时怎么办？HARD-GATE、Iron Law、Rationalization 表、Red Flags——每一个机制都是对 agent "走捷径"行为的直接防御。它的 14 个 skill 构成一条强制的线性链，从 brainstorming 到 finishing-a-development-branch，不允许跳过任何环节。这种"不信任 agent"的取向是经过实战验证的——v3.4.0 曾放松约束，v4.3.0 又加回，因为 agent 确实会走捷径。

- **OpenSpec** 的所有设计都围绕一个问题：如何让 spec 成为持续演进的 source of truth？Delta 机制（ADDED/MODIFIED/REMOVED）、change 文件夹、archive 合并——每一个机制都服务于"spec 随变更有机增长"这个核心目标。它选择不定义流程——"Enablers not Gates"意味着用户可以跳过任何阶段。这种"信任用户判断"的取向有其道理——OpenSpec 的用户群体已经认同"先同意再构建"的理念。

- **ECC** 的所有设计都围绕一个问题：如何覆盖尽可能多的场景？261+ skills、67 agents、94 commands、6 种 hooks——它的架构是围绕素材供给而非工作流设计的。它选择不定义流程，而是提供足够丰富的素材让用户自行组合。覆盖面广是其设计追求，而认知负担重则是这一取向的自然代价——两者是同一个硬币的两面。

- **mattpocock** 的所有设计都围绕一个问题：如何提供最小可用的工程方法论原语？grilling（一次一问）、事实/决策分离、tracer-bullet tickets、vertical slice——每个 skill 都是独立可组合的工具。它明确"不拥有流程"，用户决定何时调用什么。这种"把控制权交给用户"的取向反映了 Matt Pocock 作为独立工程师的实践哲学——他需要的是轻量工具，不是流程框架。

- **gstack** 的所有设计都围绕一个问题：如何端到端覆盖从 Think 到 Reflect 的完整工程流程？23+ skills、8 个 power tools、sprint 链式传递、Dashboard 可视化——它的每个设计都服务于"把 Claude Code 变成虚拟工程团队"这个目标。它拥有最完整的流程覆盖，重量级则是这种全面性的自然代价——Garry Tan 在 60 天内交付 3 个生产服务的场景，需要的正是这种全流程工具。

### 1.2 解决的核心问题对比

每个项目选择解决的核心问题不同，这决定了它们的设计取向：

| 项目 | 解决的核心问题 | 选择不覆盖的领域 |
|------|--------------|-------------|
| **Superpowers** | Agent 不可靠——会跳过探索、虚假完成声明、走捷径 | Spec 持续演进、多角色分工、跨 session 状态 |
| **OpenSpec** | Spec 与实现脱节——spec 写完就过时，实现偏离 spec | Agent 行为约束、执行纪律、多角色审查 |
| **ECC** | 场景覆盖不足——通用 agent 在特定领域表现不佳 | 流程定义、轻量级使用、快速上手 |
| **mattpocock** | 工具过于复杂——用户需要轻量、可组合的工程方法论 | 全流程覆盖、spec 持续演进、多角色团队 |
| **gstack** | 流程断裂——从设计到上线缺乏端到端覆盖 | 轻量级使用、快速上手、低认知负担 |

**关键观察：** 每个项目都是在自己的"问题空间"中做到最优——Superpowers 在行为约束上最深入，OpenSpec 在 spec 治理上最独创，ECC 在场景覆盖上最丰富，mattpocock 在方法论轻量性上最精炼，gstack 在流程完整性上最全面。它们选择不覆盖的领域不是疏忽，而是有意为之——任何设计都有边界，试图覆盖一切的系统往往什么也做不好。这启发我们思考：是否有可能从各自的经验中学习，尝试探索一种相对全面的思路？当然，这种探索本身也只是众多可能性中的一种。

### 1.3 设计取舍分析

与其用"优势/劣势"来评判五个项目，不如理解每个项目的"设计亮点"和"取舍代价"——亮点是它在这个方向上做到了什么程度，代价是它为了做到这个程度而放弃了什么。每个取舍都是合理的，只是在特定的使用场景下才显现为"合适"或"不合适"。

#### Superpowers

**设计亮点：**
- **行为约束最彻底**：HARD-GATE 阻止跳过探索，Iron Law 阻止虚假完成声明，per-task review gate 确保每个任务都被审查。这套机制对 agent 的"走捷径"行为形成了多层防御。
- **失败驱动的设计迭代**：每个设计决策都有对应的失败教训。v3.4.0 简化 brainstorming → v4.3.0 加回 HARD-GATE，因为 agent 会跳过。这种"从失败中学习"的设计方式让每个机制都有明确的针对性。
- **纯 Markdown 驱动**：不依赖外部工具或复杂基础设施，任何支持 Markdown 的 AI 平台都能使用。跨平台适配覆盖 10 个平台。
- **File handoffs 设计**：subagent 之间通过文件传递信息（task-brief, report, review-package），不共享 context，避免了 context pollution。

**取舍代价：**
- **Spec 不持续演进**：spec 是一次性的设计文档，不会随变更更新。这是 Superpowers 的设计取向决定的——它关注的是"当前任务的行为约束"，spec 持续演进是 OpenSpec 的关注点，两者解决的问题不同。
- **流程刚性**：所有项目都必须走完整流程（brainstorm → design → plan → SDD → review → verify → finish）。这是 HARD-GATE 设计的必然代价——要确保 agent 不走捷径，就不能允许跳过任何环节。简单任务也走完整流程确实偏重，但 Superpowers 认为这个代价是值得的。
- **无人工 GATE**：流程一旦启动就自动运行到结束，没有人工审批节点。Superpowers 的设计哲学是"用指令约束 agent"而非"用人类把关"——这是一种有意识的选择。
- **单一角色**：只有 controller、implementer、reviewer 三个角色，没有领域专家分工。Superpowers 面向的是单人 + 单 AI agent 的深度协作场景，多角色分工不是它的目标。

#### OpenSpec

**设计亮点：**
- **Delta 机制**：唯一将 Brownfield 作为 first-class 概念的项目。spec 只描述变更（ADDED/MODIFIED/REMOVED），archive 时合并回 source of truth。这让 spec 成为系统当前行为的持续记录，不会过时。
- **工具化程度最高**：41 个核心模块、CLI 验证、结构化 schema、30+ AI 工具适配器。Artifact 有明确的格式和验证规则。
- **渐进式结构化**：Enablers not Gates——用户可以跳过任何阶段。探索阶段不强制产出，propose 阶段才需要结构化 artifact。
- **可审计性强**：每个 change 都是一个文件夹，包含 proposal、design、specs/ delta、tasks。archive 后保留为历史记录。

**取舍代价：**
- **无执行纪律**：`/opsx:apply` 只是逐项勾选 checkbox，没有 TDD 强制、没有 subagent 隔离、没有 per-task review。OpenSpec 的设计哲学是"治理 artifact 而非约束行为"——它信任用户和 agent 会正确实现，重点在于 spec 的正确性而非执行过程。
- **无强制机制**：verify 明确"不阻断"，review 是人工扫一眼。这是 "Enablers not Gates" 的直接体现——OpenSpec 认为强制会阻碍灵活性，用户应该自行决定何时做什么。
- **认知门槛**：用户需要理解"终端命令"和"聊天命令"的区别、change 文件夹结构、delta 语法。这是工具化程度的代价——越结构化的系统学习成本越高。
- **无多角色审查**：只有一个 AI agent + 人类，没有领域专家分工。OpenSpec 关注的是"人机之间的共识"而非"多角色协作"。

#### ECC

**设计亮点：**
- **场景覆盖最广**：261+ skills 覆盖从 TDD 到安全审查、从代码审查到持续学习。67 个 agents 实现 12 语言专用审查 + 15 个角色专家。
- **Gated pipeline**：两个 GATE（计划审批 + commit 确认）在关键节点要求人类确认。delivery-gate hook 100% 触发，可阻断。
- **持续学习**：continuous-learning-v2 的 instinct 机制自动从会话中提取模式，让流程随使用越来越智能。
- **权限隔离**：Agent 的 `tools` 字段实现权限隔离——planner 只有 Read/Grep/Glob 权限，不能修改文件。

**取舍代价：**
- **认知负担重**：261+ skills、67 agents、94 commands、6 种 hooks——用户需要理解五层素材体系（Skills/Agents/Commands/Hooks/Rules）及其关系。这是"素材供给"取向的必然代价——覆盖面越广，素材越多，学习曲线越陡。
- **不定义流程**：虽然 orch-* pipeline 定义了 6 个 Phase，但 ECC 整体的定位是"提供素材不定义流程"。这是一个有意识的选择——ECC 认为"不同场景需要不同流程"，与其定义一个通用流程，不如提供足够的素材让用户自行组合。
- **重量级安装**：manifest-driven selective install 虽然支持选择性安装，但完整安装的素材量仍然庞大。
- **素材维护负担**：67 个 agents 中有多少是日常使用的？素材膨胀可能带来维护负担。这是"追求覆盖"的自然代价。

#### mattpocock-skills

**设计亮点：**
- **最轻量**：promoted skills 数量适中（约 20 个），每个 skill 聚焦一个方法论原语。零基础设施依赖。
- **可组合性最高**：skills 完全独立，用户自由组合。grilling 是可复用原语——被 to-spec、to-tickets 等内部调用。
- **事实/决策分离**：能从代码推断的技术事实 agent 自己查，产品/业务约束必须问用户。这明确了责任边界，减少了交互成本。
- **User-invoked vs Model-invoked**：清晰的触发方式区分，控制 context load 和触发可靠性的 tradeoff。
- **实践验证**：每个 skill 都经过 Matt Pocock 的日常工程实践验证，不是理论设计。

**取舍代价：**
- **无流程保障**：明确"不拥有流程"，用户完全自主编排。这是"把控制权交给用户"的设计取向的直接结果——mattpocock 认为流程应该由了解上下文的人决定，而非由工具强制。对于不熟悉流程的用户，这可能意味着跳过关键步骤，但 mattpocock 的目标用户是有经验的工程师。
- **Spec 不持续演进**：spec 是一次性的 PRD，不会随变更更新。mattpocock 关注的是"当前任务的工程方法论"，spec 持续演进不在其设计范围内。
- **无多角色审查**：1-2 个角色（AI agent + 可选第二个 subagent for review），没有领域专家分工。个人工程师的日常工具不需要多角色团队。
- **验证嵌入而非独立**：验证嵌入 implement 的 TDD red-green，没有独立的 verify 节点。这是"轻量"取向的代价——减少一个节点就减少一份开销，但代价是验证维度可能不够全面。

#### gstack

**设计亮点：**
- **全流程覆盖最完整**：Think → Plan → Build → Review → Test → Ship → Reflect 七阶段，23+ skills + 8 power tools。从设计到上线到回顾，每个环节都有专门 skill。
- **多角色审查**：CEO、Eng Manager、Designer、Staff Engineer、QA Lead、Security Officer、Release Engineer、SRE——8+ 个工程角色，每个角色有专门的 plan review。
- **Sprint 链式传递**：每个 skill 的产出通过文件系统持久化 artifact 喂给下一个。Context Recovery 自动恢复近期 artifact。
- **Dashboard 可视化**：Review Readiness Dashboard 显示流程状态，让用户看到哪些环节已完成、哪些缺失。
- **跨模型审查**：`/review`（Claude）+ `/codex`（OpenAI）实现跨模型交叉审查。
- **知识归档**：decisions.jsonl、learnings.jsonl、timeline.jsonl 让"已决定的事不再重新讨论"。

**取舍代价：**
- **最重量级**：23+ skills + 8 power tools + 170 行 preamble + 模板系统 + 多路径 artifact。认知负担和基础设施依赖都最高。这是"全流程覆盖"取向的必然代价——要覆盖从 Think 到 Reflect 的每个环节，就需要足够多的 skills 和 tools。
- **门槛最高**：用户需要理解 sprint 结构、preamble、模板系统、artifact 路径约定、Dashboard 状态。gstack 面向的是需要完整工程团队流程的场景，不是简单任务的快速工具。
- **Spec 不持续演进**：spec 是全量的设计文档，没有 Delta 机制。CEO 计划和设计文档是工程 artifact 而非行为契约。gstack 关注的是"从设计到上线的全流程"，spec 持续演进是 OpenSpec 的关注点。
- **强制程度有限**：除了 Eng Review required（可禁用），大部分环节是"信息可视化"而非"阻断"。gstack 的设计哲学是"User Sovereignty——AI recommend, users decide"，阻断与这一哲学相悖。

### 1.4 关键设计维度对比

除了上述分析，我们还可以从几个正交维度对五个项目进行横向对比。这些维度不是为了评判高下，而是为了理解不同设计取向在这些维度上的具体表现：

#### 1.4.1 流程控制范式

| 维度 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **控制方式** | 行为塑造（SKILL.md 指令） | Artifact 治理（结构化文件 + CLI 验证） | 混合（skills + hooks + GATE） | 无（用户编排） | Sprint 链式（文件持久化 + preamble） |
| **控制器** | SDD controller | 无（用户驱动） | orch-* pipeline | 无（用户编排） | sprint 结构 + autoplan |
| **强制程度** | 最高（HARD-GATE + Iron Law） | 最低（Enablers not Gates） | 高（GATE 1+2 + delivery-gate） | 最低（不拥有流程） | 中（Dashboard 可视化，少量阻断） |

#### 1.4.2 Artifact 持久性

| 维度 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **持久化方式** | 文件系统（task-brief, report） | 文件系统（change 文件夹 + specs/） | Context + handoff + instinct | Context window（大部分）+ handoff | 文件系统 + Git commit |
| **跨 session** | 部分（design doc 持久化） | 是（change 文件夹持久化） | 部分（instinct 持久化） | 弱（handoff 手动触发） | 是（全部 artifact 持久化） |
| **Spec 演进** | 无（一次性设计文档） | 有（delta 合并回 source of truth） | 无（一次性 AC） | 无（一次性 PRD） | 无（一次性 design doc） |

#### 1.4.3 角色分工

| 维度 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **角色数** | 3（controller, implementer, reviewer） | 1（AI agent + 人类） | 67 agents（12 语言 + 15 角色） | 1-2（AI agent + 可选 review subagent） | 8+（CEO, Eng, Design, DX, QA, Security, Release, SRE） |
| **分工方式** | 按流程阶段 | 无分工 | 按领域（语言 + 角色） | 无分工 | 按工程角色 |
| **subagent 隔离** | 是（fresh subagent per task） | 否 | 是（委托给专门化 agent） | 部分（review 用第二个 subagent） | 否（单 context 内运行） |

#### 1.4.4 流程弹性 vs 纪律

```
弹性 ←─────────────────────────────────────────────→ 纪律

OpenSpec    mattpocock    gstack      ECC         Superpowers
(Enablers   (不拥有       (Dashboard  (GATE 1+2,  (HARD-GATE,
 not Gates) 流程)         可视化)     delivery)   Iron Law)
```

弹性和纪律没有绝对的好坏——弹性适合有经验的用户和简单任务，纪律适合不可靠的 agent 和复杂任务。五个项目在这个光谱上的位置反映了它们对"用户自主性 vs 流程保障"的不同权衡。

### 1.5 五项目定位象限图

将五个项目按"流程完整性"和"使用轻量性"两个维度绘制象限图：

```
                    流程完整性 ↑
                          │
              Superpowers │           gstack
              (行为强制)   │        (全流程覆盖)
                          │
   ──────────────────────┼────────────────────── → 使用轻量性
                          │
              OpenSpec    │        ECC
              (spec 治理) │       (素材供给)
                          │
                  mattpocock
                 (方法论原语)
```

- **Superpowers**：流程完整性高（强制线性链），使用轻量性中等（纯 Markdown 但流程刚性）
- **gstack**：流程完整性最高（7 阶段全覆盖），使用轻量性最低（23+ skills + 8 tools）
- **OpenSpec**：流程完整性中等（有 artifact 治理但无强制），使用轻量性中等（需要理解 CLI + 目录约定）
- **ECC**：流程完整性低（不定义流程），使用轻量性低（认知负担重）
- **mattpocock**：流程完整性低（不拥有流程），使用轻量性最高（~20 skills，零基础设施）

**关键观察：** 没有项目同时做到"高流程完整性"和"高使用轻量性"——这并非设计失误，而是两者本身就存在张力。流程完整性要求覆盖更多环节、提供更多保障，这天然增加复杂度；使用轻量性要求减少认知负担和基础设施依赖，这天然意味着减少覆盖。这启发我们思考：是否有可能在两者之间找到一个相对平衡的位置？当然，任何"平衡"都是一种新的取舍——平衡意味着两边都不极端，也意味着两边都不最优。

---

## 2. 从经验中学习：尝试探索一种相对全面的流程思路

### 2.1 从对比中看到的共同模式

尽管五个项目的设计取向差异巨大，但横向对比揭示了一些共同模式——这些模式不是任何单个项目的发明，而是 AI 研发实践的自然涌现：

**模式一：5-7 个节点的自然复杂度**

尽管项目规模差异巨大（mattpocock ~20 skills vs gstack 23+ skills + 8 tools），显式步骤数都集中在 5-7 步。这暗示 AI 研发流程的自然复杂度大约在 5-7 个节点——更多节点会增加认知负担，更少节点会缺失关键环节。

| 项目 | 显式步骤数 |
|------|----------|
| Superpowers | ~7 步（brainstorm → design → plan → SDD → review → verify → finish） |
| OpenSpec | ~6 步（explore → propose → apply → review → verify → archive） |
| ECC | ~6 Phase + 2 GATE |
| mattpocock | ~5 步（grill → spec → tickets → implement → review） |
| gstack | ~7 阶段（Think → Plan → Build → Review → Test → Ship → Reflect） |

**模式二：核心节点的普遍存在**

所有项目都有某种形式的以下节点——尽管实现方式和名称差异巨大：

| 节点 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **Explore** | brainstorming (HARD-GATE) | /opsx:explore (自由对话) | intent-driven-development | /grill-me (一次一问) | /office-hours (forcing questions) |
| **Spec** | design doc (自由 Markdown) | proposal + specs/ delta | Acceptance Brief (AC-NNN) | /to-spec (PRD) | /spec (五阶段) |
| **Plan** | writing-plans (bite-sized) | tasks.md (checkbox) | planner agent (Phase+Step) | /to-tickets (tracer-bullet) | /plan-ceo-review + 多角色 |
| **Execute** | SDD (fresh subagent, TDD) | /opsx:apply (勾选) | tdd-workflow (RED→GREEN) | /implement (vertical slice) | Build (plan 驱动) |
| **Review** | task-reviewer (per-task gate) | 人工 review | code-reviewer (67 agents) | /code-review (双轴) | /review + /codex (跨模型) |
| **Verify** | verification (Iron Law) | /opsx:verify (不阻断) | delivery-gate (hook 阻断) | 嵌入 implement (TDD) | /qa (浏览器端到端) |
| **Archive** | finishing-a-branch | /opsx:archive (delta 合并) | orch Phase 6 + instinct | commit + /handoff | /ship + /retro + /learn |

**模式三：流程控制的三种范式各有适用场景**

- **行为塑造**（Superpowers）：用指令约束 agent 行为——最轻量但最刚性，适合单人 + 单 AI agent 的深度协作
- **Artifact 治理**（OpenSpec）：用结构化文件约束流程——最可审计但认知门槛高，需要 spec 持续演进的长期项目
- **Sprint 链式**（gstack）：用文件持久化约束传递——最完整但最重量级，适合并行 sprint + 虚拟团队场景

这三种范式没有高下之分，只有适用场景之分。我们的思考不是"选哪种范式"，而是"能否从每种范式中学习一点经验"。

**模式四：每个项目都走过弯路，弯路本身就是宝贵的经验**

五个项目的演进历史都记录了各自的弯路和修正，这些弯路比成功经验更有学习价值：

- **Superpowers** 的弯路：v3.4.0 放松 HARD-GATE → agent 跳过探索 → v4.3.0 加回。教训：agent 会走捷径，不能完全信任。
- **OpenSpec** 的弯路：早期过度结构化 → 用户反馈"太重" → 逐步放松为 "Enablers not Gates"。教训：过早结构化会阻碍探索。
- **ECC** 的弯路：素材膨胀 → 用户反馈"不知道用哪个" → 引入 manifest-driven selective install。教训：覆盖面需要配合选择性。
- **mattpocock** 的弯路：v1.1.0 之前 grilling 在被其他 skill 调用时会替用户做决策 → 修复事实/决策分离。教训：可复用原语需要明确责任边界。
- **gstack** 的弯路：早期流程不强制 → Dashboard 显示缺失但不阻止 → 用户仍然跳过 → 引入 Eng Review required。教训：纯信息可视化有时不够。

### 2.2 各项目设计取向的自然代价

从横向对比中，我们可以总结出每个项目的设计取向及其自然代价。需要再次强调，这些"代价"不是"缺点"——它们是设计取向的必然伴生物，正如选择了轻量就意味着放弃了一些保障，选择了全面就意味着增加了一些复杂度：

| 项目 | 设计取向 | 自然代价 | 弯路教训 |
|------|---------|---------|---------|
| **Superpowers** | 行为强制（HARD-GATE + Iron Law） | 流程刚性，简单任务也走完整流程 | v3.4.0 放松 → agent 跳过 → v4.3.0 加回：不能完全信任 agent |
| **OpenSpec** | 渐进式结构化（Enablers not Gates） | 无执行纪律，agent 可靠性无保障 | 过度结构化 → 用户反馈"太重" → 逐步放松：不能过早结构化 |
| **ECC** | 场景全覆盖（261+ skills） | 认知负担重，新用户难以入门 | 素材膨胀 → "不知道用哪个" → selective install：覆盖面需要配合选择性 |
| **mattpocock** | 最大可组合性（不拥有流程） | 无流程保障，不熟悉流程的用户可能跳过关键步骤 | grilling 替用户做决策 → 事实/决策分离：可复用原语需要明确边界 |
| **gstack** | 全流程覆盖（7 阶段 × 23+ skills） | 重量级，门槛最高 | 纯信息可视化不够 → Eng Review required：有时需要少量强制 |

这些弯路教训是我们设计流程时最宝贵的参考——它们告诉我们"什么会出错"以及"为什么会出错"。我们的目标不是避免所有弯路（那是不可能的），而是尽量从别人的弯路中学习，避免重复已知的错误，同时尽量不引入新的问题。

### 2.3 我们的思考方向

基于以上分析，我们尝试提出一种思考方向——需要强调的是，这只是一个可能性的探讨，不是"正确答案"。每个项目在自己的场景中都是合理的，我们试图探索的只是在"相对全面"和"相对轻量"之间的一种可能性：

> **尝试探索一种相对全面而不失灵活的 AI 研发流程思路——从五个项目各自的经验中学习，尽量覆盖关键环节而不出现大的漏洞，同时保持足够的轻量和灵活性，不因为追求全面而变得过重。**

这个思考方向分解为三个期望：

**期望一：相对轻量**
- 流程节点数控制在 5-7 个（遵循自然复杂度）
- 不依赖复杂基础设施（学习 mattpocock 的零依赖理念，而非 gstack 的模板系统或 ECC 的 67 agents）
- 简单任务能快速通过，不被流程阻塞（学习 OpenSpec 的弹性理念）

**期望二：相对有效**
- 关键环节有基本保障（学习 Superpowers 的纪律理念，但不像它那样对所有任务强制）
- Agent 行为有基本约束（学习 Superpowers 的行为塑造，但保留用户的自主性）
- 验证有据可查（学习 Superpowers 的 fresh evidence 和 gstack 的端到端验证）

**期望三：相对可维护**
- Spec 能持续演进（学习 OpenSpec 的 Delta 机制）
- 知识能积累（学习 ECC 的 instinct 和 gstack 的 learnings）
- 流程能按风险调节（学习 ECC 的 Size classifier 和 Superpowers 的 HARD-GATE，但按场景选择）

之所以反复使用"相对"这个词，是因为我们清醒地认识到：任何流程设计都是在多个维度之间做取舍，不可能在所有维度上同时做到最优。"相对全面"意味着比单个项目覆盖更多维度，但不可能比专门优化的项目做得更好——Superpowers 在行为约束上永远比我们的综合方案更彻底，OpenSpec 在 spec 治理上永远比我们的综合方案更深入。我们的探索只是试图在"不出现大的漏洞"和"不失灵活"之间找到一个可能的平衡点。

### 2.4 思考原则

基于五项目对比和弯路教训，我们提出以下思考原则——同样，这些原则只是我们尝试的方向，不是普适的法则：

**原则一：默认链式 + 可拆解**

学习 mattpocock 的高可组合性和 gstack 的流程完整性，流程默认按链运行（尽量完整），但每个节点可以独立调用（保留弹性）。这是在 OpenSpec "Enablers not Gates" 和 gstack "sprint 链式" 之间的一种折中尝试——既不完全放任（学习 gstack 的弯路：纯信息可视化有时不够），也不完全强制（学习 Superpowers 的弯路：所有任务走完整流程过重）。

**原则二：按风险等级调节**

学习 ECC 的 Size classifier 和 Superpowers 的 HARD-GATE，低风险变更允许快速通过（如 OpenSpec 的自由探索），高风险变更要求更完整的流程。这试图同时回应两个弯路——Superpowers 的"简单任务过重"和 mattpocock 的"无流程保障"。当然，"风险由谁判断"本身是一个未完全解决的问题——agent 可能误判，用户可能低估，我们能做的是提供判断依据而非给出终极方案。

**原则三：行为约束 + Artifact 治理混合**

学习 Superpowers 的行为塑造（轻量约束 agent）和 OpenSpec 的 artifact 治理（可审计性），但不走任何一个极端。不依赖外部工具（学习 mattpocock 的零依赖理念），但保留结构化 artifact 的可审计性。

**原则四：Spec 持续演进**

学习 OpenSpec 的 Delta 机制，让 spec 随变更有机增长。这是五个项目中只有 OpenSpec 做到的——其他四个项目的 spec 都是一次性的。我们认为这个方向值得学习，因为 spec 过时是长期维护中的真实痛点。

**原则五：渐进式结构化**

学习 OpenSpec 的 Progressive Rigor，探索阶段不强制结构化产出，随着流程推进逐渐增加结构化程度。这试图同时避免两个弯路——OpenSpec 早期的"过早结构化"和 mattpocock 的"完全无结构"（探索结果在 context compaction 后丢失）。

---

## 3. 流程设计思考与探讨

### 3.1 关键环节的确定

基于五项目的共同模式（5-7 个节点的自然复杂度），我们尝试确定 **7 个关键环节**：

```
Explore → Spec → Plan → Execute → Review → Verify → Archive
```

**为什么是这 7 个？**

从五项目的实践中可以看到，这 7 个节点在所有项目中都存在（尽管实现方式和强调程度差异巨大）。它们似乎是 AI 研发流程的自然组成部分——去掉任何一个都可能导致某个方面缺少关注：

- **去掉 Explore**：agent 直接从用户需求跳到 spec，缺乏对问题的深入理解。Superpowers 的 v3.4.0→v4.3.0 弯路告诉我们：agent 会说"this is too simple to need a design"然后跳过探索，导致方向错误。
- **去掉 Spec**：agent 直接从探索跳到计划，没有可验证的行为契约。这会导致实现偏离意图——没有"系统应该做什么"的明确定义，执行就失去了基准。
- **去掉 Plan**：agent 直接从 spec 跳到编码，缺乏任务分解和依赖管理。复杂任务可能陷入混乱——没有任务清单，agent 可能在 context 中迷失方向。
- **去掉 Execute**：显然不行——这是实际编码环节。
- **去掉 Review**：代码质量缺少关注。OpenSpec 的"人工扫一眼"已经是最轻量的 review，但仍有价值——更不用说这个"人工扫一眼"在实践中经常被跳过。
- **去掉 Verify**：实现可能不工作。Superpowers 的 Iron Law 告诉我们：agent 会声称"应该可以工作"但实际没有运行验证。
- **去掉 Archive**：工作不闭环。spec 不更新、知识不积累、环境不清理——长期维护时这些债务会累积。

**为什么不是更多节点？**

ECC 的 6 Phase + 2 GATE = 8 个节点，gstack 的 7 阶段 × 23+ skills = 远超 7 个节点。但更细的分解会增加认知负担——ECC 的 67 agents 和 gstack 的 23+ skills 是在节点内部的实现细节，而非额外的流程节点。gstack 将 Review 拆为 `/review` + `/codex` + `/cso` 三个 skill，但这仍然是 Review 节点内部的分工，不是三个独立节点。更多节点意味着更重的流程，这与我们"相对轻量"的期望相悖。

**为什么不是更少节点？**

mattpocock 的 5 步将 Review 嵌入 Execute（TDD red-green 作为隐式 review），将 Verify 也嵌入 Execute。这确实更轻量，但可能失去独立审查和独立验证的视角——Review 关注"代码质量是否符合标准"，Verify 关注"系统是否真的按预期工作"，两者的关注点不同。mattpocock 将 verify 嵌入 implement 的 TDD，意味着只验证了"测试通过"而没有验证"系统端到端工作"。当然，对于 mattpocock 的场景（个人工程师的日常工具），这种轻量取舍是合理的——只是我们在探索相对全面的流程时，倾向于保留这两个独立节点。

### 3.2 每个环节的思考与取舍

以下是对每个环节的思考——每个环节都有多种可能的设计方向，我们选择的方向只是其中一种可能性，并说明选择的理由和放弃的东西。

#### 3.2.1 Explore：按风险调节

**思考方向：** 低风险变更允许跳过探索（学习 OpenSpec），高风险变更建议完整探索（学习 Superpowers 的 HARD-GATE 理念）。

**为什么这样思考：**
- Superpowers 的经验告诉我们：agent 会走捷径跳过探索，HARD-GATE 能防止"方向错误"这个最高代价的失败。v3.4.0 曾放松约束，v4.3.0 又加回——这个弯路很有启发。
- 但 OpenSpec 的经验也告诉我们：简单任务不需要完整探索——一个 typo 修复不需要 brainstorming。Enablers not Gates 的弹性有其适用场景。
- ECC 的 Quick Capture vs Full Brief 和 mattpocock 的 Wayfinder no-fog early exit 告诉我们：按风险调节是可行的——已有项目在这个方向上探索。

**取舍：**
- 选择了弹性 → 放弃了"每个任务都经过探索"的绝对保障（学习 Superpowers 的纪律，但不采用它的刚性）
- 选择了风险分级 → 引入了"风险由谁判断"的未解决问题（agent 可能误判，用户可能低估）
- 我们能做的：提供风险自检清单作为参考，但承认这不能完全解决问题

**学习来源：** Superpowers（HARD-GATE 理念和 v3.4.0→v4.3.0 弯路教训）、OpenSpec（弹性理念）、ECC（两种深度的探索）、mattpocock（Wayfinder early exit、事实/决策分离原则）

#### 3.2.2 Spec：Delta 机制 + 渐进式结构化

**思考方向：** 尝试学习 OpenSpec 的 Delta 机制（只描述变更），探索产出渐进式结构化（从对话到 AC 到正式 spec）。

**为什么这样思考：**
- OpenSpec 的 Delta 机制是五个项目中唯一让 spec 不过时的设计——每次变更只描述 ADDED/MODIFIED/REMOVED，archive 时合并回 source of truth。其他四个项目的 spec 都是一次性的，长期维护时会过时。这是一个值得学习的方向。
- 渐进式结构化试图同时避免两个弯路——OpenSpec 早期的"过早结构化"和 mattpocock 的"完全无结构"（探索结果在 context compaction 后丢失）。
- ECC 的 AC-NNN 格式（Scenario + Action + Expected + Must not + Verification + Priority）提供了可观察的验收标准，可以作为 spec 的核心结构参考。

**取舍：**
- 选择了 Delta 机制 → 增加了 spec 格式的学习成本（用户需要理解 ADDED/MODIFIED/REMOVED 语法）
- 选择了渐进式 → 在探索阶段可能产出不够精确，需要在 Spec 阶段补充
- 我们能做的：提供 spec 模板降低格式学习成本，但承认学习成本无法完全消除

**学习来源：** OpenSpec（Delta 机制、Progressive Rigor、Enablers not Gates）、ECC（AC-NNN 格式）、mattpocock（CONTEXT.md 共享词汇）

#### 3.2.3 Plan：中等粒度 + Global Constraints

**思考方向：** 任务粒度介于 Superpowers 的 bite-sized steps（2-5 分钟）和 mattpocock 的 tracer-bullet tickets（一个 context window）之间，附加 Global Constraints。

**为什么这样思考：**
- Superpowers 的 2-5 分钟粒度非常精细，每个 step 都 dispatch fresh subagent。对于需要高度隔离的复杂任务，这种粒度是合理的；但对于中等复杂度的任务，可能导致过多的 subagent 切换。
- mattpocock 的一个 context window 粒度较粗，适合验证可行性（tracer-bullet），但如果一个 task 失败，整个 context window 的工作都受影响。
- 中等粒度（一个 task = 一个逻辑变更单元，约 15-30 分钟）是一种折中尝试——足够小让每个 task 可验证，足够大避免过度切换。这个"中间值"是否最优，我们并不确定——它只是两种极端之间的一种可能性。
- Global Constraints（跨任务的约束如编码标准、测试要求）来自 Superpowers，是一个值得保留的设计——它让所有任务遵循一致的标准，而不需要在每个 task 中重复说明。

**取舍：**
- 选择了中等粒度 → 既不是最细也不是最粗，可能两种场景都不是最优
- 选择了 Global Constraints → 增加了 plan 的复杂度但提高了执行一致性
- 我们能做的：提供 plan 模板，预设常见的 Global Constraints，让用户按需调整

**学习来源：** Superpowers（Global Constraints、bite-sized 理念）、mattpocock（tracer-bullet 理念、DAG 依赖）、ECC（planner agent 的 Phase+Step+Risk 结构）

#### 3.2.4 Execute：TDD + 可选 subagent 隔离

**思考方向：** 建议强制 TDD（学习 Superpowers 的 Iron Law），subagent 隔离可选（学习 Superpowers 的 SDD，但不强制 fresh subagent per task）。

**为什么这样思考：**
- Superpowers 的 Iron Law 经验告诉我们：强制 TDD 能防止"虚假完成声明"——agent 必须运行测试并展示结果（fresh evidence），不能只说"应该可以工作"。这个弯路教训值得学习。
- OpenSpec 的纯 checkbox 勾选经验告诉我们：无执行纪律时 agent 会走捷径——勾选 checkbox 不等于代码真的工作。
- 但 Superpowers 的 fresh subagent per task 对简单任务可能过重——每次 dispatch 都有开销。我们尝试折中：TDD 作为建议（高风险变更强制），subagent 隔离可选（按任务复杂度选择）。

**取舍：**
- 选择了建议 TDD → 增加了执行时间，但质量更有保障（学习 Superpowers 的经验）
- 选择了可选 subagent → 放弃了"绝对避免 context pollution"的保障（学习 Superpowers 的 SDD 但不强制）
- 我们能做的：对复杂任务推荐 subagent 隔离，提供判断参考（如"涉及 3+ 文件的变更推荐 subagent"）

**学习来源：** Superpowers（Iron Law、SDD、file handoffs）、mattpocock（vertical slice 执行策略）、ECC（tdd-workflow 的 RED→GREEN→Refactor 循环）

#### 3.2.5 Review：per-task + 双轴审查

**思考方向：** 每个 task 完成后进行 review（学习 Superpowers 的 per-task gate），双轴审查——代码质量 + 需求忠实度（学习 mattpocock 的双轴 review）。

**为什么这样思考：**
- Superpowers 的 per-task gate 经验告诉我们：在每个 task 完成后审查比在整个 branch 完成后审查更有效——问题更早发现，修复成本更低。
- mattpocock 的双轴审查（Standards + Spec）告诉我们：代码质量和需求忠实度是两个正交维度——代码可能写得很好但偏离了 spec，也可能忠实于 spec 但代码质量差。
- OpenSpec 的经验提醒我们：非强制的 review 容易被跳过——当 review 不阻断时，它很容易变成"人工扫一眼"然后略过。

**取舍：**
- 选择了 per-task → 增加了 review 频率（开销），但问题更早发现
- 选择了双轴 → 增加了 review 复杂度，但覆盖更全面
- 选择了 Critical/Important 建议修复 → 增加了流程停顿，但试图防止关键问题流入下游
- 我们能做的：低风险变更允许简化 review（只做 Standards 轴），高风险变更建议双轴

**学习来源：** Superpowers（per-task gate、Critical/Important 分级）、mattpocock（双轴 review: Standards + Spec）、ECC（多语言专用 reviewer 的思路）、gstack（跨模型审查的理念）

#### 3.2.6 Verify：独立节点 + fresh evidence

**思考方向：** Verify 作为独立节点（不嵌入 Execute），建议 fresh evidence（学习 Superpowers 的 Iron Law）。

**为什么这样思考：**
- Superpowers 的 Iron Law 经验告诉我们：独立 verify + fresh evidence 能防止"应该可以工作"的虚假确认。agent 必须运行验证命令并展示实际输出，不能只引用 TDD 的 green。
- mattpocock 将 verify 嵌入 implement 的 TDD red-green——这混淆了"单元测试通过"和"系统真的按预期工作"。TDD green 只证明代码符合测试，不证明系统满足 spec。当然，对于 mattpocock 的场景这可能是合理的取舍——只是我们在探索相对全面的流程时，倾向于保留独立 verify。
- 独立 verify 可以关注端到端验证（学习 gstack 的 `/qa` 浏览器端到端验证），而不仅是单元测试。
- ECC 的 delivery-gate hook 经验告诉我们：机械化阻断比"建议"更有效——但我们也注意到 gstack 的弯路（纯信息可视化有时不够），所以在高风险场景下考虑引入阻断。

**取舍：**
- 选择了独立 → 增加了一个流程节点（开销），但验证更彻底
- 选择了 fresh evidence → 要求 agent 运行验证命令并展示结果，增加了执行时间
- 我们能做的：对低风险变更允许简化验证（只运行已有测试），高风险变更建议端到端验证

**学习来源：** Superpowers（Iron Law、fresh evidence）、gstack（`/qa` 端到端验证、`/benchmark` 性能验证）、ECC（delivery-gate hook 的机械化思路）

#### 3.2.7 Archive：Delta 合并 + 知识归档

**思考方向：** Archive 时尝试 Delta 合并（学习 OpenSpec）+ 知识归档（学习 ECC 的 instinct 和 gstack 的 learnings）。

**为什么这样思考：**
- OpenSpec 的 Delta 合并是唯一让 spec 持续演进的设计——archive 时将 delta 合并回 source of truth，spec 随变更有机增长。这个方向值得学习，因为 spec 过时是长期维护中的真实痛点。
- ECC 的 instinct 提取和 gstack 的 learnings 归档让流程随使用积累经验——"已决定的事不再重新讨论"（gstack 的 decisions.jsonl）、"从失败中学习"（ECC 的 instinct → skill 演化）。这些知识归档机制为长期维护提供了价值。
- mattpocock 的 handoff 是轻量的跨 session 传递，传递的是"当前工作状态"而非"学到了什么"——这对短期工作有用，但不形成长期知识。
- Superpowers 的 finishing-a-development-branch 提供了清晰的分支管理策略（merge/PR/keep/discard），可以作为 Archive 的分支管理参考。

**取舍：**
- 选择了 Delta 合并 → 增加了 archive 的复杂度（需要合并逻辑），但 spec 不会过时
- 选择了知识归档 → 增加了一个归档维度，但提供了长期价值
- 我们能做的：Delta 合并尽量自动化，知识归档轻量化（只记录关键决策和教训，不追求全面）

**学习来源：** OpenSpec（Delta 合并、change 文件夹归档）、ECC（instinct 提取、continuous-learning-v2）、gstack（learnings.jsonl、decisions.jsonl、/retro 回顾）、Superpowers（finishing-a-development-branch 分支管理）、mattpocock（handoff 跨 session 传递）

### 3.3 环节之间的衔接机制

**思考方向：** 采用文件系统持久化为主、context window 传递为辅的混合衔接机制。

**为什么这样思考：**

从五项目的实践中可以提取出三种衔接机制，各有适用场景：

| 机制 | 代表项目 | 适合的场景 | 不适合的场景 |
|------|---------|-----------|------------|
| 文件系统持久化 | gstack, OpenSpec | 需要跨 session、可审计的长期项目 | 轻量快速的临时工作 |
| Context window 传递 | mattpocock, Superpowers | 轻量、无 I/O 开销的连续工作 | context compaction 后需要恢复的场景 |
| Git commit 传递 | gstack (Continuous Checkpoint), ECC (GATE) | 需要 bisect、可追溯的场景 | 不想产生噪音 commit的场景 |

我们尝试的混合方向——关键 artifact 持久化到文件系统，临时信息留在 context window：

| 节点衔接 | 衔接方式 | 理由 |
|---------|---------|------|
| Explore → Spec | Context window | 探索结果自然流入 spec 创作，不需要持久化 |
| Spec → Plan | 文件系统持久化 | Spec 是 source of truth，需要持久化供 Plan 读取 |
| Plan → Execute | 文件系统持久化 | Plan 驱动执行，需要跨 task 可读 |
| Execute → Review | Git diff | 代码变更是 review 的输入，git diff 是天然载体 |
| Review → Verify | Context window | Review findings 自然流入验证，不需要持久化 |
| Verify → Archive | 文件系统持久化 | 验证结果需要记录，供 Archive 参考 |
| Archive → 下一个 sprint | 文件系统持久化 | Spec source of truth + knowledge base 需要跨 session |

**取舍：**
- 选择了混合机制 → 比纯 context window（mattpocock）更持久，比纯文件系统（gstack）更轻量
- 关键 artifact（spec、plan、knowledge）持久化，临时信息（探索共识、review findings）留在 context
- 我们能做的：提供 artifact 路径约定模板，降低路径复杂度

### 3.4 思考方向汇总

以下是我们流程思考的方向汇总，每条都标注了学习来源和取舍理由——需要强调的是，这些只是我们尝试的方向，不是"正确答案"：

| # | 思考方向 | 学习来源 | 取舍理由 |
|---|---------|---------|---------|
| 1 | 7 个关键环节（Explore → Archive） | 五项目共同模式 | 尝试覆盖自然复杂度，去掉任何一个都可能导致某方面缺少关注 |
| 2 | 按风险等级调节 | ECC + Superpowers | 试图同时回应"简单任务过重"和"复杂任务缺保障" |
| 3 | Delta 机制 spec 持续演进 | OpenSpec | 唯一让 spec 不过时的设计，值得学习 |
| 4 | 渐进式结构化 | OpenSpec | 试图避免过早结构化和完全无结构两个弯路 |
| 5 | 中等粒度任务（15-30 分钟/task） | Superpowers + mattpocock | 在两种极端之间的一种折中尝试 |
| 6 | Global Constraints | Superpowers | 让所有任务遵循一致标准 |
| 7 | 建议强制 TDD | Superpowers | 学习 Iron Law 防止虚假完成声明 |
| 8 | 可选 subagent 隔离 | Superpowers | 按任务复杂度选择，避免对所有任务过重 |
| 9 | per-task review + 双轴 | Superpowers + mattpocock | 问题更早发现 + 覆盖更全面 |
| 10 | 独立 verify + fresh evidence | Superpowers | 学习 Iron Law 防止"应该可以工作" |
| 11 | Delta 合并 + 知识归档 | OpenSpec + ECC + gstack | spec 不过时 + 流程积累经验 |
| 12 | 混合衔接机制 | gstack + mattpocock | 关键 artifact 持久化，临时信息轻量传递 |
| 13 | 默认链式 + 可拆解 | OpenSpec + gstack | 尝试在完整性和弹性之间折中 |
| 14 | 行为约束 + Artifact 治理混合 | Superpowers + OpenSpec | 试图兼得轻量约束和可审计性 |

---

## 4. 流程全景图

### 4.1 七节点流程模型

基于以上思考，我们尝试提出以下 AI 研发流程模型——这只是一个供讨论的框架，不是定论：

```
┌─────────┐    ┌────────┐    ┌───────┐    ┌─────────┐    ┌────────┐    ┌────────┐    ┌─────────┐
│ Explore │───→│  Spec  │───→│ Plan  │───→│ Execute │───→│ Review │───→│ Verify │───→│ Archive │
│         │    │        │    │       │    │         │    │        │    │        │    │         │
│ 模糊→   │    │ 意图→  │    │ 规格→ │    │ 任务→   │    │ 实现→  │    │ 实现→  │    │ 完成→   │
│ 精确    │    │ 契约   │    │ 任务  │    │ 实现    │    │ 确认   │    │ 验证   │    │ 闭环    │
└─────────┘    └────────┘    └───────┘    └─────────┘    └────────┘    └────────┘    └─────────┘
     ↑              ↑             ↑             ↑              ↑             ↑             ↑
     │              │             │             │              │             │             │
  目标：          目标：        目标：        目标：         目标：        目标：        目标：
  问题定义       行为规格      任务序列      可运行代码     审查发现       验证证据      闭环归档

  输入：需求      输入：问题     输入：spec    输入：plan     输入：diff     输入：代码    输入：验证
  + 代码库        + 代码库      + 代码结构     + 代码库       + spec        + test plan   + 审查
                                                                                  + commit
  输出：问题      输出：规格     输出：任务     输出：代码     输出：findings 输出：结果    输出：合并
  定义           文档          清单          + 测试                       + 证据        + 学习
```

### 4.2 节点依赖关系

```
Explore ──→ Spec ──→ Plan ──→ Execute ──→ Review ──→ Verify ──→ Archive
                                          ↑            │
                                          └────────────┘
                                       (Review 发现问题可回到 Execute)
```

**线性依赖（所有节点共同）：**
- Explore → Spec → Plan → Execute → Review → Verify → Archive

**回环依赖：**
- Review → Execute：Review 发现 Critical/Important 问题，回到 Execute 修复
- Verify → Execute：验证失败，回到 Execute 修复

**跨节点跳跃（按风险等级调节）：**
- 低风险变更：可跳过 Explore（直接从 Spec 开始）
- 修复类变更：可跳过 Explore + Spec（直接从 Plan 开始，基于已有 spec）
- 紧急修复：可跳过 Explore + Spec + Plan（直接 Execute，事后补 spec）

### 4.3 每个节点的核心张力

每个节点都存在一个核心张力——这是后续笔记 08-13 将深入讨论的主题。我们的选择只是众多可能性中的一种：

| 节点 | 核心张力 | 我们尝试的方向 | 学习来源 |
|------|---------|--------------|---------|
| **Explore** | 强制 vs 自由 | 按风险调节——低风险自由，高风险建议强制 | Superpowers + OpenSpec + ECC |
| **Spec** | 结构化 vs 自由格式 | 渐进式——从对话到 AC 到 Delta spec | OpenSpec + ECC |
| **Plan** | 精细 vs 粗粒度 | 中等粒度（15-30 分钟/task）+ Global Constraints | Superpowers + mattpocock |
| **Execute** | 强制纪律 vs 信任 agent | 建议 TDD + 可选 subagent 隔离 | Superpowers + mattpocock |
| **Review** | 阻断 vs 信息 | per-task + 双轴 + Critical/Important 建议修复 | Superpowers + mattpocock |
| **Verify** | 独立 vs 嵌入 | 独立节点 + fresh evidence | Superpowers + gstack |
| **Archive** | spec 闭环 vs 知识归档 | 两者都尝试——Delta 合并 + 知识归档 | OpenSpec + ECC + gstack |

### 4.4 流程设计的三个正交维度

从全景图的分析中，可以提炼出流程设计的三个正交维度：

1. **强制程度**：从"无强制"（OpenSpec/mattpocock）到"行为强制"（Superpowers）到"人工 GATE"（ECC）到"信息可视化"（gstack）——我们尝试**按风险调节**，试图从各自的经验中学习

2. **Artifact 持久性**：从"context window 内"（mattpocock）到"文件系统"（gstack/Superpowers）到"结构化 source of truth"（OpenSpec）——我们尝试**混合模式**，关键 artifact 持久化，临时信息留在 context

3. **角色分工**：从"单一 agent"（OpenSpec/mattpocock）到"controller + subagent"（Superpowers）到"67 专门化 agents"（ECC）到"8+ 工程角色"（gstack）——我们尝试**轻量分工**，controller + implementer + reviewer 三角色，按需扩展

这三个维度的组合定义了流程的"重量"。我们的探索目标是在"高流程完整性"和"高使用轻量性"之间找到一个可能的平衡点——但我们清醒地认识到，这个"平衡点"本身就是一种新的取舍，它在两边都不最优，只是试图尽量不出现大的漏洞。

---

## 5. 承上启下：后续章节导览

### 5.1 从分析到探讨的转折

本篇是整个系列的转折点：

- **前五篇（02-06）** 是"分析"——逐个拆解五个项目的架构、设计哲学和实践细节，理解它们各自"为什么这样设计"
- **本篇（07）** 是"综合与探讨"——横向对比五个项目的设计取向和取舍，尝试从各自的经验中学习，探索一种可能的流程思路
- **后六篇（08-13）** 是"深入讨论"——逐个节点展开讨论，每个环节有哪些可能的设计方向、各自的取舍是什么

### 5.2 后续章节的讨论框架

后续每个节点章节（08-13）将遵循统一的讨论框架：

1. **对比分析**：五个项目在该节点上的具体做法和关键差异
2. **关键差异**：从核心维度（强制程度、产出形式、深度调节等）对比
3. **实践方向讨论**：基于对比，讨论该节点的可能实践方向
4. **案例映射**：将弯路教训映射到实践方向，验证思考的合理性

各章节主题如下：

| 章节 | 节点 | 核心问题 |
|------|------|---------|
| 08 | Explore | 从模糊到精确——探索阶段的强制程度、产出形式和深度调节 |
| 09 | Spec | 从意图到行为契约——spec 的格式化程度、Delta 机制和质量保障 |
| 10 | Plan | 从规格到任务——任务粒度、依赖表达、Global Constraints 和审批机制 |
| 11 | Execute | 从任务到实现——TDD 强制、subagent 隔离、异常处理和 context 管理 |
| 12 | Review & Verify | 从实现到确认——审查时机/维度/阻断、验证独立性/维度/证据 |
| 13 | Archive | 从完成到闭环——Delta 合并、分支管理、知识归档和环境清理 |

### 5.3 本篇的核心思考

回顾本篇的核心思考——需要再次强调，这只是一个可能性的探讨，不是定论：

> **我们的流程思考不是凭空创造的，而是试图从五个项目各自的经验和弯路中学习。每个设计方向都有明确的学习来源和取舍理由。我们不确定这是"正确"的做法——它只是众多可能性中的一种尝试。**

- 从 **Superpowers** 学习了行为约束的纪律（HARD-GATE、Iron Law、per-task review）——它的弯路告诉我们 agent 会走捷径；但我们也注意到它对所有任务走完整流程的刚性可能过重
- 从 **OpenSpec** 学习了 spec 持续演进的 Delta 机制和渐进式结构化——它的弯路告诉我们不能过早结构化；但我们也注意到它无执行纪律可能在 agent 不可靠时出问题
- 从 **ECC** 学习了按风险调节的思想（Size classifier）和知识归档（instinct）——它的弯路告诉我们覆盖面需要配合选择性；但我们也注意到它的素材膨胀对新用户不友好
- 从 **mattpocock** 学习了轻量可组合的设计和事实/决策分离——它的弯路告诉我们可复用原语需要明确责任边界；但我们也注意到它无流程保障可能让不熟悉流程的用户跳过关键步骤
- 从 **gstack** 学习了端到端覆盖的完整性和多角色审查的价值——它的弯路告诉我们纯信息可视化有时不够；但我们也注意到它的重量级门槛可能限制适用场景

这个从各自经验中学习的过程不是简单的拼凑——每个学习都经过了"为什么这个方向值得尝试"的思考和"放弃了什么"的取舍分析。同时，我们也清醒地认识到，这个尝试本身可能会走入新的弯路——这是任何探索都无法完全避免的。后续六篇（08-13）将逐个节点展开这些思考和取舍的细节，欢迎读者批判性地审视我们的每一项选择。
