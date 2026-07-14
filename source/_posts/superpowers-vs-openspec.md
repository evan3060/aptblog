---
title: AI研发流程设计（一）：Superpowers vs OpenSpec vs实践反思
description: 理解Superpowers和OpenSpec两个开源项目的核心设计哲学与能力边界，结合个人实践项目的经验与反思，为设计一个轻量通用的AI研发流程做准备
tags:
  - 工作流
  - TDD
  - Spec
  - 方法论
  - Agent
  - 架构
date: '2026-07-11'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---
# AI研发流程设计（一）：Superpowers vs OpenSpec vs实践反思

> **日期：** 2026-07-11
> **目标：** 理解两个开源项目的核心设计哲学与能力边界，结合两个个人实践项目的经验与反思，为设计一个轻量通用的AI研发流程做准备。

---

## 1. 参照项目定位

| | Superpowers | OpenSpec |
|---|---|---|
| **一句话定位** | AI coding agent的开发执行方法论 | 人与AI之间的规格化变更管理层 |
| **覆盖阶段** | brainstorming → plan → 执行 → 封仓 | explore → propose → apply → archive |
| **核心抽象** | Skill（可组合的能力模块） | Change（一个变更 = 一个文件夹） |
| **约束方式** | 纯markdown，skill自动触发 | CLI工具 + markdown约定 |
| **设计哲学** | 系统化优于即兴，TDD铁律 | 先达成共识，再自信构建 |

**关键观察：两者覆盖研发流程的不同半区，几乎不重叠。**

- Superpowers回答："设计确认后，如何高质量地执行？"
- OpenSpec回答："在写代码之前，如何把变更想清楚、讲明白、可追踪？"

**本文讨论范围：** Superpowers和OpenSpec是成熟的开源项目，作为设计参照的主体。另有两个个人实践项目作为补充——一个提供实践中的观察，另一个提供流程复杂度边界的探索。

---

## 2. Superpowers深度分析

### 2.1工作流主线

```
brainstorming → writing-plans → subagent-driven-development → finishing-a-development-branch
     ↓                ↓                      ↓                          ↓
  spec 文档        plan 文档           TDD + review 循环           merge/PR/discard
```

### 2.2核心特色

**① TDD铁律**
RED → GREEN → REFACTOR，不写失败测试不写生产代码。代码先于测试则删除重来。这不是建议而是"Iron Law"，skill中用大量篇幅列举rationalization表来防止绕过。

**② Subagent驱动开发（SDD）**
每个task派发独立subagent，上下文隔离。两阶段review：spec合规 + 代码质量。Controller策划上下文，artifact以文件传递（不污染context）。支持模型分级（简单task用便宜模型，设计判断用最强模型）。

**③ Brainstorming苏格拉底式对话**
一次一个问题，逐节呈现设计，每节后确认。HARD-GATE：设计未获批准前不写代码。设计文档保存到 `docs/superpowers/specs/`。

**④ Plan极致细化**
每个step是2-5分钟操作，包含精确文件路径、完整代码、验证命令、期望输出。设计哲学是"plan要详细到一个没有品味、没有判断力的初级工程师也能执行"。

**⑤ git worktree隔离**
每个功能分支独立工作区，干净基线。

**⑥ systematic-debugging**
4阶段根因调查（读错误 → 复现 → 查变更 → 追数据流），3次修复失败则质疑架构而非继续修补。

### 2.3能力边界

| 不擅长 | 原因 |
|--------|------|
| Spec演进追踪 | Spec是一次性文档，无source of truth概念，无delta合并 |
| Brownfield增量修改规格化 | 没有"当前行为"的持久化记录，每次都从零开始写设计 |
| 变更可审计 | 只有git log，无法回溯"为什么做这个变更"的完整上下文 |
| 并行变更管理 | 没有change概念，多分支并行靠git隔离但无规格层面的协调 |

---

## 3. OpenSpec深度分析

### 3.1核心模型

```
specs/（当前真相）◄──── merge on archive ──── changes/（拟议变更）
  "系统现在怎么工作"                              "我们想改什么"
```

### 3.2核心特色

**① Spec即行为契约**
`### Requirement:` + `#### Scenario:` + RFC 2119关键词（MUST/SHALL/SHOULD）。行为可测试，不含实现细节。"如果改了实现但不改外部可观察行为，那它不属于spec。"

