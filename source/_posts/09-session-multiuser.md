---
title: Session与多用户：持久化、隔离、多端同步
description: >-
  从session管理的基本问题出发，对比三种持久化方案的设计取舍，深入aptbot的JSONL + sidecar
  存储、权限控制、两级缓存、多端同步的最终一致性模型与多用户租户隔离
tags:
  - 会话
  - 多用户
  - 持久化
  - 缓存
  - 隔离
date: '2026-07-02'
categories:
  - Agent实践
  - 核心特性深入篇
difficulty: intermediate
reading_time: 18
prerequisites:
  - 08-channel-transport
lang: zh-CN
---

上一篇文章讲了Channel——多端接入的抽象。Channel解决的是"事件怎么传"的问题，但没解决"状态怎么管"的问题。

一个agent实例要同时服务多个用户：每个用户有多个session（会话），每个session需要跨端切换、断线重连后恢复上下文、长期使用后积累历史——这些都是Channel管不了的。Channel只负责传输，不负责存储和状态管理。

Session系统就是填补这个空白的。它管理session的生命周期、存储session的历史数据、控制用户对session的访问权限、在多个客户端之间同步session的状态变化。可以把Session系统理解为agent的"状态持久化层"——它确保agent和用户之间的对话不会因为连接断开或进程重启而丢失。

这篇文章从session的基本概念讲起，对比三种持久化方案的取舍，然后深入看aptbot如何通过JSONL + sidecar存储、两级缓存、ownership权限控制和多端同步机制来实现一个轻量但完整的Session系统。

## 一、概念：什么是session，为什么需要session管理

### 1.1 session的定义

在agent系统中，**session（会话）** 是用户与agent之间一次交互的完整记录。它包括：

- 对话历史：用户说了什么、agent回复了什么
- 元数据：session标题、创建时间、最后活动时间、owner、标签等
- 上下文状态：当前正在执行的任务、已经调用的工具、待处理的事项

一个session从创建开始，持续到用户显式关闭或系统因长期不活跃而回收。在此期间，用户可以随时断线重连，但session不会丢失——它被持久化到磁盘。

session与"连接"的关系在上一篇文章中已经讨论过：session独立于连接存在。多个连接可以绑定到同一个session（多端同步），连接断了session还在（断线恢复）。

### 1.2 session的职责边界

在一个agent系统中，session承担了三层职责：

**存储层**：session数据的持久化。磁盘上的文件、数据库中的表、内存中的缓存。决定了数据是否能在进程重启后存活。

**状态管理层**：session的生命周期管理。创建、激活、暂停、恢复、关闭。控制session的完整生命周期。

**安全层**：session的访问控制。谁可以创建session、谁可以读取session、谁可以删除session。在多用户场景中，这一层确保用户A不能看到用户B的对话。

### 1.3为什么session不能被Channel替代

一个常见的疑问：既然Channel是连接，session也是连接，两者有什么不同？为什么不能合并？

关键区别在于职责：

- **Channel是"传输"**：它是一条管道，负责把事件从服务端送到客户端。管道是易逝的——网络断开、客户端崩溃、用户刷新页面，管道就没了。
- **Session是"记录"**：它是一份档案，存储着对话的所有信息。档案是持久的——即使所有管道都断了，档案还在，下次连接时重新打开。

用文件系统做类比：Channel是文件描述符（打开文件时操作系统分配的一个编号，进程重启就没了），Session是磁盘上的文件（进程重启后还在，重新打开就行）。

没有session层，Channel断了之后，agent的所有上下文就丢失了。有了session层，Channel断了再重建一个，接回同一个session，agent继续干活。

## 二、通用设计方案：session管理的三个核心维度

session系统的设计可以从三个维度来分析。

### 2.1持久化策略

Session数据存哪里？这是最基础的设计决策。三种常见选择：

**纯内存**：session数据只保存在进程内存中。读写最快（纳秒级），但进程重启后数据全部丢失。适合session不需要长期保留的场景。

**文件存储**：每个session保存为一个（或一组）文件。常见格式有JSONL（每行一个JSON对象，append-only）、JSON（整个文件解析）、CSV。零依赖（只需要文件系统），但需要自己管理并发访问和一致性。

**嵌入式数据库**：SQLite是最常见的选择。支持事务、索引、SQL查询。功能完整，但需要额外的库依赖。二进制格式，不能直接用文本编辑器查看和调试。

