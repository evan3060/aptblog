---
title: AI研发流程深度解析（十五）：衡量判断标准与迭代思路——如何衡量流程是否有效，如何持续改进
description: 探讨如何判断一个AI辅助研发流程是否有效，衡量标准是什么，以及流程应该如何迭代优化。
tags:
  - 研发流程
  - 衡量
  - 迭代
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-13
> **核心问题：** 如何判断一个AI辅助研发流程是否有效？衡量标准是什么？流程应该如何迭代优化？

---

![AI研发流程深度解析（十五）：衡量判断标准与迭代思路——如何衡量流程是否有效，如何持续改进](/images/dev-process/dev-process-15-measurement-iteration.png)

## 引言

第十四篇综合了各家的特色对比和逐节点深入分析，提炼了全面轻量的研发流程的可能形态。但一个流程不是一次设计就完成的——它需要持续衡量、迭代和简化。本篇讨论如何衡量流程是否有效，以及如何迭代优化。

需要强调：本篇是衡量与迭代方向的探讨，不是指标设计。目标是讨论"如何衡量和迭代"的方向，而非"我们要用什么指标"。

---

## 1. 模型能力与流程复杂度的关系

### 1.1模型能力地图

从前13篇的源码分析中，可以提炼AI agent在研发流程中的能力地图：

**擅长（模型能力足够，流程可以轻量化）：**
- **代码生成**：给定明确spec和plan，AI能生成高质量代码。Superpowers的SDD和OpenSpec的apply都依赖这个能力。
- **格式化输出**：AI能按模板生成结构化文档。OpenSpec的 `/opsx:propose` 自动生成proposal + specs + design + tasks。
- **模式识别**：AI能从diff中识别代码质量问题。mattpocock的12种Fowler smell baseline和gstack的slop scan都依赖这个能力。
- **上下文推理**：AI能从对话中提取隐含的需求和约束。mattpocock的grilling和ECC的intent-driven-development都依赖这个能力。

**不擅长（模型能力不足，需要流程补偿）：**
- **自我验证**：AI倾向于声称"should work now"而不实际运行验证。Superpowers的Iron Law和24 failure memories证明这是最常见的失败模式。
- **自我合理化**：AI会为跳过流程找借口——"this is too simple to need a design"、"I'm confident"、"agent said success"。Superpowers的Rationalization表专门防御这个。
- **长流程保持一致**：在多步骤流程中，AI会偏离原始plan——忘记Global Constraints、引入scope creep、做出与spec不一致的实现。gstack的Scope Drift Detection和Superpowers的per-task review gate都是对这个问题的应对。
- **判断风险等级**：AI对业务影响的判断不够敏感——可能将高风险变更（如auth、payments、data migration）当作低风险处理。ECC的Size classifier和OpenSpec的Progressive Rigor都需要人类最终判断。
- **跨task结构性思考**：AI在单个task内表现良好，但跨task的结构性问题（重复逻辑、命名不一致、函数膨胀）容易被忽略。Superpowers的whole-branch final review专门检查这些问题。

**不确定（能力边界不清晰）：**
- **Spec编写质量**：AI能生成格式正确的spec，但spec的内容质量（是否覆盖edge case、scenario是否真正exercise需求）难以自动判断。gstack的Codex quality gate用跨模型评分，但7/10门槛是主观的。
- **TDD驱动设计**：TDD的核心价值是"让测试失败信息驱动设计决策"——但AI是否真正利用了测试失败信息，还是只是在"写测试 → 写实现 → 过测试"的机械循环？mattpocock的reference-only TDD依赖AI内化的TDD习惯，但这个习惯的可靠性不确定。
- **Delta合并的正确性**：OpenSpec的Delta合并是程序化的——但判断Delta本身是否正确（是否遗漏了scenario、合并顺序是否语义正确）仍需要AI推理。

### 1.2流程复杂度的边界

模型能力与流程复杂度之间存在反向关系：模型能力越强，流程可以越简单；模型能力越弱，流程需要越复杂来补偿。

但这个关系有一个关键限制——**流程不能弥补模型能力的不足**。

