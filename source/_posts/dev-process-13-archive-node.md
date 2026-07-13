---
title: AI 研发流程深度解析（十三）：Archive 节点——从完成到闭环
description: 对比 5 个项目如何处理变更完成后的归档、合并和闭环，分析 Delta 合并机制、审计链价值和分支管理的关键差异。
tags:
  - 研发流程
  - Archive
  - 闭环
  - Delta
date: '2026-07-13'
categories:
  - AI编程实践
  - 方法论
lang: zh-CN
---

> **日期：** 2026-07-12
> **核心问题：** 5 个项目如何处理变更完成后的归档、合并和闭环？Delta 合并机制、审计链价值和分支管理有什么关键差异？各项目走过哪些弯路？我们能从中学到什么？

---

## 1. 对比分析

### 1.1 Superpowers：Branch 管理 + Worktree 清理

Superpowers 的 Archive 由 `finishing-a-development-branch` skill 承担（`skills/finishing-a-development-branch/SKILL.md`）。核心机制是 **验证测试 → 检测环境 → 呈现选项 → 执行选择 → 清理 worktree**。

**关键设计：**

- **验证测试先行**：在呈现选项前必须验证测试通过——"如果测试失败：在测试通过之前无法进行 merge/PR。"。Stop. 不进入 Step 2。
- **环境检测**：通过 `GIT_DIR` vs `GIT_COMMON` 判断当前是 normal repo、worktree（named branch）还是 detached HEAD。不同环境呈现不同菜单和清理策略。
- **四选项菜单**（normal repo 和 named-branch worktree）：
  1. Merge back to base-branch locally
  2. Push and create a Pull Request
  3. Keep the branch as-is
  4. Discard this work
- **三选项菜单**（detached HEAD）：无 merge 选项——detached HEAD 不能直接 merge
- **Provenance-based cleanup**：只清理 `.worktrees/` 或 `worktrees/` 下的 worktree——"Superpowers 创建了这个 worktree，我们负责清理"。其他 worktree（harness 管理的）不碰——"宿主环境（harness）拥有这个 workspace。不要移除它。"
- **Merge 后再次验证**：merge 完成后在 merged result 上再次运行测试——确保 merge 本身没有引入问题
- **Discard 需要输入确认**：要求用户输入 "discard" 确认——防止意外删除工作
- **不处理 spec 归档**：spec 保留在 `docs/superpowers/specs/` 中，不合并到 source of truth。spec 是一次性文档，不随系统演进。
- **不处理审计链保留**：只有 git log，没有 change 文件夹式的完整上下文保留

**历史踩坑：**

skill 明确列出了 7 种 Common Mistakes 和 7 条 Red Flags——这些是实际运行中观察到的失败模式：

| 问题 | 具体表现 | 修复 |
|------|---------|------|
| 跳过测试验证 | Merge 了 broken code，创建 failing PR | "总是在提供选项前验证测试"——Step 1 是 hard gate，tests 不通过则 Stop |
| 开放式问题 | "What should I do next?" 含义模糊 | "准确呈现 4 个结构化选项（detached HEAD 为 3 个）"——结构化选择而非开放问题 |
| Option 2 清理 worktree | 删除了用户迭代 PR feedback 需要的 worktree | "只在 Option 1 和 4 时清理"——Option 2 (PR) 和 Option 3 (Keep) 总是保留 worktree |
| 删除分支前未移除 worktree | `git branch -d` 失败——worktree 仍引用该分支 | "先 merge，再移除 worktree，然后删除分支"——顺序必须是 merge → remove worktree → delete branch |
| 在 worktree 内部执行 `git worktree remove` | 命令静默失败——CWD 在被移除的 worktree 内 | "在 `git worktree remove` 之前总是先 `cd` 到主仓库根目录" |
| 清理 harness 管理的 worktree | 删除其他工具创建的 worktree 导致 phantom state | "只清理 `.worktrees/` 或 `worktrees/` 下的 worktree"——provenance-based cleanup |
| Discard 无确认 | 意外删除工作 | "要求输入 'discard' 确认"——必须输入完整单词 |

**核心教训：** Superpowers 的 Archive 设计围绕"worktree 生命周期管理"——这是其他 4 个项目都没有覆盖的维度。7 种 Common Mistakes 全部与 worktree 或分支操作的顺序错误有关——说明 worktree 管理是极易出错的操作，需要严格的顺序约束和 provenance 检查。

### 1.2 OpenSpec：Delta 合并 + 审计链 + Source of Truth

OpenSpec 的 Archive 由 `/opsx:archive` 命令承担（`src/core/archive.ts`、`src/core/specs-apply.ts`）。这是五个项目中**最完整的 Archive 机制**——将 delta specs 合并回 source of truth，同时保留完整审计链。

**关键设计：**

- **Delta 合并**：archive 时将 change 文件夹中的 delta specs 合并回 `openspec/specs/` source of truth。合并顺序严格：**RENAMED → REMOVED → MODIFIED → ADDED**（`specs-apply.ts` 第 250 行）。
- **原子性保证**：先在内存中 prepare 所有 updates（`buildUpdatedSpec`），验证全部通过后才写入文件——archive.ts 第 439-440 行注释："在写入任何 spec 之前验证每个重建的 spec，这样即使最后的验证失败也确实不会改变任何目标文件"。具体流程：
  1. `findSpecUpdates`：找到所有需要更新的 spec 文件
  2. `buildUpdatedSpec`：在内存中构建每个 spec 的更新版本（不写入）
  3. 验证所有 rebuilt spec——任何一个失败则全部不写入
  4. `writeUpdatedSpec`：全部验证通过后才写入磁盘
- **跨段冲突检测**：同一 requirement 不能同时出现在 MODIFIED 和 REMOVED、MODIFIED 和 ADDED、ADDED 和 REMOVED 中（`specs-apply.ts` 第 170-177 行）。
- **MODIFIED 的 scenario 保护**：`findMissingCurrentScenarios` 检查 MODIFIED 块是否遗漏了当前 spec 中的 scenario——"当前 spec 包含 modified 块中不存在的 scenario……在归档前刷新 change spec 以避免丢失 scenario。"（`specs-apply.ts` 第 303-307 行）。防止用户在 MODIFIED 时意外删除 scenario。
- **REMOVED 验证**：REMOVED 的 requirement 必须存在于 main spec——不存在则报错。但新 spec 的 REMOVED 会被忽略（带 warning）。
- **ADDED 验证**：ADDED 的 requirement 不能已存在于 main spec。
- **RENAMED 验证**：FROM 必须存在，TO 不能已存在。MODIFIED 必须引用 NEW header 而非 FROM——"当存在 rename 时，MODIFIED 必须引用 NEW header 而非 FROM"。
- **验证矩阵**：
  - 新 spec（target 不存在）：只允许 ADDED；MODIFIED 和 RENAMED 报错；REMOVED 忽略（带 warning）
  - 已有 spec（target 存在）：ADDED 不能已存在；MODIFIED/REMOVED 必须存在；RENAMED FROM 必须存在、TO 不能已存在
