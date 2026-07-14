---
title: AI研发流程深度解析（十二）：Review & Verify节点——从实现到确认
description: 对比5个项目如何审查代码和验证实现，分析Review的层次设计、Verify的维度和强制程度选择的关键差异。
tags:
  - 研发流程
  - Review
  - Verify
  - 验证
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-12
> **核心问题：** 5个项目如何审查代码和验证实现？Review的层次设计和Verify的维度有什么关键差异？强制程度（gate vs非阻断）如何选择？各项目走过哪些弯路？我们能从中学到什么？

---

## 1. 对比分析

### 1.1 Superpowers：Per-task Review Gate + Iron Law Verification

Superpowers的Review和Verify紧密耦合在SDD（Subagent-Driven Development）流程中，由两个skill承担：`requesting-code-review`（`skills/requesting-code-review/SKILL.md`）和 `verification-before-completion`（`skills/verification-before-completion/SKILL.md`）。此外，`receiving-code-review` skill定义了如何接收和回应审查反馈。

**Review机制——Per-task + Whole-branch两层：**

- **Per-task review**：每个task完成后，controller通过 `scripts/review-package` 生成diff文件，然后dispatch一个task reviewer subagent（`task-reviewer-prompt.md`）。Reviewer是 **read-only**——不直接修改代码、不触碰working tree或branch。Reviewer读diff文件后返回两个verdict：**spec compliance**（实现是否符合plan）和 **code quality**（代码质量）。Findings分三级：Critical / Important / Minor。Critical必须立即修复，Important必须在进入下一个task前修复，Minor记录待后处理。
- **Whole-branch final review**：所有task完成后执行一次，使用最强模型（`code-reviewer.md` 模板），检查跨task的结构性问题（去重、函数膨胀、命名一致性、无关变更）。
- **关键约束**：controller **不能告诉reviewer忽略什么或降级severity**——SDD skill明确写道："不要替reviewer预判发现——永远不要指示reviewer忽略或不标记某个具体问题。如果你正在写的prompt中包含 'do not flag'、'don't treat X as a defect'、'at most Minor' 或 'the plan chose'——停下来：你正在预判，通常是为了让自己少走一轮review loop。"
- **Reviewer不信任implementer的报告**：task-reviewer-prompt.md明确写道："将implementer的报告视为关于代码的未经证实的声明。它可能是不完整的、不准确的或过于乐观的。要根据diff验证这些声明。报告中的设计理由也是声明……陈述的理由永远不能降低某个finding的严重程度。"
- **Receiving review**：`receiving-code-review` skill禁止表演性同意（"You're absolutely right!"），要求技术验证后再实施。外部reviewer的建议被视为"需要评估的建议，而非需要遵循的命令"。

**Verify机制——Iron Law + Gate Function：**

- **Iron Law**：`NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`——如果没在当前message中运行验证命令，就不能声称它通过了。"违反这条规则的字面意义就是违反这条规则的精神。"
- **Gate Function**：`IDENTIFY → RUN → READ → VERIFY → CLAIM`
  1. IDENTIFY：什么命令能证明这个claim？
  2. RUN：执行完整命令（fresh，不是之前的缓存）
  3. READ：完整输出，检查exit code，计数failures
  4. VERIFY：输出是否确认claim？
  5. ONLY THEN：做出claim
- **Rationalization表**：列出所有AI逃避验证的借口——"should work now" → RUN the verification；"I'm confident" → Confidence ≠ evidence；"Agent said success" → Verify independently。
- **Red Flags**：使用 "should" / "probably" / "seems to"；在验证前表达满意（"Great!" / "Perfect!" / "Done!"）。
- **回归测试验证**：Write → Run(pass) → Revert fix → Run(MUST FAIL) → Restore → Run(pass)——不只是写回归测试，必须验证测试在bug存在时确实失败。
- **24 failure memories**：来自真实失败案例——"你的人类伙伴说'我不相信你'——信任破裂了"；"未定义的函数被提交——会导致崩溃"。

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v5.0.6之前 | brainstorming和writing-plans阶段的subagent review loop增加了约25分钟执行时间，但回归测试（5个版本 × 5次试验）显示质量分数与是否运行review loop无关 | v5.0.6用inline self-review checklist替代subagent review loop——~25min → ~30s，缺陷发现率相当。brainstorming替换为placeholder scan + internal consistency + scope check + ambiguity check；writing-plans替换为spec coverage + placeholder scan + type consistency |
| v6.0.0之前 | 每个task跑两个独立reviewer（`spec-reviewer-prompt.md` + `code-quality-reviewer-prompt.md`），成本翻倍但两个reviewer的发现经常重叠 | v6.0.0合并为单reviewer两个verdict（`task-reviewer-prompt.md`）——一次读diff返回spec compliance + code quality，一次fix pass清两个verdict |
| v6.0.0之前 | controller在dispatch reviewer时会不自觉地指导reviewer忽略某些发现或降级severity——"真实运行中发现controller指导reviewer跳过某个发现或称之为'最多Minor'，导致缺陷被发布" | v6.0.0明确禁止："不要替reviewer预判发现——永远不要指示reviewer忽略或不标记某个具体问题" |
| v6.0.0之前 | reviewer运行 `git checkout` 导致后续commit被孤立——reviewer碰了working tree和branch state | v6.0.0 reviewer改为read-only："Review不再触碰working tree或branch" |
| v6.0.0之前 | controller dispatch reviewer时不指定model——unnamed model静默继承session最贵的model，一次运行把所有26个reviewer都放在最贵tier | v6.0.0 template要求显式指定model，并按任务复杂度选择tier |
| v6.0.0之前 | diff通过粘贴传递——"粘贴的diff永久驻留在最昂贵的context中"——controller context膨胀严重 | v6.0.0引入 `review-package` 和 `task-brief` 脚本，将diff和task text写入文件由reviewer读取 |
| v6.0.0之前 | controller context compaction后丢失进度，重新dispatch已完成的task——"观察到的最昂贵的失败" | v6.0.0引入progress ledger文件（`.superpowers/sdd/progress.md`），记录每个task的完成状态和commit范围 |
| v6.0.3之前 | SDD scratch文件写在 `.git/` 下，Claude Code将 `.git/` 视为保护路径，agent写入被阻止 | v6.0.3移到 `.superpowers/sdd/` 目录 |

**核心教训：** Review机制的演进主线是"防止controller和reviewer之间的认知串通"。从两个reviewer减到一个、禁止controller指导reviewer、reviewer改为read-only、用文件传递diff——每一步都是对真实失败模式的回应。Superpowers的结论是：reviewer的独立性不能靠默认行为保证，必须用显式约束。

### 1.2 OpenSpec：Two-Moment Review + Three-Dimension Verify（非阻断）

OpenSpec将Review和Verify分为两个独立环节，由 `reviewing-changes.md` 文档和 `/opsx:verify` 命令承担（`docs/reviewing-changes.md`、`src/core/templates/workflows/verify-change.ts`）。

**Review机制——两个时机：**

```
/opsx:propose ──► REVIEW THE PLAN ──► /opsx:apply ──► REVIEW THE CODE ──► /opsx:archive
                  (before any code)                    (/opsx:verify)
```