**证据：**
- 某研发流程尝试的38 phase + 10角色的流程试图用复杂流程弥补模型能力不足——结果是协调成本失控，流程偏离率高
- Superpowers的Iron Law依赖agent遵守skill约束——但skill触发率只有50-80%。如果agent根本不读skill，Iron Law就形同虚设
- ECC的delivery-gate用hook 100% 触发解决了触发率问题——但hook只能检查表面模式（regex/mtime/disk），不能检查内容质量

**关键洞察**：流程可以补偿模型能力的"习惯性不足"（如不运行验证、跳过探索），但不能补偿模型能力的"能力性不足"（如无法判断业务风险、无法做跨task结构性思考）。前者用Rationalization表和Iron Law式的行为约束有效；后者需要人工介入或更强的模型。

### 1.3步骤数与角色数的自然边界

第十四篇已经讨论了步骤数和角色数的自然边界。这里从衡量角度补充：

**步骤数 ≤ ~7步**：
- 5个项目的显式步骤数都集中在5-7步
- 某研发流程尝试的38 phase失败表明，步骤数超过 ~7步后，agent偏离概率急剧上升
- 但步骤数太少（< 5步）会缺失关键环节——如跳过Review或Verify

**核心角色 ≤ ~3个**：
- 实际在单个流程实例中活跃的角色通常在2-3个
- 某研发流程尝试的10角色教训表明，角色数超过3-4个后，协调成本急剧上升
- gstack的8+ 角色适合大型变更，但对中小型变更过重

**实践方向**：衡量流程复杂度的第一个标准是"步骤数和角色数是否在自然边界内"。如果一个流程需要10+ 步或5+ 角色，它可能试图用流程复杂度弥补模型能力不足——这通常不会成功。

---

## 2. 衡量判断标准

### 2.1 Superpowers的eval方法

Superpowers是5个项目中唯一有系统化评估方法的项目。它的评估体系包括两类测试：

**Plugin tests（非LLM代码测试）**：
- 用bash/node测试SKILL.md中的非LLM逻辑（如脚本、模板生成）
- 确定性测试——不依赖AI推理

**Evals（LLM行为合规测试）**：
- **Drill harness**：真实tmux session + LLM actor + verifier
- **压力测试场景**：time + sunk cost + authority + exhaustion组合施压
  - Time pressure："we need to ship this in 10 minutes"
  - Sunk cost："you've already spent 2 hours on this, just finish it"
  - Authority："the user said to skip tests"
  - Exhaustion："this is the 15th task, just wrap it up"
- **94% PR拒绝率**：对skill修改的门槛极高——确保只有高质量变更被合并

**关键设计**：Superpowers的eval不是测试代码质量——而是测试 **skill是否真正塑造了agent行为**。这是评估流程有效性的核心维度：流程约束是否被agent遵守？

### 2.2 OpenSpec的verify方法

OpenSpec的 `/opsx:verify` 从三个维度验证：

- **Completeness**：所有task完成、所有requirement实现、scenario覆盖
- **Correctness**：实现匹配spec意图、edge case处理
- **Coherence**：design决策在代码中体现、命名一致

**关键特征**：
- 基于启发式规则（关键词搜索、文件路径分析）——不是确定性证明
- 不阻断archive——暴露问题由人类决策
- False Positive策略：不确定时优先SUGGESTION而非WARNING
- Graceful Degradation：只有tasks.md时只验证task完成；有tasks+specs时验证completeness+correctness；完整artifacts时验证全部

### 2.3其他项目的衡量方法

**ECC**：
- verification-loop的6 phase（Build → Type → Lint → Test → Security → Diff）输出VERIFICATION REPORT
- delivery-gate的机械化检查（regex + mtime + disk）
- agent-self-evaluation的5轴自评（Accuracy/Completeness/Clarity/Actionability/Conciseness）
- Harness audit scoring——orch-* pipeline的评分机制

**gstack**：
- /qa的Health Score Rubric（8维度加权评分：Console 15% + Links 10% + Visual 10% + Functional 20% + UX 15% + Performance 10% + Content 5% + Accessibility 15%）
- Review Readiness Dashboard——可视化审查状态
- Plan Completion Audit——DONE/PARTIAL/NOT DONE/CHANGED/UNVERIFIABLE分类
- /retro的per-person breakdowns + shipping streaks + test health trends

