# Changelog · quiz-web-v2（S7-E8 讲义专项）

> 本文件登记各窗口已发生的客观事实。阶段 B（2026-11-18，S7-E10 单窗口执行）已在 W1～W6 合并、
> INT 证据表出具后完成回填：最终结论以 `web-v2/docs/reports/evidence.md` 为唯一判定；
> S6 真实迁移因缺凭据未执行，按 `w5-s6-closeout.md` 保留待回填标注，不制造「通过」假象。

---

## G0 · 契约冻结（2026-11-18）

- 冻结契约：`web-v2/docs/plans/parallel-contract.md`（S7-E8 唯一接口权威，全员只读）。
- 基线分支 / tag：`integrate/s7-e8` / `s7e8-baseline-20261118`。
- 已决结论：**P-1 = 保留草稿**；**P-2 = 先按 A**（题库页内精读区，`router.ts` / `App.tsx` / `ui/AppShell.tsx` 三方冻结）。
- 最终判定：契约冻结已确认（E-01 基线可追溯 `40314328`，冻结报告 `web-v2/docs/reports/w0-freeze-report.md`）。草稿核对摘要：P-1 保留的草稿已在 S7-E10 Step 5 逐组裁决（22 项有效提交、2 项过时草稿丢弃、AppShell 冻结留痕），`git status` 干净。

## W1 · 核心契约与校验

- 窗口分支：`feat/s7e8-core-contract`；报告：`web-v2/docs/reports/w1-contract-test.md`。
- 范围：`packages/core/src/**`、`packages/data/src/**`——`KnowledgeModule` 六可选字段、`items` 放宽缺省 `[]`、`parseMediaSource`、`validateKnowledgeModules`、`parseBankJson` 接入讲义校验（失败不写入）。
- 最终结论：通过（契约 C-1~C-4 + B-1/B-2 复核全过；C-5 变更已在 `00` §9 登记）；验收日期 2026-11-18；遗留 0。依据 W1 报告 + INT 证据表 E-06。

## W2 · 讲义内容生产

- 窗口分支：`content/s7e8-lectures`；报告：`web-v2/docs/reports/w2-content-check.md`。
- 范围：`packages/content/**`——`lectures/NN-*.md`（唯一内容源）、`scripts/build-knowledge.mjs`（生成脚本）、`knowledge.json`（生成物，禁止手改）。
- 前置说明：`pnpm knowledge:build` 依赖 W2 交付的 `scripts/build-knowledge.mjs` 与 `lectures/`（P-1 保留草稿下已在工作区）。W6 阶段 A 只做 npm script 登记与 README 重建说明，**脚本文件与讲义源归 W2 独占**，W6 不改动。
- 最终结论：通过；讲义 7 篇 / 86 节 / 59.3k 字 / 0 视频，`knowledge:build` 两次 sha256 一致（幂等）；验收日期 2026-11-18。依据 W2 报告 + INT 证据表 E-02。

## W3 · 讲义阅读与视频界面

- 窗口分支：`feat/s7e8-lecture-ui`；报告：`web-v2/docs/reports/w3-ui-smoke.md`。
- 范围：`apps/web/src/features/knowledge/**`、`features/banks/BanksPage.tsx`、`apps/web/src/styles.css`——精读区与视频播放（站外 iframe 点击后才加载、未点击零第三方请求、断网文字自足）。
- 最终结论：通过（B-2 非法协议拒收、B-3 未点击零第三方请求、B-4 断网讲义可读，E-07/E-08 全绿）；验收日期 2026-11-18；遗留 0。依据 W3 报告 + INT 证据表。

## W4 · 既有页面一致性

- 窗口分支：`fix/s7e8-ui-consistency`；报告：`web-v2/docs/reports/w4-parity-regression.md`。
- 范围：`features/practice/**`、`features/me/ImportExport.tsx`、`apps/web/src/app.test.tsx` 及既有测试——清占位、补回归用例；P-2 已决 A，不碰路由三文件。
- 最终结论：通过（六入口回归 6/6、导入导出往返恒等，E-10/E-12 全绿；P-2 冻结文件仅留痕未改路由拓扑）；验收日期 2026-11-18；遗留 0。依据 W4 报告 + INT 证据表。

## W5 · S6 上线收尾

