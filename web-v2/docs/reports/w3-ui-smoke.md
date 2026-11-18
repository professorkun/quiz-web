# W3 · 讲义阅读与视频界面 · 冒烟与验收报告

| 项 | 内容 |
| --- | --- |
| 窗口 | W3 · 讲义阅读与视频界面 |
| 分支 | `feat/s7e8-lecture-ui` |
| 提交前缀 | `feat(s7e8-w3)` |
| 契约依据 | `web-v2/docs/plans/parallel-contract.md`（G0 冻结）、`项目规划/任务窗口/W3-讲义阅读与视频界面.md` |
| 验证环境 | 冒烟工作树 `.workbuddy-w3-smoke`（= W3 分支 + W1 core 源码/dist + W2 knowledge.json，等价于 W1→W2→W3 合并后的形态），Chrome 148 无头 + CDP 实测，vite dev @ `localhost:5173` |

---

## 1. 改动文件清单（仅 W3 白名单）

| 文件 | 性质 | 说明 |
| --- | --- | --- |
| `apps/web/src/features/knowledge/KnowledgePanel.tsx` | 组件 | 模块目录 + 单篇切换；按 `topic.order` 排序；阅读位置持久化（sessionStorage，A-4） |
| `apps/web/src/features/knowledge/LectureArticle.tsx` | 组件 | 元信息 → 目标 → 一分钟速览(items) → 目录锚点 → 分节正文 → 视频 → 易错点 → 拓展 → 去练本节；正文走既有 `RichText` |
| `apps/web/src/features/knowledge/VideoCard.tsx` | 组件 | 按 `parseMediaSource.kind` 分支：file/hls 原生 video、bilibili/youtube 点击后才挂 iframe、page 跳转卡、invalid 提示卡；断网点播放出「需联网」提示（B-4） |
| `apps/web/src/features/knowledge/practiceLink.ts` | 纯函数 | 「去练本节」设置改写：只改 `topicIds` + `onlyUnseen`，可单测（A-6） |
| `apps/web/src/features/knowledge/KnowledgePanel.test.tsx` | 组件测试 | 切篇 / 旧数据兜底 / 点击前无 iframe / invalid 提示 / 锚点对应 / startSec / HLS 提示 |
| `apps/web/src/features/knowledge/legacy-items.test.tsx` | 组件测试 | 旧形态讲义（只有 items）正文兜底渲染 |
| `apps/web/src/features/knowledge/offline-persist.test.tsx` | 组件测试 | B-4 断网提示；A-4 刷新保持；A-7 不落学习记录 |
| `apps/web/src/features/knowledge/zero-request.test.tsx` | 组件测试 | B-3 结构性证据：未点击前 DOM 无任何可自动加载的第三方引用 |
| `apps/web/src/features/knowledge/practiceLink.test.ts` | 单测 | A-6 设置改写不变式 |
| `apps/web/src/features/banks/BanksPage.tsx` | 接线 | `<details>` 列表替换为 `KnowledgePanel`；`startTopicPractice` 走 `applyTopicPractice` |
| `apps/web/src/styles.css` | 样式 | 讲义布局/导航/目录/视频卡桌面与移动端（≤860px 横滑目录） |

> 只新建报告文件 `docs/reports/w3-ui-smoke.md`（本文件）；未改 `router.ts` / `App.tsx` / `AppShell.tsx` / `PracticePage.tsx` / `app.test.tsx` / `cloud/**` / `core/**` / `content/**` / 任何 `package.json`。

---

## 2. 断网手测与网络面板实测记录（Chrome 148 + CDP，真实浏览器）

### B-3 站外视频未点击前零第三方请求

| 时点 | iframe 数 | 可自动加载的第三方引用 | resource timing 中第三方请求 |
| --- | --- | --- | --- |
| 打开题库页、未点击播放 | **0** | **0** | **[]**（总资源 102，全部 localhost） |
| 点击 B 站播放按钮后 | 1（`src=https://player.bilibili.com/player.html?bvid=BV1Y7411K7zz&...`） | 1 | — |

```json
// 点击前（step1）
{"stage":"pre-click","navCount":7,"currentTitle":"Web 基础","iframeCount":0,"videoCount":0,
 "playButtons":["▶播放「尚硅谷 JavaWeb 全套教程（合集）"],"thirdPartyRequests":[],"totalResources":102}
// 点击后（step3）
{"stage":"after-click","iframeCount":1,
 "iframeSrc":"https://player.bilibili.com/player.html?bvid=BV1Y7411K7zz&autoplay=0&danmaku=0&high_quality=1"}
```

### B-4 断网时点播放显示「需联网」提示

以 `Object.defineProperty(navigator,'onLine',{get:()=>false})` 模拟断网后点击播放：

```json
{"clickedPlay":true,"onLine":false}
{"hintShown":true,"iframeCount":0,"currentTitle":"JSP","scrollable":true}
```

