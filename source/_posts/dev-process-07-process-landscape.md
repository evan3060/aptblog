---
title: AI研发流程深度解析（七）：横向对比与流程体系探讨——承上启下
description: 对五个项目做全景式横向对比，理解各自的设计取向和取舍，尝试探索一种相对全面而不失灵活的AI研发流程思路。
tags:
  - 研发流程
  - 横向对比
  - 流程设计
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-12
> **核心问题：** 五个项目各自的设计取向和取舍是什么？我们能从各自走过的弯路中学到什么？如何尝试探索一种相对全面而不失灵活的AI研发流程思路？

---

![AI研发流程深度解析（七）：横向对比与流程体系探讨——承上启下](/images/dev-process/dev-process-07-process-landscape.png)

## 1. 五项目横向对比

前五篇笔记分别深度拆解了Superpowers、OpenSpec、ECC、mattpocock-skills和gstack的架构、设计哲学和实践细节。在进入节点级设计之前，我们需要先做一个全景式的横向对比——理解每个项目的关注侧重点、解决的核心问题、设计亮点与取舍代价。需要强调的是，每个项目的"取舍"都不是缺点，而是其独特定位下的合理选择——正如一个专注于行为约束的系统不应该被批评"不够灵活"，因为灵活性从来不是它的设计目标。

### 1.1关注侧重点对比

五个项目虽然都涉及AI辅助研发流程，但它们的关注焦点截然不同：

| 项目 | 核心关注点 | 一句话定位 |
|------|-----------|-----------|
| **Superpowers** | 行为塑造——如何用纯Markdown指令可靠地约束agent行为 | Skill即行为塑造 |
| **OpenSpec** | 共识管理——如何在人机之间建立"先同意再构建"的契约 | Spec即共识契约 |
| **ECC** | 素材供给——如何提供足够丰富的agent素材覆盖所有场景 | Agent素材大全 |
| **mattpocock** | 方法论原语——如何提供小巧可组合的工程师技能 | 小而可组合的工程师技能 |
| **gstack** | 全流程覆盖——如何把AI变成完整的虚拟工程团队 | 虚拟工程团队 |

这些定位不是标签，而是深刻的设计决策——每个项目都在自己的问题空间中做出了深思熟虑的选择：

- **Superpowers** 的所有设计都围绕一个问题：agent不可靠时怎么办？HARD-GATE、Iron Law、Rationalization表、Red Flags——每一个机制都是对agent "走捷径"行为的直接防御。它的14个skill构成一条强制的线性链，从brainstorming到finishing-a-development-branch，不允许跳过任何环节。这种"不信任agent"的取向是经过实战验证的——v3.4.0曾放松约束，v4.3.0又加回，因为agent确实会走捷径。

- **OpenSpec** 的所有设计都围绕一个问题：如何让spec成为持续演进的source of truth？Delta机制（ADDED/MODIFIED/REMOVED）、change文件夹、archive合并——每一个机制都服务于"spec随变更有机增长"这个核心目标。它选择不定义流程——"Enablers not Gates"意味着用户可以跳过任何阶段。这种"信任用户判断"的取向有其道理——OpenSpec的用户群体已经认同"先同意再构建"的理念。

- **ECC** 的所有设计都围绕一个问题：如何覆盖尽可能多的场景？261+ skills、67 agents、94 commands、6种hooks——它的架构是围绕素材供给而非工作流设计的。它选择不定义流程，而是提供足够丰富的素材让用户自行组合。覆盖面广是其设计追求，而认知负担重则是这一取向的自然代价——两者是同一个硬币的两面。

- **mattpocock** 的所有设计都围绕一个问题：如何提供最小可用的工程方法论原语？grilling（一次一问）、事实/决策分离、tracer-bullet tickets、vertical slice——每个skill都是独立可组合的工具。它明确"不拥有流程"，用户决定何时调用什么。这种"把控制权交给用户"的取向反映了Matt Pocock作为独立工程师的实践哲学——他需要的是轻量工具，不是流程框架。

- **gstack** 的所有设计都围绕一个问题：如何端到端覆盖从Think到Reflect的完整工程流程？23+ skills、8个power tools、sprint链式传递、Dashboard可视化——它的每个设计都服务于"把Claude Code变成虚拟工程团队"这个目标。它拥有最完整的流程覆盖，重量级则是这种全面性的自然代价——Garry Tan在60天内交付3个生产服务的场景，需要的正是这种全流程工具。

### 1.2解决的核心问题对比

每个项目选择解决的核心问题不同，这决定了它们的设计取向：

| 项目 | 解决的核心问题 | 选择不覆盖的领域 |
|------|--------------|-------------|
| **Superpowers** | Agent不可靠——会跳过探索、虚假完成声明、走捷径 | Spec持续演进、多角色分工、跨session状态 |
| **OpenSpec** | Spec与实现脱节——spec写完就过时，实现偏离spec | Agent行为约束、执行纪律、多角色审查 |
| **ECC** | 场景覆盖不足——通用agent在特定领域表现不佳 | 流程定义、轻量级使用、快速上手 |
| **mattpocock** | 工具过于复杂——用户需要轻量、可组合的工程方法论 | 全流程覆盖、spec持续演进、多角色团队 |
| **gstack** | 流程断裂——从设计到上线缺乏端到端覆盖 | 轻量级使用、快速上手、低认知负担 |

**关键观察：** 每个项目都是在自己的"问题空间"中做到最优——Superpowers在行为约束上最深入，OpenSpec在spec治理上最独创，ECC在场景覆盖上最丰富，mattpocock在方法论轻量性上最精炼，gstack在流程完整性上最全面。它们选择不覆盖的领域不是疏忽，而是有意为之——任何设计都有边界，试图覆盖一切的系统往往什么也做不好。这启发我们思考：是否有可能从各自的经验中学习，尝试探索一种相对全面的思路？当然，这种探索本身也只是众多可能性中的一种。

### 1.3设计取舍分析

与其用"优势/劣势"来评判五个项目，不如理解每个项目的"设计亮点"和"取舍代价"——亮点是它在这个方向上做到了什么程度，代价是它为了做到这个程度而放弃了什么。每个取舍都是合理的，只是在特定的使用场景下才显现为"合适"或"不合适"。

#### Superpowers

