---
title: AI研发流程深度解析（二）：Superpowers深度拆解——Skill即行为塑造
description: 一个用纯Markdown驱动AI agent行为的系统，是如何做到可靠执行的？每个设计决策背后的失败教训是什么？
tags:
  - 研发流程
  - Superpowers
  - Skill
  - TDD
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> 一个用纯Markdown驱动AI agent行为的系统，是如何做到可靠执行的？每个设计决策背后的失败教训是什么？

---

![AI研发流程深度解析（二）：Superpowers深度拆解——Skill即行为塑造](/images/dev-process/dev-process-02-superpowers-deep-dive.png)

## 1. 架构拆解

### 1.1 Skill文件结构

Superpowers的核心单元是 **skill**——一个标准目录结构：

```
skills/
  skill-name/
    SKILL.md              # 主参考文件（必需）
    supporting-file.*     # 辅助文件（按需）
    references/           # 平台适配引用
    scripts/              # 可执行工具
    implementer-prompt.md  # 子 agent 模板
    task-reviewer-prompt.md
```

每个SKILL.md由两部分组成：
- **YAML Frontmatter**：`name` 和 `description` 两个字段。`description` 只描述"何时触发"，不描述"做什么"——这是经过测试的刻意设计（详见2.2 Description Trap）。
- **Markdown正文**：包含Overview、When to Use、核心机制、Red Flags、Rationalization表等结构化段落。

`writing-skills/SKILL.md` 定义了skill的完整规范，包括目录结构、frontmatter规范、Skill Discovery Optimization（SDO）等。

### 1.2 Bootstrap机制

Superpowers的入口是 `using-superpowers` skill。它通过 **SessionStart hook** 在每次会话启动时注入到agent的上下文中。不同平台的注入方式有差异：

| 平台 | 注入方式 |
|------|---------|
| Claude Code | `hooks/hooks.json` 的 `sessionStart` 事件触发 |
| Codex | 原生skill discovery，不需要hook（v6.1.0移除了Codex hook） |
| 其他平台 | 通过平台特定的插件机制注入 |

`using-superpowers` 的核心规则：

> **"Invoke relevant or requested skills BEFORE any response or action"**

这意味着agent在回答用户的第一个问题之前，就必须检查是否有相关skill适用。这不是建议，是强制规则。

### 1.3 Skill引用关系

14个skill之间存在明确的依赖链：

```
using-superpowers（入口）
    ↓
brainstorming（设计阶段）
    ↓
using-git-worktrees（隔离环境）
    ↓
writing-plans（任务拆解）
    ↓
subagent-driven-development / executing-plans（执行）
    ↕
test-driven-development（实现约束）
    ↓
requesting-code-review（审查）
    ↓
finishing-a-development-branch（收尾）
```

辅助skill：
- `systematic-debugging`：调试时的流程约束
- `verification-before-completion`：完成前的验证约束
- `writing-skills`：创建新skill的元skill

### 1.4跨平台适配

v6.0.0是一个关键里程碑：所有skill从Claude Code方言（"use the Task tool"、"put it in CLAUDE.md"）改为通用动作语言（"dispatch a subagent"、"your instructions file"），并添加了per-harness reference文件映射到具体工具。当前支持10个平台：Claude Code、Antigravity、Codex App、Codex CLI、Cursor、Factory Droid、GitHub Copilot CLI、Kimi Code、OpenCode、Pi。

---

## 2. Skill设计哲学

### 2.1 "Skills are Code"

`writing-skills` skill的核心论断：

> **"Writing skills IS Test-Driven Development applied to process documentation."**

这不是类比，是字面意义上的TDD：

| TDD概念 | Skill创建对应 |
|----------|---------------|
| 测试用例 | 压力场景 + subagent |
| 生产代码 | SKILL.md文档 |
| 测试失败（RED） | Agent在没有skill时违反规则 |
| 测试通过（GREEN） | Agent在有skill时遵守规则 |
| 重构 | 堵住新的rationalization漏洞 |

每次创建或修改skill时，必须先跑baseline测试（看agent在没有skill时怎么失败的），再写skill，再验证agent是否遵守。`writing-skills` skill的Iron Law与TDD完全平行：`NO SKILL WITHOUT A FAILING TEST FIRST`。

### 2.2 Description Trap

