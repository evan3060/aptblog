---
title: AI研发流程深度解析（五）：mattpocock-skills深度拆解——小而可组合的工程师技能
description: 一个明确"不拥有流程"的skill集合，如何在保持小巧可组合的同时提供工程基础？它的需求澄清方法论有什么独特之处？
tags:
  - 研发流程
  - mattpocock
  - 可组合
  - 工程实践
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-11
> **核心问题：** 一个明确"不拥有流程"的skill集合，如何在保持小巧可组合的同时提供工程基础？它的需求澄清方法论有什么独特之处？

---

![AI研发流程深度解析（五）：mattpocock-skills深度拆解——小而可组合的工程师技能](/images/dev-process/dev-process-05-mattpocock-deep-dive.png)

## 1. 架构拆解

### 1.1 Skill分类体系

mattpocock-skills的自我定位是 **"Skills For Real Engineers — my agent skills that I use every day to do real engineering - not vibe coding"**（`README.md`）。这个定位的核心信号是：这是一个个人实践工具集，不是企业框架。它由Matt Pocock（TypeScript教育者、Total TypeScript作者）以个人身份维护，每个skill都经过日常工程实践验证。

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

**设计考虑：** promoted（`engineering/` + `productivity/`）与非promoted的分界线很清晰——只有promoted skill才出现在 `README.md`、`.claude-plugin/plugin.json` 和 `docs/` 中。这意味着用户看到的只是"成熟"的skill，in-progress和deprecated的不会造成噪音。`CLAUDE.md` 明确维护规则：添加、重命名或行为变更时需要同步README、plugin.json和docs页面。

**取舍：** promoted/non-promoted的分界让仓库同时充当"发布渠道"和"实验场"——好处是个人迭代和公开发布在同一个仓库，代价是仓库结构比纯发布仓库复杂。

### 1.2 User-invoked vs Model-invoked

这是mattpocock-skills最核心的架构决策之一。它决定了skill的触发方式、context load和在流程中的角色。

README明确指出：

> "These split on one axis — **who can invoke them**. **User-invoked** skills are reachable only when you type them (e.g. `/grill-me`); their job is to orchestrate. **Model-invoked** skills can be invoked by you *or* reached for automatically by the agent when the task fits; they hold the reusable discipline. A user-invoked skill may invoke model-invoked skills, but never another user-invoked one."

技术实现上，这个区分通过frontmatter中的 `disable-model-invocation: true` 标志控制（`CLAUDE.md`）。

**User-invoked skill frontmatter示例：**
```yaml
---
disable-model-invocation: true
---
# grill-with-docs

Run a `/grilling` session, using the `/domain-modeling` skill.
```

**Model-invoked skill frontmatter示例：**
```yaml
---
# grilling

When the user needs to clarify a vague idea, refine a design, or work through 
decisions before implementing. Trigger phrases: "grill me", "help me think through",
"I'm not sure about", "what should I do about"...
---
```

- **User-invoked skill**：设置 `disable-model-invocation: true`，agent无法自动触发，只有用户输入 `/skill-name` 才能调用。description变成人面摘要（不含触发短语）。
- **Model-invoked skill**：不设 `disable-model-invocation`，agent可以通过description自动匹配触发，用户也可以手动调用。description是机器可读的触发器，包含丰富的触发短语。

`writing-great-skills/SKILL.md` 和 `writing-great-skills/GLOSSARY.md` 将这个决策的理论基础阐述得非常透彻。

**两种负荷的权衡：**

| 负荷类型 | User-invoked | Model-invoked |
|---------|-------------|---------------|
| **Context Load** | 零（description不注入context） | 每轮对话都占用context window |
| **Cognitive Load** | 高（用户需要记住skill的存在） | 零（agent自动匹配触发） |
| **触发可靠性** | 100%（用户显式调用） | 50-80%（依赖AI判断） |

**选择标准**："Pick model-invocation only when the agent must reach the skill on its own, or another skill must reach it. If it only ever fires by hand, make it user-invoked and pay no context load."

**当前skill分类：**

| 类型 | User-invoked | Model-invoked |
|------|-------------|---------------|
| **Engineering** | ask-matt, grill-with-docs, triage, improve-codebase-architecture, setup-matt-pocock-skills, to-spec, to-tickets, implement, wayfinder | prototype, diagnosing-bugs, research, tdd, domain-modeling, codebase-design, code-review |
| **Productivity** | grill-me, handoff, teach, writing-great-skills | grilling |

**设计考虑：** 分类逻辑非常清晰——编排类skill（orchestrator）是user-invoked，可复用的纪律性skill（discipline）是model-invoked。这种二分法将"人控制流程入口，agent自动执行纪律"的意图编码进了技术架构。

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

