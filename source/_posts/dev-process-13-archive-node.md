---
title: AI研发流程深度解析（十三）：Archive节点——从完成到闭环
description: 对比5个项目如何处理变更完成后的归档、合并和闭环，分析Delta合并机制、审计链价值和分支管理的关键差异。
tags:
  - 研发流程
  - Archive
  - 闭环
  - Delta
date: '2026-07-13'
categories:
  - AI编程实践
  - AI研发流程深度解析
lang: zh-CN
---

> **日期：** 2026-07-12
> **核心问题：** 5个项目如何处理变更完成后的归档、合并和闭环？Delta合并机制、审计链价值和分支管理有什么关键差异？各项目走过哪些弯路？我们能从中学到什么？

---

![AI研发流程深度解析（十三）：Archive节点——从完成到闭环](/images/dev-process/dev-process-13-archive-node.png)

## 1. 对比分析

### 1.1 Superpowers：Branch管理 + Worktree清理

Superpowers的Archive由 `finishing-a-development-branch` skill承担（`skills/finishing-a-development-branch/SKILL.md`）。核心机制是 **验证测试 → 检测环境 → 呈现选项 → 执行选择 → 清理worktree**。

**关键设计：**

- **验证测试先行**：在呈现选项前必须验证测试通过——"如果测试失败：在测试通过之前无法进行merge/PR。"。Stop. 不进入Step 2。
- **环境检测**：通过 `GIT_DIR` vs `GIT_COMMON` 判断当前是normal repo、worktree（named branch）还是detached HEAD。不同环境呈现不同菜单和清理策略。
- **四选项菜单**（normal repo和named-branch worktree）：
  1. Merge back to base-branch locally
  2. Push and create a Pull Request
  3. Keep the branch as-is
  4. Discard this work
- **三选项菜单**（detached HEAD）：无merge选项——detached HEAD不能直接merge
- **Provenance-based cleanup**：只清理 `.worktrees/` 或 `worktrees/` 下的worktree——"Superpowers创建了这个worktree，我们负责清理"。其他worktree（harness管理的）不碰——"宿主环境（harness）拥有这个workspace。不要移除它。"
- **Merge后再次验证**：merge完成后在merged result上再次运行测试——确保merge本身没有引入问题
- **Discard需要输入确认**：要求用户输入 "discard" 确认——防止意外删除工作
- **不处理spec归档**：spec保留在 `docs/superpowers/specs/` 中，不合并到source of truth。spec是一次性文档，不随系统演进。
- **不处理审计链保留**：只有git log，没有change文件夹式的完整上下文保留

**历史踩坑：**

skill明确列出了7种Common Mistakes和7条Red Flags——这些是实际运行中观察到的失败模式：

| 问题 | 具体表现 | 修复 |
|------|---------|------|
| 跳过测试验证 | Merge了broken code，创建failing PR | "总是在提供选项前验证测试"——Step 1是hard gate，tests不通过则Stop |
| 开放式问题 | "What should I do next?" 含义模糊 | "准确呈现4个结构化选项（detached HEAD为3个）"——结构化选择而非开放问题 |
| Option 2清理worktree | 删除了用户迭代PR feedback需要的worktree | "只在Option 1和4时清理"——Option 2 (PR) 和Option 3 (Keep) 总是保留worktree |
| 删除分支前未移除worktree | `git branch -d` 失败——worktree仍引用该分支 | "先merge，再移除worktree，然后删除分支"——顺序必须是merge → remove worktree → delete branch |
| 在worktree内部执行 `git worktree remove` | 命令静默失败——CWD在被移除的worktree内 | "在 `git worktree remove` 之前总是先 `cd` 到主仓库根目录" |
| 清理harness管理的worktree | 删除其他工具创建的worktree导致phantom state | "只清理 `.worktrees/` 或 `worktrees/` 下的worktree"——provenance-based cleanup |
| Discard无确认 | 意外删除工作 | "要求输入 'discard' 确认"——必须输入完整单词 |

**核心教训：** Superpowers的Archive设计围绕"worktree生命周期管理"——这是其他4个项目都没有覆盖的维度。7种Common Mistakes全部与worktree或分支操作的顺序错误有关——说明worktree管理是极易出错的操作，需要严格的顺序约束和provenance检查。

### 1.2 OpenSpec：Delta合并 + 审计链 + Source of Truth

OpenSpec的Archive由 `/opsx:archive` 命令承担（`src/core/archive.ts`、`src/core/specs-apply.ts`）。这是五个项目中**最完整的Archive机制**——将delta specs合并回source of truth，同时保留完整审计链。

**关键设计：**

- **Delta合并**：archive时将change文件夹中的delta specs合并回 `openspec/specs/` source of truth。合并顺序严格：**RENAMED → REMOVED → MODIFIED → ADDED**（`specs-apply.ts` 第250行）。
- **原子性保证**：先在内存中prepare所有updates（`buildUpdatedSpec`），验证全部通过后才写入文件——archive.ts第439-440行注释："在写入任何spec之前验证每个重建的spec，这样即使最后的验证失败也确实不会改变任何目标文件"。具体流程：
  1. `findSpecUpdates`：找到所有需要更新的spec文件
  2. `buildUpdatedSpec`：在内存中构建每个spec的更新版本（不写入）
  3. 验证所有rebuilt spec——任何一个失败则全部不写入
  4. `writeUpdatedSpec`：全部验证通过后才写入磁盘
- **跨段冲突检测**：同一requirement不能同时出现在MODIFIED和REMOVED、MODIFIED和ADDED、ADDED和REMOVED中（`specs-apply.ts` 第170-177行）。
- **MODIFIED的scenario保护**：`findMissingCurrentScenarios` 检查MODIFIED块是否遗漏了当前spec中的scenario——"当前spec包含modified块中不存在的scenario……在归档前刷新change spec以避免丢失scenario。"（`specs-apply.ts` 第303-307行）。防止用户在MODIFIED时意外删除scenario。
- **REMOVED验证**：REMOVED的requirement必须存在于main spec——不存在则报错。但新spec的REMOVED会被忽略（带warning）。
- **ADDED验证**：ADDED的requirement不能已存在于main spec。
- **RENAMED验证**：FROM必须存在，TO不能已存在。MODIFIED必须引用NEW header而非FROM——"当存在rename时，MODIFIED必须引用NEW header而非FROM"。
- **验证矩阵**：
  - 新spec（target不存在）：只允许ADDED；MODIFIED和RENAMED报错；REMOVED忽略（带warning）
  - 已有spec（target存在）：ADDED不能已存在；MODIFIED/REMOVED必须存在；RENAMED FROM必须存在、TO不能已存在