### 2.2多用户隔离

在单用户场景中，session系统只需要管"存和取"。但多用户场景中必须回答：用户A能不能看到用户B的session？

三种常见的隔离策略：

**目录隔离**：每个用户的session文件放在各自的目录中。比如 `sessions/userA/` 和 `sessions/userB/`。通过文件系统的路径来控制访问。简单但粒度粗糙——如果路径遍历防护没做好，可能越权访问。

**字段隔离**：所有session存在同一个存储中，每个session记录带一个 `owner` 字段。读取时按 `owner` 过滤。更灵活——可以支持session共享（设置 `owner` 为特定值表示"共享"），但需要查询层支持按owner过滤。

**租户隔离**：完全独立的存储实例。用户A用SQLite文件A，用户B用SQLite文件B。隔离最强（一个用户的数据损坏不影响另一个用户），但管理成本高（每个用户一个文件）。

### 2.3客户端同步

在多端接入场景中，session的状态变化需要同步给所有连接的客户端。同步策略的核心问题是：**谁负责保证客户端看到的是最新状态？**

**最终一致性**：服务端通知客户端"状态变了"，客户端自己在需要时重新拉取完整状态。优点是服务端不需要追踪"每个客户端看到了哪个版本"，实现简单。缺点是客户端可能在一段时间内看到旧状态。

**强一致性**：服务端维护每个客户端的状态版本号，确保每个客户端推送的数据包含了到该客户端最新版本为止的所有变化。优点是客户端始终看到最新状态，缺点是实现复杂——服务端需要追踪每个客户端的状态。

**客户端拉取（pull）**：客户端定期主动拉取最新状态。最简单，但延迟高（需要等下一个拉取周期）。

**服务端推送（push）**：服务端在状态变化时主动推送给客户端。延迟低，但需要建立长连接或使用webhook。

实践中，大多数agent系统选择**最终一致性 + 服务端推送**的组合——服务端主动推送变更通知，但不保证推送的完整性；客户端收到通知后拉取最新状态补齐。

## 三、市面其他session管理方案对比

不同项目对session管理的实现差异很大，尤其在"存哪里"和"怎么存"这两个问题上。以下是三种有代表性的路线。

### 3.1方案A：纯内存session，无持久化

这条路线的做法最简单：session数据完全保存在进程内存中。一个Map<sessionId, Session> 就是整个session存储系统。进程退出，session全部消失。

**设计特点：**

- **内存存储**：session存在Map或类似的数据结构中。读写速度极快（纳秒级）。
- **无磁盘写入**：不需要文件I/O，不需要数据库，不需要序列化。实现代码不到50行。
- **进程生命周期绑定**：session的生命周期等于进程的生命周期。进程重启意味着所有session丢失。

**优势：**

- **性能最好**——纯内存操作，没有磁盘I/O，没有序列化/反序列化开销。对于session读写频繁的场景（每秒数百次），方案A是唯一能扛住的选择
- **实现最简单**——一个Map、几个方法，20-50行代码搞定session管理
- **没有文件锁、并发写入等问题**——不需要担心多个进程同时写同一个session文件

**劣势：**

- **进程重启即丢失**——这是最致命的问题。部署更新、服务器维护、意外崩溃，都会导致所有session丢失。用户正在进行的对话中断，历史记录不可恢复。
- **无法支持长期session**——session的有效期不能超过进程的运行时间。生产环境中进程单次运行时间可能是几天或几周，但用户期望session能保持数月甚至数年。
- **内存泄漏风险**——session只增不删时，内存持续增长。如果某个用户创建了大量session而不关闭，Map里的条目越来越多，最终OOM。

**适用场景：** 开发调试环境（"重启就丢"是可以接受的）、短连接服务（session生命周期在秒/分钟级别）、不需要持久化的demo项目。

### 3.2方案B：SQLite session存储

这条路线的做法是使用SQLite作为session的持久化存储。每个session是SQLite表中的一行，对话历史可能存储在另一张关联表中。

**设计特点：**

- **关系型存储**：使用SQLite的表结构管理session数据。一张表存session元数据（id、title、owner、createdAt等），一张表存对话历史（sessionId、role、content、timestamp等）。
- **SQL查询**：可以用SQL做复杂查询——"查找用户A所有标签包含 'bug' 的session，按最后活动时间降序排列"。这是纯内存方案做不到的。
- **事务支持**：SQLite支持ACID事务。写入session数据时，要么全写成功，要么全写失败，不会出现半写状态。
- **单文件**：整个session库是一个文件（`sessions.db`），迁移、备份、复制都非常简单。

