# quiz-web · JavaWeb 期末题库

一套单文件刷题 Web 应用：Markdown 题库 → JSON → 单个 HTML，双击即用，可选登录同步云端。

本仓库有两条线，互不阻塞：

- **旧版**（根目录单文件 HTML）：继续照常可用，任何改动都以"不破坏旧版"为前提。
- **通用版**（`web-v2/`）：S1～S4 已通过（S3 多题库/本地记录/导入导出，S4 错题复习与统计闭环），证据见 `web-v2/docs/reports/s3-gate-review.md` 与 `s4-review-loop.md`。

---

## 1. 一分钟跑起来（旧版）

```bash
# 1) 由 Markdown 题库生成 JSON
python3 _build/build_json.py        # 产出 _build/data.json

# 2) 由 JSON + 模板生成单文件 HTML
python3 _build/build_html.py        # 产出 JavaWeb期末题库.html 与 题库网页/index.html

# 3) 自检（15 项，零第三方依赖）
python3 _build/ci_check.py
```

打开 `JavaWeb期末题库.html` 即可使用，无需服务器、无需 npm、无需联网（云端同步功能除外）。

**环境要求**：仅需 Python 3（标准库），无第三方包。`ci_check.py` 会额外调用 `node --check` 校验内联 JS，若本机没有 Node，该两项会跳过并给出提示。

**只想要能用的页面、不想构建**：直接用仓库里的 `JavaWeb期末题库.html`（已提交的产物，与 `main` 上的源码一致）。

### 通用版（`web-v2/`）

```bash
cd web-v2
pnpm install
pnpm dev            # 本地开发（http://localhost:5173）
pnpm verify         # 边界扫描 + 扩展点扫描 + 构建 + 空位/对账 + 全量单测
```

五个入口：学习 / 题库 / 刷题 / 复习 / 我的。数据默认存在浏览器本地（IndexedDB），
「我的 → 数据导入导出」可导出 JSON 备份或导入第二份题库包，无需登录。

---

## 2. 源码与产物的关系

```
JavaWeb期末全题型题库.md      ← 唯一内容源（147 题：选择 62 / 判断 45 / 填空 27 / 简答 8 / 应用 5）
        │  build_json.py
        ▼
_build/data.json              ← 中间产物，供迁移对照与数量验收，不是长期数据标准
        │  build_html.py  ←  _build/template.html + _build/cloud-sdk.js + sdk.js
        ▼
JavaWeb期末题库.html          ← 本地预览产物（单文件，数据与 SDK 均内联）
题库网页/index.html           ← 线上发布产物（内容同上，路径不同）
```

三条硬规则：

1. **绝不手改 HTML**。手改会在下次构建时被覆盖，且 CI 会因此变红（它比对新构建产物与提交物）。
2. **改内容只改 Markdown**。题干、答案、解析都在 `JavaWeb期末全题型题库.md` 里，改完重新构建。
3. **两份 HTML 必须字节一致**。`build_html.py` 用同一份输入生成两份，`ci_check.py` 会校验它们的 md5。

> 两份 HTML 为什么要同时存在？`题库网页/` 是线上发布目录（发布工具按目录取 `index.html`），根目录那份是"双击就能用"的本地副本。切换发布方式前不要合并它们。

---

## 3. 分支规则

| 分支 | 用途 | 谁能合入 | 状态 |
| --- | --- | --- | --- |
| `main` | 旧版正式线。**只有它对外发布** | PR + CI 绿 | 受保护（保护规则待 CI 就绪后开启） |
| `general-dev` | 通用版开发线（`web-v2/`） | PR + CI 绿 | 与 `main` 同基线，允许领先 |

- 修旧版缺陷：`main` 建 `fix/legacy-*` → 修 → 跑自检 → PR 合 `main` → 再合并到 `general-dev`
- 加新功能：**一律进 `general-dev`**，不往旧版单文件里堆
- 题库内容变更：建 `content/javaweb-*` → 只改 Markdown → 重新构建 → PR

