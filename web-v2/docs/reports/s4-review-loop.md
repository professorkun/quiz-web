# S4 · 错题、复习与统计闭环 — 交付与门禁报告

- 日期：2026-11-16
- 分支：`feat/general-s4-review-loop` → PR 到 `general-dev`
- 规则 ADR：`docs/adr/0006-review-scheduling-24h.md`
- 结论：G1/G2/G3/G4 均有可重跑证据；建议通过并打 `s4-review-loop`

---

## 1. 交付清单

| 任务 | 实现 | 证据 |
| --- | --- | --- |
| T4-1 Attempt 写入管线 | `core/records/attempt.ts`（S3 已落存储侧） | `attempt.test.ts` 10 条 |
| T4-2 状态机 | `core/review/state.ts` | `state.test.ts` 21 条 |
| T4-3 调度（1/3/7 天） | 同文件 `addHours / isDue / dueQuestionIds` | 时间旅行用例 |
| T4-4 错因与备注 | 复习页错题行内 5 类错因 select + 备注输入 | `app.test.tsx` 错因持久化用例 |
| T4-5 收藏独立 | S3 已交付，S4 未改动收藏存储 | S3 的收藏独立用例仍绿 |
| T4-6 复习页四视图 | 到期 / 错题 / 收藏 / 已掌握 | `app.test.tsx` 四视图用例 |
| T4-7 统计 | `core/stats/index.ts` + 学习页摘要 | `stats.test.ts` 9 条 |
| T4-8 重算与对账 | `data/recompute.ts` + 「我的」页按钮 | `recompute.test.ts` 4 条 + UI 用例 |

关键口径（ADR-0006）：

- **24 小时口径**：答错 +24h、第 1 次独立答对 +72h、第 2 次 +168h，第 3 次转已掌握。
- **独立复习**：不同会话 + 已到期，且只约束 `reviewing` 状态；`learning` 的重做答对直接进入复习计划。
- **主观题未自评**（`correct === null`）不推进也不惩罚。
- **首次就答对**保持 `new`，不制造待复习噪音（复习闭环针对错题）。

---

## 2. §6 验收逐条

### A. 事件与状态

- ✅ 每次作答生成新 `Attempt`，含 `bankId/questionId/questionRevision/sessionId/mode/durationMs/isFirstAttempt`：`buildAttempt` + `attempt.test.ts`。
- ✅ 重复作答不覆盖历史：`platform.test.ts > 重复作答保留旧记录，旧记录内容不变`。
- ✅ 进度由事件推导：`computeProgress` 委托 `replayReview`；页面不直接写"做对过"。
- ✅ 状态迁移 `new → learning → reviewing → mastered` 与答错回退：`state.test.ts > 状态迁移表` 8 条。
- ✅ 连续 3 次独立答对才转 mastered：`state.test.ts > 同一会话在到期时刻连点，只计第一次`、`连续 3 次独立答对 → mastered`。

### B. 复习调度

- ✅ 1/3/7 天推进与精确到期：`T 答错 → T+1 答对 → T+4 → T+11`。
- ✅ 到期列表只含 `nextReviewAt <= now` 且不含 mastered：`dueQuestionIds` 用例。
- ✅ 复习中答错立即回待复习、连续归零：`state.test.ts > 复习中答错 → 连续归零、回到待复习、次日重排`。
- ✅ 时钟可注入：所有时间走 `submittedAt / now` 参数，`core` 不读系统时钟。

### C. 错因与收藏

- ✅ 5 类错因可选、可改、可清：`ERROR_CAUSES` + 复习页 select；`app.test.tsx > 错因可标记，重新打开仍保留`。
- ✅ 收藏与错题互不影响：S3 用例仍绿，S4 未触碰收藏存储。
- ✅ 移出/掌握后历史可查：`Attempt` 只追加，`mastered` 只是投影。

### D. 统计

