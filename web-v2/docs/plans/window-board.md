# S7-E8 窗口状态看板

> 由 G0 初始化，各窗口推进到对应阶段时由**本窗口**更新自己的行（禁止改他人行）。
> 状态流转：`启动 → 开发中 → 自验通过 → 已合并`。只有 INT 的证据表算最终判定，本表只作过程跟踪。

| 窗口 | 分支 | 启动 | 开发中 | 自验通过 | 已合并 | 报告路径 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | `feat/s7e8-core-contract` | | | | | `reports/w1-contract-test.md` | 最先合并；合并后 `pnpm -r build` 产 dist |
| W2 | `content/s7e8-lectures` | | | | | `reports/w2-content-check.md` | |
| W3 | `feat/s7e8-lecture-ui` | | | | | `reports/w3-ui-smoke.md` | 需 W1 类型 + W2 数据才能 typecheck |
| W4 | `fix/s7e8-ui-consistency` | | | | | `reports/w4-parity-regression.md` | |
| W5 | `chore/s6-closeout` | | | | | `reports/w5-s6-closeout.md` | 碰真实数据；可提前合，建议早合跑 CI |
| W6 | `docs/s7e8-integration` | | | | | `web-v2/CHANGELOG.md` | 可并行起草，最后回填状态/changelog |
| INT | `integrate/s7-e8` | | | | | 证据表（14 号 §6.3） | 唯一最终判定；不新增功能 |

---

## 状态更新约定

- 每个格子填 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm`；未达成留空。
- 更新人只改自己窗口那一行的对应格子，并在报告里留痕。
- 「自验通过」= 本窗口验收标准全过、报告已写；「已合并」= rebase 到集成分支且无冲突。
- P-1 提醒：各窗口启动时先核对本范围草稿是否已存在，存在则纳入版本管理、补验证，**不重复重写**。

## 基线信息

- 基线分支：`integrate/s7-e8`
- 基线 tag：`s7e8-baseline-20261118`
- 基线 commit 与草稿核对摘要：见 `reports/w0-freeze-report.md`