**优势：**

- 功能完整——SQL查询、事务、索引、全文搜索，该有的数据库功能都有
- 成熟稳定——SQLite是经过几十年考验的嵌入式数据库，bug少、兼容性好
- 查询灵活——按任意字段排序、过滤、聚合，不需要自己实现
- 数据一致性高——事务保证写入的原子性，不需要担心文件半写

**劣势：**

- **二进制不可读**：SQLite文件是二进制格式。你想用 `tail -f` 实时查看最新的对话内容？做不到。调试时需要额外工具（sqlite3 CLI或数据库浏览器）。对于经常需要调试agent行为的学习项目来说，这是一个显著的痛点——开发者最自然的行为是 `cat` 一个文件看看里面有什么，但SQLite文件cat出来是乱码。
- **写入放大**：对话历史是append-only的（只增不改）。但SQLite的行存储和B-tree结构在大量append场景下可能产生写放大——更新一个B-tree页可能导致整个页的重写。
- **并发写入限制**：SQLite是单writer的。多个客户端同时往同一条session追加历史时，需要排队。虽然对于个人使用的agent来说这不是问题，但在极端情况下（如高强度并发写入）可能成为瓶颈。

**适用场景：** 功能完整的生产项目、需要SQL查询session数据的场景、团队协作的agent服务。

### 3.3方案C：JSONL append-only + sidecar

这条路线的做法结合了文件系统的两种模式：主文件用JSONL格式（每行一个JSON对象，只追加不修改）存对话历史，sidecar文件用JSON格式（每次修改整个文件）存元数据。

**设计特点：**

- **JSONL主文件**：`<sessionId>.jsonl`，每行是一个JSON序列化的SessionEntry。追加新行时不用解析整个文件，直接 `fs.appendFile`。性能好，实现简单。
- **JSON sidecar**：`<sessionId>.meta.json`，存储session的元数据（标题、owner、标签、创建时间等）。元数据会频繁修改（用户改标题、加标签），用JSON格式每次修改时整个文件重写。
- **两种工作负载分离**：对话历史是append-heavy（只增不删不改），元数据是random-access（频繁修改）。用两种文件格式分别应对两种工作负载，避免"为了改一个字段重写整个会话历史"的浪费。

**优势：**

- **纯文本可读**：JSONL和JSON都是纯文本格式。开发时 `tail -f session.jsonl` 就能实时看到最新对话，`cat session.meta.json` 就能看到session元数据。对调试和排错的帮助极大——不需要任何额外工具。
- **零依赖**：只需要文件系统，不需要SQLite库、不需要数据库驱动。这对于一个学习项目来说意义重大——减少了一个依赖，就减少了一个可能出错的环节。
- **语义化文件命名**：`<uuid>.jsonl` 和 `<uuid>.meta.json` 一目了然。不需要记住SQL表结构，文件系统就是"数据库"。
- **备份和迁移简单**：cp命令就是备份，rsync就是迁移。不用关心SQLite的WAL文件、journal文件等额外状态。

**劣势：**

- 不支持复杂查询——想"查找所有含 'bug' 标签的session"，需要遍历所有meta文件自己解析。没有SQL的WHERE和JOIN。
- 并发写入需要文件锁——多个进程同时append同一个jsonl文件时可能会交叉写入。需要外部队列或锁机制。
- 文件数量多——每个session两个文件。如果有10000个session，就是20000个文件。文件系统对目录下的文件数量有限制（虽然现代文件系统的限制很高，但心理上20000个文件会让一些人不适）。

**适用场景：** 学习项目（可读性优先）、个人使用的agent（不需要复杂查询）、对零依赖有要求的场景。

### 3.4三种方案对比

| 维度 | 方案A（纯内存） | 方案B（SQLite） | 方案C（JSONL + sidecar） |
|---|---|---|---|
| 性能 | 最高（纳秒级） | 中（毫秒级，有序列化） | 中（毫秒级，有I/O） |
| 可读性 | N/A | 差（二进制） | 好（纯文本，可tail） |
| 功能完整度 | 低（无查询、无事务） | 高（SQL、事务、索引） | 中（无事务、无复杂查询） |
| 依赖 | 零 | 需SQLite库 | 零 |
| 进程重启 | 丢失所有数据 | 保留 | 保留 |
| 查询能力 | 无（只能遍历） | 强（SQL） | 弱（需自行解析过滤） |
| 调试友好度 | 中（需日志） | 差（需额外工具） | 高（cat/tail/grep） |
| 复杂度 | 低（几十行代码） | 中（ORM或SQL） | 中（文件管理） |

