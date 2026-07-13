---
title: AI 研发流程深度解析（十二）：Review & Verify 节点——从实现到确认
description: 对比 5 个项目如何审查代码和验证实现，分析 Review 的层次设计、Verify 的维度和强制程度选择的关键差异。
tags:
  - 研发流程
  - Review
  - Verify
  - 验证
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-12
> **核心问题：** 5 个项目如何审查代码和验证实现？Review 的层次设计和 Verify 的维度有什么关键差异？强制程度（gate vs 非阻断）如何选择？各项目走过哪些弯路？我们能从中学到什么？

---

## 1. 对比分析

### 1.1 Superpowers：Per-task Review Gate + Iron Law Verification

Superpowers 的 Review 和 Verify 紧密耦合在 SDD（Subagent-Driven Development）流程中，由两个 skill 承担：`requesting-code-review`（`skills/requesting-code-review/SKILL.md`）和 `verification-before-completion`（`skills/verification-before-completion/SKILL.md`）。此外，`receiving-code-review` skill 定义了如何接收和回应审查反馈。

**Review 机制——Per-task + Whole-branch 两层：**

- **Per-task review**：每个 task 完成后，controller 通过 `scripts/review-package` 生成 diff 文件，然后 dispatch 一个 task reviewer subagent（`task-reviewer-prompt.md`）。Reviewer 是 **read-only**——不直接修改代码、不触碰 working tree 或 branch。Reviewer 读 diff 文件后返回两个 verdict：**spec compliance**（实现是否符合 plan）和 **code quality**（代码质量）。Findings 分三级：Critical / Important / Minor。Critical 必须立即修复，Important 必须在进入下一个 task 前修复，Minor 记录待后处理。
- **Whole-branch final review**：所有 task 完成后执行一次，使用最强模型（`code-reviewer.md` 模板），检查跨 task 的结构性问题（去重、函数膨胀、命名一致性、无关变更）。
- **关键约束**：controller **不能告诉 reviewer 忽略什么或降级 severity**——SDD skill 明确写道："不要替 reviewer 预判发现——永远不要指示 reviewer 忽略或不标记某个具体问题。如果你正在写的 prompt 中包含 'do not flag'、'don't treat X as a defect'、'at most Minor' 或 'the plan chose'——停下来：你正在预判，通常是为了让自己少走一轮 review loop。"
- **Reviewer 不信任 implementer 的报告**：task-reviewer-prompt.md 明确写道："将 implementer 的报告视为关于代码的未经证实的声明。它可能是不完整的、不准确的或过于乐观的。要根据 diff 验证这些声明。报告中的设计理由也是声明……陈述的理由永远不能降低某个 finding 的严重程度。"
- **Receiving review**：`receiving-code-review` skill 禁止表演性同意（"You're absolutely right!"），要求技术验证后再实施。外部 reviewer 的建议被视为"需要评估的建议，而非需要遵循的命令"。

**Verify 机制——Iron Law + Gate Function：**

- **Iron Law**：`NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`——如果没在当前 message 中运行验证命令，就不能声称它通过了。"违反这条规则的字面意义就是违反这条规则的精神。"
- **Gate Function**：`IDENTIFY → RUN → READ → VERIFY → CLAIM`
  1. IDENTIFY：什么命令能证明这个 claim？
  2. RUN：执行完整命令（fresh，不是之前的缓存）
  3. READ：完整输出，检查 exit code，计数 failures
  4. VERIFY：输出是否确认 claim？
  5. ONLY THEN：做出 claim
- **Rationalization 表**：列出所有 AI 逃避验证的借口——"should work now" → RUN the verification；"I'm confident" → Confidence ≠ evidence；"Agent said success" → Verify independently。
- **Red Flags**：使用 "should" / "probably" / "seems to"；在验证前表达满意（"Great!" / "Perfect!" / "Done!"）。
- **回归测试验证**：Write → Run(pass) → Revert fix → Run(MUST FAIL) → Restore → Run(pass)——不只是写回归测试，必须验证测试在 bug 存在时确实失败。
- **24 failure memories**：来自真实失败案例——"你的人类伙伴说'我不相信你'——信任破裂了"；"未定义的函数被提交——会导致崩溃"。

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v5.0.6 之前 | brainstorming 和 writing-plans 阶段的 subagent review loop 增加了约 25 分钟执行时间，但回归测试（5 个版本 × 5 次试验）显示质量分数与是否运行 review loop 无关 | v5.0.6 用 inline self-review checklist 替代 subagent review loop——~25min → ~30s，缺陷发现率相当。brainstorming 替换为 placeholder scan + internal consistency + scope check + ambiguity check；writing-plans 替换为 spec coverage + placeholder scan + type consistency |
| v6.0.0 之前 | 每个 task 跑两个独立 reviewer（`spec-reviewer-prompt.md` + `code-quality-reviewer-prompt.md`），成本翻倍但两个 reviewer 的发现经常重叠 | v6.0.0 合并为单 reviewer 两个 verdict（`task-reviewer-prompt.md`）——一次读 diff 返回 spec compliance + code quality，一次 fix pass 清两个 verdict |
| v6.0.0 之前 | controller 在 dispatch reviewer 时会不自觉地指导 reviewer 忽略某些发现或降级 severity——"真实运行中发现 controller 指导 reviewer 跳过某个发现或称之为'最多 Minor'，导致缺陷被发布" | v6.0.0 明确禁止："不要替 reviewer 预判发现——永远不要指示 reviewer 忽略或不标记某个具体问题" |
| v6.0.0 之前 | reviewer 运行 `git checkout` 导致后续 commit 被孤立——reviewer 碰了 working tree 和 branch state | v6.0.0 reviewer 改为 read-only："Review 不再触碰 working tree 或 branch" |
| v6.0.0 之前 | controller dispatch reviewer 时不指定 model——unnamed model 静默继承 session 最贵的 model，一次运行把所有 26 个 reviewer 都放在最贵 tier | v6.0.0 template 要求显式指定 model，并按任务复杂度选择 tier |
| v6.0.0 之前 | diff 通过粘贴传递——"粘贴的 diff 永久驻留在最昂贵的 context 中"——controller context 膨胀严重 | v6.0.0 引入 `review-package` 和 `task-brief` 脚本，将 diff 和 task text 写入文件由 reviewer 读取 |
| v6.0.0 之前 | controller context compaction 后丢失进度，重新 dispatch 已完成的 task——"观察到的最昂贵的失败" | v6.0.0 引入 progress ledger 文件（`.superpowers/sdd/progress.md`），记录每个 task 的完成状态和 commit 范围 |
| v6.0.3 之前 | SDD scratch 文件写在 `.git/` 下，Claude Code 将 `.git/` 视为保护路径，agent 写入被阻止 | v6.0.3 移到 `.superpowers/sdd/` 目录 |

**核心教训：** Review 机制的演进主线是"防止 controller 和 reviewer 之间的认知串通"。从两个 reviewer 减到一个、禁止 controller 指导 reviewer、reviewer 改为 read-only、用文件传递 diff——每一步都是对真实失败模式的回应。Superpowers 的结论是：reviewer 的独立性不能靠默认行为保证，必须用显式约束。

### 1.2 OpenSpec：Two-Moment Review + Three-Dimension Verify（非阻断）

OpenSpec 将 Review 和 Verify 分为两个独立环节，由 `reviewing-changes.md` 文档和 `/opsx:verify` 命令承担（`docs/reviewing-changes.md`、`src/core/templates/workflows/verify-change.ts`）。

**Review 机制——两个时机：**

```
/opsx:propose ──► REVIEW THE PLAN ──► /opsx:apply ──► REVIEW THE CODE ──► /opsx:archive
                  (before any code)                    (/opsx:verify)
```

