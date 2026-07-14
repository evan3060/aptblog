---
title: Channel与多端接入：TransportChannel抽象
description: >-
  从多端接入的问题出发，对比三种接入方案的设计取舍，深入aptbot的类型化事件总线、最小化Channel接口、bindSession
  多对一共享、dead-channel自动清理与WebSocket实现
tags:
  - 通道
  - 传输
  - WebSocket
  - 多客户端
  - 事件总线
date: '2026-07-02'
categories:
  - Agent实践
  - 核心特性深入篇
difficulty: intermediate
reading_time: 16
prerequisites:
  - 07-hook-system
lang: zh-CN
---

一个agent同时服务多个客户端，是aptbot 0.2.x的核心场景：你在电脑上打开WebUI跟agent对话，出门切换到手机继续，回家在另一台电脑上接续。这要求 **agent的状态独立于客户端连接**——客户端可以断开重连，agent不应该重启，也不应该丢失对话上下文。

这个需求看起来简单，但实现起来有几个关键问题：如果两个客户端同时接入同一个agent，事件该推给谁？客户端断线重连后，如何拿到断线期间错过的历史？一个用户在电脑上发了消息，手机端怎么同步看到回复？

Channel抽象就是为了解决这些问题而诞生的。它把"如何与客户端通信"和"agent如何运行"拆成两个独立的问题。这篇文章从多端接入的根本挑战讲起，对比三种方案的设计取舍，最后深入看aptbot如何通过类型化事件总线、最小化Channel接口和bindSession机制来实现多端同步。

## 一、概念：什么是多端接入，为什么需要Channel抽象

### 1.1多端接入的核心问题

多端接入最朴素的实现是"每个客户端一个agent实例"——用户A连上来，创建一个agent实例服务A；用户B连上来，再创建一个agent实例服务B。但这在"同一用户多端切换"场景下会出问题：

1. **状态分裂**：用户在电脑上让agent改了文件，然后切换到手机。手机连接的是另一个agent实例，对刚才的修改一无所知。两个agent实例各自维护自己的上下文，彼此不通信，用户看到的对话历史不一致。
2. **资源浪费**：每个客户端一个agent实例意味着每个客户端都要维护一个完整的LLM上下文窗口。如果10个客户端接入，就是10个上下文窗口在内存里——即使其中9个客户端没有活跃对话。
3. **无法多端同步**：用户在电脑上发出指令，agent执行完毕后回复只在电脑上显示。用户拿起手机看不到刚才的对话——因为手机连接的是另一个agent实例。

正确的做法是：**一个agent实例 + 多个客户端接入**。客户端只是agent的"显示器"和"输入设备"，agent的状态不绑定于任何一个客户端。这样无论用户从哪个端接入，看到的是同一个agent会话。

### 1.2 Channel抽象的角色

要实现"一个agent + 多个客户端"，关键是把"消息怎么传"和"agent怎么运行"解耦。

Channel抽象就是这个解耦的桥梁：

- **Agent侧**：只关心"产生事件"——LLM的流式输出、工具的调用结果、状态的变化，都作为事件发出。agent不关心这些事件最终怎么到达客户端。
- **Channel侧**：只关心"消费事件"——把agent产生的事件转成客户端能理解的格式推送出去。Channel不关心agent怎么决策、怎么执行工具。

这种解耦带来的灵活性：你可以同时用WebSocket Channel（接WebUI）、CLI Channel（接命令行终端）、Telegram Channel（接手机IM），所有Channel接收的是同一套事件流。如果你要加一个新的接入方式（比如Slack），只需要写一个新的Channel实现，agent循环一行都不用改。

### 1.3事件生产和事件消费的解耦

Channel抽象背后的核心设计模式是**事件生产与事件消费的解耦**。

传统客户端-服务端模式中，服务端直接向客户端推送消息。这隐含了一个假设：一个消息只有一个消费者。但在多端接入场景中，同一个消息可能有多个消费者（电脑WebUI + 手机WebApp + 日志记录器）。

解耦的方式是引入一个中间层——事件总线。agent把事件发到总线，总线负责把事件分发给所有感兴趣的人。agent不需要知道"谁在听"，消费者不需要知道"谁在说"。

这个模式在大型系统中非常常见（如Kafka、RabbitMQ），但aptbot是单进程应用，不需要分布式消息队列。aptbot在进程内实现了一个轻量级的事件总线，专门用于agent事件的分发。