三条路线的选择本质上是"功能完整"、"调试友好"、"实现简单"三者之间的三角权衡。方案A为了简单牺牲了所有持久化，方案B为了功能完整牺牲了可读性，方案C为了可读性和零依赖牺牲了查询能力。

## 四、aptbot的设计特点

aptbot选择了**方案C——JSONL append-only + sidecar**。这个选择与项目的"学习型"定位高度一致：纯文本可读让开发者能直接查看和调试session数据，零依赖让项目更容易上手，JSONL的简单性让新手也能理解"数据是怎么存下来的"。

### 4.1 JSONL主文件 + .meta.json sidecar：两种工作负载分离

每个session在磁盘上是两个文件：

```
sessions/
  ├── 550e8400-e29b-41d4-a716-446655440000.jsonl      # 对话历史
  ├── 550e8400-e29b-41d4-a716-446655440000.meta.json   # 会话元数据
  ├── 6ba7b810-9dad-11d1-80b4-00c04fd430c8.jsonl
  ├── 6ba7b810-9dad-11d1-80b4-00c04fd430c8.meta.json
  └── ...
```

**.jsonl（对话历史）**：append-only文件。每次agent和用户交换一条消息，就在文件末尾追加一行JSON。这种格式的特点：

- Append-only意味着写入性能好——不需要读旧数据，不需要解析，只在文件末尾追加。文件系统对append操作有专门优化。
- 文件中行的顺序就是对话的时序——第1行是最早的消息，第100行是最新的消息。按行号定位比按时间戳更简单。
- JSONL支持流式读取——想读最新的10条消息？倒着读最后10行就行。不需要解析把整个文件加载到内存。

**.meta.json（会话元数据）**：单对象JSON文件。存储session的标题、创建时间、最后活动时间、owner用户ID、标签列表、label等元数据。

元数据和对话历史分开的原因：**两种工作负载的性质不同**。

对话历史是"只增不改"（除了极少数情况下的compaction）。用JSONL append-only最合适——每次追加一行，CPU和I/O开销都最小。

元数据是"频繁修改"——用户可能改标题、加标签、标星标、换owner。如果用JSONL存元数据，每次修改都要追加一行，读元数据时要从末尾往回扫描找到最后一个有效行——冗长且容易出错。用一个单独的文件存元数据，每次修改整个文件重写，简单可靠。元数据通常只有几百字节，重写一次的成本几乎可以忽略。

这种"主文件append + sidecar随机改"的组合是文件系统存储中的常见模式。它避免了"为了改一个字段重写整个会话历史"的浪费，也避免了"为了读一条元数据扫描整个文件"的愚蠢。

### 4.2 UUID v4 sessionId路径校验

sessionId采用UUID v4格式（如 `550e8400-e29b-41d4-a716-446655440000`）。所有涉及session文件路径的操作，第一步都是**校验sessionId是否是合法UUID**。

为什么需要校验？因为sessionId直接出现在文件路径中：`sessions/${sessionId}.jsonl`。如果sessionId来自外部输入（比如用户通过API传进来），且不做校验，攻击者可以传一个 `../../etc/passwd` 作为sessionId，让系统读写系统文件。这就是"路径遍历攻击"。

UUID校验直接从源头杜绝这个问题：UUID v4的格式是固定的（8-4-4-4-12的16进制字符 + 连字符），任何不匹配这个格式的输入都被拒绝。不存在"绕过"的可能——因为连字符的位置都是固定的，攻击者无法构造一个包含 `../` 的字符串同时满足UUID格式。

除了安全原因，UUID v4还有几个附带好处：

- **全局唯一**：不需要中心化的ID分配器。每台机器各自生成UUID，不会冲突。即使多台机器各自运行aptbot实例，它们的sessionId也不会冲突。
- **不可猜测**：122位随机性。攻击者无法枚举可能的sessionId来获取其他人的session。这对于多用户场景的安全隔离很重要。
- **格式固定**：36个字符（含4个连字符）。正则表达式校验简单高效：`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`。

