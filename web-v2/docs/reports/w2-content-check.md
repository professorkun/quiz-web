# W2 · 讲义内容生产 检查报告

| 项 | 内容 |
| --- | --- |
| 窗口 | W2 · 讲义内容生产 |
| 分支 | `content/s7e8-lectures` |
| 基线 | `s7e8-baseline-20261118` / `40314328` |
| 执行日期 | 2026-11-18 |
| 权威契约 | `web-v2/docs/plans/parallel-contract.md`（只读） |

## 1. P-1 草稿核对

7 篇讲义草稿 + README + 生成脚本 + knowledge.json + 质量门禁单测齐备，全部纳入版本管理，**未重写正文**：

- `lectures/00-web-base.md` ~ `06-jdbc.md`（7 篇，对应 7 个 topicId）
- `lectures/README.md`、`scripts/build-knowledge.mjs`、`src/knowledge.test.ts`、`javaweb-final/knowledge.json`
- **L-2 冲突已消解**：G0 遗留问题记录"脚本 import @quiz/core 与 W2 定义冲突"，草稿已改为**自带本地校验、不 import @quiz/core**（脚本第 14~17 行注释与实现一致），W2-4 成立。

## 2. 统计（生成脚本实测）

```
讲义 7 篇 / 86 节 / 正文 59.3k 字 / 视频 7 条
篇数 7  节数 86  字数 59281  视频 7 条  moduleId 唯一 true
```

## 3. 执行命令与输出（逐条贴）

```
$ node packages/content/scripts/build-knowledge.mjs   # 独立运行，退出码 0
讲义 7 篇 / 86 节 / 正文 59.3k 字 / 视频 7 条

$ （生成幂等，连续两次 sha256）
before: c558f6ff2a370b1f34eb31647279de97efc94d6130b74581960e46cb04b37a34
after : c558f6ff2a370b1f34eb31647279de97efc94d6130b74581960e46cb04b37a34
幂等: PASS

$ pnpm --filter @quiz/content test
 Test Files  5 passed (5)
      Tests  41 passed (41)   # knowledge.test.ts 12
```

## 4. 验收逐条结果

| 编号 | 标准 | 结果 | 证据 |
| --- | --- | --- | --- |
| A-1 | 7 篇与 7 topicId 一一对应、moduleId 不重复 | ✅ | `knowledge.test.ts` it#1 + 统计 |
| A-2 | 每篇 ≥8 节、≥3000 字、代码块、表格、≥3 目标、≥2 易错点 | ✅ | `it.each` 逐篇断言 |
| A-3 | 每篇含三类指定小节 | ✅ | it「三类小节」 |
| B-6 | 每条讲义 ≥1 可解析视频、全部视频地址通过校验 | ✅ | it「视频地址按契约行为表识别」；7 篇各 1 条 |
| W2-1 | 总正文 ≥50k 字 | ✅ | 59281 字 |
| W2-2 | 生成脚本重跑字节一致 | ✅ | sha256 前后一致 |
| W2-3 | knowledge.json 通过 W1 校验（集成期） | ⏭ | 交 INT 第 6 步用 `validateKnowledgeModules` 复验；本地 `validateLocally` 同语义已过 |
| W2-4 | 脚本不 import @quiz/core，可独立运行 | ✅ | 脚本独立运行退出码 0 |
| W2-5 | 外链标注合集、无未验证精确分集声明 | ✅ | 7 条视频 note 均为"合集/前20集/跳对应集/看后半段"等说明性表述（见 §5） |

## 5. 视频地址逐篇清单（W2-5 抽查）