## 二、通用设计方案：多端接入的常见架构模式

在agent中实现多端接入，有几个维度的设计选择。理解这些维度是分析具体方案的基础。

### 2.1 session与connection的关系

多端接入最核心的设计决策是：**session（会话）和connection（连接）是绑定还是解耦？**

- **绑定模型**：连接即session。用户打开WebSocket连接，系统创建一个session；断开连接，session销毁。这种方式简单直接，但无法支持"断开重连后保留会话"。
- **解耦模型**：session独立于连接存在。用户登录后系统分配（或用户创建）一个session，之后多个连接可以绑定到同一个session。连接断了session还在，下次重连后绑定回原来的session。

解耦模型显然是多端接入的正确选择，但它引入了额外的复杂度：session需要持久化（否则进程重启session就丢了）、session需要与连接建立映射关系、session事件需要广播给所有绑定它的连接。

### 2.2事件分发的策略

一个agent事件产生后，如何分发给客户端？三种常见策略：

**广播（broadcast）**：每个事件推送给所有连接的客户端。最简单，但问题很明显——用户A的私密对话会被推送给用户B。广播只在单用户多端场景下可用。

**单播（unicast）**：每个事件只推送给"发起请求的那个客户端"。这是传统请求-响应模式。但问题是：用户在电脑上发消息、手机上想看到回复——单播模式下手机看不到。

**组播（multicast）**：每个事件推送给"绑定到当前session的所有客户端"。这是多端同步的正确策略——同一个session的所有客户端都收到事件。组播的分组依据是session。

### 2.3传输协议的选择

传输协议决定了事件怎么从服务端到达客户端。三种常见的实时传输协议：

**WebSocket**：全双工、低延迟，浏览器原生支持。适合需要流式推送的场景（agent的流式输出天然适合WebSocket）。缺点是自建协议的复杂度（心跳、重连、序列化）。

**SSE（Server-Sent Events）**：服务端到客户端的单向流，基于HTTP长连接。比WebSocket简单（原生HTTP协议），浏览器支持好。但SSE是单向的——客户端到服务端还需要额外的HTTP请求。

**长轮询（Long Polling）**：客户端定期发起HTTP请求，服务端在有事件时返回。实现最简单（只需要HTTP），但延迟较高，资源消耗大。适合事件频率低的场景。

## 三、市面其他多端接入方案对比

不同agent项目对"如何让多个客户端接入同一个agent"这个问题的回答差异很大。以下是三种有代表性的设计路线。

### 3.1方案A：agent + channel强绑定

这条路线的做法是：每个连接对应一个agent实例，连接即session，断开连接session即销毁。channel只是agent的"附属品"——agent创建时就决定了它使用什么channel。

**设计特点：**

- **连接即session**：用户连上来时创建一个session，断开时销毁。没有"断线重连保留上下文"的概念。
- **agent持有channel**：agent实例内部持有channel引用，直接调用channel.send() 推送消息。不需要事件总线。
- **一对一关系**：一个agent实例只服务一个客户端。不存在多端共享agent的问题——因为压根不支持多端接入。
- **实现极简**：没有channel抽象层、没有事件总线、没有session管理器。agent循环直接向channel写数据。

**优势：**

- 实现最简单——代码量最少，不需要任何基础设施
- 逻辑最直白——读代码就能理解"agent怎么把消息发给客户端的"
- 零额外延迟——没有总线、没有分发，agent直接推送给客户端

**劣势：**

- **无法多端同步**：用户不能在手机和电脑之间切换——第二个连接上来时，第一个连接已经销毁了对应的agent实例。用户在电脑上的对话不会同步到手机。
- **断线即丢失**：网络不稳定断开WebSocket时，agent正在执行的任务可能中途取消。用户即使立即重连，也回到了一个全新的session，刚才的对话历史没有了。
- **资源浪费**：每个连接一个agent实例意味着每个连接有独立的LLM上下文窗口。用户只是刷新页面就要重建一个agent实例——CPU和内存的浪费很大。

**适用场景：** 简单的demo项目、一次性对话场景（用户用完即走，不需要保留历史）。

### 3.2方案B：独立session层 + channel透传

这条路线的进步是引入了独立的session层：session不再绑定到连接，而是持久化的实体。channel则透穿在session和客户端之间——session通过channel收发消息。

**设计特点：**