**② Delta spec**
变更只描述ADDED / MODIFIED / REMOVED，不重写整个spec。天然适配brownfield——不需要先文档化整个系统再修改。

**③ Change是一个文件夹**
```
changes/add-dark-mode/
├── proposal.md    # Why + What + Scope
├── design.md      # How（技术方案）
├── tasks.md       # 实施清单
└── specs/         # Delta spec（行为变更）
```
一切在一个地方。可并行多个change互不冲突。

**④ Archive合并机制**
完成后delta合并回 `specs/`，change归档到 `changes/archive/YYYY-MM-DD-name/`。Spec持续演进，形成完整审计链。

**⑤ "Enablers, not gates"**
依赖图是"可以做什么"而非"必须做什么"。可在任何阶段修改任何artifact，没有瀑布式锁定。

**⑥ Explore探索阶段**
`/opsx:explore` 在产出任何artifact之前先对话探索，不创建文件、不写代码。把模糊问题变成精确变更。

### 3.3能力边界

| 不擅长 | 原因 |
|--------|------|
| 开发执行流程 | 不涉及TDD、code review、subagent等 |
| Task细化 | tasks.md只是简单checklist，无step级TDD驱动 |
| 执行质量门 | 只有可选的verify，无强制review |
| 封仓流程 | 不涉及分支管理、merge决策 |

---

## 4. 个人实践项目一：基于Superpowers的实践观察

> **说明：** 以下内容来自一个基于Superpowers框架的个人实践项目，经历了5个版本迭代。此处提取实践中观察到的关键现象。

### 4.1实践中的观察

**观察一：Plan包含完整代码会削弱TDD有效性**

Superpowers的plan包含每个step的完整代码。但在实践中发现，当plan包含完整代码时，subagent执行者倾向于"照抄plan中的代码"而非"根据测试错误驱动实现"。这削弱了TDD的核心价值——让测试失败信息驱动设计决策。

改为"描述性内容 + 文件路径 + 行为契约 + TDD验证命令"（不含代码）后，TDD的执行质量有所提升。

**观察二：基线测试全绿应作为强制步骤**

Superpowers的 `using-git-worktrees` skill隐含了基线验证，但没有强调"基线必须全绿"。实践中曾因基线不绿导致后续无法区分"新引入的"和"已存在的"测试失败。

**观察三：跨task的代码清晰度问题**

Superpowers有per-task review和whole-branch final review，但实践中发现跨task的重复逻辑和函数膨胀在per-task review中不易发现（reviewer只看单个task的diff）。

**观察四：连续失败时的熔断策略**

Superpowers SDD遇到BLOCKED时选择"升级给人类"。实践中尝试了"连续3次失败 → 切换到其他无依赖task → 全部完成后回来修复"的熔断策略，在长时间自主执行场景下有一定价值。

### 4.2观察的筛选结论

| 观察 | 结论 | 理由 |
|------|------|------|
| Plan不含代码 | 纳入 | 保护TDD有效性 |
| 基线测试全绿 | 纳入 | 回归检测前提，作为task执行前的checklist项 |
| 代码清晰度审查 | 合并到final review checklist | 跨task结构性问题是per-task review的盲区，但不需要独立流程阶段 |
| 熔断机制 | 不纳入核心流程 | 增加复杂度但价值有限，作为可选策略 |

---

## 5. 某研发流程尝试：多Agent契约驱动管线

> **说明：** 以下项目完全通过与多个AI模型讨论设计而成，初衷是解决UAT中界面设计和实际产出不一致的问题。实际使用后效果不如预期，初步怀疑是模型能力不足以支撑如此复杂的流程。此案例的价值在于探索了流程复杂度的边界——哪些设计是有效的，哪些超出了当前模型的能力范围。

### 5.1设计意图

该尝试的核心问题是：AI生成的代码与设计稿之间存在系统性偏差（颜色、圆角、字体等趋向"统计常见值"）。为解决这一问题，设计了：

