---
title: AI 研发流程深度解析（五）：mattpocock-skills 深度拆解——小而可组合的工程师技能
description: 一个明确"不拥有流程"的 skill 集合，如何在保持小巧可组合的同时提供工程基础？它的需求澄清方法论有什么独特之处？
tags:
  - 研发流程
  - mattpocock
  - 可组合
  - 工程实践
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 一个明确"不拥有流程"的 skill 集合，如何在保持小巧可组合的同时提供工程基础？它的需求澄清方法论有什么独特之处？

---

## 1. 架构拆解

### 1.1 Skill 分类体系

mattpocock-skills 的自我定位是 **"Skills For Real Engineers — my agent skills that I use every day to do real engineering - not vibe coding"**（`README.md`）。这个定位的核心信号是：这是一个个人实践工具集，不是企业框架。它由 Matt Pocock（TypeScript 教育者、Total TypeScript 作者）以个人身份维护，每个 skill 都经过日常工程实践验证。

仓库结构（`CLAUDE.md`）：

```
mattpocock-skills/
├── skills/
│   ├── engineering/      # 日常代码工作（promoted）
│   ├── productivity/     # 日常非代码工具（promoted）
│   ├── misc/             # 保留但少用（不 promoted）
│   ├── personal/         # 个人专用（不 promoted）
│   ├── in-progress/      # 草稿（不 promoted）
│   └── deprecated/       # 已弃用
├── docs/                 # 每个 promoted skill 对应一个人面文档页
├── scripts/              # link-skills.sh, list-skills.sh
└── .claude-plugin/       # plugin manifest
```

**设计考虑：** promoted（`engineering/` + `productivity/`）与非 promoted 的分界线很清晰——只有 promoted skill 才出现在 `README.md`、`.claude-plugin/plugin.json` 和 `docs/` 中。这意味着用户看到的只是"成熟"的 skill，in-progress 和 deprecated 的不会造成噪音。`CLAUDE.md` 明确维护规则：添加、重命名或行为变更时需要同步 README、plugin.json 和 docs 页面。

**取舍：** promoted/non-promoted 的分界让仓库同时充当"发布渠道"和"实验场"——好处是个人迭代和公开发布在同一个仓库，代价是仓库结构比纯发布仓库复杂。

### 1.2 User-invoked vs Model-invoked

这是 mattpocock-skills 最核心的架构决策之一。它决定了 skill 的触发方式、context load 和在流程中的角色。

README 明确指出：

> "These split on one axis — **who can invoke them**. **User-invoked** skills are reachable only when you type them (e.g. `/grill-me`); their job is to orchestrate. **Model-invoked** skills can be invoked by you *or* reached for automatically by the agent when the task fits; they hold the reusable discipline. A user-invoked skill may invoke model-invoked skills, but never another user-invoked one."

技术实现上，这个区分通过 frontmatter 中的 `disable-model-invocation: true` 标志控制（`CLAUDE.md`）。

**User-invoked skill frontmatter 示例：**
```yaml
---
disable-model-invocation: true
---
# grill-with-docs

Run a `/grilling` session, using the `/domain-modeling` skill.
```

**Model-invoked skill frontmatter 示例：**
```yaml
---
# grilling

When the user needs to clarify a vague idea, refine a design, or work through 
decisions before implementing. Trigger phrases: "grill me", "help me think through",
"I'm not sure about", "what should I do about"...
---
```

- **User-invoked skill**：设置 `disable-model-invocation: true`，agent 无法自动触发，只有用户输入 `/skill-name` 才能调用。description 变成人面摘要（不含触发短语）。
- **Model-invoked skill**：不设 `disable-model-invocation`，agent 可以通过 description 自动匹配触发，用户也可以手动调用。description 是机器可读的触发器，包含丰富的触发短语。

`writing-great-skills/SKILL.md` 和 `writing-great-skills/GLOSSARY.md` 将这个决策的理论基础阐述得非常透彻。

**两种负荷的权衡：**

| 负荷类型 | User-invoked | Model-invoked |
|---------|-------------|---------------|
| **Context Load** | 零（description 不注入 context） | 每轮对话都占用 context window |
| **Cognitive Load** | 高（用户需要记住 skill 的存在） | 零（agent 自动匹配触发） |
| **触发可靠性** | 100%（用户显式调用） | 50-80%（依赖 AI 判断） |

**选择标准**："Pick model-invocation only when the agent must reach the skill on its own, or another skill must reach it. If it only ever fires by hand, make it user-invoked and pay no context load."

**当前 skill 分类：**

| 类型 | User-invoked | Model-invoked |
|------|-------------|---------------|
| **Engineering** | ask-matt, grill-with-docs, triage, improve-codebase-architecture, setup-matt-pocock-skills, to-spec, to-tickets, implement, wayfinder | prototype, diagnosing-bugs, research, tdd, domain-modeling, codebase-design, code-review |
| **Productivity** | grill-me, handoff, teach, writing-great-skills | grilling |

**设计考虑：** 分类逻辑非常清晰——编排类 skill（orchestrator）是 user-invoked，可复用的纪律性 skill（discipline）是 model-invoked。这种二分法将"人控制流程入口，agent 自动执行纪律"的意图编码进了技术架构。

```
用户输入 /implement（user-invoked）
    │
    ├── 内部驱动 /tdd（model-invoked）
    │   └── red → green → seam
    │
    └── 内部驱动 /code-review（model-invoked）
        ├── Standards sub-agent
        └── Spec sub-agent
```

例如 `/implement` 是 user-invoked（用户决定何时开始实现），但它内部驱动的 `/tdd` 和 `/code-review` 是 model-invoked（implement 或其他 skill 可以自动调用它们）。user-invoked skill 可以调用 model-invoked skill，但永远不能调用另一个 user-invoked skill——这是架构的硬约束。