- **Change 文件夹归档**：移动到 `changes/archive/YYYY-MM-DD-<name>/`，保留完整上下文（proposal + design + tasks + specs delta）
- **验证前归档**：归档前验证 delta specs 格式和 main spec 结构——验证失败则不归档
- **Task 完成检查**：归档前检查 tasks.md 中的 checkbox——未完成 task 需要确认才能归档
- **`--no-validate` 应急选项**：可跳过验证（不推荐），需要 `--yes` 确认
- **Bulk archive**：支持多个 change 同时归档，检测 spec 冲突
- **跨平台兼容**：`moveDirectory` 在 `fs.rename` 失败时（Windows EPERM/EXDEV）回退到 copy-then-remove

**历史踩坑：**

OpenSpec 的 CHANGELOG 记录了多个 archive 相关的历史问题：

| CHANGELOG 记录 | 问题 | 修复 |
|---------------|------|------|
| "Safer requirement archiving" | Stale `MODIFIED` requirements 会静默删除之前 archive 添加的 scenarios——用户 MODIFIED 一个 requirement 但遗漏了已有 scenarios，archive 后 scenarios 消失 | 引入 `findMissingCurrentScenarios` 检查——MODIFIED 块必须包含当前 spec 中的所有 scenarios，否则报错 "在归档前刷新 change spec 以避免丢失 scenario" |
| "archive exits non-zero when blocked in human mode" | `openspec archive <change> -y` 验证失败时返回 exit code 0——脚本和 CI 误以为 archive 成功 | 三条阻断路径（delta-spec 验证失败、spec rebuild 失败、rebuilt-spec 验证失败）现在设 `process.exitCode = 1`，与 `--json` 模式对齐 |
| "Task progress reads nested/glob tasks.md" | archive 的 incomplete-task gate 无法解析嵌套/glob 模式的 tasks.md——嵌套 task 文件的 change 可能在未完成时被 archive | task progress 现在通过 tracked-tasks artifact 的 `generates` glob 解析，与 `status` 命令使用相同的文件解析逻辑 |
| "Archive operations on cross-device or restricted paths" | `fs.rename` 在网络/外部驱动器上失败（EPERM/EXDEV）——archive 在跨设备路径上不工作 | `moveDirectory` 在 `fs.rename` 失败时回退到 copy-then-remove |
| "Fixed archive workflow stopping mid-way when syncing" | Archive 工作流在 sync 后停在中间——sync 完成后没有正确恢复 | 修复为 sync 完成后正确恢复 archive 流程 |
| "Requirement reading fidelity" | change-delta 路径和 main-spec 路径的 requirement reader 有分歧——解析结果不一致 | 统一为一个 fence-、metadata-、multi-line-aware 的提取器 |

**核心教训：** OpenSpec 的 Delta 合并机制经历了多次迭代才达到当前的安全水平。最关键的历史问题是 **scenario 静默删除**——用户 MODIFIED 一个 requirement 但没有包含已有 scenarios，archive 后 scenarios 就消失了，且没有任何警告。`findMissingCurrentScenarios` 检查是对这个问题的直接回应。第二个关键问题是 **exit code 不一致**——archive 失败返回 0 让 CI 误判成功，这个看似小的问题在实际使用中会导致严重的流水线错误。

### 1.3 ECC：Conventional Commits + Continuous Learning 闭环

ECC 的 Archive 是 `orch-*` pipeline Phase 6——conventional commits + GATE 2 + 学习提取（`skills/orch-pipeline/SKILL.md`、`skills/continuous-learning-v2/SKILL.md`）。

**关键设计：**

- **Conventional commits**：feat/fix/refactor，一个逻辑块一个提交
- **GATE 2**：在 Commit 前要求用户确认——"有 gate 而非自动执行"。用户确认 diff summary 和提交信息后才提交。GATE 1 在 Plan 之后——"在用户批准之前不要写实现代码"
- **无 spec 归档**：没有 delta 合并、没有 source of truth 更新。Acceptance Brief 是一次性工作产物，不随变更演进
- **`/checkpoint` command**：保存验证状态，支持跨 session 恢复
- **Continuous Learning v2 的 hooks**：自动提取会话模式为 **instincts**——这是"学习闭环"而非"spec 闭环"。复杂任务（>=3 edits）必须 touch 学习库否则 delivery-gate 阻断。
  - Instinct → skill 演化：高置信度的 instinct 可以升级为 skill（`/evolve` 命令）
  - 这是行为学习——agent 从经验中学习"什么有效"，而非 spec 从变更中演进
- **默认关闭**：Continuous Learning v2 的 observer 默认关闭（`config.json` 中 `observer.enabled: false`）——效果未验证

**历史踩坑：**

| 版本 | 问题 | 修复 |
|------|------|------|
| v1 | Skills 概率性触发（50-80%）——session 末尾的 Stop hook 可能不触发，学习模式丢失 | v2 改用 PreToolUse/PostToolUse hooks——"hooks 100% 触发，是确定性的"；v1 文档明确标注："v1 依赖 skills 来观察。skills 是概率性的——它们大约 50-80% 的时间会触发" |
| v2.0 | 全局存储（`~/.claude/homunculus/`）——React 项目的 instinct 会污染 Python 项目 | v2.1 引入 project-scoped instincts——"React 模式留在你的 React 项目中，Python 约定留在你的 Python 项目中"；通过 git remote URL/repo path 自动检测项目 |
| v2.0 | 无项目晋升机制——通用模式（如 "always validate input"）只能留在单个项目中 | v2.1 引入 `/promote` 命令——当同一 instinct 在 2+ 项目中出现且平均置信度 >= 0.8，可晋升为全局 |
| v2.1 | 数据存储在 `~/.claude/homunculus/` 下——Claude Code 的 sensitive-path guard 阻止后台 instinct 写入 | v2.1 将数据迁移到 `${XDG_DATA_HOME:-~/.local/share}/ecc-homunculus/`——避开 Claude Code 保护路径 |
| 持续存在 | Observer 默认关闭——学习闭环不自动运行 | 未修复——config.json 中 `observer.enabled: false`，效果未验证 |
| 持续存在 | 无结构化的 spec 模型——AC 是一次性工作产物，不持续演进 | 未修复——ECC 的设计取向是"提供素材不定义流程"，spec 持续演进是 OpenSpec 的关注点 |

**核心教训：** ECC 的学习闭环经历了从 v1（Stop hook，50-80% 触发）到 v2.0（PreToolUse/PostToolUse hooks，100% 触发）再到 v2.1（project-scoped）的演进。核心教训是：**hook 100% 触发是学习闭环的可靠性基础**——如果观察机制本身不可靠，提取的学习模式就不完整。但 ECC 也承认 observer 默认关闭——"提供能力不保证效果"，学习闭环的实际价值仍待验证。

### 1.4 mattpocock-skills：极简 Commit + Handoff 传递

mattpocock 的 Archive 是最轻量的——git commit + 可选 handoff（`skills/engineering/implement/SKILL.md`、`skills/productivity/handoff/SKILL.md`）。