**设计亮点：**
- **行为约束最彻底**：HARD-GATE阻止跳过探索，Iron Law阻止虚假完成声明，per-task review gate确保每个任务都被审查。这套机制对agent的"走捷径"行为形成了多层防御。
- **失败驱动的设计迭代**：每个设计决策都有对应的失败教训。v3.4.0简化brainstorming → v4.3.0加回HARD-GATE，因为agent会跳过。这种"从失败中学习"的设计方式让每个机制都有明确的针对性。
- **纯Markdown驱动**：不依赖外部工具或复杂基础设施，任何支持Markdown的AI平台都能使用。跨平台适配覆盖10个平台。
- **File handoffs设计**：subagent之间通过文件传递信息（task-brief, report, review-package），不共享context，避免了context pollution。

**取舍代价：**
- **Spec不持续演进**：spec是一次性的设计文档，不会随变更更新。这是Superpowers的设计取向决定的——它关注的是"当前任务的行为约束"，spec持续演进是OpenSpec的关注点，两者解决的问题不同。
- **流程刚性**：所有项目都必须走完整流程（brainstorm → design → plan → SDD → review → verify → finish）。这是HARD-GATE设计的必然代价——要确保agent不走捷径，就不能允许跳过任何环节。简单任务也走完整流程确实偏重，但Superpowers认为这个代价是值得的。
- **无人工GATE**：流程一旦启动就自动运行到结束，没有人工审批节点。Superpowers的设计哲学是"用指令约束agent"而非"用人类把关"——这是一种有意识的选择。
- **单一角色**：只有controller、implementer、reviewer三个角色，没有领域专家分工。Superpowers面向的是单人 + 单AI agent的深度协作场景，多角色分工不是它的目标。

#### OpenSpec

**设计亮点：**
- **Delta机制**：唯一将Brownfield作为first-class概念的项目。spec只描述变更（ADDED/MODIFIED/REMOVED），archive时合并回source of truth。这让spec成为系统当前行为的持续记录，不会过时。
- **工具化程度最高**：41个核心模块、CLI验证、结构化schema、30+ AI工具适配器。Artifact有明确的格式和验证规则。
- **渐进式结构化**：Enablers not Gates——用户可以跳过任何阶段。探索阶段不强制产出，propose阶段才需要结构化artifact。
- **可审计性强**：每个change都是一个文件夹，包含proposal、design、specs/ delta、tasks。archive后保留为历史记录。

**取舍代价：**
- **无执行纪律**：`/opsx:apply` 只是逐项勾选checkbox，没有TDD强制、没有subagent隔离、没有per-task review。OpenSpec的设计哲学是"治理artifact而非约束行为"——它信任用户和agent会正确实现，重点在于spec的正确性而非执行过程。
- **无强制机制**：verify明确"不阻断"，review是人工扫一眼。这是 "Enablers not Gates" 的直接体现——OpenSpec认为强制会阻碍灵活性，用户应该自行决定何时做什么。
- **认知门槛**：用户需要理解"终端命令"和"聊天命令"的区别、change文件夹结构、delta语法。这是工具化程度的代价——越结构化的系统学习成本越高。
- **无多角色审查**：只有一个AI agent + 人类，没有领域专家分工。OpenSpec关注的是"人机之间的共识"而非"多角色协作"。

#### ECC

**设计亮点：**
- **场景覆盖最广**：261+ skills覆盖从TDD到安全审查、从代码审查到持续学习。67个agents实现12语言专用审查 + 15个角色专家。
- **Gated pipeline**：两个GATE（计划审批 + commit确认）在关键节点要求人类确认。delivery-gate hook 100% 触发，可阻断。
- **持续学习**：continuous-learning-v2的instinct机制自动从会话中提取模式，让流程随使用越来越智能。
- **权限隔离**：Agent的 `tools` 字段实现权限隔离——planner只有Read/Grep/Glob权限，不能修改文件。

**取舍代价：**
- **认知负担重**：261+ skills、67 agents、94 commands、6种hooks——用户需要理解五层素材体系（Skills/Agents/Commands/Hooks/Rules）及其关系。这是"素材供给"取向的必然代价——覆盖面越广，素材越多，学习曲线越陡。
- **不定义流程**：虽然orch-* pipeline定义了6个Phase，但ECC整体的定位是"提供素材不定义流程"。这是一个有意识的选择——ECC认为"不同场景需要不同流程"，与其定义一个通用流程，不如提供足够的素材让用户自行组合。
- **重量级安装**：manifest-driven selective install虽然支持选择性安装，但完整安装的素材量仍然庞大。
- **素材维护负担**：67个agents中有多少是日常使用的？素材膨胀可能带来维护负担。这是"追求覆盖"的自然代价。

#### mattpocock-skills

**设计亮点：**
- **最轻量**：promoted skills数量适中（约20个），每个skill聚焦一个方法论原语。零基础设施依赖。
- **可组合性最高**：skills完全独立，用户自由组合。grilling是可复用原语——被to-spec、to-tickets等内部调用。
- **事实/决策分离**：能从代码推断的技术事实agent自己查，产品/业务约束必须问用户。这明确了责任边界，减少了交互成本。
- **User-invoked vs Model-invoked**：清晰的触发方式区分，控制context load和触发可靠性的tradeoff。
- **实践验证**：每个skill都经过Matt Pocock的日常工程实践验证，不是理论设计。

**取舍代价：**
- **无流程保障**：明确"不拥有流程"，用户完全自主编排。这是"把控制权交给用户"的设计取向的直接结果——mattpocock认为流程应该由了解上下文的人决定，而非由工具强制。对于不熟悉流程的用户，这可能意味着跳过关键步骤，但mattpocock的目标用户是有经验的工程师。
- **Spec不持续演进**：spec是一次性的PRD，不会随变更更新。mattpocock关注的是"当前任务的工程方法论"，spec持续演进不在其设计范围内。
- **无多角色审查**：1-2个角色（AI agent + 可选第二个subagent for review），没有领域专家分工。个人工程师的日常工具不需要多角色团队。
- **验证嵌入而非独立**：验证嵌入implement的TDD red-green，没有独立的verify节点。这是"轻量"取向的代价——减少一个节点就减少一份开销，但代价是验证维度可能不够全面。

#### gstack