**取舍：** 这种二分法将"人控制流程入口，agent 自动执行纪律"的意图编码进了技术架构。代价是当 user-invoked skill 数量增多时，用户面临 cognitive load——`ask-matt` router skill 就是为解决这个问题而引入的（见 1.3）。

### 1.3 ask-matt Router Skill

`ask-matt` 是 v1.0.0 引入的 **router skill**——一个 user-invoked skill，它的工作是指向其他 user-invoked skill（`ask-matt/SKILL.md`）。

`writing-great-skills/GLOSSARY.md` 定义了 router skill 的本质：

> "A **router skill** is a user-invoked skill whose job is to point at your other user-invoked skills — naming each and when to reach for it — so the human has one skill to remember instead of many. It can only hint, never fire them: user-invoked skills have no description, so nothing but the human can reach them. The cure for **cognitive load** when user-invoked skills multiply."

`ask-matt` 将所有 skill 组织为一个 **main flow**（idea → ship）加两个 **on-ramps**（bugs/triage 和 foggy/huge/wayfinder），以及若干 standalone skill。它定义了"main flow"的路径：

```
Main Flow（idea → ship）:

/grill-with-docs ──→ /to-spec ──→ /to-tickets ──→ /implement
     │                  │              │              │
     │                  │              │              ├── /tdd (model-invoked)
     │                  │              │              └── /code-review (model-invoked)
     │                  │              │
     │                  │              └── tracer-bullet tickets (垂直切片)
     │                  │
     │                  └── PRD/spec 文档
     │
     └── grilling + domain-modeling → CONTEXT.md

On-ramps:
  - bugs/triage → /triage → /implement
  - foggy/huge → /wayfinder → (tickets → /implement)

Optional branch:
  /grill-with-docs → /prototype → /to-spec → ...
```

还有一个 **context hygiene** 规则：步骤 1-3 保持在一个不中断的 context window 中，直到 `/to-tickets` 完成后才清理。这基于 **smart zone** 概念——约 120k token 的窗口范围内模型推理仍然敏锐。

**设计考虑：** ask-matt 的维护规则写入了 `CLAUDE.md`——任何 skill 的添加/重命名/删除或流程变更都需要重新审查 ask-matt，使其保持准确。v1.1.0 的 changelog 记录了一次大规模的 ask-matt 同步：补上了之前遗漏的 5 个 skill（tdd、diagnosing-bugs、domain-modeling、codebase-design、grilling），说明 router skill 的维护是一个持续的挑战。

**取舍：** router skill 降低了 cognitive load（用户只需记住一个入口），但引入了维护负担——router 必须与实际 skill 集合保持同步，否则它会"说谎"。

### 1.4 "不拥有流程"的设计立场

README 开篇就明确了立场：

> "Approaches like GSD, BMAD, and Spec-Kit try to help by owning the process. But while doing so, they take away your control and make bugs in the process hard to resolve. These skills are designed to be small, easy to adapt, and composable."

这个立场意味着：用户拥有流程，skill 是工具而非框架。修改成本极低——直接改 SKILL.md 即可即时生效，skill 之间松散耦合可任意组合。

**关键文件：** `README.md`、`ask-matt/SKILL.md`

---

## 2. "不拥有流程"的设计立场

### 2.1 立场的本质：工具而非框架

mattpocock-skills 的"不拥有流程"不是消极的不作为，而是一种积极的设计选择。`ask-matt/SKILL.md` 中的 main flow 定义了一条推荐路径（grill-with-docs → to-spec → to-tickets → implement），但每个节点都可以独立使用：

- 用户可以从 `/implement` 直接开始（跳过 grill 和 spec）
- 可以只用 `/grill-me` 整理想法然后手动实现
- 可以在已有 spec 的情况下直接 `/to-tickets`

**设计考虑：** "不拥有流程"意味着 skill 不强制执行路径。`ask-matt` 是"建议者"而非"执行者"——它告诉你有哪些 skill 可用、它们之间的关系是什么，但最终由用户决定走哪条路。

mattpocock-skills 没有自动拦截机制，没有 HARD-GATE，没有 bootstrap hook。

**取舍：** 不拥有流程给了用户最大灵活性，但也意味着没有安全网——用户可以跳过 grilling 直接写代码，skill 不会阻止。mattpocock-skills 认为用户是理性的成年人，可以选择何时用哪个工具。

### 2.2 "小而可组合"的边界

`writing-great-skills/SKILL.md` 定义了 skill 拆分的两个标准（granularity）：

1. **By invocation**：当一个 skill 有独特的 leading word 需要独立触发时拆分。代价是新增一个 model-invoked skill 的 context load。
2. **By sequence**：当后续步骤的存在会诱导 agent 跳过当前步骤（premature completion）时拆分。

反过来说，不满足这两个条件就不应该拆分。v1.1.0 的 changelog 记录了一次重要的合并：`to-prd` 重命名为 `to-spec`，`to-plan` 和 `to-issues` 合并为 `to-tickets`，`to-issues` 被删除。这次合并的理由是：这几个 skill 在实际使用中总是连续调用，拆分反而增加了认知负担和上下文切换成本。

**关键文件：** `writing-great-skills/SKILL.md`、`writing-great-skills/GLOSSARY.md`、`CHANGELOG.md` v1.1.0

**取舍：** 合并减少了 skill 数量和认知负担，但合并后的单个 skill 复杂度增加。`to-tickets` 现在同时处理 tracer-bullet 切分和 wide refactor 两种场景，通过 reference section 而非 step 来组织——这是 "information hierarchy" 原则的应用。