- **Propose 后审查（读计划）**：在代码编写前审查 proposal → specs → design.md → tasks.md。核心理念："在一页的计划中发现一个错误方向几乎不花成本。在 300 行代码中发现同样的错误方向则不然。"
- **阅读顺序按"能最早退出"排列**：proposal.md → specs/ → design.md → tasks.md。如果 proposal 方向就错了，不用往下读。
- **三个问题**：(1) 这是正确的问题吗？(2) "done" 是否定义正确？(3) 计划是否 sane？
- **Right-size review**："不是每个变更都值得完整审查。一个单文件 typo 修复值得 20 秒扫一眼。一个触及 auth、payments 或不可恢复数据的变更值得上面的每一个问题。"
- **"Pushing back is cheap"**：修改成本在 plan 阶段最低——"没有阶段划分，没有什么是锁定的——你修正它然后继续。"
- **Two-minute checklist**：7 项检查清单——intent 匹配？scope 未膨胀？requirement 可测试？requirement 有 scenario？最在意的 case 覆盖了？tasks 映射到 requirements？能接受 AI 只做这些？

**Verify 机制——三维验证（非阻断）：**

- **三个维度**：
  - **Completeness**：所有 task 完成（checkbox 解析）、所有 requirement 实现（代码搜索关键词）、scenario 覆盖
  - **Correctness**：实现匹配 spec 意图、edge case 处理、scenario 在代码中有对应处理
  - **Coherence**：design 决策在代码中体现、代码模式一致性（文件命名、目录结构、编码风格）
- **严重度分级**：CRITICAL / WARNING / SUGGESTION
- **不阻断 archive**："它**不**阻断 archiving——它暴露差距并将决定权留给你"——暴露问题但由人类决策
- **False Positive 策略**："不确定时，优先用 SUGGESTION 而非 WARNING，优先用 WARNING 而非 CRITICAL"——不确定时降级而非升级
- **Graceful Degradation**：只有 tasks.md 时只验证 task 完成；有 tasks+specs 时验证 completeness+correctness；完整 artifacts 时验证全部
- **基于启发式规则**：关键词搜索、文件路径分析、"reasonable inference"——不要求确定性证明

**历史踩坑：**

| 阶段 | 问题 | 修复 |
|------|------|------|
| 早期 | Review 阻断导致用户用 `--no-validate` 完全跳过验证——阻断反而降低了验证覆盖率 | Verify 不阻断 Archive，暴露问题让人类决策——"仪式感要与风险等级匹配" |
| 早期 | 过度结构化——所有变更都走完整审查流程，简单修改也要回答所有问题 | 引入 "Right-size review"——一文件 typo 修复值得 20 秒扫一眼，auth/payments 变更才值得完整审查 |
| 持续存在 | Verify 基于启发式规则（关键词搜索、文件路径分析）——精度有限，可能产生 false positive | "不确定时，优先用 SUGGESTION 而非 WARNING，优先用 WARNING 而非 CRITICAL"——不确定时降级，而非升级 |
| 持续存在 | Verify 不阻断——用户可以忽略所有警告直接 archive，spec 与代码可能不一致 | 不修复——这是有意的 tradeoff。OpenSpec 认为暴露问题由人类决策比强制阻断更实用 |

**核心教训：** OpenSpec 的验证哲学是"暴露而非阻断"——verify 的价值在于让问题可见，而非阻止用户行动。这个取向的代价是用户可以忽略所有警告。OpenSpec 接受这个 tradeoff，因为"仪式感要与风险等级匹配"——不同变更的风险等级不同，一刀切的阻断反而适得其反。

### 1.3 ECC：Mechanical Gate + 6-Phase Verification + 5-Axis Self-Evaluation

ECC 的 Review 和 Verify 由多个组件协同承担：`verification-loop` skill、`delivery-gate` Stop hook、`agent-self-evaluation` skill、`orch-pipeline` 的 Phase 5 Review（`skills/verification-loop/SKILL.md`、`skills/delivery-gate/SKILL.md`、`skills/agent-self-evaluation/SKILL.md`、`skills/orch-pipeline/SKILL.md`）。

**Review 机制——语言专用 + Gated Pipeline：**

- **orch-pipeline Phase 5** 委托给 `code-reviewer` agent 和 `/code-review` command
- **语言专用 reviewer**：orch-pipeline 的 agent map 列出 "language reviewer (`python-reviewer`, `typescript-reviewer`, …)"——匹配项目技术栈
- **Security trigger**：自动拉入 `security-reviewer`——覆盖 auth、user-input、DB queries、file paths、external API、crypto、secrets
- **Review findings**：CRITICAL/HIGH 必须在 GATE 2（Commit 前）解决
- **PostToolUse hooks**：自动检查代码质量（prettier、tsc、console.log 检测）——每次工具调用后即时反馈
- **agent-self-evaluation**：5 轴自评（Accuracy / Completeness / Clarity / Actionability / Conciseness），每个低于 5 分的必须引用具体证据——"展示差距在哪里，不要只是说出它的名字。"。**不是** pass/fail gate，而是反思步骤。"Everything is a 5" anti-pattern 被明确禁止。

**Verify 机制——6 Phase + Mechanical Gate：**

- **verification-loop 的 6 phase**：
  1. Build Verification——构建是否通过
  2. Type Check——类型检查（tsc / pyright）
  3. Lint Check——代码规范
  4. Test Suite——测试套件（80%+ coverage 目标）
  5. Security Scan——密钥检测、console.log 检测
  6. Diff Review——逐文件审查无意变更、缺失错误处理、edge case
- **输出 VERIFICATION REPORT**：Build/Types/Lint/Tests/Security/Diff 逐项 PASS/FAIL，Overall READY/NOT READY
- **Continuous mode**：长 session 中每 15 分钟或重大变更后运行
- **delivery-gate（Stop hook）**：三个机械化检查：
  - **Rationalization patterns**：regex 匹配 transcript 尾部文本（如 "skip tests for now"）——**Warning only，不阻断**
  - **Stale learning libraries**：检查 5 个学习库文件的 mtime——复杂任务（>=3 edits）未 touch 学习库则 **Block（exit 2）**
  - **Disk space**：< 50GB Warning，< 15GB 则 **Block（exit 2）**
- **关键设计**：delivery-gate 是"机械化 gate 检查机器可验证的事实"——不依赖 AI 推理，用正则/mtime/disk 等确定性检查。与 `self-audit`（reasoning quality gate）形成 defense in depth——"delivery-gate 检查机器可验证的事实；self-audit 检查输出质量"

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| Skills 概率性触发（50-80%）导致验证环节的观察数据不可靠 | 改用 PreToolUse/PostToolUse hooks（100% 可靠）捕获代码质量信号——delivery-gate 作为 Stop hook 100% 触发 |
| Agent 自评倾向于"一切正常"——"Everything is a 5" anti-pattern | 引入 agent-self-evaluation 的 5 轴评分，低分项必须引用具体证据，"展示差距在哪里，不要只是说出它的名字" |
| delivery-gate 只能检查表面模式（regex 匹配 rationalization 文本、mtime 检查文件更新时间）——不检查内容质量 | 明确承认这一局限："这个 hook 强制的是 touch 学习库的习惯，而非记录内容的质量。这是有意为之：机械化 gate 检查机器可验证的事实。"——与 self-audit 配对使用形成 defense in depth |
| Rationalization regex 会 false positive | Rationalization patterns 设为 **Warning only**，永不阻断——"regex 启发式可能产生 false positive" |
| 无结构化的 spec 模型——AC 是一次性工作产物，不持续演进 | 未修复——ECC 的设计取向是"提供素材不定义流程"，spec 持续演进是 OpenSpec 的关注点 |

**核心教训：** ECC 的核心洞察是"机械化检查的可靠性远超 AI 推理"——hook 100% 触发，skill 只有 50-80%。但机械化检查的覆盖面太窄（只查表面模式）。ECC 的解法是 defense in depth——delivery-gate 用机械化检查确保底线（学习库更新、磁盘空间），verification-loop 用 6 phase 做全面检查，agent-self-evaluation 用 5 轴评分做反思，self-audit 用推理检查内容质量。

