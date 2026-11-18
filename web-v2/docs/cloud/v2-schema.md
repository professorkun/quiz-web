# V2 云表结构与契约映射（S6 · T6-1）

> 交付物：本说明 + [`v2-schema.sql`](./v2-schema.sql) + 字段对齐证据 `packages/data/src/cloud/schema-map.test.ts`。
> 判据：**表可写可查、字段与 `core` 契约一致**。前半（字段一致）已用测试锁死；后半（可写可查）待云表建成后核验。

---

## 1. 五表 ↔ core 契约

| V2 表 | core 契约 | 幂等键（重复写入不重复） | 语义 |
| --- | --- | --- | --- |
| `attempts` | `Attempt` | `attempt_id` | 答题事件，**只追加**，不可变 |
| `question_progress` | `QuestionProgress` | `(owner_id, bank_id, question_id)` | 学习进度，**派生可覆盖**，可由 attempts 重算 |
| `practice_sessions` | `PracticeSession` | `(owner_id, bank_id)` | 续刷/复习会话，**一人一题库一份** |
| `exam_records_v2` | `ExamRecord` | `record_id` | 模考成绩，**只增不改**，仅 `selfRating` 可改 |
| `user_preferences` | `AppSettings` + `FavoriteEntry[]` | `owner_id` | 用户偏好 + 收藏，**一人一行 upsert** |

字段对齐规则：**顶层 1:1 落列**（camelCase → snake_case），**嵌套整块进 JSONB**（`answer`/`items`/`practice`/`results`/`questionIds`/`favorites` 原样存取）。
机器校验：`coreFieldCoverageGaps()` 为空 = 不丢任何 core 顶层字段；`schema-map.test.ts` 10 断言全绿。

---

## 2. 云端目标（关键前提，先说清）

- **V2 五表建在本项目应用 `wbapp_g64vX7uZdYwdm0BJTVINDk` 的云端**（工作区唯一可操作的云；`genie-baas` 工具只认这个应用）。
- **旧版四表**（`wrong_questions`/`quiz_mastery`/`exam_records`/`drill_progress`）在**另一个云端** `wbapp-x4curlcgbt2kilpzdqg6lh`（旧版线上真实在用，T0-10 已实测）。
- 因此 **迁移是跨云的**：旧云数据「导出 → 转换 → 幂等写入 V2」，旧云表保持**只读备份**，本脚本与后续脚本**绝不写旧云**。

> ✅ **已确认（2026-11-18）**：采用本项目应用的 WorkBuddy 云（已开通）。旧云保持不动作只读备份，迁移走**跨云**（导出 → 幂等写入 → 对账）。方案目标不变，仅"同库"这个实现细节变为"跨云"。

---

## 3. 旧云 → V2 迁移映射（供 T6-5/T6-6）

| 旧云表 | 旧字段要点 | → V2 表 | 转换 / 风险 |
| --- | --- | --- | --- |
| `wrong_questions` | `q_key, q_type, wrong_count, last_wrong_at` | `attempts`（+ 进度重算） | `q_key` → `legacyKey` 反查稳定 `questionId`；`wrong_count` 累加为计数；**云端 `stem` 是占位文本，丢弃**（T0-8 §7） |
| `quiz_mastery` | `q_key`（"做对过"，无时间） | `question_progress` | 只有事实无时间线 → `first_correct_at: null`，`imported_from='mastery'` |
| `exam_records` | `id, total, obj_score, detail:{items:[{k,s}]}` | `exam_records_v2` | `detail.items[].k`→题键、`s`→得分；**无逐题作答原文**（旧数据本就没有，不承诺） |
| `drill_progress` | `kp, q_type, q_keys[], idx, res, total` | `practice_sessions` | `q_keys[]`→`question_ids`；`res` 位串编码待确认（T0-8 §8） |
| `localStorage["jw_drill_progress_v1"]` | 同上（未登录本地进度） | `practice_sessions` | 与游客合并逻辑一并处理（T6-7/T6-8） |