| 篇 | note | URL |
| --- | --- | --- |
| Web 基础 | 前 20 集 | `https://www.bilibili.com/video/BV1Y7411K7zz` |
| JSP | 跳着看对应集 | 同上（合集） |
| Servlet | 生命周期与转发/重定向对比演示 | 同上（合集） |
| Spring | IOC 最细、AOP 看后半段 | `https://www.bilibili.com/video/BV1Vf4y127N5` |
| SpringMVC | 执行流程与参数绑定有图讲解 | `https://www.bilibili.com/video/BV1Ry4y1574R` |
| MyBatis | 映射文件与动态 SQL 最细 | `https://www.bilibili.com/video/BV1mW411M737` |
| JDBC | 五步流程与 SQL 注入演示直观 | `https://www.bilibili.com/video/BV1eJ411c7rf` |

## 6. 交付给 W6 的登记需求

- 生成脚本路径：`packages/content/scripts/build-knowledge.mjs`
- 脚本已自带 `knowledge:build` 能力（根 `package.json` 已有该 script 草稿，由 W6 确认登记）
- 季度外链巡检清单：7 个 BV 号（见 §5），写入维护说明。

## 7. 遗留问题

- W2-3 需 INT 集成期用 W1 的 `validateKnowledgeModules` 对 `knowledge.json` 复验一次（本地 `validateLocally` 已按同语义通过）。
- 讲义体积增量：JS bundle 影响由 INT/W3 在集成期测量（阈值 ≤150KB）。

---

## 8. 修订（2026-11-18）：视频去题库化

> 用户要求：视频功能不依赖当前题库添加；清理按题库硬编码的视频数据，但保留可扩展入口，
> 方便后续新题库导入后接入。本节为本次修订的权威说明，**与 §5 / §6 冲突处以本节为准**。

### 处置

| 项 | 处置 |
| --- | --- |
| 7 篇讲义 `front matter` 的 `videos:` 及 7 条 BV 号 | **已删除**（每篇恰好 2 行，diff 可审） |
| `knowledge.json` | 已重生成：7 篇 / 86 节 / 59.3k 字 / **视频 0 条**，每篇 `videos: []`，全文无 BV 号 |
| `src/knowledge.test.ts` | A-2 去掉「每篇 ≥1 视频」硬断言，改为「videos 允许为空、必须是数组」；B-6 改为「填了才逐条校验可解析」 |
| `lectures/README.md` | front matter 示例去掉具体链接；新增「视频是可选扩展位」章节，列明五层已保留入口与新题库接入方法 |
| 生成脚本 / core Schema / VideoCard / parseMediaSource | **未改动**，全部保留（这是扩展入口，不能删） |

**§5 的视频清单与 §6 的「季度外链巡检清单：7 个 BV 号」即刻作废**，不再有外链需要巡检。

### 保留的五层扩展入口（新题库接入无需改代码）

1. `KnowledgeVideoSchema`（W1 `core/src/schema.ts`）：`url` 必填 + 可选 title/note/startSec
2. `parseMediaSource`（W1 `core/src/media.ts`）：B站/YouTube/直链/HLS/网页/非法协议
3. `parseTriples(meta.videos, …)`（W2 `scripts/build-knowledge.mjs`）：留空→`[]`，填了→校验
4. 质量门禁（W2 `src/knowledge.test.ts`）：允许空、填了才校验
5. `VideoCard`（W3）：按 `kind` 分支渲染；`videos: []` 时不渲染视频区，正文照常可读

新题库接入只需在其讲义 `front matter` 填 `videos: - 标题 | 地址 | 说明` 并重跑生成脚本。

### 重新验证（修订后实测）

```
$ node packages/content/scripts/build-knowledge.mjs
讲义 7 篇 / 86 节 / 正文 59.3k 字 / 视频 0 条
$ pnpm --filter @quiz/core build && pnpm --filter @quiz/platform build   # 隔离 worktree 补 dist
$ pnpm --filter @quiz/content test
 Test Files  5 passed (5)
      Tests  41 passed (41)
$ 生成两次 sha256 一致 → 幂等 PASS
```

> 注：隔离 worktree 内首次跑 content 测试曾报 `@quiz/core` 无法解析，原因是缺构建产物 dist
> （按矩阵 dist 不提交），补 `pnpm --filter @quiz/core build` 后全绿；非本次改动引入。

