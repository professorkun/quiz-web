# W5 · S6 上线收尾报告（w5-s6-closeout）

| 项 | 内容 |
| --- | --- |
| 窗口 | W5（S6 上线收尾，四窗口中唯一触碰真实用户数据） |
| 分支 | `chore/s6-closeout`（从基线 `s7e8-baseline-20261118` / `4031432` 创建，与其它窗口分支同点，零冲突切入） |
| 报告日期 | 2026-11-18 |
| 性质 | **静态审查 + 准备工作报告 + 本地可确定性验证；未执行任何真实数据迁移/同步/登录/云端写入/发布切换** |
| 本轮新增 | ① 补建 `general-ci.yml`（补 G6-7 缺口）；② 实跑本地 typecheck/单测并记录真实结果；③ W5 白名单草稿按 P-1 纳入版本管理并提交 |
| 权威依据 | `项目规划/任务窗口/W5-S6上线收尾.md` 全文、`项目规划/07-S6-云同步PWA与发布切换.md`、`web-v2/docs/plans/parallel-contract.md`（G0，只读） |
| 只读参考 | `web-v2/docs/reports/t6-5-migration-rehearsal.md`（既有隔离内存迁移演练） |

> **诚实声明（最高优先级）**：本报告中所有需要真实环境/凭据/账号/备份才能成立的验收项，一律如实标注「**阻塞：缺凭据/账号/备份，未执行**」或「**静态就绪，未实跑**」。
> 不编造任何对账数字、回退演练结果或 CI 运行记录。静态审查结论 ≠ 实跑通过。

---

## 0. 契约状态（明确结论）

**契约已冻结（G0 完成 2026-11-18，基线 `integrate/s7-e8` / `s7e8-baseline-20261118`），但真实迁移仍需「云凭据 / ≥2 个测试账号 / 旧云表只读备份」三项前置，故未执行。**

- 契约冻结见 `parallel-contract.md` §5 与 `S6 上线收尾.md` §3：契约未冻结前不迁数据；当前契约已冻结，此条不再是障碍。
- 但本环境经核对**不具备**三项前置：无云凭据、无 ≥2 个测试账号做 RLS 交叉验证、无旧云表只读备份文件。按 `S6 上线收尾.md` §3「缺账号则隔离验证不成立，不得宣布通过」「缺备份不得动手」以及安全边界，**W5 不执行任何实际迁移动作**。
- 因此 W5 本轮交付定位为「草稿核对 + 纳入版本管理准备 + 本地静态验证 + 如实阻塞报告」，而非真实上线收尾。

---

## 1. 草稿核对清单（`git status --short` / `git diff --name-only` 只读核对）

按 P-1「保留草稿、先核对再纳入版本管理、不重复重写」，对 W5 白名单范围逐一核对。以下均为**他人/前期已存在草稿，本窗口未改动**（本窗口唯一写入为本报告文件）。

| 白名单路径 | git 状态 | 文件 / 内容 | 完整性判定 |
| --- | --- | --- | --- |
| `web-v2/apps/web/src/cloud/**` | `??`（未跟踪） | `config.ts`、`client.ts`、`auth.ts`、`transport.ts`、`sync.ts`、`sync.test.ts` | ✅ 齐备，结构完整（认证/传输/同步/单测俱全），属「待补真实验证」而非残缺 |
| `web-v2/docs/cloud/**` | `??`（未跟踪） | `v2-schema.md`、`v2-schema.sql` | ✅ 齐备，含五表 DDL + RLS 策略注释 + 字段映射 + 部署实测记录 |
| `web-v2/apps/web/public/**`（PWA） | `??`（未跟踪） | `icon.svg`、`manifest.webmanifest`、`sw.js` | ✅ 齐备（manifest/SW/图标）；配套 `src/pwa.tsx` 为 `??`（注：`pwa.tsx` 在 `src/` 根，严格说不在 `public/**` 白名单内，本窗口不碰） |
| `.github/workflows/**` | `??` → 本次纳入 | `legacy-ci.yml`（既有）+ `general-ci.yml`（**本次补建**） | ✅ 齐备：`legacy-ci` 既有且合理；`general-ci` 原缺失，本轮已补建（详见 §3） |
| `项目规划/07-S6-云同步PWA与发布切换.md` | `M`（已修改，他人草稿） | 阶段文档全文 | ✅ 齐备，含 §5 runbook、§10 回退方案、§12 进展记录 |
| `web-v2/docs/reports/t6-5-migration-rehearsal.md` | `??`（未跟踪，只读） | 迁移演练报告 | ✅ 齐备，隔离内存演练，明确「不写云库」 |