例如 `/implement` 是user-invoked（用户决定何时开始实现），但它内部驱动的 `/tdd` 和 `/code-review` 是model-invoked（implement或其他skill可以自动调用它们）。user-invoked skill可以调用model-invoked skill，但永远不能调用另一个user-invoked skill——这是架构的硬约束。

**取舍：** 这种二分法将"人控制流程入口，agent自动执行纪律"的意图编码进了技术架构。代价是当user-invoked skill数量增多时，用户面临cognitive load——`ask-matt` router skill就是为解决这个问题而引入的（见1.3）。

### 1.3 ask-matt Router Skill

`ask-matt` 是v1.0.0引入的 **router skill**——一个user-invoked skill，它的工作是指向其他user-invoked skill（`ask-matt/SKILL.md`）。

`writing-great-skills/GLOSSARY.md` 定义了router skill的本质：

> "A **router skill** is a user-invoked skill whose job is to point at your other user-invoked skills — naming each and when to reach for it — so the human has one skill to remember instead of many. It can only hint, never fire them: user-invoked skills have no description, so nothing but the human can reach them. The cure for **cognitive load** when user-invoked skills multiply."

`ask-matt` 将所有skill组织为一个 **main flow**（idea → ship）加两个 **on-ramps**（bugs/triage和foggy/huge/wayfinder），以及若干standalone skill。它定义了"main flow"的路径：

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

还有一个 **context hygiene** 规则：步骤1-3保持在一个不中断的context window中，直到 `/to-tickets` 完成后才清理。这基于 **smart zone** 概念——约120k token的窗口范围内模型推理仍然敏锐。

**设计考虑：** ask-matt的维护规则写入了 `CLAUDE.md`——任何skill的添加/重命名/删除或流程变更都需要重新审查ask-matt，使其保持准确。v1.1.0的changelog记录了一次大规模的ask-matt同步：补上了之前遗漏的5个skill（tdd、diagnosing-bugs、domain-modeling、codebase-design、grilling），说明router skill的维护是一个持续的挑战。

**取舍：** router skill降低了cognitive load（用户只需记住一个入口），但引入了维护负担——router必须与实际skill集合保持同步，否则它会"说谎"。

### 1.4 "不拥有流程"的设计立场

README开篇就明确了立场：

> "Approaches like GSD, BMAD, and Spec-Kit try to help by owning the process. But while doing so, they take away your control and make bugs in the process hard to resolve. These skills are designed to be small, easy to adapt, and composable."

这个立场意味着：用户拥有流程，skill是工具而非框架。修改成本极低——直接改SKILL.md即可即时生效，skill之间松散耦合可任意组合。

**关键文件：** `README.md`、`ask-matt/SKILL.md`

---

## 2. "不拥有流程"的设计立场

### 2.1立场的本质：工具而非框架

mattpocock-skills的"不拥有流程"不是消极的不作为，而是一种积极的设计选择。`ask-matt/SKILL.md` 中的main flow定义了一条推荐路径（grill-with-docs → to-spec → to-tickets → implement），但每个节点都可以独立使用：

- 用户可以从 `/implement` 直接开始（跳过grill和spec）
- 可以只用 `/grill-me` 整理想法然后手动实现
- 可以在已有spec的情况下直接 `/to-tickets`

**设计考虑：** "不拥有流程"意味着skill不强制执行路径。`ask-matt` 是"建议者"而非"执行者"——它告诉你有哪些skill可用、它们之间的关系是什么，但最终由用户决定走哪条路。

mattpocock-skills没有自动拦截机制，没有HARD-GATE，没有bootstrap hook。

**取舍：** 不拥有流程给了用户最大灵活性，但也意味着没有安全网——用户可以跳过grilling直接写代码，skill不会阻止。mattpocock-skills认为用户是理性的成年人，可以选择何时用哪个工具。

### 2.2 "小而可组合"的边界

`writing-great-skills/SKILL.md` 定义了skill拆分的两个标准（granularity）：

1. **By invocation**：当一个skill有独特的leading word需要独立触发时拆分。代价是新增一个model-invoked skill的context load。
2. **By sequence**：当后续步骤的存在会诱导agent跳过当前步骤（premature completion）时拆分。

反过来说，不满足这两个条件就不应该拆分。v1.1.0的changelog记录了一次重要的合并：`to-prd` 重命名为 `to-spec`，`to-plan` 和 `to-issues` 合并为 `to-tickets`，`to-issues` 被删除。这次合并的理由是：这几个skill在实际使用中总是连续调用，拆分反而增加了认知负担和上下文切换成本。

**关键文件：** `writing-great-skills/SKILL.md`、`writing-great-skills/GLOSSARY.md`、`CHANGELOG.md` v1.1.0