- **Change文件夹归档**：移动到 `changes/archive/YYYY-MM-DD-<name>/`，保留完整上下文（proposal + design + tasks + specs delta）
- **验证前归档**：归档前验证delta specs格式和main spec结构——验证失败则不归档
- **Task完成检查**：归档前检查tasks.md中的checkbox——未完成task需要确认才能归档
- **`--no-validate` 应急选项**：可跳过验证（不推荐），需要 `--yes` 确认
- **Bulk archive**：支持多个change同时归档，检测spec冲突
- **跨平台兼容**：`moveDirectory` 在 `fs.rename` 失败时（Windows EPERM/EXDEV）回退到copy-then-remove

**历史踩坑：**

OpenSpec的CHANGELOG记录了多个archive相关的历史问题：

| CHANGELOG记录 | 问题 | 修复 |
|---------------|------|------|
| "Safer requirement archiving" | Stale `MODIFIED` requirements会静默删除之前archive添加的scenarios——用户MODIFIED一个requirement但遗漏了已有scenarios，archive后scenarios消失 | 引入 `findMissingCurrentScenarios` 检查——MODIFIED块必须包含当前spec中的所有scenarios，否则报错 "在归档前刷新change spec以避免丢失scenario" |
| "archive exits non-zero when blocked in human mode" | `openspec archive <change> -y` 验证失败时返回exit code 0——脚本和CI误以为archive成功 | 三条阻断路径（delta-spec验证失败、spec rebuild失败、rebuilt-spec验证失败）现在设 `process.exitCode = 1`，与 `--json` 模式对齐 |
| "Task progress reads nested/glob tasks.md" | archive的incomplete-task gate无法解析嵌套/glob模式的tasks.md——嵌套task文件的change可能在未完成时被archive | task progress现在通过tracked-tasks artifact的 `generates` glob解析，与 `status` 命令使用相同的文件解析逻辑 |
| "Archive operations on cross-device or restricted paths" | `fs.rename` 在网络/外部驱动器上失败（EPERM/EXDEV）——archive在跨设备路径上不工作 | `moveDirectory` 在 `fs.rename` 失败时回退到copy-then-remove |
| "Fixed archive workflow stopping mid-way when syncing" | Archive工作流在sync后停在中间——sync完成后没有正确恢复 | 修复为sync完成后正确恢复archive流程 |
| "Requirement reading fidelity" | change-delta路径和main-spec路径的requirement reader有分歧——解析结果不一致 | 统一为一个fence-、metadata-、multi-line-aware的提取器 |

**核心教训：** OpenSpec的Delta合并机制经历了多次迭代才达到当前的安全水平。最关键的历史问题是 **scenario静默删除**——用户MODIFIED一个requirement但没有包含已有scenarios，archive后scenarios就消失了，且没有任何警告。`findMissingCurrentScenarios` 检查是对这个问题的直接回应。第二个关键问题是 **exit code不一致**——archive失败返回0让CI误判成功，这个看似小的问题在实际使用中会导致严重的流水线错误。

### 1.3 ECC：Conventional Commits + Continuous Learning闭环

ECC的Archive是 `orch-*` pipeline Phase 6——conventional commits + GATE 2 + 学习提取（`skills/orch-pipeline/SKILL.md`、`skills/continuous-learning-v2/SKILL.md`）。

**关键设计：**

- **Conventional commits**：feat/fix/refactor，一个逻辑块一个提交
- **GATE 2**：在Commit前要求用户确认——"有gate而非自动执行"。用户确认diff summary和提交信息后才提交。GATE 1在Plan之后——"在用户批准之前不要写实现代码"
- **无spec归档**：没有delta合并、没有source of truth更新。Acceptance Brief是一次性工作产物，不随变更演进
- **`/checkpoint` command**：保存验证状态，支持跨session恢复
- **Continuous Learning v2的hooks**：自动提取会话模式为 **instincts**——这是"学习闭环"而非"spec闭环"。复杂任务（>=3 edits）必须touch学习库否则delivery-gate阻断。
  - Instinct → skill演化：高置信度的instinct可以升级为skill（`/evolve` 命令）
  - 这是行为学习——agent从经验中学习"什么有效"，而非spec从变更中演进
- **默认关闭**：Continuous Learning v2的observer默认关闭（`config.json` 中 `observer.enabled: false`）——效果未验证

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v1 | Skills概率性触发（50-80%）——session末尾的Stop hook可能不触发，学习模式丢失 | v2改用PreToolUse/PostToolUse hooks——"hooks 100% 触发，是确定性的"；v1文档明确标注："v1依赖skills来观察。skills是概率性的——它们大约50-80% 的时间会触发" |
| v2.0 | 全局存储（`~/.claude/homunculus/`）——React项目的instinct会污染Python项目 | v2.1引入project-scoped instincts——"React模式留在你的React项目中，Python约定留在你的Python项目中"；通过git remote URL/repo path自动检测项目 |
| v2.0 | 无项目晋升机制——通用模式（如 "always validate input"）只能留在单个项目中 | v2.1引入 `/promote` 命令——当同一instinct在2+ 项目中出现且平均置信度 >= 0.8，可晋升为全局 |
| v2.1 | 数据存储在 `~/.claude/homunculus/` 下——Claude Code的sensitive-path guard阻止后台instinct写入 | v2.1将数据迁移到 `${XDG_DATA_HOME:-~/.local/share}/ecc-homunculus/`——避开Claude Code保护路径 |
| 持续存在 | Observer默认关闭——学习闭环不自动运行 | 未修复——config.json中 `observer.enabled: false`，效果未验证 |
| 持续存在 | 无结构化的spec模型——AC是一次性工作产物，不持续演进 | 未修复——ECC的设计取向是"提供素材不定义流程"，spec持续演进是OpenSpec的关注点 |

**核心教训：** ECC的学习闭环经历了从v1（Stop hook，50-80% 触发）到v2.0（PreToolUse/PostToolUse hooks，100% 触发）再到v2.1（project-scoped）的演进。核心教训是：**hook 100% 触发是学习闭环的可靠性基础**——如果观察机制本身不可靠，提取的学习模式就不完整。但ECC也承认observer默认关闭——"提供能力不保证效果"，学习闭环的实际价值仍待验证。

### 1.4 mattpocock-skills：极简Commit + Handoff传递

mattpocock的Archive是最轻量的——git commit + 可选handoff（`skills/engineering/implement/SKILL.md`、`skills/productivity/handoff/SKILL.md`）。

