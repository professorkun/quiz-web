# W4 · 既有页面一致性 — 占位清理与回归报告

- 窗口：W4（对应改进项 13 号方案 I-5 · UI 一致性）
- 分支：`fix/s7e8-ui-consistency`
- 提交前缀：`fix(s7e8-w4)`
- 日期：2026-11-18
- 依据：`项目规划/任务窗口/W4-既有页面一致性.md`（唯一权威）、`web-v2/docs/plans/parallel-contract.md`（G0 契约）、`web-v2/docs/reports/s5-feature-parity.md`（6/6 基线）

---

## 1. 占位清理清单（文件 → 原文案 → 处置）

全文搜索 `待 S4` / `待 S5` / `待 S6` / `待接入`，命中 2 处，全部在 `features/practice/PracticePage.tsx`：

| # | 文件 | 原文案 | 原状态 | 处置 | 依据 |
| --- | --- | --- | --- | --- | --- |
| 1 | `PracticePage.tsx` 范围区 | `只刷未掌握（待 S4）`（`title="S4 引入状态机后开放"`） | 永久 `disabled` 的假入口 | **接 S4 状态机改为真实入口**：`settings.onlyUnmastered` 接进 `PracticeConfig`，由 `core/practice/engine.ts` 的 `onlyUnmastered` 过滤（`p?.mastered === true` 排除）真实筛题；按钮随 `progress` 实时显示未掌握数，`onlyUnmasteredCount === 0` 时才禁用 | 契约 `PracticeConfig.onlyUnmastered`；S4 `mastered === (status === "mastered")` 投影 |
| 2 | `PracticePage.tsx` 模式区 | `模考（待 S5）`（`title="S5 接入模考"`） | 永久 `disabled` 的假入口 | **改为真实入口**：`onClick={() => navigate("exam")}`，文案改「模考（去模考页）」；S5 模考能力已存在（`router.ts` 第 4 入口、`ExamPage`），不留「待」字 | `s5-feature-parity.md` 6/6 通过 |

顺带修正（同属占位语义）：范围区三个按钮改为互斥单选（全部 / 只刷未做 / 只刷未掌握），`onlyUnseen` 与 `onlyUnmastered` 不会同时为 true，避免组合出「未做且未掌握」这种说不清的口径。

## 2. 导入导出讲义信息展示核对（步骤③）

核对对象：`features/me/ImportExport.tsx` 题库包预览。

- 核对前：`N 道题 · M 个知识点 · K 篇讲义`——只有**篇数**，无节数。
- W2 产物（`packages/content/javaweb-final/knowledge.json`，7 篇）每篇按 `##` 切节（契约 §4.2），实测节结构齐全（各篇 11~13 节）。
- 核对后：篇数沿用 `knowledge.length`；补「节数」= 各篇 `sections.length` 合计，仅在 >0 时显示（旧版 items 型讲义如化学库无 `sections`，不硬凑 0 节）。
- **不改数据解析逻辑**（那是 W1 范围）：`sectionTotal` 只做展示换算，对缺字段数据按 0 兜底，不触碰 `parseBankJson` / schema。

结论：讲义信息展示（篇数/节数）与 W2 产物口径一致。

## 3. 回归用例（步骤④）

文件：`apps/web/src/app.test.tsx`。

| 类型 | 用例 | 断言要点 |
| --- | --- | --- |
| 新增 | `W4 一致性 > 「只刷未掌握」接 S4 状态机：已掌握题被筛掉，未掌握题仍可刷` | 先把 `chem:single_choice:001` 写成 `status:"mastered"` 的进度，选「只刷未掌握」开刷：会话只剩 1 题（`第 1 / 1 题`），已掌握的题干不出现——证明接的是真实数据源，不是空壳 |
| 修改 | `六入口 > 每个入口都能进入并有实质内容`（原「五入口」） | 补第 6 个入口 `exam`：可进入 + 模板卡片「化学小测」真的渲染（光到空壳页不算实质内容） |
| 修改 | `S3 验收补测 > 换题库时知识讲义跟着换` | 讲义标题由 `findByText` 改 `findAllByText`：W3 精读 UI 把标题渲染在导航与正文两处，单元素断言会误报 |

既有用例全部保留未删改语义（游客闭环、筛选搜索、跨库隔离、S4 复习对账、刷新恢复等）。

## 4. 执行命令与输出

```bash
$ grep -rn "待 S4\|待 S5\|待 S6\|待接入" web-v2/apps/web/src web-v2/packages --include="*.ts" --include="*.tsx"
（无输出，exit 1）
```

