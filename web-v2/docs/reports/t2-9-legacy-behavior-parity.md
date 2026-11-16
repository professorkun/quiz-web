# T2-9 · 旧版纯逻辑迁移与行为对照

- 日期：2026-11-16
- 旧版基线：`_build/template.html`（单文件，判分/洗牌/自评都埋在里面）
- 新版位置：`packages/core/src/questions/`、`packages/core/src/practice/`
- 可执行对照：`packages/core/src/questions/legacy-parity.test.ts`、`scripts/verify-legacy-parity.mjs`

---

## 1. 为什么要有这份对照

《执行协议》§7 反模式之四：**让 AI 猜旧版行为**。旧版没有测试，行为只存在于那 1600 行模板里。如果迁移时凭"我记得应该是……"重写，差异会静默进入新架构，等 S5 功能对等验收时才暴露，那时已经叠加了三四个阶段。

所以这份对照把旧函数**逐字复刻进测试**，让"一致"和"不一致"都能被命令重跑。

## 2. 逐项对照表

| # | 旧版实现 | 新版实现 | 结论 | 证据 |
| --- | --- | --- | --- | --- |
| 1 | `norm()` `:421`：小写、去空白、去引号、中文标点、`/>`→`>`、去尾句号 | `normalizeAnswer()` N1–N7 | **规则内 11 条样例逐条相同** | `legacy-parity.test.ts > 规则内样例` |
| 2 | `norm()` 不处理全角字母 | N1 全角→半角 | **有意差异**：修「应为对却判错」 | 同上 `有意差异 1` |
| 3 | `norm()` 只去 1 个尾句号 | N7 去连续多个 | **有意差异**：低风险放宽 | 同上 `有意差异 2` |
| 4 | `blankOk()` `:429`：含 `indexOf` 包含式匹配 | `matchesAccepted()` 精确等价 | **有意收紧**：取消包含匹配 | `黑名单 9 条全部不再误判` |
| 5 | `shuffle()` `:408`：Fisher-Yates 从后往前 + `Math.random()` | `shuffleWith()` + 注入 rng | **算法同形**，仅随机源可注入 | `同一条随机序列下结果逐项相同` |
| 6 | `withOpts()` `:410`：选项重编号 A/B/C/D，**answer 改写为新字母** | `buildOptionOrders()`：只产出 optionId 顺序，answer 不动 | **有意差异**：身份与展示分离（ADR-0003） | `旧版答案变展示字母，新版仍为 optionId` |
| 7 | 自评 `:873`：`data-v` = 1 / 0.5 / 0 × 题分 | `SELF_RATING_LEVELS` + `makeSelfRating()` | **分值逐档一致** | `自评三档与新版 selfRating` |
| 8 | 自评按钮 `:902` 需整页扫描绑定，曾全部漏绑 | React 组件内 `onClick`，随组件挂载 | **有意差异**：结构性消除漏绑 | `Renderer.test.tsx > 三档按钮全部绑定` |
| 9 | `hlCode()` `:435`：把 `___(5-1)___` 显示成 `[5-1]` | `buildCodeStructure()`：切成 code/blank 段 | **空位编号与出现顺序一致** | `旧版 hlCode 空位编号与新版结构解析` |
| 10 | 刷题进度存整份打乱后的 `items` + `selOrigin` | `SessionSnapshot`：种子 + 实际题序 + 每题 optionOrder | **有意差异**：内容更新后可检测冲突 | `practice/session.test.ts` |

## 3. 真实题库对账（143 个空位）

`scripts/verify-legacy-parity.mjs` 直接读 `packages/content/javaweb-final/questions.json`，对 54 个填空空 + 89 个代码填空空逐个构造三类输入：

| 输入类型 | 期望 | 含义 |
| --- | --- | --- |
| 标准答案原样 | 旧判对、新判对 | 迁移零回归 |
| 全角变体 | 旧判错、新判对 | 有意改进（N1） |
| ≥2 字符子串 | 旧判对、新判错 | 有意收紧（取消包含匹配） |

判定线：**原样输入必须 143/143 判对，回归数必须 0**；差异只允许出现在后两类。

## 4. 差异登记（不是"顺手改了"，是"按验收标准改了"）

| 差异 | 旧版 | 新版 | 依据 |
| --- | --- | --- | --- |
| 全角字母 | 判错 | 判对 | S2 §6-E 场景 3 明确要求 `Ｓｅｒｖｌｅｔ` 按规则判定 |
| 包含式匹配 | 子串也算对 | 只精确等价 | S2 §6-F「不得为放宽而吞掉真实错答」 |
| 答案存展示字母 | `S.ans = "B"` | 只存 `optionId` | S2 §6-F「不得用展示字母作答案存储」 |
| 自评绑定方式 | 整页扫描，易漏绑 | 组件内绑定 | S2 §4 T2-5「自评按钮无漏绑」 |
| 多处尾句号 | 只去 1 个 | 全部去掉 | 低风险，规则显式登记 |

## 5. 如何重跑

```bash
pnpm --filter @quiz/core test -- legacy-parity
pnpm build && pnpm check:parity
```

期望：测试全绿；脚本输出「PASS 143/143 原样输入判对；差异全部属于已登记的有意变更」。