**关键设计：**

- **直接commit到当前分支**："将你的工作提交到当前分支。"——implement完成后直接提交，没有merge/PR/discard选项菜单
- **不处理分支管理**：merge/PR由用户决定，skill不介入
- **不清理worktree**：没有worktree管理机制
- **不处理spec合并**：无source of truth、无delta合并
- **`/handoff`——独特的context传递机制**：
  - 将当前对话压缩为handoff文档供下一个agent继续
  - 保存到 **OS临时目录**而非workspace——"保存到用户OS的临时目录——而不是当前workspace"——避免污染repo
  - 包含 "suggested skills" 部分建议下一个agent应调用的skill
  - **不复制其他artifact**（specs/plans/ADRs/issues/commits/diffs）——通过路径或URL引用
  - Redact敏感信息（API keys、passwords、PII）
  - `disable-model-invocation: true`——用户手动触发，不自动调用
- **handoff传递的是"对话状态"而非"系统状态"**——它不记录系统当前行为，只记录"我们做到哪了"

**历史踩坑：**

mattpocock的skill文件极为简洁——implement SKILL.md仅16行，handoff SKILL.md仅17行。没有版本历史或明确的pitfall文档。以下是基于设计取向分析的潜在问题：

| 问题 | 具体表现 | 设计取向 |
|------|---------|---------|
| Handoff保存到OS临时目录 | 系统重启或清理临时目录后handoff文档丢失 | 有意为之——避免污染repo；handoff是短期对话状态传递，不是长期持久化 |
| Handoff不复制artifact | 如果artifact被移动或删除，handoff中的路径/URL引用失效 | 有意为之——"不要复制已存在于其他artifact中的内容。通过路径或URL引用它们。"——避免冗余和不一致 |
| 无分支管理 | 用户需要自己处理merge/PR/discard——skill不提供指导 | 反映mattpocock "不拥有流程"的设计取向——git工作流由用户和git工具管理 |
| 无spec持续演进 | PRD发布到issue tracker后不随系统演进——spec会过时 | 反映mattpocock的轻量取向——spec是"为当前变更服务的一次性文档" |
| 无worktree清理 | worktree残留需要用户手动清理 | mattpocock不使用worktree机制——implement直接在当前分支工作 |

**核心教训：** mattpocock的Archive是"极简主义"的体现——只做commit和可选的handoff。Handoff保存到OS临时目录而非workspace是一个有意的设计——避免污染repo，但代价是持久性不保证。不复制artifact的设计避免了冗余，但引入了引用失效的风险。这些tradeoff反映了mattpocock的核心立场：**skill不拥有流程**——用户负责git工作流、spec演进和worktree管理。

### 1.5 gstack：21步Ship流程 + 知识归档

gstack的Archive是最重的——21步ship流程 + retro + learn + document-release（`ship/SKILL.md`、`retro/SKILL.md`、`learn/SKILL.md`、`document-release/SKILL.md`）。

**关键设计：**

- **`/ship`——非交互式全自动**："这是一个非交互式、完全自动化的工作流。不要在任何步骤请求确认。用户说了 /ship就意味着执行。"
- **21步ship流程**：
  1. Pre-flight（检查branch、diff、review readiness）
  2. Distribution Pipeline Check（检查是否有发布管道）
  3. Merge base branch（BEFORE tests）
  4-6. Test suites + eval suites
  7. Test coverage audit
  8. Plan completion audit + scope drift
  9. Pre-landing review + specialist dispatch
  10. Greptile review comments
  11. Adversarial review + learnings capture
  12. Version bump（auto-decide）
  13. CHANGELOG
  14. TODOS.md update
  15-16. WIP commit filtering
  17. Push
  18-19. PR/MR creation
  20. Persist ship metrics
  21. Plan-tune discoverability nudge
- **Review Readiness Dashboard**：ship前显示所有审查状态——Eng Review是required（可全局禁用），其他informational。Staleness detection比较审查时commit与当前HEAD——"Note: {skill} review from {date} may be stale — {N} commits since review"
- **WIP commit过滤**（Step 15.0）：`/ship` 过滤压缩WIP commit——保留非WIP commit，保持bisect干净。**Anti-footgun rules**："永远不要在有非WIP commit时盲目 `git reset --soft`。Codex将此标记为破坏性操作——它会uncommit真实已落地工作，并将push步骤变成对已经push过的人来说的non-fast-forward push。"
- **Bisectable commits**（Step 15.1）：每个commit代表一个逻辑变更——"每个commit应该代表一个连贯的变更——不是一个文件，而是一个逻辑单元"。Commit顺序：Infrastructure → Models & services → Controllers & views → VERSION + CHANGELOG + TODOS.md
- **Verification Gate**（Step 16）：Iron Law——"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"。如果Steps 4-6后代码有变更，必须重新运行测试。"声称工作完成但没有验证是不诚实，不是效率。"
- **Credential pre-push guard**（Step 17）：可选的pre-push hook阻止包含凭证的push——API keys、tokens、private keys
- **Idempotency**：重新运行 `/ship` 意味着"重新运行整个检查列表"——每个验证步骤都重新运行，只有action是幂等的（VERSION已bump则跳过、已push则跳过、PR已存在则更新body）
- **Stop条件**：在base branch、无法自动解决的merge conflicts、in-branch test failures、Pre-landing review ASK items、MINOR/MAJOR version bump、coverage below threshold、plan items NOT DONE、plan verification failures、TODOS.md missing/disorganized
- **`/retro`**：团队回顾——analyzes commit history, work patterns, and code quality metrics with persistent history and trend tracking。Team-aware: per-person breakdowns
- **`/learn`**：记忆管理——review, search, prune, and export what gstack has learned across sessions。"learnings compound across sessions"
- **`/document-release`**：自动文档同步——对照diff更新漂移文档
- **decisions.jsonl**：append-only event-sourced决策存储，`--supersede` 允许反转但要求显式声明
- **无spec归档**：没有delta合并、没有source of truth更新——与OpenSpec的持续spec演进形成对比

**历史踩坑：**