```bash
$ cd web-v2 && pnpm --filter @quiz/web test
 RUN  v2.1.9 F:/001/刷题/web-v2/apps/web
 ✓ src/features/knowledge/practiceLink.test.ts (3 tests)
 ✓ src/cloud/sync.test.ts (3 tests)
 ✓ src/components/renderRichText.test.ts (7 tests)
 ✓ src/features/knowledge/legacy-items.test.tsx (2 tests)
 ✓ src/features/knowledge/KnowledgePanel.test.tsx (8 tests)
 ✓ src/features/knowledge/zero-request.test.tsx (2 tests)
 ✓ src/renderers/all-renderers.test.tsx (7 tests)
 ✓ src/renderers/short_answer/Renderer.test.tsx (5 tests)
 ✓ src/features/knowledge/offline-persist.test.tsx (5 tests)
 ✓ src/features/exam/exam.test.tsx (9 tests)
 ✓ src/app.test.tsx (16 tests)
   ✓ 六入口 > 每个入口都能进入并有实质内容
 Test Files  11 passed (11)
      Tests  67 passed (67)
Exit Code: 0
```

注：`scrollTo` 的 stderr 提示来自 jsdom 不实现该 API，非失败。

## 5. 验收逐条

| 编号 | 标准 | 结果 | 证据 |
| --- | --- | --- | --- |
| W4-1 | 全仓库源码无「待 S4 / 待 S5 / 待 S6」字样 | ✅ 通过 | §4 grep 无输出 |
| W4-2 | 「只刷未掌握」有真实行为，非假入口 | ✅ 通过 | §3 新增用例：已掌握题被筛掉、未掌握题仍可刷 |
| W4-3 | `app.test.tsx` 既有用例全绿且新增回归用例通过 | ✅ 通过 | §4：16/16 全绿，`pnpm --filter @quiz/web test` 退出码 0 |
| W4-4 | 六个入口均可进入且有实质内容，6/6 不回退 | ✅ 通过 | §3 六入口用例（含 exam 模板卡实质内容）；`s5-feature-parity.md` 6/6 基线未回退 |
| W4-5 | 未修改任何黑名单文件 | ✅ 通过 | §6 diff 逐行核对 |
| W4-6 | 与 W3 合并后无路由/样式冲突 | ⏳ 交 INT | 本窗口零触碰 `styles.css` / `router.ts` / `App.tsx` / `AppShell.tsx`，冲突面为零；最终判定在 INT 第 4 步 `pnpm verify` |

## 6. W4-5 黑名单核对（`git diff --name-only`）

本次提交只含 4 个文件（3 改 1 新建）：

```
web-v2/apps/web/src/features/practice/PracticePage.tsx   （白名单）
web-v2/apps/web/src/features/me/ImportExport.tsx          （白名单）
web-v2/apps/web/src/app.test.tsx                          （白名单）
web-v2/docs/reports/w4-parity-regression.md               （可新建）
```

黑名单逐项核对：`features/knowledge/**`、`BanksPage.tsx`、`styles.css`、`router.ts`、`App.tsx`、`ui/AppShell.tsx`、`cloud/**`、`core/**`、`content/**`、`项目规划/**`、所有 `package.json`、旧版根目录 —— **均未修改**（工作区里其它窗口的未提交草稿不属于本次提交，未纳入 staging）。

## 7. 给 W3 的样式需求清单

**无。** 本次改动全部复用既有类（`chip` / `chip on` / `btn` / `muted` / `notice` / `previewbox`），未引入任何新 CSS 类；`styles.css` 零触碰。

## 8. 遗留问题

1. **W4-6 待 INT 判定**：与 W3 合并后的路由/样式冲突由 INT 第 4 步 `pnpm verify` 终判（本窗口无 CSS/路由改动，预期零冲突）。
2. **共享工作区有大量其它窗口未提交草稿**（W1 core 契约、W3 讲义 UI、W5 cloud 等）。本次仅提交 W4 白名单 4 文件；其余草稿按 P-1 原样保留在工作区，由各自窗口纳入版本管理。
3. **`apps/web/src/cloud/` 为未跟踪状态**（W5 已在 `chore/s6-closeout` 分支提交同名文件）：`PlatformProvider.tsx` 草稿对 `../cloud/auth` 的引用依赖它才能通过模块解析。本窗口未动这两个文件的任何内容，属 W5 领地，合并时以 W5 分支为准。
4. 范围区三按钮互斥口径（全部 / 只刷未做 / 只刷未掌握）已在 §1 注明；若产品侧后续要「叠加筛选」，需走契约变更单再调。