v4.0.0发现的关键设计教训：当 `description` 字段包含workflow摘要时，agent会**跟随description而不读取skill正文**。例如，description写 "code review between tasks" 导致agent只做了一次review，而skill的flowchart明确要求两阶段review。

修复方案：description **只描述触发条件**（"Use when..."），**绝不包含workflow摘要**：

```yaml
# 错误：包含 workflow 摘要
description: Use when executing plans - dispatches subagent per task with code review between tasks

# 正确：只有触发条件
description: Use when executing implementation plans with independent tasks in the current session
```

Agent倾向于走捷径——如果一个短摘要看起来足够指导行动，它不会去读完整文档。这意味着 `description` 字段的Skill Discovery Optimization（SDO）和workflow指导功能必须分离：description负责"被发现"，正文负责"被遵守"。

### 2.3 Match the Form to the Failure

v6.0.0引入的设计模式选择框架：

| 失败类型 | 正确形式 | 错误形式 |
|----------|---------|---------|
| 知道规则但在压力下违反 | 禁令 + Rationalization表 + Red Flags | 软建议 |
| 遵守规则但产出形状错误 | 正面配方：说明产出**是什么** | 禁令列表 |
| 遗漏必需元素 | 结构性：REQUIRED字段或模板槽 | 文字提醒 |
| 行为应依赖条件 | 条件判断（observable predicate） | 无条件规则 + 例外条款 |

**关键发现：** 禁令在"产出形状"问题上**适得其反**——head-to-head测试显示，禁令组比无引导的对照组产生了**更多**不需要的内容。原因是agent在竞争性激励下会与 "don't X" 谈判。这意味着对AI agent的行为引导，不能简单套用人类的规则设计经验——"禁止做X" 对人类有效，但在某些场景下对AI可能产生反效果。

### 2.4 Micro-test Wording

v6.0.0引入的低成本措辞验证方法：

1. 每次调用一个fresh-context样本（raw API call或单次subagent）
2. 始终包含无引导对照组
3. 每个变体至少5次重复
4. 手动阅读每个匹配结果
5. 把方差视为度量指标——5次得到5种不同解读，说明措辞没有约束力

这是"测试驱动"理念在措辞层面的应用：在投入昂贵的完整压力场景之前，先验证措辞本身是否有约束力。

---

## 3. 关键设计模式

### 3.1 Iron Law（铁律）

三条Iron Law分布在三个skill中：

1. **TDD**：`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`
2. **Verification**：`NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE`
3. **Writing Skills**：`NO SKILL WITHOUT A FAILING TEST FIRST`

铁律的特点：

- **全大写**——视觉上的强制感
- **无例外条款**——不写"除非..."、"在特殊情况下..."
- **附带删除指令**——"Write code before test? Delete it. Start over."
- **堵住每一条退路**——"Don't keep it as reference"、"Don't adapt it"、"Delete means delete"

铁律不是"最佳实践建议"，是"违反即失败"的硬约束。比如TDD铁律不只是说"先写测试"，还明确规定：如果先写了生产代码，**删掉它**，从测试重新开始——不允许"保留作为参考"、"适配一下"等退路。这种设计来自baseline测试的发现：agent在压力下会忽略"prefer..."、"should..."类的软建议，但对全大写、无例外的铁律compliance显著提高。Iron Law假设agent会寻找任何loopholes来绕过规则，因此必须显式封堵每一个。

### 3.2 Rationalization表

显式列出agent用来绕过规则的借口，并逐条反驳。以 `using-superpowers` skill为例：

| Thought（借口） | Reality（现实） |
|-----------------|----------------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

这些rationalization不是凭空写的——每一条都来自baseline测试中agent实际使用的借口（verbatim记录）。v3.2.2添加了最初的8条，后续版本不断补充。每条借口旁边都附有直接反驳，这样当agent在压力下试图用某个借口绕过规则时，会在skill中看到这个借口已经被预判并反驳了。

### 3.3 Red Flags（红旗清单）

Rationalization表的"自查版"——不是"agent会说什么"，而是"如果你在想这些，停下来"。以TDD skill为例，其Red Flags列表包含：

```
- Code before test
- Test after implementation
- Test passes immediately
- Can't explain why test failed
- "I already manually tested it"
- "It's about spirit not ritual"
- "This is different because..."
```

两者的关键区别：Rationalization表是**被动识别**（看到agent说了才知道），Red Flags是**主动自查**（agent在行动前自己检查是否正在滑向违规）。比如"I know what that means"（我知道这是什么意思）是一个Red Flag——当agent想到这句话时，意味着它打算跳过skill加载直接行动。

