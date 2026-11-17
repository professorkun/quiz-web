# S5 · 通用模考与旧版功能对等 — 对照表与门禁证据

- 日期：2026-11-17
- 分支：`feat/general-s5-exam` → PR 到 `general-dev`（阶段标签 `s5-feature-parity`，待人工拍板后打）
- 旧版基线：`题库网页/index.html`（`buildPaper / submitPaper / selfEval` 等，逐字读码对照，不凭记忆）
- 新版实现：`packages/core/src/exam/`、`packages/platform/web/src/repositories.ts`、`apps/web/src/features/exam/`
- 总证据量：`pnpm verify` **293 条测试全绿**（core 174 / platform-web 23 / content 29 / data 24 / web 43）

---

## 1. 六模块逐条对照（验收 C）

| # | 模块 | 旧版行为（基线） | 新版实现 | 验证方式 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | 题库 | 搜索框按题干过滤（`servlet`→38 题）、按知识点/题型筛选、点题预览 | `BanksPage`：搜索 + 题型/知识点/状态筛选 + 题目预览 | `app.test.tsx > 筛选与搜索`；旧版数字见 G2 冒烟 #1 实测记录 | ✅ 通过 |
| 2 | 刷题 | 顺序/筛选刷题、上一题/下一题、切换 Tab 续刷、刷新恢复 | `PracticePage` + `core/practice`：设置按库保存、续刷、会话快照恢复 | `app.test.tsx > 游客闭环`；`practice/session.test.ts`（9 条） | ✅ 通过 |
| 3 | 模考 | `buildPaper()` 写死 15/10/5/4/4；计时只累计不限时；客观自动判、简答+应用自评 | 模板可配置组卷（T5-1/2）、倒计时/超时自动交卷/中断恢复（T5-3）、逐空比例分（D-4）、自评单字段（D-5） | `core/exam/*.test.ts`（42 条）+ `exam.test.tsx`（9 条）+ 对账（§2） | ✅ 通过（差异见 §5） |
| 4 | 错题 | 模考做错的客观题进错题本；重做做对移出；**未作答也计错**（旧缺陷） | S4 状态机：Attempt 事件 → 重算 → 复习闭环；模考事件带 `mode:"exam"` 汇入同一闭环 | `exam.test.tsx > 模考作答写入 mode=exam 事件并进入复习闭环`；S4 的 `state.test.ts` 21 条仍绿 | ✅ 通过（未答不再计错，见 §5-D） |
| 5 | 知识 | `POINTS` 常量写死在模板里 | 讲义随题库包走（S1 T1-7），按 `topicId` 关联 | `banks.ts` 装配 + S3/S4 既有用例；换库即换讲义 | ✅ 通过 |
| 6 | 我的 | 记录、设置、导入导出 | `MePage`：统计、设置、导入导出（S5 起快照含 `examRecords`） | `data/snapshot.test.ts` 13 条（含成绩合并）；`platform.test.ts > exportAll 含成绩` | ✅ 通过 |

## 2. 卷面对账表（G5-3 / T5-6）

旧版卷面基线取自 `renderExamHome` 的卷面说明与 G2 冒烟 #2 实测（`JavaWeb期末题库.html`）：

| 项 | 旧版 | 新版（`examTemplates.json`） | 证据 | 结果 |
| --- | --- | --- | --- | --- |
| 总题量 | 38 题 | 38 题（15+10+5+4+4） | `javaweb-template.test.ts > 卷面规模` | ✅ 一致 |
| 总分 | 100 分 | 100 分 | 同上 | ✅ 一致 |
| 选择题 | 15 × 2 = 30 | 15 × 2 = 30 | `逐题型数量与分值` 用例 | ✅ 一致 |
| 判断题 | 10 × 1 = 10 | 10 × 1 = 10 | 同上 | ✅ 一致 |
| 填空题 | 5 × 2 = 10 | 5 × 2 = 10 | 同上 | ✅ 一致 |
| 简答题 | 4 × 5 = 20 | 4 × 5 = 20 | 同上 | ✅ 一致 |
| 应用题 | 4 题共 30 分（按空数动态分配，1 空 1 分） | 4 × 7.5 = 30（固定均值，判分按空位比例） | 同上 + `record.test.ts > 5 空对 3 → 3/5` | ✅ 题型总分一致；逐题分值口径差异见 §5-B |
| 时长 | 只计时不限时 | 120 分钟倒计时，超时自动交卷 | `durationSec: 7200` + `session.test.ts` 超时用例 | 差异见 §5-A |
| 组卷可复现 | `Math.random()` 不可复现 | 种子可复现，同种子同卷 | `javaweb-template.test.ts > 同种子可复现` | ✅ 新增能力 |