校验的实现位置在Session系统的入口——任何接受 `sessionId` 参数的公开方法（`getSession`、`appendEntry`、`claimSession` 等）都会先调 `isValidUUID(sessionId)`。校验失败立即返回错误，不做任何文件操作。

### 4.3 claimSession严格ownership + forceClaimSession共享转移

session有"owner"（拥有者）的概念——只有创建session的用户能操作它。这是多用户隔离的基础。

`claimSession(sessionId, user)` 的逻辑：

- 如果session还没有owner：当前user成为owner，操作成功
- 如果session的owner就是当前user：操作成功
- 如果session有owner且不是当前user：返回403 Forbidden

这是**严格ownership**。用户A不能操作用户B的session。每个session是"私有"的，默认不共享。

严格ownership在多用户场景中的意义：假设两个开发者共用一台VPS跑aptbot，开发者A的session里包含了敏感的项目代码片段和API key。如果session没有owner隔离，开发者B可以随意读取A的session——这就是隐私泄露。严格ownership保证了"你的session是你的，我的session是我的"。

但有些场景需要"共享转移"——比如团队中的开发者A休假了，开发者B需要接手A的任务。此时B需要能看到A的session。或者A离职了，管理员需要把A的所有session重新分配给B。

`forceClaimSession` 提供了这个能力：有管理员权限的用户可以强制把session的owner改成另一个用户。这是一个"打破规则"的接口，不是常规操作。

这种"严格规则 + 例外机制"的设计在安全领域很常见：默认情况下规则是最严格的（谁都不能看别人的session），但提供了一条显式的、需要特权的"后门"来处理特殊情况（管理员可以进行session转移）。这让系统在大多数时候保持安全，在少数需要灵活的场合也不阻塞。

### 4.4 per-sessionKey ring buffer（1000）+ 全局LRU（50000）

session历史回放是性能热点——客户端重连时需要拿到完整的历史来渲染对话界面。如果每次都从磁盘JSONL读取，IO延迟会明显拖慢重连速度。

aptbot用**两级缓存**来解决这个问题：

**第一级——per-sessionKey ring buffer（环形缓冲区，1000条）**：每个sessionKey（用户 + session的唯一标识）维护一个环形缓冲区，存储最近1000条事件。

环形缓冲区的工作原理：它本质上是一个固定大小的数组 + 两个指针（写指针和读指针）。写入新事件时覆盖最旧的事件。读事件时从最旧的事件开始顺序读出。

为什么是环形缓冲区而不是普通的数组？因为：

- 写入是O(1)——不需要移动元素，只需要移动写指针
- 内存占用固定——最多1000个槽位，不会增长
- 适配"最近N条"的语义——环形缓冲区天然就是"保留最近N条丢弃旧的"

**第二级——全局LRU（Least Recently Used，50000条）**：所有session的ring buffer加起来不能超过50000条。当总量超过限制时，淘汰最久未访问的session的整个ring buffer（不是逐条淘汰，是按session淘汰）。

为什么两层而不是一层？

- **ring buffer适配单session局部性**：用户操作当前session时，反复读最近N条事件。ring buffer命中率极高——几乎所有"查看历史"的请求都在ring buffer内完成，不需要走磁盘。
- **LRU适配多session切换**：用户在多个session间来回切换（比如上午在"bug-fix-X" session里调试，下午在"feature-Y" session里开发），LRU保证"最近活跃的session缓存常驻"，不活跃的session缓存被淘汰释放内存。
- **内存上限可控**：50000条事件 × 平均1KB/条 ≈ 50MB。在个人开发机器上，50MB内存占用完全可以接受。如果用户有100个活跃session，每个保留500条，正好在50000条的限制内。

这里有一个值得注意的类比：**CPU的L1/L2/L3缓存架构**。

- L1缓存（per-core，最快最小）≈ per-sessionKey ring buffer——专属于"当前正在操作的session"，速度最快（内存访问vs磁盘访问）
- L2缓存（per-core，中速中等）≈ 全局LRU——跨session共享，容量更大
- L3缓存（shared，较慢但大）≈ 无（aptbot没有第三级，直接到JSONL）
- 主存（最慢最大）≈ JSONL磁盘文件

这个类比有助于理解两个关键设计：