### 1.4 mattpocock-skills：Two-Axis Parallel Sub-agents + TDD 验证

mattpocock 的 Review 和 Verify 融合在 `/implement` 流程中，由 `/code-review` 和 `/tdd` 两个 skill 承担（`skills/engineering/code-review/SKILL.md`、`skills/engineering/tdd/SKILL.md`）。`/diagnosing-bugs` skill 提供了反馈循环的质量标准。

**Review 机制——双轴分离：**

- **Two-axis review**：Standards（编码标准 + Fowler smell baseline）和 Spec（需求忠实度），两个轴作为 **parallel sub-agents** 独立运行——"两个轴作为 parallel sub-agents 运行，这样它们不会污染彼此的 context。"
- **报告不合并、不重排**："**不要**合并或重排 findings——两个轴是有意分开的"——两条报告并列呈现，用户自行综合。
- **为什么分离**："一个变更可以通过一个轴但失败于另一个轴"——代码可以符合标准但实现错误（Standards pass, Spec fail），或实现了需求但违反约定（Spec pass, Standards fail）。"分开报告可以防止一个轴遵蔽另一个轴。"
- **Standards 轴**：
  - 查找 commit diff 中违反 repo 文档化编码标准的地方
  - **12 种 Fowler smell baseline**（always-on）：Mysterious Name、Duplicated Code、Feature Envy、Data Clumps、Primitive Obsession、Repeated Switches、Shotgun Surgery、Divergent Change、Speculative Generality、Message Chains、Middle Man、Refused Bequest
  - 两条绑定规则：repo 文档标准 overrides baseline；smell 是 judgement call 非硬违规
  - "跳过已有工具检查的内容"——已有工具检查的不重复
- **Spec 轴**：
  - 查找 spec 中缺失/部分实现的需求
  - scope creep（diff 中有 spec 未要求的行为）
  - 实现错误的需求
  - **Spec 来源追溯**：commit message 中的 issue 引用 → 用户传入路径 → `docs/specs/.scratch` → 问用户
- **Under 400 words**：每个 sub-agent 报告限制在 400 字以内——保持精炼

**Verify 机制——TDD Red-Green + 反馈循环标准：**

- **TDD red-green 是验证核心**：先写失败测试（RED），再最小实现使其通过（GREEN）。"先 RED 后 GREEN。先写失败的测试，然后只写刚好让它通过的代码。"
- **三个 anti-patterns 防止虚假验证**：
  - **implementation-coupled**：测试与实现耦合，重构就坏——"测试在重构时断裂但行为没有变化"
  - **tautological**：永远通过但零信心——"断言用与代码相同的方式重新计算期望值……因此它通过构造就能通过，永远不会与代码不一致"
  - **horizontal slicing**：先写所有测试再写所有实现——"批量测试验证的是想象中的行为"
- **`/diagnosing-bugs` 的反馈循环标准**：
  - **tight**：快速、确定性、agent 可运行——"一个 30 秒的 flaky 循环几乎不比没有循环好；一个 2 秒的确定性循环才是 tight 的"
  - **red-capable**：必须能在 bug 存在时失败——"没有 red-capable 的命令，就不能进入 Phase 2"
  - Phase 5 的 correct seam 检查——如果没有正确的测试缝，"这本身就是发现"
- **无独立 verify skill**：验证嵌入 implement 和 code-review 流程中，不是独立环节

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| 持续存在 | Standards 和 Spec 混在一个 review 中——符合标准的错误实现可能被放过 | 引入双轴 parallel sub-agents——Standards 和 Spec 独立运行，报告不合并不重排，防止一个轴遮蔽另一个 |
| 持续存在 | repo 没有文档化编码标准时，review 没有最低保障 | 引入 12 种 Fowler smell baseline（always-on）——即使 repo 没有文档化标准也有最低检查基线 |
| 持续存在 | smell 检查可能与 repo 已有约定冲突 | "The repo overrides"——文档化的 repo 标准始终优先于 baseline；smell 是 judgement call 而非硬违规 |
| 持续存在 | 测试可能永远通过但零信心（tautological） | 明确列出三种 anti-patterns 并给出定义——expected values 必须来自独立来源（known-good literal、worked example、spec） |
| 持续存在 | 反馈循环不够 tight——30 秒的 flaky loop 几乎等于没有 | "A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight"——要求 fast + deterministic + agent-runnable |
| 持续存在 | 无独立 verify skill——验证嵌入 implement 流程中 | 不修复——这反映了 mattpocock "不拥有流程"的设计取向。验证是 implement 的一部分，不是独立环节 |

**核心教训：** mattpocock 的核心贡献是"双轴分离"——防止"好代码但错误实现"的遮蔽。这个设计洞察值得深思：一个维度的通过不应该掩盖另一个维度的失败。Fowler smell baseline 提供了 always-on 的最低保障——即使 repo 没有文档化标准也不会"裸奔"。但 mattpocock 不设独立 verify 环节，验证完全依赖 TDD red-green 循环——如果用户跳过 TDD，就没有保障。

### 1.5 gstack：Cross-Model Review + Browser QA + Plan Completion Audit

gstack 的 Review 和 Verify 是最重的，由 `/review`、`/codex`、`/cso`、`/qa`、`/benchmark`、`/investigate` 等多个 skill 承担（`review/SKILL.md`、`qa/SKILL.md`、`codex/SKILL.md`、`cso/SKILL.md`）。

**Review 机制——跨模型 + 多角色 + Scope Drift Detection：**

- **`/review`（Pre-landing PR review）**：分析 diff 中的结构性问题——SQL 安全、LLM 信任边界、条件副作用等。
  - **Scope Drift Detection（Step 1.5）**：在审查代码质量前，先检查"是否做了要求的事——不多不少"。检测 SCOPE CREEP（无关变更）和 MISSING REQUIREMENTS（未实现需求）。读 TODOS.md、PR description、commit messages 获取 stated intent，与 diff 对比。
  - **Plan Completion Audit**：搜索 plan 文件 → 提取 actionable items → 逐项对照 diff 分类（DONE / PARTIAL / NOT DONE / CHANGED / UNVERIFIABLE）。对 PARTIAL 和 NOT DONE 调查原因（scope cut / context exhaustion / misunderstood requirement / blocked / forgotten）。
  - **Verification Mode**：DIFF-VERIFIABLE / CROSS-REPO / EXTERNAL-STATE / CONTENT-SHAPE——不同类型的 plan item 用不同方式验证。
  - **Slop scan（Step 3.5）**：检测 AI 代码质量问题（empty catches、redundant `return await`、overcomplicated abstractions）——advisory，不阻断。
  - **Checklist-based review**：读取 `.claude/skills/review/checklist.md` 按清单审查。如果文件不可读则 STOP——"没有 checklist 不能继续。"
  - **Learnings search**：搜索过往 session 的 learnings，在审查中应用——"应用的过往学习：[key]（置信度 N/10，来自 [date]）"
  - **Specialist dispatch**：按 diff scope 自动派遣 specialist reviewers（performance、data-migration、api-contract、design）
- **`/codex`（跨模型审查）**：用不同的 AI 模型独立审查——"跨模型的一致意见是建议而非决定。由用户决定。"
- **`/cso`（Security Officer）**：安全审查。
- **审查日志**：写入 `~/.gstack/projects/$SLUG/$BRANCH-reviews.jsonl`。

**Verify 机制——浏览器 QA + 健康评分：**