- **10个专业化Agent**，通过认知隔离（每个agent只看它该看的）实现制衡
- **Contract驱动开发**：从设计稿提取精确的Layout Contract（属性 + 值 + 容差），编译为机器可执行断言
- **三层验证**：Spec合规 → Contract断言 → 代码质量，每层有评分阈值
- **Fix Loop + Arbiter**：失败自动修复，3次失败后Arbiter仲裁
- **脚本化视觉审计**：Playwright截图 + 像素/CIEDE2000色差计算，LLM只做判断不做计算

### 5.2设计中的亮点

该项目有一些有价值的洞察：

1. **认知隔离 ≠ Prompt隔离**：agent隔离不仅是不同的prompt，而是不同的工具权限 + 不同的可见文件 + 不同的上下文。审计agent不给Write/Edit权限，物理上无法修改代码。
2. **计算与判断分离**：LLM不擅长数值计算（色差、像素差异），交给脚本计算，LLM只做定性判断。这一原则在AI研发流程中具有普遍适用性。
3. **Root Cause Gate**：在修复bug前必须通过假设-证伪循环证明根因，防止猜测式修复。这一理念与Superpowers的systematic-debugging高度一致。
4. **Surgical Fix Contract**：修复时只允许修报告中的问题，禁止"顺便优化"，避免引入新问题。
5. **Spec场景到测试的自动转换**：从GIVEN/WHEN/THEN场景自动生成测试骨架（RED phase），确保测试与规格的可追溯性。

### 5.3效果不如预期的原因分析

**① 流程过重**

完整流程是：proposal（10 phase）→ design（11 phase，4个agent）→ build（8 phase，2个agent）→ verify（9 phase，4个agent + fix loop）。一个简单的UI变更需要经过38个phase、10个agent的处理。这超出了当前AI模型的可靠执行能力——模型在超过 ~15步的连续流程中开始丢失上下文和偏离指令。

**② Agent数量过多**

10个agent之间的协调开销巨大。每个agent需要独立的上下文初始化、memory读写、输出文件传递。实际效果是大量token消耗在协调和文件传递上，而非实际开发工作。对比Superpowers的SDD（只需implementer + reviewer两种subagent），复杂度差距悬殊。

**③ 脚本依赖过重**

Contract Compiler、Contract Assertion、VRT Baseline、VRT Assert、Visual Impact、Feasibility Check、Score Calculator——7个TypeScript脚本。这些脚本本身需要维护，且引入了额外的技术栈依赖（Playwright、Pixelmatch、CIEDE2000）。

**④ 评分系统的假精确**

视觉审计用95分阈值，看似精确，但实际上CIEDE2000色差 + 像素diff的"95分"与人类感知的"95% 相似"不是一回事。假精确给人虚假的信心，但实际用户体验可能完全不同。

**⑤ 核心问题可能不在流程**

界面设计与产出不一致的问题，可能更多是模型能力问题——随着多模态模型能力提升，直接给模型看设计稿并要求精确复刻，效果可能比复杂的contract机制更好。流程无法弥补模型能力的不足。

### 5.4经验提炼

该项目虽然在当前模型能力下效果不如预期，但其设计思路中的有效部分和超出能力的部分都值得记录：

| 经验 | 具体表现 | 对新流程的参考价值 |
|------|---------|---------------|
| **流程步骤不应超过模型可靠执行能力** | 38 phase连续流程，模型在后期严重偏离 | 核心流程应控制在 ~10步以内 |
| **Agent数量应最小化** | 10个agent的协调开销过大 | 核心角色不超过3个 |
| **脚本依赖应最小化** | 7个TypeScript脚本增加维护负担 | 除非必要不引入脚本，纯md优先 |
| **不要用流程弥补模型能力** | Contract机制试图用流程解决模型视觉偏差 | 模型能力问题应通过换模型解决 |
| **假精确不如无精确** | 95分阈值给人虚假信心 | 质量判断用"通过/不通过 + 具体问题"更诚实 |
| **认知隔离是有价值的设计** | 审计agent无Write权限，物理上无法改代码 | 可简化为：审查者不直接修改代码 |
| **计算与判断分离值得保留** | 脚本算色差，LLM做判断 | LLM不擅长的确定性计算交给工具 |
| **Spec场景到测试的自动转换** | GIVEN/WHEN/THEN → 测试骨架 | 确保spec与测试的可追溯性 |

---

## 6. 四方对比矩阵