**关键设计：**

- **直接 commit 到当前分支**："将你的工作提交到当前分支。"——implement 完成后直接提交，没有 merge/PR/discard 选项菜单
- **不处理分支管理**：merge/PR 由用户决定，skill 不介入
- **不清理 worktree**：没有 worktree 管理机制
- **不处理 spec 合并**：无 source of truth、无 delta 合并
- **`/handoff`——独特的 context 传递机制**：
  - 将当前对话压缩为 handoff 文档供下一个 agent 继续
  - 保存到 **OS 临时目录**而非 workspace——"保存到用户 OS 的临时目录——而不是当前 workspace"——避免污染 repo
  - 包含 "suggested skills" 部分建议下一个 agent 应调用的 skill
  - **不复制其他 artifact**（specs/plans/ADRs/issues/commits/diffs）——通过路径或 URL 引用
  - Redact 敏感信息（API keys、passwords、PII）
  - `disable-model-invocation: true`——用户手动触发，不自动调用
- **handoff 传递的是"对话状态"而非"系统状态"**——它不记录系统当前行为，只记录"我们做到哪了"

**历史踩坑：**

mattpocock 的 skill 文件极为简洁——implement SKILL.md 仅 16 行，handoff SKILL.md 仅 17 行。没有版本历史或明确的 pitfall 文档。以下是基于设计取向分析的潜在问题：

| 问题 | 具体表现 | 设计取向 |
|------|---------|---------|
| Handoff 保存到 OS 临时目录 | 系统重启或清理临时目录后 handoff 文档丢失 | 有意为之——避免污染 repo；handoff 是短期对话状态传递，不是长期持久化 |
| Handoff 不复制 artifact | 如果 artifact 被移动或删除，handoff 中的路径/URL 引用失效 | 有意为之——"不要复制已存在于其他 artifact 中的内容。通过路径或 URL 引用它们。"——避免冗余和不一致 |
| 无分支管理 | 用户需要自己处理 merge/PR/discard——skill 不提供指导 | 反映 mattpocock "不拥有流程"的设计取向——git 工作流由用户和 git 工具管理 |
| 无 spec 持续演进 | PRD 发布到 issue tracker 后不随系统演进——spec 会过时 | 反映 mattpocock 的轻量取向——spec 是"为当前变更服务的一次性文档" |
| 无 worktree 清理 | worktree 残留需要用户手动清理 | mattpocock 不使用 worktree 机制——implement 直接在当前分支工作 |

**核心教训：** mattpocock 的 Archive 是"极简主义"的体现——只做 commit 和可选的 handoff。Handoff 保存到 OS 临时目录而非 workspace 是一个有意的设计——避免污染 repo，但代价是持久性不保证。不复制 artifact 的设计避免了冗余，但引入了引用失效的风险。这些 tradeoff 反映了 mattpocock 的核心立场：**skill 不拥有流程**——用户负责 git 工作流、spec 演进和 worktree 管理。

### 1.5 gstack：21 步 Ship 流程 + 知识归档

gstack 的 Archive 是最重的——21 步 ship 流程 + retro + learn + document-release（`ship/SKILL.md`、`retro/SKILL.md`、`learn/SKILL.md`、`document-release/SKILL.md`）。

**关键设计：**

- **`/ship`——非交互式全自动**："这是一个非交互式、完全自动化的工作流。不要在任何步骤请求确认。用户说了 /ship 就意味着执行。"
- **21 步 ship 流程**：
  1. Pre-flight（检查 branch、diff、review readiness）
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
- **Review Readiness Dashboard**：ship 前显示所有审查状态——Eng Review 是 required（可全局禁用），其他 informational。Staleness detection 比较审查时 commit 与当前 HEAD——"Note: {skill} review from {date} may be stale — {N} commits since review"
- **WIP commit 过滤**（Step 15.0）：`/ship` 过滤压缩 WIP commit——保留非 WIP commit，保持 bisect 干净。**Anti-footgun rules**："永远不要在有非 WIP commit 时盲目 `git reset --soft`。Codex 将此标记为破坏性操作——它会 uncommit 真实已落地工作，并将 push 步骤变成对已经 push 过的人来说的 non-fast-forward push。"
- **Bisectable commits**（Step 15.1）：每个 commit 代表一个逻辑变更——"每个 commit 应该代表一个连贯的变更——不是一个文件，而是一个逻辑单元"。Commit 顺序：Infrastructure → Models & services → Controllers & views → VERSION + CHANGELOG + TODOS.md
- **Verification Gate**（Step 16）：Iron Law——"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"。如果 Steps 4-6 后代码有变更，必须重新运行测试。"声称工作完成但没有验证是不诚实，不是效率。"
- **Credential pre-push guard**（Step 17）：可选的 pre-push hook 阻止包含凭证的 push——API keys、tokens、private keys
- **Idempotency**：重新运行 `/ship` 意味着"重新运行整个检查列表"——每个验证步骤都重新运行，只有 action 是幂等的（VERSION 已 bump 则跳过、已 push 则跳过、PR 已存在则更新 body）
- **Stop 条件**：在 base branch、无法自动解决的 merge conflicts、in-branch test failures、Pre-landing review ASK items、MINOR/MAJOR version bump、coverage below threshold、plan items NOT DONE、plan verification failures、TODOS.md missing/disorganized
- **`/retro`**：团队回顾——analyzes commit history, work patterns, and code quality metrics with persistent history and trend tracking。Team-aware: per-person breakdowns
- **`/learn`**：记忆管理——review, search, prune, and export what gstack has learned across sessions。"learnings compound across sessions"
- **`/document-release`**：自动文档同步——对照 diff 更新漂移文档
- **decisions.jsonl**：append-only event-sourced 决策存储，`--supersede` 允许反转但要求显式声明
- **无 spec 归档**：没有 delta 合并、没有 source of truth 更新——与 OpenSpec 的持续 spec 演进形成对比

**历史踩坑：**