**取舍：** 合并减少了skill数量和认知负担，但合并后的单个skill复杂度增加。`to-tickets` 现在同时处理tracer-bullet切分和wide refactor两种场景，通过reference section而非step来组织——这是 "information hierarchy" 原则的应用。

---

## 3. Grilling式需求澄清

### 3.1 Grilling的核心设计

Grilling是mattpocock-skills最具特色的方法论。`grilling/SKILL.md` 全文仅13行，但包含4个精确的设计决策：

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

`grill-me` 和 `grill-with-docs` 都是user-invoked skill，它们的实现极其简洁——`grill-me/SKILL.md` 全文只有"Run a `/grilling` session."一行，`grill-with-docs/SKILL.md` 只有"Run a `/grilling` session, using the `/domain-modeling` skill."一行。这是deliberate的设计——grilling是model-invoked的可复用原语，两个user-invoked skill只是不同的入口。

**设计考虑：** 13行的SKILL.md是mattpocock "小而可组合"哲学的极致体现。没有step-by-step workflow，没有elaborate的问题模板，只有4条核心规则。这种极简设计依赖于agent的内在能力——模型已经知道如何提问和遍历决策树，skill只需要锚定关键行为约束（一次一问、推荐答案、事实/决策分离）。

**关键文件：** `grilling/SKILL.md`、`grill-me/SKILL.md`、`grill-with-docs/SKILL.md`

### 3.2事实与决策的分离

v1.1.0的changelog记录了grilling的一个重要演进——**Facts vs. Decisions** 分离：

> "The old blanket line — 'if a question can be answered by exploring the codebase, explore the codebase instead' — was written for the live-human case, but once another skill runs grilling inside a resolve-the-ticket frame it read as license to answer *decisions* autonomously too. Separating the two keeps a grilling agent from racing ahead and answering its own questions."

这个教训说明：当grilling被其他skill（如 `triage`、`wayfinder`）内部调用时，原来"能从代码库推断就别问用户"的规则被过度泛化了——agent开始替用户做决策。分离后，事实（可从代码库推断的技术事实）由agent自己查，决策（产品/业务约束）必须问用户。

事实/决策分离让grilling既可用于人工对话（grill-me），也可嵌入自动化流程（triage、wayfinder）而不越界。

**取舍：** 代价是需要agent有足够的判断力区分"事实"和"决策"——这不是总能做到的。

### 3.3确认门控

v1.1.0还为grilling加了确认门控：

> "The agent won't enact the plan until you confirm the shared understanding has been reached — turning the skill's existing 'shared understanding' completion criterion into an explicit stop-gate."

这是一种轻量门控——没有拦截机制，只是grilling skill自身的完成标准。agent不会在用户确认前开始执行计划。

---

## 4. Shared Language（CONTEXT.md）

### 4.1 CONTEXT.md的定位

README将CONTEXT.md称为"the single coolest technique in this repo"，并将其与DDD（Domain-Driven Design）的Ubiquitous Language概念直接关联：

> "With a ubiquitous language, conversations among developers and expressions of the code are all derived from the same domain model." — Eric Evans

`domain-modeling/SKILL.md` 定义了CONTEXT.md的本质：

> "CONTEXT.md should be totally devoid of implementation details. Do not treat CONTEXT.md as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else."

`CONTEXT-FORMAT.md` 定义了格式规范：每个术语包含定义 + `_Avoid_` 列表（要避免的同义词）。

**CONTEXT.md格式示例：**
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

**设计考虑：** CONTEXT.md是纯粹的术语表，不包含实现细节。它是语言契约（只定义术语），而非行为契约。这个定位让CONTEXT.md的维护成本极低——只在有新术语确定时更新，不随代码重构而变化。

### 4.2 CONTEXT.md的收益

README列举了CONTEXT.md的四重收益：

1. **减少verbosity**：agent不需要用20个词描述1个词能表达的概念
2. **命名一致性**：变量名、函数名、文件名都使用shared language
3. **代码库可导航性**：一致的命名让agent更容易在代码库中导航
4. **Token效率**：agent有更简洁的语言可用，思考时消耗更少token

**取舍：** CONTEXT.md需要持续维护——每次有新术语确定时就更新（`domain-modeling/SKILL.md` 要求"Update CONTEXT.md inline... Don't batch these up — capture them as they happen"）。如果不维护，CONTEXT.md会腐化成过时文档。但维护成本被分散到了日常grilling流程中——`grill-with-docs` 在grilling过程中自动调用 `domain-modeling` 更新CONTEXT.md。

### 4.3 ADR（Architecture Decision Records）

`domain-modeling/SKILL.md` 定义了ADR的三个触发条件——必须同时满足才创建：

1. **Hard to reverse** — 改变主意的成本有意义
2. **Surprising without context** — 未来读者会好奇"为什么这么做"
3. **The result of a real trade-off** — 有真正的替代方案并因特定理由选择了其中一个

