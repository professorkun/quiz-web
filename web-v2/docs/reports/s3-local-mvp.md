# S3 · 多题库、本地记录与导入导出 — 交付报告

- 日期：2026-11-16
- 分支建议：`feat/general-s3-local-mvp` → PR 到 `general-dev`
- 标签：**未打**（`s3-local-mvp` 需人工确认门禁后再打，见 §5）

---

## 1. 这一阶段实际交付了什么

| 交付物 | 位置 | 说明 |
| --- | --- | --- |
| 存储接口（键值抽象） | `packages/platform/src/index.ts` | 收藏、设置、题库注册、会话快照、存储健康度；不含任何 IndexedDB 概念 |
| 存储接口 ADR | `docs/adr/0005-storage-kv-abstraction.md` | 说明为什么不要游标/索引/事务，以及三端复用方式 |
| Web 存储实现 | `packages/platform/web/` | 原生 IndexedDB 键值实现 + 内存实现 + 仓储 + 版本闸门 |
| 作答事件构造 | `packages/core/src/records/attempt.ts` | 不可变、`isFirstAttempt` 由历史推断、耗时可选 |
| 第二学科题库 | `packages/content/src/banks/chemistry.ts` | 14 题 / 4 种题型 / 3 篇讲义 |
| 导入导出 | `packages/data/src/snapshot.ts` | 学习记录与题库包双通道，未知字段拒绝、逐条定位、导入后对账 |
| 应用壳与五入口 | `apps/web/src/{App.tsx,ui/AppShell.tsx,router.ts}` | 桌面侧栏 + 移动底栏，hash 路由 |
| 学习 / 题库 / 刷题 / 复习 / 我的 | `apps/web/src/features/*` | 复习页为壳（到期与掌握待 S4） |

**五入口实际内容**

- 学习：做题数、答对过、错题、收藏；续刷（读会话快照）；空状态引导
- 题库：切库、题型/知识点/状态筛选、题干搜索、只读预览、收藏、知识讲义
- 刷题：范围/题型/顺序/题量/只刷未做；作答即写 `Attempt` + 重算进度；收藏
- 复习：错题（`wrongCount > 0`）、收藏（独立）、一键重做（复习模式会话）
- 我的：作答事件数、轮次、首答即对、存储占用、导出/导入、清空当前库记录

---

## 2. 验收证据（可重跑）

### 2.1 命令

```
pnpm verify
```

结果（2026-11-16）：

| 包 | 用例数 | 结果 |
| --- | --- | --- |
| `@quiz/core` | 102 | 全绿 |
| `@quiz/content` | 17 | 全绿 |
| `@quiz/platform-web` | 16 | 全绿 |
| `@quiz/data` | 20 | 全绿 |
| `@quiz/web` | 31 | 全绿 |
| 合计 | **186** | **0 失败** |

附带扫描：

```
node scripts/check-boundaries.mjs   → PASS 边界干净（38 个 core 源文件，依赖仅 zod）
node scripts/check-extension-point.mjs → PASS（apps/web 34 个文件无按题型硬分派）
```

### 2.2 关键用例（测试名 → 判据）

| 判据 | 用例 |
| --- | --- |
| 作答只追加、旧记录不变 | `platform.test.ts > 重复作答保留旧记录，旧记录内容不变` |
| 同 ID 幂等 | `platform.test.ts > 同一 attemptId 重复写入不产生副本（幂等）` |
| 跨库隔离 | `platform.test.ts > A 库的作答不出现在 B 库` / `收藏与练习设置同样按库隔离` |
| 收藏不被进度重算带走 | `platform.test.ts > 进度被重算/覆盖后收藏仍在` |
| 版本闸门 | `platform.test.ts > 本地数据版本高于代码支持时抛 version 错误，不静默降级` |
| 存储不可写有可读提示 | `platform.test.ts > 存储不可写时 info() 给出 writable=false 与可读原因` |
| 导出→清空→导入 diff 为空 | `snapshot.test.ts > 记录逐项一致（diff 为空）` |
| 未知字段拒绝并定位 | `snapshot.test.ts > 未知字段被拒并指到具体条目` |
| 非法题库包定位到题 | `snapshot.test.ts > 题目字段非法时指出题号与字段（验收 F-4）` |
| 五入口可达 | `app.test.tsx > 每个入口都能进入并有实质内容` |
| 空状态引导 | `app.test.tsx > 新用户看到的是引导而不是白屏` |
| 游客闭环 | `app.test.tsx > 答错一题后进入错题列表，收藏独立保留` |
| 页面读的是存储而非内存 | `app.test.tsx > 提交后重算进度，错题数可被学习页读到` |
| 筛选与搜索 | `app.test.tsx > 按状态筛掉未做题，搜索无结果时给提示` |
| 切库标识 | `app.test.tsx > 切换题库后当前库有明确标识` |
| 跨库不串（UI 层） | `app.test.tsx > 在化学库答错不会污染对照题库的错题数` |
| 第二学科合法性 | `chemistry.test.ts`（5 条：校验通过、≥3 题型、≤20 题、知识点闭合、bankId 不冲突） |