- **session持久化**：session有独立于连接的生命周期。连接断开后session保留，重连后恢复。
- **channel透传**：session直接持有channel引用，事件通过channel推送给客户端。没有事件总线，session自己管理分发。
- **session与channel一一对应**：一个session仍然只能绑定一个channel。不支持多端同时接入。
- **连接恢复机制**：客户端断线后可以带上sessionId重连，重新绑定到同一个session。

**优势：**

- session持久化解决了"断线丢历史"的问题——客户端重连后能继续之前的对话
- session层独立后，可以增加session管理功能（如session列表、session标签、session搜索）
- 实现相对简单——只需要在方案A的基础上加一个session管理器

**劣势：**

- **仍不支持多端同步**：一个session只能绑定一个channel。用户不能在电脑发完消息、在手机上看回复——因为手机连接会"抢走"session的channel绑定。
- **事件消费逻辑分散**：session直接管channel的收发，意味着session代码里混合了"业务逻辑"（管理对话状态）和"传输逻辑"（怎么把消息发出去）。后续每加一种传输方式（从WebSocket到Telegram），session代码都需要修改。
- **连接切换时状态丢失**：用户从电脑切换到手机时，电脑的channel断开，手机的channel绑定上来。但电脑channel断开到手机channel绑定之间有一个时间窗口——期间agent产生的任何事件都丢失了（因为没有channel可以推送）。

**适用场景：** 单用户多设备轮换使用（一次只在一个设备上登录），需要保留对话历史但不需要实时多端同步。

### 3.3方案C：类型化事件总线 + Channel抽象 + 多对一共享

这条路线做了三个关键设计：

1. **类型化事件总线**：agent的所有输出都作为类型化事件发到总线上。总线不关心谁在消费这些事件。
2. **Channel抽象**：每个接入方式实现Channel接口，从总线订阅事件并转发给客户端。agent和session都不知道Channel的存在。
3. **多对一共享**：一个session可以同时绑定多个Channel。总线把事件分发给所有绑定了该session的Channel。

**设计特点：**

- **事件三层分离**：agent只负责产生事件，总线负责分发事件，Channel负责传输事件。三层各司其职，互不干扰。
- **Channel接口最小化**：实现一个新接入方式只需要实现几个简单的方法（如send、close、isAlive）。不需要理解agent的内部逻辑。
- **类型安全的事件格式**：所有事件有统一的类型定义（envelope），消费方按类型精确处理。不存在"收到一个JSON字符串，还要自己解析判断是什么事件"的情况。
- **自动生命周期管理**：Channel死了自动解绑，新Channel接入自动订阅，不需要手动管理映射关系。

**优势：**

- 真正的多端同步——一个session绑定多个Channel，所有Channel收到同一份事件流
- 加新接入方式成本低——实现Channel接口的4个方法即可，不碰agent循环
- 事件格式标准化——所有接入方式消费同一种事件格式，不存在"WebSocket用一种格式、Telegram用另一种"的适配问题
- 健壮性好——Channel死了不影响agent，agent死了所有Channel收到关闭事件

**劣势：**

- 架构复杂——需要事件总线、Channel管理器、session-Channel映射表三套基础设施
- 总线可能成为瓶颈——所有事件经过总线分发，如果总线实现效率低会影响整体性能
- 调试困难——事件从agent到客户端经过三层（agent → bus → Channel → client），追踪问题时需要跨三层排查

**适用场景：** 需要多端实时同步的项目、需要接入多个不同传输协议的项目、架构清晰度要求高的项目。

### 3.4三种方案对比

| 维度 | 方案A（强绑定） | 方案B（session + 透传） | 方案C（总线 + 抽象 + 多对一） |
|---|---|---|---|
| 核心哲学 | 连接即session，一对一 | session持久化，channel透传 | 三层分离，多对一共享 |
| session生命周期 | 绑定连接 | 独立于连接 | 独立于连接 |
| 多端同步 | 不支持 | 不支持（一一对应） | 支持（多对一） |
| 事件分发 | agent直接推送 | session直接推送 | 总线组播 |
| 传输层与业务层 | 不分离 | 部分分离（session管传输） | 完全分离 |
| 加新接入方式 | 改agent循环 | 改session层 | 仅加Channel实现 |
| 断线恢复 | 丢失session | 保留session，丢失中间事件 | 保留session，缓冲事件 |
| 实现复杂度 | 低 | 中 | 高 |
| 架构清晰度 | 低（混杂） | 中 | 高（职责分明） |

