# INT · 整体集成验证证据表（S7-E10 单窗口执行）

> 由 S7-E10 单窗口线性执行方案 Step 6 产出。分支 `integrate/s7-e8`，基线 `s7e8-baseline-20261118` / `40314328`。
> 执行日期 2026-11-18。判定口径见 `项目规划/任务窗口/INT-整体集成验证.md` §6。

## 证据表（模板 E-01～E-12）

| 编号 | 命令 / 场景 | 预期 | 实测 | 结论 | 责任窗口 | 执行人 |
| --- | --- | --- | --- | --- | --- | --- |
| E-01 | 基线确认 | status 干净 / tag 可追溯 | 六分支 6/6 已合入 integrate；W6 尾笔 `7e17c35` 已补齐；Step 5 后 `git status` 干净；基线 `40314328` 可追溯 | 通过 | G0 | S7-E10 窗口 |
| E-02 | 讲义生成幂等 | 字节一致 | `build-knowledge.mjs` 两次输出 **7 篇 / 86 节 / 59.3k 字 / 0 条视频**，sha256 两次均为 `b6b0b2ab...b70c7`，一致 | 通过 | W2 | S7-E10 窗口 |
| E-03 | `pnpm -r build` | 退出码 0 | `pnpm verify` 内含 `pnpm build`，退出码 0；core/data/platform/platform-web 的 dist 齐全（144/28/4/20 文件） | 通过 | W1 | S7-E10 窗口 |
| E-04 | `pnpm verify` | 全绿 | 完整链 `check:boundaries → check:extension → build → check:codeblanks → check:parity → test` 全退出 0；D-06 未复现，无 `.prev` 遗留 | 通过 | 全体 | S7-E10 窗口 |
| E-05 | `ci_check.py` | 15 项全绿、两 HTML 一致 | `_build/ci_check.py` 15 项全 PASS，发布产物两 HTML md5 `fbb32134…` 一致 | 通过 | 旧版 | S7-E10 窗口 |
| E-06 | 契约复核 | C-1~C-5 / B-1/B-2 全过 | C-1~C-4 由 `knowledge.test.ts` + `snapshot-knowledge.test.ts` 覆盖（core 197 / data 44 全绿）；C-5 由 W6 在 `00` §9 登记；B-1/B-2 见 `w1-contract-test.md` | 通过 | W1 | S7-E10 窗口 |
| E-07 | 断网复跑 | 零外网请求、讲义可读 | `zero-request.test.tsx`（B-3 未点击前零第三方请求）+ `offline-persist.test.tsx`（B-4 断网点播放给提示、正文仍可读）全绿 | 通过 | W3 | S7-E10 窗口 |
| E-08 | 讲义→练习联动 | 筛选生效、设置不变 | `practiceLink.test.ts`（3 tests）全绿；`legacy-items.test.tsx` 全绿 | 通过 | W3/W4 | S7-E10 窗口 |
| E-09 | 数据持久化 | 记录仍在且无重复 | `offline-persist.test.tsx` A-4（刷新/重挂载仍在同一篇、只写当前篇 UI 状态不落学习记录）+ `snapshot.test.ts` 重复导入幂等全绿 | 通过 | W1/W3 | S7-E10 窗口 |
| E-10 | 导入导出往返 | 数量一致 | `snapshot.test.ts`（15 tests）+ `snapshot-knowledge.test.ts`（6 tests，含 C-4 讲义往返恒等：篇数/节数/字节不变）全绿 | 通过 | W1/W2 | S7-E10 窗口 |
| E-11 | 云同步 / 回退 / CI | G6-1~G6-7 留证 | **未执行**：Step 8（W5 真实数据迁移）需云凭据 + ≥2 测试账号 + 旧表只读备份 + 合法 Origin 且用户本人在场。当前仅完成隔离内存迁移演练（`t6-5-migration-rehearsal.md`，不写云库）。CI（general-ci）已就位并经 `ci_check.py` 验证 | 待 Step 8（需凭据） | W5 | — |
| E-12 | 六入口回归 | 6/6 | `app.test.tsx`「六入口：每个入口都能进入并有实质内容」全绿（web 共 11 文件 / 67 tests 全绿） | 通过 | W4 | S7-E10 窗口 |

**通过规则核对**：E-01～E-10、E-12 共 11 项"通过"；E-11 因外部凭据未到位标注"待 Step 8"，不构成代码/集成缺陷，属方案定义的硬依赖外部输入项。按方案 §3 Step 7 的硬依赖（"证据表是阶段 B 回填的唯一判定"），E-11 的正式留证须在 Step 8 完成后补入。

## 四包测试明细（本轮实测）

| 包 | 测试文件 | 用例数 | 退出码 |
| --- | --- | --- | --- |
| `@quiz/core` | 20 | 197 | 0 |
| `@quiz/data` | 6 | 44 | 0 |
| `@quiz/content` | 5 | 41 | 0 |
| `@quiz/web` | 11 | 67 | 0 |

## 人工三项冒烟（Step 6 附）

| 场景 | 判定 | 证据 |
| --- | --- | --- |
| 断网文字讲义可读且零第三方请求 | 通过 | `zero-request.test.tsx` B-3 结构性断言 + `offline-persist.test.tsx` B-4；`ci_check.py` 同步验证发布 HTML 无外部资源加载 |
| 讲义→练习联动 | 通过 | `practiceLink.test.ts` 筛选生效断言 |
| 数据持久化 | 通过 | `offline-persist.test.tsx` A-4 + `snapshot.test.ts` 幂等 |

## 遗留风险

1. E-11（W5 真实数据迁移）未执行，需用户凭据与在场确认；隔离演练已验证迁移脚本逻辑，但真实 RLS 交叉验证、跨设备同步、回退演练须在 Step 8 补齐。
2. `pnpm verify` 的 D-06（构建期清空 dist 被安全策略拦截）本轮未复现；若后续环境复现，按方案"改名不删源码"（`dist` → `dist.prev`）处置，禁止 `rm -rf`。
3. Step 5 中 `styles.css`（过时居中回退）与 `w3-ui-smoke.md`（误删验收章节）两份过时草稿已按判据丢弃，未提交；若后续发现其含有效改动，可从备份 `F:/001/.s7e10-backup-20261118/` 取回。
