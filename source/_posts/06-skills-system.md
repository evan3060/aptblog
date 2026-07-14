---
title: Skills系统：两层加载与自演化规划
description: >-
  理解skill在agent中的「知识层」定位，两层加载机制如何平衡内置与定制、最小frontmatter设计理念、L1索引与token
  预算截断、热重载联动，以及三种skill管理方案的对比
tags:
  - Skills
  - 系统提示
  - 热重载
  - Token管理
date: '2026-07-02'
categories:
  - Agent实践
  - 核心特性深入篇
difficulty: intermediate
reading_time: 15
prerequisites:
  - 01-what-is-agent
  - 04-tool-system
lang: zh-CN
---

Tool系统给了agent "做事"的能力，但当agent面对"如何用这些工具做事"的问题时，还需要另一层知识——**使用工具的"智慧"**。

一个bash工具加100条"如何用bash完成X任务"的指南，比单纯加10个新工具更有效。因为agent不会自动知道"要查磁盘空间该用 `df -h`""要搜索文件该用 `find . -name`""要查看运行中的进程该用 `ps aux`"。这些是"使用工具的知识"，不是工具本身。

Skills系统就是承载这类知识的模块。它是agent的"知识层"——告诉agent在什么场景下用什么工具、按什么步骤操作、需要注意什么陷阱。

但这里有一个核心矛盾：**知识越多，system prompt越臃肿**。把所有skill的描述都塞进system prompt，agent知道所有事情，但token成本爆炸；只放少量skill，agent不知道很多事，错过最佳方案。如何平衡"知识广度"和"token成本"，是skills系统设计的核心命题。

这篇文章会从skill系统的基本概念讲起，对比几种主流的知识注入方案，然后深入看aptbot如何通过"两层加载 + 频率索引"来平衡这个矛盾。

## 一、概念：什么是skill，为什么需要skill系统

### 1.1 skill是什么：使用工具的知识

Skill不是工具。工具是"做什么"的能力（读文件、写文件、执行命令），skill是"怎么用工具完成一个任务"的知识。

用现实世界类比：
- 工具是一把锤子、一把螺丝刀、一把锯子
- Skill是"如何用这些工具做一个书架"——先锯木板 → 打孔 → 拧螺丝 → 打磨

agent也是一样。它已经有了bash、read、edit这些工具，但面对"帮我修复这个TypeScript类型错误"时，它需要知道：先读文件理解错误上下文 → 检查类型定义 → 修改代码 → 运行tsc验证 → 运行测试确保没破坏其他东西。这不是一个工具调用能完成的，而是一套"操作流程"的知识。

Skill文件通常是一个markdown文档，包含：
- **描述**：告诉agent这个skill在什么场景下有用
- **指南正文**：具体的操作步骤、注意事项、最佳实践

### 1.2 skill与tool的关系

Tool和skill在agent中扮演不同角色，但协同工作：

| | Tool | Skill |
|---|---|---|
| 回答的问题 | "agent能做什么" | "agent知道该怎么做" |
| 载体 | TypeScript函数 + schema | Markdown文档 |
| 如何注入 | function calling定义 | system prompt或context中 |
| 执行方式 | 模型直接调用 | 模型阅读后自主决策 |
| 安全边界 | 代码层硬校验 | 无（只是知识，不执行） |

简单说：**tool是"可执行的操作"，skill是"什么时候用什么操作的知识"**。

### 1.3 skill注入的token成本问题

Skill的知识要"喂"给LLM，最常见的方式是注入到system prompt中。但每一篇skill的description甚至全文都要占用token。

假设你有50篇skill，每篇description平均50 token（约35-40个汉字），总计2500 token。每次LLM调用都要为这2500 token付费（时间和金钱），无论这次调用是否真的需要这些skill。在100轮对话中，就是25万token纯粹花在"列目录"上。

如果加上skill的完整内容（每篇可能500-2000 token），这个数字更加惊人。所以"把所有skill都注入"的方案是不可持续的——它把"知识多"的成本变成了每次调用都要支付的固定开销。

## 二、通用设计方案

### 2.1 skill的管理策略

不同的agent项目在skill管理上有三个维度的决策：

**来源维度**：skill从哪来？
- 完全由项目内置（开箱即用，但不可定制）
- 完全由用户编写（高度定制，但上手成本高）
- 内置 + 用户自定义（两者结合）

**注入维度**：skill如何进入模型上下文？
- 全量注入：所有skill的description（或全文）随每次请求一起发送
- 按需注入：只在需要时检索并注入相关skill
- 混合注入：description全量注入（让模型知道有什么skill），全文按需加载

