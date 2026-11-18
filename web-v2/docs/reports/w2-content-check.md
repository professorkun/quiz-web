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