`ADR-FORMAT.md` 的设计极简——"An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections." 与传统的ADR模板（Context、Decision、Status、Consequences等多个section）相比，mattpocock的ADR刻意追求最小化。

**ADR示例：**
```markdown
## We use event sourcing for order state

We chose event sourcing over CRUD because we need full audit trails 
for regulatory compliance. The trade-off is higher write complexity 
and eventual consistency on read models.
```

**设计考虑：** ADR的极简格式降低了创建门槛——如果ADR需要填很多section，agent和人都会倾向于跳过。一句话ADR的成本接近于零，但价值在于"记录了决策存在"这个事实本身。传统ADR模板有Context、Decision、Status、Consequences四个section，但大多数实际场景中，决策和理由可以在一段话内说清楚。多section模板的问题是它鼓励填充而非思考——人们会为了填满Consequences section而编造不必要的内容。

**关键文件：** `domain-modeling/SKILL.md`、`domain-modeling/CONTEXT-FORMAT.md`、`domain-modeling/ADR-FORMAT.md`、`README.md`

### 4.4 Multi-context支持

`CONTEXT-FORMAT.md` 定义了单context和多context两种模式：

- **单context**（大多数repo）：根目录一个 `CONTEXT.md`
- **多context**（monorepo）：根目录 `CONTEXT-MAP.md` 指向各子context的 `CONTEXT.md`

多context模式还支持context间关系描述（如 "Ordering → Fulfillment: Ordering emits OrderPlaced events"）。这体现了DDD的Bounded Context思想在AI辅助开发中的应用。

---

## 5. Two-axis Code Review

### 5.1双轴设计

`code-review/SKILL.md` 定义了一个独特的双轴审查模型：

- **Standards** — 代码是否符合repo文档化的编码标准？
- **Spec** — 代码是否忠实实现了原始issue/PRD/spec？

两个轴作为 **parallel sub-agents** 独立运行，互不污染context：

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

### 5.2 Standards轴的Fowler Smell Baseline

v1.1.0为Standards轴增加了 **always-on Fowler smell baseline**——一组来自Fowler《Refactoring》第3章的代码异味清单，作为固定基线叠加在repo自己的编码标准之上：

12种smell：Mysterious Name、Duplicated Code、Feature Envy、Data Clumps、Primitive Obsession、Repeated Switches、Shotgun Surgery、Divergent Change、Speculative Generality、Message Chains、Middle Man、Refused Bequest。

两条绑定规则：
1. **The repo overrides** — repo文档化的标准总是优先；如果repo认可某种baseline会标记的模式，抑制该smell。
2. **Always a judgement call** — 每个smell是标注式启发（"possible Feature Envy"），不是硬违规。

**设计考虑：** Fowler smell baseline确保即使repo没有任何编码标准文档，Standards轴也有最低限度的检查基线。同时通过"repo overrides"规则避免与项目既有约定冲突。

**取舍：** 内联12种smell到SKILL.md增加了文件长度，但确保了sub-agent有完整的baseline可用——sub-agent没有其他访问途径。这是 `writing-great-skills` 中 "in-skill reference" 层级的应用。

### 5.3 Spec轴的追溯

Spec轴需要找到原始spec/issue/PRD。`code-review/SKILL.md` 定义了查找顺序：

1. commit message中的issue引用（`#123`、`Closes #45` 等）
2. 用户传入的路径
3. `docs/`、`specs/`、`.scratch/` 下匹配的文件
4. 找不到则问用户；用户说没有则Spec sub-agent跳过

**设计考虑：** Spec轴的价值在于"需求忠实度"检查——不只是代码好不好，而是代码做的是不是被要求做的事。在整个工作完成后由独立sub-agent检查。

**关键文件：** `code-review/SKILL.md`、`CHANGELOG.md` v1.1.0

---

## 6. Wayfinder与Tracer-bullet Tickets

### 6.1 Wayfinder：超大规模工作的"雾中探索"

`wayfinder/SKILL.md` 是仓库中最长、最复杂的skill，用于处理"too big for one agent session"的超大工作。

**核心隐喻：** Wayfinder借用游戏中的 **fog of war**（战争迷雾）概念——你无法看到全程，只能看到眼前。不是"冲向目的地"，而是"找到去目的地的路"。

**Wayfinder的Map结构：**
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

1. **Map（地图）**：issue tracker上的一个 `wayfinder:map` 标签的issue，是整个努力的"索引"（不是"仓库"）。地图只gist决策并链接到ticket，决策本身只存在于一个地方——它的ticket。
2. **Ticket Types**：Research（AFK）、Prototype（HITL）、Grilling（HITL）、Task（HITL或AFK）。每个ticket要么需要人工（HITL），要么可以全自动（AFK）。
3. **Fog of war**：地图的 "Not yet specified" 区域记录"你能感知到但还无法精确描述的问题"。随着frontier推进，fog逐渐"毕业"为具体ticket。
4. **Plan, don't do**：Wayfinder默认是规划工具——产出决策而非交付物。"The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off."
5. **一次一个ticket**："never resolve more than one ticket per session"——每个session只解决一个决策。

