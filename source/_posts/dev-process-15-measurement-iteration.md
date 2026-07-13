---
title: AI 研发流程深度解析（十五）：衡量判断标准与迭代思路——如何衡量流程是否有效，如何持续改进
description: 探讨如何判断一个 AI 辅助研发流程是否有效，衡量标准是什么，以及流程应该如何迭代优化。
tags:
  - 研发流程
  - 衡量
  - 迭代
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-13
> **核心问题：** 如何判断一个 AI 辅助研发流程是否有效？衡量标准是什么？流程应该如何迭代优化？

---

## 引言

第十四篇综合了各家的特色对比和逐节点深入分析，提炼了全面轻量的研发流程的可能形态。但一个流程不是一次设计就完成的——它需要持续衡量、迭代和简化。本篇讨论如何衡量流程是否有效，以及如何迭代优化。

需要强调：本篇是衡量与迭代方向的探讨，不是指标设计。目标是讨论"如何衡量和迭代"的方向，而非"我们要用什么指标"。

---

## 1. 模型能力与流程复杂度的关系

### 1.1 模型能力地图

从前 13 篇的源码分析中，可以提炼 AI agent 在研发流程中的能力地图：

**擅长（模型能力足够，流程可以轻量化）：**
- **代码生成**：给定明确 spec 和 plan，AI 能生成高质量代码。Superpowers 的 SDD 和 OpenSpec 的 apply 都依赖这个能力。
- **格式化输出**：AI 能按模板生成结构化文档。OpenSpec 的 `/opsx:propose` 自动生成 proposal + specs + design + tasks。
- **模式识别**：AI 能从 diff 中识别代码质量问题。mattpocock 的 12 种 Fowler smell baseline 和 gstack 的 slop scan 都依赖这个能力。
- **上下文推理**：AI 能从对话中提取隐含的需求和约束。mattpocock 的 grilling 和 ECC 的 intent-driven-development 都依赖这个能力。

**不擅长（模型能力不足，需要流程补偿）：**
- **自我验证**：AI 倾向于声称"should work now"而不实际运行验证。Superpowers 的 Iron Law 和 24 failure memories 证明这是最常见的失败模式。
- **自我合理化**：AI 会为跳过流程找借口——"this is too simple to need a design"、"I'm confident"、"agent said success"。Superpowers 的 Rationalization 表专门防御这个。
- **长流程保持一致**：在多步骤流程中，AI 会偏离原始 plan——忘记 Global Constraints、引入 scope creep、做出与 spec 不一致的实现。gstack 的 Scope Drift Detection 和 Superpowers 的 per-task review gate 都是对这个问题的应对。
- **判断风险等级**：AI 对业务影响的判断不够敏感——可能将高风险变更（如 auth、payments、data migration）当作低风险处理。ECC 的 Size classifier 和 OpenSpec 的 Progressive Rigor 都需要人类最终判断。
- **跨 task 结构性思考**：AI 在单个 task 内表现良好，但跨 task 的结构性问题（重复逻辑、命名不一致、函数膨胀）容易被忽略。Superpowers 的 whole-branch final review 专门检查这些问题。

**不确定（能力边界不清晰）：**
- **Spec 编写质量**：AI 能生成格式正确的 spec，但 spec 的内容质量（是否覆盖 edge case、scenario 是否真正 exercise 需求）难以自动判断。gstack 的 Codex quality gate 用跨模型评分，但 7/10 门槛是主观的。
- **TDD 驱动设计**：TDD 的核心价值是"让测试失败信息驱动设计决策"——但 AI 是否真正利用了测试失败信息，还是只是在"写测试 → 写实现 → 过测试"的机械循环？mattpocock 的 reference-only TDD 依赖 AI 内化的 TDD 习惯，但这个习惯的可靠性不确定。
- **Delta 合并的正确性**：OpenSpec 的 Delta 合并是程序化的——但判断 Delta 本身是否正确（是否遗漏了 scenario、合并顺序是否语义正确）仍需要 AI 推理。