- 窗口分支：`chore/s6-closeout`；报告：`web-v2/docs/reports/w5-s6-closeout.md`。
- 范围：`apps/web/src/cloud/**`、`docs/cloud/**`、`.github/workflows/**`、`apps/web/public/**`、`项目规划/07`——真实迁移、回退演练、双 CI。
- 最终结论：**阻塞（待外部凭据）**——云配置/RLS/同步/迁移演练静态与单测就绪，但真实数据迁移、RLS 双账号交叉验证、断网手测、回退演练、双 CI 实跑均未执行（G6-1~G6-7 多项阻塞），按 `w5-s6-closeout.md`「静态审查 ≠ 实跑通过」不宣布通过。S6 验收日期 / 标签 / 状态数据字段保留待回填；遗留 5 项，待 Step 8 凭据到位后由 W5/W6 补齐。依据 W5 报告 + INT 证据表 E-11（待凭据）。

## W6 · 文档、ADR 与集成登记

- 阶段 A 已完成（客观事实，与阶段 B 回填严格分开）：
  - ADR-0007 起草/补全：`web-v2/docs/adr/0007-knowledge-lecture-schema.md`（六字段全可选、`items` 放宽、旧数据零迁移、`schemaVersion` 保持 1 不升版及理由、外链视频约定）。
  - 变更登记：`项目规划/00` §9 四项（讲义字段 / 外链视频 / 导入校验收紧 / 内容源改 Markdown）；`项目规划/08` §7 S7-E8 事项卡。
  - 职责与说明：`README.md` §2 讲义源与生成物关系及重建命令；`项目规划/T0-7-文件职责表.md` §8.1 源可改 / 生成物禁改。
  - 脚本登记：根 `web-v2/package.json` 与 `packages/content/package.json` 的 `knowledge:build`。
  - 决策同步：P-1 / P-2 结论在 `13` 附录 C、`14` §0、各任务窗口分文件「已决前提」行表述一致。
  - **W6-2 实测（2026-11-18）**：`knowledge:build` 在隔离 worktree 复跑通过——**7 篇 / 86 节 / 59.3k 字 / 0 条视频**（视频为可选扩展位，当前题库不预置；新题库导入时填 front matter `videos` 即接入）；跑两次 hash 一致（幂等）；产物与 W2 提交版**字节一致**。实测发现 Windows + `core.autocrlf=true` 下讲义 checkout 为 CRLF，脚本 front matter 解析只认 LF，直接跑报「缺少 front matter」——已在 `README.md` §2 补 CRLF 前置说明与转换命令（`sed -i 's/\r$//' *.md`）。脚本逻辑本身正确，属行尾约定坑，不改 W2 源码。
  - 变更登记纪律：`00` §8 状态表在阶段 A **保持未动**（含 S7 仍为「未开始」），避免在 W5 状态数据与 INT 证据表到位前造成「假通过」。
- 阶段 B 回填（2026-11-18，S7-E10 单窗口执行）：`00` §8 的 S7 行已改「通过」并填验收日期 `2026-11-18` 与标签 `s7-e8-lectures`；S6 行按 `w5-s6-closeout.md` 结论保留「进行中」并附真实迁移待凭据说明（状态数据字段仍待回填，不制造假通过）；正式 changelog 见下方 INT 段。遗留 1 项：E-11 W5 真实迁移待 Step 8 凭据。

## INT · 整体集成验证（2026-11-18）

- **最终判定：通过（S7-E8 讲义增强维度）**。证据表 `web-v2/docs/reports/evidence.md`：E-01~E-10、E-12 共 11 项通过；E-11（W5 真实数据迁移）因缺云凭据/≥2 测试账号/旧表只读备份，待 Step 8 凭据到位后补证——属方案定义的外部硬依赖，非代码/集成缺陷。
- 全量实测：`pnpm typecheck` 全 workspace 退出 0；四包单测 core 197 / data 44 / content 41 / web 67 全绿；`pnpm verify` 完整链退出 0（D-06 未复现）；`ci_check.py` 15 项全绿、两 HTML md5 一致；`knowledge:build` 7 篇/86 节/59.3k 字/0 视频、两次 sha256 一致（幂等）。
- 阶段标签：`s7-e8-lectures`（基线 `s7e8-baseline-20261118`）。
- S6 真实迁移仍阻塞（与 `w5-s6-closeout.md` 一致）：`00` §8 的 S6 状态数据字段保留待回填，不提前制造「通过」假象。