**关键文件：** `wayfinder/SKILL.md`

**设计考虑：** Wayfinder的设计哲学是"渐进式探索"——不试图一开始就规划全部，而是先创建能确定的ticket，让不确定的部分留在fog中，随着探索推进逐步清晰。这与传统的WBS（Work Breakdown Structure）形成对比——WBS要求自顶向下完全分解，Wayfinder允许自底向上渐进涌现。

**取舍：** Wayfinder的渐进式探索适合真正模糊的超大工作，但对于中小型工作可能过重——v1.1.0 changelog记录了一个 "no-fog early exit"：如果初始breadth-first grilling没有发现fog，说明工作足够小不需要map，直接停止。

### 6.2 Wayfinder的演进教训

v1.1.0 changelog记录了wayfinder从 `in-progress/` 毕业到 `engineering/` 的重要重构：

1. **重命名**：`decision-mapping` → `wayfinder`。"Decision map" 太术语化且不准确——只有一种ticket类型是真正的决策。
2. **Destination作为leading word**：Wayfinding找的是"去目的地的路"，不是"冲向目的地"。每个map必须有 `## Destination` 字段。
3. **从本地Markdown迁移到issue tracker**：Map变成tracker上的一个issue，tickets是其child issues——一个共享URL让团队可以观看。
4. **Native blocking**：优先使用tracker原生的依赖关系，让frontier在tracker UI中可视化。
5. **HITL/AFK分类**：修复了"学生报告 /wayfinder自己回答自己的grilling问题"的bug——HITL ticket只能通过人工交互解决，agent不能代人回答。
6. **Claim by assignment**：通过assignee而非label来claim ticket——assignee就是claim。

**关键教训：** HITL/AFK分类解决了agent "自问自答"的问题。这与grilling的facts/decisions分离是同一类教训——当skill被自动化调用时，需要明确区分"哪些必须人工"和"哪些可以自动"。

### 6.3 Tracer-bullet Tickets

`to-tickets/SKILL.md` 将工作分解为 **tracer-bullet tickets**——每个ticket是一个完整的垂直切片：

1. **垂直而非水平**：每个切片穿过所有层（schema、API、UI、tests），不是按层水平切分。
2. **可独立验证**：完成的切片可以独立demo或验证。
3. **一个context window**：每个ticket的大小适配一个全新的context window。
4. **Blocking edges**：每个ticket声明它依赖哪些其他ticket——形成DAG（有向无环图）。
5. **Wide refactor例外**：大规模机械式变更（如重命名列）无法做垂直切片，用expand-contract模式序列化。

**设计考虑：** tracer-bullet的核心思想来自The Pragmatic Programmer——"tracer bullets"是打出一条从端到端的完整弹道，每一发都能看到落点。在AI辅助开发中，这意味着每个ticket产出的不是一个层（如"写所有的model"），而是一个可验证的端到端行为。

**设计考虑：** `to-tickets/SKILL.md` 明确指出："avoid specific file paths or code snippets — they go stale fast." tickets追求"agent可以自主判断如何实现"。

**取舍：** 不含代码的tickets保护了TDD的有效性（执行者需要自己写测试和实现），但要求执行者（agent）有足够的能力理解行为描述并转化为代码。

**关键文件：** `to-tickets/SKILL.md`、`wayfinder/SKILL.md`

---

## 7. 其他关键设计模式

### 7.1 Smart Zone与Context Hygiene

`ask-matt/SKILL.md` 引入了 **smart zone** 概念——约120k token的窗口范围内模型推理仍然敏锐。基于此，main flow的步骤1-3（grill-with-docs → to-spec → to-tickets）要求保持在一个不中断的context window中：

> "Keep steps 1–3 in **one unbroken context window** — don't compact or clear until after `/to-tickets` — so the grilling, spec, and tickets all build on the same thinking."

当session接近smart zone边界时，使用 `/handoff` 而非 `/compact`——`/handoff` 会创建一个新session并传递handoff文档，`/compact` 是在同一对话中压缩。`ask-matt/SKILL.md` 明确区分了两者的使用场景：

> "/handoff forks; /compact continues."

**设计考虑：** smart zone概念将"context管理"从隐性的最佳实践变成了显性的设计约束。它承认模型的推理能力有边界，不是无限的。

### 7.2 TDD的简化设计

`tdd/SKILL.md` 在v1.1.0经历了一次重要重构——从step-by-step workflow变成reference-only skill。

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