**设计亮点：**
- **全流程覆盖最完整**：Think → Plan → Build → Review → Test → Ship → Reflect七阶段，23+ skills + 8 power tools。从设计到上线到回顾，每个环节都有专门skill。
- **多角色审查**：CEO、Eng Manager、Designer、Staff Engineer、QA Lead、Security Officer、Release Engineer、SRE——8+ 个工程角色，每个角色有专门的plan review。
- **Sprint链式传递**：每个skill的产出通过文件系统持久化artifact喂给下一个。Context Recovery自动恢复近期artifact。
- **Dashboard可视化**：Review Readiness Dashboard显示流程状态，让用户看到哪些环节已完成、哪些缺失。
- **跨模型审查**：`/review`（Claude）+ `/codex`（OpenAI）实现跨模型交叉审查。
- **知识归档**：decisions.jsonl、learnings.jsonl、timeline.jsonl让"已决定的事不再重新讨论"。

**取舍代价：**
- **最重量级**：23+ skills + 8 power tools + 170行preamble + 模板系统 + 多路径artifact。认知负担和基础设施依赖都最高。这是"全流程覆盖"取向的必然代价——要覆盖从Think到Reflect的每个环节，就需要足够多的skills和tools。
- **门槛最高**：用户需要理解sprint结构、preamble、模板系统、artifact路径约定、Dashboard状态。gstack面向的是需要完整工程团队流程的场景，不是简单任务的快速工具。
- **Spec不持续演进**：spec是全量的设计文档，没有Delta机制。CEO计划和设计文档是工程artifact而非行为契约。gstack关注的是"从设计到上线的全流程"，spec持续演进是OpenSpec的关注点。
- **强制程度有限**：除了Eng Review required（可禁用），大部分环节是"信息可视化"而非"阻断"。gstack的设计哲学是"User Sovereignty——AI recommend, users decide"，阻断与这一哲学相悖。

### 1.4关键设计维度对比

除了上述分析，我们还可以从几个正交维度对五个项目进行横向对比。这些维度不是为了评判高下，而是为了理解不同设计取向在这些维度上的具体表现：

#### 1.4.1流程控制范式

| 维度 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **控制方式** | 行为塑造（SKILL.md指令） | Artifact治理（结构化文件 + CLI验证） | 混合（skills + hooks + GATE） | 无（用户编排） | Sprint链式（文件持久化 + preamble） |
| **控制器** | SDD controller | 无（用户驱动） | orch-* pipeline | 无（用户编排） | sprint结构 + autoplan |
| **强制程度** | 最高（HARD-GATE + Iron Law） | 最低（Enablers not Gates） | 高（GATE 1+2 + delivery-gate） | 最低（不拥有流程） | 中（Dashboard可视化，少量阻断） |

#### 1.4.2 Artifact持久性

| 维度 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **持久化方式** | 文件系统（task-brief, report） | 文件系统（change文件夹 + specs/） | Context + handoff + instinct | Context window（大部分）+ handoff | 文件系统 + Git commit |
| **跨session** | 部分（design doc持久化） | 是（change文件夹持久化） | 部分（instinct持久化） | 弱（handoff手动触发） | 是（全部artifact持久化） |
| **Spec演进** | 无（一次性设计文档） | 有（delta合并回source of truth） | 无（一次性AC） | 无（一次性PRD） | 无（一次性design doc） |

#### 1.4.3角色分工

| 维度 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **角色数** | 3（controller, implementer, reviewer） | 1（AI agent + 人类） | 67 agents（12语言 + 15角色） | 1-2（AI agent + 可选review subagent） | 8+（CEO, Eng, Design, DX, QA, Security, Release, SRE） |
| **分工方式** | 按流程阶段 | 无分工 | 按领域（语言 + 角色） | 无分工 | 按工程角色 |
| **subagent隔离** | 是（fresh subagent per task） | 否 | 是（委托给专门化agent） | 部分（review用第二个subagent） | 否（单context内运行） |

#### 1.4.4流程弹性vs纪律

```
弹性 ←─────────────────────────────────────────────→ 纪律

OpenSpec    mattpocock    gstack      ECC         Superpowers
(Enablers   (不拥有       (Dashboard  (GATE 1+2,  (HARD-GATE,
 not Gates) 流程)         可视化)     delivery)   Iron Law)
```

弹性和纪律没有绝对的好坏——弹性适合有经验的用户和简单任务，纪律适合不可靠的agent和复杂任务。五个项目在这个光谱上的位置反映了它们对"用户自主性vs流程保障"的不同权衡。

### 1.5五项目定位象限图

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

- **Superpowers**：流程完整性高（强制线性链），使用轻量性中等（纯Markdown但流程刚性）
- **gstack**：流程完整性最高（7阶段全覆盖），使用轻量性最低（23+ skills + 8 tools）
- **OpenSpec**：流程完整性中等（有artifact治理但无强制），使用轻量性中等（需要理解CLI + 目录约定）
- **ECC**：流程完整性低（不定义流程），使用轻量性低（认知负担重）
- **mattpocock**：流程完整性低（不拥有流程），使用轻量性最高（~20 skills，零基础设施）

**关键观察：** 没有项目同时做到"高流程完整性"和"高使用轻量性"——这并非设计失误，而是两者本身就存在张力。流程完整性要求覆盖更多环节、提供更多保障，这天然增加复杂度；使用轻量性要求减少认知负担和基础设施依赖，这天然意味着减少覆盖。这启发我们思考：是否有可能在两者之间找到一个相对平衡的位置？当然，任何"平衡"都是一种新的取舍——平衡意味着两边都不极端，也意味着两边都不最优。

---

## 2. 从经验中学习：尝试探索一种相对全面的流程思路

### 2.1从对比中看到的共同模式

尽管五个项目的设计取向差异巨大，但横向对比揭示了一些共同模式——这些模式不是任何单个项目的发明，而是AI研发实践的自然涌现：

**模式一：5-7个节点的自然复杂度**

尽管项目规模差异巨大（mattpocock ~20 skills vs gstack 23+ skills + 8 tools），显式步骤数都集中在5-7步。这暗示AI研发流程的自然复杂度大约在5-7个节点——更多节点会增加认知负担，更少节点会缺失关键环节。

| 项目 | 显式步骤数 |
|------|----------|
| Superpowers | ~7步（brainstorm → design → plan → SDD → review → verify → finish） |
| OpenSpec | ~6步（explore → propose → apply → review → verify → archive） |
| ECC | ~6 Phase + 2 GATE |
| mattpocock | ~5步（grill → spec → tickets → implement → review） |
| gstack | ~7阶段（Think → Plan → Build → Review → Test → Ship → Reflect） |

**模式二：核心节点的普遍存在**

所有项目都有某种形式的以下节点——尽管实现方式和名称差异巨大：