**核对结论**：W5 白名单内草稿**基本齐备、内容完整**（代码/配置/文档/单测/演练报告俱全），属于「待补真实验证」而非残缺，**不需要重写**。原唯一结构性缺口 `general-ci` 工作流缺失，**本轮已补建**。

**本轮改动口径（P-1）**：既有一律只「纳入版本管理」不重写；新增仅两件——`general-ci.yml` 与本报告。

---

## 2. 草稿内容完整性审查（读文件结论）

- **云配置** `config.ts`：endpoint / oauthRelayBaseUrl / publishableKey 三项硬编码，注释声明均为公开值（publishableKey 只标识应用、不携带权限，服务端按 Origin 校验）。**静态观察点**：G6-1 要求「无凭据、令牌出现在前端可读位置」，publishableKey 设计上可公开，但需在真实安全复查中确认其确为 publishable 而非特权密钥；本窗口无法验证，标「待复查」。
- **云客户端** `client.ts`：单例 `createWorkBuddyCloud`，Auth/Database 共用 client，页面经 `auth.ts`/`sync.ts` 封装使用——符合 T6-3「页面不直连 SDK」。
- **认证适配器** `auth.ts`：`AuthAdapter`（getUser/onAuthStateChange/signOut）+ 登录封装（手机 OTP / 微信 / WorkBuddy OAuth），回调清理 URL 参数。结构完整；真实域名回调未验证（缺合法 Origin/账号）。
- **同步层** `sync.ts` + `sync.test.ts`：全量快照同步，三条硬约束（不发 owner_id、只追加表幂等键、可变表 LWW）均落到代码；单测覆盖「并集 / 幂等 / LWW」3 例，**本轮实跑 3/3 通过**（见 §4.1）。
- **传输层** `transport.ts`：分页全量拉取 + `insertIgnore`/`upsert`，符合幂等口径。
- **V2 表结构** `v2-schema.sql` / `v2-schema.md`：五表 DDL、索引、约束、`GRANT` 仅 `authenticated`、`REVOKE anon`、RLS 20 条策略注释；§8 记录 2026-11-18 云端部署与模拟 A/B 实测。**真实跨账号验证仍未做**（缺 ≥2 账号）。
- **PWA** `manifest.webmanifest` / `sw.js` / `index.html`：manifest 含 name/start_url/scope/display/icons；SW 含预缓存外壳、导航网络优先+离线回退、静态缓存优先、SKIP_WAITING 更新；`index.html` 的 viewport 已移除 `user-scalable=no`/`maximum-scale`（第 5–6 行注释与 meta 确认），符合 G6-5「允许缩放」。**断网手测/键盘实测未做**。
- **既有演练** `t6-5-migration-rehearsal.md`：隔离内存演练，映射率 100%、无未映射/冲突；明确列出进入正式迁移前的 4 个人工确认点（身份关联/停写窗口/观察期/推断口径）。**演练数字不可当作真实对账数字**。

**总判定**：所有草稿均为「实现/配置齐全，等待真实环境验证」的完整稿；W5 未发现残缺草稿，无需补写代码。

---

## 3. CI 静态审查结论（未实际触发 CI）

### 3.1 `legacy-ci.yml`（存在，静态合理）

- 触发：`push`/`pull_request` on `main`、`general-dev`，含 `workflow_dispatch`；`permissions: contents: read`（最小权限，合理）。
- Job：ubuntu-latest、timeout 10min；checkout@v4 + setup-python@v5(3.12) + setup-node@v4(20)；从源重建（Markdown→JSON→HTML）；用 `git status --porcelain` 校验生成物与提交物一致；`python _build/ci_check.py` 做旧版自检（题量/空位/结构/密钥/JS 语法）。
- **静态结论**：YAML 结构完整、作业步骤自洽、权限收敛，**配置合理**。它只检查旧版确定性产物，符合「不碰 web-v2」定位。
- **动态结论**：**未实际触发**（按约束不跑任何 CI）。`legacy-ci` 绿/红未知。