changelog记录了原因：

> "The red → green → refactor loop is anchored by leading words the model already holds, so the step-by-step Workflow was largely restating the loop."

v1.1.0还做了一个重要的决策——**删除了refactor阶段**：

> "TDD is now red → green; refactoring belongs to the review stage, so the refactor rule and `refactoring.md` moved out (its home is `code-review`)."

同时引入了 **seam** 作为leading word——"test only at pre-agreed seams, confirmed with the user before any test is written."

**三个anti-patterns：**
1. **Implementation-coupled**：mock内部协作者、测私有方法→重构时测试就坏
2. **Tautological**：断言用代码自己的方式重算期望值→永远通过但零信心
3. **Horizontal slicing**：先写所有测试再写所有实现→测的是想象中的行为

**设计考虑：** mattpocock的TDD设计简洁——没有Iron Law、没有Rationalization表。它依赖leading word（red、green、seam、tracer bullet）和reference来引导行为，而非强制约束。

**取舍：** 简化的TDD更容易被采纳，但缺乏强制保障。这反映了mattpocock的基本立场：信任用户和agent的判断力。

### 7.3 Skill写作方法论

`writing-great-skills/SKILL.md` 和 `GLOSSARY.md` 构成了一套完整的skill写作理论体系。这是mattpocock-skills的元贡献——不只是提供skills，还提供如何写skills的理论。

**核心概念：**

| 概念 | 定义 | 示例 |
|------|------|------|
| **Predictability** | agent每次运行走相同的 *过程*，而非产出相同的 *输出* | grilling每次都一次一问，但问题和答案因场景不同 |
| **Information Hierarchy** | 信息放置的优先级 | in-skill step > in-skill reference > external reference |
| **Leading Words** | 利用模型预训练概念用最少token锚定行为 | _fog of war_、_tracer bullets_、_red green_ |
| **Failure Modes** | skill设计的常见失败模式 | premature completion、duplication、sediment、sprawl、no-op、negation |

**Information Hierarchy详解：**
- **In-skill step**：直接写在SKILL.md中的步骤——agent一定会看到
- **In-skill reference**：写在SKILL.md的reference section中——agent按需读取
- **External reference**：指向外部文件的链接——agent需要主动读取

优先使用高层级的信息放置，因为越低层级的信息，agent读取的概率越低。

**Failure Modes详解：**
- **Premature completion**：后续步骤的存在诱导agent跳过当前步骤——解决方法是拆分为独立skill
- **Duplication**：同一逻辑出现在多个skill中——解决方法是提取为model-invoked原语
- **Sediment**：旧规则积累但不再适用——解决方法是定期review和deprecated目录
- **Sprawl**：skill数量膨胀失控——解决方法是合并连续调用的skill
- **No-op**：skill不改变agent的默认行为——解决方法是no-op检测
- **Negation**："don't think of an elephant" 会让大象更突出——解决方法是描述目标行为

**Negation** 的设计特别有趣——"don't think of an elephant" 会让大象更突出，所以应该描述目标行为（"write one-line comments"）而非禁止行为（"don't write verbose comments"）。mattpocock认为正面列出反面行为并反驳反而会强化反面行为。这个认知来自认知科学中的"讽刺过程理论"（ironic process theory）——试图抑制某个想法反而会让它更突出。

### 7.4 Diagnosing Bugs的反馈循环优先

`diagnosing-bugs/SKILL.md` 的核心设计是 **Phase 1 — Build a feedback loop** 先于一切：

> "This is the skill. Everything else is mechanical. If you have a **tight** pass/fail signal for the bug — one that goes red on _this_ bug — you will find the cause."

设计要求在有任何hypothesis之前先建立反馈循环——"If you catch yourself reading code to build a theory before this command exists, **stop — jumping straight to a hypothesis is the exact failure this skill prevents.**"

10种构建反馈循环的方式按优先级排列：failing test > curl/HTTP > CLI invocation > headless browser > replay trace > throwaway harness > property/fuzz > bisection > differential > HITL bash script。

**设计考虑：** mattpocock的版本具体列出了10种构建循环的方式，并引入了 "tight"（快速、确定性、agent可运行）的完成标准。

---

## 8. 能力边界

### 8.1擅长

- **小巧可组合**：~20个promoted skill，每个都很短（grilling 13行，implement 15行），可以独立使用或组合
- **需求澄清方法论**：grilling的"一次一问+推荐答案+事实/决策分离"是独特且实用的设计
- **领域语言建模**：CONTEXT.md + ADR的极简设计让DDD思想以最低成本落地
- **双轴代码审查**：Standards + Spec的分离避免了维度互相遮蔽
- **超大规模规划**：Wayfinder的fog-of-war渐进式探索适合真正模糊的大工作
- **Skill写作理论**：`writing-great-skills` 提供了一套完整的skill设计词汇表
- **工程基础扎实**：TDD、debugging、codebase design、prototype各有独立的discipline skill