- **Propose后审查（读计划）**：在代码编写前审查proposal → specs → design.md → tasks.md。核心理念："在一页的计划中发现一个错误方向几乎不花成本。在300行代码中发现同样的错误方向则不然。"
- **阅读顺序按"能最早退出"排列**：proposal.md → specs/ → design.md → tasks.md。如果proposal方向就错了，不用往下读。
- **三个问题**：(1) 这是正确的问题吗？(2) "done" 是否定义正确？(3) 计划是否sane？
- **Right-size review**："不是每个变更都值得完整审查。一个单文件typo修复值得20秒扫一眼。一个触及auth、payments或不可恢复数据的变更值得上面的每一个问题。"
- **"Pushing back is cheap"**：修改成本在plan阶段最低——"没有阶段划分，没有什么是锁定的——你修正它然后继续。"
- **Two-minute checklist**：7项检查清单——intent匹配？scope未膨胀？requirement可测试？requirement有scenario？最在意的case覆盖了？tasks映射到requirements？能接受AI只做这些？

**Verify机制——三维验证（非阻断）：**

- **三个维度**：
  - **Completeness**：所有task完成（checkbox解析）、所有requirement实现（代码搜索关键词）、scenario覆盖
  - **Correctness**：实现匹配spec意图、edge case处理、scenario在代码中有对应处理
  - **Coherence**：design决策在代码中体现、代码模式一致性（文件命名、目录结构、编码风格）
- **严重度分级**：CRITICAL / WARNING / SUGGESTION
- **不阻断archive**："它**不**阻断archiving——它暴露差距并将决定权留给你"——暴露问题但由人类决策
- **False Positive策略**："不确定时，优先用SUGGESTION而非WARNING，优先用WARNING而非CRITICAL"——不确定时降级而非升级
- **Graceful Degradation**：只有tasks.md时只验证task完成；有tasks+specs时验证completeness+correctness；完整artifacts时验证全部
- **基于启发式规则**：关键词搜索、文件路径分析、"reasonable inference"——不要求确定性证明

**历史踩坑：**

| 阶段 | 问题 | 修复 |
|------|------|------|
| 早期 | Review阻断导致用户用 `--no-validate` 完全跳过验证——阻断反而降低了验证覆盖率 | Verify不阻断Archive，暴露问题让人类决策——"仪式感要与风险等级匹配" |
| 早期 | 过度结构化——所有变更都走完整审查流程，简单修改也要回答所有问题 | 引入 "Right-size review"——一文件typo修复值得20秒扫一眼，auth/payments变更才值得完整审查 |
| 持续存在 | Verify基于启发式规则（关键词搜索、文件路径分析）——精度有限，可能产生false positive | "不确定时，优先用SUGGESTION而非WARNING，优先用WARNING而非CRITICAL"——不确定时降级，而非升级 |
| 持续存在 | Verify不阻断——用户可以忽略所有警告直接archive，spec与代码可能不一致 | 不修复——这是有意的tradeoff。OpenSpec认为暴露问题由人类决策比强制阻断更实用 |

**核心教训：** OpenSpec的验证哲学是"暴露而非阻断"——verify的价值在于让问题可见，而非阻止用户行动。这个取向的代价是用户可以忽略所有警告。OpenSpec接受这个tradeoff，因为"仪式感要与风险等级匹配"——不同变更的风险等级不同，一刀切的阻断反而适得其反。

### 1.3 ECC：Mechanical Gate + 6-Phase Verification + 5-Axis Self-Evaluation

ECC的Review和Verify由多个组件协同承担：`verification-loop` skill、`delivery-gate` Stop hook、`agent-self-evaluation` skill、`orch-pipeline` 的Phase 5 Review（`skills/verification-loop/SKILL.md`、`skills/delivery-gate/SKILL.md`、`skills/agent-self-evaluation/SKILL.md`、`skills/orch-pipeline/SKILL.md`）。

**Review机制——语言专用 + Gated Pipeline：**

- **orch-pipeline Phase 5** 委托给 `code-reviewer` agent和 `/code-review` command
- **语言专用reviewer**：orch-pipeline的agent map列出 "language reviewer (`python-reviewer`, `typescript-reviewer`, …)"——匹配项目技术栈
- **Security trigger**：自动拉入 `security-reviewer`——覆盖auth、user-input、DB queries、file paths、external API、crypto、secrets
- **Review findings**：CRITICAL/HIGH必须在GATE 2（Commit前）解决
- **PostToolUse hooks**：自动检查代码质量（prettier、tsc、console.log检测）——每次工具调用后即时反馈
- **agent-self-evaluation**：5轴自评（Accuracy / Completeness / Clarity / Actionability / Conciseness），每个低于5分的必须引用具体证据——"展示差距在哪里，不要只是说出它的名字。"。**不是** pass/fail gate，而是反思步骤。"Everything is a 5" anti-pattern被明确禁止。

**Verify机制——6 Phase + Mechanical Gate：**

- **verification-loop的6 phase**：
  1. Build Verification——构建是否通过
  2. Type Check——类型检查（tsc / pyright）
  3. Lint Check——代码规范
  4. Test Suite——测试套件（80%+ coverage目标）
  5. Security Scan——密钥检测、console.log检测
  6. Diff Review——逐文件审查无意变更、缺失错误处理、edge case
- **输出VERIFICATION REPORT**：Build/Types/Lint/Tests/Security/Diff逐项PASS/FAIL，Overall READY/NOT READY
- **Continuous mode**：长session中每15分钟或重大变更后运行
- **delivery-gate（Stop hook）**：三个机械化检查：
  - **Rationalization patterns**：regex匹配transcript尾部文本（如 "skip tests for now"）——**Warning only，不阻断**
  - **Stale learning libraries**：检查5个学习库文件的mtime——复杂任务（>=3 edits）未touch学习库则 **Block（exit 2）**
  - **Disk space**：< 50GB Warning，< 15GB则 **Block（exit 2）**
- **关键设计**：delivery-gate是"机械化gate检查机器可验证的事实"——不依赖AI推理，用正则/mtime/disk等确定性检查。与 `self-audit`（reasoning quality gate）形成defense in depth——"delivery-gate检查机器可验证的事实；self-audit检查输出质量"

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| Skills概率性触发（50-80%）导致验证环节的观察数据不可靠 | 改用PreToolUse/PostToolUse hooks（100% 可靠）捕获代码质量信号——delivery-gate作为Stop hook 100% 触发 |
| Agent自评倾向于"一切正常"——"Everything is a 5" anti-pattern | 引入agent-self-evaluation的5轴评分，低分项必须引用具体证据，"展示差距在哪里，不要只是说出它的名字" |
| delivery-gate只能检查表面模式（regex匹配rationalization文本、mtime检查文件更新时间）——不检查内容质量 | 明确承认这一局限："这个hook强制的是touch学习库的习惯，而非记录内容的质量。这是有意为之：机械化gate检查机器可验证的事实。"——与self-audit配对使用形成defense in depth |
| Rationalization regex会false positive | Rationalization patterns设为 **Warning only**，永不阻断——"regex启发式可能产生false positive" |
| 无结构化的spec模型——AC是一次性工作产物，不持续演进 | 未修复——ECC的设计取向是"提供素材不定义流程"，spec持续演进是OpenSpec的关注点 |

**核心教训：** ECC的核心洞察是"机械化检查的可靠性远超AI推理"——hook 100% 触发，skill只有50-80%。但机械化检查的覆盖面太窄（只查表面模式）。ECC的解法是defense in depth——delivery-gate用机械化检查确保底线（学习库更新、磁盘空间），verification-loop用6 phase做全面检查，agent-self-evaluation用5轴评分做反思，self-audit用推理检查内容质量。