---

## 3. Grilling 式需求澄清

### 3.1 Grilling 的核心设计

Grilling 是 mattpocock-skills 最具特色的方法论。`grilling/SKILL.md` 全文仅 13 行，但包含 4 个精确的设计决策：

1. **一次一个问题**："Ask the questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering."
2. **遍历决策树**："Walk down each branch of the design tree, resolving dependencies between decisions one-by-one."
3. **每个问题附推荐答案**："For each question, provide your recommended answer."
4. **事实与决策分离**："If a *fact* can be found by exploring the codebase, look it up rather than asking me. The *decisions*, though, are mine — put each one to me and wait for my answer."

**`grilling/SKILL.md` 全文：**
```markdown
---
# grilling

When the user needs to clarify a vague idea, refine a design, or work through 
decisions before implementing...
---

Ask the questions one at a time, waiting for feedback on each question before 
continuing. Asking multiple questions at once is bewildering.

Walk down each branch of the design tree, resolving dependencies between 
decisions one-by-one.

For each question, provide your recommended answer.

If a *fact* can be found by exploring the codebase, look it up rather than 
asking me. The *decisions*, though, are mine — put each one to me and wait 
for my answer.
```

`grill-me` 和 `grill-with-docs` 都是 user-invoked skill，它们的实现极其简洁——`grill-me/SKILL.md` 全文只有"Run a `/grilling` session."一行，`grill-with-docs/SKILL.md` 只有"Run a `/grilling` session, using the `/domain-modeling` skill."一行。这是 deliberate 的设计——grilling 是 model-invoked 的可复用原语，两个 user-invoked skill 只是不同的入口。

**设计考虑：** 13 行的 SKILL.md 是 mattpocock "小而可组合"哲学的极致体现。没有 step-by-step workflow，没有 elaborate 的问题模板，只有 4 条核心规则。这种极简设计依赖于 agent 的内在能力——模型已经知道如何提问和遍历决策树，skill 只需要锚定关键行为约束（一次一问、推荐答案、事实/决策分离）。

**关键文件：** `grilling/SKILL.md`、`grill-me/SKILL.md`、`grill-with-docs/SKILL.md`

### 3.2 事实与决策的分离

v1.1.0 的 changelog 记录了 grilling 的一个重要演进——**Facts vs. Decisions** 分离：

> "The old blanket line — 'if a question can be answered by exploring the codebase, explore the codebase instead' — was written for the live-human case, but once another skill runs grilling inside a resolve-the-ticket frame it read as license to answer *decisions* autonomously too. Separating the two keeps a grilling agent from racing ahead and answering its own questions."

这个教训说明：当 grilling 被其他 skill（如 `triage`、`wayfinder`）内部调用时，原来"能从代码库推断就别问用户"的规则被过度泛化了——agent 开始替用户做决策。分离后，事实（可从代码库推断的技术事实）由 agent 自己查，决策（产品/业务约束）必须问用户。

事实/决策分离让 grilling 既可用于人工对话（grill-me），也可嵌入自动化流程（triage、wayfinder）而不越界。

**取舍：** 代价是需要 agent 有足够的判断力区分"事实"和"决策"——这不是总能做到的。

### 3.3 确认门控

v1.1.0 还为 grilling 加了确认门控：

> "The agent won't enact the plan until you confirm the shared understanding has been reached — turning the skill's existing 'shared understanding' completion criterion into an explicit stop-gate."

这是一种轻量门控——没有拦截机制，只是 grilling skill 自身的完成标准。agent 不会在用户确认前开始执行计划。

---

## 4. Shared Language（CONTEXT.md）

### 4.1 CONTEXT.md 的定位

README 将 CONTEXT.md 称为"the single coolest technique in this repo"，并将其与 DDD（Domain-Driven Design）的 Ubiquitous Language 概念直接关联：

> "With a ubiquitous language, conversations among developers and expressions of the code are all derived from the same domain model." — Eric Evans

`domain-modeling/SKILL.md` 定义了 CONTEXT.md 的本质：

> "CONTEXT.md should be totally devoid of implementation details. Do not treat CONTEXT.md as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else."

`CONTEXT-FORMAT.md` 定义了格式规范：每个术语包含定义 + `_Avoid_` 列表（要避免的同义词）。

**CONTEXT.md 格式示例：**
```markdown
## Order
A customer's request to purchase one or more items from a store.
_Avoid_: purchase, transaction, basket

## Fulfillment
The process of picking, packing, and shipping an order.
_Avoid_: delivery, dispatch, handling

## OrderPlaced
An event emitted when an order is confirmed by the customer.
_Avoid_: order-created, order-submitted
```

`_Avoid_` 的设计是 **opinionated** 的——"When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`." 这不是建议性的——当多个开发者使用不同词汇描述同一概念时，命名不一致会在代码库中蔓延。`_Avoid_` 列表通过明确禁止同义词，在团队层面强制统一术语。

**设计考虑：** CONTEXT.md 是纯粹的术语表，不包含实现细节。它是语言契约（只定义术语），而非行为契约。这个定位让 CONTEXT.md 的维护成本极低——只在有新术语确定时更新，不随代码重构而变化。

### 4.2 CONTEXT.md 的收益

README 列举了 CONTEXT.md 的四重收益：

1. **减少 verbosity**：agent 不需要用 20 个词描述 1 个词能表达的概念
2. **命名一致性**：变量名、函数名、文件名都使用 shared language
3. **代码库可导航性**：一致的命名让 agent 更容易在代码库中导航
4. **Token 效率**：agent 有更简洁的语言可用，思考时消耗更少 token

