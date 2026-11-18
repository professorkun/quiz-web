# W0 · G0 契约冻结门禁报告

| 项 | 内容 |
| --- | --- |
| 门禁 | G0（串行前置，先于所有窗口完成） |
| 执行分支 | `integrate/s7-e8` |
| 执行日期 | 2026-11-18 |
| 基线 tag | `s7e8-baseline-20261118`（annotated） |
| 基线 commit | `40314328d9b8ae6910c9f58d0bf20043039af381` |
| 基线 commit 内容 | 仅 `docs/plans/parallel-contract.md`、`docs/plans/window-board.md`（326 行），**不含任何草稿、源码、package.json** |
| 提交信息 | `docs(s7e8-g0): 冻结 S7-E8 并行契约与窗口状态看板` |

---

## 1. 决断结论（G0-1）

| 编号 | 结论 | 决策人 | 日期 |
| --- | --- | --- | --- |
| P-1 | **保留草稿**：草稿不撤销、不重写、不覆盖；纳入版本管理后按验收标准补验证 | 用户 | 2026-11-18 |
| P-2 | **先按 A**：题库页内精读区；`router.ts` / `App.tsx` / `ui/AppShell.tsx` 三方冻结 | 用户 | 2026-11-18 |

两项均已写入 `docs/plans/parallel-contract.md` 第 0 节，含决策人与日期。

## 2. 草稿核对结果（git status 摘要，P-1）

打基线 tag 前已执行 `git status` 核对，保留草稿齐备（共 43 项改动/新增，均为未提交状态，随共享工作区流转到各窗口分支，由各窗口自行纳入版本管理）：

| 窗口范围 | 草稿条目数 | 代表文件 |
| --- | --- | --- |
| W1（core/data） | 12 | `core/src/schema.ts` `validate.ts` `index.ts` `media.ts`、`knowledge.test.ts` `media.test.ts`、`data/src/migrate-v2.ts` |
| W2（content） | 5 | `javaweb-final/lectures/`（7 篇 + README）、`scripts/build-knowledge.mjs`、`knowledge.json` |
| W3（knowledge/banks/styles/AppShell） | 4 | `features/knowledge/`、`BanksPage.tsx`、`styles.css`、`ui/AppShell.tsx` |
| W5（cloud/.github/public/07） | 5 | `apps/web/src/cloud/`、`docs/cloud/`、`.github/`、`public/`、`项目规划/07` |
| W6（文档/package） | 7 | `项目规划/00`、`13`、`14`、多个 `package.json`、`pnpm-lock.yaml` |

**处置方式**：G0 不替任何窗口提交草稿。基线 tag 只含契约文本，草稿以未提交形态保留在 `integrate/s7-e8` 工作区，各窗口从基线建分支后第一件事是核对并纳入自己的版本管理。

## 3. 分支清单（G0-4 / G0-5）

六个窗口分支**全部从同一基线 commit `40314328` 创建**（`git rev-list -n1` 逐一比对通过，分支名去重计数 = 6），满足 G0-4。集成分支 `integrate/s7-e8` 在基线之上承载了本 G0 冻结报告 commit，故其 HEAD 前进一步，属预期：

| 窗口 | 分支名 | 指向 commit | 说明 |
| --- | --- | --- | --- |
| W1 | `feat/s7e8-core-contract` | `40314328` | ✅ 基线 |
| W2 | `content/s7e8-lectures` | `40314328` | ✅ 基线 |
| W3 | `feat/s7e8-lecture-ui` | `40314328` | ✅ 基线 |
| W4 | `fix/s7e8-ui-consistency` | `40314328` | ✅ 基线 |
| W5 | `chore/s6-closeout` | `40314328` | ✅ 基线 |
| W6 | `docs/s7e8-integration` | `40314328` | ✅ 基线 |
| INT | `integrate/s7-e8` | 基线 + G0 报告 commit | 集成分支，本门禁冻结报告在其上；后续各窗口合并入此 |

## 4. 广播对象与时间

| 项 | 内容 |
| --- | --- |
| 广播时间 | 2026-11-18（本门禁完成后） |
| 广播渠道 | 本报告 + `docs/plans/` 契约文件 + 逐窗口启动提示词（14 号 §4） |
| 广播对象 | W1、W2、W3、W4、W5、W6、INT（共 7 个窗口） |
| 广播内容 | ① 契约文本路径 `web-v2/docs/plans/parallel-contract.md`（只读）；② 14 号 §3 所有权矩阵；③ 各窗口分文件编号与分支名；④ P-1/P-2 已决结论；⑤ 基线 tag 与 commit；⑥ 契约变更单流程 |
| 各窗口分文件编号 | W1→`W1-核心契约与校验.md`、W2→`W2-讲义内容生产.md`、W3→`W3-讲义阅读与视频界面.md`、W4→`W4-既有页面一致性.md`、W5→`W5-S6上线收尾.md`、W6→`W6-文档ADR与集成登记.md`、INT→`INT-整体集成验证.md`（均在 `项目规划/任务窗口/`） |