| 问题 | 具体表现 | 修复 |
|------|---------|------|
| WIP commit squash破坏非WIP commit | `git reset --soft <merge-base>` 会uncommit所有commit包括非WIP的已落地工作——push变成non-fast-forward | Anti-footgun rules："永远不要在有非WIP commit时盲目 `git reset --soft`。Codex将此标记为破坏性操作"——先检测非WIP commit数量，只有全WIP时才reset-soft |
| 在worktree内部执行 `git worktree remove` 静默失败 | 与Superpowers相同的问题 | 不适用——gstack不使用worktree机制 |
| Review结果过时——之前的review与当前HEAD不同 | 审查时的commit与当前HEAD不同，review结果可能已不适用 | Staleness detection——比较审查时commit与当前HEAD，显示 "注意：{skill} 审查（来自 {date}）可能已过时——审查以来已有 {N} 个commit" |
| Push包含凭证 | API keys、tokens、private keys被推送到远程 | Credential pre-push guard（Step 17）——可选的pre-push hook阻止包含凭证的push |
| 代码在review后被修改但未重新测试 | Steps 4-6的测试结果不再适用于修改后的代码 | Verification Gate（Step 16）——"如果Step 5的测试运行后有任何代码变更，重新运行测试套件。粘贴新的输出。Step 5的旧输出是不可接受的。" |
| 重运行 /ship跳过已完成的验证步骤 | 用户以为重运行是安全的，但验证步骤被跳过导致问题未被发现 | "重新运行 `/ship` 意味着重新运行整个检查列表。每个验证步骤在每次调用时都运行。永远不要因为之前的 `/ship` 运行已经执行过某个验证步骤就跳过它。" |
| TODOS.md不存在或混乱 | 新项目没有TODOS.md，或格式不规范 | Step 14提供创建/重组选项——"Would you like to create one?" / "Would you like to reorganize it?" |
| 非交互式流程中AskUserQuestion不可靠 | Conductor环境中AskUserQuestion失败 | 多层fallback：Conductor → prose fallback；headless → BLOCKED；interactive → prose with triad（ELI10 + Completeness + Recommendation） |

**核心教训：** gstack的21步ship流程是对"Archive应该做什么"最全面的回答——从pre-flight到PR创建再到metrics持久化，覆盖了其他所有项目的所有维度。但最核心的教训来自WIP commit squash的anti-footgun rules——**自动化操作中最危险的是"看起来安全但实际破坏性"的操作**。`git reset --soft` 在全WIP分支上是安全的，但在混合分支上会uncommit真实工作。gstack的解法是先检测再决定策略——"如果不确定，宁可停下来通过AskUserQuestion询问用户，也不要销毁非WIP commit。"

---

## 2. 关键差异

### 2.1 Spec归档机制对比

| 项目 | Spec合并 | Source of Truth | 审计链 | Spec演进 |
|------|----------|----------------|--------|----------|
| **Superpowers** | ❌ 无 | ❌ 无 | 只有git log | ❌ 无（一次性文档） |
| **OpenSpec** | ✅ Delta合并（RENAMED→REMOVED→MODIFIED→ADDED） | ✅ `openspec/specs/` 持续演进 | ✅ change文件夹完整保留 | ✅ 每次archive更新spec |
| **ECC** | ❌ 无 | ❌ 无 | 只有git log | ❌ 无（Acceptance Brief一次性） |
| **mattpocock** | ❌ 无 | ❌ 无 | 只有git log | ❌ 无（PRD一次性） |
| **gstack** | ❌ 无 | ❌ 无 | decisions.jsonl + learnings.jsonl | ❌ 无（spec一次性） |

**关键观察：** 只有OpenSpec实现了spec的持续演进。其他4个项目的spec/设计文档都是"为当前变更服务的一次性文档"——描述"要做什么"而非"系统当前行为是什么"。这意味着除OpenSpec外，所有项目的spec都会随系统演进而过时。

### 2.2分支管理对比

| 项目 | 分支管理 | Worktree清理 | 用户确认 |
|------|---------|-------------|---------|
| **Superpowers** | 4选项菜单（merge/PR/keep/discard） | ✅ Provenance-based（只清理自己的） | Discard需要输入确认 |
| **OpenSpec** | ❌ 不涉及（"OpenSpec doesn't touch git"） | ❌ 不涉及 | ❌ 不涉及 |
| **ECC** | GATE 2用户确认 | ❌ 无 | ✅ GATE 2确认diff summary |
| **mattpocock** | ❌ 不涉及（直接commit） | ❌ 无 | ❌ 无 |
| **gstack** | 全自动（push + PR/MR） | ❌ 无 | ⚠️ 非交互式（除非遇到stop条件） |

**关键观察：** Superpowers是唯一系统化处理分支管理和worktree清理的项目。OpenSpec有意不碰git——只读写Markdown文件。gstack的ship流程是全自动的——"用户说了 /ship就意味着执行"。

### 2.3知识归档对比

| 项目 | 知识归档 | 归档内容 | 自动/手动 |
|------|---------|---------|----------|
| **Superpowers** | ❌ 无 | — | — |
| **OpenSpec** | ✅ change文件夹归档 | proposal + design + tasks + specs delta | 自动（archive命令） |
| **ECC** | ✅ Continuous Learning v2 | instincts（会话模式提取） | 自动（PreToolUse/PostToolUse hooks） |
| **mattpocock** | ✅ handoff | 对话压缩 + suggested skills | 手动（`/handoff`） |
| **gstack** | ✅ learnings + decisions + retro | learnings.jsonl + decisions.jsonl + retro报告 | 自动 + 手动 |

**关键观察：** 知识归档有三种不同方向——OpenSpec归档的是 **spec上下文**（为什么做这个变更），ECC归档的是 **行为模式**（agent从经验中学到什么），gstack归档的是 **决策和学习**（做过什么决策 + 发现了什么模式）。mattpocock的handoff是独特的——它归档的是 **对话状态**（做到哪了 + 下一步做什么），不是系统状态。

### 2.4自动化程度对比

| 项目 | 自动化程度 | 人工确认点 |
|------|----------|-----------|
| **Superpowers** | 半自动 | 4选项选择 + discard确认 |
| **OpenSpec** | 半自动 | spec更新确认 + 未完成task确认 |
| **ECC** | 半自动 | GATE 2（Commit前确认） |
| **mattpocock** | 手动 | commit + 可选handoff |
| **gstack** | 全自动 | 非交互式（除非stop条件触发） |

**关键观察：** gstack是唯一全自动的——"不要在任何步骤请求确认"。其他项目都有人工确认点。Superpowers的4选项菜单是最结构化的用户选择。OpenSpec的确认是渐进的——spec更新确认 + 未完成task确认。

---

## 3. 历史踩坑汇总与经验教训

### 3.1踩坑类型分类

将五个项目在Archive节点的历史踩坑按类型归纳，可以发现一些反复出现的模式：