- 「需要联网」提示出现；**iframe 未挂载**（挂了也只会转圈）；
- 讲义正文仍在（标题可见、`.lecture` 可滚动）——断网不崩、讲义自足。

### B-5 直链视频：原生 video、startSec 生效

以浏览器内 MediaRecorder 生成 1.4s webm（`public/test.webm`）+ 一条 `startSec:1` 的直链视频条目（仅冒烟树副本，不入库）实测：

```json
{"found":true,"src":"test.webm","controls":true,"preload":"metadata","isIframe":0}
{"currentTime":1,"duration":1.400284,"paused":true}
```

- 原生 `<video controls preload="metadata">` 渲染，未变成 iframe（黑框/嵌入均不存在）；
- `loadedmetadata` 后 **currentTime=1**，`startSec` 跳秒生效；
- 组件单测另有 `loadedmetadata → currentTime=30` 的断言（jsdom 模拟）。

### A-4 切篇 / 锚点 / 刷新保持

```json
{"navTitles":["Web 基础","JSP","Servlet","Spring","SpringMVC","MyBatis","JDBC"],"clickedIndex":4}
{"selectedNow":"SpringMVC"}
// 刷新页面后
{"afterReload":"SpringMVC"}
```

- 7 篇导航常驻；选第 5 篇 → 刷新 → **仍在同一篇**（sessionStorage 只存"当前篇"这一条 UI 状态）；
- 目录锚点：`href="#sec-N"` 与 `id="sec-N"` 一一对应（组件断言 6 条）；点击走 `scrollIntoView` 不改 hash（hash 路由下防止把 `#sec-N` 当路由解析）。

### A-5 断网文字讲义完整可读、代码高亮正常、无控制台异常

```json
{"afterReload":"SpringMVC","codeBlocks":8,"hljsSpans":221,"lectureTextLength":8729}
{"errors":0,"lectureText":true}
```

- 正文 8729 字可读、8 个代码块、221 个 highlight.js 高亮节点（全部本地打包，无 CDN）；
- 全程 `window.onerror` / `unhandledrejection` 捕获 **0 条**；
- 资源 102 个全部 localhost——文字讲义不依赖网络。

---

## 3. 执行命令与输出（逐条）

```
$ pnpm --filter @quiz/web exec vitest run src/features/knowledge
 ✓ practiceLink.test.ts (3)  ✓ legacy-items.test.tsx (2)  ✓ zero-request.test.tsx (2)
 ✓ KnowledgePanel.test.tsx (8)  ✓ offline-persist.test.tsx (5)
 Test Files  5 passed (5)       Tests  20 passed (20)

$ pnpm --filter @quiz/web test          # 全量（含 app.test.tsx 既有 15 用例）
 Test Files  10 passed (10)     Tests  63 passed (63)

$ pnpm --filter @quiz/web typecheck
 $ tsc -p tsconfig.json --noEmit
 （退出码 0）

$ pnpm check:extension
 PASS  apps/web 无按题型硬分派（扫描 45 个文件）
 PASS  apps/web 不直接判分
 PASS  core/grade.ts 不再包含 switch(q.type)
 PASS  Schema 6 成员 / 装配清单 6 条
 PASS  渲染器目录 6/6
 PASS  富文本注入唯一入口
 结论：扩展点干净
```

> 全量测试 63 个用例中含 `app.test.tsx` 的 15 个既有回归用例（W4 所有，未改一行）；
> 其中「换题库时知识讲义跟着换」曾在 P-1 草稿态因标题在导航+正文重复精确命中而失败，
> 以「标题带主题前缀（主题与标题同名时不重复）」修复，既有用例恢复全绿。

---

## 4. 验收逐条结果

| 编号 | 标准 | 结果 | 证据 |
| --- | --- | --- | --- |
| A-4 | 按篇切换 / 目录锚点 / 当前篇常驻 / 刷新仍在同一篇 | **通过** | 浏览器实测（选第 5 篇→刷新→SpringMVC）+ 组件测试（锚点 href↔id、重挂载恢复） |
| A-5 | 断网文字讲义完整可读、高亮正常、无控制台异常 | **通过** | 浏览器实测（8729 字 / 8 代码块 / 221 高亮 / 0 报错 / 全部资源 localhost） |
| A-6 | 「去练本节」知识点筛选生效，其它设置不变 | **通过** | `practiceLink.test.ts` 3 条不变式断言（只改 topicIds+onlyUnseen，其余保留，纯函数不改原对象） |
| A-7 | 讲义不写任何学习记录 | **通过** | `offline-persist.test.tsx`：localStorage 为空，sessionStorage 仅「当前篇」一条 |
| B-3 | 站外视频未点击前零第三方请求 | **通过** | 浏览器实测（点击前 iframe=0、第三方请求=[]）+ `zero-request.test.tsx` 结构性断言 |
| B-4 | 断网点播放显「需联网」，讲义仍可滚动跳转 | **通过** | 浏览器实测（hintShown=true、iframe=0、scrollable=true） |
| B-5 | 直链 mp4 可播放、startSec 生效 | **通过** | 浏览器实测（原生 video + currentTime=1）+ 组件单测（loadedmetadata→30s） |
| B-7 | 视频区不产生新 HTML 注入口，check:extension 通过 | **通过** | 扫描 6 项全 PASS；`VideoCard` 零 `dangerouslySetInnerHTML`，正文只走 `RichText` |
| W3-1 | web typecheck 通过（需 W1 dist） | **通过** | 冒烟树（W3 分支 + W1 core 源码/dist）tsc 退出码 0 |
| W3-2 | 组件级测试全绿，不改 app.test.tsx | **通过** | 20/20 全绿；`app.test.tsx` 零改动且其 15 用例全绿 |