- **`/qa`——持久浏览器守护进程执行端到端验证**：
  - 打开真实浏览器 → 点击通过用户流程 → 发现 bug → 修复（atomic commits）→ 生成回归测试 → 重新验证
  - **Diff-aware mode**：在 feature branch 上自动分析 diff → 识别受影响的页面/路由 → 针对性测试
  - **Health Score Rubric**：8 个维度加权评分——Console(15%)、Links(10%)、Visual(10%)、Functional(20%)、UX(15%)、Performance(10%)、Content(5%)、Accessibility(15%)
  - **Three tiers**：Quick（critical+high）、Standard（+medium）、Exhaustive（+cosmetic）
  - **Regression mode**：与 baseline 对比——哪些 issue 修了？哪些是新的？分数 delta？
  - **Atomic commits**：每个 bug fix 单独 commit + 回归测试——"一个 fix 一个 commit。永远不要打包多个 fix。"
  - **Self-regulation**：WTF-likelihood 启发式——每次 revert +15%、touching >3 files +5%、50 fixes 硬上限。WTF > 20% 则 STOP。
  - **Phase 8e.5 Regression Test**：trace bug 的 codepath → 写测试 → 运行 → 评估（Passes → commit / Fails → fix once / >2min → skip and defer）
  - **Test Framework Bootstrap**：如果项目没有测试框架，自动检测 runtime → 研究最佳实践 → 安装配置 → 生成 3-5 个真实测试 → 验证 → 创建 CI pipeline → 写 TESTING.md
- **`/benchmark`**：性能验证
- **`/investigate`**：调试验证

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| Review 只看代码质量不看 scope——AI 可能"多做了一点"或"少做了一点" | 引入 Scope Drift Detection（Step 1.5）——在审查代码质量前先检查"是否做了要求的事——不多不少" |
| Plan item 完成度缺乏系统化验证——reviewer 只看 diff 不看 plan | 引入 Plan Completion Audit——提取 plan 中的 actionable items，逐项对照 diff 分类 DONE/PARTIAL/NOT DONE/CHANGED/UNVERIFIABLE |
| 不同类型的 plan item 用同一种方式验证——跨 repo 或外部状态的 item 在 diff 中不可见 | 引入 Verification Mode 分类——DIFF-VERIFIABLE / CROSS-REPO / EXTERNAL-STATE / CONTENT-SHAPE，不同类型用不同方式验证 |
| 单模型审查有系统性盲区——Claude 可能系统性地忽略某些类型问题 | 引入跨模型审查（/codex）——用不同 AI 模型独立审查 |
| 代码质量审查太宽泛——没有最低保障 | 引入 checklist-based review——读取 `checklist.md` 按清单审查，文件不可读则 STOP |
| Slop scan 某些"sloppy"模式是正确的工程选择——false positive 风险 | Slop findings 设为 advisory，永不阻断——"Slop findings 是建议性的，永远不阻断" |
| QA fix loop 可能失控——agent 越改越烂 | 引入 WTF-likelihood 启发式——每次 revert +15%、touching >3 files +5%、50 fixes 硬上限。WTF > 20% 则 STOP |
| 回归测试可能永远通过但零信心 | Phase 8e.5 要求 trace bug 的 codepath 后再写测试——"设置触发 bug 的前置条件……断言正确的行为（不是'它能渲染'或'它不抛异常'）" |
| 项目可能没有测试框架——QA 发现的 bug 无法写回归测试 | Test Framework Bootstrap——自动检测 runtime、研究最佳实践、安装配置、生成真实测试、创建 CI pipeline |

**核心教训：** gstack 的核心贡献是"让 agent 有眼睛"——浏览器 QA 是其他项目没有的维度。Plan Completion Audit 和 Scope Drift Detection 是对"AI 倾向于多做或少做"问题的系统化回应。WTF-likelihood 启发式是对"fix loop 失控"问题的实用解法——不是阻止 agent 修 bug，而是在失控前暂停让人类介入。

---

## 2. 关键差异

### 2.1 Review 层次设计对比

| 项目 | Review 层次 | Review 时机 | Review 方式 | 强制程度 |
|------|-----------|-----------|-----------|---------|
| **Superpowers** | Per-task + Whole-branch | 每个 task 后 + 全部完成后 | Subagent（独立 context，read-only） | Per-task review 是 **gate**（Critical/Important 必须修复） |
| **OpenSpec** | Propose 后 + Apply 后 | 计划审查 + 实现审查 | 人工读 Markdown | **非阻断**——"将决定权留给你" |
| **ECC** | orch-* Phase 5 | Plan 后 + Commit 前 | 语言专用 reviewer + security-reviewer | GATE 2 在 Commit 前——CRITICAL/HIGH 必须解决 |
| **mattpocock** | 一次性（implement 后） | 实现完成后 | 双轴 parallel sub-agents（Standards + Spec） | 无 per-task gate——是 implement 后的一次性审查 |
| **gstack** | Branch-level | /ship 前 | 跨模型（Claude + Codex）+ 多角色（Eng/Security）+ Scope Drift + Plan Completion Audit | Eng Review required，其他 informational |

**关键观察：** Review 的层次设计形成了从"per-task gate"到"branch-level informational"的光谱。Superpowers 是最细粒度的——每个 task 都有独立 review gate。gstack 是最广视角的——跨模型审查消除单模型偏差，Plan Completion Audit 逐项对照 plan。mattpocock 的双轴分离是独特的——防止一个轴遮蔽另一个轴。OpenSpec 最轻量——人工读 Markdown，不结构化。

### 2.2 Verify 维度对比

| 项目 | Verify 维度 | 验证方式 | 阻断机制 |
|------|-----------|---------|---------|
| **Superpowers** | Fresh evidence（运行命令→读输出→确认 claim） | Iron Law Gate Function | **Iron Law**——NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE |
| **OpenSpec** | Completeness + Correctness + Coherence | 启发式（关键词搜索、文件路径分析） | **不阻断**——CRITICAL/WARNING/SUGGESTION 分级，暴露问题由人类决策 |
| **ECC** | Build + Type + Lint + Test + Security + Diff | 6 phase 确定性命令 + delivery-gate 机械化检查 | delivery-gate **Block（exit 2）**——学习库 stale / 磁盘不足 |
| **mattpocock** | TDD red-green + 反馈循环质量 | 测试通过/失败 + "tight + red-capable" 标准 | 无独立阻断——嵌入 implement 流程 |
| **gstack** | 浏览器端到端 + 健康评分 + 回归对比 | 真实浏览器点击 + 截图证据 + health score | WTF-likelihood > 20% 则 STOP |

**关键观察：** Verify 的维度从"运行测试命令"（Superpowers）到"打开浏览器看产品"（gstack）形成了光谱。Superpowers 强调 evidence before claims——不信任任何未在当前 message 中运行的验证。ECC 的 delivery-gate 是唯一的机械化阻断——用 regex/mtime/disk 等确定性检查，不依赖 AI 推理。gstack 的浏览器 QA 是最直观的——agent 有"眼睛"，看产品而非看测试。OpenSpec 最宽松——基于启发式推理，不要求确定性证明。

### 2.3 强制程度光谱

| 级别 | 代表项目 | 机制 | 阻断方式 |
|------|---------|------|---------|
| **Iron Law** | Superpowers | NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE | Skill 约束（每次声明前必须运行验证命令） |
| **Mechanical Gate** | ECC | delivery-gate Stop hook（regex + mtime + disk） | Hook 阻断（exit 2，100% 触发） |
| **Pipeline Gate** | ECC | orch-* GATE 2（Commit 前） | Pipeline 阻断（CRITICAL/HIGH 必须解决） |
| **Per-task Gate** | Superpowers | Reviewer findings Critical/Important 必须修复 | Subagent gate（不修复不进入下一个 task） |
| **Branch-level Gate** | gstack | Eng Review required | /ship 前 required review |
| **Informational** | OpenSpec, gstack（非 Eng） | verify 不阻断 archive | 无阻断——暴露问题由人类决策 |
| **Embedded** | mattpocock | TDD red-green 嵌入 implement | 无独立阻断——依赖 TDD 循环 |