**更新维度**：skill如何变更？
- 静态：skill文件只在发布时更新
- 热重载：修改skill文件后即时生效，无需重启
- 自演化：agent自己创建和更新skill

### 2.2按需检索vs全量注入

按需注入的核心挑战是"模型不知道自己不知道什么"。如果某个skill的description不在当前上下文中，模型永远不会知道存在这个skill，自然不会请求它。所以按需注入需要一个外部的检索系统来判断"当前对话可能需要什么skill"。

常见的检索策略：

1. **关键词匹配**：把当前用户输入的关键词与skill description做匹配。简单但精度低。
2. **嵌入向量检索**：把skill description和当前对话都转成向量，计算相似度。精度高但需要嵌入基础设施。
3. **最近使用优先**：记录每个skill的最后使用时间，最近常用的skill优先注入。无需语义理解，实现简单。

这三种策略没有绝对优劣——关键词匹配最适合"精确触发"的场景（用户明确说"帮我跑测试"→ 注入test skill），向量检索最适合"模糊发现"的场景（用户说"代码好像有点问题"→ 注入debugging skill），最近使用优先最适合"习惯适配"的场景（用户这两天一直在用git skill → git skill优先注入）。

### 2.3 skill的生命周期

一个skill从创建到废弃，通常会经历：

1. **创建**：用户或项目编写markdown文件
2. **注册**：文件放入约定的目录，系统扫描发现
3. **索引**：skill进入L1索引（被列入"可用skill"列表）
4. **注入**：在适当的时机进入system prompt或context
5. **使用**：agent阅读skill内容并据此行动
6. **更新**：内容修改后通过热重载生效
7. **废弃**：不再使用的skill从索引中移除

## 三、市面其他skill管理方案对比

不同agent项目对"如何管理使用工具的知识"这个问题的回答差异很大。以下是三种有代表性的路线。

### 3.1方案A：全部预置，无用户扩展

这套路线的做法是：项目自带一套完整的skill库，用户不能添加、不能修改、不能删除。Skill的内容由项目维护者编写和更新。

**设计特点：**

- **统一的skill库**：所有用户共享同一套skill，版本由项目发布节奏控制
- **无自定义路径**：用户无法编写自己的skill，也无法覆盖内置skill
- **全量或精选注入**：要么把所有skill description都注入，要么由项目维护者精选一部分注入

**优势：**

- 质量可控——所有skill经过项目维护者review，不存在低质量或错误的skill
- 用户零配置——clone即用，不需要理解skill系统的概念
- 一致性好——所有用户拥有相同的agent行为

**劣势：**

- **僵化**：用户无法为特定项目定制skill。比如公司monorepo的独特测试流程、团队的代码规范——这些知识永远无法进入skill系统。
- **依赖项目发布节奏**：如果项目维护者更新了某个skill，用户需要升级整个项目才能获得更新。
- **无法覆盖错误**：如果内置某个skill写得不好（比如推荐了过时的命令），用户只能忍受，不能修正。

### 3.2方案B：全部用户自写，无内置

这套路线走向另一个极端：项目不提供任何内置skill，完全由用户自己编写。用户为自己的项目、自己的工作流编写专属skill。

**设计特点：**

- **零内置skill**：项目clone后，skill目录是空的
- **用户完全自行编写**：每个skill由用户根据需求创建
- **灵活度最高**：用户可以精确控制agent知道什么、不知道什么

**优势：**

- 高度定制——agent的知识完全适配用户的工作模式
- 没有"多余"的skill——不会为不需要的场景付出token成本
- 用户对agent行为有完全控制

**劣势：**

- **上手成本高**：新用户clone项目后，agent没有任何"使用知识"。问它"如何调试TypeScript"它不知道——需要用户先写一个debug-skill。
- **知识绝缘**：用户A写的好skill无法共享给用户B（除非手动复制），社区无法积累通用知识。
- **维护负担重**：用户需要自己维护所有skill的更新和正确性。随着时间推移，skill库可能越来越臃肿或过时。

### 3.3方案C：两层加载 + 按使用频率动态截断

这套路线结合了方案A和方案B的优点：内置skill提供"开箱即用"的基础能力，用户自定义skill提供"项目特化"的定制能力；同时通过按使用频率动态截断机制控制token成本。

**设计特点：**