| 问题 | 具体表现 | 修复 |
|------|---------|------|
| WIP commit squash 破坏非 WIP commit | `git reset --soft <merge-base>` 会 uncommit 所有 commit 包括非 WIP 的已落地工作——push 变成 non-fast-forward | Anti-footgun rules："永远不要在有非 WIP commit 时盲目 `git reset --soft`。Codex 将此标记为破坏性操作"——先检测非 WIP commit 数量，只有全 WIP 时才 reset-soft |
| 在 worktree 内部执行 `git worktree remove` 静默失败 | 与 Superpowers 相同的问题 | 不适用——gstack 不使用 worktree 机制 |
| Review 结果过时——之前的 review 与当前 HEAD 不同 | 审查时的 commit 与当前 HEAD 不同，review 结果可能已不适用 | Staleness detection——比较审查时 commit 与当前 HEAD，显示 "注意：{skill} 审查（来自 {date}）可能已过时——审查以来已有 {N} 个 commit" |
| Push 包含凭证 | API keys、tokens、private keys 被推送到远程 | Credential pre-push guard（Step 17）——可选的 pre-push hook 阻止包含凭证的 push |
| 代码在 review 后被修改但未重新测试 | Steps 4-6 的测试结果不再适用于修改后的代码 | Verification Gate（Step 16）——"如果 Step 5 的测试运行后有任何代码变更，重新运行测试套件。粘贴新的输出。Step 5 的旧输出是不可接受的。" |
| 重运行 /ship 跳过已完成的验证步骤 | 用户以为重运行是安全的，但验证步骤被跳过导致问题未被发现 | "重新运行 `/ship` 意味着重新运行整个检查列表。每个验证步骤在每次调用时都运行。永远不要因为之前的 `/ship` 运行已经执行过某个验证步骤就跳过它。" |
| TODOS.md 不存在或混乱 | 新项目没有 TODOS.md，或格式不规范 | Step 14 提供创建/重组选项——"Would you like to create one?" / "Would you like to reorganize it?" |
| 非交互式流程中 AskUserQuestion 不可靠 | Conductor 环境中 AskUserQuestion 失败 | 多层 fallback：Conductor → prose fallback；headless → BLOCKED；interactive → prose with triad（ELI10 + Completeness + Recommendation） |

**核心教训：** gstack 的 21 步 ship 流程是对"Archive 应该做什么"最全面的回答——从 pre-flight 到 PR 创建再到 metrics 持久化，覆盖了其他所有项目的所有维度。但最核心的教训来自 WIP commit squash 的 anti-footgun rules——**自动化操作中最危险的是"看起来安全但实际破坏性"的操作**。`git reset --soft` 在全 WIP 分支上是安全的，但在混合分支上会 uncommit 真实工作。gstack 的解法是先检测再决定策略——"如果不确定，宁可停下来通过 AskUserQuestion 询问用户，也不要销毁非 WIP commit。"

---

## 2. 关键差异

### 2.1 Spec 归档机制对比

| 项目 | Spec 合并 | Source of Truth | 审计链 | Spec 演进 |
|------|----------|----------------|--------|----------|
| **Superpowers** | ❌ 无 | ❌ 无 | 只有 git log | ❌ 无（一次性文档） |
| **OpenSpec** | ✅ Delta 合并（RENAMED→REMOVED→MODIFIED→ADDED） | ✅ `openspec/specs/` 持续演进 | ✅ change 文件夹完整保留 | ✅ 每次 archive 更新 spec |
| **ECC** | ❌ 无 | ❌ 无 | 只有 git log | ❌ 无（Acceptance Brief 一次性） |
| **mattpocock** | ❌ 无 | ❌ 无 | 只有 git log | ❌ 无（PRD 一次性） |
| **gstack** | ❌ 无 | ❌ 无 | decisions.jsonl + learnings.jsonl | ❌ 无（spec 一次性） |

**关键观察：** 只有 OpenSpec 实现了 spec 的持续演进。其他 4 个项目的 spec/设计文档都是"为当前变更服务的一次性文档"——描述"要做什么"而非"系统当前行为是什么"。这意味着除 OpenSpec 外，所有项目的 spec 都会随系统演进而过时。

### 2.2 分支管理对比

| 项目 | 分支管理 | Worktree 清理 | 用户确认 |
|------|---------|-------------|---------|
| **Superpowers** | 4 选项菜单（merge/PR/keep/discard） | ✅ Provenance-based（只清理自己的） | Discard 需要输入确认 |
| **OpenSpec** | ❌ 不涉及（"OpenSpec doesn't touch git"） | ❌ 不涉及 | ❌ 不涉及 |
| **ECC** | GATE 2 用户确认 | ❌ 无 | ✅ GATE 2 确认 diff summary |
| **mattpocock** | ❌ 不涉及（直接 commit） | ❌ 无 | ❌ 无 |
| **gstack** | 全自动（push + PR/MR） | ❌ 无 | ⚠️ 非交互式（除非遇到 stop 条件） |

**关键观察：** Superpowers 是唯一系统化处理分支管理和 worktree 清理的项目。OpenSpec 有意不碰 git——只读写 Markdown 文件。gstack 的 ship 流程是全自动的——"用户说了 /ship 就意味着执行"。

### 2.3 知识归档对比

| 项目 | 知识归档 | 归档内容 | 自动/手动 |
|------|---------|---------|----------|
| **Superpowers** | ❌ 无 | — | — |
| **OpenSpec** | ✅ change 文件夹归档 | proposal + design + tasks + specs delta | 自动（archive 命令） |
| **ECC** | ✅ Continuous Learning v2 | instincts（会话模式提取） | 自动（PreToolUse/PostToolUse hooks） |
| **mattpocock** | ✅ handoff | 对话压缩 + suggested skills | 手动（`/handoff`） |
| **gstack** | ✅ learnings + decisions + retro | learnings.jsonl + decisions.jsonl + retro 报告 | 自动 + 手动 |

**关键观察：** 知识归档有三种不同方向——OpenSpec 归档的是 **spec 上下文**（为什么做这个变更），ECC 归档的是 **行为模式**（agent 从经验中学到什么），gstack 归档的是 **决策和学习**（做过什么决策 + 发现了什么模式）。mattpocock 的 handoff 是独特的——它归档的是 **对话状态**（做到哪了 + 下一步做什么），不是系统状态。

### 2.4 自动化程度对比

| 项目 | 自动化程度 | 人工确认点 |
|------|----------|-----------|
| **Superpowers** | 半自动 | 4 选项选择 + discard 确认 |
| **OpenSpec** | 半自动 | spec 更新确认 + 未完成 task 确认 |
| **ECC** | 半自动 | GATE 2（Commit 前确认） |
| **mattpocock** | 手动 | commit + 可选 handoff |
| **gstack** | 全自动 | 非交互式（除非 stop 条件触发） |

**关键观察：** gstack 是唯一全自动的——"不要在任何步骤请求确认"。其他项目都有人工确认点。Superpowers 的 4 选项菜单是最结构化的用户选择。OpenSpec 的确认是渐进的——spec 更新确认 + 未完成 task 确认。

---

## 3. 历史踩坑汇总与经验教训

### 3.1 踩坑类型分类

将五个项目在 Archive 节点的历史踩坑按类型归纳，可以发现一些反复出现的模式：

**类型一：Worktree / 分支操作顺序错误**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| Superpowers | 删除分支前未移除 worktree——`git branch -d` 失败 | worktree 仍引用该分支 | "先 merge，再移除 worktree，然后删除分支"——顺序约束 |
| Superpowers | 在 worktree 内部执行 `git worktree remove`——命令静默失败 | CWD 在被移除的 worktree 内 | "在 `git worktree remove` 之前总是先 `cd` 到主仓库根目录" |
| Superpowers | Option 2 (PR) 清理了 worktree——用户失去 PR 迭代的工作区 | 不区分选项一律清理 | "只在 Option 1 和 4 时清理"——Option 2 和 3 总是保留 |
| gstack | WIP commit squash 用 `git reset --soft` 破坏非 WIP commit | 不区分 WIP 和非 WIP 一律 reset | Anti-footgun rules：先检测非 WIP commit 数量，只有全 WIP 时才 reset-soft |