**取舍：** CONTEXT.md 需要持续维护——每次有新术语确定时就更新（`domain-modeling/SKILL.md` 要求"Update CONTEXT.md inline... Don't batch these up — capture them as they happen"）。如果不维护，CONTEXT.md 会腐化成过时文档。但维护成本被分散到了日常 grilling 流程中——`grill-with-docs` 在 grilling 过程中自动调用 `domain-modeling` 更新 CONTEXT.md。

### 4.3 ADR（Architecture Decision Records）

`domain-modeling/SKILL.md` 定义了 ADR 的三个触发条件——必须同时满足才创建：

1. **Hard to reverse** — 改变主意的成本有意义
2. **Surprising without context** — 未来读者会好奇"为什么这么做"
3. **The result of a real trade-off** — 有真正的替代方案并因特定理由选择了其中一个

`ADR-FORMAT.md` 的设计极简——"An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections." 与传统的 ADR 模板（Context、Decision、Status、Consequences 等多个 section）相比，mattpocock 的 ADR 刻意追求最小化。

**ADR 示例：**
```markdown
## We use event sourcing for order state

We chose event sourcing over CRUD because we need full audit trails 
for regulatory compliance. The trade-off is higher write complexity 
and eventual consistency on read models.
```

**设计考虑：** ADR 的极简格式降低了创建门槛——如果 ADR 需要填很多 section，agent 和人都会倾向于跳过。一句话 ADR 的成本接近于零，但价值在于"记录了决策存在"这个事实本身。传统 ADR 模板有 Context、Decision、Status、Consequences 四个 section，但大多数实际场景中，决策和理由可以在一段话内说清楚。多 section 模板的问题是它鼓励填充而非思考——人们会为了填满 Consequences section 而编造不必要的内容。

**关键文件：** `domain-modeling/SKILL.md`、`domain-modeling/CONTEXT-FORMAT.md`、`domain-modeling/ADR-FORMAT.md`、`README.md`

### 4.4 Multi-context 支持

`CONTEXT-FORMAT.md` 定义了单 context 和多 context 两种模式：

- **单 context**（大多数 repo）：根目录一个 `CONTEXT.md`
- **多 context**（monorepo）：根目录 `CONTEXT-MAP.md` 指向各子 context 的 `CONTEXT.md`

多 context 模式还支持 context 间关系描述（如 "Ordering → Fulfillment: Ordering emits OrderPlaced events"）。这体现了 DDD 的 Bounded Context 思想在 AI 辅助开发中的应用。

---

## 5. Two-axis Code Review

### 5.1 双轴设计

`code-review/SKILL.md` 定义了一个独特的双轴审查模型：

- **Standards** — 代码是否符合 repo 文档化的编码标准？
- **Spec** — 代码是否忠实实现了原始 issue/PRD/spec？

两个轴作为 **parallel sub-agents** 独立运行，互不污染 context：

```
/code-review（user-invoked）
    │
    ├── Standards sub-agent（独立 context）
    │   ├── 读取 repo 编码标准
    │   ├── 读取 Fowler smell baseline
    │   └── 审查 git diff → ## Standards 报告
    │
    └── Spec sub-agent（独立 context）
        ├── 查找原始 spec/issue/PRD
        ├── 对照 spec 审查代码
        └── → ## Spec 报告

最终报告：
    ## Standards  ← 不合并、不重排
    ## Spec       ← 独立呈现
```

最终的报告在 `## Standards` 和 `## Spec` 两个标题下分别呈现，**不合并、不重排**。

**设计考虑：** `code-review/SKILL.md` 的 "Why two axes" 段落解释了核心洞察：

> "A change can pass one axis and fail the other: Code that follows every standard but implements the wrong thing → Standards pass, Spec fail. Code that does exactly what the issue asked but breaks the project's conventions → Spec pass, Standards fail. Reporting them separately stops one axis from masking the other."

**取舍：** 双轴分离确保两个维度的问题都可见，但代价是用户需要同时阅读两份报告。不合并的设计是有意的——"the two axes are deliberately separate"。

### 5.2 Standards 轴的 Fowler Smell Baseline

v1.1.0 为 Standards 轴增加了 **always-on Fowler smell baseline**——一组来自 Fowler《Refactoring》第 3 章的代码异味清单，作为固定基线叠加在 repo 自己的编码标准之上：

12 种 smell：Mysterious Name、Duplicated Code、Feature Envy、Data Clumps、Primitive Obsession、Repeated Switches、Shotgun Surgery、Divergent Change、Speculative Generality、Message Chains、Middle Man、Refused Bequest。

两条绑定规则：
1. **The repo overrides** — repo 文档化的标准总是优先；如果 repo 认可某种 baseline 会标记的模式，抑制该 smell。
2. **Always a judgement call** — 每个 smell 是标注式启发（"possible Feature Envy"），不是硬违规。

**设计考虑：** Fowler smell baseline 确保即使 repo 没有任何编码标准文档，Standards 轴也有最低限度的检查基线。同时通过"repo overrides"规则避免与项目既有约定冲突。

**取舍：** 内联 12 种 smell 到 SKILL.md 增加了文件长度，但确保了 sub-agent 有完整的 baseline 可用——sub-agent 没有其他访问途径。这是 `writing-great-skills` 中 "in-skill reference" 层级的应用。

### 5.3 Spec 轴的追溯

Spec 轴需要找到原始 spec/issue/PRD。`code-review/SKILL.md` 定义了查找顺序：

1. commit message 中的 issue 引用（`#123`、`Closes #45` 等）
2. 用户传入的路径
3. `docs/`、`specs/`、`.scratch/` 下匹配的文件
4. 找不到则问用户；用户说没有则 Spec sub-agent 跳过