- **两层加载**：builtin层（项目内置）和workspace层（用户自定义），同名skill以workspace版本为准（覆盖）
- **最小frontmatter**：只要求name和description两个字段，降低skill编写门槛
- **L1频率索引**：按lastUsed降序排列，取前N个注入system prompt（token预算截断）
- **热重载**：修改skill文件即时生效，支持快速迭代

**优势：**

- 开箱即用——内置skill让新用户clone后立即拥有完整能力
- 可定制——workspace层允许用户添加、覆盖任何skill
- token成本可控——全量注入变成按需注入，只有常用skill在system prompt中
- 自适配——用户的skill使用习惯决定了索引顺序，不用手动配置

**劣势：**

- 架构更复杂——需要实现两层加载、覆盖逻辑、频率索引、热重载
- 新skill的"冷启动"问题——刚添加的skill lastUsed为null，在不使用它的场景中可能永远不会出现在索引中（需要特判或兜底策略）
- 社区维护成本——内置skill需要随着项目发展持续更新

### 3.4三种方案对比

| 维度 | 方案A（全部预置） | 方案B（全部自写） | 方案C（两层 + 频率索引） |
|---|---|---|---|
| 开箱即用 | 是 | 否 | 是 |
| 可定制性 | 无 | 完全 | 完全 |
| 上手成本 | 低 | 高 | 低 |
| token成本控制 | 固定（全量或精选） | 用户自控 | 动态（频率截断） |
| 社区共享 | 强（统一skill） | 无 | 中（builtin共享 + workspace私有） |
| 实现复杂度 | 低 | 低 | 中高 |
| 适合场景 | 标准化产品 | 高度定制的工作流 | 学习项目 / 个人agent |

## 四、aptbot的设计特点

aptbot选择了方案C的路线。理由和学习项目的定位一致：既要让新用户一clone就能用（内置skill），又要留出足够的定制空间（workspace覆盖）；既要积累足够的技能知识，又要控制system prompt的token成本（L1频率索引截断）。

### 4.1两层加载：workspace覆盖builtin

aptbot的skill分两层存放：

**builtin skills（内置层）**：随aptbot代码一起发布。存放在项目目录下的约定路径中。这些是"通用技能"——如何调试TypeScript、如何做git操作、如何写测试、如何查文档。每个aptbot新版本可能会增加或更新builtin skill。

**workspace skills（工作区层）**：存放在当前工作目录的 `.aptbot/skills/` 下。这些是"项目特化技能"——比如"在我们公司的monorepo中如何运行测试""这个项目的编码规范""这个项目特有的构建流程"。

加载时，workspace层覆盖builtin层。同名skill以workspace版本为准。这意味着：

- 用户对内置skill不满意？不需要fork aptbot——在workspace下创建同名的skill文件，自己的版本自动生效
- 项目有特殊流程？写一篇workspace skill就行，agent会自动学习
- 想扩展内置skill？在workspace下创建新的skill文件，agent会同时加载内置和workspace的所有skill

两层加载解决的根本问题是"**开箱即用与项目特化的矛盾**"——没有内置skill，新用户面对的是一个"什么都不知道"的agent；没有workspace skill，老用户无法把项目独有的知识教给agent。

![Skills系统架构](/images/06-skills-system/skills-system.png)

### 4.2最小frontmatter：name / description

每个skill文件顶部有一段YAML frontmatter，只要求两个字段：

```yaml
---
name: debug-typescript
description: 如何调试 TypeScript 类型错误，包括 tsc 编译检查、类型断言的正确用法、常见类型错误模式
---
```

为什么只保留两个字段？

因为skill的核心价值在于它的**正文**——具体的操作指南。frontmatter只是"目录索引"，让LLM知道有这个skill存在、什么时候该读它。额外的字段（priority、tags、triggers、author、version等）会带来两个问题：

1. **维护成本**：用户写skill时要填一堆字段。有些字段（如tags）在只有几个skill时可能有用，但skill一多就成了负担——每次新建skill都要想"这个tag合不合理"。
2. **信息噪音**：LLM在决定"要不要用这个skill"时，真正有用的是description——一句话说清楚"这个skill在什么场景下有用"。额外字段对LLM来说可能是噪音，分散对关键信息的注意力。

最小frontmatter的设计哲学是：**强制用户把"何时用"压缩进一句话**。这本身就是好的抽象训练——如果你不能用一句话说清楚一个skill在什么场景有用，说明这个skill可能边界太宽或者太窄。

至于更丰富的元数据（版本控制、分类标签、依赖关系），可以在需要时通过外部工具（如skill市场或目录索引）来管理，不需要侵入skill文件本身的格式。

### 4.3全量description注入的token成本分析

