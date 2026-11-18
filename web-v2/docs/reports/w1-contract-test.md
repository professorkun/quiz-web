# W1 · 核心契约与校验 测试报告

| 项 | 内容 |
| --- | --- |
| 窗口 | W1 · 核心契约与校验 |
| 分支 | `feat/s7e8-core-contract` |
| 基线 | `s7e8-baseline-20261118` / `4031432` |
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
| `packages/core/src/media.test.ts` | 新增 | 核对：11 种输入逐条断言；**本轮补 7 条**行为表边界（分集参数/options.page、YouTube 短 id、b23.tv provider、page.html、vbscript/file、空串与全空白、javascript 零可渲染地址） |
| `packages/core/src/knowledge.test.ts` | 新增 | 核对：C-1/C-2/B-1/B-2 覆盖 |
| `packages/data/src/snapshot.ts` | M | 核对：`parseBankJson` 已接入 `validateKnowledgeModules`，失败 `value:null` |
| `packages/data/src/snapshot.test.ts` | M | 补 2 条：空壳讲义拒收、knowledge 非数组拒收 |
| `packages/data/src/snapshot-knowledge.test.ts` | 新增 | **本轮补 6 条**：C-3 缺 url 视频整包拒收 + 导入前后仓储无变化、C-4 讲义往返恒等（篇数/节数/字节）、W1-3 旧形态讲义 + 无 knowledge 旧包 + chem 题库 |

> **证据更正（本轮重要修订）**：原报告把 C-4 的证据指向 `snapshot.test.ts`「记录逐项一致」「重复导入幂等」，
> 但那两条用例测的是**学习记录**（attempts/favorites）往返，fixture 的 `knowledge: []`，并未证「讲义篇数与小节数不变」；
> C-3 原有两条用例分别是「空壳讲义」「knowledge 非数组」，也未覆盖判据点名的「含非法视频字段」。
> 二者均属「宣称通过但证据不支撑」，本轮以 `snapshot-knowledge.test.ts` 补实证并逐条对齐判据。

## 2. 契约一致性复核（与 G0 文本逐项）

| 契约项 | 草稿实现 | 结论 |
| --- | --- | --- |
| §1.2 `KnowledgeModule` 6 新增字段全可选、`items` 缺省 `[]` | `goals/sections/videos/resources/estimatedMinutes/examFocus` 全 optional；`items/pitfalls` 均 `default([])` | ✅ 一致 |
| §1.1 `KnowledgeSection/Video/Resource` | 三 Schema 字段与约束逐字一致，`video.url` 必填 | ✅ 一致 |
| §1.3 `validateKnowledgeModules` 签名与 `{ok,issues,modules}` | 签名一致；语义检查「items 与 sections 不得同时为空」定位 `knowledge[i]` | ✅ 一致 |
| §1.4 `parseMediaSource` 与 `MediaSource` 全字段 | 签名一致；`MediaSource` 8 字段齐全；正则实现无 `URL` | ✅ 一致 |
| §2 行为表 11 种输入 + 补充边界 | `media.test.ts` 18 个 it：11 行逐条 + 边界（B 站无 BV、YouTube 短 id、page.html、既不是…）全覆盖 | ✅ 一致 |
| §3 错误码 `[SCHEMA_INVALID] knowledge[i].字段` | `validate.ts` path=`knowledge[i].<zod path>`；snapshot 包装为 `[SCHEMA_INVALID] msg` | ✅ 一致 |

## 3. 执行命令与输出（逐条贴）

```
$ pnpm --filter @quiz/core test
 ✓ src/media.test.ts (18 tests)
 ✓ src/knowledge.test.ts (5 tests)
 Test Files  20 passed (20)
      Tests  197 passed (197)   # 原 190 + 本轮 media 补 7

$ pnpm --filter @quiz/data test
 ✓ src/snapshot.test.ts (15 tests)
 ✓ src/snapshot-knowledge.test.ts (6 tests)   # 本轮新增
 Test Files  6 passed (6)
      Tests  44 passed (44)     # 原 36 + snapshot.test.ts 补 2 + snapshot-knowledge 补 6

$ pnpm --filter @quiz/content test   （W1-3 旧题库不回退）
 ✓ src/banks/chemistry.test.ts (7 tests)
 ✓ src/cross-bank-exam.test.ts (5 tests)
 ✓ src/javaweb-template.test.ts (7 tests)
 ✓ src/migrate.test.ts (10 tests)
 Test Files  4 passed (4)
      Tests  29 passed (29)

$ pnpm check:boundaries
PASS  边界干净（扫描 56 个 core 源文件，依赖仅 zod）

$ pnpm --filter @quiz/core build   （typecheck + 产 dist）
$ pnpm --filter @quiz/data build
（均退出码 0，无 TS 错误）
```

