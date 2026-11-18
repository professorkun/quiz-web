# Changelog · quiz-web-v2（S7-E8 讲义专项）

> **本文件在 W6 阶段 A 为模板**：只登记已发生的客观事实，并标出各段落的回填责任与触发条件。
> 各窗口的最终结论、验收日期与阶段标签，**只认 INT 证据表**为唯一判定；未完成的段落一律明确标注
> 「待阶段 B 回填」或「待 INT 证据表回填」，不使用无责任、无触发条件的模糊措辞。
> 阶段 B（W6 收尾）须在 W1～W5 全部合并、INT 证据表出具后，把下列待回填段落替换为正式条目。

---

## G0 · 契约冻结（2026-11-18）

- 冻结契约：`web-v2/docs/plans/parallel-contract.md`（S7-E8 唯一接口权威，全员只读）。
- 基线分支 / tag：`integrate/s7-e8` / `s7e8-baseline-20261118`。
- 已决结论：**P-1 = 保留草稿**；**P-2 = 先按 A**（题库页内精读区，`router.ts` / `App.tsx` / `ui/AppShell.tsx` 三方冻结）。
- 最终判定、冻结报告编号与草稿核对摘要：**待 INT 证据表回填**（冻结报告路径 `web-v2/docs/reports/w0-freeze-report.md`，由 G0 产出）。

## W1 · 核心契约与校验

- 窗口分支：`feat/s7e8-core-contract`；报告：`web-v2/docs/reports/w1-contract-test.md`。
- 范围：`packages/core/src/**`、`packages/data/src/**`——`KnowledgeModule` 六可选字段、`items` 放宽缺省 `[]`、`parseMediaSource`、`validateKnowledgeModules`、`parseBankJson` 接入讲义校验（失败不写入）。
- 最终结论 / 验收日期 / 遗留问题数：**待阶段 B 回填**（依据 W1 报告 + INT 证据表）。

## W2 · 讲义内容生产

- 窗口分支：`content/s7e8-lectures`；报告：`web-v2/docs/reports/w2-content-check.md`。
- 范围：`packages/content/**`——`lectures/NN-*.md`（唯一内容源）、`scripts/build-knowledge.mjs`（生成脚本）、`knowledge.json`（生成物，禁止手改）。
- 前置说明：`pnpm knowledge:build` 依赖 W2 交付的 `scripts/build-knowledge.mjs` 与 `lectures/`（P-1 保留草稿下已在工作区）。W6 阶段 A 只做 npm script 登记与 README 重建说明，**脚本文件与讲义源归 W2 独占**，W6 不改动。
- 最终结论 / 讲义篇数 / 验收日期：**待阶段 B 回填**（依据 W2 报告 + INT 证据表）。

## W3 · 讲义阅读与视频界面

- 窗口分支：`feat/s7e8-lecture-ui`；报告：`web-v2/docs/reports/w3-ui-smoke.md`。
- 范围：`apps/web/src/features/knowledge/**`、`features/banks/BanksPage.tsx`、`apps/web/src/styles.css`——精读区与视频播放（站外 iframe 点击后才加载、未点击零第三方请求、断网文字自足）。
- 最终结论 / 验收日期 / 遗留问题数：**待阶段 B 回填**（依据 W3 报告 + INT 证据表）。

## W4 · 既有页面一致性

- 窗口分支：`fix/s7e8-ui-consistency`；报告：`web-v2/docs/reports/w4-parity-regression.md`。
- 范围：`features/practice/**`、`features/me/ImportExport.tsx`、`apps/web/src/app.test.tsx` 及既有测试——清占位、补回归用例；P-2 已决 A，不碰路由三文件。
- 最终结论 / 验收日期 / 遗留问题数：**待阶段 B 回填**（依据 W4 报告 + INT 证据表）。

## W5 · S6 上线收尾

- 窗口分支：`chore/s6-closeout`；报告：`web-v2/docs/reports/w5-s6-closeout.md`。
- 范围：`apps/web/src/cloud/**`、`docs/cloud/**`、`.github/workflows/**`、`apps/web/public/**`、`项目规划/07`——真实迁移、回退演练、双 CI。
- 最终结论 / S6 验收日期 / 标签 / 遗留问题数：**待阶段 B 回填**（依据 W5 报告 + INT 证据表）。

## W6 · 文档、ADR 与集成登记

- 阶段 A 已完成（客观事实，与阶段 B 回填严格分开）：
  - ADR-0007 起草/补全：`web-v2/docs/adr/0007-knowledge-lecture-schema.md`（六字段全可选、`items` 放宽、旧数据零迁移、`schemaVersion` 保持 1 不升版及理由、外链视频约定）。
  - 变更登记：`项目规划/00` §9 四项（讲义字段 / 外链视频 / 导入校验收紧 / 内容源改 Markdown）；`项目规划/08` §7 S7-E8 事项卡。
  - 职责与说明：`README.md` §2 讲义源与生成物关系及重建命令；`项目规划/T0-7-文件职责表.md` §8.1 源可改 / 生成物禁改。
  - 脚本登记：根 `web-v2/package.json` 与 `packages/content/package.json` 的 `knowledge:build`。
  - 决策同步：P-1 / P-2 结论在 `13` 附录 C、`14` §0、各任务窗口分文件「已决前提」行表述一致。
  - **W6-2 实测（2026-11-18）**：`knowledge:build` 在隔离 worktree 复跑通过——**7 篇 / 86 节 / 59.3k 字 / 0 条视频**（视频为可选扩展位，当前题库不预置；新题库导入时填 front matter `videos` 即接入）；跑两次 hash 一致（幂等）；产物与 W2 提交版**字节一致**。实测发现 Windows + `core.autocrlf=true` 下讲义 checkout 为 CRLF，脚本 front matter 解析只认 LF，直接跑报「缺少 front matter」——已在 `README.md` §2 补 CRLF 前置说明与转换命令（`sed -i 's/\r$//' *.md`）。脚本逻辑本身正确，属行尾约定坑，不改 W2 源码。
  - 变更登记纪律：`00` §8 状态表在阶段 A **保持未动**（含 S7 仍为「未开始」），避免在 W5 状态数据与 INT 证据表到位前造成「假通过」。
- 阶段 B 待回填（`00` §8 状态表、阶段标签如 `s7-e8-lectures`、正式 changelog 条目）：**待阶段 B 回填**（硬依赖 W5 的 S6 状态数据 + INT 证据表）。

## INT · 整体集成验证

- 全窗口合并后的最终判定、证据表（14 号 §6.3 模板）、阶段标签：**待 INT 证据表回填**。