### 3.2 `general-ci.yml`（本轮补建，静态合理）

- **补建动因**：`.github/workflows/` 下原本只有 `legacy-ci.yml`，G6-7「双绿」在文件层面即不成立。`general-ci` 属 W5 白名单（`.github/workflows/**`），故由本窗口补齐。
- **内容**：触发 `push`/`pull_request` on `main`、`general-dev`、`integrate/s7-e8`、`chore/s6-closeout` + `workflow_dispatch`；`permissions: contents: read`（最小权限）；Job 限定 `working-directory: web-v2`，Node 20 + pnpm 12 + `pnpm install --frozen-lockfile`；步骤拆分为 typecheck → `check:boundaries` → `check:extension` → `check:codeblanks` → `check:parity` → `build` → `test`。
- **步骤拆分而非直呼 `pnpm verify`**：让每步失败在 Actions 上一眼可辨；合起来等价于 `pnpm verify`。
- **lint 未接入**：方案 §5.5 列了 lint，但 web-v2 现无 lint 脚本/配置（已核实）。故不加必然红的步骤，静态检查由 `typecheck` 承担，待 W4 统一工具链时补。
- **已知环境问题 D-06**（INT §4）：`vite build` 清空 `apps/web/dist/` 可能触发本机安全删除保护（62 文件 > 50 阈值）。处置口径：**把产物目录改名再构建**（`dist` → `dist.prev`），禁止删源码或清空 `build/`。CI 侧用干净 runner 不触发本机保护，但本地 `pnpm verify` 复现时须按此处置并记录。
- **动态结论**：**未实际触发**。配置静态合理，但 `general-ci` 绿/红未知。

### 3.3 CI 总结

| 项 | 配置存在 | 静态合理 | 实际运行 |
| --- | --- | --- | --- |
| `legacy-ci` | ✅ | ✅ | ❌ 未触发，结果未知 |
| `general-ci` | ✅ 本轮补建 | ✅ | ❌ 未触发，结果未知 |

**G6-7 判定：仍阻塞（配置已齐备，但双 CI 均未实跑；且本地当前 typecheck/test 为红，根因见 §4-本地验证）。**

---

## 4. 回退演练清单（静态整理，未实跑）

> **章节引用偏差如实记录**：任务与 W5 文档称「07 §5 runbook、§6 回退方案」，但现行 07 文档中 **§5 是迁移 Runbook（含文末「回退纪律」）、§6 是交付物、「回退方案」实际在 §10**。本清单以**现行文档实际内容**为准，综合 §5 runbook 失败处理、§5 回退纪律、§10 回退方案 4 条、§7-G「不可接受情形」中回退相关条目整理。
>
> 以下全部为**静态步骤清单，未实跑**；缺凭据/账号/备份/发布环境，无法执行。

| # | 演练场景（依据） | 步骤 | 预期 | 失败处置 | 执行状态 |
| --- | --- | --- | --- | --- | --- |
| R1 | **发布回退**（§10.1） | ① 将正式入口从新版 Release 切回旧版 Release（旧版在 `main` 历史、可构建）→ ② 验证旧版可访问、可答题 | 旧版入口正常，用户无感回退 | 若旧版不可构建/不可访问，停止切换，保留新版入口并上报 | 未实跑（无发布环境） |
| R2 | **数据回退**（§10.2、§5 回退纪律） | ① 先导出切换后新版已产生的所有新写入 → ② 转换为旧结构 → ③ 回写旧库 → ④ 再切回旧版写入 | 新版数据零丢失，旧库结构完整 | 导出/转换失败即停止，**禁止直接切回覆盖**；保留新版数据待人工处理 | 未实跑（无凭据/备份） |
| R3 | **部分回退**（§10.3） | 仅关闭云同步、前端回本地模式，保留新 UI | 本地模式可用，云端数据不丢 | 本地模式异常则降级为 R1 全量发布回退 | 未实跑 |
| R4 | **迁移步骤级回退**（§5 runbook 步骤 5/7） | 步骤5 幂等写入失败 → 回滚本步写入；步骤7 切换写入失败 → 立即回退旧版写入并保留新版数据 | 每步可停可退，不产生脏数据/重复行 | 停靠点即停，按 §5 失败处理列执行，不继续后续步骤 | 未实跑 |
| R5 | **观察期规则**（§10.4） | 明确观察期长度与判定标准；期内不清理旧表、不删旧 Release、不做不可逆操作 | 观察期内旧表只读备份完好 | 触发不可逆操作冲动时按 §11「缩短观察期需登记」走变更 | 未实跑（无观察期环境） |