### 8.2不擅长

- **统一流程约束**：不拥有流程意味着没有HARD-GATE、没有强制执行——完全依赖用户自律
- **Spec演进追踪**：`to-spec` 产出的是一次性PRD/spec文档，没有delta机制、没有source of truth、没有archive合并
- **变更可审计**：没有change文件夹完整保留机制
- **自动化工具**：纯Markdown skill，没有CLI工具、没有schema系统、没有validation逻辑
- **多平台适配**：通过 `skills.sh` 安装器适配多个agent平台，但深度有限
- **并行变更管理**：没有bulk archive和冲突检测机制
- **自动化触发**：没有hooks系统、没有session start自动bootstrap

### 8.3演进模式

从CHANGELOG可以看出mattpocock-skills的演进特征：

1. **从碎片化到统一**：`to-prd` → `to-spec`，`to-plan` + `to-issues` → `to-tickets`——减少skill数量，降低认知负担
2. **从复杂到简化**：TDD从step-by-step workflow变成reference-only——"the loop is anchored by leading words the model already holds"
3. **从本地到协作**：wayfinder从本地Markdown文件迁移到issue tracker——"a shared URL the team can watch"
4. **从隐性到显性**：grilling的facts/decisions分离、HITL/AFK分类——当skill被自动化调用时，需要显式区分人工和自动
5. **从粗糙到精细**：code-review增加Fowler smell baseline、grilling增加确认门控——逐步加强而非一步到位

---

## 9. 演进中的关键教训

| 教训 | 来源 | 修复 |
|------|------|------|
| "能从代码推断就别问用户"被过度泛化，agent开始替用户做决策 | v1.1.0 grilling | 引入Facts vs. Decisions分离，事实自查、决策必问 |
| Wayfinder中agent自问自答grilling问题（学生报告的bug） | v1.1.0 wayfinder | HITL/AFK分类，HITL ticket只能通过人工交互解决 |
| to-prd / to-plan / to-issues三个skill总是连续调用，拆分增加认知负担 | v1.1.0 | 合并为to-spec + to-tickets，减少skill数量 |
| TDD step-by-step workflow与leading word重复 | v1.1.0 | 改为reference-only skill，删除冗余workflow |
| refactor阶段放在TDD中导致职责模糊 | v1.1.0 | 删除refactor阶段，移至code-review skill |
| ask-matt router遗漏了5个skill（tdd、diagnosing-bugs等） | v1.1.0 | 大规模同步修正，写入CLAUDE.md维护规则 |
| wayfinder在没有fog时仍然走完整流程 | v1.1.0 | 增加no-fog early exit，足够小则直接停止 |
| decision-mapping命名不准确且过于术语化 | v1.1.0 | 重命名为wayfinder，引入destination概念 |
| Map存储在本地Markdown无法团队协作 | v1.1.0 | 迁移到issue tracker，shared URL可观看 |

**模式：** 从碎片到合并，从复杂到简化——mattpocock-skills的演进主线是不断合并连续调用的skill、删除与模型内在能力重复的workflow、将隐性规则显性化（Facts/Decisions、HITL/AFK）。

---

## 10. 设计决策清单

以下是从源码分析中提取的mattpocock-skills的核心设计决策：