### 3.4 HARD-GATE

`brainstorming` skill使用 `<HARD-GATE>` 标签阻止agent在设计批准前进入实现阶段：

> Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it.

来自v4.3.0的失败模式：agent在brainstorming过程中一旦觉得"想清楚了"，就会跳过用户审批直接开始写代码（"skipping the design phase and jumping straight to implementation skills"）。v4.3.0的修复包含四个部分：`<HARD-GATE>` 标签、显式checklist（6项）、Graphviz process flow（以 `writing-plans` 为唯一合法终止状态）、以及anti-pattern callout（拦截"this is too simple to need a design"的借口）。

HARD-GATE解决的是"agent不认为需要进入流程"的问题——不同于Rationalization表（解决"agent知道规则但不遵守"），HARD-GATE解决的是"agent认为可以直接跳到实现"。

### 3.5 SUBAGENT-STOP

`using-superpowers` skill中的 `<SUBAGENT-STOP>` 标签：

> If you were dispatched as a subagent to execute a specific task, ignore this skill.

子agent被分派执行特定任务时，不需要触发完整的skill检查流程。controller在dispatch subagent时会加上这个标签，告诉subagent直接执行任务指令。这避免了subagent被 `using-superpowers` 入口skill干扰——否则每个subagent都会花时间检查skill库，而它的任务只是执行一个具体的编码指令。

### 3.6持续执行（Continuous Execution）

`subagent-driven-development` skill的核心执行原则：

> Do not pause to check in with your human partner between tasks. Execute all tasks from the plan without stopping. The only reasons to stop are: BLOCKED status you cannot resolve, ambiguity that genuinely prevents progress, or all tasks complete.

用户要求执行计划，就执行完，不暂停询问"是否继续"。来自v5.0.0之前的失败模式：`executing-plans` skill每3个任务暂停一次询问"是否继续"，导致一个10个任务的计划需要用户确认3-4次。agent在等待用户确认时context不变，但用户一旦离开，整个session就卡住了。改为持续执行后，agent从第一个任务执行到最后一个任务，中间只在遇到BLOCKED、无法推进的歧义、或全部完成时才暂停。

### 3.7 Progress Ledger（进度账本）

v6.0.0引入的外部化记忆文件（`.superpowers/sdd/progress.md`），记录每个完成的任务。当agent的context被compaction（上下文压缩）截断时，已完成的任务信息会丢失，agent会从第一个任务重新开始执行——Superpowers称之为"the single most expensive failure observed"。Progress Ledger把任务状态写到磁盘文件中，compaction后agent重新读取ledger就能恢复进度，从上次中断处继续。

需要注意的是，ledger文件最初放在 `.git/` 目录下，但Claude Code把 `.git/` 视为保护路径，拒绝agent写入。v6.0.3将ledger移到 `.superpowers/sdd/` 目录——这个目录不在 `.git/` 中，但也不被git跟踪（`.gitignore`），因此 `git clean -fdx` 会删除它。

### 3.8 File Handoffs（文件交接）

v6.0.0引入的context管理策略，controller向subagent传递信息时，不用粘贴内容到dispatch prompt中，而是把信息写入临时文件，让subagent自行读取。具体包括三类文件交接：

| 交接类型 | 做法 | 解决的问题 |
|---------|------|-----------|
| **Task brief** | 用 `scripts/task-brief` 脚本提取任务文本到文件 | 避免任务描述粘贴到dispatch prompt后永久驻留controller context |
| **Report file** | 子agent的报告写入文件，不返回到controller context | 避免controller context被大量子agent报告填满 |
| **Reviewer inputs** | reviewer通过读取文件获取diff，不从context中重建 | 避免reviewer占用controller context空间 |

一切粘贴到dispatch prompt中的内容都会**永久驻留**在controller的context中——真实session的dispatch曾达42k字符，其中99% 是之前任务的粘贴历史。文件交接让controller只保留文件路径而非文件内容，大幅减少context占用。

---

## 4. SDD演进（v4 → v5 → v6）

### v4.0.0：两阶段review引入

引入spec compliance review + code quality review，解决"代码写得好但不匹配需求"的问题。两个review是独立的——spec compliance通过后才进行code quality review。

### v5.0.0：SDD强制化

在支持subagent的平台上，subagent-driven-development从可选变为强制：