**类型二：归档验证不充分或被绕过**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| OpenSpec | Stale MODIFIED 静默删除 scenarios——用户遗漏已有 scenarios | 没有 scenario 保护检查 | `findMissingCurrentScenarios`——MODIFIED 块必须包含当前 spec 的所有 scenarios |
| OpenSpec | Archive 验证失败返回 exit code 0——CI 误判成功 | human mode 没有设置 exit code | 三条阻断路径设 `process.exitCode = 1`，与 `--json` 对齐 |
| OpenSpec | 嵌套 tasks.md 的 incomplete-task gate 无法解析——未完成 task 被 archive | task progress 解析不支持 glob | 通过 tracked-tasks artifact 的 `generates` glob 解析 |
| gstack | 代码在 review 后被修改但未重新测试——stale 验证结果 | 没有强制重新验证 | Verification Gate（Step 16）——"如果 Step 5 的测试运行后有任何代码变更，重新运行" |
| gstack | 重运行 /ship 跳过已完成的验证步骤 | 用户以为 idempotent 意味着跳过验证 | "永远不要因为之前的 `/ship` 运行已经执行过某个验证步骤就跳过它" |

**类型三：跨环境/跨平台兼容性**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| OpenSpec | `fs.rename` 在网络/外部驱动器上失败（EPERM/EXDEV） | Node.js rename 在跨设备时不工作 | `moveDirectory` 回退到 copy-then-remove |
| ECC v2.1 | 数据存储在 `~/.claude/homunculus/`——Claude Code sensitive-path guard 阻止写入 | Claude Code 保护 `~/.claude/` 路径 | 迁移到 `${XDG_DATA_HOME:-~/.local/share}/ecc-homunculus/` |
| gstack | Conductor 环境中 AskUserQuestion 不可靠——native 被禁用，MCP variant flaky | 环境差异导致交互工具不可用 | 多层 fallback：Conductor → prose；headless → BLOCKED；interactive → prose with triad |

**类型四：学习闭环可靠性**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| ECC v1 | Stop hook 50-80% 触发——学习模式可能丢失 | skill 约束依赖 agent 遵守 | v2 改用 PreToolUse/PostToolUse hooks——100% 触发 |
| ECC v2.0 | 全局存储导致跨项目污染——React 模式影响 Python 项目 | 无项目隔离 | v2.1 引入 project-scoped instincts——通过 git remote URL 自动检测项目 |
| ECC v2.1 | Observer 默认关闭——学习闭环不自动运行 | 效果未验证，保守默认 | 未修复——config.json 中 `observer.enabled: false` |
| gstack | Review 结果过时——审查时 commit 与当前 HEAD 不同 | 没有 staleness 检测 | Staleness detection——比较 commit hash，显示 "可能已过时——审查以来已有 {N} 个 commit" |

**类型五：自动化操作的破坏性风险**

| 项目 | 具体表现 | 根因 | 修复 |
|------|---------|------|------|
| gstack | `git reset --soft` 破坏非 WIP commit——已落地工作被 uncommit | 不区分 WIP 和非 WIP 一律 reset | Anti-footgun rules + 先检测再决定策略 |
| Superpowers | 清理 harness 管理的 worktree 导致 phantom state | 不区分自己创建的和 harness 创建的 | Provenance-based cleanup——只清理 `.worktrees/` 或 `worktrees/` |
| Superpowers | Discard 意外删除工作 | 无确认 | "要求输入 'discard' 确认" |
| gstack | Push 包含凭证 | 无凭证检测 | Credential pre-push guard——可选的 pre-push hook |
| gstack | 重运行 /ship 的幂等性误解——用户以为验证被跳过是安全的 | idempotent 的定义不清晰 | 明确区分：actions 幂等（跳过已执行的），verifications 不幂等（每次都运行） |

### 3.2 经验教训总结

从五个项目的踩坑历史中，可以提炼出以下经验教训：

**教训一：Worktree / 分支操作的顺序约束必须显式化**

Superpowers 的 7 种 Common Mistakes 中有 5 种与操作顺序有关——merge → remove worktree → delete branch、cd to main root before worktree remove、Option 2/3 保留 worktree。这些顺序约束不是显而易见的——`git branch -d` 在 worktree 存在时会失败，`git worktree remove` 在 CWD 内部会静默失败。gstack 的 WIP commit squash 同样——`git reset --soft` 看似安全但在混合分支上破坏性极大。关键洞察是：**涉及 git 状态变更的操作必须有显式的顺序检查和前置条件验证**。

**教训二：归档验证的"静默失败"是最危险的失败模式**

OpenSpec 的 scenario 静默删除是最典型的例子——用户 MODIFIED 一个 requirement 但遗漏了已有 scenarios，archive 后 scenarios 消失，没有任何警告。exit code 0 返回是另一个静默失败——CI 误判成功。gstack 的 stale 验证结果也类似——代码在 review 后被修改但未重新测试。关键洞察是：**归档操作必须验证所有可能被破坏的内容**——不只是格式验证，还要验证语义完整性（scenarios 没有丢失）、状态一致性（代码与验证结果匹配）、退出码正确性（失败时非零退出）。

**教训三：学习闭环的可靠性取决于观察机制**

ECC 从 v1（Stop hook，50-80%）到 v2（PreToolUse/PostToolUse hooks，100%）的演进清晰地展示了这一点——如果观察机制本身不可靠，提取的学习模式就不完整。但 v2.1 的 observer 默认关闭说明另一个问题——**100% 触发的 hook 也可能因为效果未验证而不敢默认开启**。gstack 的 staleness detection 是另一种可靠性保障——不只关注"是否运行了"，还关注"结果是否仍然有效"。

**教训四：跨环境兼容性是归档机制的隐性成本**

OpenSpec 的 `fs.rename` 在跨设备路径上失败、ECC 的数据目录被 Claude Code 保护路径阻止、gstack 的 AskUserQuestion 在 Conductor 中不可靠——这些都是跨环境兼容性问题。归档机制需要在多种环境下工作（本地、CI、网络驱动器、Conductor），每种环境都有不同的约束。关键洞察是：**归档机制的设计需要考虑环境差异**——文件操作需要 fallback、路径选择需要避开保护区域、交互工具需要多层 fallback。

**教训五：自动化程度与安全性的 tradeoff**

gstack 的全自动 ship 流程（"不要在任何步骤请求确认"）是最高效的，但也需要最完善的 stop 条件覆盖。Superpowers 的 4 选项菜单是最保守的——用户在每个关键决策点都参与。OpenSpec 的渐进确认（spec 更新确认 + 未完成 task 确认）是中间路线。关键洞察是：**自动化程度越高，stop 条件的覆盖面必须越广**——gstack 列出了 10 种 stop 条件和 8 种"never stop for"条件，这种显式枚举是全自动模式安全的基础。

---

## 4. 实践方向讨论

### 4.1 Delta 合并机制：是否需要 Source of Truth？