> 说明：本环境为单窗口串行上下文，无独立并行进程可投递消息；上述"广播"以冻结文件 + 本报告 + 14 号 §4 可直接复制的启动提示词落地，各窗口开工时按 §4 提示词读取契约即视为收到。若后续启用真正并行的独立窗口，需将本节内容逐条投递并留存确认回执。

## 5. 验收标准逐条结果（G0-1 ~ G0-6）

| 编号 | 标准 | 结果 | 证据 |
| --- | --- | --- | --- |
| G0-1 | P-1/P-2 书面结论写入契约第 0 节 | ✅ | 契约 §0.1/§0.2，含决策人「用户」与日期 2026-11-18 |
| G0-2 | 七项齐全、TS 签名可直接抄 | ✅ | 契约 §1~§6 覆盖七项；签名取自草稿 `schema.ts`/`media.ts`/`validate.ts` 逐字对齐 |
| G0-3 | 行为表覆盖 11 种 URL，每行含 kind 与 watchUrl | ✅ | 契约 §2 表恰 11 行（脚本核验 `grep -c '^| N |' = 11`），每行有 kind、watchUrl、附加断言 |
| G0-4 | 六分支名唯一且同一基线 commit | ✅ | `git rev-list -n1` 六分支均 = `40314328`；去重计数 6 |
| G0-5 | 所有权矩阵与 14 号 §3 逐行一致，无文件被两窗口认领 | ✅ | 契约 §5.1 与 14 号 §3 逐行相同（16 行 + 3 纪律） |
| G0-6 | 基线与分支信息写入报告，六窗口均收到契约路径 | ✅ | 本报告 §2/§3/§4 留痕 |

## 6. 遗留问题（交下游裁决，G0 不越权处置）

| # | 问题 | 涉及窗口 | 说明 |
| --- | --- | --- | --- |
| L-1 | `apps/web/src/ui/AppShell.tsx` 存在改动草稿，但 P-2 已决 A 要求三方（router/App/AppShell）全线冻结 | W3 / W4 / INT | G0 不删草稿、不改代码。请 INT 集成时确认该草稿改动是否属 P-2 前的旧改动；若为路由相关，须按契约变更单处理 |
| L-2 | `build-knowledge.mjs` 草稿 `import { validateKnowledgeModules } from "@quiz/core"`，与 W2 定义"脚本自带校验、不 import core（避免等 W1 的 dist）"冲突 | W2 / W1 | G0 契约 §4 按草稿如实冻结 front matter 规则；W2 启动时须抉择：保留 import（依赖 W1 先合）或改为脚本内联校验，并自洽于验收 |
| L-3 | `packages/platform/web/src/**`（`index.ts` `repositories.ts`）有草稿改动，14 号 §3 所有权矩阵未明确覆盖该路径 | W4 / W6 / INT | 建议 INT 在集成前明确归属（大概率随云同步归 W5 或平台层单列），避免合并时无人认领 |
| L-4 | 根目录既有文档（`项目规划/00`、`07`、`13`、`14`、多个 `package.json`、`pnpm-lock.yaml`）均有未提交改动草稿 | W5 / W6 | 属 P-1 保留范围，G0 未触碰；W5/W6 按各自白名单纳入版本管理，勿重复重写 |

---

## 7. 完成回执（交回 INT）

```
门禁：G0
基线 tag / commit：s7e8-baseline-20261118 / 40314328d9b8ae6910c9f58d0bf20043039af381
P-1 结论：保留草稿（已定 2026-11-18）
P-2 结论：先按 A · 题库页内精读区，路由冻结（已定 2026-11-18）
草稿核对结果（git status 摘要）：43 项改动/新增，W1=12 W2=5 W3=4 W5=5 W6=7，全部未提交、随工作区保留
契约文本路径：web-v2/docs/plans/parallel-contract.md
六个分支名：feat/s7e8-core-contract、content/s7e8-lectures、feat/s7e8-lecture-ui、fix/s7e8-ui-consistency、chore/s6-closeout、docs/s7e8-integration
G0-1 ~ G0-6 逐条结果：全部 PASS（详见 §5）
遗留问题：L-1 AppShell 冻结冲突、L-2 生成脚本 import core 口径、L-3 platform/web 归属、L-4 既有文档草稿归属
```