三条路线从简到繁，从紧耦合到松耦合。方案A适合最小可行产品，方案B适合需要session管理的单用户场景，方案C适合需要真正多端同步的产品。aptbot选择了方案C，因为它的定位就是"一个agent服务多端"。

## 四、aptbot的设计特点

aptbot选择了**方案C——类型化事件总线 + Channel抽象 + 多对一共享**。这套设计在aptbot中实际落地为以下几个具体组件。

### 4.1方案E类型化bus + AgentEventEnvelope设计动机

aptbot在0.2.x中实现的事件总线被称为"方案E"（Event-driven Engine），其核心设计围绕两个概念展开：

**类型化事件总线（Bus）**：bus是aptbot内部的一个类型化EventEmitter。Agent产生的所有输出——LLM流式token、工具调用请求、工具执行结果、错误信息、状态变化——都作为类型化事件发到bus。

```typescript
type AgentEvent =
  | { type: 'llm_token'; content: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'error'; message: string }
  | { type: 'done'; summary: string };
```

**AgentEventEnvelope（事件信封）**：每个事件在总线上传输时被包裹在一个"信封"中，包含事件的元信息：

```typescript
interface AgentEventEnvelope {
  id: string;           // 事件唯一 ID
  sessionId: string;    // 所属 session
  timestamp: number;    // 事件发生时间
  type: string;         // 事件类型
  payload: unknown;     // 事件内容
}
```

为什么需要envelope？两个原因：

1. **多路复用**：bus上同时传输多个session的事件。envelope里的sessionId让Channel能过滤出"属于我的session"的事件。如果没有sessionId，每个Channel都得接收所有session的事件，然后自己过滤——浪费CPU也泄露隐私。
2. **消费方信息充足**：Channel收到一个envelope后，不需要额外查询就知道这个事件属于哪个session、什么时候发生的。这让Channel可以实现"事件缓冲"（客户端离线时缓存事件，重连后补发）而不需要额外维护映射表。

用bus而不是直接"agent → 客户端"推送的根本原因是：**bus解耦了事件生产与事件消费**。agent只往bus发事件，不管谁在收、收多少、收不收得到。Channel从bus订阅事件，不管谁在发、发多少、为什么发。这种解耦让agent和Channel可以独立演变。

### 4.2接口最小化：type / send / close / isAlive

Channel是aptbot中接入方式的标准接口。它只要求4个方法：

```typescript
interface Channel {
  type: string;                              // channel 类型标识
  send(event: AgentEventEnvelope): void;     // 推送事件给客户端
  close(): void;                             // 关闭 channel
  isAlive(): boolean;                        // channel 是否还活着
}
```

4个方法，这是有意的最小化设计：

- **type**：标识Channel的类型（如 `"websocket"`、`"telegram"`）。用于日志和监控，不参与业务逻辑。
- **send**：核心方法。bus把事件分发给Channel时调用send。Channel的实现决定怎么把这个事件发送给客户端——WebSocket Channel序列化成JSON通过ws.send推送，Telegram Channel通过Bot API发送消息。
- **close**：关闭Channel，释放资源。由bus在检测到Channel不存活时调用，或由上层系统关闭。
- **isAlive**：健康检查。bus定期调用isAlive检查Channel是否还活着。如果返回false，bus会触发Channel死亡处理流程（自动解绑、清理资源）。

为什么接口这么小？

因为Channel的责任范围被严格限定在"**传输**"——它只负责"把已经封装好的事件从服务端送到客户端"。它不需要理解事件的含义、不需要关心session的状态、不需要处理用户输入。

接口最小化的另一面是**客户端能力假设最小化**——aptbot假设客户端只能"收事件"和"被关闭"，不假设客户端能查询、能恢复、能确认。这些更高的能力通过协议层（如WebSocket重连后的resync协议）实现，不进入Channel接口本身。这保证了即使是最简单的客户端（如一个只读的事件显示器），也能实现Channel接口。

### 4.3 wrapTransportChannel适配器

实际开发中，往往已经有成熟的传输层实现——Node.js的 `ws` 库、Telegram Bot SDK、Slack SDK。这些库已经有自己的连接管理、心跳、重连、消息序列化等机制。如果要求每个Channel实现从头写这些，代价太大。

`wrapTransportChannel` 是一个适配器函数，它把"已有的传输层实现"包装成Channel接口：