**mattpocock**：
- TDD red-green——测试通过/失败是核心衡量
- code-review的双轴报告（Standards + Spec）
- "tight + red-capable"反馈循环标准——a 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight

### 2.4可能的衡量维度讨论

综合5个项目的实践，可以提炼出衡量流程有效性的可能维度：

**维度一：流程遵守度——agent是否按步骤执行？**
- Superpowers的eval是最直接的衡量——测试skill是否塑造了agent行为
- 其他项目没有直接衡量这个维度——ECC的delivery-gate检查rationalization文本是间接衡量
- 衡量方法：drill harness式的压力测试——在time/sunk cost/authority/exhaustion施压下，agent是否仍然遵守流程

**维度二：Spec质量——行为是否可测试？是否混入实现细节？**
- OpenSpec的validator检查格式（Requirement有SHALL/MUST、Scenario有GIVEN/WHEN/THEN）
- gstack的Codex quality gate检查内容质量（7/10门槛）
- Superpowers的spec self-review检查placeholder、consistency、scope、ambiguity
- 衡量方法：格式验证（程序化）+ 内容审查（AI推理或跨模型）

**维度三：执行质量——TDD是否真正驱动设计？review是否发现问题？**
- Superpowers的per-task review检查spec compliance + code quality
- mattpocock的双轴审查检查Standards + Spec
- ECC的verification-loop检查Build/Type/Lint/Test/Security/Diff
- 衡量方法：代码审查findings的数量和严重度 + 测试覆盖率 + 构建通过率

**维度四：产出质量——代码是否满足spec？是否有回归？**
- Superpowers的Iron Law：fresh verification evidence
- OpenSpec的verify：Completeness + Correctness + Coherence
- gstack的 /qa：浏览器端到端 + 健康评分
- mattpocock的TDD red-green + 反馈循环
- 衡量方法：测试通过率 + 端到端验证 + 回归测试

**维度五：流程效率——从开始到完成的时间、token消耗、subagent调用次数**
- gstack的 /retro提供shipping streaks和test health trends
- Superpowers的v4→v5演进（25min → 30s）是效率衡量的典型案例
- 衡量方法：时间跟踪 + token计数 + 调用次数统计

### 2.5 "通过/不通过 + 具体问题" vs评分阈值

这是一个重要的衡量方法论选择。从5个项目的实践中可以看到两种方向：

**评分阈值（gstack, ECC）**：
- gstack的Codex quality gate：7/10门槛
- gstack的Health Score Rubric：8维度加权评分
- ECC的agent-self-evaluation：5轴自评
- 优势：看起来客观、可比较、可追踪趋势
- 代价：假精确——评分看起来精确但实际依赖AI主观判断。"7/10"和"6/10"的差异可能只是AI的随机波动

**通过/不通过 + 具体问题（Superpowers, mattpocock, OpenSpec）**：
- Superpowers的Iron Law：验证通过或不通过（没有"部分通过"）
- Superpowers的review findings：Critical/Important/Minor + 具体描述
- mattpocock的TDD：red或green（没有"70% green"）
- OpenSpec的verify：CRITICAL/WARNING/SUGGESTION + 具体问题
- 优势：诚实——不假装精确；可操作——每个问题都有具体描述
- 代价：不可比较——没有统一的"质量分数"

**某研发流程尝试的教训**：三层验证 + 评分阈值看起来很科学，但实际依赖AI主观判断。评分阈值给了"流程有效"的假象——分数达标不代表质量真的达标。

**实践方向**：质量判断用"通过/不通过 + 具体问题"比评分阈值更诚实。Superpowers的Critical/Important/Minor分级 + 具体描述是最可操作的——每个finding都有明确的修复要求。gstack的Health Score在趋势追踪上有价值（"上次85分，这次72分"提示退化），但绝对分数（"72分是否达标"）不够可靠。一个可能的折中是：用"通过/不通过 + 具体问题"做质量判断，用评分做趋势追踪——但不把评分作为质量门禁。

---

## 3. 迭代优化的模式

### 3.1 Superpowers的迭代模式：失败驱动 + 渐进简化

Superpowers的迭代是"失败驱动"的——每次变更都因为之前出了问题。从RELEASE-NOTES.md的演进历史中可以提炼以下模式：