**OpenSpec 的立场**：Delta 合并是核心闭环——spec 随变更有机增长。合并顺序 RENAMED→REMOVED→MODIFIED→ADDED 是程序化执行的。原子性保证（先验证后写入）防止部分更新。审计链保留每个变更的"为什么"。

**其他项目的立场**：不需要 source of truth。spec/设计文档是一次性文档，描述"要做什么"而非"系统当前行为"。系统演进后 spec 自然过时——但这没关系，因为下一次变更会写新的 spec。

**tradeoff 分析：**

- **Delta 合并的优势**：
  - spec 始终描述系统当前行为——回答"系统现在到底怎么工作"
  - 6 个月后 spec 告诉你设计决策的来龙去脉
  - 新 session 的 AI agent 可以读 spec 理解系统
  - Brownfield 变更可以基于现有 spec 做 delta——不需要重新理解全部
- **Delta 合并的代价**：
  - 需要结构化 spec 格式（Requirement + Scenario）才能程序化合并
  - 需要 validator 保障格式正确
  - 合并可能出错——OpenSpec 的历史表明 scenario 静默删除、exit code 不一致都曾发生
  - Spec 腐化风险——spec 与代码不一致时需要额外维护
- **无 source of truth 的优势**：简单——不需要维护 spec 持续演进
- **无 source of truth 的代价**：spec 过时——系统演进后 spec 不再描述当前行为

**可能的好的实践方向**：Delta 合并的价值在长期维护的项目中最大——spec 作为"系统当前行为的持续记录"比"为当前变更服务的一次性文档"有更高的长期价值。但 Delta 合并的采用成本较高——需要结构化 spec 格式 + validator + 合并工具 + scenario 保护。OpenSpec 的原子性保证（先验证后写入）和 scenario 保护（MODIFIED 时检查遗漏的 scenario）是降低 Delta 合并风险的关键设计——且这些设计都是对真实历史问题的回应。

### 4.2 审计链价值：保留什么上下文？

**OpenSpec 的立场**：保留 change 文件夹的完整上下文——proposal（为什么做）+ design（怎么做）+ tasks（做了什么）+ specs delta（改了什么行为）。归档后仍可回溯。

**gstack 的立场**：decisions.jsonl 是 append-only event-sourced 决策存储——每个决策都有时间戳和上下文。`/retro` 提供 per-person breakdowns + shipping streaks + test health trends。`/learn` 让 learnings compound across sessions。

**ECC 的立场**：instincts 是行为学习——agent 从经验中提取"什么有效"的模式。高置信度的 instinct 可以升级为 skill。

**tradeoff 分析：**

- **OpenSpec 的 spec 上下文**：回答"为什么做这个变更"——可回溯设计决策的来龙去脉
- **gstack 的 decisions + learnings**：回答"做过什么决策 + 发现了什么模式"——agent 变聪明
- **ECC 的 instincts**：回答"什么有效"——行为学习而非系统状态
- **mattpocock 的 handoff**：回答"做到哪了 + 下一步做什么"——对话状态传递

**可能的好的实践方向**：审计链的价值取决于使用场景——如果需要回溯"为什么系统是这样设计的"（如 6 个月后的维护），OpenSpec 的 spec 上下文最有价值。如果需要 agent 从经验中学习（如避免重复错误），gstack 的 learnings 最有价值。两者可能是互补的——spec 上下文记录"系统状态"，learnings 记录"行为模式"。OpenSpec 的 change 文件夹是自动生成的（archive 命令），gstack 的 learnings 是 `/learn` 管理的——两者的自动化程度都足够高。

### 4.3 分支管理与归档统一

**Superpowers 的立场**：分支管理是 Archive 的核心——4 选项菜单 + worktree 清理 + provenance-based cleanup。

**OpenSpec 的立场**：不碰 git——"OpenSpec doesn't touch git"。Archive 只管 spec 合并和 change 文件夹归档，分支管理由用户/其他工具处理。

**gstack 的立场**：全自动——/ship 处理 push + PR/MR 创建，但不是"菜单式选择"而是"直接执行"。

**tradeoff 分析：**

- **统一管理的优势**：用户在一个地方完成所有收尾工作——merge/PR + spec 归档 + worktree 清理
- **统一管理的代价**：耦合——如果 spec 合并失败，分支管理也受阻
- **分离的优势**：解耦——OpenSpec 管 spec 治理，git 工作流由用户/其他工具管理。`superpowers-bridge` 社区 schema 正是这个思路——"将 OpenSpec 的 artifact 治理与 Superpowers 的执行技能集成"
- **分离的代价**：用户需要在多个工具间切换

**可能的好的实践方向**：Superpowers 的 4 选项菜单是最用户友好的——结构化选择而非全自动执行。OpenSpec 的"不碰 git"是最解耦的——允许用户使用任何 git 工作流。两者的结合可能是最优——spec 归档和分支管理分离，但在同一个流程中执行。gstack 的全自动模式适合有经验的用户——"用户说了 /ship 就意味着执行"。

### 4.4 知识闭环：Spec 演进 vs 行为学习

**OpenSpec 的立场**：spec 闭环——每次 archive 将 delta 合并回 source of truth，spec 随变更有机增长。

**ECC 的立场**：行为学习闭环——Continuous Learning v2 自动提取会话模式为 instincts，高置信度的 instinct 升级为 skill。

**gstack 的立场**：双重闭环——decisions.jsonl 保留决策审计链，learnings.jsonl 让 agent 变聪明。`/retro` 提供团队回顾。

**tradeoff 分析：**

- **Spec 闭环的优势**：系统状态可追溯——回答"系统当前行为是什么"和"为什么是这样设计的"
- **Spec 闭环的代价**：需要结构化 spec + Delta 合并 + validator——工具链成本高；合并可能出错（OpenSpec 的历史证明了这一点）
- **行为学习闭环的优势**：agent 从经验中学习——避免重复错误，提升效率
- **行为学习闭环的代价**：instinct 的质量难以保证；observer 默认关闭且效果未验证
- **双重闭环的优势**：既追溯系统状态又学习行为模式
- **双重闭环的代价**：维护两套系统——spec 和 learnings

**可能的好的实践方向**：Spec 闭环和行为学习闭环是正交的——前者关注"系统状态"，后者关注"行为模式"。长期维护的项目可能需要两者——spec 闭环确保系统行为可追溯，行为学习确保 agent 持续改进。但两者的优先级不同——spec 闭环对长期维护的项目是必须的（否则 spec 过时），行为学习是锦上添花（agent 本身有基础能力）。OpenSpec 的"自动 archive"比 ECC 的"hook 提取 instinct"更可靠——因为 spec 合并是确定性操作，而 instinct 提取依赖 AI 推理。

---

## 5. 总结：Archive 节点的实践参考

> **声明：** 以下总结基于五个项目的实践经验和踩坑教训，试图提炼出一些有参考价值的结论。但这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中寻找一些相对普遍的规律，供读者参考和批判。

### 5.1 总体要求

经过对五个项目的全面分析，我们认为 Archive 节点需要满足以下总体要求：

