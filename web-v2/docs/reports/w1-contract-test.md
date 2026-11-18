# W1 · 核心契约与校验 测试报告

| 项 | 内容 |
| --- | --- |
| 窗口 | W1 · 核心契约与校验 |
| 分支 | `feat/s7e8-core-contract` |
| 基线 | `s7e8-baseline-20261118` / `40314328` |
| 执行日期 | 2026-11-18 |
| 权威契约 | `web-v2/docs/plans/parallel-contract.md`（只读） |

## 1. P-1 草稿核对（git status）

本范围草稿齐备并纳入版本管理，未重复重写：

| 文件 | 状态 | 处置 |
| --- | --- | --- |
| `packages/core/src/schema.ts` | M | 核对：6 新增可选字段 + items `default([])` + 三个新 Schema，与契约 §1 逐字一致 |
| `packages/core/src/validate.ts` | M | 核对：`validateKnowledgeModules` 错误路径 `knowledge[i].字段`，与契约 §3 一致 |
| `packages/core/src/index.ts` | M | 核对：新 Schema/类型/解析函数全部导出 |
| `packages/core/src/media.ts` | 新增 | 核对：`parseMediaSource` 纯函数、正则实现、无 DOM `URL` |
| `packages/core/src/media.test.ts` | 新增 | 核对：11 种输入逐条断言 |
| `packages/core/src/knowledge.test.ts` | 新增 | 核对：C-1/C-2/B-1/B-2 覆盖 |
| `packages/data/src/snapshot.ts` | M | 核对：`parseBankJson` 已接入 `validateKnowledgeModules`，失败 `value:null` |
| `packages/data/src/snapshot.test.ts` | M | **补 2 条**：C-3 畸形讲义拒收且不写入 |

## 2. 契约一致性复核（与 G0 文本逐项）

| 契约项 | 草稿实现 | 结论 |
| --- | --- | --- |
| §1.2 `KnowledgeModule` 6 新增字段全可选、`items` 缺省 `[]` | `goals/sections/videos/resources/estimatedMinutes/examFocus` 全 optional；`items/pitfalls` 均 `default([])` | ✅ 一致 |
| §1.1 `KnowledgeSection/Video/Resource` | 三 Schema 字段与约束逐字一致，`video.url` 必填 | ✅ 一致 |
| §1.3 `validateKnowledgeModules` 签名与 `{ok,issues,modules}` | 签名一致；语义检查「items 与 sections 不得同时为空」定位 `knowledge[i]` | ✅ 一致 |
| §1.4 `parseMediaSource` 与 `MediaSource` 全字段 | 签名一致；`MediaSource` 8 字段齐全；正则实现无 `URL` | ✅ 一致 |
| §2 行为表 11 种输入 | `media.test.ts` 11 个 it 覆盖 B站完整/裸 BV/av/YouTube 三种/直链/相对路径/m3u8/网页/b23.tv/非法协议/空串 | ✅ 一致 |
| §3 错误码 `[SCHEMA_INVALID] knowledge[i].字段` | `validate.ts` path=`knowledge[i].<zod path>`；snapshot 包装为 `[SCHEMA_INVALID] msg` | ✅ 一致 |

## 3. 执行命令与输出（逐条贴）

```
$ pnpm --filter @quiz/core test
 Test Files  20 passed (20)
      Tests  190 passed (190)   # 含 media.test.ts 11 / knowledge.test.ts 5

$ pnpm --filter @quiz/data test   （补 C-3 用例后）
 Test Files  5 passed (5)
      Tests  38 passed (38)     # snapshot.test.ts 15，含新增 2 条畸形讲义用例

$ pnpm check:boundaries
PASS  边界干净（扫描 56 个 core 源文件，依赖仅 zod）
```

## 4. 验收逐条结果

| 编号 | 标准 | 结果 | 证据 |
| --- | --- | --- | --- |
| C-1 | 旧形态讲义通过、新字段补空数组 | ✅ | `knowledge.test.ts` it#1 |
| C-2 | 空讲义被拒并给 `knowledge[i]` 路径 | ✅ | `knowledge.test.ts` it#4（`knowledge[1]`） |
| C-3 | 畸形讲义包导入被拒且不写入 | ✅ | **本窗口新增** `snapshot.test.ts` 2 条用例 |
| C-4 | 导出→导入恒等 | ✅ | `snapshot.test.ts`「记录逐项一致」「重复导入幂等」 |
| C-5 | 契约变更在 `00` §9 登记 | ⏭ 由 W6 执行 | 本窗口已交付字段清单（本报告 §5） |
| B-1 | 四类 URL 解析正确 | ✅ | `media.test.ts` it#1/2/5/4 |
| B-2 | 非法协议被拒且 reason 可读 | ✅ | `media.test.ts` it#10/11 |
| W1-1 | core/data test 全绿 | ✅ | 190 + 38 |
| W1-2 | check:boundaries 通过 | ✅ | 边界干净 |
| W1-3 | 旧题库包（javaweb+chemistry）不回退 | ✅ | `schema.test.ts` / content chemistry 用例全绿 |

## 5. 交付给 W6 的字段清单（写 ADR 用）

- 新增 6 字段：`goals` / `sections` / `videos` / `resources`（均 `array().default([])`）、`estimatedMinutes` / `examFocus`（均 optional）。
- `items` 由 `min(1)` 放宽为 `default([])`；`pitfalls` 保持 `default([])`。
- `schemaVersion` 建议**不升版**：6 字段全可选 + 默认值，旧数据零迁移、旧文件零改动可读（ADR-0004 的扩展口径）。
- 内容源改为 `lectures/*.md` → 脚本生成 `knowledge.json`；`knowledge.json` 为生成物禁止手改。

## 6. 遗留问题

- 无阻塞项。C-5 由 W6 在 `00` §9 登记，已在 §5 交付字段清单。
- W3 typecheck 依赖本窗口 dist：合并后须立即 `pnpm -r build` 重建 dist 并通知 W2/W3。