**设计考虑：** Spec 轴的价值在于"需求忠实度"检查——不只是代码好不好，而是代码做的是不是被要求做的事。在整个工作完成后由独立 sub-agent 检查。

**关键文件：** `code-review/SKILL.md`、`CHANGELOG.md` v1.1.0

---

## 6. Wayfinder 与 Tracer-bullet Tickets

### 6.1 Wayfinder：超大规模工作的"雾中探索"

`wayfinder/SKILL.md` 是仓库中最长、最复杂的 skill，用于处理"too big for one agent session"的超大工作。

**核心隐喻：** Wayfinder 借用游戏中的 **fog of war**（战争迷雾）概念——你无法看到全程，只能看到眼前。不是"冲向目的地"，而是"找到去目的地的路"。

**Wayfinder 的 Map 结构：**
```
Issue Tracker
└── wayfinder:map (labeled issue)
    ├── ## Destination
    │   └── "We need to migrate from monolith to microservices"
    │
    ├── ## Frontier（当前正在处理的 tickets）
    │   ├── Ticket #42 (HITL) — Define service boundaries
    │   └── Ticket #43 (AFK) — Extract user service
    │
    ├── ## Fog of War（感知到但无法精确描述的问题）
    │   ├── "Data consistency across services is unclear"
    │   └── "Auth flow needs rethinking"
    │
    └── ## Resolved（已完成的 tickets）
        └── Ticket #41 — Initial audit complete
```

**核心设计：**

1. **Map（地图）**：issue tracker 上的一个 `wayfinder:map` 标签的 issue，是整个努力的"索引"（不是"仓库"）。地图只 gist 决策并链接到 ticket，决策本身只存在于一个地方——它的 ticket。
2. **Ticket Types**：Research（AFK）、Prototype（HITL）、Grilling（HITL）、Task（HITL 或 AFK）。每个 ticket 要么需要人工（HITL），要么可以全自动（AFK）。
3. **Fog of war**：地图的 "Not yet specified" 区域记录"你能感知到但还无法精确描述的问题"。随着 frontier 推进，fog 逐渐"毕业"为具体 ticket。
4. **Plan, don't do**：Wayfinder 默认是规划工具——产出决策而非交付物。"The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off."
5. **一次一个 ticket**："never resolve more than one ticket per session"——每个 session 只解决一个决策。

**关键文件：** `wayfinder/SKILL.md`

**设计考虑：** Wayfinder 的设计哲学是"渐进式探索"——不试图一开始就规划全部，而是先创建能确定的 ticket，让不确定的部分留在 fog 中，随着探索推进逐步清晰。这与传统的 WBS（Work Breakdown Structure）形成对比——WBS 要求自顶向下完全分解，Wayfinder 允许自底向上渐进涌现。

**取舍：** Wayfinder 的渐进式探索适合真正模糊的超大工作，但对于中小型工作可能过重——v1.1.0 changelog 记录了一个 "no-fog early exit"：如果初始 breadth-first grilling 没有发现 fog，说明工作足够小不需要 map，直接停止。

### 6.2 Wayfinder 的演进教训

v1.1.0 changelog 记录了 wayfinder 从 `in-progress/` 毕业到 `engineering/` 的重要重构：

1. **重命名**：`decision-mapping` → `wayfinder`。"Decision map" 太术语化且不准确——只有一种 ticket 类型是真正的决策。
2. **Destination 作为 leading word**：Wayfinding 找的是"去目的地的路"，不是"冲向目的地"。每个 map 必须有 `## Destination` 字段。
3. **从本地 Markdown 迁移到 issue tracker**：Map 变成 tracker 上的一个 issue，tickets 是其 child issues——一个共享 URL 让团队可以观看。
4. **Native blocking**：优先使用 tracker 原生的依赖关系，让 frontier 在 tracker UI 中可视化。
5. **HITL/AFK 分类**：修复了"学生报告 /wayfinder 自己回答自己的 grilling 问题"的 bug——HITL ticket 只能通过人工交互解决，agent 不能代人回答。
6. **Claim by assignment**：通过 assignee 而非 label 来 claim ticket——assignee 就是 claim。

**关键教训：** HITL/AFK 分类解决了 agent "自问自答"的问题。这与 grilling 的 facts/decisions 分离是同一类教训——当 skill 被自动化调用时，需要明确区分"哪些必须人工"和"哪些可以自动"。

### 6.3 Tracer-bullet Tickets

`to-tickets/SKILL.md` 将工作分解为 **tracer-bullet tickets**——每个 ticket 是一个完整的垂直切片：

1. **垂直而非水平**：每个切片穿过所有层（schema、API、UI、tests），不是按层水平切分。
2. **可独立验证**：完成的切片可以独立 demo 或验证。
3. **一个 context window**：每个 ticket 的大小适配一个全新的 context window。
4. **Blocking edges**：每个 ticket 声明它依赖哪些其他 ticket——形成 DAG（有向无环图）。
5. **Wide refactor 例外**：大规模机械式变更（如重命名列）无法做垂直切片，用 expand-contract 模式序列化。

**设计考虑：** tracer-bullet 的核心思想来自 The Pragmatic Programmer——"tracer bullets"是打出一条从端到端的完整弹道，每一发都能看到落点。在 AI 辅助开发中，这意味着每个 ticket 产出的不是一个层（如"写所有的 model"），而是一个可验证的端到端行为。

**设计考虑：** `to-tickets/SKILL.md` 明确指出："avoid specific file paths or code snippets — they go stale fast." tickets 追求"agent 可以自主判断如何实现"。