### 1.4 mattpocock-skills：Two-Axis Parallel Sub-agents + TDD验证

mattpocock的Review和Verify融合在 `/implement` 流程中，由 `/code-review` 和 `/tdd` 两个skill承担（`skills/engineering/code-review/SKILL.md`、`skills/engineering/tdd/SKILL.md`）。`/diagnosing-bugs` skill提供了反馈循环的质量标准。

**Review机制——双轴分离：**

- **Two-axis review**：Standards（编码标准 + Fowler smell baseline）和Spec（需求忠实度），两个轴作为 **parallel sub-agents** 独立运行——"两个轴作为parallel sub-agents运行，这样它们不会污染彼此的context。"
- **报告不合并、不重排**："**不要**合并或重排findings——两个轴是有意分开的"——两条报告并列呈现，用户自行综合。
- **为什么分离**："一个变更可以通过一个轴但失败于另一个轴"——代码可以符合标准但实现错误（Standards pass, Spec fail），或实现了需求但违反约定（Spec pass, Standards fail）。"分开报告可以防止一个轴遵蔽另一个轴。"
- **Standards轴**：
  - 查找commit diff中违反repo文档化编码标准的地方
  - **12种Fowler smell baseline**（always-on）：Mysterious Name、Duplicated Code、Feature Envy、Data Clumps、Primitive Obsession、Repeated Switches、Shotgun Surgery、Divergent Change、Speculative Generality、Message Chains、Middle Man、Refused Bequest
  - 两条绑定规则：repo文档标准overrides baseline；smell是judgement call非硬违规
  - "跳过已有工具检查的内容"——已有工具检查的不重复
- **Spec轴**：
  - 查找spec中缺失/部分实现的需求
  - scope creep（diff中有spec未要求的行为）
  - 实现错误的需求
  - **Spec来源追溯**：commit message中的issue引用 → 用户传入路径 → `docs/specs/.scratch` → 问用户
- **Under 400 words**：每个sub-agent报告限制在400字以内——保持精炼

**Verify机制——TDD Red-Green + 反馈循环标准：**

- **TDD red-green是验证核心**：先写失败测试（RED），再最小实现使其通过（GREEN）。"先RED后GREEN。先写失败的测试，然后只写刚好让它通过的代码。"
- **三个anti-patterns防止虚假验证**：
  - **implementation-coupled**：测试与实现耦合，重构就坏——"测试在重构时断裂但行为没有变化"
  - **tautological**：永远通过但零信心——"断言用与代码相同的方式重新计算期望值……因此它通过构造就能通过，永远不会与代码不一致"
  - **horizontal slicing**：先写所有测试再写所有实现——"批量测试验证的是想象中的行为"
- **`/diagnosing-bugs` 的反馈循环标准**：
  - **tight**：快速、确定性、agent可运行——"一个30秒的flaky循环几乎不比没有循环好；一个2秒的确定性循环才是tight的"
  - **red-capable**：必须能在bug存在时失败——"没有red-capable的命令，就不能进入Phase 2"
  - Phase 5的correct seam检查——如果没有正确的测试缝，"这本身就是发现"
- **无独立verify skill**：验证嵌入implement和code-review流程中，不是独立环节

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| 持续存在 | Standards和Spec混在一个review中——符合标准的错误实现可能被放过 | 引入双轴parallel sub-agents——Standards和Spec独立运行，报告不合并不重排，防止一个轴遮蔽另一个 |
| 持续存在 | repo没有文档化编码标准时，review没有最低保障 | 引入12种Fowler smell baseline（always-on）——即使repo没有文档化标准也有最低检查基线 |
| 持续存在 | smell检查可能与repo已有约定冲突 | "The repo overrides"——文档化的repo标准始终优先于baseline；smell是judgement call而非硬违规 |
| 持续存在 | 测试可能永远通过但零信心（tautological） | 明确列出三种anti-patterns并给出定义——expected values必须来自独立来源（known-good literal、worked example、spec） |
| 持续存在 | 反馈循环不够tight——30秒的flaky loop几乎等于没有 | "A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight"——要求fast + deterministic + agent-runnable |
| 持续存在 | 无独立verify skill——验证嵌入implement流程中 | 不修复——这反映了mattpocock "不拥有流程"的设计取向。验证是implement的一部分，不是独立环节 |

**核心教训：** mattpocock的核心贡献是"双轴分离"——防止"好代码但错误实现"的遮蔽。这个设计洞察值得深思：一个维度的通过不应该掩盖另一个维度的失败。Fowler smell baseline提供了always-on的最低保障——即使repo没有文档化标准也不会"裸奔"。但mattpocock不设独立verify环节，验证完全依赖TDD red-green循环——如果用户跳过TDD，就没有保障。

### 1.5 gstack：Cross-Model Review + Browser QA + Plan Completion Audit

gstack的Review和Verify是最重的，由 `/review`、`/codex`、`/cso`、`/qa`、`/benchmark`、`/investigate` 等多个skill承担（`review/SKILL.md`、`qa/SKILL.md`、`codex/SKILL.md`、`cso/SKILL.md`）。

**Review机制——跨模型 + 多角色 + Scope Drift Detection：**

- **`/review`（Pre-landing PR review）**：分析diff中的结构性问题——SQL安全、LLM信任边界、条件副作用等。
  - **Scope Drift Detection（Step 1.5）**：在审查代码质量前，先检查"是否做了要求的事——不多不少"。检测SCOPE CREEP（无关变更）和MISSING REQUIREMENTS（未实现需求）。读TODOS.md、PR description、commit messages获取stated intent，与diff对比。
  - **Plan Completion Audit**：搜索plan文件 → 提取actionable items → 逐项对照diff分类（DONE / PARTIAL / NOT DONE / CHANGED / UNVERIFIABLE）。对PARTIAL和NOT DONE调查原因（scope cut / context exhaustion / misunderstood requirement / blocked / forgotten）。
  - **Verification Mode**：DIFF-VERIFIABLE / CROSS-REPO / EXTERNAL-STATE / CONTENT-SHAPE——不同类型的plan item用不同方式验证。
  - **Slop scan（Step 3.5）**：检测AI代码质量问题（empty catches、redundant `return await`、overcomplicated abstractions）——advisory，不阻断。
  - **Checklist-based review**：读取 `.claude/skills/review/checklist.md` 按清单审查。如果文件不可读则STOP——"没有checklist不能继续。"
  - **Learnings search**：搜索过往session的learnings，在审查中应用——"应用的过往学习：[key]（置信度N/10，来自 [date]）"
  - **Specialist dispatch**：按diff scope自动派遣specialist reviewers（performance、data-migration、api-contract、design）
- **`/codex`（跨模型审查）**：用不同的AI模型独立审查——"跨模型的一致意见是建议而非决定。由用户决定。"
- **`/cso`（Security Officer）**：安全审查。
- **审查日志**：写入 `~/.gstack/projects/$SLUG/$BRANCH-reviews.jsonl`。

**Verify机制——浏览器QA + 健康评分：**