| 节点 | Superpowers | OpenSpec | ECC | mattpocock | gstack |
|------|------------|---------|-----|-----------|--------|
| **Explore** | brainstorming (HARD-GATE) | /opsx:explore (自由对话) | intent-driven-development | /grill-me (一次一问) | /office-hours (forcing questions) |
| **Spec** | design doc (自由Markdown) | proposal + specs/ delta | Acceptance Brief (AC-NNN) | /to-spec (PRD) | /spec (五阶段) |
| **Plan** | writing-plans (bite-sized) | tasks.md (checkbox) | planner agent (Phase+Step) | /to-tickets (tracer-bullet) | /plan-ceo-review + 多角色 |
| **Execute** | SDD (fresh subagent, TDD) | /opsx:apply (勾选) | tdd-workflow (RED→GREEN) | /implement (vertical slice) | Build (plan驱动) |
| **Review** | task-reviewer (per-task gate) | 人工review | code-reviewer (67 agents) | /code-review (双轴) | /review + /codex (跨模型) |
| **Verify** | verification (Iron Law) | /opsx:verify (不阻断) | delivery-gate (hook阻断) | 嵌入implement (TDD) | /qa (浏览器端到端) |
| **Archive** | finishing-a-branch | /opsx:archive (delta合并) | orch Phase 6 + instinct | commit + /handoff | /ship + /retro + /learn |

**模式三：流程控制的三种范式各有适用场景**

- **行为塑造**（Superpowers）：用指令约束agent行为——最轻量但最刚性，适合单人 + 单AI agent的深度协作
- **Artifact治理**（OpenSpec）：用结构化文件约束流程——最可审计但认知门槛高，需要spec持续演进的长期项目
- **Sprint链式**（gstack）：用文件持久化约束传递——最完整但最重量级，适合并行sprint + 虚拟团队场景

这三种范式没有高下之分，只有适用场景之分。我们的思考不是"选哪种范式"，而是"能否从每种范式中学习一点经验"。

**模式四：每个项目都走过弯路，弯路本身就是宝贵的经验**

五个项目的演进历史都记录了各自的弯路和修正，这些弯路比成功经验更有学习价值：

- **Superpowers** 的弯路：v3.4.0放松HARD-GATE → agent跳过探索 → v4.3.0加回。教训：agent会走捷径，不能完全信任。
- **OpenSpec** 的弯路：早期过度结构化 → 用户反馈"太重" → 逐步放松为 "Enablers not Gates"。教训：过早结构化会阻碍探索。
- **ECC** 的弯路：素材膨胀 → 用户反馈"不知道用哪个" → 引入manifest-driven selective install。教训：覆盖面需要配合选择性。
- **mattpocock** 的弯路：v1.1.0之前grilling在被其他skill调用时会替用户做决策 → 修复事实/决策分离。教训：可复用原语需要明确责任边界。
- **gstack** 的弯路：早期流程不强制 → Dashboard显示缺失但不阻止 → 用户仍然跳过 → 引入Eng Review required。教训：纯信息可视化有时不够。

### 2.2各项目设计取向的自然代价

从横向对比中，我们可以总结出每个项目的设计取向及其自然代价。需要再次强调，这些"代价"不是"缺点"——它们是设计取向的必然伴生物，正如选择了轻量就意味着放弃了一些保障，选择了全面就意味着增加了一些复杂度：

| 项目 | 设计取向 | 自然代价 | 弯路教训 |
|------|---------|---------|---------|
| **Superpowers** | 行为强制（HARD-GATE + Iron Law） | 流程刚性，简单任务也走完整流程 | v3.4.0放松 → agent跳过 → v4.3.0加回：不能完全信任agent |
| **OpenSpec** | 渐进式结构化（Enablers not Gates） | 无执行纪律，agent可靠性无保障 | 过度结构化 → 用户反馈"太重" → 逐步放松：不能过早结构化 |
| **ECC** | 场景全覆盖（261+ skills） | 认知负担重，新用户难以入门 | 素材膨胀 → "不知道用哪个" → selective install：覆盖面需要配合选择性 |
| **mattpocock** | 最大可组合性（不拥有流程） | 无流程保障，不熟悉流程的用户可能跳过关键步骤 | grilling替用户做决策 → 事实/决策分离：可复用原语需要明确边界 |
| **gstack** | 全流程覆盖（7阶段 × 23+ skills） | 重量级，门槛最高 | 纯信息可视化不够 → Eng Review required：有时需要少量强制 |

这些弯路教训是我们设计流程时最宝贵的参考——它们告诉我们"什么会出错"以及"为什么会出错"。我们的目标不是避免所有弯路（那是不可能的），而是尽量从别人的弯路中学习，避免重复已知的错误，同时尽量不引入新的问题。

### 2.3我们的思考方向

基于以上分析，我们尝试提出一种思考方向——需要强调的是，这只是一个可能性的探讨，不是"正确答案"。每个项目在自己的场景中都是合理的，我们试图探索的只是在"相对全面"和"相对轻量"之间的一种可能性：

> **尝试探索一种相对全面而不失灵活的AI研发流程思路——从五个项目各自的经验中学习，尽量覆盖关键环节而不出现大的漏洞，同时保持足够的轻量和灵活性，不因为追求全面而变得过重。**

这个思考方向分解为三个期望：

**期望一：相对轻量**
- 流程节点数控制在5-7个（遵循自然复杂度）
- 不依赖复杂基础设施（学习mattpocock的零依赖理念，而非gstack的模板系统或ECC的67 agents）
- 简单任务能快速通过，不被流程阻塞（学习OpenSpec的弹性理念）

**期望二：相对有效**
- 关键环节有基本保障（学习Superpowers的纪律理念，但不像它那样对所有任务强制）
- Agent行为有基本约束（学习Superpowers的行为塑造，但保留用户的自主性）
- 验证有据可查（学习Superpowers的fresh evidence和gstack的端到端验证）

**期望三：相对可维护**
- Spec能持续演进（学习OpenSpec的Delta机制）
- 知识能积累（学习ECC的instinct和gstack的learnings）
- 流程能按风险调节（学习ECC的Size classifier和Superpowers的HARD-GATE，但按场景选择）

之所以反复使用"相对"这个词，是因为我们清醒地认识到：任何流程设计都是在多个维度之间做取舍，不可能在所有维度上同时做到最优。"相对全面"意味着比单个项目覆盖更多维度，但不可能比专门优化的项目做得更好——Superpowers在行为约束上永远比我们的综合方案更彻底，OpenSpec在spec治理上永远比我们的综合方案更深入。我们的探索只是试图在"不出现大的漏洞"和"不失灵活"之间找到一个可能的平衡点。