```typescript
function wrapTransportChannel(options: {
  type: string;
  send: (data: string) => void;
  close: () => void;
  isAlive: () => boolean;
}): Channel {
  return {
    type: options.type,
    send: (event) => options.send(JSON.stringify(event)),
    close: options.close,
    isAlive: options.isAlive,
  };
}
```

适配器做的事情很简单：

1. 把AgentEventEnvelope序列化成传输层能消费的格式（如JSON字符串）
2. 调用传输层的send方法发送出去
3. 把传输层的close事件映射到Channel的close
4. 把传输层的存活状态映射到Channel的isAlive

这个适配器的价值在于：**开发者不需要重写传输层**。如果你有一个WebSocket连接，你只需要调用 `wrapTransportChannel({ type: 'websocket', send: ws.send, close: () => ws.close(), isAlive: () => ws.readyState === ws.OPEN })`，就得到了一个标准的Channel实例。

适配器模式让aptbot的Channel系统保持了"零依赖"的优雅——核心接口不依赖任何第三方库，而第三方库通过适配器接入。这是"不重新发明轮子"的具体体现。

### 4.4 bindSession(sessionKey, channel) 多对一共享

Channel创建好了，接下来是把Channel绑定到session。核心API是 `bindSession(sessionKey, channel)`。

**多对一**是最关键的设计：一个session可以同时绑定多个Channel。

具体场景：

- 用户在电脑WebUI打开session X（Channel A绑定session X）
- 用户在手机也打开session X（Channel B绑定session X）
- agent处理了一条消息，发回的事件通过bus分发，同时推送给Channel A和Channel B
- 电脑和手机看到的是同一份agent输出

这个过程agent完全不知道——它只往bus发事件，不关心谁在收。bus负责根据sessionId过滤事件，只推送给绑定了该session的Channel。

多对一共享带来的核心能力是"**真正的多端同步**"——不是"用户主动刷新才能看到最新消息"，而是"agent每产生一个事件，所有端实时收到"。用户在电脑上看到agent逐个输出token的同时，手机上也实时看到同样的token流。

### 4.5 WebSocket作为Channel实现

aptbot 0.2.x的主要Channel实现是WebSocket。WebUI是浏览器，自然用WebSocket与服务端双向通信。CLI通过WebSocket连服务端（同一台机器或远程VPS），也能接入同一个agent。

WebSocket Channel的工作流程：

1. **连接建立**：客户端通过HTTP升级协议建立WebSocket连接
2. **身份认证**：客户端在连接建立后发送认证消息，包含Bearer token和要绑定的sessionKey
3. **绑定session**：服务端验证token后，调用 `bindSession(sessionKey, channel)` 把WebSocket连接绑定到对应session
4. **事件推送**：agent产生事件 → bus分发 → Channel.send → ws.send(JSON.stringify(envelope))
5. **客户端输入**：客户端通过WebSocket发送用户消息 → 服务端解析后注入agent loop
6. **连接断开**：WebSocket触发close事件 → bus检测到Channel不存活 → 自动解绑

![Channel多端接入架构](/images/08-channel-transport/channel-architecture.png)

这个流程中最关键的是第3步——客户端决定绑定到哪个session，而不是服务端分配。这使得"断线重连保留session上下文"变得简单：客户端断线后记住sessionId，重连时带上同一个sessionId重新绑定，历史都在。

WebSocket Channel的实现细节中，一个值得注意的设计是**事件缓冲**。客户端断线后，bus会缓存最近N条事件（N可配置）。当客户端重连并绑定到同一个session后，bus把缓存的事件重新推送给新Channel，客户端补上断线期间错过的内容。这让"断线重连"的体验接近无缝——用户不会看到中间有一段空白。

### 4.6 dead-channel自动unbind

Channel可能"死掉"——网络断开、客户端崩溃、超时无响应。如果死掉的Channel不被清理，会出现几个问题：

1. **事件丢失但自以为成功**：bus调用dead channel的send方法，调用成功了（实际上数据丢进了虚空），bus以为客户端收到了，实际上没有。用户可能以为agent回复了但"没收到"。
2. **资源泄漏**：每个Channel在bus中占用一个订阅位置。dead channel不清理，订阅位置被占满后新的Channel无法订阅。Channel内部的缓冲区也可能持续增长。
3. **幽灵连麦**：dead channel不清理，bus以为客户端还在线。但实际上客户端已经重连建立了新的Channel，dead channel变成了"幽灵"。如果幽灵channel还占着session的绑定槽位，新的Channel无法绑定。