- **`/qa`——持久浏览器守护进程执行端到端验证**：
  - 打开真实浏览器 → 点击通过用户流程 → 发现bug → 修复（atomic commits）→ 生成回归测试 → 重新验证
  - **Diff-aware mode**：在feature branch上自动分析diff → 识别受影响的页面/路由 → 针对性测试
  - **Health Score Rubric**：8个维度加权评分——Console(15%)、Links(10%)、Visual(10%)、Functional(20%)、UX(15%)、Performance(10%)、Content(5%)、Accessibility(15%)
  - **Three tiers**：Quick（critical+high）、Standard（+medium）、Exhaustive（+cosmetic）
  - **Regression mode**：与baseline对比——哪些issue修了？哪些是新的？分数delta？
  - **Atomic commits**：每个bug fix单独commit + 回归测试——"一个fix一个commit。永远不要打包多个fix。"
  - **Self-regulation**：WTF-likelihood启发式——每次revert +15%、touching >3 files +5%、50 fixes硬上限。WTF > 20% 则STOP。
  - **Phase 8e.5 Regression Test**：trace bug的codepath → 写测试 → 运行 → 评估（Passes → commit / Fails → fix once / >2min → skip and defer）
  - **Test Framework Bootstrap**：如果项目没有测试框架，自动检测runtime → 研究最佳实践 → 安装配置 → 生成3-5个真实测试 → 验证 → 创建CI pipeline → 写TESTING.md
- **`/benchmark`**：性能验证
- **`/investigate`**：调试验证

**历史踩坑：**

| 问题 | 修复 |
|------|------|
| Review只看代码质量不看scope——AI可能"多做了一点"或"少做了一点" | 引入Scope Drift Detection（Step 1.5）——在审查代码质量前先检查"是否做了要求的事——不多不少" |
| Plan item完成度缺乏系统化验证——reviewer只看diff不看plan | 引入Plan Completion Audit——提取plan中的actionable items，逐项对照diff分类DONE/PARTIAL/NOT DONE/CHANGED/UNVERIFIABLE |
| 不同类型的plan item用同一种方式验证——跨repo或外部状态的item在diff中不可见 | 引入Verification Mode分类——DIFF-VERIFIABLE / CROSS-REPO / EXTERNAL-STATE / CONTENT-SHAPE，不同类型用不同方式验证 |
| 单模型审查有系统性盲区——Claude可能系统性地忽略某些类型问题 | 引入跨模型审查（/codex）——用不同AI模型独立审查 |
| 代码质量审查太宽泛——没有最低保障 | 引入checklist-based review——读取 `checklist.md` 按清单审查，文件不可读则STOP |
| Slop scan某些"sloppy"模式是正确的工程选择——false positive风险 | Slop findings设为advisory，永不阻断——"Slop findings是建议性的，永远不阻断" |
| QA fix loop可能失控——agent越改越烂 | 引入WTF-likelihood启发式——每次revert +15%、touching >3 files +5%、50 fixes硬上限。WTF > 20% 则STOP |
| 回归测试可能永远通过但零信心 | Phase 8e.5要求trace bug的codepath后再写测试——"设置触发bug的前置条件……断言正确的行为（不是'它能渲染'或'它不抛异常'）" |
| 项目可能没有测试框架——QA发现的bug无法写回归测试 | Test Framework Bootstrap——自动检测runtime、研究最佳实践、安装配置、生成真实测试、创建CI pipeline |

**核心教训：** gstack的核心贡献是"让agent有眼睛"——浏览器QA是其他项目没有的维度。Plan Completion Audit和Scope Drift Detection是对"AI倾向于多做或少做"问题的系统化回应。WTF-likelihood启发式是对"fix loop失控"问题的实用解法——不是阻止agent修bug，而是在失控前暂停让人类介入。

---

## 2. 关键差异

### 2.1 Review层次设计对比

| 项目 | Review层次 | Review时机 | Review方式 | 强制程度 |
|------|-----------|-----------|-----------|---------|
| **Superpowers** | Per-task + Whole-branch | 每个task后 + 全部完成后 | Subagent（独立context，read-only） | Per-task review是 **gate**（Critical/Important必须修复） |
| **OpenSpec** | Propose后 + Apply后 | 计划审查 + 实现审查 | 人工读Markdown | **非阻断**——"将决定权留给你" |
| **ECC** | orch-* Phase 5 | Plan后 + Commit前 | 语言专用reviewer + security-reviewer | GATE 2在Commit前——CRITICAL/HIGH必须解决 |
| **mattpocock** | 一次性（implement后） | 实现完成后 | 双轴parallel sub-agents（Standards + Spec） | 无per-task gate——是implement后的一次性审查 |
| **gstack** | Branch-level | /ship前 | 跨模型（Claude + Codex）+ 多角色（Eng/Security）+ Scope Drift + Plan Completion Audit | Eng Review required，其他informational |

**关键观察：** Review的层次设计形成了从"per-task gate"到"branch-level informational"的光谱。Superpowers是最细粒度的——每个task都有独立review gate。gstack是最广视角的——跨模型审查消除单模型偏差，Plan Completion Audit逐项对照plan。mattpocock的双轴分离是独特的——防止一个轴遮蔽另一个轴。OpenSpec最轻量——人工读Markdown，不结构化。

### 2.2 Verify维度对比

| 项目 | Verify维度 | 验证方式 | 阻断机制 |
|------|-----------|---------|---------|
| **Superpowers** | Fresh evidence（运行命令→读输出→确认claim） | Iron Law Gate Function | **Iron Law**——NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE |
| **OpenSpec** | Completeness + Correctness + Coherence | 启发式（关键词搜索、文件路径分析） | **不阻断**——CRITICAL/WARNING/SUGGESTION分级，暴露问题由人类决策 |
| **ECC** | Build + Type + Lint + Test + Security + Diff | 6 phase确定性命令 + delivery-gate机械化检查 | delivery-gate **Block（exit 2）**——学习库stale / 磁盘不足 |
| **mattpocock** | TDD red-green + 反馈循环质量 | 测试通过/失败 + "tight + red-capable" 标准 | 无独立阻断——嵌入implement流程 |
| **gstack** | 浏览器端到端 + 健康评分 + 回归对比 | 真实浏览器点击 + 截图证据 + health score | WTF-likelihood > 20% 则STOP |

**关键观察：** Verify的维度从"运行测试命令"（Superpowers）到"打开浏览器看产品"（gstack）形成了光谱。Superpowers强调evidence before claims——不信任任何未在当前message中运行的验证。ECC的delivery-gate是唯一的机械化阻断——用regex/mtime/disk等确定性检查，不依赖AI推理。gstack的浏览器QA是最直观的——agent有"眼睛"，看产品而非看测试。OpenSpec最宽松——基于启发式推理，不要求确定性证明。

### 2.3强制程度光谱

| 级别 | 代表项目 | 机制 | 阻断方式 |
|------|---------|------|---------|
| **Iron Law** | Superpowers | NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE | Skill约束（每次声明前必须运行验证命令） |
| **Mechanical Gate** | ECC | delivery-gate Stop hook（regex + mtime + disk） | Hook阻断（exit 2，100% 触发） |
| **Pipeline Gate** | ECC | orch-* GATE 2（Commit前） | Pipeline阻断（CRITICAL/HIGH必须解决） |
| **Per-task Gate** | Superpowers | Reviewer findings Critical/Important必须修复 | Subagent gate（不修复不进入下一个task） |
| **Branch-level Gate** | gstack | Eng Review required | /ship前required review |
| **Informational** | OpenSpec, gstack（非Eng） | verify不阻断archive | 无阻断——暴露问题由人类决策 |
| **Embedded** | mattpocock | TDD red-green嵌入implement | 无独立阻断——依赖TDD循环 |