### 1.2 流程复杂度的边界

模型能力与流程复杂度之间存在反向关系：模型能力越强，流程可以越简单；模型能力越弱，流程需要越复杂来补偿。

但这个关系有一个关键限制——**流程不能弥补模型能力的不足**。

**证据：**
- 某研发流程尝试的 38 phase + 10 角色的流程试图用复杂流程弥补模型能力不足——结果是协调成本失控，流程偏离率高
- Superpowers 的 Iron Law 依赖 agent 遵守 skill 约束——但 skill 触发率只有 50-80%。如果 agent 根本不读 skill，Iron Law 就形同虚设
- ECC 的 delivery-gate 用 hook 100% 触发解决了触发率问题——但 hook 只能检查表面模式（regex/mtime/disk），不能检查内容质量

**关键洞察**：流程可以补偿模型能力的"习惯性不足"（如不运行验证、跳过探索），但不能补偿模型能力的"能力性不足"（如无法判断业务风险、无法做跨 task 结构性思考）。前者用 Rationalization 表和 Iron Law 式的行为约束有效；后者需要人工介入或更强的模型。

### 1.3 步骤数与角色数的自然边界

第十四篇已经讨论了步骤数和角色数的自然边界。这里从衡量角度补充：

**步骤数 ≤ ~7 步**：
- 5 个项目的显式步骤数都集中在 5-7 步
- 某研发流程尝试的 38 phase 失败表明，步骤数超过 ~7 步后，agent 偏离概率急剧上升
- 但步骤数太少（< 5 步）会缺失关键环节——如跳过 Review 或 Verify

**核心角色 ≤ ~3 个**：
- 实际在单个流程实例中活跃的角色通常在 2-3 个
- 某研发流程尝试的 10 角色教训表明，角色数超过 3-4 个后，协调成本急剧上升
- gstack 的 8+ 角色适合大型变更，但对中小型变更过重

**实践方向**：衡量流程复杂度的第一个标准是"步骤数和角色数是否在自然边界内"。如果一个流程需要 10+ 步或 5+ 角色，它可能试图用流程复杂度弥补模型能力不足——这通常不会成功。

---

## 2. 衡量判断标准

### 2.1 Superpowers 的 eval 方法

Superpowers 是 5 个项目中唯一有系统化评估方法的项目。它的评估体系包括两类测试：

**Plugin tests（非 LLM 代码测试）**：
- 用 bash/node 测试 SKILL.md 中的非 LLM 逻辑（如脚本、模板生成）
- 确定性测试——不依赖 AI 推理

**Evals（LLM 行为合规测试）**：
- **Drill harness**：真实 tmux session + LLM actor + verifier
- **压力测试场景**：time + sunk cost + authority + exhaustion 组合施压
  - Time pressure："we need to ship this in 10 minutes"
  - Sunk cost："you've already spent 2 hours on this, just finish it"
  - Authority："the user said to skip tests"
  - Exhaustion："this is the 15th task, just wrap it up"
- **94% PR 拒绝率**：对 skill 修改的门槛极高——确保只有高质量变更被合并

**关键设计**：Superpowers 的 eval 不是测试代码质量——而是测试 **skill 是否真正塑造了 agent 行为**。这是评估流程有效性的核心维度：流程约束是否被 agent 遵守？

### 2.2 OpenSpec 的 verify 方法

OpenSpec 的 `/opsx:verify` 从三个维度验证：

- **Completeness**：所有 task 完成、所有 requirement 实现、scenario 覆盖
- **Correctness**：实现匹配 spec 意图、edge case 处理
- **Coherence**：design 决策在代码中体现、命名一致