**取舍：** 不含代码的 tickets 保护了 TDD 的有效性（执行者需要自己写测试和实现），但要求执行者（agent）有足够的能力理解行为描述并转化为代码。

**关键文件：** `to-tickets/SKILL.md`、`wayfinder/SKILL.md`

---

## 7. 其他关键设计模式

### 7.1 Smart Zone 与 Context Hygiene

`ask-matt/SKILL.md` 引入了 **smart zone** 概念——约 120k token 的窗口范围内模型推理仍然敏锐。基于此，main flow 的步骤 1-3（grill-with-docs → to-spec → to-tickets）要求保持在一个不中断的 context window 中：

> "Keep steps 1–3 in **one unbroken context window** — don't compact or clear until after `/to-tickets` — so the grilling, spec, and tickets all build on the same thinking."

当 session 接近 smart zone 边界时，使用 `/handoff` 而非 `/compact`——`/handoff` 会创建一个新 session 并传递 handoff 文档，`/compact` 是在同一对话中压缩。`ask-matt/SKILL.md` 明确区分了两者的使用场景：

> "/handoff forks; /compact continues."

**设计考虑：** smart zone 概念将"context 管理"从隐性的最佳实践变成了显性的设计约束。它承认模型的推理能力有边界，不是无限的。

### 7.2 TDD 的简化设计

`tdd/SKILL.md` 在 v1.1.0 经历了一次重要重构——从 step-by-step workflow 变成 reference-only skill。

**重构前（step-by-step workflow）：**
```markdown
## Step 1: Red
Write a failing test that describes the behavior...

## Step 2: Green
Write the minimum code to make the test pass...

## Step 3: Refactor
Improve the code while keeping tests green...
```

**重构后（reference-only）：**
```markdown
# tdd

Test only at pre-agreed seams, confirmed with the user 
before any test is written.

## Anti-patterns
1. Implementation-coupled: mock internal collaborators...
2. Tautological: assertions recompute expected values...
3. Horizontal slicing: write all tests then all implementation...
```

changelog 记录了原因：

> "The red → green → refactor loop is anchored by leading words the model already holds, so the step-by-step Workflow was largely restating the loop."

v1.1.0 还做了一个重要的决策——**删除了 refactor 阶段**：

> "TDD is now red → green; refactoring belongs to the review stage, so the refactor rule and `refactoring.md` moved out (its home is `code-review`)."

同时引入了 **seam** 作为 leading word——"test only at pre-agreed seams, confirmed with the user before any test is written."

**三个 anti-patterns：**
1. **Implementation-coupled**：mock 内部协作者、测私有方法→重构时测试就坏
2. **Tautological**：断言用代码自己的方式重算期望值→永远通过但零信心
3. **Horizontal slicing**：先写所有测试再写所有实现→测的是想象中的行为

**设计考虑：** mattpocock 的 TDD 设计简洁——没有 Iron Law、没有 Rationalization 表。它依赖 leading word（red、green、seam、tracer bullet）和 reference 来引导行为，而非强制约束。

**取舍：** 简化的 TDD 更容易被采纳，但缺乏强制保障。这反映了 mattpocock 的基本立场：信任用户和 agent 的判断力。

### 7.3 Skill 写作方法论

`writing-great-skills/SKILL.md` 和 `GLOSSARY.md` 构成了一套完整的 skill 写作理论体系。这是 mattpocock-skills 的元贡献——不只是提供 skills，还提供如何写 skills 的理论。

**核心概念：**

| 概念 | 定义 | 示例 |
|------|------|------|
| **Predictability** | agent 每次运行走相同的 *过程*，而非产出相同的 *输出* | grilling 每次都一次一问，但问题和答案因场景不同 |
| **Information Hierarchy** | 信息放置的优先级 | in-skill step > in-skill reference > external reference |
| **Leading Words** | 利用模型预训练概念用最少 token 锚定行为 | _fog of war_、_tracer bullets_、_red green_ |
| **Failure Modes** | skill 设计的常见失败模式 | premature completion、duplication、sediment、sprawl、no-op、negation |

**Information Hierarchy 详解：**
- **In-skill step**：直接写在 SKILL.md 中的步骤——agent 一定会看到
- **In-skill reference**：写在 SKILL.md 的 reference section 中——agent 按需读取
- **External reference**：指向外部文件的链接——agent 需要主动读取

优先使用高层级的信息放置，因为越低层级的信息，agent 读取的概率越低。

**Failure Modes 详解：**
- **Premature completion**：后续步骤的存在诱导 agent 跳过当前步骤——解决方法是拆分为独立 skill
- **Duplication**：同一逻辑出现在多个 skill 中——解决方法是提取为 model-invoked 原语
- **Sediment**：旧规则积累但不再适用——解决方法是定期 review 和 deprecated 目录
- **Sprawl**：skill 数量膨胀失控——解决方法是合并连续调用的 skill
- **No-op**：skill 不改变 agent 的默认行为——解决方法是 no-op 检测
- **Negation**："don't think of an elephant" 会让大象更突出——解决方法是描述目标行为

**Negation** 的设计特别有趣——"don't think of an elephant" 会让大象更突出，所以应该描述目标行为（"write one-line comments"）而非禁止行为（"don't write verbose comments"）。mattpocock 认为正面列出反面行为并反驳反而会强化反面行为。这个认知来自认知科学中的"讽刺过程理论"（ironic process theory）——试图抑制某个想法反而会让它更突出。

### 7.4 Diagnosing Bugs 的反馈循环优先

`diagnosing-bugs/SKILL.md` 的核心设计是 **Phase 1 — Build a feedback loop** 先于一切：

> "This is the skill. Everything else is mechanical. If you have a **tight** pass/fail signal for the bug — one that goes red on _this_ bug — you will find the cause."