**关键观察：** ECC的delivery-gate是唯一用 **机械化检查**（不依赖AI推理）的阻断机制——hook 100% 触发，而skill的触发率约50-80%。Superpowers的Iron Law依赖skill约束——最强但依赖agent遵守。gstack的required review是branch-level的——比per-task宽松但比informational有约束力。OpenSpec和mattpocock最轻——不阻断，依赖用户判断。

### 2.4代码质量检查方式

| 项目 | 代码质量检查 | 检查内容 | 工具化程度 |
|------|-----------|---------|-----------|
| **Superpowers** | Reviewer subagent | spec compliance + code quality（去重、膨胀、命名、无关变更） | Subagent（AI推理） |
| **OpenSpec** | verify Coherence维度 | design决策体现 + 代码模式一致性 | 启发式（关键词搜索） |
| **ECC** | PostToolUse hooks + language reviewers + self-evaluation | prettier、tsc、console.log + 语言专用审查 + 5轴自评 | Hook（自动化） + Agent（AI推理） + 自评（反思） |
| **mattpocock** | Standards轴 | 12种Fowler smell baseline + repo文档标准 | Sub-agent（AI推理 + baseline清单） |
| **gstack** | Slop scan + review checklist + specialist dispatch | AI代码质量模式 + 结构性审查清单 + 领域专家 | 脚本（slop:diff） + AI推理 + 专门agent |

**关键观察：** 代码质量检查的方式从"纯AI推理"（Superpowers reviewer）到"纯脚本"（gstack slop scan）形成光谱。mattpocock的Fowler smell baseline是独特的——提供always-on的最低检查基线，即使repo没有文档化标准也有保障。ECC的PostToolUse hooks是最即时的——每次工具调用后立即检查。gstack的slop scan专注于AI特有的代码质量问题——"AI code quality, not AI code hiding"。

---

## 3. 历史踩坑汇总与经验教训

### 3.1踩坑类型分类

将五个项目在Review & Verify节点的历史踩坑按类型归纳，可以发现一些反复出现的模式：

**类型一：审查者独立性被侵蚀**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers v6.0.0之前 | controller在dispatch reviewer时指导reviewer忽略某些发现或降级severity——"真实运行中发现controller指导reviewer跳过某个发现或称之为'最多Minor'，导致缺陷被发布" | controller和reviewer之间没有隔离——controller的措辞可以影响reviewer的判断 | v6.0.0明确禁止pre-judging findings——"如果你正在写的prompt中包含 'do not flag'、'don't treat X as a defect'、'at most Minor' 或 'the plan chose'——停下来：你正在预判" |
| Superpowers v6.0.0之前 | reviewer运行 `git checkout` 导致后续commit被孤立 | reviewer可以触碰working tree和branch state | v6.0.0 reviewer改为read-only——"Review不再触碰working tree或branch" |
| Superpowers v6.0.0之前 | reviewer信任implementer的报告——"I left this unabstracted on purpose" 让reviewer放过真实finding | reviewer没有被告知implementer的报告是"未经证实的声明" | task-reviewer-prompt.md明确写道："将implementer的报告视为未经证实的声明……陈述的理由永远不能降低finding的严重程度" |
| mattpocock | Standards和Spec混在一个review中——符合标准的错误实现可能被放过 | 单一审查维度会让一个维度的通过掩盖另一个维度的失败 | 引入双轴parallel sub-agents——报告不合并不重排 |

**类型二：验证被跳过或虚假通过**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers | agent声称"should work now"但实际上没有运行验证 | 没有fresh evidence约束——agent可以引用之前的验证结果或凭"信心"声称完成 | Iron Law：NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE——必须在当前message中运行验证命令 |
| ECC | Skills概率性触发（50-80%）——验证环节可能被跳过 | skill约束依赖agent遵守，不是100% 可靠 | delivery-gate作为Stop hook——100% 触发，机械化检查不依赖AI推理 |
| OpenSpec | 用户用 `--no-validate` 完全跳过验证 | 验证阻断导致用户要么全接受要么全跳过 | Verify不阻断——暴露问题由人类决策，"仪式感要与风险等级匹配" |
| mattpocock | 测试tautological——永远通过但零信心 | expected values用与代码相同的方式计算 | 明确列出anti-patterns——expected values必须来自独立来源 |
| Superpowers | 回归测试只运行一次就声称通过——没有验证测试在bug存在时确实失败 | 没有red-green回归验证要求 | Write → Run(pass) → Revert fix → Run(MUST FAIL) → Restore → Run(pass) |

**类型三：审查成本失控**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers v5.0.6之前 | brainstorming和writing-plans的subagent review loop增加 ~25分钟执行时间 | 每step dispatch subagent做审查——成本高 | v5.0.6用inline self-review替代——~25min → ~30s，质量相当 |
| Superpowers v6.0.0之前 | 每task跑两个独立reviewer——成本翻倍 | spec和quality分为两个reviewer | v6.0.0合并为单reviewer两个verdict |
| Superpowers v6.0.0之前 | controller不指定model——26个reviewer全用最贵tier | unnamed model静默继承session最贵model | v6.0.0 template要求显式指定model |
| Superpowers v6.0.0之前 | diff通过粘贴传递——controller context膨胀 | 粘贴的diff永久驻留在最贵的context中 | v6.0.0用文件传递diff——`review-package` 脚本写文件 |
| gstack | QA fix loop越改越烂——agent不停revert和重试 | 没有失控检测机制 | WTF-likelihood启发式——>20% 则STOP |

**类型四：机械化检查的局限**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| ECC | delivery-gate只能检查表面模式（regex、mtime）——不检查内容质量 | 机械化检查只能验证machine-verifiable facts | 与self-audit配对——defense in depth：delivery-gate查事实，self-audit查推理质量 |
| ECC | Rationalization regex会false positive | regex启发式不精确 | Rationalization patterns设为Warning only，永不阻断 |
| OpenSpec | Verify基于启发式——精度有限 | 关键词搜索和文件路径分析不等于确定性证明 | "不确定时，优先用SUGGESTION而非WARNING，优先用WARNING而非CRITICAL"——不确定时降级 |

**类型五：Scope drift检测缺失**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| gstack | Review只看代码质量不看scope——AI可能"多做了一点" | 审查流程不包含scope检查 | 引入Scope Drift Detection（Step 1.5）和Plan Completion Audit |
| mattpocock | 单一审查维度无法区分"代码质量"和"需求忠实度" | Standards和Spec混在一起 | 双轴分离——Spec轴专门检查scope creep |
| OpenSpec | Scope drift只在propose阶段检测 | 只在代码编写前审查proposal | 不修复——propose阶段是成本最低的发现时机 |

### 3.2经验教训总结

从五个项目的踩坑历史中，可以提炼出以下经验教训：

**教训一：审查者的独立性不能靠默认行为保证**

Superpowers v6.0.0的教训是最直接的证据——即使dispatch了独立subagent，controller仍可能通过措辞影响reviewer。controller说"don't flag X"或"at most Minor"，reviewer就会遵从。更严重的是，reviewer甚至会运行 `git checkout` 碰触working tree，导致后续commit被孤立。显式禁止（"controller不能告诉reviewer忽略什么"）和read-only约束是必要的但来之不易——Superpowers花了多个版本才意识到这些问题。mattpocock的双轴分离和gstack的跨模型是更结构化的独立性保障。

