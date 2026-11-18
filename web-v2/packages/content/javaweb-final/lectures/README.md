# lectures/ — 讲义 Markdown 源

`../knowledge.json` 是**生成物**，不要手改。改讲义只改这里的 `.md`，然后：

```bash
pnpm knowledge:build        # 在 web-v2 根目录执行
```

生成脚本会顺带跑一遍契约校验（缺字段、视频地址为空、空讲义都会当场报错并退出非 0）。

## 文件命名

`NN-<slug>.md`，`NN` 决定阅读顺序。当前 7 篇对应 `manifest.json` 的 7 个 topic：

| 文件 | topicId |
| --- | --- |
| `00-web-base.md` | `javaweb:topic:web_base` |
| `01-jsp.md` | `javaweb:topic:jsp` |
| `02-servlet.md` | `javaweb:topic:servlet` |
| `03-spring.md` | `javaweb:topic:spring` |
| `04-springmvc.md` | `javaweb:topic:springmvc` |
| `05-mybatis.md` | `javaweb:topic:mybatis` |
| `06-jdbc.md` | `javaweb:topic:jdbc` |

## front matter 字段

```yaml
---
moduleId: javaweb:kb:servlet      # 必填，全局唯一
topicId: javaweb:topic:servlet    # 必填，必须在 manifest.topics 里存在
title: Servlet                    # 必填，讲义标题
summary: 一句话说明这一节讲什么      # 必填，列表页展示
minutes: 35                       # 选填，预计精读分钟数
examFocus: 简答必考……              # 选填，考点与常见问法，一句话
goals:                            # 选填，3~5 条，动词开头
  - 能默写 Servlet 生命周期的四个阶段
pitfalls:                         # 选填，易错点，展示在正文之后
  - destroy 不要拼成 destory
videos:                           # 选填，格式：标题 | 地址 | 说明；可整块省略
resources:                        # 选填，格式同上
  - Jakarta Servlet 规范 | https://jakarta.ee/specifications/servlet/
---
```

### 视频是可选扩展位（不绑定当前题库）

**当前题库（javaweb-final）不预置任何视频**：7 篇源文件的 `videos` 全部留空，
生成出的 `knowledge.json` 里每篇 `videos: []`。视频能力本身没有删除，只是不塞
属于某个具体题库的内容数据——避免"换个题库就带着别人的课程链接"。

后续导入**新题库**时，无需改任何代码，只要在新题库的讲义 `front matter` 里填：

```yaml
videos:
  - 课程标题 | https://www.bilibili.com/video/BV1Y7411K7zz | 从对应章节看起
```

然后重跑生成脚本即可。整条链路已经就绪、默认空转：

| 层 | 已保留的扩展入口 | 位置 |
| --- | --- | --- |
| 数据契约 | `KnowledgeVideoSchema`（`url` 必填，`title`/`note`/`startSec` 可选） | W1 · `packages/core/src/schema.ts` |
| 地址解析 | `parseMediaSource` 纯函数（B站/YouTube/直链/HLS/网页/非法协议） | W1 · `packages/core/src/media.ts` |
| 内容生成 | `parseTriples(meta.videos, …)`：留空 → `[]`，填了 → 校验地址非空且可解析 | W2 · `scripts/build-knowledge.mjs` |
| 质量门禁 | 允许 `videos` 为空；一旦填了就逐条校验可解析 | W2 · `src/knowledge.test.ts` |
| 界面渲染 | `VideoCard` 按 `kind` 分支（原生 video / iframe 点击才加载 / 提示卡） | W3 · `features/knowledge/VideoCard.tsx` |

`videos: []` 时界面不渲染任何视频区，讲义正文照常完整可读、断网不受影响。

### 视频地址能填什么

地址由 `@quiz/core` 的 `parseMediaSource` 解析，支持：

| 写法 | 效果 |
| --- | --- |
| `https://..../a.mp4`（mp4/webm/ogv/m4v/mov） | 原生播放器，可直接拖进度 |
| `./media/a.mp4`（相对路径） | 原生播放器，不算联网（随包分发） |
| `https://..../master.m3u8` | HLS，Safari 原生可播，其它浏览器提示换 mp4 |
| `https://www.bilibili.com/video/BV1Y7411K7zz?p=3` 或裸 `BV1Y7411K7zz` | B 站站外播放器（点击后才加载） |
| `https://youtu.be/<id>` | YouTube nocookie 嵌入（国内网络通常不可达） |
| 其它网页 | 不内嵌，只给"去原站看" |

**不要填 `b23.tv` 短链**：离线解析不出 BV 号，只能降级成跳转。`javascript:` / `data:` 会被直接判非法。

## 正文约定

- 用 `## ` 二级标题切小节，**第一个 `##` 之前的内容不会进讲义**（脚本会警告字数）。
- 支持全部 GitHub 风格 Markdown：表格、代码块（java/xml/sql 会高亮）、`$$公式$$`。
- 代码块里不要出现以 `## ` 开头的行，否则会被当成小节标题切开。
- 写 HTML 标签要用反引号包起来或放进代码块，避免被渲染成真实标签。

## 质量门禁

`packages/content/src/knowledge.test.ts` 对每篇强制要求：≥8 节、≥3000 字、有代码块、有表格、
≥3 条学习目标、≥1 条视频、≥2 条易错点、小节标题不重复。**调低阈值等于降低验收标准**，
要改就同步改 `docs/reports/s6-review-and-improvement-plan.md` 里的验收条款。
