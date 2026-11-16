# ADR-0003 · 可复现洗牌与练习会话快照

- 状态：**S2 实施基线**（2026-11-16 定稿并落地；阶段验收时由项目负责人确认）
- 日期：2026-11-16
- 相关：`项目规划/03-S2-题型系统与练习引擎.md` §3 / T2-6 / T2-7、ADR-0001、ADR-0002、`_build/template.html:408`（旧 `shuffle`）、`:410`（旧 `withOpts`）、`:1661`（旧 `selOrigin` 找回）

---

## 背景

旧版把"顺序"和"答案"焊在了一起，这是本次通用化要修的最脆弱一环：

```js
// 旧 withOpts：把选项打乱后重新编号成 A/B/C/D，并把正确答案改写为新字母
options: arr.map((o,i)=>({key:KEYS[i], text:o.text, origin:o.key})),
answer:  pos>=0 ? KEYS[pos] : q.answer
```

三个具体后果：

1. **答案存的是展示字母**。`S.ans["c"+idx] = "B"`。字母是洗牌结果的产物，不是题目身份。
2. **选项顺序不可复现**。`shuffle()` 用 `Math.random()`，没有种子。旧版为补救，在续刷进度里额外存了 `selOrigin`（原始标号）来找回"当时选的那项"（`:1661`），并在快照里存了整份打乱后的 `items`——本质是靠"把结果整个存下来"绕过了不可复现，而不是解决它。
3. **题序同样不可复现**。`startDrill()` 直接 `shuffle(pool)`，快照里存的是打乱后的题目对象副本；一旦题库内容更新，快照里的旧题目对象与题库新版本会悄悄分叉，且没有任何冲突提示。

S2 的验收场景 1 要求"刷新后题序、选项顺序、已答状态 100% 一致"，场景 4 要求"题目 `revision` 变化时有明确提示"。这两条不能靠"多存一份副本"混过去，得先把随机性变成可重放的纯函数。

同时受 ADR-0002 约束：`core` 不能碰 `Math.random()` 之外的运行时环境差异（时间、DOM、IO 都不能成为隐含输入），否则 Node 下无法复现；也不允许出现 `crypto`、`Date.now()` 这类不可注入的随机/时间源。

## 决策

### 1. PRNG：mulberry32，纯函数，注入种子

```ts
function rngFrom(seed: number): () => number  // 32 位无符号，无内部状态泄漏到全局
function shuffleWith<T>(items: readonly T[], rng: () => number): T[]  // Fisher-Yates，从后往前
```

用 Fisher-Yates「从后往前」是刻意与旧版 `shuffle()` 同形，便于逐条对照行为；区别只在于随机源由 `Math.random()` 换成注入的 `rng`。**`core` 不生成种子**：种子由调用方（Web 端用 `crypto.getRandomValues`）生成后传入，Node 测试直接给常量。

### 2. 派生子种子：按用途分流

一次练习里有多处要洗牌（题序、每题选项序）。若共用一个 rng 流，前面多消耗一次随机数，后面所有结果都会漂移——加一道题就会让全卷选项顺序全变，回归用例无法稳定。

```ts
deriveSeed(masterSeed, namespace)  // FNV-1a(namespace) 混入 masterSeed
// 命名空间：
//   "qorder:<bankId>:<mode>"      题序
//   "opts:<questionId>"           每题选项序
```

每条用途一条独立子流，互不干扰；某题的选项顺序只由 `masterSeed + questionId` 决定，与题序、与其它题都无关。

### 3. 洗牌范围与展示字母

- 只洗 `single_choice` / `multiple_choice` 的 `options`；`true_false` 是布尔题，固定「正确 / 错误」两项，**不洗**（让"√ 在左边还是右边"变成记忆点没有意义）。
- 洗牌结果存 `optionId[]`（`optionOrder`）。A/B/C/D 由**下标即时生成**，只用于展示，永不写回 `answer`、永不进入作答记录。
- 判分只看 `optionId`，与 `optionOrder` 完全无关——这是 T2-2 的判据，也是 ADR 的硬约束。

### 4. 会话快照：种子与实际顺序都存，恢复以实际顺序为准

`SessionSnapshot`（`sessionVersion: 1`）同时保存：

| 字段 | 作用 |
| --- | --- |
| `seed` | 审计与"再来一组"时复现；**不作为恢复的唯一真源** |
| `questionIds` | 实际题序 |
| `optionOrders` | 每题实际的 `optionId` 顺序 |
| `answers` | 每题作答（`optionId` / `optionId[]` / 文本 / 逐空文本，绝无展示字母） |
| `selfRatings` | 简答自评档位，与 `answers` 分开存 |
| `questionRevisions` | 建会话时每题的 `revision`，用于恢复时冲突检测 |
| `cursor` / `results` | 当前位置与已答结果 |

**为什么不全靠种子重放**：题库会增题、改解析、升 `revision`。只存种子的话，重放会把同一串随机数作用到一份已经不同的题集上，题目与答案静默错位——正是 ADR-0001 要消灭的那类错误。存实际顺序后，恢复是"把快照原样读回来"，随机性只发生在新会话创建那一次。

代价要说清楚：快照体积随题数线性增长（147 题约几十 KB，可接受），且种子不再是唯一真源。这是用空间换"内容更新后不静默错位"，值。

### 5. 版本与冲突

- `sessionVersion` 必填。无法识别的版本 → 明确提示「会话已过期，重新开始」，但**已完成记录保留**，不静默清空、不崩溃（S2 §9 回退方案 2）。
- 恢复时逐题比对 `questionRevisions[qid]` 与当前题库 `revision`：不一致的题标记 `conflict`，该题按新版本重新作答并提示「该题已更新」；其余题、其它已完成记录原样保留（验收场景 4）。

## 后果

**正面**：刷新后 100% 一致；同一种子两次生成逐项相同且可在 Node 下断言；题库内容更新不再静默错位；新增题型不需要动这套机制。

**负面 / 需接受**：快照随题数变大；不能靠种子"重放"出旧题序；`core` 里多了一层种子派生逻辑，需要一个明确定义的字符串哈希（复用 S1 已有的 FNV-1a，不引入新算法）。

**明确不做**：不加密快照、不云同步（S6）、不做跨题库会话（S3）、不把种子写进 URL。

## 如何判定成功（三条可执行检查）

1. 同一 `seed` 调用两次 `createSession`，`questionIds` 与 `optionOrders` 逐项相同；不同 `seed` 产生不同题序。
2. 交换某多选题 `options` 的输入顺序、或改变 `optionOrder`，`grade()` 结果不变；作答记录里搜不到 `"A"` / `"B"` 这类展示字母。
3. 快照序列化 → 反序列化后，`cursor`、`answers`、`optionOrders`、每题结果逐项一致；把其中一题的 `revision` 改掉再恢复，只有该题被标记 `conflict` 且重置作答，其余已完成记录不变。

> 三条分别固化为 `packages/core/src/practice/*.test.ts` 中的回归用例，验收时按测试名引用，不接受"应该没问题"。