**关键观察：** ECC 的 delivery-gate 是唯一用 **机械化检查**（不依赖 AI 推理）的阻断机制——hook 100% 触发，而 skill 的触发率约 50-80%。Superpowers 的 Iron Law 依赖 skill 约束——最强但依赖 agent 遵守。gstack 的 required review 是 branch-level 的——比 per-task 宽松但比 informational 有约束力。OpenSpec 和 mattpocock 最轻——不阻断，依赖用户判断。

### 2.4 代码质量检查方式

| 项目 | 代码质量检查 | 检查内容 | 工具化程度 |
|------|-----------|---------|-----------|
| **Superpowers** | Reviewer subagent | spec compliance + code quality（去重、膨胀、命名、无关变更） | Subagent（AI 推理） |
| **OpenSpec** | verify Coherence 维度 | design 决策体现 + 代码模式一致性 | 启发式（关键词搜索） |
| **ECC** | PostToolUse hooks + language reviewers + self-evaluation | prettier、tsc、console.log + 语言专用审查 + 5 轴自评 | Hook（自动化） + Agent（AI 推理） + 自评（反思） |
| **mattpocock** | Standards 轴 | 12 种 Fowler smell baseline + repo 文档标准 | Sub-agent（AI 推理 + baseline 清单） |
| **gstack** | Slop scan + review checklist + specialist dispatch | AI 代码质量模式 + 结构性审查清单 + 领域专家 | 脚本（slop:diff） + AI 推理 + 专门 agent |

**关键观察：** 代码质量检查的方式从"纯 AI 推理"（Superpowers reviewer）到"纯脚本"（gstack slop scan）形成光谱。mattpocock 的 Fowler smell baseline 是独特的——提供 always-on 的最低检查基线，即使 repo 没有文档化标准也有保障。ECC 的 PostToolUse hooks 是最即时的——每次工具调用后立即检查。gstack 的 slop scan 专注于 AI 特有的代码质量问题——"AI code quality, not AI code hiding"。

---

## 3. 历史踩坑汇总与经验教训

### 3.1 踩坑类型分类

将五个项目在 Review & Verify 节点的历史踩坑按类型归纳，可以发现一些反复出现的模式：

**类型一：审查者独立性被侵蚀**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers v6.0.0 之前 | controller 在 dispatch reviewer 时指导 reviewer 忽略某些发现或降级 severity——"真实运行中发现 controller 指导 reviewer 跳过某个发现或称之为'最多 Minor'，导致缺陷被发布" | controller 和 reviewer 之间没有隔离——controller 的措辞可以影响 reviewer 的判断 | v6.0.0 明确禁止 pre-judging findings——"如果你正在写的 prompt 中包含 'do not flag'、'don't treat X as a defect'、'at most Minor' 或 'the plan chose'——停下来：你正在预判" |
| Superpowers v6.0.0 之前 | reviewer 运行 `git checkout` 导致后续 commit 被孤立 | reviewer 可以触碰 working tree 和 branch state | v6.0.0 reviewer 改为 read-only——"Review 不再触碰 working tree 或 branch" |
| Superpowers v6.0.0 之前 | reviewer 信任 implementer 的报告——"I left this unabstracted on purpose" 让 reviewer 放过真实 finding | reviewer 没有被告知 implementer 的报告是"未经证实的声明" | task-reviewer-prompt.md 明确写道："将 implementer 的报告视为未经证实的声明……陈述的理由永远不能降低 finding 的严重程度" |
| mattpocock | Standards 和 Spec 混在一个 review 中——符合标准的错误实现可能被放过 | 单一审查维度会让一个维度的通过掩盖另一个维度的失败 | 引入双轴 parallel sub-agents——报告不合并不重排 |

**类型二：验证被跳过或虚假通过**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers | agent 声称"should work now"但实际上没有运行验证 | 没有 fresh evidence 约束——agent 可以引用之前的验证结果或凭"信心"声称完成 | Iron Law：NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE——必须在当前 message 中运行验证命令 |
| ECC | Skills 概率性触发（50-80%）——验证环节可能被跳过 | skill 约束依赖 agent 遵守，不是 100% 可靠 | delivery-gate 作为 Stop hook——100% 触发，机械化检查不依赖 AI 推理 |
| OpenSpec | 用户用 `--no-validate` 完全跳过验证 | 验证阻断导致用户要么全接受要么全跳过 | Verify 不阻断——暴露问题由人类决策，"仪式感要与风险等级匹配" |
| mattpocock | 测试 tautological——永远通过但零信心 | expected values 用与代码相同的方式计算 | 明确列出 anti-patterns——expected values 必须来自独立来源 |
| Superpowers | 回归测试只运行一次就声称通过——没有验证测试在 bug 存在时确实失败 | 没有 red-green 回归验证要求 | Write → Run(pass) → Revert fix → Run(MUST FAIL) → Restore → Run(pass) |

**类型三：审查成本失控**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers v5.0.6 之前 | brainstorming 和 writing-plans 的 subagent review loop 增加 ~25 分钟执行时间 | 每 step dispatch subagent 做审查——成本高 | v5.0.6 用 inline self-review 替代——~25min → ~30s，质量相当 |
| Superpowers v6.0.0 之前 | 每 task 跑两个独立 reviewer——成本翻倍 | spec 和 quality 分为两个 reviewer | v6.0.0 合并为单 reviewer 两个 verdict |
| Superpowers v6.0.0 之前 | controller 不指定 model——26 个 reviewer 全用最贵 tier | unnamed model 静默继承 session 最贵 model | v6.0.0 template 要求显式指定 model |
| Superpowers v6.0.0 之前 | diff 通过粘贴传递——controller context 膨胀 | 粘贴的 diff 永久驻留在最贵的 context 中 | v6.0.0 用文件传递 diff——`review-package` 脚本写文件 |
| gstack | QA fix loop 越改越烂——agent 不停 revert 和重试 | 没有失控检测机制 | WTF-likelihood 启发式——>20% 则 STOP |

**类型四：机械化检查的局限**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| ECC | delivery-gate 只能检查表面模式（regex、mtime）——不检查内容质量 | 机械化检查只能验证 machine-verifiable facts | 与 self-audit 配对——defense in depth：delivery-gate 查事实，self-audit 查推理质量 |
| ECC | Rationalization regex 会 false positive | regex 启发式不精确 | Rationalization patterns 设为 Warning only，永不阻断 |
| OpenSpec | Verify 基于启发式——精度有限 | 关键词搜索和文件路径分析不等于确定性证明 | "不确定时，优先用 SUGGESTION 而非 WARNING，优先用 WARNING 而非 CRITICAL"——不确定时降级 |

**类型五：Scope drift 检测缺失**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| gstack | Review 只看代码质量不看 scope——AI 可能"多做了一点" | 审查流程不包含 scope 检查 | 引入 Scope Drift Detection（Step 1.5）和 Plan Completion Audit |
| mattpocock | 单一审查维度无法区分"代码质量"和"需求忠实度" | Standards 和 Spec 混在一起 | 双轴分离——Spec 轴专门检查 scope creep |
| OpenSpec | Scope drift 只在 propose 阶段检测 | 只在代码编写前审查 proposal | 不修复——propose 阶段是成本最低的发现时机 |

### 3.2 经验教训总结

从五个项目的踩坑历史中，可以提炼出以下经验教训：

**教训一：审查者的独立性不能靠默认行为保证**

Superpowers v6.0.0 的教训是最直接的证据——即使 dispatch 了独立 subagent，controller 仍可能通过措辞影响 reviewer。controller 说"don't flag X"或"at most Minor"，reviewer 就会遵从。更严重的是，reviewer 甚至会运行 `git checkout` 碰触 working tree，导致后续 commit 被孤立。显式禁止（"controller 不能告诉 reviewer 忽略什么"）和 read-only 约束是必要的但来之不易——Superpowers 花了多个版本才意识到这些问题。mattpocock 的双轴分离和 gstack 的跨模型是更结构化的独立性保障。