---

## 8. S7-E9 收尾批次 · T-1 修复（2026-11-18）

| 项 | 内容 |
| --- | --- |
| 任务 | S7-E9 P0 · T-1：修 `chemistry.ts` TS2322 |
| 分支 | `content/s7e8-lectures`（HEAD `902aae3`） |
| 上位文档 | `项目规划/任务窗口/S7-E9-收尾任务分配方案.md` §2 硬约束 |

### 8.1 问题与修复

**病灶**：`src/banks/chemistry.ts` 约 278 行 `KNOWLEDGE.map((m) => ({ ...m, items: …, pitfalls: […] }))` 只补了 `items`/`pitfalls`，缺 W1 契约的四个 Zod 输出必填字段（`.default([])` 只作用于解析输入，直接构造类型对象必须显式给出）：

| 字段 | 修复 | 说明 |
| --- | --- | --- |
| `goals` | `goals: []` | 学习目标；化学题库暂无讲义正文，留空 |
| `sections` | `sections: []` | 精读正文小节；同上 |
| `videos` | `videos: []` | **视频可选扩展位，留空是合法形态**——不回填任何题库专属视频链接 |
| `resources` | `resources: []` | 拓展阅读；同上 |

**修法**：统一在 `KNOWLEDGE.map` 里补四个空数组（一处改动覆盖三篇），附注释说明契约依据。未改 `core/schema.ts`、未改契约、未改其它题库文件。

### 8.2 验证实测

```
$ sed -i 's/\r$//' web-v2/packages/content/javaweb-final/lectures/*.md   # CRLF 防御（实际无操作）
$ pnpm --filter @quiz/core build                                          # 补 dist ✓
$ pnpm typecheck                                                          # 全 workspace
packages/core Done / packages/content Done / packages/platform Done
packages/platform/web Done / packages/data Done / apps/web Done
→ EXIT 0（chemistry.ts TS2322 消除）

$ pnpm --filter @quiz/content test
 Test Files  5 passed (5)
      Tests  41 passed (41)                                                # 41/41 全绿

$ node packages/content/scripts/build-knowledge.mjs   (两次)
讲义 7 篇 / 86 节 / 正文 59.3k 字 / 视频 0 条
sha256 b6b0b2abd10bfb5c6f65b8ed7258d8703036e33f681930b449db7e82981b70c7  (前后一致)
→ BYTE-IDENTICAL

视频计数：0 条  |  BV 号残留：0  |  总正文：59,281 字（≥50k ✓）
```

### 8.3 红线遵守

- **未回填任何视频链接**：`knowledge.json` 视频数 0，全文无 BV 号。
- **未改 core/schema.ts**：core/src 工作区干净（`git status packages/core/` 为空）。
- **未改其它题库文件**：唯一源码改动是 `chemistry.ts` 的四个空数组。
- **只改 w2- 前缀报告文件**：本文件为追加。

### 8.4 改动文件清单

| 文件 | 改动 |
| --- | --- |
| `packages/content/src/banks/chemistry.ts` | +6 行：四个空数组 + 注释（在 `KNOWLEDGE.map` 内） |
| `docs/reports/w2-content-check.md` | 追加本节（§8） |

### 8.5 遗留问题

1. **W1 契约源与 content 分支 src 未同步**：`core/src/schema.ts`（content 分支）缺讲义契约扩展（goals/sections/videos/resources/parseMediaSource/validateKnowledgeModules），这些在 `feat/s7e8-core-contract`。本轮 dist 由 W1 契约源临时构建后还原 src，**T-4 INT 串行合并 W1 后 src/dist 即自然对齐**。
2. `core/dist/media.js` 有一个 sourcemap 指向缺失源文件的警告（临时构建的副作用），不影响编译与测试；W1 合并后重建 dist 自然消失。