**类型一：Worktree / 分支操作顺序错误**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers | 删除分支前未移除worktree——`git branch -d` 失败 | worktree仍引用该分支 | "先merge，再移除worktree，然后删除分支"——顺序约束 |
| Superpowers | 在worktree内部执行 `git worktree remove`——命令静默失败 | CWD在被移除的worktree内 | "在 `git worktree remove` 之前总是先 `cd` 到主仓库根目录" |
| Superpowers | Option 2 (PR) 清理了worktree——用户失去PR迭代的工作区 | 不区分选项一律清理 | "只在Option 1和4时清理"——Option 2和3总是保留 |
| gstack | WIP commit squash用 `git reset --soft` 破坏非WIP commit | 不区分WIP和非WIP一律reset | Anti-footgun rules：先检测非WIP commit数量，只有全WIP时才reset-soft |

**类型二：归档验证不充分或被绕过**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| OpenSpec | Stale MODIFIED静默删除scenarios——用户遗漏已有scenarios | 没有scenario保护检查 | `findMissingCurrentScenarios`——MODIFIED块必须包含当前spec的所有scenarios |
| OpenSpec | Archive验证失败返回exit code 0——CI误判成功 | human mode没有设置exit code | 三条阻断路径设 `process.exitCode = 1`，与 `--json` 对齐 |
| OpenSpec | 嵌套tasks.md的incomplete-task gate无法解析——未完成task被archive | task progress解析不支持glob | 通过tracked-tasks artifact的 `generates` glob解析 |
| gstack | 代码在review后被修改但未重新测试——stale验证结果 | 没有强制重新验证 | Verification Gate（Step 16）——"如果Step 5的测试运行后有任何代码变更，重新运行" |
| gstack | 重运行 /ship跳过已完成的验证步骤 | 用户以为idempotent意味着跳过验证 | "永远不要因为之前的 `/ship` 运行已经执行过某个验证步骤就跳过它" |

**类型三：跨环境/跨平台兼容性**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| OpenSpec | `fs.rename` 在网络/外部驱动器上失败（EPERM/EXDEV） | Node.js rename在跨设备时不工作 | `moveDirectory` 回退到copy-then-remove |
| ECC v2.1 | 数据存储在 `~/.claude/homunculus/`——Claude Code sensitive-path guard阻止写入 | Claude Code保护 `~/.claude/` 路径 | 迁移到 `${XDG_DATA_HOME:-~/.local/share}/ecc-homunculus/` |
| gstack | Conductor环境中AskUserQuestion不可靠——native被禁用，MCP variant flaky | 环境差异导致交互工具不可用 | 多层fallback：Conductor → prose；headless → BLOCKED；interactive → prose with triad |

**类型四：学习闭环可靠性**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| ECC v1 | Stop hook 50-80% 触发——学习模式可能丢失 | skill约束依赖agent遵守 | v2改用PreToolUse/PostToolUse hooks——100% 触发 |
| ECC v2.0 | 全局存储导致跨项目污染——React模式影响Python项目 | 无项目隔离 | v2.1引入project-scoped instincts——通过git remote URL自动检测项目 |
| ECC v2.1 | Observer默认关闭——学习闭环不自动运行 | 效果未验证，保守默认 | 未修复——config.json中 `observer.enabled: false` |
| gstack | Review结果过时——审查时commit与当前HEAD不同 | 没有staleness检测 | Staleness detection——比较commit hash，显示 "可能已过时——审查以来已有 {N} 个commit" |

**类型五：自动化操作的破坏性风险**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| gstack | `git reset --soft` 破坏非WIP commit——已落地工作被uncommit | 不区分WIP和非WIP一律reset | Anti-footgun rules + 先检测再决定策略 |
| Superpowers | 清理harness管理的worktree导致phantom state | 不区分自己创建的和harness创建的 | Provenance-based cleanup——只清理 `.worktrees/` 或 `worktrees/` |
| Superpowers | Discard意外删除工作 | 无确认 | "要求输入 'discard' 确认" |
| gstack | Push包含凭证 | 无凭证检测 | Credential pre-push guard——可选的pre-push hook |
| gstack | 重运行 /ship的幂等性误解——用户以为验证被跳过是安全的 | idempotent的定义不清晰 | 明确区分：actions幂等（跳过已执行的），verifications不幂等（每次都运行） |

### 3.2经验教训总结

从五个项目的踩坑历史中，可以提炼出以下经验教训：

**教训一：Worktree / 分支操作的顺序约束必须显式化**

Superpowers的7种Common Mistakes中有5种与操作顺序有关——merge → remove worktree → delete branch、cd to main root before worktree remove、Option 2/3保留worktree。这些顺序约束不是显而易见的——`git branch -d` 在worktree存在时会失败，`git worktree remove` 在CWD内部会静默失败。gstack的WIP commit squash同样——`git reset --soft` 看似安全但在混合分支上破坏性极大。关键洞察是：**涉及git状态变更的操作必须有显式的顺序检查和前置条件验证**。

**教训二：归档验证的"静默失败"是最危险的失败模式**

OpenSpec的scenario静默删除是最典型的例子——用户MODIFIED一个requirement但遗漏了已有scenarios，archive后scenarios消失，没有任何警告。exit code 0返回是另一个静默失败——CI误判成功。gstack的stale验证结果也类似——代码在review后被修改但未重新测试。关键洞察是：**归档操作必须验证所有可能被破坏的内容**——不只是格式验证，还要验证语义完整性（scenarios没有丢失）、状态一致性（代码与验证结果匹配）、退出码正确性（失败时非零退出）。

**教训三：学习闭环的可靠性取决于观察机制**

ECC从v1（Stop hook，50-80%）到v2（PreToolUse/PostToolUse hooks，100%）的演进清晰地展示了这一点——如果观察机制本身不可靠，提取的学习模式就不完整。但v2.1的observer默认关闭说明另一个问题——**100% 触发的hook也可能因为效果未验证而不敢默认开启**。gstack的staleness detection是另一种可靠性保障——不只关注"是否运行了"，还关注"结果是否仍然有效"。

**教训四：跨环境兼容性是归档机制的隐性成本**

OpenSpec的 `fs.rename` 在跨设备路径上失败、ECC的数据目录被Claude Code保护路径阻止、gstack的AskUserQuestion在Conductor中不可靠——这些都是跨环境兼容性问题。归档机制需要在多种环境下工作（本地、CI、网络驱动器、Conductor），每种环境都有不同的约束。关键洞察是：**归档机制的设计需要考虑环境差异**——文件操作需要fallback、路径选择需要避开保护区域、交互工具需要多层fallback。