## 4. 验收逐条结果

| 编号 | 标准 | 结果 | 证据（本轮对齐判据） |
| --- | --- | --- | --- |
| C-1 | 旧形态讲义通过、新字段补空数组 | ✅ | `knowledge.test.ts` it#1；`snapshot-knowledge.test.ts`「旧形态讲义与无讲义旧包」断言 sections/videos/goals 补 `[]`、estimatedMinutes/examFocus 留空 |
| C-2 | 空讲义被拒并给 `knowledge[i]` 路径 | ✅ | `knowledge.test.ts` it#4（`knowledge[1]`）；`snapshot-knowledge.test.ts` 空壳讲义定位 `knowledge[2]` |
| C-3 | **含非法视频字段**的题库包导入被拒，且不写入任何数据 | ✅ | `snapshot-knowledge.test.ts`：缺 url 的视频 → 整包拒收 `value:null`，路径 `knowledge[1].videos.0.url`；另一条断言导入前后 `platform.exportAll()` 不变 |
| C-4 | 导出→再导入恒等，**讲义篇数与小节数不变** | ✅ | `snapshot-knowledge.test.ts`：2 篇讲义 / 3 节 + 2 节往返后篇数节数不变，且二次导出字节与首次一致（`text2 === text1`） |
| C-5 | 契约变更在 `00` §9 登记 | ⏭ 由 W6 执行 | 本窗口已交付字段清单（本报告 §5） |
| B-1 | 四类 URL 解析正确 | ✅ | `media.test.ts`：B 站完整/裸 BV/av 号/YouTube 三种写法 |
| B-2 | 非法协议被拒且 reason 可读 | ✅ | `media.test.ts`：javascript/data/vbscript/file 均 invalid 且 reason 可读；空串 reason「视频地址为空」 |
| W1-1 | core/data test 全绿 | ✅ | 197 + 44（退出码 0） |
| W1-2 | check:boundaries 通过 | ✅ | 边界干净（core 无 DOM/React/网络依赖） |
| W1-3 | 旧题库包（javaweb+chemistry）不回退 | ✅ | content 包 29 全绿（含 chemistry 7）；`snapshot-knowledge.test.ts` chem 题库 + 旧形态讲义 + 无 knowledge 旧包导入均通过 |

## 5. 交付给 W6 的字段清单（写 ADR 用）

- 新增 6 字段：`goals` / `sections` / `videos` / `resources`（均 `array().default([])`）、`estimatedMinutes` / `examFocus`（均 optional）。
- `items` 由 `min(1)` 放宽为 `default([])`；`pitfalls` 保持 `default([])`。
- 新增 Schema：`KnowledgeSectionSchema`（title+body）、`KnowledgeVideoSchema`（url 必填 + title/note/startSec 可选）、`KnowledgeResourceSchema`（title+url 必填 + note 可选）。
- 新增导出：`parseMediaSource` / `MediaKind` / `MediaSource`、`validateKnowledgeModules` / `KnowledgeValidateResult`。
- `schemaVersion` 建议**不升版**：6 字段全可选 + 默认值，旧数据零迁移、旧文件零改动可读（ADR-0004 的扩展口径）。
- 内容源改为 `lectures/*.md` → 脚本生成 `knowledge.json`；`knowledge.json` 为生成物禁止手改。

## 6. 遗留问题

- 无阻塞项。C-5 由 W6 在 `00` §9 登记，已在 §5 交付字段清单。
- W3 typecheck 依赖本窗口 dist：合并后须立即 `pnpm -r build` 重建 dist 并通知 W2/W3。
- **共享 worktree 风险实录（K-02 兑现）**：本轮执行中，`core/data` 契约草稿一度在工作区「消失」，
  查因是多窗口共用 `F:/001/刷题` 且 HEAD 被切到 W5 分支（`git checkout` 把本窗口文件从工作区移走）。
  草稿本身已在 `feat/s7e8-core-contract` 提交（`7924a88`）中，未丢失。
  建议后续窗口按 G0 §2 用 `git worktree` 各占一目录，避免 checkout 互踩。