迁移产物一律打 `imported_from` 标记，让"这条是推断/迁移来的"一眼可见，不冒充真实作答。

---

## 4. 幂等与冲突（T6-4 同步层据此实现）

| 表 | 写入语义 | 冲突规则 |
| --- | --- | --- |
| `attempts` | insert，同 `attempt_id` **跳过** | 事件只追加，无覆盖；重放安全 |
| `exam_records_v2` | insert，同 `record_id` **跳过** | 只增不改；`selfRating` 单字段 UPDATE（走 core 纯函数变换） |
| `question_progress` | upsert | 派生数据，可重算覆盖；以 `updated_at` 新者为准 |
| `practice_sessions` | upsert on `(owner_id, bank_id)` | 一人一份，`updated_at` 新者胜 |
| `user_preferences` | upsert on `owner_id` | 偏好可覆盖；`favorites` 合并去重（按 `bankId+questionId`） |

**幂等 ID**：`attempts` 用稳定 `attemptId`、`exam_records_v2` 用 `recordId`（迁移时由旧 ID 派生稳定 ID，不随机生成）——这是 runbook §5 步骤 5「重复执行不产生重复行」的落点。

---

## 5. WAF 约束（S6 §3，硬约束）

请求/落库**只含题目 ID 与作答结果**，**不含题干/代码正文**（旧版网关会拦代码正文，T0-8 §7-1）。
`schema-map.test.ts` 有一条断言：五表列名里**没有** `stem`/`code`/`explanation`/`solution_code`/`blank_code`。真实题干靠 `questionId` 回查题库还原。

---

## 6. 两个设计决策（请知悉，可否决）

1. **收藏 `favorites` 收进 `user_preferences`**（JSONB 数组）：方案限定**五表**，而收藏（S3 引入，独立于错题/进度）需要随同步走。放 `user_preferences` 与 `progress` **分列**，杜绝"进度重算带走收藏"的旧 bug（core 注释里的教训）。若你更想要独立第六表 `favorites`，属容差外改动，需登记——但改起来是空表重列，代价小。
2. **时间戳存 `TIMESTAMPTZ`**：利于增量读取（runbook 步骤 4 按时间戳取增量）与时区稳健；core 里的 ISO 串由同步层（T6-4）做 `toISOString()` ↔ `timestamptz` 转换。字段"一致"落在名称与语义层（`schema-map` 校验项）。

---

## 7. 本阶段边界

- **本脚本不含 RLS**：RLS 是 **T6-2**（`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`，用户隔离 + 显式拒绝 `anon`）。本脚本的 `GRANT` 只给 `authenticated`，已把 `anon` 排除。
- **不改旧表**：旧云四表只读备份，稳定后再决定是否清理。
- **不做 NAS 备份、不新增功能**：一律进 S7。

---

## 8. 完成判据对照（T6-1 / T6-2，2026-11-18 已在 WorkBuddy 云部署）

| 判据 | 状态 | 证据 |
| --- | --- | --- |
| 字段与 core 契约一致 | ✅ | `schema-map.test.ts` 10 断言（字段覆盖/幂等键/嵌套保真/WAF） |
| 表可写可查 | ✅ | 云库五表建成；INSERT→SELECT 读回字段一致 |
| 五表 RLS + 用户隔离 | ✅ | `list_tables` RLSOn=true×5；`pg_policies` 20 条 roles={authenticated}；模拟 A/B：A 见 1 / B 见 1 / 总 2 |
| 匿名显式拒绝（非"默认查不到"） | ✅ | 云默认给 anon SELECT → 已 `REVOKE`；anon 对五表**零权限** → 访问 42501 |
| 不修改旧表 | ✅ | 旧云 `wbapp-x4curlcgbt2kilpzdqg6lh` 全程未触碰 |

> 云环境：本项目应用 `wbapp_g64vX7uZdYwdm0BJTVINDk` 已开通，endpoint `https://wbapp-g64vx7uzdywdm0bjtvindk.app.workbuddy.host`。后续 T6-3（认证适配器）/ T6-4（同步层）在此之上接应用。