**附：§7-G 关键场景 5（回退不丢新数据）判定口径**：Given 切换后新版已产生 10 条 → When 回退 → Then 先导出/回写这 10 条到旧结构、再切回，数据无丢失。**该场景未实跑，仅记录判定口径。**

**回退演练结论：静态清单齐备（5 场景 + 1 关键口径），未实跑；按 G6-6「演练记录」判据 = 阻塞（缺真实环境）。**

---

## 4.1 本地可确定性验证（本轮实跑，非静态审查）

时间 2026-11-18 · Node 20 / pnpm 12.14.0 · 命令在 `web-v2/` 下执行

**⚠️ 跨窗口实时并行，两次跑测结果有漂移（如实记录，不取好看的那次）**：

| 时刻 | `@quiz/data` | `cloud/sync.test.ts` | 备注 |
| --- | --- | --- | --- |
| 13:55（首轮） | ✅ 36 / 36 | ✅ 3 / 3 | 当时 data 包共 36 项 |
| 14:21（提交后复跑） | ❌ **38 / 42，4 失败** | ✅ 3 / 3 | 测试数涨到 42：并行窗口新增 `snapshot-knowledge.test.ts`（6 项，4 失败） |

失败项**全部**在 `packages/data/src/snapshot-knowledge.test.ts`（`??` 未跟踪，**不在本次提交内**，归 W1）：
- `expected true to be false`（导入本应失败却成功）×2
- `knowledge[0].sections` 期望 `[]` 得到 `undefined`——即契约 §1.2 的 `.default([])` 未生效

**判定（重要）**：W5 自身代码 `apps/web/src/cloud/**`（3/3）与 `migrate-v2` 相关逻辑**未出现失败**；data 包 4 项失败的根因是 W1 的讲义导入契约实现（新契约六字段缺省值未补），与 typecheck 红项同源。**这不是 W5 能单独修的**（`packages/data/src/**` 归 W1）。

其余本地验证：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `apps/web` 其余测试 | ✅ 37 项通过 | renderRichText 7、short_answer 5、all-renderers 7、exam 9 等 |
| `pnpm typecheck` | ❌ **红** | `packages/content/src/banks/chemistry.ts(278,3)` TS2322 缺 `goals/sections/videos/resources`（**W2**）；`packages/platform/web` 亦报错（**W1**） |
| `apps/web` → `app.test.tsx` | ❌ **6 / 15 失败** | 根因 `features/knowledge/LectureArticle.tsx:23` 读 `module.sections.length` 得 undefined（**W3**） |

**判读（重要）**：W5 自身代码绿。当前全部红项根因落在 **W1（契约缺省值）/ W2（内容缺六字段）/ W3（组件未判空）**，三者同源——都是契约 §1.2 新增六字段尚未在各窗口落地。正对应契约 §5.3「六窗口并行、INT 才总判」：**单窗口绿 ≠ 集成绿**。故 G6-7 在其它窗口红项清零前不能宣布。

> 补充：`pnpm verify` 本轮未完整执行（含 `build`，可能撞 D-06）。待其它窗口红项清零后再跑一次并记录，届时按「改名不删源码」口径处置。

---

## 5. 完成回执（按 W5 文档 §9 格式，交回 INT）