aptbot通过**自动unbind** 解决这些问题：

- **定期健康检查**：bus定期（如每30秒）调用所有Channel的 `isAlive()` 方法
- **死亡判定的阈值**：连续3次isAlive() 返回false，判定Channel死亡
- **自动解绑和清理**：死亡的Channel从session的绑定列表中移除，调用close() 释放资源

当Channel死亡后，如果客户端立即重连，会创建新的Channel并重新绑定到同一个session。dead channel的自动清理和新Channel的绑定是两个独立的过程——清理由健康检查触发，绑定由客户端发起。二者可能同时发生，但因为它们的操作对象不同（老channel的清理vs新channel的绑定），不会产生冲突。

## 五、发展方向

### 5.1 Telegram作为首条IM Channel

尽管aptbot的架构可以支持任意多个Channel实现，0.2.x只做了WebSocket。远期的第一条IM Channel规划是Telegram。

选择Telegram的原因：

- **Bot API成熟**：Telegram的Bot API是IM平台中文档最完善、限制最宽松的。它支持webhook和polling两种模式，消息类型丰富（文本、图片、文件、按钮、内联查询），且更新频率稳定。
- **多端天然支持**：Telegram自己就是多端的（手机、桌面、Web）。aptbot接入Telegram后，用户可以在手机Telegram里与agent对话，在电脑Telegram里查看历史——Telegram自己负责多端同步，aptbot不需要额外工作。
- **公开可达**：Telegram Bot通过webhook接收消息。用户不需要在家庭网络开端口、不需要动态DNS、不需要反向代理。在VPS上跑一个aptbot实例，Telegram Bot把消息通过api.telegram.org转发过来。

接入Telegram的核心难点是**消息模型差异**：IM平台是"消息"模型——一条消息一次发送，内容固定；aptbot是"流式事件"模型——LLM的token逐个产生、工具调用和结果是独立的事件。把流式事件"折叠"成IM消息是一个适配问题。

一种可能的方案是**消息聚合**：在Telegram Channel中维护一个"当前正在发送的消息"缓冲区。agent产生的llm_token事件不断追加到缓冲区，直到产生完整的句子或达到最大消息长度时，一次性通过Bot API发送。工具调用事件则作为独立的后续消息发送。这样用户看到的是"agent逐句输出"，体验接近在Telegram里和一个真人聊天。

### 5.2 IM Channel接入的泛化

Telegram之后，适配更多IM平台（Discord、Slack、飞书、企业微信）是一个自然的方向。每个平台的差异主要在于：

- **消息格式**：Markdown、HTML、自定义消息卡片
- **交互能力**：按钮、下拉菜单、模态框
- **文件传输**：图片、文档、代码片段
- **速率限制**：每个平台不同的限频策略

但核心的Channel抽象不需要变化——所有IM Channel都实现同样的4个方法。差异通过配置参数和适配器内部的转换逻辑处理。这是Channel抽象的价值所在：接入1个IM和接入20个IM的工作量是线性增长的，不会因为架构不支持而爆炸。

## 小结

Channel与多端接入是agent "状态独立于客户端"的基础设施。

1. **概念层面**：多端接入的核心矛盾是"一个agent服务多个客户端"。朴素的"每个客户端一个agent实例"方案会导致状态分裂和资源浪费。正确的做法是通过Channel抽象把事件生产与事件消费解耦。

2. **方案对比**：方案A（agent + channel强绑定）连接即session，架构简单但体验差——断连丢失、无法多端同步。方案B（独立session层 + channel透传）解决了session持久化，但仍不支持多端同时接入。方案C（类型化事件总线 + Channel抽象 + 多对一共享）架构最清晰，但需要额外的事件总线基础设施。

3. **aptbot的设计**：类型化事件总线（bus）+ AgentEventEnvelope解耦事件生产与消费；Channel接口最小化（type/send/close/isAlive）让接新端成本降到最低；wrapTransportChannel适配器复用成熟传输层；bindSession多对一共享实现真正的多端同步；dead-channel自动unbind避免幽灵连接和资源泄漏。目前WebSocket是主要实现，Telegram等IM Channel在远期规划中。

下一篇文章在Channel之上看Session系统：session的持久化、多用户隔离、多端同步的最终一致性模型，以及CLI的命令如何让session成为可组织的工作单元。