**教训五：自动化程度与安全性的tradeoff**

gstack的全自动ship流程（"不要在任何步骤请求确认"）是最高效的，但也需要最完善的stop条件覆盖。Superpowers的4选项菜单是最保守的——用户在每个关键决策点都参与。OpenSpec的渐进确认（spec更新确认 + 未完成task确认）是中间路线。关键洞察是：**自动化程度越高，stop条件的覆盖面必须越广**——gstack列出了10种stop条件和8种"never stop for"条件，这种显式枚举是全自动模式安全的基础。

---

## 4. 实践方向讨论

### 4.1 Delta合并机制：是否需要Source of Truth？

**OpenSpec的立场**：Delta合并是核心闭环——spec随变更有机增长。合并顺序RENAMED→REMOVED→MODIFIED→ADDED是程序化执行的。原子性保证（先验证后写入）防止部分更新。审计链保留每个变更的"为什么"。

**其他项目的立场**：不需要source of truth。spec/设计文档是一次性文档，描述"要做什么"而非"系统当前行为"。系统演进后spec自然过时——但这没关系，因为下一次变更会写新的spec。

**tradeoff分析：**

- **Delta合并的优势**：
  - spec始终描述系统当前行为——回答"系统现在到底怎么工作"
  - 6个月后spec告诉你设计决策的来龙去脉
  - 新session的AI agent可以读spec理解系统
  - Brownfield变更可以基于现有spec做delta——不需要重新理解全部
- **Delta合并的代价**：
  - 需要结构化spec格式（Requirement + Scenario）才能程序化合并
  - 需要validator保障格式正确
  - 合并可能出错——OpenSpec的历史表明scenario静默删除、exit code不一致都曾发生
  - Spec腐化风险——spec与代码不一致时需要额外维护
- **无source of truth的优势**：简单——不需要维护spec持续演进
- **无source of truth的代价**：spec过时——系统演进后spec不再描述当前行为

**可能的好的实践方向**：Delta合并的价值在长期维护的项目中最大——spec作为"系统当前行为的持续记录"比"为当前变更服务的一次性文档"有更高的长期价值。但Delta合并的采用成本较高——需要结构化spec格式 + validator + 合并工具 + scenario保护。OpenSpec的原子性保证（先验证后写入）和scenario保护（MODIFIED时检查遗漏的scenario）是降低Delta合并风险的关键设计——且这些设计都是对真实历史问题的回应。

### 4.2审计链价值：保留什么上下文？

**OpenSpec的立场**：保留change文件夹的完整上下文——proposal（为什么做）+ design（怎么做）+ tasks（做了什么）+ specs delta（改了什么行为）。归档后仍可回溯。

**gstack的立场**：decisions.jsonl是append-only event-sourced决策存储——每个决策都有时间戳和上下文。`/retro` 提供per-person breakdowns + shipping streaks + test health trends。`/learn` 让learnings compound across sessions。

**ECC的立场**：instincts是行为学习——agent从经验中提取"什么有效"的模式。高置信度的instinct可以升级为skill。

**tradeoff分析：**

- **OpenSpec的spec上下文**：回答"为什么做这个变更"——可回溯设计决策的来龙去脉
- **gstack的decisions + learnings**：回答"做过什么决策 + 发现了什么模式"——agent变聪明
- **ECC的instincts**：回答"什么有效"——行为学习而非系统状态
- **mattpocock的handoff**：回答"做到哪了 + 下一步做什么"——对话状态传递

**可能的好的实践方向**：审计链的价值取决于使用场景——如果需要回溯"为什么系统是这样设计的"（如6个月后的维护），OpenSpec的spec上下文最有价值。如果需要agent从经验中学习（如避免重复错误），gstack的learnings最有价值。两者可能是互补的——spec上下文记录"系统状态"，learnings记录"行为模式"。OpenSpec的change文件夹是自动生成的（archive命令），gstack的learnings是 `/learn` 管理的——两者的自动化程度都足够高。

### 4.3分支管理与归档统一

**Superpowers的立场**：分支管理是Archive的核心——4选项菜单 + worktree清理 + provenance-based cleanup。

**OpenSpec的立场**：不碰git——"OpenSpec doesn't touch git"。Archive只管spec合并和change文件夹归档，分支管理由用户/其他工具处理。

**gstack的立场**：全自动——/ship处理push + PR/MR创建，但不是"菜单式选择"而是"直接执行"。

**tradeoff分析：**

- **统一管理的优势**：用户在一个地方完成所有收尾工作——merge/PR + spec归档 + worktree清理
- **统一管理的代价**：耦合——如果spec合并失败，分支管理也受阻
- **分离的优势**：解耦——OpenSpec管spec治理，git工作流由用户/其他工具管理。`superpowers-bridge` 社区schema正是这个思路——"将OpenSpec的artifact治理与Superpowers的执行技能集成"
- **分离的代价**：用户需要在多个工具间切换

**可能的好的实践方向**：Superpowers的4选项菜单是最用户友好的——结构化选择而非全自动执行。OpenSpec的"不碰git"是最解耦的——允许用户使用任何git工作流。两者的结合可能是最优——spec归档和分支管理分离，但在同一个流程中执行。gstack的全自动模式适合有经验的用户——"用户说了 /ship就意味着执行"。

### 4.4知识闭环：Spec演进vs行为学习

**OpenSpec的立场**：spec闭环——每次archive将delta合并回source of truth，spec随变更有机增长。

**ECC的立场**：行为学习闭环——Continuous Learning v2自动提取会话模式为instincts，高置信度的instinct升级为skill。

**gstack的立场**：双重闭环——decisions.jsonl保留决策审计链，learnings.jsonl让agent变聪明。`/retro` 提供团队回顾。

**tradeoff分析：**

- **Spec闭环的优势**：系统状态可追溯——回答"系统当前行为是什么"和"为什么是这样设计的"
- **Spec闭环的代价**：需要结构化spec + Delta合并 + validator——工具链成本高；合并可能出错（OpenSpec的历史证明了这一点）
- **行为学习闭环的优势**：agent从经验中学习——避免重复错误，提升效率
- **行为学习闭环的代价**：instinct的质量难以保证；observer默认关闭且效果未验证
- **双重闭环的优势**：既追溯系统状态又学习行为模式
- **双重闭环的代价**：维护两套系统——spec和learnings