| # | 设计决策 | 为什么这么做 | 之前出了什么问题 |
|---|---------|-------------|----------------|
| 1 | User-invoked vs Model-invoked二分法 | 编排skill零context load，纪律skill可被自动触发 | 所有skill都是model-invoked时context window被大量description占用 |
| 2 | `disable-model-invocation: true` 技术实现 | 一行frontmatter实现user-only触发 | 无此标志时agent会自动触发编排类skill |
| 3 | "不拥有流程"立场 | 用户保留控制权，流程bug易修复 | 框架拥有流程时，流程bug难以修复且限制用户自由 |
| 4 | grilling一次一问 | "Asking multiple questions at once is bewildering" | 多问一次时用户漏答或答错关联问题 |
| 5 | grilling每问附推荐答案 | 用户可以快速确认或修正，降低交互成本 | 无推荐答案时用户需从零思考每个问题 |
| 6 | grilling事实/决策分离 | 防止agent在被其他skill调用时替用户做决策 | 原来统一规则"能查就查"被泛化为"替用户做决策" |
| 7 | grilling确认门控 | "turning 'shared understanding' into an explicit stop-gate" | 无门控时agent在理解未对齐时就开始执行 |
| 8 | CONTEXT.md纯术语表 | 避免变成spec或scratch pad | 混合内容时术语表腐化为过时文档 |
| 9 | CONTEXT.md `_Avoid_` 列表 | opinionated——消除同义词歧义 | 无Avoid列表时同义词混用导致命名不一致 |
| 10 | ADR极简格式（一句话即可） | 降低创建门槛 | 传统ADR模板section太多，agent和人都会跳过 |
| 11 | ADR三条件触发（hard to reverse + surprising + real trade-off） | 避免记录琐碎决策 | 无触发条件时要么不记录、要么记录太多噪声 |
| 12 | code-review双轴分离（Standards + Spec） | "stops one axis from masking the other" | 合并审查时标准通过但spec不符的问题被遮蔽 |
| 13 | 双轴parallel sub-agents | 互不污染context | 单reviewer的context被两个维度混合 |
| 14 | 不合并双轴报告 | "the two axes are deliberately separate" | 合并报告时一个维度的问题被另一个维度掩盖 |
| 15 | Fowler smell baseline always-on | 即使repo无标准文档也有最低基线 | repo无标准文档时Standards轴无检查依据 |
| 16 | tracer-bullet tickets（垂直切片） | 端到端可验证，适配一个context window | 水平切片（按层）无法独立验证 |
| 17 | tickets不含代码和文件路径 | "they go stale fast" | 包含代码片段的plan在实现时已过时 |
| 18 | blocking edges DAG | 支持frontier tickets并行执行 | 串行依赖导致无依赖的ticket被阻塞 |
| 19 | wide refactor expand-contract | "no vertical slice can land green" | 大规模机械式变更无法做垂直切片 |
| 20 | Wayfinder fog of war | "don't chart what you can't yet see" | 传统WBS要求自顶向下完全分解，对模糊工作不适用 |
| 21 | Wayfinder "plan, don't do" | 产出决策而非交付物，到达边缘时handoff | 规划阶段直接做工作会导致规划不完整 |
| 22 | Wayfinder HITL/AFK分类 | 防止agent自问自答（学生报告的bug） | 无分类时agent代人回答HITL问题 |
| 23 | Wayfinder claim by assignment | assignee就是claim，释放label词汇 | 用label claim时label词汇被占用 |
| 24 | TDD reference-only（无workflow） | "loop is anchored by leading words" | step-by-step workflow与leading word重复 |
| 25 | TDD删除refactor阶段 | "refactoring belongs to the review stage" | refactor在TDD中导致职责模糊 |
| 26 | TDD seam作为leading word | "test only at pre-agreed seams" | 无seam约定时agent随意选择测试点 |
| 27 | smart zone概念（~120k token） | 显式承认模型推理边界 | 假设context无限导致compaction后推理质量下降 |
| 28 | /handoff vs /compact区分 | "forks vs continues" | 混用导致context要么丢失要么被压缩 |
| 29 | ask-matt router skill | 降低cognitive load（一个入口） | user-invoked skill增多时用户记不住 |
| 30 | prototype throwaway from day one | "keep the answer, delete the code" | 原型代码混入生产代码 |
| 31 | diagnosing-bugs反馈循环优先 | "no red-capable command, no Phase 2" | 直接读代码建理论导致错误假设 |
| 32 | writing-great-skills negation规则 | "don't think of an elephant" 反效果 | 禁止性描述反而强化被禁止的行为 |
| 33 | writing-great-skills no-op检测 | "does it change behaviour versus the default?" | 无此检测时skill不改变默认行为 |
| 34 | setup-matt-pocock-skills一次性配置 | 统一issue tracker、triage labels、domain docs | 手动配置遗漏或不一致 |
| 35 | promoted/non-promoted仓库分界 | 发布渠道与实验场在同一仓库 | 不区分时in-progress和deprecated skill造成噪音 |

---

## 11. 总结

mattpocock-skills的核心贡献不在于流程设计（它明确不设计流程），而在于：

1. **需求澄清方法论**：grilling的"一次一问+推荐答案+事实/决策分离"是一个经过实践检验的轻量级需求澄清模式
2. **领域语言建模**：CONTEXT.md + ADR的极简设计让DDD思想以最低成本落地到AI辅助开发
3. **Skill写作理论**：`writing-great-skills` 提供了一套完整的skill设计词汇表（predictability、leading word、information hierarchy、failure modes）
4. **双轴代码审查**：Standards + Spec的分离设计避免了维度互相遮蔽
5. **User-invoked vs Model-invoked二分法**：将"谁触发"编码为技术架构，明确区分编排和纪律
6. **Wayfinder渐进式探索**：fog-of-war模式适合真正模糊的超大工作规划

它的局限也很明确：缺乏流程强制保障、缺乏spec演进追踪、缺乏自动化工具。这些局限是"不拥有流程"立场的必然结果——如果你不拥有流程，就不能强制执行它。

---

点击下方"**阅读原文**"进入我的演示网站。