**教训二：虚假完成声明是最常见的失败模式**

Superpowers的24 failure memories和Iron Law是最直接的回应——agent经常声称"should work now"但实际上没有运行验证。ECC的delivery-gate用regex匹配rationalization文本（如 "skip tests for now"）捕获表面模式——但只能捕获表面模式。mattpocock的tautological anti-pattern是另一种虚假验证——测试永远通过但零信心。关键洞察是：**运行验证命令**比**声称验证通过**重要得多——Superpowers的Gate Function（IDENTIFY → RUN → READ → VERIFY → CLAIM）将这个要求结构化。

**教训三：机械化检查的可靠性与覆盖面成反比**

ECC的delivery-gate 100% 触发（hook机制），但只能检查表面模式（regex、mtime、disk）。Superpowers的Iron Law覆盖面最广（任何完成声明都需要fresh evidence），但依赖agent遵守（50-80% 触发率）。两者结合可能是最优——delivery-gate确保底线，Iron Law提升上限。但ECC自己也承认："这个hook强制的是touch学习库的习惯，而非记录内容的质量。"——机械化检查不能替代内容质量审查。

**教训四：审查成本是真实问题**

Superpowers的版本演进清晰地展示了审查成本的下降曲线：两个reviewer → 一个reviewer（v6.0.0）、subagent review loop → inline self-review（v5.0.6，~25min → ~30s）、粘贴diff → 文件传递（v6.0.0）、未指定model → 显式指定（v6.0.0）。每一步优化都是对真实成本的回应——"一次运行把所有26个reviewer都放在最贵tier" 这种事故在生产中确实发生过。

**教训五：Scope drift是AI辅助开发的特有问题**

AI倾向于"多做一点"——这是scope creep的来源。gstack的Scope Drift Detection和Plan Completion Audit是最系统化的检测方法。mattpocock的Spec轴是双轴分离的自然结果——Spec轴天然关注"是否实现了需求且只实现了需求"。OpenSpec在propose阶段就检测——成本最低的发现时机。关键洞察是：**scope drift检测应该在审查代码质量之前进行**——先确认"做了正确的事"，再看"把事做对了没有"。

---

## 4. 实践方向讨论

### 4.1 Review层次：Per-task Gate vs Branch-level vs一次性

**Superpowers的立场**：per-task review gate——每个task完成后dispatch reviewer，Critical/Important必须修复后才进入下一个task。全部完成后做whole-branch final review。v6.0.0合并为单reviewer两个verdict（v6.0.0之前是两个独立reviewer），成本减半但质量不降。

**gstack的立场**：branch-level review——/ship前做一次完整审查，跨模型消除偏差。Plan Completion Audit逐项对照plan检查完成度。Scope Drift Detection在审查代码质量前先检查scope。

**mattpocock的立场**：一次性双轴审查——implement后做一次Standards + Spec双轴审查，不per-task。

**OpenSpec的立场**：两个时机——propose后读计划，apply后verify实现。人工读Markdown，不结构化。

**tradeoff分析：**

- **Per-task gate的优势**：catch issues before they compound——问题在最早被发现，修复成本最低
- **Per-task gate的代价**：每个task都dispatch subagent——成本高、时间长（尽管v6.0.0已优化为单reviewer）。Superpowers v5.0.6的教训表明，subagent review loop可能在某些场景下（如brainstorming、writing-plans）不值得——~25min开销但质量无差异
- **Branch-level的优势**：看到全局——跨task的结构性问题（重复逻辑、命名不一致）只在整体视角下可见
- **Branch-level的代价**：问题可能在多个task后才被发现——修复时可能涉及多个task的代码
- **一次性的优势**：简单、低成本
- **一次性的代价**：既没有per-task的早期发现，也没有branch-level的全局视角

**可能的好的实践方向**：Superpowers的per-task + final两层设计可能是最完整的——per-task gate保证早期发现，final review保证全局一致性。但per-task gate的成本需要权衡——v6.0.0从两个reviewer减到一个、v5.0.6用inline self-review替代subagent review loop都表明成本是真实问题。OpenSpec的"两个时机"（propose后 + apply后）是另一种分层——在代码编写前审查计划（成本最低的发现时机），在实现后验证一致性。两种分层方式可以互补。

### 4.2 Verify强制程度：Iron Law vs Mechanical Gate vs非阻断

**Superpowers的立场**：Iron Law——NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE。Rationalization表列出所有逃避验证的借口。24 failure memories来自真实案例。

**ECC的立场**：Mechanical Gate——delivery-gate用regex/mtime/disk等确定性检查，hook 100% 触发。"机械化gate检查机器可验证的事实，而非AI推理"。

**OpenSpec的立场**：非阻断——verify暴露问题但不阻断archive。"将决定权留给你"。

**tradeoff分析：**

- **Iron Law的优势**：确保每次完成声明都有fresh evidence——消除虚假完成声明
- **Iron Law的代价**：依赖agent遵守skill约束——skill的触发率约50-80%（vs hook 100%）；简单变更也要运行完整验证（可能过重）
- **Mechanical Gate的优势**：100% 触发（hook机制）——不依赖agent遵守；确定性检查不可绕过
- **Mechanical Gate的代价**：只能检查表面模式（regex匹配rationalization文本、mtime检查文件更新时间）——不检查内容质量；"强制的是touch学习库的习惯，而非记录内容的质量"
- **非阻断的优势**：最大灵活性——用户根据情况决定
- **非阻断的代价**：用户可以忽略所有警告直接archive——spec与代码可能不一致

**可能的好的实践方向**：ECC的delivery-gate和Superpowers的Iron Law是互补的——delivery-gate用机械化检查捕获"表面模式"（如rationalization文本），Iron Law用skill约束确保"每次声明都有evidence"。但两者的覆盖面不同：delivery-gate检查session hygiene（学习库、磁盘），Iron Law检查代码验证（测试运行、构建通过）。gstack的浏览器QA提供了第三种维度——看产品而非看测试。

关键问题是：**机械化检查的覆盖面太窄**（只查表面模式），**AI推理检查的触发率不够**（50-80%）。两者结合可能是最优——delivery-gate式的hook确保底线，Iron Law式的skill约束提升上限。

### 4.3 Review方式：Subagent vs人工vs跨模型

**Superpowers的立场**：dispatch read-only subagent——认知隔离，reviewer不碰working tree。controller不能告诉reviewer忽略什么。Reviewer不信任implementer的报告——"将implementer的报告视为未经证实的声明。"

**mattpocock的立场**：双轴parallel sub-agents——Standards和Spec独立运行，报告不合并。

**gstack的立场**：跨模型审查——Claude和Codex独立审查。Checklist-based——读清单按项审查。

**OpenSpec的立场**：人工读Markdown——不dispatch agent，用户自己读。

**tradeoff分析：**

- **Subagent隔离的优势**：reviewer不受controller context影响——"永远不是你的session历史"；read-only确保认知隔离
- **Subagent隔离的代价**：dispatch成本；v6.0.0教训"controller指导reviewer跳过发现"——需要显式禁止
- **双轴分离的优势**：防止一个轴遮蔽另一个——代码可以符合标准但实现错误
- **双轴分离的代价**：成本翻倍（两个sub-agent）；用户需自行综合两条报告
- **跨模型的优势**：消除模型偏差——Claude和Codex可能系统性地忽略不同类型问题
- **跨模型的代价**：需要两个AI服务——成本翻倍；依赖外部服务可用性
- **人工的优势**：零成本；人类的判断力最强
- **人工的代价**：依赖用户自律——可能跳过；不具备可扩展性