---

## 5. P-1 / P-2 确认

- **P-2 已定 A · 路由三文件冻结**：**确认**。未改 `router.ts` / `App.tsx` / `ui/AppShell.tsx`；讲义入口在 `BanksPage` 内（精读区）。
- **P-1 保留草稿核对**：三个组件草稿（`KnowledgePanel` / `LectureArticle` / `VideoCard`）+ `BanksPage` 接线 + `styles.css` 讲义样式均已存在，**全部保留未重写**；在其基础上补：旧数据兜底（缺数组字段不崩）、items 要点渲染、A-4 持久化、B-4 断网提示、标题去重、锚点防劫持 hash、`practiceLink` 纯函数抽出 + 5 个测试文件。

---

## 6. 遗留问题

| # | 问题 | 影响 | 建议归属 |
| --- | --- | --- | --- |
| L-1 | W2 的 `knowledge.json` 视频地址均为 B 站合集外链，无直链 mp4 条目 | B-5 真实内容级手测用的是本地生成 webm；内容包里的 startSec 字段目前为空 | W2/INT：内容巡检时补直链样例 |
| L-2 | 站外 iframe 的第三方请求发生在 iframe 自身文档作用域，父页 resource timing 不可见 | 网络面板证据以「点击前 iframe=0 + 点击后 iframe.src=player.bilibili.com」为准 | INT 复验时开 DevTools Network 面板目视确认 |
| L-3 | 真实内容里 HLS / YouTube / page / invalid 四类无现成条目 | 这四类只走了组件级分支断言（jsdom） | W2 补样例后由 INT 复验 |
| L-4 | 共享工作树上另有窗口的未提交改动（如 `PlatformProvider.tsx` 的 cloud 引用悬空），主工作树全量 typecheck 会报 W5 领地的 6 个错误 | 与 W3 白名单无关；W3 验证在冒烟工作树隔离完成 | W5 收尾时补齐 `cloud/**` |

---

## 补充（2026-11-18）：UI 整体靠左修复

### 定位

浏览器打开后页面内容整体贴左、右侧大片空白。排查 `apps/web/src/styles.css` 的顶层布局链：

```
.shell  { display:flex }                    → 左侧 .sidebar 固定 216px
.content{ flex:1; padding:18px 20px 28px } → 剩余宽度全部给内容区
.page   { max-width:1040px }               → 只有最大宽度，没有居中
```

`.page` 是块级元素，缺 `margin: 0 auto` 时始终靠内容区左边缘对齐；
而旧容器 `.wrap` 本来写了 `margin:0 auto`，两代样式不一致导致新页面统一靠左。
`className="page"` 被 6 个页面组件共用（banks/exam/learn/me/practice/review），故一处修复覆盖全部页面。

### 修复（仅 styles.css 一处）

```css
.page { width: 100%; max-width: 1040px; margin: 0 auto; }
```

- `margin:0 auto` 让内容块在 `.content` 内水平居中；
- `width:100%` 保证窄屏按可用宽度自适应，不塌陷；
- 全局已有 `box-sizing:border-box`，与移动端 `@media (max-width:860px)` 的
  `.content` 左右 `padding: max(12px, env(safe-area-inset-*))` 不会叠加溢出。
- 未触碰 `.shell` / `.sidebar` / `router.ts` / `App.tsx` / `AppShell.tsx`（P-2 冻结）。

### 验证

```
$ pnpm --filter @quiz/web typecheck   → 退出码 0
$ pnpm --filter @quiz/web test        → 10 files / 63 tests 全绿
```

> 隔离 worktree 单跑时曾报 `@quiz/core` / `@quiz/content` 无法解析、以及
> `parseMediaSource is not a function`：因 W3 分支从基线创建，本身不含 W1 的契约与解析器，
> 按 14 号计划属「合并期兑现」的依赖。验证时临时注入 W1 的 core 源码模拟集成态后全绿；
> 注入文件已在提交前全部还原/删除，本次提交**只有 styles.css**。