1. **per-session ring buffer的容量为什么是1000**？因为多数session不超过1000条事件。ring buffer能直接覆盖整个session——绝大多数"查看历史"的请求都能命中ring buffer，不需要走磁盘。1000是经验值，来自对实际使用模式的观察。
2. **LRU为什么按session淘汰而不是按条淘汰**？因为淘汰单条事件对"历史回放"没有意义——客户端重连时需要的是完整的session历史，不是零散的事件。如果LRU按条淘汰，最坏情况下一个session的事件被逐条淘汰了一部分，客户端重连时即使命中ring buffer，也只能拿到残缺的历史，最后还是得走JSONL兜底。按session淘汰保证：要么整个session的ring buffer都在，要么都不在。没有"半在"的状态。

### 4.5历史回放：ring buffer未命中 → JSONL兜底

客户端重连时，需要回放session的历史。回放的完整路径：

1. 客户端发重连请求，带上sessionId和需要回放的时间范围（或条数范围）
2. 检查该sessionId对应的ring buffer是否覆盖请求的范围
3. **快路径（ring buffer覆盖）**：直接从ring buffer中读取事件，构造事件序列返回。O(N) 时间复杂度（N = 返回的事件条数），纯内存操作，通常在微秒级别。
4. **慢路径（ring buffer不覆盖）**：打开JSONL文件，从文件末尾倒序读取，按时间范围过滤，构造事件序列返回。O(M) 时间复杂度（M = 文件的无效行数 + N），涉及磁盘I/O，通常在毫秒级别。

快路径覆盖了绝大多数请求——用户在session内正常操作时，所有事件都在ring buffer中，客户端刷新页面或重连后，历史回放在微秒级别完成，用户感觉不到延迟。

慢路径只发生在少数边缘场景：用户隔了很久（一周甚至一个月）重新打开一个session，期间这个session的ring buffer已经被LRU淘汰了。这时才需要从JSONL磁盘读取。虽然慢（相比内存），但仍然是可接受的（相比重新没有session系统）。

这个"快路径 + 慢路径"的设计模式在计算机系统中无处不在。CPU有缓存（快）→ 主存（慢），操作系统有内存（快）→ 磁盘（慢），aptbot的session系统也是一样——ring buffer（快）→ JSONL（慢）。每一层都在做同一件事：用更快的存储为更慢的存储做缓存，期望大多数请求在更快的层命中。

### 4.6 presence广播

"presence"是即时通讯应用里的常见功能——显示"用户在线/离线"的状态。在多用户aptbot场景中，presence的意思是：用户A能看到当前还有谁在同一个session上"在线"。

实现方式是通过事件广播：

- 当用户绑定channel到session时，系统发出 `presence_online` 事件，包含用户信息
- 当channel死亡（用户断开连接、页面关闭、网络中断）时，系统发出 `presence_offline` 事件
- 所有绑定了该session的channel收到 `presence_online` / `presence_offline` 事件，前端据此展示在线用户列表

presence让"多端协作"成为可能——不仅仅是"多端同步看"，而是"多端一起用"。想象一个场景：你和同事共用一个session，agent在中间执行任务。你能看到同事在线，看到他刚发了什么消息，看到他正在看哪个工具的输出。agent的执行结果实时推送给两个人——你们像在同一个房间里一起看着agent工作。

对于个人使用，presence的意义在于"设备切换的感知"——你在手机上打开session，看到"电脑端在线"的提示，就知道电脑上session还在活动，agent可能正在执行一个长时间的任务，你不需要在手机上重新操作。

### 4.7 session_changed控制消息 + 客户端拉取

session状态会变化——另一端发了一条新消息、agent正在执行工具、compaction删除了旧数据、元数据被修改了。这些变化需要通知所有连接的客户端。

`session_changed` 是一个轻量控制消息，它只包含：

```typescript
interface SessionChangedMessage {
  type: 'session_changed';
  sessionId: string;
  changeType: 'new_entry' | 'meta_updated' | 'compaction' | 'status_change';
}
```

不包含具体的变化内容。客户端收到 `session_changed` 后，自己决定是否需要重新拉取完整状态。

为什么只发通知不发完整内容？三个原因：