设计要求在有任何 hypothesis 之前先建立反馈循环——"If you catch yourself reading code to build a theory before this command exists, **stop — jumping straight to a hypothesis is the exact failure this skill prevents.**"

10 种构建反馈循环的方式按优先级排列：failing test > curl/HTTP > CLI invocation > headless browser > replay trace > throwaway harness > property/fuzz > bisection > differential > HITL bash script。

**设计考虑：** mattpocock 的版本具体列出了 10 种构建循环的方式，并引入了 "tight"（快速、确定性、agent 可运行）的完成标准。

---

## 8. 能力边界

### 8.1 擅长

- **小巧可组合**：~20 个 promoted skill，每个都很短（grilling 13 行，implement 15 行），可以独立使用或组合
- **需求澄清方法论**：grilling 的"一次一问+推荐答案+事实/决策分离"是独特且实用的设计
- **领域语言建模**：CONTEXT.md + ADR 的极简设计让 DDD 思想以最低成本落地
- **双轴代码审查**：Standards + Spec 的分离避免了维度互相遮蔽
- **超大规模规划**：Wayfinder 的 fog-of-war 渐进式探索适合真正模糊的大工作
- **Skill 写作理论**：`writing-great-skills` 提供了一套完整的 skill 设计词汇表
- **工程基础扎实**：TDD、debugging、codebase design、prototype 各有独立的 discipline skill

### 8.2 不擅长

- **统一流程约束**：不拥有流程意味着没有 HARD-GATE、没有强制执行——完全依赖用户自律
- **Spec 演进追踪**：`to-spec` 产出的是一次性 PRD/spec 文档，没有 delta 机制、没有 source of truth、没有 archive 合并
- **变更可审计**：没有 change 文件夹完整保留机制
- **自动化工具**：纯 Markdown skill，没有 CLI 工具、没有 schema 系统、没有 validation 逻辑
- **多平台适配**：通过 `skills.sh` 安装器适配多个 agent 平台，但深度有限
- **并行变更管理**：没有 bulk archive 和冲突检测机制
- **自动化触发**：没有 hooks 系统、没有 session start 自动 bootstrap

### 8.3 演进模式

从 CHANGELOG 可以看出 mattpocock-skills 的演进特征：

1. **从碎片化到统一**：`to-prd` → `to-spec`，`to-plan` + `to-issues` → `to-tickets`——减少 skill 数量，降低认知负担
2. **从复杂到简化**：TDD 从 step-by-step workflow 变成 reference-only——"the loop is anchored by leading words the model already holds"
3. **从本地到协作**：wayfinder 从本地 Markdown 文件迁移到 issue tracker——"a shared URL the team can watch"
4. **从隐性到显性**：grilling 的 facts/decisions 分离、HITL/AFK 分类——当 skill 被自动化调用时，需要显式区分人工和自动
5. **从粗糙到精细**：code-review 增加 Fowler smell baseline、grilling 增加确认门控——逐步加强而非一步到位

---

## 9. 演进中的关键教训

| 教训 | 来源 | 修复 |
|------|------|------|
| "能从代码推断就别问用户"被过度泛化，agent 开始替用户做决策 | v1.1.0 grilling | 引入 Facts vs. Decisions 分离，事实自查、决策必问 |
| Wayfinder 中 agent 自问自答 grilling 问题（学生报告的 bug） | v1.1.0 wayfinder | HITL/AFK 分类，HITL ticket 只能通过人工交互解决 |
| to-prd / to-plan / to-issues 三个 skill 总是连续调用，拆分增加认知负担 | v1.1.0 | 合并为 to-spec + to-tickets，减少 skill 数量 |
| TDD step-by-step workflow 与 leading word 重复 | v1.1.0 | 改为 reference-only skill，删除冗余 workflow |
| refactor 阶段放在 TDD 中导致职责模糊 | v1.1.0 | 删除 refactor 阶段，移至 code-review skill |
| ask-matt router 遗漏了 5 个 skill（tdd、diagnosing-bugs 等） | v1.1.0 | 大规模同步修正，写入 CLAUDE.md 维护规则 |
| wayfinder 在没有 fog 时仍然走完整流程 | v1.1.0 | 增加 no-fog early exit，足够小则直接停止 |
| decision-mapping 命名不准确且过于术语化 | v1.1.0 | 重命名为 wayfinder，引入 destination 概念 |
| Map 存储在本地 Markdown 无法团队协作 | v1.1.0 | 迁移到 issue tracker，shared URL 可观看 |

**模式：** 从碎片到合并，从复杂到简化——mattpocock-skills 的演进主线是不断合并连续调用的 skill、删除与模型内在能力重复的 workflow、将隐性规则显性化（Facts/Decisions、HITL/AFK）。

---

## 10. 设计决策清单

以下是从源码分析中提取的 mattpocock-skills 的核心设计决策：