先说最朴素的方案——把所有skill的description都注入system prompt。假设：

- 共有50篇skill（20篇builtin + 30篇workspace）
- 每篇description平均50 token
- 每次LLM调用支付2500 token的"列目录"成本
- 在100轮对话中，总计25万token花在"列目录"上

25万token是什么概念？按GPT-4的价格大约 $5-10，按Claude 3.5大约 $1-2。对于个人项目来说这不是不能接受，但**浪费**——大部分skill在大部分对话中都用不上。用户可能在80% 的时间里只用20% 的skill（符合帕累托分布）。

更关键的是，description注入只是"让模型知道有这个skill"，当模型决定使用某个skill时，还需要加载这个skill的**正文内容**。如果50篇skill的正文全部加载，每篇平均1000 token，就是5万token——这基本填满了小模型（如8K context）的整个context window。

所以"全量注入只适用skill数量极少的情况"（比如不超过10篇）。一旦skill数量增长，就需要更精细的注入策略。

### 4.4 L1索引：lastUsed降序 + 4K token预算截断

aptbot通过L1索引来解决"全量注入"的token浪费问题。策略是：

1. 每个skill维护一个 `lastUsed` 时间戳，记录上次被agent "使用"的时间
2. 在组装system prompt时，所有skill按lastUsed降序排列
3. 从头开始累加每个skill description的token数
4. 达到4K token预算时截断——后面的skill不注入这次system prompt

**效果**：最近常用的skill永远在system prompt里，长期不用的skill沉到索引之外。这把"全量注入"的固定token成本变成"按使用频率注入"的动态成本。

为什么用lastUsed而不是更复杂的relevance score？

1. **简单**：lastUsed是单字段，不需要外部服务来计算
2. **可信**：使用时间是不可伪造的信号——它反映的是agent真实的行为模式，不是语义匹配的"猜测"
3. **自适配**：用户在某项目里频繁使用git skill → git skill的lastUsed不断更新 → 自然排在前面。换项目后几天不用git skill → 它自然沉下去，新项目相关的skill上来

**4K token预算是经验值**。太少（1K）可能导致常用skill也被截断；太多（16K）就失去了"控制token"的意义。4K大约能容纳80-100个skill的description（按平均50 token计算），对于大多数项目的skill数量来说足够覆盖常用集。

但有一个问题：**新skill的冷启动**。一个刚创建的workspace skill，lastUsed是null或0，它在L1索引中排在最后。如果用户不说与它直接相关的话，它可能永远不会出现在system prompt中，于是agent永远不会知道它的存在，永远不会调用它，lastUsed永远不会更新——这就是"冷启动陷阱"。

aptbot的解决方式：新skill的lastUsed初始化为当前时间戳（而不是0），让新skill有机会出现在L1索引顶部。这是一种"新人优先"策略——新skill在一段时间内获得曝光，如果确实被使用，lastUsed会被后续的真实使用刷新；如果一直未被使用，会随着时间推移自然沉底。

### 4.5 read_file特判更新lastUsed

lastUsed的更新机制有一个重要的特判：当agent通过 `read` 工具读取一个skill文件时，自动更新该skill的lastUsed。

为什么需要特判？因为正常情况下，"使用skill"意味着agent把skill正文加载到context中并据此行动。但 `read` 工具是一个通用文件读取工具——agent可以用它读任何文件，包括skill文件。如果不做特判，会发生这样的场景：

1. agent的L1索引中有 `debug-typescript` skill（description在system prompt里）
2. agent判断"这个场景可能需要debug-typescript skill"
3. agent调用read工具读取 `skills/debug-typescript.md` 的正文
4. 它读完了，理解了内容，据此行动——但lastUsed没有更新
5. 下次L1索引排序时，debug-typescript的lastUsed还是旧的，可能被截掉

特判解决了这个问题：**read工具在发现读取路径指向skill目录时，额外更新该skill的lastUsed**。这样agent读取skill的行为被正确地记录为"使用了该skill"，L1索引能反映真实的使用模式。

这是一个很小的设计细节，但它体现了"行为信号补全语义信号"的思路。不是通过模型主动报告"我用了哪个skill"来更新lastUsed（这依赖模型是否诚实、是否准确），而是通过工具执行的副效应来自动更新——更可靠、更无感。

### 4.6热重载联动

Skill是一个频繁迭代的"知识库"。用户在编写skill时，可能写一句就试一次，改一句再试一次。如果每次修改都需要重启aptbot，这个迭代体验会很痛苦。