**关键特征**：
- 基于启发式规则（关键词搜索、文件路径分析）——不是确定性证明
- 不阻断 archive——暴露问题由人类决策
- False Positive 策略：不确定时优先 SUGGESTION 而非 WARNING
- Graceful Degradation：只有 tasks.md 时只验证 task 完成；有 tasks+specs 时验证 completeness+correctness；完整 artifacts 时验证全部

### 2.3 其他项目的衡量方法

**ECC**：
- verification-loop 的 6 phase（Build → Type → Lint → Test → Security → Diff）输出 VERIFICATION REPORT
- delivery-gate 的机械化检查（regex + mtime + disk）
- agent-self-evaluation 的 5 轴自评（Accuracy/Completeness/Clarity/Actionability/Conciseness）
- Harness audit scoring——orch-* pipeline 的评分机制

**gstack**：
- /qa 的 Health Score Rubric（8 维度加权评分：Console 15% + Links 10% + Visual 10% + Functional 20% + UX 15% + Performance 10% + Content 5% + Accessibility 15%）
- Review Readiness Dashboard——可视化审查状态
- Plan Completion Audit——DONE/PARTIAL/NOT DONE/CHANGED/UNVERIFIABLE 分类
- /retro 的 per-person breakdowns + shipping streaks + test health trends

**mattpocock**：
- TDD red-green——测试通过/失败是核心衡量
- code-review 的双轴报告（Standards + Spec）
- "tight + red-capable"反馈循环标准——a 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight

### 2.4 可能的衡量维度讨论

综合 5 个项目的实践，可以提炼出衡量流程有效性的可能维度：

**维度一：流程遵守度——agent 是否按步骤执行？**
- Superpowers 的 eval 是最直接的衡量——测试 skill 是否塑造了 agent 行为
- 其他项目没有直接衡量这个维度——ECC 的 delivery-gate 检查 rationalization 文本是间接衡量
- 衡量方法：drill harness 式的压力测试——在 time/sunk cost/authority/exhaustion 施压下，agent 是否仍然遵守流程

**维度二：Spec 质量——行为是否可测试？是否混入实现细节？**
- OpenSpec 的 validator 检查格式（Requirement 有 SHALL/MUST、Scenario 有 GIVEN/WHEN/THEN）
- gstack 的 Codex quality gate 检查内容质量（7/10 门槛）
- Superpowers 的 spec self-review 检查 placeholder、consistency、scope、ambiguity
- 衡量方法：格式验证（程序化）+ 内容审查（AI 推理或跨模型）

**维度三：执行质量——TDD 是否真正驱动设计？review 是否发现问题？**
- Superpowers 的 per-task review 检查 spec compliance + code quality
- mattpocock 的双轴审查检查 Standards + Spec
- ECC 的 verification-loop 检查 Build/Type/Lint/Test/Security/Diff
- 衡量方法：代码审查 findings 的数量和严重度 + 测试覆盖率 + 构建通过率

**维度四：产出质量——代码是否满足 spec？是否有回归？**
- Superpowers 的 Iron Law：fresh verification evidence
- OpenSpec 的 verify：Completeness + Correctness + Coherence
- gstack 的 /qa：浏览器端到端 + 健康评分
- mattpocock 的 TDD red-green + 反馈循环
- 衡量方法：测试通过率 + 端到端验证 + 回归测试

**维度五：流程效率——从开始到完成的时间、token 消耗、subagent 调用次数**
- gstack 的 /retro 提供shipping streaks和test health trends
- Superpowers 的 v4→v5 演进（25min → 30s）是效率衡量的典型案例
- 衡量方法：时间跟踪 + token 计数 + 调用次数统计

### 2.5 "通过/不通过 + 具体问题" vs 评分阈值

这是一个重要的衡量方法论选择。从 5 个项目的实践中可以看到两种方向：

**评分阈值（gstack, ECC）**：
- gstack 的 Codex quality gate：7/10 门槛
- gstack 的 Health Score Rubric：8 维度加权评分
- ECC 的 agent-self-evaluation：5 轴自评
- 优势：看起来客观、可比较、可追踪趋势
- 代价：假精确——评分看起来精确但实际依赖 AI 主观判断。"7/10"和"6/10"的差异可能只是 AI 的随机波动