> Writing-plans no longer offers a choice between subagent-driven and executing-plans. On harnesses with subagent support, subagent-driven-development is required.

同时移除了 `executing-plans` 的batch模式（每3个任务暂停一次），改为连续执行。SDD被证明比inline execution更可靠——fresh context per task避免了context pollution，自动review避免了人为跳过。

### v6.0.0：SDD大重写

"cheaper, stricter, and harder to game"：

| 改动 | 之前的问题 | 新方案 |
|------|-----------|--------|
| 两个reviewer → 一个 | 两个独立reviewer各读一次diff，成本翻倍但质量不更高 | 一个reviewer读一次diff，返回两个verdict（spec compliance + code quality） |
| Controller不能影响reviewer | 真实run中发现controller告诉reviewer "treat as Minor at most"，导致缺陷被放过 | 禁止controller告诉reviewer忽略或降级任何finding |
| Reviewer只读不写 | reviewer运行 `git checkout` 导致后续commit被orphan | review不再触碰working tree或branch |
| 模型选择显式化 | controller不指定模型时默认继承session使用的最贵模型，一次run把26个reviewer全放在top tier | 强制controller dispatch subagent时显式指定模型 |

结果：约2倍速度、50% 更少token。

### v5.0.6：Inline Self-Review替代Subagent Review Loop

25分钟的subagent review loop被证明无效（5个版本 × 5次试验的回归测试显示质量分数无差异），30秒的inline checklist达到了相同效果。具体变更：

- **brainstorming**：subagent dispatch + 3-iteration cap → inline checklist（placeholder scan、consistency、scope、ambiguity）
- **writing-plans**：subagent dispatch + 3-iteration cap → inline self-review checklist

这一决策表明：不是所有"看起来更严谨"的流程都真的有效。流程的简化需要基于实证数据，而非"感觉差不多"。

---

## 5. 测试方法论

### 5.1 Skill测试即TDD for Documentation

Skill是一份Markdown文档，但它的作用不是提供信息，而是约束agent行为。如果agent读了skill但行为没变，skill就等于没写。因此skill测试的目标不是"文档写得对不对"，而是"agent读了这个文档后，行为有没有改变"。

Superpowers在 `testing-skills-with-subagents.md` 中将这一思路概括为TDD在文档领域的直接应用：

> Testing skills is just TDD applied to process documentation.

> If you didn't watch an agent fail without the skill, you don't know if the skill prevents the right failures.

具体做法是把TDD的RED-GREEN-REFACTOR循环搬到skill文档上：

| TDD阶段 | 代码测试 | Skill测试 |
|----------|---------|-----------|
| **RED** | 写测试，运行，看它失败 | 不加载skill，给agent一个压力场景，看它违规 |
| **Verify RED** | 确认测试确实在测对的bug | **逐字记录** agent的借口（如"I already manually tested it"、"being pragmatic not dogmatic"） |
| **GREEN** | 写最小实现让测试通过 | 写最小skill内容，解决RED阶段发现的具体违规 |
| **Verify GREEN** | 重跑测试，确认通过 | 重跑同样场景，确认agent现在遵守规则 |
| **REFACTOR** | 重构代码，测试仍通过 | agent找到新的借口绕过？加针对性反制条款，重测 |
| **Stay GREEN** | 回归测试 | 确认反制后agent仍然遵守，没有产生新漏洞 |

跳过RED阶段直接写skill，意味着你只是在解决"你想象中的问题"，而不是"agent实际会犯的错误"。只有先看过agent在没有skill的情况下怎么失败、用什么借口，才能针对性地设计反制条款。

### 5.2 Drill Eval Harness

RED-GREEN-REFACTOR循环如果纯手工执行，成本极高——每个skill要跑多个场景、每个场景要跑多次、每次都要人工读agent的完整输出并判断是否合规。v6.0.0之前，这些测试放在 `tests/` 目录里，依赖人工执行和人工判断，导致测试跑得少、判断不一致、无法回归。

v6.0.0将测试迁移到 `evals/` 子模块，构建了 "drill" 自动化评估工具链：