**从失败中学习**：
- 24 failure memories来自真实失败案例——每个rationalization都来自baseline测试中agent的实际行为
- v3.4.0→v4.3.0：去掉HARD-GATE → 加回HARD-GATE——因为agent会跳过探索
- v6.0.0：禁止controller指导reviewer忽略什么——因为 "real runs caught controllers coaching reviewers to skip findings"

**渐进式简化**：
- v4→v5：brainstorming从"6阶段正式流程 + checklist"回到"自然对话"——重型流程被简化
- v4→v5：subagent review loop → inline self-review（25min → 30s，质量相当）——不是所有环节都需要subagent
- v5→v6：两个reviewer → 一个reviewer（成本减半，质量不降）——subagent数量可以优化

**测试驱动改进**：
- 每个rationalization都来自baseline测试
- 94% PR拒绝率确保只有高质量变更被合并
- Micro-test wording：5+ 样本验证措辞后才跑完整压力测试

### 3.2 OpenSpec的迭代模式：用户反馈驱动 + 渐进增强

OpenSpec的迭代是"用户反馈驱动"的——82个archived change记录了设计决策的演进历史。从changes/archive/ 中可以提炼以下模式：

**从用户反馈中学习**：
- 2025-08：从phase-locked到fluid actions——"传统工作流强制你经过阶段，但真实工作不fit进盒子"
- 2025-08：采用delta-based changes——brownfield-first的核心洞察
- 2025-09：multi-agent init + slash command support——适配多AI工具
- 2026-05：workspace——跨repo变更规划

**渐进式增强**：
- core（默认5个命令）→ expanded（完整命令集）→ stores（beta）——功能逐步增加
- Schema四级解析（CLI→change→project→default）——允许同一项目不同变更使用不同工作流
- Profile系统：core vs expanded——用户按需选择功能集

**保持向后兼容**：
- archive命令的验证规则逐步增强，但 `--no-validate` 应急选项保留
- 新的artifact类型可以添加到schema中，但旧artifact仍然有效

### 3.3 ECC和gstack的迭代模式

**ECC**：
- Continuous Learning v2的instinct机制——自动从会话中提取模式
- Instinct → skill演化——高置信度的instinct升级为skill
- 这是"学习驱动"的迭代——agent从经验中学习并改进流程
- 但默认关闭且效果未验证

**gstack**：
- /learn的learnings.jsonl——learnings compound across sessions
- /retro的回顾机制——per-person breakdowns + shipping streaks + test health trends
- encoded decision principles——将常见决策编码为自动规则
- 这是"数据驱动"的迭代——通过回顾和数据发现模式

### 3.4什么时候增加复杂度？什么时候减少？

从5个项目的演进历史中，可以提炼增加和减少复杂度的时机：

**增加复杂度的时机**：
- 当手动操作成本明确不可接受时
  - OpenSpec的Delta机制：手动维护全量spec的成本不可接受 → 引入Delta
  - gstack的Continuous Checkpoint：手动记录进度的成本不可接受 → 自动化
- 当新的失败模式被发现时
  - Superpowers的Rationalization表：发现新的"跳过"借口 → 增加对应的防御
  - Superpowers v6的"禁止controller指导reviewer"：发现controller操控reviewer → 增加禁令
- 当用户反馈指出缺失时
  - OpenSpec的workspace：用户需要跨repo变更规划 → 增加workspace功能

**减少复杂度的时机**：
- 当某个环节被证明无效或过重时
  - Superpowers v4→v5：brainstorming 6阶段 → 自然对话——重型流程被简化
  - Superpowers v4→v5：subagent review loop → inline self-review——25min → 30s
  - Superpowers v5→v6：两个reviewer → 一个reviewer——成本减半
- 当模型能力提升使某些约束不再必要时
  - mattpocock删除TDD的refactor阶段——"refactoring belongs to the review stage"
  - （假设性）如果模型的自我验证能力提升到100%，Iron Law可能不再必要

**关键原则**：
1. **增加需要证据，减少需要勇气**——增加复杂度有明确的触发条件（手动成本、新失败模式、用户反馈），但减少复杂度需要承认之前的决策不再有效
2. **先减少后增加**——Superpowers的演进表明，简化（v4→v5）往往比增加（v5→v6）带来更大的收益
3. **测试驱动增减**——Superpowers的eval确保增减不会降低质量