## 3. G2 冒烟 6 项映射（G5-6 / T5-8）

| # | 冒烟项 | 新版对应验证 | 结果 |
| --- | --- | --- | --- |
| 1 | 搜题（`servlet`→38 / `jdbc`→14 / 清空→147） | `app.test.tsx > 筛选与搜索`（同一条链路）；数字基线沿用 G2 实测记录 | ✅ 对应通过 |
| 2 | 组卷（38 题 / 100 分 / 倒计时） | `javaweb-template.test.ts`（38/100 对账）+ `exam.test.tsx > 模板卡片…（计时显示）` | ✅ 对应通过 |
| 3 | 判分（空卷交卷 → 确认弹窗「还有 N 题未作答」→ 客观 0 分） | `exam.test.tsx > 空卷交卷：确认弹窗报未答数，成绩 0 分` | ✅ 对应通过 |
| 4 | 续刷（继续刷（第 2 / N 题），选择被记住） | `app.test.tsx > 游客闭环` + `practice/session.test.ts > 恢复` | ✅ 对应通过 |
| 5 | 刷新恢复（localStorage 保留续刷位置） | `practice/session.test.ts`（9 条）+ `exam.test.tsx > 中断恢复` | ✅ 对应通过 |
| 6 | 错题重做（做对移出错题本） | S4 `state.test.ts > 复习中答对…` + `app.test.tsx > 答错一题后进入错题列表` | ✅ 对应通过（新版按 S4 状态机语义，见 §5-D） |

## 4. 关键场景（验收 D）逐条

| 场景 | 判据 | 证据 | 结果 |
| --- | --- | --- | --- |
| D-1 卷面严格 | JavaWeb 模板 38 题 / 100 分，题型数量与模板一致 | `javaweb-template.test.ts`（3 条对账）+ `checkPaperMatchesTemplate` | ✅ |
| D-2 题量不足 | 拒绝开考并提示「可用题目 30 < 需要 40」，不生成残卷 | `assemble.test.ts > 题量不足…`（消息逐字断言）+ `exam.test.tsx > 题量不足…` | ✅ |
| D-3 中断恢复 | 第 20 题、剩 12 分钟刷新 → 同题、同作答、同剩余时间、顺序不变 | `session.test.ts > 进行到第 20 题、剩 12 分钟…`（12:00 逐毫秒断言）+ `exam.test.tsx > 中断恢复` | ✅ |
| D-4 空位计分 | 5 空对 3 → 3/5 比例分，明细显示哪两空错 | `record.test.ts > 应用题逐空比例分`（4.5/7.5 + b3/b4 ✗）+ `exam.test.tsx > 逐空明细` | ✅ |
| D-5 自评不覆盖客观分 | 自评档位单独显示，客观分不变，原始作答可回看 | `record.test.ts`（6 条自评用例）+ `platform.test.ts > 自评是唯一可更新字段` + `exam.test.tsx > 自评一半…` | ✅ |
| D-6 多库隔离 | 两库各考一次，成绩归属各自 `bankId`/`templateId` | `cross-bank-exam.test.ts`（5 条）+ `platform.test.ts > 成绩按题库隔离` + `exam.test.tsx > 两个题库各考一次` | ✅ |

## 5. 与旧版不一致项及处理（每条都有意、有据）