```
窗口：W5  分支：chore/s6-closeout
备份位置与检查点时间：未执行——缺旧云表只读备份与本地全量 JSON 导出；无备份文件、无检查点时间与 hash（W5-1 阻塞）
对账数字（按用户/表）：阻塞：缺凭据/账号/备份，未执行真实迁移，无真实对账数字。
  唯一既有数字来自 t6-5 隔离内存演练（attempts 141 / progress 112 / exam_records_v2 1 / practice_sessions 1，映射率 100%），
  该演练明确「不写云库」，仅为模拟，不得冒充正式对账结果。
回退演练结果（含失败处置）：静态清单见本报告 §4（5 场景 + 场景5口径），未实跑——缺发布环境/凭据/备份。
  失败处置已逐条整理（禁止直接切回覆盖、失败即停、旧表只读保留、观察期不清理）。
CI 记录（legacy-ci / general-ci）：未实际触发，无 CI 运行日志。
  静态审查：legacy-ci 配置存在且合理；general-ci 配置本轮已补建（.github/workflows/general-ci.yml），静态合理。
  本地可确定性验证（实跑）：cloud/sync.test.ts 3/3 绿（W5 自身代码）。
  @quiz/data 两跑结果漂移：13:55 为 36/36，14:21 复跑为 38/42（4 失败，全在 W1 新增的 snapshot-knowledge.test.ts，
  根因=契约 §1.2 新增六字段 .default([]) 未生效，与 typecheck 红项同源）。详见 §4.1。
  本地 typecheck/test 当前红，根因在 W1（契约缺省值）/ W2（chemistry.ts 缺六字段）/ W3（LectureArticle sections undefined），非 W5 代码。
验收结果：
  G6-1 阻塞（缺≥2测试账号/凭据；仅有 §12 云端模拟 A/B 静态记录，非真实双账号交叉验证）
  G6-2 阻塞（缺凭据/账号/备份，无真实对账表，差异 0 未证实）
  G6-3 部分（并集语义已实现且 sync.test.ts 单测 3/3 实跑通过；真实游客合并用例+前后快照未执行）
  G6-4 阻塞（断网手测未执行；PWA 静态配置齐备）
  G6-5 部分静态通过（viewport 已移除禁止缩放），键盘/焦点/屏幕阅读器实测未执行 → 未通过
  G6-6 阻塞（回退演练未实跑，Release 未发布）
  G6-7 阻塞（配置已齐备，但双 CI 均未实跑；本地红项待其它窗口清零）
  W5-1 阻塞（迁移前备份未做，无还原抽检）
  W5-2 静态符合（07 §12 与 v2-schema 均声明旧云全程未触碰、草稿无写旧云逻辑），真实表清单核对未执行
  W5-3 通过（本轮仅提交白名单文件，git diff --name-only 可核对；工作区其余黑名单改动属其它并行窗口，非 W5 所为）
S6 状态数据（日期 / 标签 / 遗留问题数）：暂缺——需真实迁移与发布完成后回填，详见 §6
遗留问题：见本报告 §7
```

---

## 6. 给 W6 的 S6 状态数据为何暂缺

W6 回填 `00` §8 需要「验收日期 / Release 标签 / 遗留问题数」三项。**本窗口无法提供最终值**，原因：

1. **验收日期**：G6-1~G6-7 均未真实通过，不存在「真实验收完成日期」。按 W5 §5 该日期应在真实迁移/演练/CI 全绿后产生。
2. **Release 标签**：计划标签 `general-v1.0.0-rc.1 → general-v1.0.0`，但 T6-12 发布未执行、正式入口未切换（`general-dev` 仍非正式入口），标签尚未打出，不能填「已完成」。
3. **遗留问题数**：当前可列的均为阻塞项（见 §7），数量与性质会随真实执行变化，现在定数会误导最终判定。

**结论**：S6 状态数据字段保留为空/待回填，并附状态说明「**S6 上线收尾：契约已冻结，真实迁移因缺凭据/账号/备份未执行；W5 仅完成草稿核对与静态审查，待前置条件具备后由 W5/W6 回填真实数据**」。这符合 W5 §7「只有 INT 证据表算最终判定」——不提前制造「通过」假象。

---

## 7. 遗留问题与阻塞项