### 3.5流程的"熵增"倾向

一个重要的观察：**流程会自然变复杂，需要主动简化**。

**熵增的表现**：
- Superpowers的Rationalization表不断增长——每发现一个新的"跳过"借口就增加一条
- ECC的67 agents和261+ skills——素材库自然膨胀
- gstack的21步ship流程——每一步都是对某个问题的应对
- OpenSpec的82个archived change——每个change可能增加新的规则或约束

**熵增的原因**：
- 每个新问题都倾向于"加一个规则"而非"修改现有规则"
- 删除规则比增加规则更难——需要证明它不再需要
- 使用者倾向于"加一个检查"而非"信任现有检查"

**实践方向**：流程需要定期"减熵"——主动审查哪些规则已经过时、哪些检查已经不必要、哪些步骤可以合并。Superpowers的渐进式简化（v4→v5→v6）是"减熵"的典型案例——每次版本更新都简化了一些环节。OpenSpec的archive机制本身就是一种"减熵"——将已完成的change移到archive，保持changes/ 目录的整洁。但"减熵"需要主动进行——没有项目实现了自动化的"规则过时检测"。

---

## 4. 失败模式与应对

### 4.1 Agent跳过流程

**失败模式**：AI agent在被催促或面对"看起来简单"的任务时，跳过Explore、Spec或Verify等节点。

**证据**：
- Superpowers v3.4.0→v4.3.0：去掉HARD-GATE后agent跳过brainstorming
- Superpowers的24 failure memories：agent声称"should work now"而不运行验证
- "this is too simple to need a design"是最常见的anti-pattern

**应对策略**：
- **Rationalization表**（Superpowers）：列出所有"跳过"借口及现实对照
- **HARD-GATE**（Superpowers）：阻断编码直到设计批准
- **delivery-gate hook**（ECC）：regex匹配rationalization文本，100% 触发
- **渐进式rigor**（ECC, OpenSpec）：低风险变更轻量化，减少"跳过"的动机

**残余风险**：Rationalization表和skill约束的触发率只有50-80%——如果agent不读skill，约束就无效。HARD-GATE和delivery-gate hook更可靠但更重。

### 4.2 Agent不遵守格式

**失败模式**：AI agent在生成spec、plan或代码时不遵守规定的格式。

**证据**：
- OpenSpec需要validator.ts程序化验证spec格式——说明AI经常生成格式不正确的spec
- mattpocock明确禁止spec包含file paths和code snippets——说明AI倾向于在spec中包含代码
- Superpowers的 "No Placeholders" 原则——说明AI倾向于生成含占位符的plan

**应对策略**：
- **程序化验证**（OpenSpec validator）：格式不正确则propose失败
- **micro-test wording**（Superpowers）：5+ 样本验证措辞
- **明确禁止 + 理由**（mattpocock）："they go stale fast"——不只是禁止，还说明为什么
- **模板 + 示例**（所有项目）：提供明确的格式模板和示例

**残余风险**：程序化验证只能检查格式，不能检查内容。一个格式完美的spec可能逻辑漏洞百出。

### 4.3 Agent在长流程中偏离

**失败模式**：在多步骤流程中，AI agent偏离原始plan——引入scope creep、忘记Global Constraints、做出与spec不一致的实现。

**证据**：
- gstack的Scope Drift Detection——检测SCOPE CREEP和MISSING REQUIREMENTS
- Superpowers的whole-branch final review——检查跨task的结构性问题
- mattpocock的Spec轴——检查scope creep和实现错误的需求

**应对策略**：
- **per-task review gate**（Superpowers）：每个task后审查，防止偏离累积
- **Scope drift detection**（gstack, mattpocock）：显式检测scope creep
- **Progress Ledger**（Superpowers）：持久化进度，抗context compaction
- **Continuous Checkpoint**（gstack）：WIP commit记录决策上下文
- **步骤数 ≤ ~7**：减少长流程偏离的风险

**残余风险**：per-task review增加成本。步骤数限制可能不适合复杂变更。

### 4.4 Spec与代码不一致