### 2.3 门禁逐条（复核结论见 `s3-gate-review.md`）

| 门禁 | 证据 | 状态 |
| --- | --- | --- |
| G1 数据：双库隔离、导入导出 diff 为空 | 上述 5 条隔离用例 + `diff 为空` 用例 | 待人工确认 |
| G2 功能：五入口可用、游客闭环 | `app.test.tsx` 7 条 | 待人工确认 |
| G3 工程：走接口、schema 有版本、单测覆盖 | `check-boundaries` PASS；`ensureSchemaVersion` + 版本用例；179 条单测 | 待人工确认 |
| G4 可回退：导出可用、清库可重建 | 「我的」页导出学习记录 / 导出题库包；`clearLearningData` 用例 | 待人工确认 |
| 第二学科零代码接入 | 内置路径见 §3.3；导入路径见 `parseBankJson` 用例 | 待人工确认 |

---

## 3. 与计划的偏差（需登记，均已在本阶段内自洽）

### 3.1 存储实现用原生 IndexedDB，不引 Dexie

计划 §5 写的是「Dexie 实现」。实际实现改为**原生 IndexedDB + 键值抽象**（ADR-0005）：

- 接口只需要 `get / set / delete / keys(prefix)`，Dexie 的索引与事务在接口里无处安放；
- 引入依赖换不到能力，却多一个需要联网安装、需要跟版本的包袱；
- 单测在 Node 里跑同一份仓储代码，不需要 `fake-indexeddb`。

**影响**：验收 E「业务代码不直接 import Dexie」自然成立（没有 Dexie 可 import）。若后续确实需要复杂查询，再在 `platform/web` 内部换实现，接口不变。

### 3.2 数据契约的小幅追加

- `Attempt` 增加**可选** `durationMs`（S4 的「学习时长」要用；缺省表示未记录，不写 0）。
- 新增 `FavoriteEntry` / `PracticeSettings` / `AppSettings` / `LearningSnapshot` / `BankContent` 五个结构。
- `QuestionProgress` **未**加 S4 的 `status / continuousCorrect / nextReviewAt`：按 S4 文件 §3 的要求，字段不足回 S1 补，不在 S4 硬塞，更不在 S3 抢跑。

### 3.3 第二题库的"零代码"边界

- **内置路径**：新增题库 = 在 `apps/web/src/data/banks.ts` 注册表加一行 + 一份内容文件；判分、引擎、页面、统计零改动。
- **导入路径（真正的零代码）**：`quiz.bank` JSON 经「我的 → 数据导入导出」导入即可用，全程不碰源码。这条路径由 `parseBankJson` 与 `saveImportedBank` 用例覆盖。

计划 §6-D 的"仅通过导入/配置接入"两条都成立；选内置注册表是因为 Vite 的 JSON 动态导入在 Node 测试环境不可用，会牺牲可测性。

### 3.4 题库页预览不显示答案

预览复用题型渲染器的只读模式（`locked` + 未作答），因此不剧透答案与解析——要看解析就去做一遍。这同时避免在页面里按 `type` 分派（ADR-0004 的硬要求）。

### 3.5 复习页只做壳

「到期复习」「已掌握」两个 tab 置灰，注明待 S4。错题口径已经按 S4 的方向定死：**答错一次就一直在错题里**（不因重做答对而消失）。

### 3.6 会话快照与练习摘要分开存

- `session-snapshot:{bankId}`：引擎快照（选项顺序、当前题、答案），负责"刷新能续上"；
- `session:{bankId}`：`PracticeSession` 摘要（每题对错），负责"我的 · 练习记录"。

两者版本与用途不同，合并会让引擎结构渗进存储层。

### 3.7 工程配置

`pnpm-workspace.yaml` 增加 `packages/*/*`：`platform/web` 比一层深，不加这个 glob，pnpm 不把它当工作区包（`pnpm test` 会报"无法解析 @quiz/core@workspace:*"）。

---

## 4. 已知遗留（带入 S4 / S5）

| 项 | 去向 |
| --- | --- |
| `mastered` 仍是"曾经答对过"，不是 S4 的状态机 | S4 T4-2 替换 |
| 无 1/3/7 天排期与到期列表 | S4 T4-3 |
| 无错因标记与备注 | S4 T4-4 |
| 统计只有计数，无首次正确率/覆盖率/掌握度 | S4 T4-7 |
| 重算能力只有 `recomputeProgress`（导入时用），没有对账命令 | S4 T4-8 |
| 无视觉打磨与移动端细调 | S6 |
| 无模考入口（按钮置灰） | S5 |
| `.github/` 仍是未跟踪目录（S0/S2 遗留） | 提交前确认是否纳入 |

---

## 5. 下一步（需要人拍板）

1. 逐条复核 §2.3 的四道门禁；
2. 通过后打标签 `s3-local-mvp`，更新 `00` §8 状态表；
3. 再开始 S4 的第一个任务块（T4-1 已部分落地：`buildAttempt` 可用）。