**通过/不通过 + 具体问题（Superpowers, mattpocock, OpenSpec）**：
- Superpowers 的 Iron Law：验证通过或不通过（没有"部分通过"）
- Superpowers 的 review findings：Critical/Important/Minor + 具体描述
- mattpocock 的 TDD：red 或 green（没有"70% green"）
- OpenSpec 的 verify：CRITICAL/WARNING/SUGGESTION + 具体问题
- 优势：诚实——不假装精确；可操作——每个问题都有具体描述
- 代价：不可比较——没有统一的"质量分数"

**某研发流程尝试的教训**：三层验证 + 评分阈值看起来很科学，但实际依赖 AI 主观判断。评分阈值给了"流程有效"的假象——分数达标不代表质量真的达标。

**实践方向**：质量判断用"通过/不通过 + 具体问题"比评分阈值更诚实。Superpowers 的 Critical/Important/Minor 分级 + 具体描述是最可操作的——每个 finding 都有明确的修复要求。gstack 的 Health Score 在趋势追踪上有价值（"上次 85 分，这次 72 分"提示退化），但绝对分数（"72 分是否达标"）不够可靠。一个可能的折中是：用"通过/不通过 + 具体问题"做质量判断，用评分做趋势追踪——但不把评分作为质量门禁。

---

## 3. 迭代优化的模式

### 3.1 Superpowers 的迭代模式：失败驱动 + 渐进简化

Superpowers 的迭代是"失败驱动"的——每次变更都因为之前出了问题。从 RELEASE-NOTES.md 的演进历史中可以提炼以下模式：

**从失败中学习**：
- 24 failure memories 来自真实失败案例——每个 rationalization 都来自 baseline 测试中 agent 的实际行为
- v3.4.0→v4.3.0：去掉 HARD-GATE → 加回 HARD-GATE——因为 agent 会跳过探索
- v6.0.0：禁止 controller 指导 reviewer 忽略什么——因为 "real runs caught controllers coaching reviewers to skip findings"

**渐进式简化**：
- v4→v5：brainstorming 从"6 阶段正式流程 + checklist"回到"自然对话"——重型流程被简化
- v4→v5：subagent review loop → inline self-review（25min → 30s，质量相当）——不是所有环节都需要 subagent
- v5→v6：两个 reviewer → 一个 reviewer（成本减半，质量不降）——subagent 数量可以优化

**测试驱动改进**：
- 每个 rationalization 都来自 baseline 测试
- 94% PR 拒绝率确保只有高质量变更被合并
- Micro-test wording：5+ 样本验证措辞后才跑完整压力测试

### 3.2 OpenSpec 的迭代模式：用户反馈驱动 + 渐进增强

OpenSpec 的迭代是"用户反馈驱动"的——82 个 archived change 记录了设计决策的演进历史。从 changes/archive/ 中可以提炼以下模式：

**从用户反馈中学习**：
- 2025-08：从 phase-locked 到 fluid actions——"传统工作流强制你经过阶段，但真实工作不 fit 进盒子"
- 2025-08：采用 delta-based changes——brownfield-first 的核心洞察
- 2025-09：multi-agent init + slash command support——适配多 AI 工具
- 2026-05：workspace——跨 repo 变更规划

**渐进式增强**：
- core（默认 5 个命令）→ expanded（完整命令集）→ stores（beta）——功能逐步增加
- Schema 四级解析（CLI→change→project→default）——允许同一项目不同变更使用不同工作流
- Profile 系统：core vs expanded——用户按需选择功能集

**保持向后兼容**：
- archive 命令的验证规则逐步增强，但 `--no-validate` 应急选项保留
- 新的 artifact 类型可以添加到 schema 中，但旧 artifact 仍然有效