| # | 设计决策 | 为什么这么做 | 之前出了什么问题 |
|---|---------|-------------|----------------|
| 1 | User-invoked vs Model-invoked 二分法 | 编排 skill 零 context load，纪律 skill 可被自动触发 | 所有 skill 都是 model-invoked 时 context window 被大量 description 占用 |
| 2 | `disable-model-invocation: true` 技术实现 | 一行 frontmatter 实现 user-only 触发 | 无此标志时 agent 会自动触发编排类 skill |
| 3 | "不拥有流程"立场 | 用户保留控制权，流程 bug 易修复 | 框架拥有流程时，流程 bug 难以修复且限制用户自由 |
| 4 | grilling 一次一问 | "Asking multiple questions at once is bewildering" | 多问一次时用户漏答或答错关联问题 |
| 5 | grilling 每问附推荐答案 | 用户可以快速确认或修正，降低交互成本 | 无推荐答案时用户需从零思考每个问题 |
| 6 | grilling 事实/决策分离 | 防止 agent 在被其他 skill 调用时替用户做决策 | 原来统一规则"能查就查"被泛化为"替用户做决策" |
| 7 | grilling 确认门控 | "turning 'shared understanding' into an explicit stop-gate" | 无门控时 agent 在理解未对齐时就开始执行 |
| 8 | CONTEXT.md 纯术语表 | 避免变成 spec 或 scratch pad | 混合内容时术语表腐化为过时文档 |
| 9 | CONTEXT.md `_Avoid_` 列表 | opinionated——消除同义词歧义 | 无 Avoid 列表时同义词混用导致命名不一致 |
| 10 | ADR 极简格式（一句话即可） | 降低创建门槛 | 传统 ADR 模板 section 太多，agent 和人都会跳过 |
| 11 | ADR 三条件触发（hard to reverse + surprising + real trade-off） | 避免记录琐碎决策 | 无触发条件时要么不记录、要么记录太多噪声 |
| 12 | code-review 双轴分离（Standards + Spec） | "stops one axis from masking the other" | 合并审查时标准通过但 spec 不符的问题被遮蔽 |
| 13 | 双轴 parallel sub-agents | 互不污染 context | 单 reviewer 的 context 被两个维度混合 |
| 14 | 不合并双轴报告 | "the two axes are deliberately separate" | 合并报告时一个维度的问题被另一个维度掩盖 |
| 15 | Fowler smell baseline always-on | 即使 repo 无标准文档也有最低基线 | repo 无标准文档时 Standards 轴无检查依据 |
| 16 | tracer-bullet tickets（垂直切片） | 端到端可验证，适配一个 context window | 水平切片（按层）无法独立验证 |
| 17 | tickets 不含代码和文件路径 | "they go stale fast" | 包含代码片段的 plan 在实现时已过时 |
| 18 | blocking edges DAG | 支持 frontier tickets 并行执行 | 串行依赖导致无依赖的 ticket 被阻塞 |
| 19 | wide refactor expand-contract | "no vertical slice can land green" | 大规模机械式变更无法做垂直切片 |
| 20 | Wayfinder fog of war | "don't chart what you can't yet see" | 传统 WBS 要求自顶向下完全分解，对模糊工作不适用 |
| 21 | Wayfinder "plan, don't do" | 产出决策而非交付物，到达边缘时 handoff | 规划阶段直接做工作会导致规划不完整 |
| 22 | Wayfinder HITL/AFK 分类 | 防止 agent 自问自答（学生报告的 bug） | 无分类时 agent 代人回答 HITL 问题 |
| 23 | Wayfinder claim by assignment | assignee 就是 claim，释放 label 词汇 | 用 label claim 时 label 词汇被占用 |
| 24 | TDD reference-only（无 workflow） | "loop is anchored by leading words" | step-by-step workflow 与 leading word 重复 |
| 25 | TDD 删除 refactor 阶段 | "refactoring belongs to the review stage" | refactor 在 TDD 中导致职责模糊 |
| 26 | TDD seam 作为 leading word | "test only at pre-agreed seams" | 无 seam 约定时 agent 随意选择测试点 |
| 27 | smart zone 概念（~120k token） | 显式承认模型推理边界 | 假设 context 无限导致 compaction 后推理质量下降 |
| 28 | /handoff vs /compact 区分 | "forks vs continues" | 混用导致 context 要么丢失要么被压缩 |
| 29 | ask-matt router skill | 降低 cognitive load（一个入口） | user-invoked skill 增多时用户记不住 |
| 30 | prototype throwaway from day one | "keep the answer, delete the code" | 原型代码混入生产代码 |
| 31 | diagnosing-bugs 反馈循环优先 | "no red-capable command, no Phase 2" | 直接读代码建理论导致错误假设 |
| 32 | writing-great-skills negation 规则 | "don't think of an elephant" 反效果 | 禁止性描述反而强化被禁止的行为 |
| 33 | writing-great-skills no-op 检测 | "does it change behaviour versus the default?" | 无此检测时 skill 不改变默认行为 |
| 34 | setup-matt-pocock-skills 一次性配置 | 统一 issue tracker、triage labels、domain docs | 手动配置遗漏或不一致 |
| 35 | promoted/non-promoted 仓库分界 | 发布渠道与实验场在同一仓库 | 不区分时 in-progress 和 deprecated skill 造成噪音 |

---

## 11. 总结

mattpocock-skills 的核心贡献不在于流程设计（它明确不设计流程），而在于：

1. **需求澄清方法论**：grilling 的"一次一问+推荐答案+事实/决策分离"是一个经过实践检验的轻量级需求澄清模式
2. **领域语言建模**：CONTEXT.md + ADR 的极简设计让 DDD 思想以最低成本落地到 AI 辅助开发
3. **Skill 写作理论**：`writing-great-skills` 提供了一套完整的 skill 设计词汇表（predictability、leading word、information hierarchy、failure modes）
4. **双轴代码审查**：Standards + Spec 的分离设计避免了维度互相遮蔽
5. **User-invoked vs Model-invoked 二分法**：将"谁触发"编码为技术架构，明确区分编排和纪律
6. **Wayfinder 渐进式探索**：fog-of-war 模式适合真正模糊的超大工作规划

它的局限也很明确：缺乏流程强制保障、缺乏 spec 演进追踪、缺乏自动化工具。这些局限是"不拥有流程"立场的必然结果——如果你不拥有流程，就不能强制执行它。