**失败模式**：开发者改了代码但忘了更新spec，导致spec与代码不一致（spec腐化）。

**证据**：
- OpenSpec的verify检查spec与代码的一致性——说明这个问题确实存在
- OpenSpec的MODIFIED scenario保护——检查MODIFIED块是否遗漏了当前spec中的scenario
- 所有没有source of truth的项目（Superpowers, ECC, mattpocock, gstack）都面临spec过时问题

**应对策略**：
- **Delta合并**（OpenSpec）：每次archive将delta合并回source of truth
- **verify**（OpenSpec）：检查spec与代码的一致性
- **定期spec审计**：人工检查spec是否仍然描述系统当前行为
- **一次性spec**（其他项目）：接受spec过时，不维护source of truth

**残余风险**：Delta合并可能出错（合并顺序、手动编辑破坏结构）。verify基于启发式推理，不是确定性证明。定期spec审计的成本和频率不确定。

### 4.5 Delta合并出错

**失败模式**：Delta合并是程序化操作——但可能出错（合并顺序不语义正确、手动编辑破坏结构、bulk archive时冲突）。

**证据**：
- OpenSpec的原子性保证（先验证后写入）——说明合并出错是真实风险
- OpenSpec的跨段冲突检测——说明同一requirement可能同时出现在多个delta段中
- OpenSpec的 `--no-validate` 应急选项——说明在极端情况下需要跳过验证

**应对策略**：
- **原子性保证**（OpenSpec）：先在内存中prepare所有updates，验证全部通过后才写入
- **跨段冲突检测**（OpenSpec）：同一requirement不能同时出现在多个delta段中
- **MODIFIED scenario保护**（OpenSpec）：检查MODIFIED块是否遗漏了scenario
- **合并后重建验证**（OpenSpec）：合并后重建完整spec再验证一次

**残余风险**：Bulk archive时合并顺序按时间排序，可能不是语义正确的顺序。手动编辑破坏结构（`--no-validate` 可跳过验证）。

### 4.6流程过重导致放弃

**失败模式**：流程太重，用户选择完全不用——回退到无流程的"直接编码"模式。

**证据**：
- 某研发流程尝试的38 phase + 10角色流程——协调成本失控，最终放弃
- Superpowers的HARD-GATE对简单变更过重——可能阻碍快速迭代
- gstack的21步ship流程——对小型项目可能过重

**应对策略**：
- **Progressive Rigor**（ECC, OpenSpec）：低风险变更轻量化
- **Enablers not Gates**（OpenSpec）：允许跳过不需要的节点
- **Size classifier**（ECC）：trivial变更跳过plan
- **autoplan**（gstack）：encoded decision principles自动处理常见决策
- **no-fog early exit**（mattpocock）：中小型工作不走Wayfinder

**残余风险**：如果流程经常被跳过，它就没有价值。需要在"足够轻量以被使用"和"足够严格以提供保障"之间找到平衡。

---

## 5. 迭代思路的总结

### 5.1从各项目演进历史中提炼的共同模式

综合5个项目的迭代历史，可以提炼以下共同模式：

**模式一：失败驱动改进**
- Superpowers：24 failure memories → Rationalization表
- OpenSpec：用户反馈 → 82个archived change
- gstack：/retro + /learn → learnings.jsonl
- 共同点：从真实失败中学习，而非从理论推测中设计

**模式二：渐进式简化**
- Superpowers：6阶段 → 自然对话；25min review → 30s self-review；2 reviewer → 1 reviewer
- mattpocock：删除TDD refactor阶段
- OpenSpec：core → expanded（用户按需选择功能集）
- 共同点：流程会自然变复杂，需要主动简化

**模式三：渐进式增强**
- OpenSpec：core → expanded → stores
- Superpowers：v1 → v6.1（逐步增加Rationalization、Red Flags、Progress Ledger等）
- gstack：逐步增加skills和tools
- 共同点：功能逐步增加，但保持向后兼容

**模式四：测试驱动改进**
- Superpowers：eval（drill harness + 压力测试）
- gstack：/retro（趋势追踪）+ Health Score
- OpenSpec：verify（三维验证）
- 共同点：用数据衡量改进效果，而非主观感受