**可能的好的实践方向**：mattpocock的双轴分离和gstack的跨模型是两种正交的"分离"策略——双轴分离防止"好代码但错误实现"的遮蔽，跨模型防止"单模型盲区"的遮蔽。两者可以结合——每个轴用不同模型审查。Superpowers的"controller不能指导reviewer忽略什么"和"reviewer不信任implementer的报告"是重要的设计约束——防止认知串通。OpenSpec的"人工读Markdown"是最轻量的，但依赖用户自律——适合轻量场景。

### 4.4回归测试验证

**Superpowers**：Write → Run(pass) → Revert fix → Run(MUST FAIL) → Restore → Run(pass)——不只是写回归测试，必须验证测试在bug存在时确实失败。

**gstack**：Phase 8e.5 Regression Test——trace bug的codepath → 写测试 → 运行 → 评估（Passes → commit / Fails → fix once / >2min → skip and defer）。

**mattpocock**：TDD的red-green本身就是回归验证——先写失败测试（RED），再修复使其通过（GREEN）。diagnosing-bugs的Phase 1-6包含完整验证流程。Phase 5的correct seam检查——如果没有正确的测试缝，"这本身就是发现"。

**tradeoff分析：**

- **Superpowers的red-green回归验证**最严格——必须证明测试在bug存在时失败
- **gstack的regression test** 最实用——trace codepath后写测试，有时间限制（>2min skip）
- **mattpocock的TDD red-green** 最简洁——回归验证嵌入TDD循环，不是独立步骤

**可能的好的实践方向**：Superpowers的"Revert fix → Run(MUST FAIL)"是验证回归测试有效性的黄金标准——但可能过重。gstack的"trace codepath then test"是更实用的方法——先理解bug的数据流再写测试。mattpocock的"red-capable"标准是最低要求——回归测试必须能在bug存在时失败，否则是tautological。

---

## 5. 总结：Review & Verify节点的实践参考

> **声明：** 以下总结基于五个项目的实践经验和踩坑教训，试图提炼出一些有参考价值的结论。但这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中寻找一些相对普遍的规律，供读者参考和批判。

### 5.1总体要求

经过对五个项目的全面分析，我们认为Review & Verify节点需要满足以下总体要求：

**要求一：在声称完成之前必须有fresh evidence**

这是Superpowers Iron Law的核心——"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"。五个项目都在以不同方式做验证，但只有Superpowers将"fresh evidence before claims"提升为不可违反的铁律。虚假完成声明是AI辅助开发中最常见的失败模式——agent说"should work now"但实际上没有运行验证。

**要求二：审查者的独立性需要显式保障**

Superpowers v6.0.0的教训表明，即使dispatch了独立subagent，controller仍可能通过措辞影响reviewer。mattpocock的双轴分离和gstack的跨模型是更结构化的独立性保障。审查者的独立性不能靠默认行为保证——需要显式约束。

**要求三：Scope drift检测应该在代码质量审查之前**

gstack的Scope Drift Detection和Plan Completion Audit是最系统化的检测方法——先确认"做了正确的事"，再看"把事做对了没有"。AI倾向于"多做一点"是scope creep的来源，需要在审查流程中显式检测。

**要求四：验证的强制程度应该跟风险匹配**

OpenSpec的 "仪式感要与风险等级匹配" 和ECC的两种深度（Quick vs Full）都指向同一个方向——一刀切的验证强度要么过重（简单变更走完整验证），要么过浅（复杂变更只做快速验证）。

### 5.2应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **在声称完成前运行验证命令并读取输出** | "should work now" 不是evidence——Iron Law要求fresh verification | Superpowers（Iron Law + Gate Function） |
| **审查者read-only，不碰working tree** | reviewer运行 `git checkout` 曾导致commit被孤立——read-only防止意外破坏 | Superpowers（v6.0.0 reviewer read-only） |
| **禁止controller指导reviewer忽略发现** | controller会不自觉地coaching reviewer跳过发现——"导致缺陷被发布" | Superpowers（v6.0.0 pre-judging ban） |
| **Reviewer不信任implementer的报告** | implementer的报告是"未经证实的声明"——"陈述的理由永远不能降低finding的严重程度" | Superpowers（task-reviewer-prompt.md） |
| **将Standards和Spec分为两个独立审查** | 代码可以符合标准但实现错误——一个维度的通过不应掩盖另一个维度的失败 | mattpocock（双轴parallel sub-agents） |
| **在审查代码质量前先检测scope drift** | AI倾向于"多做一点"——scope drift是AI辅助开发的特有问题 | gstack（Scope Drift Detection + Plan Completion Audit） |
| **用机械化hook确保底线** | skill的触发率只有50-80%，hook 100% 触发——机械化检查不可绕过 | ECC（delivery-gate Stop hook） |
| **用inline self-review替代高成本的subagent review** | ~25min → ~30s，质量相当——不是所有审查都需要dispatch subagent | Superpowers（v5.0.6 inline self-review） |
| **回归测试必须验证在bug存在时确实失败** | 只运行一次就声称通过的回归测试可能是tautological | Superpowers（Revert fix → Run MUST FAIL）、mattpocock（red-capable） |
| **反馈循环要tight——快速、确定性、agent可运行** | "一个30秒的flaky循环几乎不比没有循环好；一个2秒的确定性循环才是tight的" | mattpocock（diagnosing-bugs Phase 1） |
| **提供always-on的最低检查基线** | 即使repo没有文档化标准也不会"裸奔" | mattpocock（12种Fowler smell baseline） |
| **QA fix loop设置失控检测** | agent越改越烂时需要暂停让人类介入 | gstack（WTF-likelihood > 20% 则STOP） |

### 5.3不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该让controller指导reviewer忽略什么** | controller会不自觉地coaching reviewer——"真实运行中发现controller指导reviewer跳过某个发现或称之为'最多Minor'，导致缺陷被发布" | Superpowers v6.0.0之前的教训 |
| **不应该让reviewer碰working tree** | reviewer运行 `git checkout` 曾导致后续commit被孤立 | Superpowers v6.0.0之前的教训 |
| **不应该信任implementer的自我报告** | implementer的报告可能"不完整的、不准确的或过于乐观的"——设计理由也不能降级finding的severity | Superpowers的教训 |
| **不应该用阻断迫使所有变更走完整验证** | 阻断导致用户用 `--no-validate` 完全跳过——阻断反而降低了验证覆盖率 | OpenSpec早期的教训 |
| **不应该让机械化检查承担内容质量审查** | "这个hook强制的是touch学习库的习惯，而非记录内容的质量"——机械化检查只能验证machine-verifiable facts | ECC delivery-gate的明确局限 |
| **不应该让slop scan阻断** | 某些"sloppy"模式是正确的工程选择——false positive风险 | gstack的设计（advisory only） |
| **不应该对所有变更用同一种验证深度** | 一文件typo修复不值得完整验证，auth/payments变更不能只做快速验证 | OpenSpec（Right-size review）、ECC（两种深度） |
| **不应该用与代码相同的方式计算expected values** | tautological测试永远通过但零信心——expected values必须来自独立来源 | mattpocock的anti-patterns |
| **不应该dispatch reviewer时不指定model** | unnamed model静默继承session最贵model——一次运行把26个reviewer都放在最贵tier | Superpowers v6.0.0之前的教训 |
| **不应该用粘贴传递diff给reviewer** | 粘贴的diff永久驻留在最贵的context中——controller context膨胀严重 | Superpowers v6.0.0之前的教训 |