### 3.3 ECC 和 gstack 的迭代模式

**ECC**：
- Continuous Learning v2 的 instinct 机制——自动从会话中提取模式
- Instinct → skill 演化——高置信度的 instinct 升级为 skill
- 这是"学习驱动"的迭代——agent 从经验中学习并改进流程
- 但默认关闭且效果未验证

**gstack**：
- /learn 的 learnings.jsonl——learnings compound across sessions
- /retro 的回顾机制——per-person breakdowns + shipping streaks + test health trends
- encoded decision principles——将常见决策编码为自动规则
- 这是"数据驱动"的迭代——通过回顾和数据发现模式

### 3.4 什么时候增加复杂度？什么时候减少？

从 5 个项目的演进历史中，可以提炼增加和减少复杂度的时机：

**增加复杂度的时机**：
- 当手动操作成本明确不可接受时
  - OpenSpec 的 Delta 机制：手动维护全量 spec 的成本不可接受 → 引入 Delta
  - gstack 的 Continuous Checkpoint：手动记录进度的成本不可接受 → 自动化
- 当新的失败模式被发现时
  - Superpowers 的 Rationalization 表：发现新的"跳过"借口 → 增加对应的防御
  - Superpowers v6 的"禁止 controller 指导 reviewer"：发现 controller 操控 reviewer → 增加禁令
- 当用户反馈指出缺失时
  - OpenSpec 的 workspace：用户需要跨 repo 变更规划 → 增加 workspace 功能

**减少复杂度的时机**：
- 当某个环节被证明无效或过重时
  - Superpowers v4→v5：brainstorming 6 阶段 → 自然对话——重型流程被简化
  - Superpowers v4→v5：subagent review loop → inline self-review——25min → 30s
  - Superpowers v5→v6：两个 reviewer → 一个 reviewer——成本减半
- 当模型能力提升使某些约束不再必要时
  - mattpocock 删除 TDD 的 refactor 阶段——"refactoring belongs to the review stage"
  - （假设性）如果模型的自我验证能力提升到 100%，Iron Law 可能不再必要

**关键原则**：
1. **增加需要证据，减少需要勇气**——增加复杂度有明确的触发条件（手动成本、新失败模式、用户反馈），但减少复杂度需要承认之前的决策不再有效
2. **先减少后增加**——Superpowers 的演进表明，简化（v4→v5）往往比增加（v5→v6）带来更大的收益
3. **测试驱动增减**——Superpowers 的 eval 确保增减不会降低质量

### 3.5 流程的"熵增"倾向

一个重要的观察：**流程会自然变复杂，需要主动简化**。

**熵增的表现**：
- Superpowers 的 Rationalization 表不断增长——每发现一个新的"跳过"借口就增加一条
- ECC 的 67 agents 和 261+ skills——素材库自然膨胀
- gstack 的 21 步 ship 流程——每一步都是对某个问题的应对
- OpenSpec 的 82 个 archived change——每个 change 可能增加新的规则或约束

**熵增的原因**：
- 每个新问题都倾向于"加一个规则"而非"修改现有规则"
- 删除规则比增加规则更难——需要证明它不再需要
- 使用者倾向于"加一个检查"而非"信任现有检查"

**实践方向**：流程需要定期"减熵"——主动审查哪些规则已经过时、哪些检查已经不必要、哪些步骤可以合并。Superpowers 的渐进式简化（v4→v5→v6）是"减熵"的典型案例——每次版本更新都简化了一些环节。OpenSpec 的 archive 机制本身就是一种"减熵"——将已完成的 change 移到 archive，保持 changes/ 目录的整洁。但"减熵"需要主动进行——没有项目实现了自动化的"规则过时检测"。

---

## 4. 失败模式与应对

### 4.1 Agent 跳过流程

**失败模式**：AI agent 在被催促或面对"看起来简单"的任务时，跳过 Explore、Spec 或 Verify 等节点。