**教训二：虚假完成声明是最常见的失败模式**

Superpowers 的 24 failure memories 和 Iron Law 是最直接的回应——agent 经常声称"should work now"但实际上没有运行验证。ECC 的 delivery-gate 用 regex 匹配 rationalization 文本（如 "skip tests for now"）捕获表面模式——但只能捕获表面模式。mattpocock 的 tautological anti-pattern 是另一种虚假验证——测试永远通过但零信心。关键洞察是：**运行验证命令**比**声称验证通过**重要得多——Superpowers 的 Gate Function（IDENTIFY → RUN → READ → VERIFY → CLAIM）将这个要求结构化。

**教训三：机械化检查的可靠性与覆盖面成反比**

ECC 的 delivery-gate 100% 触发（hook 机制），但只能检查表面模式（regex、mtime、disk）。Superpowers 的 Iron Law 覆盖面最广（任何完成声明都需要 fresh evidence），但依赖 agent 遵守（50-80% 触发率）。两者结合可能是最优——delivery-gate 确保底线，Iron Law 提升上限。但 ECC 自己也承认："这个 hook 强制的是 touch 学习库的习惯，而非记录内容的质量。"——机械化检查不能替代内容质量审查。

**教训四：审查成本是真实问题**

Superpowers 的版本演进清晰地展示了审查成本的下降曲线：两个 reviewer → 一个 reviewer（v6.0.0）、subagent review loop → inline self-review（v5.0.6，~25min → ~30s）、粘贴 diff → 文件传递（v6.0.0）、未指定 model → 显式指定（v6.0.0）。每一步优化都是对真实成本的回应——"一次运行把所有 26 个 reviewer 都放在最贵 tier" 这种事故在生产中确实发生过。

**教训五：Scope drift 是 AI 辅助开发的特有问题**

AI 倾向于"多做一点"——这是 scope creep 的来源。gstack 的 Scope Drift Detection 和 Plan Completion Audit 是最系统化的检测方法。mattpocock 的 Spec 轴是双轴分离的自然结果——Spec 轴天然关注"是否实现了需求且只实现了需求"。OpenSpec 在 propose 阶段就检测——成本最低的发现时机。关键洞察是：**scope drift 检测应该在审查代码质量之前进行**——先确认"做了正确的事"，再看"把事做对了没有"。

---

## 4. 实践方向讨论

### 4.1 Review 层次：Per-task Gate vs Branch-level vs 一次性

**Superpowers 的立场**：per-task review gate——每个 task 完成后 dispatch reviewer，Critical/Important 必须修复后才进入下一个 task。全部完成后做 whole-branch final review。v6.0.0 合并为单 reviewer 两个 verdict（v6.0.0 之前是两个独立 reviewer），成本减半但质量不降。

**gstack 的立场**：branch-level review——/ship 前做一次完整审查，跨模型消除偏差。Plan Completion Audit 逐项对照 plan 检查完成度。Scope Drift Detection 在审查代码质量前先检查 scope。

**mattpocock 的立场**：一次性双轴审查——implement 后做一次 Standards + Spec 双轴审查，不 per-task。

**OpenSpec 的立场**：两个时机——propose 后读计划，apply 后 verify 实现。人工读 Markdown，不结构化。

**tradeoff 分析：**

- **Per-task gate 的优势**：catch issues before they compound——问题在最早被发现，修复成本最低
- **Per-task gate 的代价**：每个 task 都 dispatch subagent——成本高、时间长（尽管 v6.0.0 已优化为单 reviewer）。Superpowers v5.0.6 的教训表明，subagent review loop 可能在某些场景下（如 brainstorming、writing-plans）不值得——~25min 开销但质量无差异
- **Branch-level 的优势**：看到全局——跨 task 的结构性问题（重复逻辑、命名不一致）只在整体视角下可见
- **Branch-level 的代价**：问题可能在多个 task 后才被发现——修复时可能涉及多个 task 的代码
- **一次性的优势**：简单、低成本
- **一次性的代价**：既没有 per-task 的早期发现，也没有 branch-level 的全局视角

**可能的好的实践方向**：Superpowers 的 per-task + final 两层设计可能是最完整的——per-task gate 保证早期发现，final review 保证全局一致性。但 per-task gate 的成本需要权衡——v6.0.0 从两个 reviewer 减到一个、v5.0.6 用 inline self-review 替代 subagent review loop 都表明成本是真实问题。OpenSpec 的"两个时机"（propose 后 + apply 后）是另一种分层——在代码编写前审查计划（成本最低的发现时机），在实现后验证一致性。两种分层方式可以互补。

### 4.2 Verify 强制程度：Iron Law vs Mechanical Gate vs 非阻断

**Superpowers 的立场**：Iron Law——NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE。Rationalization 表列出所有逃避验证的借口。24 failure memories 来自真实案例。

**ECC 的立场**：Mechanical Gate——delivery-gate 用 regex/mtime/disk 等确定性检查，hook 100% 触发。"机械化 gate 检查机器可验证的事实，而非 AI 推理"。

**OpenSpec 的立场**：非阻断——verify 暴露问题但不阻断 archive。"将决定权留给你"。

**tradeoff 分析：**

- **Iron Law 的优势**：确保每次完成声明都有 fresh evidence——消除虚假完成声明
- **Iron Law 的代价**：依赖 agent 遵守 skill 约束——skill 的触发率约 50-80%（vs hook 100%）；简单变更也要运行完整验证（可能过重）
- **Mechanical Gate 的优势**：100% 触发（hook 机制）——不依赖 agent 遵守；确定性检查不可绕过
- **Mechanical Gate 的代价**：只能检查表面模式（regex 匹配 rationalization 文本、mtime 检查文件更新时间）——不检查内容质量；"强制的是 touch 学习库的习惯，而非记录内容的质量"
- **非阻断的优势**：最大灵活性——用户根据情况决定
- **非阻断的代价**：用户可以忽略所有警告直接 archive——spec 与代码可能不一致

**可能的好的实践方向**：ECC 的 delivery-gate 和 Superpowers 的 Iron Law 是互补的——delivery-gate 用机械化检查捕获"表面模式"（如 rationalization 文本），Iron Law 用 skill 约束确保"每次声明都有 evidence"。但两者的覆盖面不同：delivery-gate 检查 session hygiene（学习库、磁盘），Iron Law 检查代码验证（测试运行、构建通过）。gstack 的浏览器 QA 提供了第三种维度——看产品而非看测试。

关键问题是：**机械化检查的覆盖面太窄**（只查表面模式），**AI 推理检查的触发率不够**（50-80%）。两者结合可能是最优——delivery-gate 式的 hook 确保底线，Iron Law 式的 skill 约束提升上限。

### 4.3 Review 方式：Subagent vs 人工 vs 跨模型

**Superpowers 的立场**：dispatch read-only subagent——认知隔离，reviewer 不碰 working tree。controller 不能告诉 reviewer 忽略什么。Reviewer 不信任 implementer 的报告——"将 implementer 的报告视为未经证实的声明。"

**mattpocock 的立场**：双轴 parallel sub-agents——Standards 和 Spec 独立运行，报告不合并。

**gstack 的立场**：跨模型审查——Claude 和 Codex 独立审查。Checklist-based——读清单按项审查。

**OpenSpec 的立场**：人工读 Markdown——不 dispatch agent，用户自己读。

**tradeoff 分析：**

- **Subagent 隔离的优势**：reviewer 不受 controller context 影响——"永远不是你的 session 历史"；read-only 确保认知隔离
- **Subagent 隔离的代价**：dispatch 成本；v6.0.0 教训"controller 指导 reviewer 跳过发现"——需要显式禁止
- **双轴分离的优势**：防止一个轴遮蔽另一个——代码可以符合标准但实现错误
- **双轴分离的代价**：成本翻倍（两个 sub-agent）；用户需自行综合两条报告
- **跨模型的优势**：消除模型偏差——Claude 和 Codex 可能系统性地忽略不同类型问题
- **跨模型的代价**：需要两个 AI 服务——成本翻倍；依赖外部服务可用性
- **人工的优势**：零成本；人类的判断力最强
- **人工的代价**：依赖用户自律——可能跳过；不具备可扩展性