**可能的好的实践方向**：Spec闭环和行为学习闭环是正交的——前者关注"系统状态"，后者关注"行为模式"。长期维护的项目可能需要两者——spec闭环确保系统行为可追溯，行为学习确保agent持续改进。但两者的优先级不同——spec闭环对长期维护的项目是必须的（否则spec过时），行为学习是锦上添花（agent本身有基础能力）。OpenSpec的"自动archive"比ECC的"hook提取instinct"更可靠——因为spec合并是确定性操作，而instinct提取依赖AI推理。

---

## 5. 总结：Archive节点的实践参考

> **声明：** 以下总结基于五个项目的实践经验和踩坑教训，试图提炼出一些有参考价值的结论。但这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中寻找一些相对普遍的规律，供读者参考和批判。

### 5.1总体要求

经过对五个项目的全面分析，我们认为Archive节点需要满足以下总体要求：

**要求一：归档前必须验证完整性**

OpenSpec的scenario静默删除教训和gstack的stale验证结果教训都指向同一个方向——归档前的验证不能只查格式，还要查语义完整性。Superpowers的"验证测试先行"是最基本的要求——如果测试不通过，不呈现任何选项。

**要求二：涉及状态变更的操作必须有显式顺序约束**

Superpowers的7种Common Mistakes和gstack的anti-footgun rules都表明——git状态变更操作（merge、branch delete、worktree remove、reset）极易因顺序错误而失败。这些顺序约束必须显式化，不能依赖用户或agent的常识。

**要求三：自动化程度越高，stop条件覆盖面必须越广**

gstack全自动ship列出了10种stop条件和8种"never stop for"条件——这种显式枚举是全自动模式安全的基础。如果stop条件没有覆盖某种失败模式，全自动流程可能在不安全状态下继续执行。

**要求四：跨环境兼容性是归档机制的隐性需求**

OpenSpec的 `fs.rename` fallback、ECC的数据目录迁移、gstack的AskUserQuestion多层fallback——这些都是跨环境兼容性问题的实际案例。归档机制需要在本地、CI、网络驱动器、Conductor等多种环境下工作。

### 5.2应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **归档前验证测试通过** | merge broken code或创建failing PR是最基本的失败——tests不通过则不呈现选项 | Superpowers（Step 1 hard gate） |
| **Merge后在merged result上再次验证** | merge本身可能引入冲突或破坏——在merged result上运行测试确保安全 | Superpowers（merge后再次验证） |
| **Delta合并使用原子性保证（先验证后写入）** | "即使最后的验证失败也确实不会改变任何目标文件"——部分更新比完全失败更危险 | OpenSpec（prepare → validate → write） |
| **MODIFIED块必须包含当前spec的所有scenarios** | 用户可能遗漏已有scenarios——静默删除是最危险的失败模式 | OpenSpec（`findMissingCurrentScenarios`） |
| **Worktree清理使用provenance-based策略** | 清理其他工具创建的worktree导致phantom state——只清理自己创建的 | Superpowers（`.worktrees/` or `worktrees/`） |
| **WIP commit squash前检测非WIP commit** | `git reset --soft` 在混合分支上破坏性极大——uncommit真实工作 | gstack（anti-footgun rules） |
| **全自动流程显式枚举stop条件和never-stop条件** | 自动化程度越高，stop条件覆盖面必须越广 | gstack（10种stop + 8种never-stop） |
| **重运行的幂等性只适用于action，不适用于verification** | 用户可能误以为idempotent意味着跳过验证——验证必须每次运行 | gstack（"永远不要跳过验证步骤"） |
| **学习闭环使用hooks而非skills做观察** | hooks 100% 触发，skills只有50-80%——观察机制的可靠性是学习闭环的基础 | ECC（v1 → v2从Stop hook到PreToolUse/PostToolUse） |
| **学习数据按项目隔离** | 全局存储导致跨项目污染——React模式不应影响Python项目 | ECC（v2.1 project-scoped instincts） |
| **Review结果需要staleness detection** | 审查时的commit与当前HEAD不同——review结果可能已不适用 | gstack（commit hash比对） |
| **文件操作提供跨平台fallback** | `fs.rename` 在跨设备/Windows上可能失败——需要copy-then-remove回退 | OpenSpec（`moveDirectory`） |
| **Discard操作需要输入确认** | 意外删除工作是不可逆的——要求输入完整单词 "discard" | Superpowers（typed confirmation） |
| **Handoff保存到OS临时目录而非workspace** | 避免污染repo——handoff是短期对话状态传递，不是长期持久化 | mattpocock（`/handoff`） |

### 5.3不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该在删除分支前不移除worktree** | `git branch -d` 会失败——worktree仍引用该分支 | Superpowers的Common Mistakes |
| **不应该在worktree内部执行 `git worktree remove`** | 命令静默失败——CWD在被移除的worktree内 | Superpowers的Common Mistakes |
| **不应该清理harness管理的worktree** | 删除其他工具创建的worktree导致phantom state | Superpowers的Common Mistakes |
| **不应该用 `git reset --soft` 处理混合WIP/非WIP分支** | 会uncommit真实落地工作——push变成non-fast-forward | gstack的anti-footgun rules |
| **不应该让archive验证失败返回exit code 0** | CI和脚本误判成功——下游流水线在不安全状态下继续 | OpenSpec的历史教训 |
| **不应该允许MODIFIED块遗漏已有scenarios** | 静默删除scenarios——用户不知道丢失了什么 | OpenSpec的历史教训 |
| **不应该让重运行跳过验证步骤** | "idempotent" 只适用于action——验证必须每次运行 | gstack的idempotency设计 |
| **不应该把学习数据存在 `~/.claude/` 下** | Claude Code的sensitive-path guard阻止后台写入 | ECC v2.1的迁移教训 |
| **不应该用全局存储保存项目特定的学习模式** | 跨项目污染——React模式影响Python项目 | ECC v2.0 → v2.1的演进 |
| **不应该对discard操作不做确认** | 意外删除工作是不可逆的 | Superpowers的Common Mistakes |
| **不应该在review后修改代码但不重新测试** | stale验证结果——代码与验证不匹配 | gstack Verification Gate的设计 |
| **不应该让全自动流程在没有stop条件覆盖的情况下运行** | 未覆盖的失败模式会导致不安全状态下继续执行 | gstack的stop条件设计 |

### 5.4需要关注什么

在Archive节点的实践中，以下几个方面值得持续关注：

**关注点一：Spec持续演进vs一次性文档**