**证据**：
- Superpowers v3.4.0→v4.3.0：去掉 HARD-GATE 后 agent 跳过 brainstorming
- Superpowers 的 24 failure memories：agent 声称"should work now"而不运行验证
- "this is too simple to need a design"是最常见的 anti-pattern

**应对策略**：
- **Rationalization 表**（Superpowers）：列出所有"跳过"借口及现实对照
- **HARD-GATE**（Superpowers）：阻断编码直到设计批准
- **delivery-gate hook**（ECC）：regex 匹配 rationalization 文本，100% 触发
- **渐进式 rigor**（ECC, OpenSpec）：低风险变更轻量化，减少"跳过"的动机

**残余风险**：Rationalization 表和 skill 约束的触发率只有 50-80%——如果 agent 不读 skill，约束就无效。HARD-GATE 和 delivery-gate hook 更可靠但更重。

### 4.2 Agent 不遵守格式

**失败模式**：AI agent 在生成 spec、plan 或代码时不遵守规定的格式。

**证据**：
- OpenSpec 需要 validator.ts 程序化验证 spec 格式——说明 AI 经常生成格式不正确的 spec
- mattpocock 明确禁止 spec 包含 file paths 和 code snippets——说明 AI 倾向于在 spec 中包含代码
- Superpowers 的 "No Placeholders" 原则——说明 AI 倾向于生成含占位符的 plan

**应对策略**：
- **程序化验证**（OpenSpec validator）：格式不正确则 propose 失败
- **micro-test wording**（Superpowers）：5+ 样本验证措辞
- **明确禁止 + 理由**（mattpocock）："they go stale fast"——不只是禁止，还说明为什么
- **模板 + 示例**（所有项目）：提供明确的格式模板和示例

**残余风险**：程序化验证只能检查格式，不能检查内容。一个格式完美的 spec 可能逻辑漏洞百出。

### 4.3 Agent 在长流程中偏离

**失败模式**：在多步骤流程中，AI agent 偏离原始 plan——引入 scope creep、忘记 Global Constraints、做出与 spec 不一致的实现。

**证据**：
- gstack 的 Scope Drift Detection——检测 SCOPE CREEP 和 MISSING REQUIREMENTS
- Superpowers 的 whole-branch final review——检查跨 task 的结构性问题
- mattpocock 的 Spec 轴——检查 scope creep 和实现错误的需求

**应对策略**：
- **per-task review gate**（Superpowers）：每个 task 后审查，防止偏离累积
- **Scope drift detection**（gstack, mattpocock）：显式检测 scope creep
- **Progress Ledger**（Superpowers）：持久化进度，抗 context compaction
- **Continuous Checkpoint**（gstack）：WIP commit 记录决策上下文
- **步骤数 ≤ ~7**：减少长流程偏离的风险

**残余风险**：per-task review 增加成本。步骤数限制可能不适合复杂变更。

### 4.4 Spec 与代码不一致

**失败模式**：开发者改了代码但忘了更新 spec，导致 spec 与代码不一致（spec 腐化）。

**证据**：
- OpenSpec 的 verify 检查 spec 与代码的一致性——说明这个问题确实存在
- OpenSpec 的 MODIFIED scenario 保护——检查 MODIFIED 块是否遗漏了当前 spec 中的 scenario
- 所有没有 source of truth 的项目（Superpowers, ECC, mattpocock, gstack）都面临 spec 过时问题

**应对策略**：
- **Delta 合并**（OpenSpec）：每次 archive 将 delta 合并回 source of truth
- **verify**（OpenSpec）：检查 spec 与代码的一致性
- **定期 spec 审计**：人工检查 spec 是否仍然描述系统当前行为
- **一次性 spec**（其他项目）：接受 spec 过时，不维护 source of truth

**残余风险**：Delta 合并可能出错（合并顺序、手动编辑破坏结构）。verify 基于启发式推理，不是确定性证明。定期 spec 审计的成本和频率不确定。