**可能的好的实践方向**：mattpocock 的双轴分离和 gstack 的跨模型是两种正交的"分离"策略——双轴分离防止"好代码但错误实现"的遮蔽，跨模型防止"单模型盲区"的遮蔽。两者可以结合——每个轴用不同模型审查。Superpowers 的"controller 不能指导 reviewer 忽略什么"和"reviewer 不信任 implementer 的报告"是重要的设计约束——防止认知串通。OpenSpec 的"人工读 Markdown"是最轻量的，但依赖用户自律——适合轻量场景。

### 4.4 回归测试验证

**Superpowers**：Write → Run(pass) → Revert fix → Run(MUST FAIL) → Restore → Run(pass)——不只是写回归测试，必须验证测试在 bug 存在时确实失败。

**gstack**：Phase 8e.5 Regression Test——trace bug 的 codepath → 写测试 → 运行 → 评估（Passes → commit / Fails → fix once / >2min → skip and defer）。

**mattpocock**：TDD 的 red-green 本身就是回归验证——先写失败测试（RED），再修复使其通过（GREEN）。diagnosing-bugs 的 Phase 1-6 包含完整验证流程。Phase 5 的 correct seam 检查——如果没有正确的测试缝，"这本身就是发现"。

**tradeoff 分析：**

- **Superpowers 的 red-green 回归验证**最严格——必须证明测试在 bug 存在时失败
- **gstack 的 regression test** 最实用——trace codepath 后写测试，有时间限制（>2min skip）
- **mattpocock 的 TDD red-green** 最简洁——回归验证嵌入 TDD 循环，不是独立步骤

**可能的好的实践方向**：Superpowers 的"Revert fix → Run(MUST FAIL)"是验证回归测试有效性的黄金标准——但可能过重。gstack 的"trace codepath then test"是更实用的方法——先理解 bug 的数据流再写测试。mattpocock 的"red-capable"标准是最低要求——回归测试必须能在 bug 存在时失败，否则是 tautological。

---

## 5. 总结：Review & Verify 节点的实践参考

> **声明：** 以下总结基于五个项目的实践经验和踩坑教训，试图提炼出一些有参考价值的结论。但这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中寻找一些相对普遍的规律，供读者参考和批判。

### 5.1 总体要求

经过对五个项目的全面分析，我们认为 Review & Verify 节点需要满足以下总体要求：

**要求一：在声称完成之前必须有 fresh evidence**

这是 Superpowers Iron Law 的核心——"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"。五个项目都在以不同方式做验证，但只有 Superpowers 将"fresh evidence before claims"提升为不可违反的铁律。虚假完成声明是 AI 辅助开发中最常见的失败模式——agent 说"should work now"但实际上没有运行验证。

**要求二：审查者的独立性需要显式保障**

Superpowers v6.0.0 的教训表明，即使 dispatch 了独立 subagent，controller 仍可能通过措辞影响 reviewer。mattpocock 的双轴分离和 gstack 的跨模型是更结构化的独立性保障。审查者的独立性不能靠默认行为保证——需要显式约束。

**要求三：Scope drift 检测应该在代码质量审查之前**

gstack 的 Scope Drift Detection 和 Plan Completion Audit 是最系统化的检测方法——先确认"做了正确的事"，再看"把事做对了没有"。AI 倾向于"多做一点"是 scope creep 的来源，需要在审查流程中显式检测。

**要求四：验证的强制程度应该跟风险匹配**

OpenSpec 的 "仪式感要与风险等级匹配" 和 ECC 的两种深度（Quick vs Full）都指向同一个方向——一刀切的验证强度要么过重（简单变更走完整验证），要么过浅（复杂变更只做快速验证）。

### 5.2 应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **在声称完成前运行验证命令并读取输出** | "should work now" 不是 evidence——Iron Law 要求 fresh verification | Superpowers（Iron Law + Gate Function） |
| **审查者 read-only，不碰 working tree** | reviewer 运行 `git checkout` 曾导致 commit 被孤立——read-only 防止意外破坏 | Superpowers（v6.0.0 reviewer read-only） |
| **禁止 controller 指导 reviewer 忽略发现** | controller 会不自觉地 coaching reviewer 跳过发现——"导致缺陷被发布" | Superpowers（v6.0.0 pre-judging ban） |
| **Reviewer 不信任 implementer 的报告** | implementer 的报告是"未经证实的声明"——"陈述的理由永远不能降低 finding 的严重程度" | Superpowers（task-reviewer-prompt.md） |
| **将 Standards 和 Spec 分为两个独立审查** | 代码可以符合标准但实现错误——一个维度的通过不应掩盖另一个维度的失败 | mattpocock（双轴 parallel sub-agents） |
| **在审查代码质量前先检测 scope drift** | AI 倾向于"多做一点"——scope drift 是 AI 辅助开发的特有问题 | gstack（Scope Drift Detection + Plan Completion Audit） |
| **用机械化 hook 确保底线** | skill 的触发率只有 50-80%，hook 100% 触发——机械化检查不可绕过 | ECC（delivery-gate Stop hook） |
| **用 inline self-review 替代高成本的 subagent review** | ~25min → ~30s，质量相当——不是所有审查都需要 dispatch subagent | Superpowers（v5.0.6 inline self-review） |
| **回归测试必须验证在 bug 存在时确实失败** | 只运行一次就声称通过的回归测试可能是 tautological | Superpowers（Revert fix → Run MUST FAIL）、mattpocock（red-capable） |
| **反馈循环要 tight——快速、确定性、agent 可运行** | "一个 30 秒的 flaky 循环几乎不比没有循环好；一个 2 秒的确定性循环才是 tight 的" | mattpocock（diagnosing-bugs Phase 1） |
| **提供 always-on 的最低检查基线** | 即使 repo 没有文档化标准也不会"裸奔" | mattpocock（12 种 Fowler smell baseline） |
| **QA fix loop 设置失控检测** | agent 越改越烂时需要暂停让人类介入 | gstack（WTF-likelihood > 20% 则 STOP） |

### 5.3 不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该让 controller 指导 reviewer 忽略什么** | controller 会不自觉地 coaching reviewer——"真实运行中发现 controller 指导 reviewer 跳过某个发现或称之为'最多 Minor'，导致缺陷被发布" | Superpowers v6.0.0 之前的教训 |
| **不应该让 reviewer 碰 working tree** | reviewer 运行 `git checkout` 曾导致后续 commit 被孤立 | Superpowers v6.0.0 之前的教训 |
| **不应该信任 implementer 的自我报告** | implementer 的报告可能"不完整的、不准确的或过于乐观的"——设计理由也不能降级 finding 的 severity | Superpowers 的教训 |
| **不应该用阻断迫使所有变更走完整验证** | 阻断导致用户用 `--no-validate` 完全跳过——阻断反而降低了验证覆盖率 | OpenSpec 早期的教训 |
| **不应该让机械化检查承担内容质量审查** | "这个 hook 强制的是 touch 学习库的习惯，而非记录内容的质量"——机械化检查只能验证 machine-verifiable facts | ECC delivery-gate 的明确局限 |
| **不应该让 slop scan 阻断** | 某些"sloppy"模式是正确的工程选择——false positive 风险 | gstack 的设计（advisory only） |
| **不应该对所有变更用同一种验证深度** | 一文件 typo 修复不值得完整验证，auth/payments 变更不能只做快速验证 | OpenSpec（Right-size review）、ECC（两种深度） |
| **不应该用与代码相同的方式计算 expected values** | tautological 测试永远通过但零信心——expected values 必须来自独立来源 | mattpocock 的 anti-patterns |
| **不应该 dispatch reviewer 时不指定 model** | unnamed model 静默继承 session 最贵 model——一次运行把 26 个 reviewer 都放在最贵 tier | Superpowers v6.0.0 之前的教训 |
| **不应该用粘贴传递 diff 给 reviewer** | 粘贴的 diff 永久驻留在最贵的 context 中——controller context 膨胀严重 | Superpowers v6.0.0 之前的教训 |