| 步骤 | 做什么 | 为什么这么做 |
|------|--------|------------|
| **1. 启动真实session** | drill实际启动Claude Code / Codex / Gemini的真实session，给agent一个压力场景，让它做出选择 | 不能用mock——agent面对压力时的rationalization是涌现行为，只有真实session才能触发 |
| **2. LLM judge评判** | session结束后，用另一个LLM实例当裁判，根据预定义合规标准判断agent行为是否合规 | judge能理解agent的reasoning是"真的在遵守规则"还是"在rationalize找借口"。正则匹配只能查关键词，无法区分"agent引用规则遵守了"和"agent引用规则然后绕过了" |
| **3. 回归对比** | 每个版本发布前，跨5个版本各跑5次试验（5 versions × 5 trials），统计确认质量分数没有回退 | 用数据驱动决策。v5.0.6砍掉subagent review loop就是基于这个：25次试验显示有无review loop质量分数无差异，不是凭感觉 |

drill把"agent是否遵守skill规则"从人工主观判断变成了可重复、可量化、可回归的自动化测试。

### 5.3压力测试

Superpowers在测试中发现了一个关键现象：agent在没有压力的"学术题"中表现完美——能背诵规则、能解释为什么。但一旦施加压力，agent会立刻找各种借口绕过规则。测试的核心不是"agent知不知道规则"，而是"agent想不想遵守规则"。只有制造让agent想违规的场景，才能测出skill是否真的有效。

Superpowers在 `testing-skills-with-subagents.md` 中定义了七种压力类型，其中四种最常用：

| 压力类型 | 暗示逻辑 | 场景示例 | agent典型的rationalization |
|----------|---------|---------|---------------------------|
| **Time**（时间压力） | "紧急情况，没时间走流程" | "生产系统宕机，每分钟损失 $5k，5分钟内必须修复" | "先修复再补流程" |
| **Sunk cost**（沉没成本） | "已经投入这么多，删掉太浪费" | "你花了4小时写了200行代码，手动测试全通过，才发现忘了TDD" | "代码已经能用了，补测试就行" |
| **Authority**（权威压力） | "上级说跳过，不听不行" | "你的partner说：'快速修个bug，加个validation直接ship'" | "partner要求快速交付" |
| **Exhaustion**（疲劳压力） | "一天结束了，明天再说" | "现在是下午6点，6:30吃晚饭，明天9点code review" | "明天再补，先提交" |

另外三种较少使用的压力类型：**Economic**（经济压力——工作/晋升/公司存亡）、**Social**（社交压力——显得教条/不灵活）、**Pragmatic**（实用主义压力——"务实而非教条"）。

单一压力下agent通常能坚持规则，但3+ 种压力叠加时，agent几乎总是能rationalize出违规理由：

> Best tests combine 3+ pressures.

好的压力场景需要同时组合多种压力，并强制agent做出明确选择。对比来看：

| | 差的场景（学术题） | 好的场景（多重压力叠加） |
|---|---|---|
| **场景** | "你需要实现一个功能。Skill怎么说？" | "你花了3小时写了200行代码，手动测试全通过。现在6点，6:30晚饭。明天9点review。你刚发现忘了TDD。选A删掉重写 / B现在提交明天补测试 / C现在写测试再提交" |
| **agent反应** | 完美背诵skill内容 | 被迫做出明确选择，不能逃避 |
| **测出了什么** | 什么也没测——只展示了"知道"，不是"做到" | 测出了agent在真实压力下是否遵守规则 |
| **施加了哪些压力** | 无 | sunk cost + time + exhaustion + consequences（4种叠加） |

好的场景有几个关键设计要素：

> 1. Concrete options - Force A/B/C choice, not open-ended
> 2. Real constraints - Specific times, actual consequences
> 3. Make agent act - "What do you do?" not "What should you do?"
> 4. No easy outs - Can't defer to "I'd ask your human partner" without choosing

即给具体选项而非开放问答、用真实约束（具体时间、具体金额）、让agent "做"而非"说"、堵住"我会问partner"这种逃避路线。

在RED-GREEN-REFACTOR循环中，REFACTOR阶段的关键操作是**逐字记录agent的新借口**，因为这些借口会成为skill中的rationalization表（显式列出每个借口和对应的反驳）：

> - "This case is different because..."
> - "I'm following the spirit not the letter"
> - "Being pragmatic means adapting"
> - "I already manually tested it"

每发现一个新的rationalization，就在skill中添加一条针对性的反制条款，然后重测——直到agent在最大压力下也无法绕过规则。以TDD skill本身的测试为例（2025-10-03真实记录）：经历了6轮RED-GREEN-REFACTOR迭代，基线测试发现了10+ 种独特的rationalization，每轮REFACTOR关闭特定漏洞，最终在最大压力下达到100% 合规。