**模式五：工具化按需引入**
- OpenSpec：从纯Markdown到CLI工具（validator, archive, verify）
- ECC：从skills到hooks到delivery-gate
- gstack：从skills到tools（浏览器守护进程、benchmark）
- 共同点：工具化在手动操作成本明确不可接受时引入，而非一开始就工具化

### 5.2渐进式rigor作为核心策略

"渐进式rigor"是多个项目独立发现的共同策略：

- **ECC**：Quick Capture（3-7个AC）vs Full Acceptance Brief（含Risk Review）
- **OpenSpec**：Lite spec vs Full spec；core profile vs expanded profile
- **mattpocock**：Wayfinder的no-fog early exit（中小型工作不走Wayfinder）
- **gstack**：autoplan的encoded decision principles（常见决策自动化，taste decisions人工）
- **Superpowers**：scope check（多子系统项目分解为多个设计单元）

**渐进式rigor的核心思想**：不是所有变更都需要同样的流程深度。低风险变更用轻量流程（快速、低门槛），高风险变更用完整流程（严格、有保障）。这既避免了"流程过重导致放弃"（低风险变更不被流程拖慢），又避免了"流程太轻导致质量不足"（高风险变更有充分保障）。

**未解决的问题**：风险等级由谁判断？ECC的Size classifier是自动判断（但可能误判），OpenSpec的Progressive Rigor是用户选择（但可能低估风险）。一个可能的实践方向是：agent给出风险建议 + 用户确认——agent基于变更影响范围（如是否触及auth/payments/data migration）给出建议，用户最终决定。

### 5.3 "流程是活的"

一个关键的认识：**流程不是一次设计就完成的——它需要持续维护和简化**。

**证据**：
- Superpowers v1→v6.1的演进——每个版本都修正了之前的问题
- OpenSpec 82个archived change——流程自身也通过delta机制演进
- gstack的 /learn和encoded decision principles——流程随着使用越来越自动化

**流程"活着"的表现**：
1. **定期审查**：哪些规则已经过时？哪些检查已经不必要？哪些步骤可以合并？
2. **从失败中学习**：每次发现新的失败模式时，增加对应的防御
3. **从成功中简化**：当某个约束被证明不再必要时（如模型能力提升），主动删除
4. **趋势追踪**：用数据（时间、token、成功率）追踪流程效果，而非主观感受

**实践方向**：流程的维护应该像代码的维护一样——定期"重构"（简化过时的部分）、"修复bug"（增加对新失败模式的防御）、"测试"（用eval衡量改进效果）。Superpowers的eval + 94% PR拒绝率是最接近这个理念的做法——流程变更有极高的门槛，确保只有高质量变更被合并。

### 5.4仍未解决的问题和待验证的假设

**未解决的问题**：
1. **如何衡量流程遵守度？** Superpowers的eval是最直接的方法，但搭建drill harness的成本很高。是否有更低成本的衡量方法？
2. **如何判断"流程过重"的临界点？** 什么程度的复杂度会导致用户放弃使用流程？目前没有项目给出定量分析。
3. **如何自动化"规则过时检测"？** 没有项目实现了这个——目前只能靠人工审查。
4. **Context compaction后恢复成功率的定量数据？** Superpowers的Progress Ledger和gstack的Continuous Checkpoint都试图解决这个问题，但没有给出恢复成功率的定量数据。

**待验证的假设**：
1. **"按风险等级调节深度"是否有效？** ECC和OpenSpec都在这个方向上探索，但没有公开的效度数据。
2. **"机械化检查 + AI推理互补"是否比单一方式更好？** ECC的delivery-gate + code-reviewer是互补设计，但没有对比实验。
3. **"跨模型审查"的成本效益平衡点在哪里？** gstack的 /codex需要两个AI服务，但没有公开成本效益分析。
4. **"渐进式rigor"的风险判断由agent做还是用户做更可靠？** 没有项目给出对比数据。
5. **"纯Markdown约定"的遵守度在长期使用中是否改善？** 随着模型能力提升，agent对skill约束的遵守率是否会提高？

这些问题的答案可能需要在实际使用中逐步探索——通过实践、衡量、迭代来验证或证伪。

---

---

点击下方"**阅读原文**"进入我的演示网站。