### 5.4需要关注什么

在Review & Verify节点的实践中，以下几个方面值得持续关注：

**关注点一：审查者独立性的保障机制**

Superpowers用显式禁止（"controller不能告诉reviewer忽略什么"）、mattpocock用双轴分离、gstack用跨模型——三种策略各有优劣。显式禁止依赖agent遵守，双轴分离成本翻倍，跨模型依赖外部服务。在实践中需要根据场景选择——简单的项目可能只需要显式禁止，复杂的项目可能需要结构化分离。

**关注点二：机械化检查与AI推理的边界**

ECC的delivery-gate 100% 触发但覆盖面窄，Superpowers的Iron Law覆盖面广但触发率50-80%。两者的边界在哪里？哪些检查适合机械化（格式、类型、磁盘），哪些适合AI推理（spec compliance、架构合理性）？ECC的defense in depth（delivery-gate + verification-loop + self-evaluation + self-audit）是一种探索，但四层检查的成本是否值得？

**关注点三：浏览器QA的适用范围**

gstack的 /qa是唯一"让agent看产品"的验证方式——其他项目都是看测试。浏览器QA提供了测试无法覆盖的维度（视觉、UX、交互），但依赖Playwright/Bun二进制和真实浏览器。对于非Web项目（CLI、后端服务、库），浏览器QA不适用。需要为不同类型的项目选择不同的"最直观验证"方式。

**关注点四：回归测试的有效性验证**

Superpowers的"Revert fix → Run(MUST FAIL)"是验证回归测试有效性的黄金标准，但可能过重。gstack的"trace codepath then test"更实用。mattpocock的"red-capable"是最低要求。在实践中需要权衡——不是每个bug fix都需要Revert fix验证，但至少需要确认测试不是tautological的。

**关注点五：审查成本的持续优化**

Superpowers的版本演进（两个reviewer → 一个、subagent → inline、粘贴 → 文件、未指定model → 显式指定）展示了审查成本优化的路径。在实践中需要持续监控审查成本——如果每个task的审查时间超过实现时间，可能需要优化。inline self-review和文件传递diff是两个有效的成本优化手段。

### 5.5怎么观察效果

Review & Verify阶段的效果可以通过以下信号观察：

**正面信号（Review & Verify有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Reviewer发现了implementer遗漏的问题 | 审查机制在发挥作用 | 统计reviewer findings中Critical/Important的比例 |
| 完成声明附带验证命令输出 | Iron Law在起作用——fresh evidence before claims | 检查完成声明是否引用了具体的命令输出 |
| Scope drift在审查阶段被检测 | Scope Drift Detection有效 | 统计scope drift findings的数量和类型 |
| 回归测试在bug存在时确实失败 | 回归测试不是tautological | 运行Revert fix → Run(MUST FAIL) 验证 |
| 审查后的代码不需要大幅返工 | 审查在问题cascading前捕获了它们 | 统计审查后修改的代码行数占比 |
| QA fix loop的WTF-likelihood低 | fix loop没有失控 | 监控revert次数和touching >3 files的比例 |

**负面信号（Review & Verify有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| 完成声明使用 "should"/"probably"/"seems to" | Iron Law被违反——没有fresh evidence | 搜索完成声明中的hedge words |
| Reviewer findings全是Minor | 审查可能走过场——没有发现真正的问题 | 统计findings的severity分布 |
| 审查后仍发现Critical问题 | 审查遗漏了重要问题 | 统计审查后仍发现的Critical问题数量 |
| 用户频繁用 `--no-validate` 跳过验证 | 验证过重——阻断反而降低了覆盖率 | 统计 `--no-validate` 使用频率 |
| 回归测试永远通过 | 可能是tautological——没有验证有效性 | 运行Revert fix → Run(MUST FAIL) |
| QA fix loop的revert率高 | fix loop失控——WTF-likelihood可能超阈值 | 监控revert次数 |
| 审查时间超过实现时间 | 审查成本过高——可能需要优化 | 统计审查时间vs实现时间的比例 |

### 5.6怎么改进

Review & Verify阶段的改进可以从以下几个方向入手：

**改进方向一：建立多层审查防御**

借鉴ECC的defense in depth思路——机械化hook确保底线（格式、类型、磁盘）+ inline self-review做快速自检 + subagent review做深度审查 + 跨模型/双轴做独立性保障。不是每个变更都需要所有层——简单变更只需前两层，复杂变更需要全部。

**改进方向二：用文件传递审查输入**

Superpowers v6.0.0的 `review-package` 和 `task-brief` 脚本将diff和task text写入文件由reviewer读取——避免了粘贴diff永久驻留在最贵context的问题。这个做法值得广泛采纳——任何需要向subagent传递大量文本的场景都应该用文件而非粘贴。

**改进方向三：建立scope drift检测清单**

借鉴gstack的Scope Drift Detection和mattpocock的Spec轴——在审查代码质量前先检查"是否做了要求的事"。可以建立一个简单的scope drift检测清单：diff中的每个文件是否对应plan中的某个task？plan中的每个task是否在diff中有对应变更？有没有"while I was in there"式的无关变更？

**改进方向四：回归测试有效性验证**

不是每个bug fix都需要Superpowers的完整Revert fix → Run(MUST FAIL) → Restore → Run(pass) 流程，但至少需要mattpocock的"red-capable"标准——回归测试必须能在bug存在时失败。可以在CI中加入回归测试有效性检查——随机选择一些回归测试，临时revert对应的fix，验证测试确实失败。

**改进方向五：审查成本持续监控**

借鉴Superpowers的版本演进经验——持续监控审查成本，定期评估是否可以用inline self-review替代subagent review、是否可以合并审查维度、是否可以降低model tier。关键指标：审查时间vs实现时间比例、reviewer findings的false positive率、审查后仍发现的问题数量。

### 5.7本篇结论

Review & Verify节点的核心使命是**从实现到确认**——确保AI实现的代码确实满足需求、通过验证、没有引入新问题。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **审查者独立性需要显式保障**——Superpowers的教训表明controller会不自觉地coaching reviewer，mattpocock的双轴分离和gstack的跨模型是更结构化的保障
2. **虚假完成声明是最常见的失败模式**——Superpowers的Iron Law和ECC的delivery-gate是两种不同方向的应对——前者用skill约束提升上限，后者用hook机械化确保底线
3. **机械化检查的可靠性与覆盖面成反比**——ECC的delivery-gate 100% 触发但只查表面模式，Superpowers的Iron Law覆盖面广但触发率50-80%
4. **Scope drift是AI辅助开发的特有问题**——gstack的Plan Completion Audit和mattpocock的Spec轴是两种系统化检测方法
5. **审查成本是真实问题**——Superpowers从两个reviewer减到一个、从subagent review改为inline self-review，每一步都是对真实成本的回应

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用Review & Verify节点时参考。后续章节将逐个节点展开类似的讨论。

---