- ✅ 首次正确率只认 `isFirstAttempt`：`stats.test.ts > 重做答对 3 次也不会抬高首次正确率`。
- ✅ 重复练习正确率独立统计：同上，1 次错 / 3 次重做对 → 0% / 100%。
- ✅ 覆盖率、掌握度、待复习量、学习时长均有明确口径：见 `stats.test.ts > 统计口径`。
- ✅ 清空派生后重算一致：`recompute.test.ts > 清空全部 progress 后重算，与清空前逐项一致`。
- ✅ 三种 mode 分别统计：`byMode` + `mode` 过滤用例。

### E. 关键场景

| 场景 | 证据 |
| --- | --- |
| 答错不丢轨迹（4 条 Attempt、3 次独立答对转掌握、首次仍记错） | `state.test.ts` + `stats.test.ts` 联合覆盖 |
| 复习推进 T / T+4 / T+11 | 时间旅行用例 |
| 答错重置 | `state.test.ts > 复习中答错…` |
| 统计可重算 | `recompute.test.ts` 4 条 |
| 收藏独立 | S3 用例 |
| 未登录不丢（游客 + 本地存储） | S3 用例；S4 沿用同一存储 |

### F. 不可接受的情形

| 禁止项 | 结论 |
| --- | --- |
| "做对过"布尔值代替状态机 | 未出现：`mastered` 仅是 `status === "mastered"` 的投影，判分不写它 |
| 一次答对永久移出错题 | 未出现：错题视图按 `wrongCount > 0`，与 status 无关 |
| 首次正确率把重做算进去 | 未出现：统计只认 `isFirstAttempt` |
| 统计直接累加计数器无法重算 | 未出现：`computeStats` 纯函数，无缓存 |
| 收藏被掌握顺带清掉 | 未出现：两套存储 |
| 上 FSRS / 自适应 | 未出现：间隔在 `DEFAULT_REVIEW_CONFIG`，无权重 |

---

## 3. 门禁

| 门禁 | 结论 | 依据 |
| --- | --- | --- |
| G1 数据：Attempt 不可变、Progress 可重算、统计可对账 | 绿 | S3 存储用例 + `recompute.test.ts` |
| G2 功能：错题→复习→掌握→退出全流程 | 绿 | 状态机迁移表 + 复习页四视图 + 时间旅行用例 |
| G3 工程：状态机与调度器完整单测、时钟可注入 | 绿 | `state.test.ts` 21 条；`check-boundaries` PASS（44 个 core 文件，仅依赖 zod） |
| G4 可回退：状态可从事件重建 | 绿 | `recomputeBank` + 导出备份（S3） |
| 规则文档化 | 绿 | ADR-0006 明确 1/3/7 口径与"独立复习"定义 |
| 标签 `s4-review-loop` | 见下 | 人工确认后打 |

**复跑**

```
cd web-v2 && pnpm verify
```

当前计数：core 132 / content 17 / platform-web 16 / data 24 / web 34 = **223 条，0 失败**。

---

## 4. 偏差与遗留

| 项 | 说明 |
| --- | --- |
| 24h 口径而非自然日 | ADR-0006 已论证：避免跨零点/时区把"1 天"变成 10 分钟；文案要说"约 1 天后"而不是"明天" |
| `QuestionProgress` 新增 5 个字段 | `status / streak / nextReviewAt / errorCause / note`，全部带 Zod 默认值，S3 老记录可读，不需要数据迁移 |
| `mastered` 字段保留 | 仅作为状态机投影，供 S1 引擎的 `onlyUnmastered` 继续用；不允许外部直接写 true |
| 备注在失焦时写入 | 避免逐字符写存储；S4 验收只要求"备注可选" |
| 未做三模式统计界面展示 | `computeStats` 已提供 `byMode` 和 `mode` 过滤并有单测；界面目前展示总体口径，模式看板留给 S7 |
| 遗留到 S5 | 模考入口仍置灰；`mode=exam` 的统计通道已打通但没有真实事件源 |
| 遗留到 S7 | 弱项推荐、自适应算法、FSRS 评估（需积累真实数据） |