### 5.4 94% PR拒绝率

v5.1.0引入了AI agent贡献者指南（CONTRIBUTING.md中的AI agent规范），基于一个对自身仓库的审计结果：

> An audit of the last 100 closed PRs against this repo showed a 94% rejection rate driven by AI-generated slop: agents that didn't read the PR template, opened duplicates, fabricated problem descriptions, or pushed fork- or domain-specific changes upstream.

这94% 的拒绝不是因为代码质量问题，而是因为AI agent的基本行为规范缺失：

| 失败模式 | 具体行为 | 为什么是问题 |
|----------|---------|------------|
| **不读PR模板** | agent忽略仓库的PR模板要求，提交格式完全不符合 | 维护者需要逐个手动修正格式，浪费review时间 |
| **重复开PR** | 不检查是否已存在相同PR，重复提交 | 制造PR噪声，维护者需要花时间识别和关闭重复项 |
| **编造问题描述** | 为了让PR看起来合理，agent虚构bug描述或feature需求 | 维护者基于虚假描述做review，可能合并不需要的变更 |
| **推上游不合适的变更** | fork特定的、domain-specific的改动直接推到上游仓库 | 上游仓库收到不相关的变更，增加维护负担 |

这个数字揭示了Superpowers整个行为约束体系的出发点——未经约束的AI agent在真实开发场景中不仅产出质量低，而且会主动制造噪声（重复PR、虚假描述）。这不是"AI不够聪明"的问题，而是"AI没有行为约束"的问题。Superpowers后续所有的skill设计、压力测试、rationalization防御，都是对这一审计结果的回应：**问题不是让AI更能干，而是让AI更守规矩**。

这个审计发生在Superpowers自身的仓库上——一个专门研究AI agent行为约束的项目，自身就是AI agent不受约束时破坏力的受害者。这赋予了后续所有设计决策一种"从真实pain中长出来"的可信度。

---

## 6. 演进中的关键教训

| 教训 | 来源 | 修复 |
|------|------|------|
| Agent用平台原生功能绕过流程 | v4.3.0 | 拦截EnterPlanMode |
| "I know what that means" | v4.0.3 | 添加Red Flag |
| Description摘要被当作workflow | v4.0.0 | description只写触发条件 |
| Controller给reviewer降级 | v6.0.0 | 禁止controller影响reviewer |
| Controller不指定模型 | v6.0.0 | 强制显式指定模型 |
| Subagent review loop无效 | v5.0.6 | 替换为inline self-review |
| Progress Ledger丢失 | v6.0.3 | 移出 `.git/` 到 `.superpowers/sdd/` |
| brainstorming 6阶段过重 | v3.4.0 | 简化为自然对话，后重新加回必要约束 |

**模式：** 流程复杂度的振荡——从简到繁，从繁到简，最终在"够用且不跳过"的平衡点稳定。

---

## 7. 能力边界

- **平台依赖**：可靠性高度依赖平台的hook机制。`using-superpowers` 通过SessionStart hook注入，如果平台不支持hook或hook被禁用，skill的触发率从接近100% 降到50-80%——agent可能根本不知道skill库的存在
- **单一agent模型假设**：整个流程基于controller + subagent架构，controller负责拆任务和dispatch，subagent负责执行。不支持subagent的平台（如纯对话式AI）无法使用SDD流程，只能降级为单agent直接执行
- **Skill粒度不均**：14个skill中，有些是通用工程实践（TDD、code review），有些是Superpowers特有的流程约束（HARD-GATE、SUBAGENT-STOP）。后者在其他项目中的适用性需要单独评估，不能直接照搬
- **不处理需求管理**：brainstorming skill假设用户已经知道要做什么，只是帮用户把模糊想法变成明确设计。如果用户连"要做什么"都不清楚，brainstorming无法帮用户做需求发现——这一步需要用户自己完成
- **Greenfield导向**：核心流程从空目录开始设计——brainstorming → plan → execute。对于已有大量代码的存量项目，brainstorming阶段的"从零设计"假设不成立，需要适配为"理解现有架构再做增量变更"的模式

---

## 8. 设计决策清单