| # | 项 | 旧版 | 新版 | 依据 |
| --- | --- | --- | --- | --- |
| A | 时长 | 只显示已用时，不限时 | 模板可配 `durationSec`，倒计时 + 超时自动交卷；JavaWeb 模板 120 分钟 | G5-1「时长可配置」与 T5-3/D-3 明确要求；**人工拍板（2026-11-17）：维持限时**；改回不限时只需删模板里一行配置（G4 可回退） |
| B | 应用题逐题分值 | 按空数动态分配（`allocAppScores`，1 空 1 分，逐卷不同） | 模板固定 7.5 分/题，判分按空位比例（D-4 钉死的口径） | G5-2 要求逐题分值**严格等于模板**，与旧版动态分配互斥；题型总分 30 分一致；S1 迁移时已注记「模板里只能写均值」 |
| C | 填空部分对 | 全对满分 / 部分对半分 / 不对 0 分 | 按空位比例给分（2 空对 1 = 一半，与旧版一致；3 空以上按比例，旧版给固定半分） | S2 判分口径（`legacy-parity` 已登记），容差表「改整题判分口径」属容差外，S5 不回改 |
| D | 未作答计分 | 未答的客观题进错题本、计 `wrong_count`（G2 实测已登记为产品缺陷） | 未答记 0 分、**不写 Attempt**，不进错题闭环 | 避免「累计错 N 次」失真；旧版缺陷登记于 G2 清单「顺带发现的产品缺陷」，新版按其建议口径实现 |
| E | 作答界面 | 整卷长页滚动 | 逐题分页 + 题号导航 | D-3「回到第 20 题」以逐题为准；移动端可用性；卷面内容与分值不受影响 |
| F | 应用题挖空 | 每题只挖「分值数」的空（其余代码预填） | 全部空位作答，按空位比例给分 | D-4 明确「5 空对 3 → 3/5」= 全部空位作答的口径 |

## 6. 阶段门禁检查单（§7）逐条证据

| 门禁 | 证据 | 结果 |
| --- | --- | --- |
| G1 数据：模板校验、成绩归属、明细定位 | `template.test.ts` 11 条；`platform.test.ts > 模考成绩` 7 条（含跨库隔离）；`record.test.ts` 明细到空位（D-4） | ✅ |
| G2 功能：六模块对照全过，6/6 冒烟有对应证据 | §1 + §3，每条带测试名或实测记录 | ✅ |
| G3 工程：组卷与判分单测全绿；无未处理异常 | `pnpm verify` 293 条全绿；边界/扩展点/空位/旧版判分四项检查 PASS | ✅ |
| G4 可回退：模板配置化，改回旧卷面只需改配置 | 卷面全部来自 `examTemplates.json`；删 `durationSec` 即回不限时（§5-A）；改 `sections` 即回旧配比 | ✅ |
| 功能对照表归档 | 本文件 `web-v2/docs/reports/s5-feature-parity.md` | ✅ |
| 打标签 `s5-feature-parity` | 人工拍板（2026-11-17）：限时 120 分钟**维持**，门禁通过 | ✅ 已打 |

## 7. 验收 A/B 用例对照

### A. 模考核心

- ✅ 模板四项配置全部生效：题量/分值（`template.test.ts`）、筛选范围（`cross-bank-exam.test.ts > 主题筛选生效`）、时长（`session.test.ts` 超时）。
- ✅ 组卷严格等于模板；题量不足明确报错：`assemble.test.ts` 8 条。
- ✅ 计时准确、超时自动交卷并提示：`exam.test.tsx > 超时自动交卷并提示`。
- ✅ 交卷后成绩立即可得、客观自动判分：`exam.test.tsx > 空卷交卷` / `客观题自动判分`。
- ✅ 应用/代码填空按空位给分、逐空可见：D-4 证据。
- ✅ 自评可选档、不影响客观分：D-5 证据。

### B. 数据

- ✅ `Attempt.mode = "exam"` 与练习/复习分开统计：`exam.test.tsx > 模考作答写入 mode=exam`（统计按 mode 分列见 `core/stats`）。
- ✅ 成绩记录含 `bankId`/`templateId`：`platform.test.ts` + `exam.test.tsx`（D-6）。
- ✅ 同一模板重复考试多条独立成绩：`platform.test.ts > 同一模板重复考试产生多条独立成绩`。
- ✅ 明细可定位到每题与每个空位：`record.test.ts > 5 空对 3`（blankId 级）。

## 8. 怎么重跑

```bash
cd web-v2
pnpm verify          # 期望：四项检查 PASS + 293 条测试全绿
```

关键测试名索引：

- 组卷与模板：`packages/core/src/exam/template.test.ts`、`assemble.test.ts`
- 会话与计时：`packages/core/src/exam/session.test.ts`
- 判分与自评：`packages/core/src/exam/record.test.ts`
- 卷面对账：`packages/content/src/javaweb-template.test.ts`
- 多库隔离：`packages/content/src/cross-bank-exam.test.ts`
- 成绩仓储：`packages/platform/web/src/platform.test.ts > 模考成绩（S5）`
- 界面闭环：`apps/web/src/features/exam/exam.test.tsx`