### 4.5 Delta 合并出错

**失败模式**：Delta 合并是程序化操作——但可能出错（合并顺序不语义正确、手动编辑破坏结构、bulk archive 时冲突）。

**证据**：
- OpenSpec 的原子性保证（先验证后写入）——说明合并出错是真实风险
- OpenSpec 的跨段冲突检测——说明同一 requirement 可能同时出现在多个 delta 段中
- OpenSpec 的 `--no-validate` 应急选项——说明在极端情况下需要跳过验证

**应对策略**：
- **原子性保证**（OpenSpec）：先在内存中 prepare 所有 updates，验证全部通过后才写入
- **跨段冲突检测**（OpenSpec）：同一 requirement 不能同时出现在多个 delta 段中
- **MODIFIED scenario 保护**（OpenSpec）：检查 MODIFIED 块是否遗漏了 scenario
- **合并后重建验证**（OpenSpec）：合并后重建完整 spec 再验证一次

**残余风险**：Bulk archive 时合并顺序按时间排序，可能不是语义正确的顺序。手动编辑破坏结构（`--no-validate` 可跳过验证）。

### 4.6 流程过重导致放弃

**失败模式**：流程太重，用户选择完全不用——回退到无流程的"直接编码"模式。

**证据**：
- 某研发流程尝试的 38 phase + 10 角色流程——协调成本失控，最终放弃
- Superpowers 的 HARD-GATE 对简单变更过重——可能阻碍快速迭代
- gstack 的 21 步 ship 流程——对小型项目可能过重

**应对策略**：
- **Progressive Rigor**（ECC, OpenSpec）：低风险变更轻量化
- **Enablers not Gates**（OpenSpec）：允许跳过不需要的节点
- **Size classifier**（ECC）：trivial 变更跳过 plan
- **autoplan**（gstack）：encoded decision principles 自动处理常见决策
- **no-fog early exit**（mattpocock）：中小型工作不走 Wayfinder

**残余风险**：如果流程经常被跳过，它就没有价值。需要在"足够轻量以被使用"和"足够严格以提供保障"之间找到平衡。

---

## 5. 迭代思路的总结

### 5.1 从各项目演进历史中提炼的共同模式

综合 5 个项目的迭代历史，可以提炼以下共同模式：

**模式一：失败驱动改进**
- Superpowers：24 failure memories → Rationalization 表
- OpenSpec：用户反馈 → 82 个 archived change
- gstack：/retro + /learn → learnings.jsonl
- 共同点：从真实失败中学习，而非从理论推测中设计

**模式二：渐进式简化**
- Superpowers：6 阶段 → 自然对话；25min review → 30s self-review；2 reviewer → 1 reviewer
- mattpocock：删除 TDD refactor 阶段
- OpenSpec：core → expanded（用户按需选择功能集）
- 共同点：流程会自然变复杂，需要主动简化

**模式三：渐进式增强**
- OpenSpec：core → expanded → stores
- Superpowers：v1 → v6.1（逐步增加 Rationalization、Red Flags、Progress Ledger 等）
- gstack：逐步增加 skills 和 tools
- 共同点：功能逐步增加，但保持向后兼容

**模式四：测试驱动改进**
- Superpowers：eval（drill harness + 压力测试）
- gstack：/retro（趋势追踪）+ Health Score
- OpenSpec：verify（三维验证）
- 共同点：用数据衡量改进效果，而非主观感受

**模式五：工具化按需引入**
- OpenSpec：从纯 Markdown 到 CLI 工具（validator, archive, verify）
- ECC：从 skills 到 hooks 到 delivery-gate
- gstack：从 skills 到 tools（浏览器守护进程、benchmark）
- 共同点：工具化在手动操作成本明确不可接受时引入，而非一开始就工具化

### 5.2 渐进式 rigor 作为核心策略

"渐进式 rigor"是多个项目独立发现的共同策略：