OpenSpec是唯一实现spec持续演进的项目。其他4个项目的spec都是一次性文档——系统演进后自然过时。对于长期维护的项目，spec过时是必然的——除非有Delta机制持续更新。但对于短期项目或一次性变更，全量spec可能足够。关键问题是：**项目需要多长时间的spec可追溯性？** 如果答案是"6个月以上"，Delta合并值得投入。

**关注点二：学习闭环的实际效果**

ECC的Continuous Learning v2 observer默认关闭——"效果未验证"。gstack的learnings是自动捕获的但在retro中才被系统回顾。关键问题是：**instinct/learning的质量如何衡量？** ECC承认 "Everything is a 5" anti-pattern——agent自评不可靠。如果学习闭环的质量无法衡量，它的实际价值就难以评估。

**关注点三：全自动Archive的安全性边界**

gstack的全自动ship是最高效的——但也需要最完善的stop条件覆盖。gstack列出了10种stop条件，但是否有未被覆盖的失败模式？例如，如果review readiness dashboard显示Eng Review stale但 /ship仍然继续——虽然 /ship会在Step 9运行自己的review，但这意味着之前的review结果被忽略了。关键问题是：**stop条件的覆盖面如何持续评估和扩展？**

**关注点四：Worktree生命周期管理**

Superpowers是唯一系统化处理worktree生命周期的项目。其他项目要么不用worktree（mattpocock）、要么不清理（gstack、ECC）、要么不涉及（OpenSpec）。但如果worktree被广泛使用（如Superpowers的SDD流程），worktree残留和清理顺序错误是真实问题。关键问题是：**worktree管理应该由Archive节点承担还是由独立工具承担？**

**关注点五：跨项目知识共享**

ECC v2.1的 `/promote` 命令允许将project-scoped instinct晋升为全局——当同一instinct在2+ 项目中出现且平均置信度 >= 0.8。gstack的learnings也支持跨session搜索。但跨项目知识共享的风险是污染——如何平衡"通用模式共享"和"项目特定隔离"？ECC的auto-promotion criteria（2+ 项目 + 0.8置信度）是一种探索，但是否足够？

### 5.5怎么观察效果

Archive阶段的效果可以通过以下信号观察：

**正面信号（Archive有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Archive后spec与代码一致 | Delta合并成功——source of truth是准确的 | 定期运行spec验证，检查spec与代码的一致性 |
| 归档的change文件夹包含完整上下文 | 审计链完整——可回溯设计决策 | 检查归档的change文件夹是否包含proposal + design + tasks + specs delta |
| Worktree在archive后被正确清理 | worktree生命周期管理有效 | 检查 `.worktrees/` 目录是否有过期worktree残留 |
| Archive失败时exit code非零 | CI/脚本能正确检测失败 | 在CI中检查archive命令的exit code |
| Commit是bisectable的 | 每个commit代表一个逻辑变更——git bisect有效 | 运行 `git bisect` 验证commit可独立理解 |
| 学习模式被提取和应用 | 学习闭环在运行 | 检查instincts/learnings文件是否有新条目 |
| Review结果不过时 | staleness detection有效 | 检查review log中的commit hash与当前HEAD的差异 |

**负面信号（Archive有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Archive后scenarios消失 | MODIFIED块遗漏了已有scenarios——静默删除 | 对比archive前后的spec，检查scenario数量 |
| Archive验证失败但exit code 0 | CI/脚本误判成功 | 在CI中检查archive命令的exit code |
| Worktree残留 | archive后worktree未被清理 | 检查 `.worktrees/` 目录 |
| 非WIP commit被squash | `git reset --soft` 破坏了已落地工作 | 检查commit history是否有非预期的commit消失 |
| Spec与代码不一致 | Delta合并出错或spec腐化 | 定期运行spec验证 |
| 学习模式为空或全是 "Everything is a 5" | 学习闭环未运行或质量低下 | 检查instincts/learnings文件内容和质量 |
| Review结果过时但未被检测 | staleness detection未运行 | 检查review log中是否有commit hash记录 |
| 全自动ship在不安全状态下继续 | stop条件覆盖不足 | 检查ship log中是否有被跳过的stop条件 |

### 5.6怎么改进

Archive阶段的改进可以从以下几个方向入手：

**改进方向一：建立归档前完整性检查清单**

借鉴OpenSpec的多维度验证和Superpowers的测试先行——在归档前检查：测试是否通过、spec是否完整（scenarios没有丢失）、tasks是否完成、exit code是否正确。不是每个项目都需要所有维度，但至少应该有测试验证和语义完整性检查。

**改进方向二：为worktree管理建立provenance标记**

借鉴Superpowers的provenance-based cleanup——只清理自己创建的worktree。如果项目使用worktree机制，应该有明确的provenance标记（如 `.worktrees/` 目录前缀）和清理顺序约束（merge → remove worktree → delete branch）。

**改进方向三：为全自动流程建立stop条件审计**

借鉴gstack的显式stop条件枚举——如果使用全自动archive流程，应该定期审计stop条件的覆盖面。每次发生"应该在X处stop但没有"的事件后，添加新的stop条件。同时审计"never stop for"条件是否过于宽泛。

**改进方向四：区分action幂等和verification非幂等**

借鉴gstack的idempotency设计——重运行时只有action是幂等的（跳过已执行的），verification必须每次运行。这个区分应该在流程文档中显式声明，避免用户误解。

**改进方向五：为学习闭环建立质量衡量指标**

借鉴ECC的置信度评分和gstack的learnings搜索——如果使用学习闭环，应该有质量衡量指标（如instinct的confidence分布、learnings被搜索引用的频率）。如果质量指标持续低下，可能需要调整观察机制或提取算法。

### 5.7本篇结论

Archive节点的核心使命是**从完成到闭环**——确保变更被正确归档、知识被有效沉淀、系统状态被持续维护。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **归档验证不能只查格式**——OpenSpec的scenario静默删除教训和gstack的stale验证结果教训都表明，语义完整性验证比格式验证更重要
2. **状态变更操作的顺序约束必须显式化**——Superpowers的7种Common Mistakes和gstack的anti-footgun rules都是对操作顺序错误的回应
3. **学习闭环的可靠性取决于观察机制**——ECC从v1（50-80% 触发）到v2（100% 触发）的演进清晰地展示了这一点
4. **自动化程度与安全性的tradeoff**——gstack的全自动ship需要最完善的stop条件覆盖，Superpowers的4选项菜单是最保守的
5. **Spec持续演进是长期项目的核心需求**——OpenSpec是唯一实现spec持续演进的项目，其他项目的spec都会随系统演进而过时

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用Archive节点时参考。

---

---

点击下方"**阅读原文**"进入我的演示网站。