| 维度 | Superpowers | OpenSpec | 个人实践项目一 | 某研发流程尝试 |
|------|------------|---------|------------|------------|
| **Spec格式** | 自由格式设计文档 | 结构化行为契约 | 自由格式设计文档 | 结构化行为契约 + Contract DSL |
| **Spec演进** | 一次性，无追踪 | Delta + Archive合并 | 一次性，无追踪 | Delta + Archive（借鉴OpenSpec） |
| **Plan格式** | 极细化，含完整代码 | 简单checklist | 描述性，行为契约 + TDD命令 | 微任务 + 精度上下文注入 |
| **执行方式** | Subagent + TDD + 两阶段review | `/opsx:apply`（简单） | Subagent + TDD + review | 10 agent认知隔离 + 三层验证 + Fix Loop |
| **质量门** | code review + verification | verify（可选） | 代码清晰度三审 + 回归 | 评分阈值 + Fix Loop + Arbiter |
| **工具复杂度** | 纯markdown，无CLI | CLI + schema + config | 纯markdown | 7个TS脚本 + Playwright + 配置文件 |
| **流程步骤数** | ~15步（brainstorm → 封仓） | ~5步（explore → archive） | ~20步（P0 + A循环 + B循环） | ~38 phase + 10 agent |
| **核心角色数** | 2（implementer + reviewer） | 0（无agent概念） | 2（同Superpowers） | 10（专业化agent） |
| **设计起点** | 通用AI研发 | 通用AI研发 | Superpowers实践增强 | UI设计-实现偏差问题 |

---

## 7. 关键设计张力

从四个项目的对比中，提炼出三个核心设计张力：

### 张力一：Plan中是否包含代码？

- **Superpowers立场**：包含完整代码。理由是让"无品味的初级工程师"也能执行，减少执行时的判断偏差。
- **个人实践观察**：不包含代码，用行为契约 + TDD命令替代。理由是含代码的plan会让执行者变成"转录器"而非"TDD驱动者"。
- **OpenSpec立场**：不涉及（tasks.md只是checklist）。
- **某研发流程尝试立场**：不含代码，用Contract + 精度上下文注入替代。

**核心矛盾**：plan的详细程度与TDD的有效性之间存在反向关系。plan越详细（含代码），TDD越沦为"按plan写代码然后补测试"；plan越抽象（行为契约），TDD越能真正驱动设计，但对执行者的能力要求更高。

### 张力二：Spec是一次性文档还是持续演进？

- **Superpowers立场**：一次性设计文档，用完即弃。
- **OpenSpec立场**：source of truth，delta合并，持续演进。
- **个人实践**：一次性设计文档，与Superpowers一致。
- **某研发流程尝试立场**：尝试引入delta（借鉴OpenSpec），但实际效果未验证。

**核心矛盾**：持续演进的spec提供了brownfield支持和审计能力，但增加了维护成本。一次性spec轻量但无法回答"系统当前到底怎么工作"。

### 张力三：纯markdown约束vs工具强制

- **Superpowers立场**：纯markdown，skill自动触发，零工具依赖。
- **OpenSpec立场**：CLI工具驱动，JSON机器可读接口，schema校验。
- **个人实践**：纯markdown，与Superpowers一致。
- **某研发流程尝试立场**：重度工具依赖（7脚本 + 配置），维护成本高。

**核心矛盾**：OpenSpec的delta合并、spec校验等能力依赖工具实现。纯markdown方式下，这些能力只能靠"约定"——agent是否会一致遵守？某研发流程尝试的经验表明，工具依赖一旦膨胀就难以控制。但如果完全不用工具，delta合并等能力如何保证？

---

## 8. 批判性分析：个人实践中的增强项是否应该纳入

> **判断原则：** 每当考虑引入新流程环节时，必须回答三个问题：
> 1. 为什么Superpowers / OpenSpec没有涉及？
> 2. 我是否必须纳入？
> 3. 我的理由是什么？

### 8.1基线测试全绿

- **为什么开源项目没做？** Superpowers的 `using-git-worktrees` skill隐含了基线验证，但没有将其提升为独立的强制阶段。OpenSpec不涉及执行层。
- **是否必须纳入？** 基线测试全绿是回归检测的前提。如果从一个broken baseline开始，后续测试失败无法区分是"新引入的"还是"已存在的"。
- **理由：** 这是工程常识，不需要复杂机制，一个checklist项即可。
- **结论：** 纳入。作为task执行前的checklist项，不需要独立"阶段"。