| # | 问题 | 性质 | 影响验收 | 建议处置 |
| --- | --- | --- | --- | --- |
| L1 | 无云凭据 | 前置阻塞 | G6-1/2/3/6、W5-1 | 主 agent 提供后可做真实迁移/RLS 验证 |
| L2 | 无 ≥2 个测试账号 | 前置阻塞 | G6-1（隔离交叉验证不成立） | 备齐双账号+合法 Origin 后验证，否则不得宣布通过 |
| L3 | 无旧云表只读备份 | 前置阻塞 | W5-1、迁移可回退 | 动手前先导出备份 + 检查点（runbook 步骤1/2） |
| L4 | ~~`general-ci` 工作流文件缺失~~ | ✅ **本轮已解决** | G6-7 | 已补建 `.github/workflows/general-ci.yml`（静态合理）；剩余仅「未实跑」→ 归 L5 |
| L5 | 双 CI 均未实跑 | 环境/约束 | G6-7 | 在具备环境后由主 agent 统一串行触发 |
| L6 | 回退演练未实跑 | 环境阻塞 | G6-6 | 发布环境就绪后按 §4 清单逐条执行并记录耗时 |
| L7 | 断网/键盘/跨设备手测未做 | 环境阻塞 | G6-3/4/5 | 真机 + 双账号环境执行 |
| L8 | publishableKey 前端可读 | 待安全复查 | G6-1「无凭据/令牌」 | 确认其为 publishable 而非特权密钥（静态看注释如此，未验证） |
| L9 | 07 文档章节引用偏差 | 文档一致性 | 不影响代码 | 任务/W5 文档称「§6 回退方案」，现行 07 实际为 §10；建议后续统一措辞（07 属 W5 白名单，但本窗口未改动） |
| L10 | `pwa.tsx` 位于 `src/` 根非 `public/**` | 所有权边界待定 | 不影响本窗口 | 该文件是 PWA 注册逻辑但不在 W5 白名单字面范围内，**本轮未提交**；建议 INT/W6 拍板其归属（W5 白名单 / 划归其它窗口） |
| L11 | S6 迁移代码落在 W1 路径下 | 所有权冲突（需 INT 拍板） | 影响提交归属 | `packages/data/src/cloud/**`、`migrate-v2.ts`、`rehearse-migration.mjs` 是 S6 迁移产物（W5 的任务内容），但路径 `packages/data/src/**` 按契约 §5.1 归 **W1**。本轮**严格按矩阵未提交**它们。建议 INT 明确：迁移到 `cloud/` 独占路径，或给 W5 开路径例外 |
| L12 | 并行窗口实时写盘，验证结果会漂移 | 过程风险 | 影响 G6-7 判定 | 本轮 13:55→14:21 两次跑测已漂移（36/36 → 38/42）。**最终 CI 绿必须以 INT 在冻结点统一重跑为准**，单窗口任何时刻的绿都不算数 |

---

## 8. 本窗口实际改动（黑盒可核对）

- **新增**：`.github/workflows/general-ci.yml`（补 G6-7 缺口）、`web-v2/docs/reports/w5-s6-closeout.md`（本报告，白名单允许新建）。
- **纳入版本管理（P-1，不重写）**：`web-v2/apps/web/src/cloud/**`（6）、`web-v2/docs/cloud/**`（2）、`.github/workflows/legacy-ci.yml`、`web-v2/apps/web/public/**`（3，PWA）、`项目规划/07-S6-云同步PWA与发布切换.md`。
- **分支操作**：由 `feat/s7e8-lecture-ui` 切至 `chore/s6-closeout`（两分支同指基线 `4031432`，零冲突）；提交前缀 `chore(s6-closeout)`。
- **刻意不提交**：`web-v2/docs/reports/t6-5-migration-rehearsal.md`（W5 只读输入，报告目录纪律只新建 `w5-` 前缀）、`web-v2/apps/web/src/pwa.tsx`（位于 `src/` 根，严格不在 `apps/web/public/**` 白名单内，归属待 INT/W6 拍板）。
- **未执行**：真实数据迁移、真实同步、账号登录、云端写入、发布切换、CI 触发——全部未做，不伪造。
- **本地验证已执行**：`pnpm --filter @quiz/data test`（36/36）、`apps/web` 单测（含 `cloud/sync.test.ts` 3/3）、`pnpm typecheck`；结果见 §4.1。