### 2.4思考原则

基于五项目对比和弯路教训，我们提出以下思考原则——同样，这些原则只是我们尝试的方向，不是普适的法则：

**原则一：默认链式 + 可拆解**

学习mattpocock的高可组合性和gstack的流程完整性，流程默认按链运行（尽量完整），但每个节点可以独立调用（保留弹性）。这是在OpenSpec "Enablers not Gates" 和gstack "sprint链式" 之间的一种折中尝试——既不完全放任（学习gstack的弯路：纯信息可视化有时不够），也不完全强制（学习Superpowers的弯路：所有任务走完整流程过重）。

**原则二：按风险等级调节**

学习ECC的Size classifier和Superpowers的HARD-GATE，低风险变更允许快速通过（如OpenSpec的自由探索），高风险变更要求更完整的流程。这试图同时回应两个弯路——Superpowers的"简单任务过重"和mattpocock的"无流程保障"。当然，"风险由谁判断"本身是一个未完全解决的问题——agent可能误判，用户可能低估，我们能做的是提供判断依据而非给出终极方案。

**原则三：行为约束 + Artifact治理混合**

学习Superpowers的行为塑造（轻量约束agent）和OpenSpec的artifact治理（可审计性），但不走任何一个极端。不依赖外部工具（学习mattpocock的零依赖理念），但保留结构化artifact的可审计性。

**原则四：Spec持续演进**

学习OpenSpec的Delta机制，让spec随变更有机增长。这是五个项目中只有OpenSpec做到的——其他四个项目的spec都是一次性的。我们认为这个方向值得学习，因为spec过时是长期维护中的真实痛点。

**原则五：渐进式结构化**

学习OpenSpec的Progressive Rigor，探索阶段不强制结构化产出，随着流程推进逐渐增加结构化程度。这试图同时避免两个弯路——OpenSpec早期的"过早结构化"和mattpocock的"完全无结构"（探索结果在context compaction后丢失）。

---

## 3. 流程设计思考与探讨

### 3.1关键环节的确定

基于五项目的共同模式（5-7个节点的自然复杂度），我们尝试确定 **7个关键环节**：

```
Explore → Spec → Plan → Execute → Review → Verify → Archive
```

**为什么是这7个？**

从五项目的实践中可以看到，这7个节点在所有项目中都存在（尽管实现方式和强调程度差异巨大）。它们似乎是AI研发流程的自然组成部分——去掉任何一个都可能导致某个方面缺少关注：

- **去掉Explore**：agent直接从用户需求跳到spec，缺乏对问题的深入理解。Superpowers的v3.4.0→v4.3.0弯路告诉我们：agent会说"this is too simple to need a design"然后跳过探索，导致方向错误。
- **去掉Spec**：agent直接从探索跳到计划，没有可验证的行为契约。这会导致实现偏离意图——没有"系统应该做什么"的明确定义，执行就失去了基准。
- **去掉Plan**：agent直接从spec跳到编码，缺乏任务分解和依赖管理。复杂任务可能陷入混乱——没有任务清单，agent可能在context中迷失方向。
- **去掉Execute**：显然不行——这是实际编码环节。
- **去掉Review**：代码质量缺少关注。OpenSpec的"人工扫一眼"已经是最轻量的review，但仍有价值——更不用说这个"人工扫一眼"在实践中经常被跳过。
- **去掉Verify**：实现可能不工作。Superpowers的Iron Law告诉我们：agent会声称"应该可以工作"但实际没有运行验证。
- **去掉Archive**：工作不闭环。spec不更新、知识不积累、环境不清理——长期维护时这些债务会累积。

**为什么不是更多节点？**

ECC的6 Phase + 2 GATE = 8个节点，gstack的7阶段 × 23+ skills = 远超7个节点。但更细的分解会增加认知负担——ECC的67 agents和gstack的23+ skills是在节点内部的实现细节，而非额外的流程节点。gstack将Review拆为 `/review` + `/codex` + `/cso` 三个skill，但这仍然是Review节点内部的分工，不是三个独立节点。更多节点意味着更重的流程，这与我们"相对轻量"的期望相悖。

**为什么不是更少节点？**

mattpocock的5步将Review嵌入Execute（TDD red-green作为隐式review），将Verify也嵌入Execute。这确实更轻量，但可能失去独立审查和独立验证的视角——Review关注"代码质量是否符合标准"，Verify关注"系统是否真的按预期工作"，两者的关注点不同。mattpocock将verify嵌入implement的TDD，意味着只验证了"测试通过"而没有验证"系统端到端工作"。当然，对于mattpocock的场景（个人工程师的日常工具），这种轻量取舍是合理的——只是我们在探索相对全面的流程时，倾向于保留这两个独立节点。

### 3.2每个环节的思考与取舍

以下是对每个环节的思考——每个环节都有多种可能的设计方向，我们选择的方向只是其中一种可能性，并说明选择的理由和放弃的东西。

#### 3.2.1 Explore：按风险调节

**思考方向：** 低风险变更允许跳过探索（学习OpenSpec），高风险变更建议完整探索（学习Superpowers的HARD-GATE理念）。

**为什么这样思考：**
- Superpowers的经验告诉我们：agent会走捷径跳过探索，HARD-GATE能防止"方向错误"这个最高代价的失败。v3.4.0曾放松约束，v4.3.0又加回——这个弯路很有启发。
- 但OpenSpec的经验也告诉我们：简单任务不需要完整探索——一个typo修复不需要brainstorming。Enablers not Gates的弹性有其适用场景。
- ECC的Quick Capture vs Full Brief和mattpocock的Wayfinder no-fog early exit告诉我们：按风险调节是可行的——已有项目在这个方向上探索。

**取舍：**
- 选择了弹性 → 放弃了"每个任务都经过探索"的绝对保障（学习Superpowers的纪律，但不采用它的刚性）
- 选择了风险分级 → 引入了"风险由谁判断"的未解决问题（agent可能误判，用户可能低估）
- 我们能做的：提供风险自检清单作为参考，但承认这不能完全解决问题

**学习来源：** Superpowers（HARD-GATE理念和v3.4.0→v4.3.0弯路教训）、OpenSpec（弹性理念）、ECC（两种深度的探索）、mattpocock（Wayfinder early exit、事实/决策分离原则）

#### 3.2.2 Spec：Delta机制 + 渐进式结构化

**思考方向：** 尝试学习OpenSpec的Delta机制（只描述变更），探索产出渐进式结构化（从对话到AC到正式spec）。