### 8.2 Plan不含代码

- **为什么开源项目没做？** Superpowers的设计哲学是"plan要详细到任何人能执行"，代码是实现这一目标的手段。OpenSpec不涉及plan细化。
- **是否必须纳入？** 取决于执行者是谁。如果执行者是subagent且遵循TDD，含代码的plan会削弱TDD价值。如果执行者是人类或非TDD agent，含代码的plan更安全。
- **理由：** 新流程如果以TDD为核心，plan不含代码是必要的。
- **结论：** 纳入。作为plan格式规范，md约定。

### 8.3代码清晰度审查（去重→拆分→统一）

- **为什么开源项目没做？** Superpowers的per-task review + whole-branch final review理论上覆盖了代码质量。其设计假设是"如果每个task的review做好了，整体质量就有保障"。OpenSpec不涉及执行层。
- **是否必须纳入？** per-task review确实能发现大部分问题。但实践中发现，跨task的重复逻辑和函数膨胀在per-task review中不容易发现，因为reviewer只看单个task的diff。
- **理由：** 跨task的结构性问题是per-task review的盲区。
- **结论：** 合并到final review的checklist中，而非独立流程阶段。

### 8.4熔断机制

- **为什么开源项目没做？** Superpowers SDD的BLOCKED状态处理方式是"升级给人类"或"换更强模型重试"。其设计哲学是"遇到阻塞就停下来问人"。
- **是否必须纳入？** 取决于使用场景。如果agent被期望长时间自主执行，熔断能提高吞吐。如果人类始终在场（Superpowers假设），BLOCKED → 升级即可。
- **理由：** 对于"轻量通用"的目标，熔断增加了流程复杂度但价值有限。
- **结论：** 不纳入核心流程，作为可选策略。

---

## 9. 某研发流程尝试的经验对新流程的约束

该尝试虽然在当前模型能力下效果不如预期，但其探索为理解流程复杂度的边界提供了有价值的参考。以下是从中提炼的设计约束：

| 约束 | 来源 | 对新流程的要求 |
|------|------|---------------|
| 核心流程 ≤ ~10步 | 38 phase超出模型可靠执行能力 | 砍掉一切非必要环节 |
| 核心角色 ≤ 3个 | 10 agent协调开销过大 | 执行者 + 审查者（+ 人类决策点） |
| 脚本依赖最小化 | 7脚本增加维护负担 | 纯md优先，除非delta合并等能力确实需要工具 |
| 不用流程弥补模型能力 | Contract机制试图用流程解决模型偏差 | 模型能力问题 → 换模型，不叠加流程层 |
| 质量判断用"通过/不通过" | 假精确的95分阈值 | 不用评分系统，用"通过 + 具体问题列表" |

---

## 10. 初步结论

### 10.1互补关系确认

Superpowers和OpenSpec在研发流程上高度互补：
- **OpenSpec擅长**：变更规格化、spec演进追踪、brownfield支持、变更可审计
- **Superpowers擅长**：TDD执行、subagent驱动、code review、调试方法论

两者的结合方向是清晰的：**OpenSpec的spec/change管理前置，Superpowers的执行流程后置**。

### 10.2个人实践的筛选结论

从个人实践中筛选出的设计决策：

| 观察项 | 结论 | 形态 |
|--------|------|------|
| Plan不含代码 | 纳入 | plan格式规范，md约定 |
| 基线测试全绿 | 纳入 | task执行前checklist项 |
| 代码清晰度审查 | 纳入 | 合并到final review checklist |
| 熔断机制 | 不纳入核心流程 | 可选策略 |

### 10.3某研发流程尝试的启示

该尝试的核心启示是：**流程复杂度必须与模型可靠执行能力匹配**。一个理论上完善的流程，如果超出了模型的可靠执行能力，实际效果反而不如简单流程。同时，该尝试中的认知隔离、计算与判断分离、Spec场景到测试的自动转换等设计思路是有价值的，可以在简化后融入新流程。新流程必须以复杂度上限为硬约束，同时不丢弃已被验证有效的设计理念。