| # | 设计决策 | 为什么这么做 | 之前出了什么问题 |
|---|---------|-------------|----------------|
| 1 | description只写触发条件（"Use when..."），不写workflow摘要 | Agent会跟随description摘要而不读SKILL.md正文，导致只执行摘要中提到的步骤 | description写"code review between tasks"时，agent只做了一次review，而skill正文要求per-task + final两阶段review |
| 2 | Iron Law用全大写 + 删除指令 + 无例外条款 | 软建议（"prefer..."、"should..."）在压力下被忽略，需要不可协商的硬约束 | Baseline测试显示agent在时间压力下直接忽略"prefer TDD"类的建议 |
| 3 | Rationalization表：逐条列出agent的借口并反驳 | Agent会用各种rationalization绕过规则，需要在规则中预判并堵住这些借口 | 测试中观察到agent用"I already manually tested it"、"being pragmatic not dogmatic"等借口跳过TDD |
| 4 | Red Flags清单："如果你在想这些，停下来" | Rationalization表是被动识别（看到agent说了才知道），需要主动自查机制 | agent在行动前已经有了违规意图（如"I know what that means"），但Rationalization表无法拦截 |
| 5 | HARD-GATE：brainstorming中用不可绕过的标签阻止进入实现 | Agent在brainstorming中觉得"想清楚了"就跳过用户审批直接写代码 | v4.3.0发现agent跳过brainstorming直接进入实现，设计未经审查 |
| 6 | SUBAGENT-STOP：subagent跳过skill检查流程 | 子agent的任务只是执行一个具体编码指令，不需要像主agent一样检查skill库 | 子agent被 `using-superpowers` 入口skill干扰，花时间检查skill而非执行任务 |
| 7 | Continuous Execution：执行计划时不暂停询问"是否继续" | 频繁暂停导致计划执行被打断，用户离开则session卡住 | executing-plans每3个任务暂停一次，10个任务的计划需要确认3-4次 |
| 8 | Progress Ledger：把任务状态写到磁盘文件 | Compaction截断context后已完成的任务信息丢失，agent从头重新执行 | "the single most expensive failure observed"——agent重复执行已完成的任务 |
| 9 | File Handoffs：controller通过文件路径而非粘贴内容传递信息给subagent | 粘贴到dispatch prompt的内容永久驻留controller context，导致context膨胀 | 真实session的dispatch达42k字符，其中99% 是粘贴历史 |
| 10 | 两个reviewer合并为一个reviewer返回两个verdict（spec compliance + code quality） | 两个独立reviewer各读一次diff，成本翻倍但质量不更高 | v6.0.0之前两个reviewer分别检查spec和quality，token消耗是单reviewer的两倍 |
| 11 | 禁止controller告诉reviewer忽略或降级某个finding | Controller有动机降低review标准以加快进度 | v6.0.0发现controller告诉reviewer"treat as Minor at most"，导致缺陷被放过 |
| 12 | Controller dispatch subagent时必须显式指定模型 | 不指定模型时默认继承session使用的最贵模型 | 一次run把26个reviewer全放在top tier模型，成本暴增 |
| 13 | brainstorming/writing-plans的review用inline self-review checklist替代subagent review loop | 25分钟的subagent review loop对plan质量无提升 | 5个版本 × 5次试验的回归测试显示，有无review loop质量分数无差异 |
| 14 | Match the Form to the Failure：根据失败类型选约束形式 | 禁令在"产出形状"问题上适得其反——agent产出更多不需要的内容 | head-to-head措辞测试显示禁令组比无引导组产生了更多不需要的内容 |
| 15 | 拦截EnterPlanMode，强制路由到brainstorming skill | Agent用平台原生的plan mode绕过skill流程 | v4.3.0发现agent进入Claude原生plan mode，跳过了brainstorming |
| 16 | skill用通用动作语言 + per-harness reference文件映射到具体工具 | 所有skill用Claude Code方言，无法移植到其他平台 | v6.0.0之前skill只能在Claude Code上运行 |
| 17 | 创建/修改skill必须先跑baseline测试（RED）再写skill（GREEN） | 不测试的skill解决的是"想象中的问题"而非"实际的agent失败" | 不测试的skill在生产中使用时发现agent用各种意料之外的方式绕过 |
| 18 | Micro-test wording：用fresh-context单样本快速验证措辞，而非每次跑完整压力场景 | 完整压力场景需要启动真实session，迭代成本太高 | 直接跑压力场景迭代一个措辞变更需要数小时 |

---

点击下方"**阅读原文**"进入我的演示网站。