**为什么这样思考：**
- OpenSpec的Delta机制是五个项目中唯一让spec不过时的设计——每次变更只描述ADDED/MODIFIED/REMOVED，archive时合并回source of truth。其他四个项目的spec都是一次性的，长期维护时会过时。这是一个值得学习的方向。
- 渐进式结构化试图同时避免两个弯路——OpenSpec早期的"过早结构化"和mattpocock的"完全无结构"（探索结果在context compaction后丢失）。
- ECC的AC-NNN格式（Scenario + Action + Expected + Must not + Verification + Priority）提供了可观察的验收标准，可以作为spec的核心结构参考。

**取舍：**
- 选择了Delta机制 → 增加了spec格式的学习成本（用户需要理解ADDED/MODIFIED/REMOVED语法）
- 选择了渐进式 → 在探索阶段可能产出不够精确，需要在Spec阶段补充
- 我们能做的：提供spec模板降低格式学习成本，但承认学习成本无法完全消除

**学习来源：** OpenSpec（Delta机制、Progressive Rigor、Enablers not Gates）、ECC（AC-NNN格式）、mattpocock（CONTEXT.md共享词汇）

#### 3.2.3 Plan：中等粒度 + Global Constraints

**思考方向：** 任务粒度介于Superpowers的bite-sized steps（2-5分钟）和mattpocock的tracer-bullet tickets（一个context window）之间，附加Global Constraints。

**为什么这样思考：**
- Superpowers的2-5分钟粒度非常精细，每个step都dispatch fresh subagent。对于需要高度隔离的复杂任务，这种粒度是合理的；但对于中等复杂度的任务，可能导致过多的subagent切换。
- mattpocock的一个context window粒度较粗，适合验证可行性（tracer-bullet），但如果一个task失败，整个context window的工作都受影响。
- 中等粒度（一个task = 一个逻辑变更单元，约15-30分钟）是一种折中尝试——足够小让每个task可验证，足够大避免过度切换。这个"中间值"是否最优，我们并不确定——它只是两种极端之间的一种可能性。
- Global Constraints（跨任务的约束如编码标准、测试要求）来自Superpowers，是一个值得保留的设计——它让所有任务遵循一致的标准，而不需要在每个task中重复说明。

**取舍：**
- 选择了中等粒度 → 既不是最细也不是最粗，可能两种场景都不是最优
- 选择了Global Constraints → 增加了plan的复杂度但提高了执行一致性
- 我们能做的：提供plan模板，预设常见的Global Constraints，让用户按需调整

**学习来源：** Superpowers（Global Constraints、bite-sized理念）、mattpocock（tracer-bullet理念、DAG依赖）、ECC（planner agent的Phase+Step+Risk结构）

#### 3.2.4 Execute：TDD + 可选subagent隔离

**思考方向：** 建议强制TDD（学习Superpowers的Iron Law），subagent隔离可选（学习Superpowers的SDD，但不强制fresh subagent per task）。

**为什么这样思考：**
- Superpowers的Iron Law经验告诉我们：强制TDD能防止"虚假完成声明"——agent必须运行测试并展示结果（fresh evidence），不能只说"应该可以工作"。这个弯路教训值得学习。
- OpenSpec的纯checkbox勾选经验告诉我们：无执行纪律时agent会走捷径——勾选checkbox不等于代码真的工作。
- 但Superpowers的fresh subagent per task对简单任务可能过重——每次dispatch都有开销。我们尝试折中：TDD作为建议（高风险变更强制），subagent隔离可选（按任务复杂度选择）。

**取舍：**
- 选择了建议TDD → 增加了执行时间，但质量更有保障（学习Superpowers的经验）
- 选择了可选subagent → 放弃了"绝对避免context pollution"的保障（学习Superpowers的SDD但不强制）
- 我们能做的：对复杂任务推荐subagent隔离，提供判断参考（如"涉及3+ 文件的变更推荐subagent"）

**学习来源：** Superpowers（Iron Law、SDD、file handoffs）、mattpocock（vertical slice执行策略）、ECC（tdd-workflow的RED→GREEN→Refactor循环）

#### 3.2.5 Review：per-task + 双轴审查

**思考方向：** 每个task完成后进行review（学习Superpowers的per-task gate），双轴审查——代码质量 + 需求忠实度（学习mattpocock的双轴review）。

**为什么这样思考：**
- Superpowers的per-task gate经验告诉我们：在每个task完成后审查比在整个branch完成后审查更有效——问题更早发现，修复成本更低。
- mattpocock的双轴审查（Standards + Spec）告诉我们：代码质量和需求忠实度是两个正交维度——代码可能写得很好但偏离了spec，也可能忠实于spec但代码质量差。
- OpenSpec的经验提醒我们：非强制的review容易被跳过——当review不阻断时，它很容易变成"人工扫一眼"然后略过。

**取舍：**
- 选择了per-task → 增加了review频率（开销），但问题更早发现
- 选择了双轴 → 增加了review复杂度，但覆盖更全面
- 选择了Critical/Important建议修复 → 增加了流程停顿，但试图防止关键问题流入下游
- 我们能做的：低风险变更允许简化review（只做Standards轴），高风险变更建议双轴

**学习来源：** Superpowers（per-task gate、Critical/Important分级）、mattpocock（双轴review: Standards + Spec）、ECC（多语言专用reviewer的思路）、gstack（跨模型审查的理念）

#### 3.2.6 Verify：独立节点 + fresh evidence

**思考方向：** Verify作为独立节点（不嵌入Execute），建议fresh evidence（学习Superpowers的Iron Law）。

**为什么这样思考：**
- Superpowers的Iron Law经验告诉我们：独立verify + fresh evidence能防止"应该可以工作"的虚假确认。agent必须运行验证命令并展示实际输出，不能只引用TDD的green。
- mattpocock将verify嵌入implement的TDD red-green——这混淆了"单元测试通过"和"系统真的按预期工作"。TDD green只证明代码符合测试，不证明系统满足spec。当然，对于mattpocock的场景这可能是合理的取舍——只是我们在探索相对全面的流程时，倾向于保留独立verify。
- 独立verify可以关注端到端验证（学习gstack的 `/qa` 浏览器端到端验证），而不仅是单元测试。
- ECC的delivery-gate hook经验告诉我们：机械化阻断比"建议"更有效——但我们也注意到gstack的弯路（纯信息可视化有时不够），所以在高风险场景下考虑引入阻断。