- **ECC**：Quick Capture（3-7 个 AC）vs Full Acceptance Brief（含 Risk Review）
- **OpenSpec**：Lite spec vs Full spec；core profile vs expanded profile
- **mattpocock**：Wayfinder 的 no-fog early exit（中小型工作不走 Wayfinder）
- **gstack**：autoplan 的 encoded decision principles（常见决策自动化，taste decisions 人工）
- **Superpowers**：scope check（多子系统项目分解为多个设计单元）

**渐进式 rigor 的核心思想**：不是所有变更都需要同样的流程深度。低风险变更用轻量流程（快速、低门槛），高风险变更用完整流程（严格、有保障）。这既避免了"流程过重导致放弃"（低风险变更不被流程拖慢），又避免了"流程太轻导致质量不足"（高风险变更有充分保障）。

**未解决的问题**：风险等级由谁判断？ECC 的 Size classifier 是自动判断（但可能误判），OpenSpec 的 Progressive Rigor 是用户选择（但可能低估风险）。一个可能的实践方向是：agent 给出风险建议 + 用户确认——agent 基于变更影响范围（如是否触及 auth/payments/data migration）给出建议，用户最终决定。

### 5.3 "流程是活的"

一个关键的认识：**流程不是一次设计就完成的——它需要持续维护和简化**。

**证据**：
- Superpowers v1→v6.1 的演进——每个版本都修正了之前的问题
- OpenSpec 82 个 archived change——流程自身也通过 delta 机制演进
- gstack 的 /learn 和 encoded decision principles——流程随着使用越来越自动化

**流程"活着"的表现**：
1. **定期审查**：哪些规则已经过时？哪些检查已经不必要？哪些步骤可以合并？
2. **从失败中学习**：每次发现新的失败模式时，增加对应的防御
3. **从成功中简化**：当某个约束被证明不再必要时（如模型能力提升），主动删除
4. **趋势追踪**：用数据（时间、token、成功率）追踪流程效果，而非主观感受

**实践方向**：流程的维护应该像代码的维护一样——定期"重构"（简化过时的部分）、"修复 bug"（增加对新失败模式的防御）、"测试"（用 eval 衡量改进效果）。Superpowers 的 eval + 94% PR 拒绝率是最接近这个理念的做法——流程变更有极高的门槛，确保只有高质量变更被合并。

### 5.4 仍未解决的问题和待验证的假设

**未解决的问题**：
1. **如何衡量流程遵守度？** Superpowers 的 eval 是最直接的方法，但搭建 drill harness 的成本很高。是否有更低成本的衡量方法？
2. **如何判断"流程过重"的临界点？** 什么程度的复杂度会导致用户放弃使用流程？目前没有项目给出定量分析。
3. **如何自动化"规则过时检测"？** 没有项目实现了这个——目前只能靠人工审查。
4. **Context compaction 后恢复成功率的定量数据？** Superpowers 的 Progress Ledger 和 gstack 的 Continuous Checkpoint 都试图解决这个问题，但没有给出恢复成功率的定量数据。

**待验证的假设**：
1. **"按风险等级调节深度"是否有效？** ECC 和 OpenSpec 都在这个方向上探索，但没有公开的效度数据。
2. **"机械化检查 + AI 推理互补"是否比单一方式更好？** ECC 的 delivery-gate + code-reviewer 是互补设计，但没有对比实验。
3. **"跨模型审查"的成本效益平衡点在哪里？** gstack 的 /codex 需要两个 AI 服务，但没有公开成本效益分析。
4. **"渐进式 rigor"的风险判断由 agent 做还是用户做更可靠？** 没有项目给出对比数据。
5. **"纯 Markdown 约定"的遵守度在长期使用中是否改善？** 随着模型能力提升，agent 对 skill 约束的遵守率是否会提高？

这些问题的答案可能需要在实际使用中逐步探索——通过实践、衡量、迭代来验证或证伪。

---