**要求一：归档前必须验证完整性**

OpenSpec 的 scenario 静默删除教训和 gstack 的 stale 验证结果教训都指向同一个方向——归档前的验证不能只查格式，还要查语义完整性。Superpowers 的"验证测试先行"是最基本的要求——如果测试不通过，不呈现任何选项。

**要求二：涉及状态变更的操作必须有显式顺序约束**

Superpowers 的 7 种 Common Mistakes 和 gstack 的 anti-footgun rules 都表明——git 状态变更操作（merge、branch delete、worktree remove、reset）极易因顺序错误而失败。这些顺序约束必须显式化，不能依赖用户或 agent 的常识。

**要求三：自动化程度越高，stop 条件覆盖面必须越广**

gstack 全自动 ship 列出了 10 种 stop 条件和 8 种"never stop for"条件——这种显式枚举是全自动模式安全的基础。如果 stop 条件没有覆盖某种失败模式，全自动流程可能在不安全状态下继续执行。

**要求四：跨环境兼容性是归档机制的隐性需求**

OpenSpec 的 `fs.rename` fallback、ECC 的数据目录迁移、gstack 的 AskUserQuestion 多层 fallback——这些都是跨环境兼容性问题的实际案例。归档机制需要在本地、CI、网络驱动器、Conductor 等多种环境下工作。

### 5.2 应该做什么

基于五个项目的成功经验和弯路教训，以下做法值得参考：

| 应该做 | 理由 | 参考项目 |
|--------|------|---------|
| **归档前验证测试通过** | merge broken code 或创建 failing PR 是最基本的失败——tests 不通过则不呈现选项 | Superpowers（Step 1 hard gate） |
| **Merge 后在 merged result 上再次验证** | merge 本身可能引入冲突或破坏——在 merged result 上运行测试确保安全 | Superpowers（merge 后再次验证） |
| **Delta 合并使用原子性保证（先验证后写入）** | "即使最后的验证失败也确实不会改变任何目标文件"——部分更新比完全失败更危险 | OpenSpec（prepare → validate → write） |
| **MODIFIED 块必须包含当前 spec 的所有 scenarios** | 用户可能遗漏已有 scenarios——静默删除是最危险的失败模式 | OpenSpec（`findMissingCurrentScenarios`） |
| **Worktree 清理使用 provenance-based 策略** | 清理其他工具创建的 worktree 导致 phantom state——只清理自己创建的 | Superpowers（`.worktrees/` or `worktrees/`） |
| **WIP commit squash 前检测非 WIP commit** | `git reset --soft` 在混合分支上破坏性极大——uncommit 真实工作 | gstack（anti-footgun rules） |
| **全自动流程显式枚举 stop 条件和 never-stop 条件** | 自动化程度越高，stop 条件覆盖面必须越广 | gstack（10 种 stop + 8 种 never-stop） |
| **重运行的幂等性只适用于 action，不适用于 verification** | 用户可能误以为 idempotent 意味着跳过验证——验证必须每次运行 | gstack（"永远不要跳过验证步骤"） |
| **学习闭环使用 hooks 而非 skills 做观察** | hooks 100% 触发，skills 只有 50-80%——观察机制的可靠性是学习闭环的基础 | ECC（v1 → v2 从 Stop hook 到 PreToolUse/PostToolUse） |
| **学习数据按项目隔离** | 全局存储导致跨项目污染——React 模式不应影响 Python 项目 | ECC（v2.1 project-scoped instincts） |
| **Review 结果需要 staleness detection** | 审查时的 commit 与当前 HEAD 不同——review 结果可能已不适用 | gstack（commit hash 比对） |
| **文件操作提供跨平台 fallback** | `fs.rename` 在跨设备/Windows 上可能失败——需要 copy-then-remove 回退 | OpenSpec（`moveDirectory`） |
| **Discard 操作需要输入确认** | 意外删除工作是不可逆的——要求输入完整单词 "discard" | Superpowers（typed confirmation） |
| **Handoff 保存到 OS 临时目录而非 workspace** | 避免污染 repo——handoff 是短期对话状态传递，不是长期持久化 | mattpocock（`/handoff`） |

### 5.3 不应该做什么

同样，从各项目的弯路教训中，以下做法应该避免：

| 不应该做 | 理由 | 踩坑项目 |
|---------|------|---------|
| **不应该在删除分支前不移除 worktree** | `git branch -d` 会失败——worktree 仍引用该分支 | Superpowers 的 Common Mistakes |
| **不应该在 worktree 内部执行 `git worktree remove`** | 命令静默失败——CWD 在被移除的 worktree 内 | Superpowers 的 Common Mistakes |
| **不应该清理 harness 管理的 worktree** | 删除其他工具创建的 worktree 导致 phantom state | Superpowers 的 Common Mistakes |
| **不应该用 `git reset --soft` 处理混合 WIP/非 WIP 分支** | 会 uncommit 真实落地工作——push 变成 non-fast-forward | gstack 的 anti-footgun rules |
| **不应该让 archive 验证失败返回 exit code 0** | CI 和脚本误判成功——下游流水线在不安全状态下继续 | OpenSpec 的历史教训 |
| **不应该允许 MODIFIED 块遗漏已有 scenarios** | 静默删除 scenarios——用户不知道丢失了什么 | OpenSpec 的历史教训 |
| **不应该让重运行跳过验证步骤** | "idempotent" 只适用于 action——验证必须每次运行 | gstack 的 idempotency 设计 |
| **不应该把学习数据存在 `~/.claude/` 下** | Claude Code 的 sensitive-path guard 阻止后台写入 | ECC v2.1 的迁移教训 |
| **不应该用全局存储保存项目特定的学习模式** | 跨项目污染——React 模式影响 Python 项目 | ECC v2.0 → v2.1 的演进 |
| **不应该对 discard 操作不做确认** | 意外删除工作是不可逆的 | Superpowers 的 Common Mistakes |
| **不应该在 review 后修改代码但不重新测试** | stale 验证结果——代码与验证不匹配 | gstack Verification Gate 的设计 |
| **不应该让全自动流程在没有 stop 条件覆盖的情况下运行** | 未覆盖的失败模式会导致不安全状态下继续执行 | gstack 的 stop 条件设计 |

### 5.4 需要关注什么

在 Archive 节点的实践中，以下几个方面值得持续关注：

**关注点一：Spec 持续演进 vs 一次性文档**

OpenSpec 是唯一实现 spec 持续演进的项目。其他 4 个项目的 spec 都是一次性文档——系统演进后自然过时。对于长期维护的项目，spec 过时是必然的——除非有 Delta 机制持续更新。但对于短期项目或一次性变更，全量 spec 可能足够。关键问题是：**项目需要多长时间的 spec 可追溯性？** 如果答案是"6 个月以上"，Delta 合并值得投入。

**关注点二：学习闭环的实际效果**