**取舍：**
- 选择了独立 → 增加了一个流程节点（开销），但验证更彻底
- 选择了fresh evidence → 要求agent运行验证命令并展示结果，增加了执行时间
- 我们能做的：对低风险变更允许简化验证（只运行已有测试），高风险变更建议端到端验证

**学习来源：** Superpowers（Iron Law、fresh evidence）、gstack（`/qa` 端到端验证、`/benchmark` 性能验证）、ECC（delivery-gate hook的机械化思路）

#### 3.2.7 Archive：Delta合并 + 知识归档

**思考方向：** Archive时尝试Delta合并（学习OpenSpec）+ 知识归档（学习ECC的instinct和gstack的learnings）。

**为什么这样思考：**
- OpenSpec的Delta合并是唯一让spec持续演进的设计——archive时将delta合并回source of truth，spec随变更有机增长。这个方向值得学习，因为spec过时是长期维护中的真实痛点。
- ECC的instinct提取和gstack的learnings归档让流程随使用积累经验——"已决定的事不再重新讨论"（gstack的decisions.jsonl）、"从失败中学习"（ECC的instinct → skill演化）。这些知识归档机制为长期维护提供了价值。
- mattpocock的handoff是轻量的跨session传递，传递的是"当前工作状态"而非"学到了什么"——这对短期工作有用，但不形成长期知识。
- Superpowers的finishing-a-development-branch提供了清晰的分支管理策略（merge/PR/keep/discard），可以作为Archive的分支管理参考。

**取舍：**
- 选择了Delta合并 → 增加了archive的复杂度（需要合并逻辑），但spec不会过时
- 选择了知识归档 → 增加了一个归档维度，但提供了长期价值
- 我们能做的：Delta合并尽量自动化，知识归档轻量化（只记录关键决策和教训，不追求全面）

**学习来源：** OpenSpec（Delta合并、change文件夹归档）、ECC（instinct提取、continuous-learning-v2）、gstack（learnings.jsonl、decisions.jsonl、/retro回顾）、Superpowers（finishing-a-development-branch分支管理）、mattpocock（handoff跨session传递）

### 3.3环节之间的衔接机制

**思考方向：** 采用文件系统持久化为主、context window传递为辅的混合衔接机制。

**为什么这样思考：**

从五项目的实践中可以提取出三种衔接机制，各有适用场景：

| 机制 | 代表项目 | 适合的场景 | 不适合的场景 |
|------|---------|-----------|------------|
| 文件系统持久化 | gstack, OpenSpec | 需要跨session、可审计的长期项目 | 轻量快速的临时工作 |
| Context window传递 | mattpocock, Superpowers | 轻量、无I/O开销的连续工作 | context compaction后需要恢复的场景 |
| Git commit传递 | gstack (Continuous Checkpoint), ECC (GATE) | 需要bisect、可追溯的场景 | 不想产生噪音commit的场景 |

我们尝试的混合方向——关键artifact持久化到文件系统，临时信息留在context window：

| 节点衔接 | 衔接方式 | 理由 |
|---------|---------|------|
| Explore → Spec | Context window | 探索结果自然流入spec创作，不需要持久化 |
| Spec → Plan | 文件系统持久化 | Spec是source of truth，需要持久化供Plan读取 |
| Plan → Execute | 文件系统持久化 | Plan驱动执行，需要跨task可读 |
| Execute → Review | Git diff | 代码变更是review的输入，git diff是天然载体 |
| Review → Verify | Context window | Review findings自然流入验证，不需要持久化 |
| Verify → Archive | 文件系统持久化 | 验证结果需要记录，供Archive参考 |
| Archive → 下一个sprint | 文件系统持久化 | Spec source of truth + knowledge base需要跨session |

**取舍：**
- 选择了混合机制 → 比纯context window（mattpocock）更持久，比纯文件系统（gstack）更轻量
- 关键artifact（spec、plan、knowledge）持久化，临时信息（探索共识、review findings）留在context
- 我们能做的：提供artifact路径约定模板，降低路径复杂度

### 3.4思考方向汇总

以下是我们流程思考的方向汇总，每条都标注了学习来源和取舍理由——需要强调的是，这些只是我们尝试的方向，不是"正确答案"：

| # | 思考方向 | 学习来源 | 取舍理由 |
|---|---------|---------|---------|
| 1 | 7个关键环节（Explore → Archive） | 五项目共同模式 | 尝试覆盖自然复杂度，去掉任何一个都可能导致某方面缺少关注 |
| 2 | 按风险等级调节 | ECC + Superpowers | 试图同时回应"简单任务过重"和"复杂任务缺保障" |
| 3 | Delta机制spec持续演进 | OpenSpec | 唯一让spec不过时的设计，值得学习 |
| 4 | 渐进式结构化 | OpenSpec | 试图避免过早结构化和完全无结构两个弯路 |
| 5 | 中等粒度任务（15-30分钟/task） | Superpowers + mattpocock | 在两种极端之间的一种折中尝试 |
| 6 | Global Constraints | Superpowers | 让所有任务遵循一致标准 |
| 7 | 建议强制TDD | Superpowers | 学习Iron Law防止虚假完成声明 |
| 8 | 可选subagent隔离 | Superpowers | 按任务复杂度选择，避免对所有任务过重 |
| 9 | per-task review + 双轴 | Superpowers + mattpocock | 问题更早发现 + 覆盖更全面 |
| 10 | 独立verify + fresh evidence | Superpowers | 学习Iron Law防止"应该可以工作" |
| 11 | Delta合并 + 知识归档 | OpenSpec + ECC + gstack | spec不过时 + 流程积累经验 |
| 12 | 混合衔接机制 | gstack + mattpocock | 关键artifact持久化，临时信息轻量传递 |
| 13 | 默认链式 + 可拆解 | OpenSpec + gstack | 尝试在完整性和弹性之间折中 |
| 14 | 行为约束 + Artifact治理混合 | Superpowers + OpenSpec | 试图兼得轻量约束和可审计性 |

---

## 4. 流程全景图

### 4.1七节点流程模型

基于以上思考，我们尝试提出以下AI研发流程模型——这只是一个供讨论的框架，不是定论：

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

### 4.2节点依赖关系

```
Explore ──→ Spec ──→ Plan ──→ Execute ──→ Review ──→ Verify ──→ Archive
                                          ↑            │
                                          └────────────┘
                                       (Review 发现问题可回到 Execute)
```