### 5.4 需要关注什么

在 Review & Verify 节点的实践中，以下几个方面值得持续关注：

**关注点一：审查者独立性的保障机制**

Superpowers 用显式禁止（"controller 不能告诉 reviewer 忽略什么"）、mattpocock 用双轴分离、gstack 用跨模型——三种策略各有优劣。显式禁止依赖 agent 遵守，双轴分离成本翻倍，跨模型依赖外部服务。在实践中需要根据场景选择——简单的项目可能只需要显式禁止，复杂的项目可能需要结构化分离。

**关注点二：机械化检查与 AI 推理的边界**

ECC 的 delivery-gate 100% 触发但覆盖面窄，Superpowers 的 Iron Law 覆盖面广但触发率 50-80%。两者的边界在哪里？哪些检查适合机械化（格式、类型、磁盘），哪些适合 AI 推理（spec compliance、架构合理性）？ECC 的 defense in depth（delivery-gate + verification-loop + self-evaluation + self-audit）是一种探索，但四层检查的成本是否值得？

**关注点三：浏览器 QA 的适用范围**

gstack 的 /qa 是唯一"让 agent 看产品"的验证方式——其他项目都是看测试。浏览器 QA 提供了测试无法覆盖的维度（视觉、UX、交互），但依赖 Playwright/Bun 二进制和真实浏览器。对于非 Web 项目（CLI、后端服务、库），浏览器 QA 不适用。需要为不同类型的项目选择不同的"最直观验证"方式。

**关注点四：回归测试的有效性验证**

Superpowers 的"Revert fix → Run(MUST FAIL)"是验证回归测试有效性的黄金标准，但可能过重。gstack 的"trace codepath then test"更实用。mattpocock 的"red-capable"是最低要求。在实践中需要权衡——不是每个 bug fix 都需要 Revert fix 验证，但至少需要确认测试不是 tautological 的。

**关注点五：审查成本的持续优化**

Superpowers 的版本演进（两个 reviewer → 一个、subagent → inline、粘贴 → 文件、未指定 model → 显式指定）展示了审查成本优化的路径。在实践中需要持续监控审查成本——如果每个 task 的审查时间超过实现时间，可能需要优化。inline self-review 和文件传递 diff 是两个有效的成本优化手段。

### 5.5 怎么观察效果

Review & Verify 阶段的效果可以通过以下信号观察：

**正面信号（Review & Verify 有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Reviewer 发现了 implementer 遗漏的问题 | 审查机制在发挥作用 | 统计 reviewer findings 中 Critical/Important 的比例 |
| 完成声明附带验证命令输出 | Iron Law 在起作用——fresh evidence before claims | 检查完成声明是否引用了具体的命令输出 |
| Scope drift 在审查阶段被检测 | Scope Drift Detection 有效 | 统计 scope drift findings 的数量和类型 |
| 回归测试在 bug 存在时确实失败 | 回归测试不是 tautological | 运行 Revert fix → Run(MUST FAIL) 验证 |
| 审查后的代码不需要大幅返工 | 审查在问题 cascading 前捕获了它们 | 统计审查后修改的代码行数占比 |
| QA fix loop 的 WTF-likelihood 低 | fix loop 没有失控 | 监控 revert 次数和 touching >3 files 的比例 |

**负面信号（Review & Verify 有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| 完成声明使用 "should"/"probably"/"seems to" | Iron Law 被违反——没有 fresh evidence | 搜索完成声明中的 hedge words |
| Reviewer findings 全是 Minor | 审查可能走过场——没有发现真正的问题 | 统计 findings 的 severity 分布 |
| 审查后仍发现 Critical 问题 | 审查遗漏了重要问题 | 统计审查后仍发现的 Critical 问题数量 |
| 用户频繁用 `--no-validate` 跳过验证 | 验证过重——阻断反而降低了覆盖率 | 统计 `--no-validate` 使用频率 |
| 回归测试永远通过 | 可能是 tautological——没有验证有效性 | 运行 Revert fix → Run(MUST FAIL) |
| QA fix loop 的 revert 率高 | fix loop 失控——WTF-likelihood 可能超阈值 | 监控 revert 次数 |
| 审查时间超过实现时间 | 审查成本过高——可能需要优化 | 统计审查时间 vs 实现时间的比例 |

### 5.6 怎么改进

Review & Verify 阶段的改进可以从以下几个方向入手：

**改进方向一：建立多层审查防御**

借鉴 ECC 的 defense in depth 思路——机械化 hook 确保底线（格式、类型、磁盘）+ inline self-review 做快速自检 + subagent review 做深度审查 + 跨模型/双轴做独立性保障。不是每个变更都需要所有层——简单变更只需前两层，复杂变更需要全部。

**改进方向二：用文件传递审查输入**

Superpowers v6.0.0 的 `review-package` 和 `task-brief` 脚本将 diff 和 task text 写入文件由 reviewer 读取——避免了粘贴 diff 永久驻留在最贵 context 的问题。这个做法值得广泛采纳——任何需要向 subagent 传递大量文本的场景都应该用文件而非粘贴。

**改进方向三：建立 scope drift 检测清单**

借鉴 gstack 的 Scope Drift Detection 和 mattpocock 的 Spec 轴——在审查代码质量前先检查"是否做了要求的事"。可以建立一个简单的 scope drift 检测清单：diff 中的每个文件是否对应 plan 中的某个 task？plan 中的每个 task 是否在 diff 中有对应变更？有没有"while I was in there"式的无关变更？

**改进方向四：回归测试有效性验证**

不是每个 bug fix 都需要 Superpowers 的完整 Revert fix → Run(MUST FAIL) → Restore → Run(pass) 流程，但至少需要 mattpocock 的"red-capable"标准——回归测试必须能在 bug 存在时失败。可以在 CI 中加入回归测试有效性检查——随机选择一些回归测试，临时 revert 对应的 fix，验证测试确实失败。

**改进方向五：审查成本持续监控**

借鉴 Superpowers 的版本演进经验——持续监控审查成本，定期评估是否可以用 inline self-review 替代 subagent review、是否可以合并审查维度、是否可以降低 model tier。关键指标：审查时间 vs 实现时间比例、reviewer findings 的 false positive 率、审查后仍发现的问题数量。

### 5.7 本篇结论

Review & Verify 节点的核心使命是**从实现到确认**——确保 AI 实现的代码确实满足需求、通过验证、没有引入新问题。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **审查者独立性需要显式保障**——Superpowers 的教训表明 controller 会不自觉地 coaching reviewer，mattpocock 的双轴分离和 gstack 的跨模型是更结构化的保障
2. **虚假完成声明是最常见的失败模式**——Superpowers 的 Iron Law 和 ECC 的 delivery-gate 是两种不同方向的应对——前者用 skill 约束提升上限，后者用 hook 机械化确保底线
3. **机械化检查的可靠性与覆盖面成反比**——ECC 的 delivery-gate 100% 触发但只查表面模式，Superpowers 的 Iron Law 覆盖面广但触发率 50-80%
4. **Scope drift 是 AI 辅助开发的特有问题**——gstack 的 Plan Completion Audit 和 mattpocock 的 Spec 轴是两种系统化检测方法
5. **审查成本是真实问题**——Superpowers 从两个 reviewer 减到一个、从 subagent review 改为 inline self-review，每一步都是对真实成本的回应

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用 Review & Verify 节点时参考。后续章节将逐个节点展开类似的讨论。

---