ECC 的 Continuous Learning v2 observer 默认关闭——"效果未验证"。gstack 的 learnings 是自动捕获的但在 retro 中才被系统回顾。关键问题是：**instinct/learning 的质量如何衡量？** ECC 承认 "Everything is a 5" anti-pattern——agent 自评不可靠。如果学习闭环的质量无法衡量，它的实际价值就难以评估。

**关注点三：全自动 Archive 的安全性边界**

gstack 的全自动 ship 是最高效的——但也需要最完善的 stop 条件覆盖。gstack 列出了 10 种 stop 条件，但是否有未被覆盖的失败模式？例如，如果 review readiness dashboard 显示 Eng Review stale 但 /ship 仍然继续——虽然 /ship 会在 Step 9 运行自己的 review，但这意味着之前的 review 结果被忽略了。关键问题是：**stop 条件的覆盖面如何持续评估和扩展？**

**关注点四：Worktree 生命周期管理**

Superpowers 是唯一系统化处理 worktree 生命周期的项目。其他项目要么不用 worktree（mattpocock）、要么不清理（gstack、ECC）、要么不涉及（OpenSpec）。但如果 worktree 被广泛使用（如 Superpowers 的 SDD 流程），worktree 残留和清理顺序错误是真实问题。关键问题是：**worktree 管理应该由 Archive 节点承担还是由独立工具承担？**

**关注点五：跨项目知识共享**

ECC v2.1 的 `/promote` 命令允许将 project-scoped instinct 晋升为全局——当同一 instinct 在 2+ 项目中出现且平均置信度 >= 0.8。gstack 的 learnings 也支持跨 session 搜索。但跨项目知识共享的风险是污染——如何平衡"通用模式共享"和"项目特定隔离"？ECC 的 auto-promotion criteria（2+ 项目 + 0.8 置信度）是一种探索，但是否足够？

### 5.5 怎么观察效果

Archive 阶段的效果可以通过以下信号观察：

**正面信号（Archive 有效）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Archive 后 spec 与代码一致 | Delta 合并成功——source of truth 是准确的 | 定期运行 spec 验证，检查 spec 与代码的一致性 |
| 归档的 change 文件夹包含完整上下文 | 审计链完整——可回溯设计决策 | 检查归档的 change 文件夹是否包含 proposal + design + tasks + specs delta |
| Worktree 在 archive 后被正确清理 | worktree 生命周期管理有效 | 检查 `.worktrees/` 目录是否有过期 worktree 残留 |
| Archive 失败时 exit code 非零 | CI/脚本能正确检测失败 | 在 CI 中检查 archive 命令的 exit code |
| Commit 是 bisectable 的 | 每个 commit 代表一个逻辑变更——git bisect 有效 | 运行 `git bisect` 验证 commit 可独立理解 |
| 学习模式被提取和应用 | 学习闭环在运行 | 检查 instincts/learnings 文件是否有新条目 |
| Review 结果不过时 | staleness detection 有效 | 检查 review log 中的 commit hash 与当前 HEAD 的差异 |

**负面信号（Archive 有问题）：**

| 信号 | 含义 | 观察方式 |
|------|------|---------|
| Archive 后 scenarios 消失 | MODIFIED 块遗漏了已有 scenarios——静默删除 | 对比 archive 前后的 spec，检查 scenario 数量 |
| Archive 验证失败但 exit code 0 | CI/脚本误判成功 | 在 CI 中检查 archive 命令的 exit code |
| Worktree 残留 | archive 后 worktree 未被清理 | 检查 `.worktrees/` 目录 |
| 非 WIP commit 被 squash | `git reset --soft` 破坏了已落地工作 | 检查 commit history 是否有非预期的 commit 消失 |
| Spec 与代码不一致 | Delta 合并出错或 spec 腐化 | 定期运行 spec 验证 |
| 学习模式为空或全是 "Everything is a 5" | 学习闭环未运行或质量低下 | 检查 instincts/learnings 文件内容和质量 |
| Review 结果过时但未被检测 | staleness detection 未运行 | 检查 review log 中是否有 commit hash 记录 |
| 全自动 ship 在不安全状态下继续 | stop 条件覆盖不足 | 检查 ship log 中是否有被跳过的 stop 条件 |

### 5.6 怎么改进

Archive 阶段的改进可以从以下几个方向入手：

**改进方向一：建立归档前完整性检查清单**

借鉴 OpenSpec 的多维度验证和 Superpowers 的测试先行——在归档前检查：测试是否通过、spec 是否完整（scenarios 没有丢失）、tasks 是否完成、exit code 是否正确。不是每个项目都需要所有维度，但至少应该有测试验证和语义完整性检查。

**改进方向二：为 worktree 管理建立 provenance 标记**

借鉴 Superpowers 的 provenance-based cleanup——只清理自己创建的 worktree。如果项目使用 worktree 机制，应该有明确的 provenance 标记（如 `.worktrees/` 目录前缀）和清理顺序约束（merge → remove worktree → delete branch）。

**改进方向三：为全自动流程建立 stop 条件审计**

借鉴 gstack 的显式 stop 条件枚举——如果使用全自动 archive 流程，应该定期审计 stop 条件的覆盖面。每次发生"应该在 X 处 stop 但没有"的事件后，添加新的 stop 条件。同时审计"never stop for"条件是否过于宽泛。

**改进方向四：区分 action 幂等和 verification 非幂等**

借鉴 gstack 的 idempotency 设计——重运行时只有 action 是幂等的（跳过已执行的），verification 必须每次运行。这个区分应该在流程文档中显式声明，避免用户误解。

**改进方向五：为学习闭环建立质量衡量指标**

借鉴 ECC 的置信度评分和 gstack 的 learnings 搜索——如果使用学习闭环，应该有质量衡量指标（如 instinct 的 confidence 分布、learnings 被搜索引用的频率）。如果质量指标持续低下，可能需要调整观察机制或提取算法。

### 5.7 本篇结论

Archive 节点的核心使命是**从完成到闭环**——确保变更被正确归档、知识被有效沉淀、系统状态被持续维护。五个项目在这个使命上的实现方式差异巨大，但都指向一些共同的关注点：

1. **归档验证不能只查格式**——OpenSpec 的 scenario 静默删除教训和 gstack 的 stale 验证结果教训都表明，语义完整性验证比格式验证更重要
2. **状态变更操作的顺序约束必须显式化**——Superpowers 的 7 种 Common Mistakes 和 gstack 的 anti-footgun rules 都是对操作顺序错误的回应
3. **学习闭环的可靠性取决于观察机制**——ECC 从 v1（50-80% 触发）到 v2（100% 触发）的演进清晰地展示了这一点
4. **自动化程度与安全性的 tradeoff**——gstack 的全自动 ship 需要最完善的 stop 条件覆盖，Superpowers 的 4 选项菜单是最保守的
5. **Spec 持续演进是长期项目的核心需求**——OpenSpec 是唯一实现 spec 持续演进的项目，其他项目的 spec 都会随系统演进而过时

这些结论不一定完全正确——每个项目的场景不同，适用的做法也不同。我们只是试图从各家经验中提炼出一些相对普遍的规律，供读者在设计和使用 Archive 节点时参考。

---