1. **节省带宽**：变化可能很大——一次compaction可能删了数百条历史记录。如果完整内容推送给所有客户端，带宽浪费严重。通知只有几十字节，比推送完整内容便宜得多。
2. **去重**：多个变化可能在短时间内连续发生——agent同时输出多个token，每个token一个事件，如果每个都推送"新内容"，客户端一秒收到几十次推送，疲于处理。通知 + 拉取的模式让客户端可以"等变化稳定了再拉一次"，而不是每一次变化都响应。
3. **容错**：服务端推送完整内容时，如果客户端漏接了一个推送（比如网络丢包），客户端就永久丢失了这个变化。但在通知 + 拉取模式下，客户端漏接一个 `session_changed` 只是延迟了拉取的时间，下次拉取时一次性补齐所有遗漏的变化。

这种模式的术语叫"**最终一致性**"——不保证客户端在任何时刻都看到最新状态，但保证客户端在主动拉取后一定能看到最新状态。通知只是"提醒你该拉取了"，不承担"确保你看到最新"的责任。

最终一致性与WebSocket重连天然兼容：客户端重连后，第一件事就是主动拉取session的完整状态，不需要服务端追踪"这个客户端在断线期间错过了哪些事件"。服务端不需要维护每个客户端的状态版本号——只需要在收到拉取请求时返回当前完整状态即可。

### 4.8多用户隔离：UserStorage + scrypt + Bearer token

多用户场景下，"谁能访问哪些session"是核心安全问题。aptbot的多用户隔离体系包含三个组件：

**UserStorage（用户存储）**：一个文件存储，记录用户的 `username`、`passwordHash`、`userId` 和其他属性。UserStorage不和SessionStorage混在一起——用户数据和session数据放在不同的目录，有不同的访问策略。

**scrypt密码哈希**：用户的密码在存储前用scrypt算法哈希。scrypt是一种**内存硬**（memory-hard）的哈希算法——它不仅需要CPU计算，还需要大量内存。这让暴力破解变得极其昂贵：攻击者即使拿到了哈希值的副本，要破解每个密码也需要GB级别的内存和大量的计算时间。

相较于bcrypt（另一种常见的选择），scrypt的抗ASIC攻击能力更强。ASIC（专用集成电路）攻击者可以定制芯片来并行计算bcrypt，但scrypt的内存要求让这种并行化变得困难——每个并行计算实例都需要独立的大块内存，芯片面积和成本急剧上升。对于aptbot这种项目的规模来说，bcrypt其实也够用，但选择scrypt体现了"安全设计上不留妥协"的态度。

**Bearer token鉴权**：用户登录成功后，服务端签发一个Bearer token。后续所有API请求都带上这个token。每个token绑定一个userId，服务端从token中解析userId来鉴权。

Token有过期时间（默认24小时）。过期的token被拒绝，用户需要重新登录。这是一个安全工程中的标准设计：限制token的有效期，降低token泄露后的风险窗口。

**session ownership校验**：这是前面讲的claimSession机制的底层支撑。用户访问任意session时，系统校验：

1. 请求中的Bearer token是否有效 → 解析出userId
2. 被请求的session的owner字段是否等于该userId（或userId是否有管理员权限）
3. 校验通过 → 允许访问；校验失败 → 返回403

这三个组件一起构成了一个完整的多用户隔离体系。用户数据（UserStorage）和会话数据（SessionStorage）分开存储，密码用强哈希保护，API访问用Bearer token鉴权，session访问用ownership校验。

这套体系让aptbot可以在共享VPS上安全运行——多个用户共用一个aptbot进程，但彼此的session完全隔离。用户A不能看到用户B的session，用户B不能操作用户A的工具，每个用户都感觉自己在"独享"这个agent。

### 4.9 CLI命令：session成为可组织的工作单元

Session系统不仅是一套存储和权限机制，它还通过CLI命令让session成为用户可组织、可管理的工作单元。

aptbot CLI提供了以下session管理命令：

**`/sessions`**：列出当前用户的所有session。返回列表包含每个session的ID、标题、最后活动时间、是否活跃等信息。这是用户"查看我的所有会话"的入口。

**`/resume <sessionId>`**：恢复一个历史session，把它绑定到当前channel。用户在多个设备间切换时，用 `/resume` 带上之前在电脑上看到的sessionId，手机上就能接续对话。

**`/label <sessionId> <text>`**：给session加一个文本标签。比如 `/label 550e... "bug-fix-X"`。标签是用户组织session的主要方式——按项目、按任务、按优先级给session打标。

**`/session <key> <value>`**：设置session的动态属性。比如 `/session project monorepo-frontend` 在session中注入一条"当前session关联的项目是monorepo-frontend"。agent和hook可以读取这些动态属性来做上下文相关的决策。