详细日常操作见 `通用刷题Web改造方案与执行计划.md` §5.8。

---

## 4. 发布方式

- **发布目录**：`题库网页/`（入口 `index.html`）
- **发布工具**：WorkBuddy「发布为应用」，应用名 `JavaWeb期末刷题`，`appId` 记录在仓库根 `.wbapp_*.genie`（该文件不入库）
- **发布前置条件**：`python3 _build/ci_check.py` 全绿；`题库网页/index.html` 与 `JavaWeb期末题库.html` 字节一致

> 新版达到切换门槛（S6）之前，**不发布 `general-dev`**，也不用它替换正式入口。

---

## 5. 目录与文件职责

| 路径 | 一句话说明 |
| --- | --- |
| `JavaWeb期末全题型题库.md` | 唯一内容源 |
| `_build/build_json.py` | Markdown → JSON 解析器（含题量/答案自检输出） |
| `_build/build_html.py` | JSON + 模板 → 单文件 HTML |
| `_build/ci_check.py` | 15 项结构自检，本地与 CI 共用 |
| `_build/template.html` | 页面模板（架构冻结，只允许必要修复） |
| `_build/cloud-sdk.js` / `sdk.js` | 固定版本云 SDK，构建时内联 |
| `_build/data.json` | 中间产物，供迁移对照 |
| `JavaWeb期末题库.html` · `题库网页/index.html` | 发布产物，**禁止手改** |
| `项目规划/` | 阶段计划与执行记录（`00` 阶段地图、`01` S0、`02` S1…） |
| `通用刷题Web改造方案与执行计划.md` | 总方案 |
| `题库应用技术交接文档.md` | 旧版架构与历史缺陷 |
| `迁移与验证报告.md` | 旧版验证结论（6/6 冒烟） |

完整职责表（哪些可改、哪些禁止手改、哪些保留勿删）：**`项目规划/T0-7-文件职责表.md`**

---

## 6. `.workbuddy/` 是什么

它不是缓存，是项目的工作区数据目录，**只忽略、不删除**（已写入 `.gitignore`）：

| 内容 | 作用 |
| --- | --- |
| `.workbuddy/memory/YYYY-MM-DD.md` | 会话工作日志，append-only |
| `.workbuddy/memory/MEMORY.md` | 跨会话的项目长期结论 |
| `.workbuddy/applications.yaml` | 本机发布应用的登记 |

同理 `.wbapp_*.genie` 是本机发布凭据，也不入库。**换机器后这两个信息不会跟过来**，需要在新的机器上重新发布一次。

---

## 7. 自检覆盖什么

`python3 _build/ci_check.py` 的 15 项检查分六组：

| 组 | 检查 |
| --- | --- |
| 文件与副本 | 必需文件齐全；三处 `sdk.js` 一致；两份 HTML 一致 |
| 数据基线 | 147 题且分布为 62/45/27/8/5；每题有答案；唯一空位编号 89 且每个标记都有答案 |
| 产物完整性 | `data.json` 与 `cloud-sdk.js` 真被内联；占位符无残留 |
| 结构 | 六个 Tab + 8 个关键元素 id |
| 安全 | 无外部资源加载；无令牌/私钥/手机号 |
| 语法 | 两段内联 JS 过 `node --check` |

**CI 只做结构冒烟**。行为级六项冒烟（搜题、组卷、判分、错题重做、续刷、刷新恢复）是阶段门禁的人工项，由人执行并留证——这一点写在 `项目规划/00` §9，不是遗漏。

---

## 8. 遇到问题先看哪里

| 现象 | 先看 |
| --- | --- |
| 构建后页面空白 / 数据错 | `python3 _build/ci_check.py` 的报错项，它会指到具体哪份产物不一致 |
| 云端功能不可用 | `题库网页/` 是否已发布；页面是否被网关拦截（旧版只上送短标签正是为此） |
| 想知道某文件能不能删 | `项目规划/T0-7-文件职责表.md` |
| 想知道数据格式与迁移风险 | `项目规划/T0-8-旧数据契约清单.md` |