aptbot的skill系统支持热重载——用户修改了workspace下的skill文件，下一次LLM调用就能自动生效，不需要重启。

热重载的实现与Config、Memory的热重载模式一致：**mtimeNs懒加载**。

具体流程：
1. 在每次LLM调用前，检查skill目录的最新mtimeNs（文件修改时间，纳秒精度）
2. 如果mtimeNs与上一次扫描时不同，说明有文件变更
3. 重新扫描skill目录，重新构建L1索引
4. 更新缓存中的mtimeNs

这个机制的好处是：
- **懒加载**：不浪费资源在"实时监控文件变更"上——只在需要时检查
- **零配置**：用户不需要手动触发"重新加载"命令
- **与现有架构一致**：mtimeNs懒加载已经在配置系统和记忆系统中验证过，skill系统复用同一模式

热重载让skill的编写体验接近于"即时反馈"——保存文件后，在下一句对话中就能验证新skill的效果。对于skill这种本质上是prompt engineering的工作，快速的试错周期至关重要。

## 五、发展方向

### 5.1自演化skill

当前skill是**静态的**——由人或项目编写，agent按需加载。更远期的愿景是**自演化**：agent在执行任务时，如果发现"这个任务的方法值得记下来"，自己写一个新的skill文件存到workspace。

它的意义在于：agent不只是"使用知识"，而且是"创造知识"。一个长期运行的agent，会逐步积累一套属于自己的技能库，越来越适配用户的工作模式。

自演化skill的核心难点：

1. **质量控制**：agent写的skill可能是噪音（"我尝试了X但失败了"不应该存成skill）。需要某种过滤机制——可能由LLM自评、用户审核，或两者结合。
2. **冲突管理**：新skill与现有skill冲突（比如"如何运行测试"有两个版本）时如何处理？优先使用更新的？让用户选择？自动合并？
3. **可解释性**：用户需要能审计agent自建的skill内容，否则就是黑箱。"这个东西是谁写的、什么时候写的、基于什么经验"这些元数据需要保留。

自演化是aptbot L3路线上的长期目标，短期内不会实现。但两层加载、最小frontmatter、热重载这些基础设施已经为它铺好了路——自演化skill本质上就是让agent调用工具在workspace目录下创建、更新markdown文件。

### 5.2 skill市场的社区生态

内置skill目前由aptbot项目维护者编写。未来可以探索社区贡献的skill市场——用户可以把好的workspace skill分享出来，其他人一键安装到自己的内置层。

这样既保留了"开箱即用"（社区精选skill可以成为内置层的一部分），又解决了"用户自写skill的信息孤岛"问题。不过skill市场的运行机制（版本管理、质量审核、依赖管理）是一个完整的平台工程问题，不在aptbot当前MVP范围内。

### 5.3更智能的注入策略

当前的L1索引是基于lastUsed的简单排序截断。未来可以做得更智能：

- **基于对话上下文的动态检索**：除了lastUsed排序，还可以根据当前对话的语义从L2/L3存储中检索相关skill
- **分层的token预算**：不是所有skill都平分4K token预算，而是给"核心skill"（如debug、test、git）预留固定配额，剩余预算给长尾skill竞争
- **skill间的关联推荐**：如果agent正在使用"调试TypeScript" skill，自动提升"如何写测试" skill的排序优先级

这些策略可以逐步叠加，不需要一次性改造整个系统。L1索引的价值就在于它"足够简单，可以作为更复杂策略的基础"。

## 小结

Skills系统是agent的"知识层"，与tool系统的"执行层"互补。这篇文章从三个角度拆解了技能系统的设计：

1. **概念层面**：skill是"使用工具的知识"，不是工具本身。它回答的是"如何做"的问题，承载在markdown文档中。Skill注入的核心矛盾是"知识越多，token越贵"。

2. **方案对比**：方案A（全部预置）开箱即用但不可定制；方案B（全部自写）高度灵活但上手成本高；方案C（两层加载 + 频率索引）通过builtin + workspace分层和lastUsed排序截断，在"开箱即用"、"可定制"、"token成本"三个目标之间取得平衡。

3. **aptbot的选择**：两层加载解决"通用vs特化"的矛盾（workspace覆盖builtin），最小frontmatter降低编写门槛（只需name/description），L1索引按lastUsed排序 + 4K预算截断控制token成本，read_file特判让使用行为准确反馈到索引，热重载赋予skill编写即时迭代的能力。

下一篇是本系列的第7篇文章，我们看Hook系统：8个扩展点如何让agent行为可插拔。