**`/session`（无参数）**：查看当前session的所有动态属性。

这些命令的价值随着用户使用aptbot时间的增长而增加。长期使用一个agent的用户会积累几十甚至上百个session——如果不加组织，session列表就是一个杂乱无章的"按时间排列的对话记录"。有了 `/label` 和 `/session`，session变成了"按主题组织的项目单元"——"所有打上 `bug-fix` 标签的session"、"所有project属性为 `monorepo-frontend` 的session"。

CLI命令将session从"自动管理的存储单元"提升为"用户可操作的工作单元"。这不仅仅是UX的改进——它让用户能够主动管理自己与agent的交互记录，把agent从"用完即走的工具"变成"有记忆的长期协作伙伴"。

![Session系统架构](/images/09-session-multiuser/session-system.png)

## 五、发展方向

### 5.1存储后端可替换

当前aptbot的session存储固定使用JSONL + sidecar文件。长远来看，可以抽象一个 `SessionStorage` 接口，支持多种后端实现：

- **FileSessionStorage**（当前默认）：JSONL + sidecar，零依赖，可读性好
- **SQLiteSessionStorage**：功能完整，支持复杂查询
- **MemorySessionStorage**：纯内存，性能最好，适合测试和临时场景

用户可以根据自己的需求选择后端——开发调试时用FileSessionStorage（可读性好），生产部署时用SQLiteSessionStorage（功能完整）。`SessionStorage` 接口的存在让这种切换不侵入session的业务逻辑。

### 5.2 session共享与协作

当前的claimSession/forceClaimSession提供了最基础的共享能力（管理员强制转移）。未来可以支持更丰富的共享模式：

- **只读共享**：用户A可以把session共享给用户B，但B只能看不能操作
- **协作共享**：多个用户可以同时操作同一个session，所有操作实时同步给所有参与者
- **链接共享**：生成一个带过期时间的共享链接，任何人都可以通过链接访问session（类似Google Docs的"任何知道链接的人都可以查看"）

共享和协作是agent从"个人工具"走向"团队工具"的关键能力。但它的前提是安全模型足够成熟——在支持共享之前，必须先确保隔离是可靠的。

### 5.3 session的自动归档与压缩

长期使用的session文件会不断增长。一个session经过数百轮对话后，JSONL文件可能有数万行。虽然JSONL是append-only，但很多早期的对话内容已经不再需要了。

自动归档策略可以是：定期扫描超过一定时间未活跃的session，把最早的N% 的对话历史压缩成一个摘要（由LLM生成），用摘要替换原始内容。这样session文件的大小增长是亚线性的——新对话不断追加，旧对话被压缩成摘要后体积大幅缩小。

这个过程类似人类的记忆——"新事记得清楚，旧事只留印象"。它也是方案B（SQLite）和方案C（JSONL）都需要的——无论用什么存储，无限增长的历史都需要管理。

## 小结

Session系统是agent状态管理的核心，在Channel之上提供了持久化、隔离和同步三层能力。

1. **概念层面**：session是用户与agent之间一次交互的完整记录，独立于连接存在。它承担了存储层、状态管理层和安全层三层职责，不能被Channel替代——Channel是管道，session是档案。

2. **方案对比**：方案A（纯内存）性能最好但进程重启即丢失；方案B（SQLite）功能完整但二进制不可读，无法用tail调试；方案C（JSONL append-only + sidecar）零依赖、纯文本可读，适合学习项目的规模。

3. **aptbot的设计**：JSONL + sidecar分离对话历史（append-only）和元数据（随机读写）两种工作负载；UUID v4 sessionId从源头杜绝路径遍历攻击；claimSession/forceClaimSession平衡严格权限与灵活转移；per-sessionKey ring buffer（1000条）+ 全局LRU（50000条）的两级缓存通过类比CPU L1/L2缓存来理解；presence广播让多端协作可见；session_changed + 客户端拉取用最终一致性简化同步模型；UserStorage + scrypt + Bearer token构建完整的多用户租户隔离；CLI命令让session从存储单元变为可组织的工作单元。

下一篇文章看aptbot的整体安全模型，把这些散落的安全设计点——UUID校验、沙箱、hook信任边界、scrypt、Bearer token——串起来，理解aptbot如何在开放和可控之间找到平衡。