**线性依赖（所有节点共同）：**
- Explore → Spec → Plan → Execute → Review → Verify → Archive

**回环依赖：**
- Review → Execute：Review发现Critical/Important问题，回到Execute修复
- Verify → Execute：验证失败，回到Execute修复

**跨节点跳跃（按风险等级调节）：**
- 低风险变更：可跳过Explore（直接从Spec开始）
- 修复类变更：可跳过Explore + Spec（直接从Plan开始，基于已有spec）
- 紧急修复：可跳过Explore + Spec + Plan（直接Execute，事后补spec）

### 4.3每个节点的核心张力

每个节点都存在一个核心张力——这是后续笔记08-13将深入讨论的主题。我们的选择只是众多可能性中的一种：

| 节点 | 核心张力 | 我们尝试的方向 | 学习来源 |
|------|---------|--------------|---------|
| **Explore** | 强制vs自由 | 按风险调节——低风险自由，高风险建议强制 | Superpowers + OpenSpec + ECC |
| **Spec** | 结构化vs自由格式 | 渐进式——从对话到AC到Delta spec | OpenSpec + ECC |
| **Plan** | 精细vs粗粒度 | 中等粒度（15-30分钟/task）+ Global Constraints | Superpowers + mattpocock |
| **Execute** | 强制纪律vs信任agent | 建议TDD + 可选subagent隔离 | Superpowers + mattpocock |
| **Review** | 阻断vs信息 | per-task + 双轴 + Critical/Important建议修复 | Superpowers + mattpocock |
| **Verify** | 独立vs嵌入 | 独立节点 + fresh evidence | Superpowers + gstack |
| **Archive** | spec闭环vs知识归档 | 两者都尝试——Delta合并 + 知识归档 | OpenSpec + ECC + gstack |

### 4.4流程设计的三个正交维度

从全景图的分析中，可以提炼出流程设计的三个正交维度：

1. **强制程度**：从"无强制"（OpenSpec/mattpocock）到"行为强制"（Superpowers）到"人工GATE"（ECC）到"信息可视化"（gstack）——我们尝试**按风险调节**，试图从各自的经验中学习

2. **Artifact持久性**：从"context window内"（mattpocock）到"文件系统"（gstack/Superpowers）到"结构化source of truth"（OpenSpec）——我们尝试**混合模式**，关键artifact持久化，临时信息留在context

3. **角色分工**：从"单一agent"（OpenSpec/mattpocock）到"controller + subagent"（Superpowers）到"67专门化agents"（ECC）到"8+ 工程角色"（gstack）——我们尝试**轻量分工**，controller + implementer + reviewer三角色，按需扩展

这三个维度的组合定义了流程的"重量"。我们的探索目标是在"高流程完整性"和"高使用轻量性"之间找到一个可能的平衡点——但我们清醒地认识到，这个"平衡点"本身就是一种新的取舍，它在两边都不最优，只是试图尽量不出现大的漏洞。

---

## 5. 承上启下：后续章节导览

### 5.1从分析到探讨的转折

本篇是整个系列的转折点：

- **前五篇（02-06）** 是"分析"——逐个拆解五个项目的架构、设计哲学和实践细节，理解它们各自"为什么这样设计"
- **本篇（07）** 是"综合与探讨"——横向对比五个项目的设计取向和取舍，尝试从各自的经验中学习，探索一种可能的流程思路
- **后六篇（08-13）** 是"深入讨论"——逐个节点展开讨论，每个环节有哪些可能的设计方向、各自的取舍是什么

### 5.2后续章节的讨论框架

后续每个节点章节（08-13）将遵循统一的讨论框架：

1. **对比分析**：五个项目在该节点上的具体做法和关键差异
2. **关键差异**：从核心维度（强制程度、产出形式、深度调节等）对比
3. **实践方向讨论**：基于对比，讨论该节点的可能实践方向
4. **案例映射**：将弯路教训映射到实践方向，验证思考的合理性

各章节主题如下：

| 章节 | 节点 | 核心问题 |
|------|------|---------|
| 08 | Explore | 从模糊到精确——探索阶段的强制程度、产出形式和深度调节 |
| 09 | Spec | 从意图到行为契约——spec的格式化程度、Delta机制和质量保障 |
| 10 | Plan | 从规格到任务——任务粒度、依赖表达、Global Constraints和审批机制 |
| 11 | Execute | 从任务到实现——TDD强制、subagent隔离、异常处理和context管理 |
| 12 | Review & Verify | 从实现到确认——审查时机/维度/阻断、验证独立性/维度/证据 |
| 13 | Archive | 从完成到闭环——Delta合并、分支管理、知识归档和环境清理 |

### 5.3本篇的核心思考

回顾本篇的核心思考——需要再次强调，这只是一个可能性的探讨，不是定论：

> **我们的流程思考不是凭空创造的，而是试图从五个项目各自的经验和弯路中学习。每个设计方向都有明确的学习来源和取舍理由。我们不确定这是"正确"的做法——它只是众多可能性中的一种尝试。**

- 从 **Superpowers** 学习了行为约束的纪律（HARD-GATE、Iron Law、per-task review）——它的弯路告诉我们agent会走捷径；但我们也注意到它对所有任务走完整流程的刚性可能过重
- 从 **OpenSpec** 学习了spec持续演进的Delta机制和渐进式结构化——它的弯路告诉我们不能过早结构化；但我们也注意到它无执行纪律可能在agent不可靠时出问题
- 从 **ECC** 学习了按风险调节的思想（Size classifier）和知识归档（instinct）——它的弯路告诉我们覆盖面需要配合选择性；但我们也注意到它的素材膨胀对新用户不友好
- 从 **mattpocock** 学习了轻量可组合的设计和事实/决策分离——它的弯路告诉我们可复用原语需要明确责任边界；但我们也注意到它无流程保障可能让不熟悉流程的用户跳过关键步骤
- 从 **gstack** 学习了端到端覆盖的完整性和多角色审查的价值——它的弯路告诉我们纯信息可视化有时不够；但我们也注意到它的重量级门槛可能限制适用场景

这个从各自经验中学习的过程不是简单的拼凑——每个学习都经过了"为什么这个方向值得尝试"的思考和"放弃了什么"的取舍分析。同时，我们也清醒地认识到，这个尝试本身可能会走入新的弯路——这是任何探索都无法完全避免的。后续六篇（08-13）将逐个节点展开这些思考和取舍的细节，欢迎读者批判性地审视我们的每一项选择。

---

点击下方"**阅读原文**"进入我的演示网站。
