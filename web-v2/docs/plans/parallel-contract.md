# S7-E8 并行开发冻结契约（G0）

> 本文件是 S7-E8 六个窗口的**唯一接口权威**。各窗口只读，不得修改。
> 任何字段/签名变更必须先走文末「契约变更单」流程：发起人 → G0 更新本文件 → 广播全部窗口 → 各窗口确认。
> 窗口之间禁止私下单约；本文件与其它文档摘要冲突时，以本文件为准。

| 项 | 内容 |
| --- | --- |
| 冻结人 | G0 窗口 |
| 冻结日期 | 2026-11-18 |
| 基线分支 / tag | `integrate/s7-e8` / `s7e8-baseline-20261118`（commit 见 `reports/w0-freeze-report.md`） |
| 契约适用范围 | W1～W6 的 S7-E8 开发；INT 集成验证 |
| 事实来源 | 已保留草稿 `packages/core/src/{schema,media,validate,index}.ts`、对应单测、`packages/content/scripts/build-knowledge.mjs`（P-1 保留，见第 0 节） |

---

## 0. 已决结论与全员纪律

### 0.1 P-1 = 保留草稿（用户 · 2026-11-18 决断）

- 已存在的未提交草稿**不撤销、不重写、不覆盖**。
- 各窗口第一件事是核对本范围草稿是否已存在；存在则**纳入版本管理**（在各自窗口分支提交），再按本契约与验收标准补验证，**不重复实现同一份东西**。
- 新增一律优先新建文件，避免改动既有文件造成同行冲突。

### 0.2 P-2 = 先按 A：题库页内精读区，路由冻结（用户 · 2026-11-18 决断）

- 讲义入口由 W3 在 `BanksPage.tsx` 内实现，**不动路由**。
- `apps/web/src/router.ts`、`App.tsx`、`ui/AppShell.tsx` **三方全线冻结**，当前口径下任何窗口不得改。
- 后续若改选 B（独立「知识」Tab），必须由 G0 发契约变更单：把三个路由/外壳文件整体划归 W4、W3 改为交付不带路由的纯组件，并广播全部窗口。变更前的 A 结论仍是当前唯一有效口径。

---

## 1. TS 类型签名（可直接抄进代码）

> 以下签名与已保留草稿 `packages/core/src/schema.ts` / `media.ts` / `validate.ts` 逐字一致。W1 照此实现/核对，不得增删改名。

### 1.1 新增子结构（在 `schema.ts` 定义，从 `index.ts` 导出）

```ts
export const KnowledgeSectionSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1), // Markdown 正文，走 renderRichText（marked → DOMPurify）
});
export type KnowledgeSection = z.infer<typeof KnowledgeSectionSchema>;

export const KnowledgeVideoSchema = z.object({
  url: z.string().min(1),                       // 必填，缺 url 判不合法
  title: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  startSec: z.number().int().nonnegative().optional(),
});
export type KnowledgeVideo = z.infer<typeof KnowledgeVideoSchema>;

export const KnowledgeResourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  note: z.string().min(1).optional(),
});
export type KnowledgeResource = z.infer<typeof KnowledgeResourceSchema>;
```

### 1.2 `KnowledgeModule`（6 个新增可选字段 + `items` 缺省 `[]`）

```ts
export const KnowledgeModuleSchema = z.object({
  moduleId: IdStr,
  topicId: IdStr,
  title: z.string().min(1),
  summary: z.string().min(1),
  items: z.array(KnowledgeItemSchema).default([]),          // 由 min(1) 放宽为缺省空数组
  pitfalls: z.array(z.string().min(1)).default([]),          // 旧字段，兼容保留
  goals: z.array(z.string().min(1)).default([]),             // 新增①
  sections: z.array(KnowledgeSectionSchema).default([]),     // 新增②
  videos: z.array(KnowledgeVideoSchema).default([]),         // 新增③
  resources: z.array(KnowledgeResourceSchema).default([]),   // 新增④
  estimatedMinutes: z.number().int().positive().optional(),  // 新增⑤
  examFocus: z.string().min(1).optional(),                   // 新增⑥
});
export type KnowledgeModule = z.infer<typeof KnowledgeModuleSchema>;
```

六个新增可选字段 = `goals` / `sections` / `videos` / `resources` / `estimatedMinutes` / `examFocus`；`pitfalls` 是旧字段（旧版 `pits`），不在"六个新增"之列。旧数据（含 legacy 迁移产物、第二学科题库）全部保持合法，缺字段由 `.default([])` 补空数组，而**不是** `undefined`；`estimatedMinutes` / `examFocus` 才是不补的默认缺省。

> 语义约束（`items` 与 `sections` 不得同时为空）不在 Zod 形状层表达，放在 `validateKnowledgeModules` 里给出可定位错误，见第 3 节。

### 1.3 `validateKnowledgeModules` 签名与结果

```ts
export interface KnowledgeValidateResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly modules: readonly KnowledgeModule[];
}
export function validateKnowledgeModules(input: unknown): KnowledgeValidateResult;
```

`ValidationIssue` 形状（沿用）：

```ts
export interface ValidationIssue {
  readonly code: ValidationCode;      // 见 3.2
  readonly message: string;
  readonly path?: string;             // JSON 路径，如 knowledge[1].sections
}
```

行为要点：
- `input` 非数组 → `ok:false`，`issues[0].path === "knowledge"`，`message:"knowledge 必须是数组"`。
- 单篇形状错误 → 每个 Zod issue 转一条 `SCHEMA_INVALID`，`path = knowledge[i].<zod path>`。
- 语义错误（items 与 sections 同时为空）→ 一条 `SCHEMA_INVALID`，`path = knowledge[i]`。
- 通过的模块才进 `modules`；失败篇目不进。

### 1.4 `parseMediaSource` 签名与 `MediaSource` 全部字段

```ts
export type MediaKind =
  | "file"       // 原生 <video> 可播（mp4/webm/ogv/ogg/m4v/mov）
  | "hls"        // m3u8
  | "bilibili"   // B 站站外 iframe
  | "youtube"    // nocookie 域名嵌入
  | "page"       // 普通网页：不内嵌，只给"去原站看"
  | "invalid";   // 空串、非法协议、认不出来

export interface MediaSource {
  readonly kind: MediaKind;
  readonly provider: string;                 // 站点/形态中文名，用于按钮与提示文案
  readonly watchUrl: string | null;          // 规范化"去原站看"地址；invalid 为 null
  readonly embedUrl: string | null;          // 内嵌地址；page 与 invalid 为 null
  readonly id: string | null;                // BV 号 / av 号 / YouTube id / HLS 地址
  readonly nativeVideo: boolean;             // 只有 file 为 true
  readonly needsNetwork: boolean;            // 相对路径本地文件为 false
  readonly reason: string | null;            // 判 invalid 的原因，UI 直接展示
}

export function parseMediaSource(
  raw: string,
  options: { readonly page?: number } = {},
): MediaSource;
```

**实现硬约束**：core 的 tsconfig 不引 DOM / Node 类型（ADR-0002 平台无关）。解析器**不得使用 DOM 的 `URL`**，一律正则实现；`check:boundaries` 会兜底扫描。

---

## 2. `parseMediaSource` 行为表（11 种输入，逐行期望）

> 与草稿 `media.ts` + `media.test.ts` 一致。W1 实现/联验、W3 渲染分支、W2 填视频地址均以此表为准。

| # | 输入 | 期望 `kind` | 期望 `watchUrl` | 关键附加断言 |
| --- | --- | --- | --- | --- |
| 1 | `https://www.bilibili.com/video/BV1Y7411K7zz?p=3` | `bilibili` | `https://www.bilibili.com/video/BV1Y7411K7zz?p=3` | `id="BV1Y7411K7zz"`；`embedUrl` 含 `bvid=BV1Y7411K7zz` 与 `page=3`；`needsNetwork=true`；`nativeVideo=false` |
| 2 | `BV1Vf4y127N5`（裸 BV 号） | `bilibili` | `https://www.bilibili.com/video/BV1Vf4y127N5` | `id="BV1Vf4y127N5"`；`page` 取 `options.page` |
| 3 | `https://www.bilibili.com/video/av69742084`（av 号） | `bilibili` | `https://www.bilibili.com/video/av69742084` | `id="av69742084"`；`embedUrl` 含 `aid=69742084` 且**不含** `bvid=` |
| 4 | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` / `https://youtu.be/dQw4w9WgXcQ` / `https://www.youtube.com/embed/dQw4w9WgXcQ`（三种写法） | `youtube` | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | 三种归一到同一 `id="dQw4w9WgXcQ"`；`embedUrl` 含 `youtube-nocookie.com/embed/dQw4w9WgXcQ` |
| 5 | `https://cdn.example.com/lesson1.mp4?token=abc`（mp4 直链，带 query） | `file` | `https://cdn.example.com/lesson1.mp4?token=abc`（原串） | `nativeVideo=true`；`embedUrl` = 原串；query 不影响扩展名判断 |
| 6 | `./media/servlet-lifecycle.webm`（相对路径） | `file` | `./media/servlet-lifecycle.webm`（原串） | `nativeVideo=true`；**`needsNetwork=false`** |
| 7 | `https://example.com/live/master.m3u8`（HLS） | `hls` | `https://example.com/live/master.m3u8` | `nativeVideo=false`；`embedUrl` = 原串 |
| 8 | `https://tomcat.apache.org/`（普通网页） | `page` | `https://tomcat.apache.org/` | `embedUrl=null`；`id=null`；`reason=null` |
| 9 | `https://b23.tv/abc123`（短链） | `page` | `https://b23.tv/abc123`（原串） | `embedUrl=null`；`provider="哔哩哔哩（短链）"`；离线不硬猜 BV 号 |
| 10 | `javascript:alert(1)`（非法协议；`data:` / `vbscript:` / `file:` 同类） | `invalid` | `null` | `reason="不允许 javascript:/data: 这类地址"`；`embedUrl=null`；`id=null` |
| 11 | `""` 或全空白 `   `（空串） | `invalid` | `null` | `reason="视频地址为空"` |

补充边界（不单列行，但须满足）：
- `https://www.bilibili.com/`（看着像 B 站但无 BV/av 号）→ `invalid`，`reason` 含 `BV 号`。
- `https://www.youtube.com/watch?v=短id`（无 11 位 id）→ `invalid`，`reason` 含 `11 位视频 id`。
- `https://example.com/page.html`（绝对 http 但非可播扩展名）→ `page`，`embedUrl=null`。
- 任意"既不是可播放直链、也不是可识别站点"的字符串 → `invalid`，`reason` 含 `既不是`。

**UI 渲染纪律（W3）**：`file` 用原生 `<video>`（可带 `startSec`）；`hls` 给"HLS 差异提示"；`bilibili`/`youtube` 站外 iframe **点击后才加载**，未点击零第三方请求，另给 `watchUrl` 跳转；`page`/`invalid` 只给跳转卡或提示卡，不拼裸 `src`，不做黑框。

---

## 3. 导入错误码格式

### 3.1 统一格式

```
[SCHEMA_INVALID] knowledge[i].字段: 说明
```

- `[SCHEMA_INVALID]` 为 `ValidationCode.SCHEMA_INVALID` 的展示前缀。
- `knowledge[i]` 为数组下标（从 0 起），`字段` 为 Zod issue 路径；无具体字段的整体错误只写到 `knowledge[i]`。
- 对应 `ValidationIssue`：`{ code: "SCHEMA_INVALID", message: "<说明>", path: "knowledge[i].字段" }`。

示例：
```
[SCHEMA_INVALID] knowledge[1].sections: 讲义「空壳」既没有要点（items）也没有正文（sections）
[SCHEMA_INVALID] knowledge[0].videos.0.url: 必填字段
```

### 3.2 `ValidationCode` 全集（沿用草稿 `validate.ts`）

`SCHEMA_INVALID` / `DUP_QUESTION_ID` / `DUP_TOPIC_ID` / `UNKNOWN_TOPIC` / `DUP_LEGACY_KEY` / `BANK_MISMATCH` / `QUESTION_COUNT_MISMATCH` / `UNKNOWN_FIELD` / `SCHEMA_VERSION_UNSUPPORTED`。

未知字段策略：拒绝并定位（`UNKNOWN_FIELD`），不静默丢弃——Zod 默认 strip 未知字段是最危险行为，必须反过来。导入失败**不写入**任何存储。

---

## 4. 讲义 Markdown front matter 字段表与切节规则

> 与草稿 `packages/content/scripts/build-knowledge.mjs` 的 `parseFrontMatter` / `splitSections` / 讲义目录 `README.md` 一致。W2 照此产出，生成脚本自带格式校验。

### 4.1 front matter 字段表

文件首行必须 `---`，以 `\n---` 闭合；每行形如 `键: 值`，值留空表示其后 `- ` 列表项归该键（简单 YAML 子集，不引依赖）。

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `moduleId` | ✅ | string | 全局唯一，形如 `javaweb:kb:servlet` |
| `topicId` | ✅ | string | 必须在 `manifest.topics` 中存在 |
| `title` | ✅ | string | 讲义标题 |
| `summary` | ✅ | string | 一句话，列表页展示 |
| `minutes` | ❌ | number（字符串解析为数字）→ `estimatedMinutes` | 预计精读分钟数 |
| `examFocus` | ❌ | string → `examFocus` | 考点与常见问法，一句话 |
| `goals` | ❌ | string[] | 3～5 条，动词开头 |
| `pitfalls` | ❌ | string[] → `pitfalls` | 易错点，正文之后展示 |
| `videos` | ❌ | string[] → `KnowledgeVideo[]` | 每项 `标题 \| 地址 \| 说明`，地址必填 |
| `resources` | ❌ | string[] → `KnowledgeResource[]` | 每项 `标题 \| 地址 \| 说明`，地址必填 |

- `videos` / `resources` 三元组用 `|` 分段（标题可空、地址必填、说明可空）；解析后 `title` 为空则省略该键，`note` 为空则省略。
- 生成脚本对四个必填项（`moduleId`/`topicId`/`title`/`summary`）缺失直接报错；对 `sections.length===0` 报错；最终产物过 `validateKnowledgeModules`，不过则退出非 0。
- `knowledge.json` 是**生成物，禁止手改**；改内容只改 `.md` 后重跑 `pnpm knowledge:build`。脚本重跑两次产物字节一致。

### 4.2 `##` 切节规则

- 以 `## `（二级标题 + 空格）切小节，标题为 `## ` 之后的文本（trim）。
- **第一个 `##` 之前的内容（导语）不进讲义**，脚本会打印字数警告。
- 小节正文为标题行到下一个 `##` 之间的内容，trim 后为空的小节丢弃。
- 代码块内不要出现以 `## ` 开头的行，否则会被误切为小节标题。
- 正文是 Markdown，走既有 `renderRichText`（marked → DOMPurify），支持表格/代码块/公式 `$$…$$`；HTML 标签需包反引号或放代码块，避免被当真实标签。
- HTML 标签一律经 DOMPurify，防注入（R-08 / B-7）；视频区不引入 DOMPurify 之外的新注入口。

---

## 5. 所有权矩阵 + 六个窗口分支 + 合并顺序

### 5.1 文件所有权矩阵（与 14 号 §3 逐行一致）

| 路径 / 模式 | 独占窗口 | 其它窗口允许做的事 |
| --- | --- | --- |
| `packages/core/src/**`（含 `schema.ts` `validate.ts` `index.ts` `media.ts` 及测试） | **W1** | 只读 import |
| `packages/data/src/**` | **W1** | 只读 import |
| `packages/content/**`（含 `lectures/**`、`knowledge.json`、生成脚本、content 单测） | **W2** | 只读引用 |
| `apps/web/src/features/knowledge/**` | **W3** | 只读 |
| `apps/web/src/features/banks/BanksPage.tsx` | **W3** | 只读 |
| `apps/web/src/styles.css` | **W3** | W4 只提「样式需求清单」，由 W3 落地 |
| `apps/web/src/features/practice/**`、`features/me/ImportExport.tsx` | **W4** | 只读 |
| `apps/web/src/app.test.tsx` 及 features 下既有测试 | **W4** | W3 的新测试写在 `features/knowledge/**` 内，不碰 `app.test.tsx` |
| `apps/web/src/router.ts`、`App.tsx`、`ui/AppShell.tsx` | **冻结**（P-2 已决 A）；后续改选 B 须走契约变更单并整体划归 W4 | 当前口径下任何窗口不得改 |
| `apps/web/src/cloud/**`、`docs/cloud/**`、`.github/workflows/**`、`apps/web/public/**` | **W5** | 只读 |
| `项目规划/07-S6-云同步PWA与发布切换.md` | **W5** | 其它窗口不改 |
| `项目规划/00`、`08`、`13`、`14`、`README.md`、`T0-7-文件职责表.md` | **W6** | W5 交「状态数据」由 W6 回填 |
| `web-v2/docs/adr/**` | **W6** | 只读 |
| `web-v2/docs/reports/**` | 各窗口**只能新建自己的报告文件**（前缀 `w1-` / `w2-` …） | 禁止改已有报告及他人报告 |
| 所有 `package.json`、`pnpm-lock.yaml` | **W6** | W2 只提供脚本文件，不自行登记 npm script |
| `*/dist/**`、`build/.pyi/**`、`apps/web/deploy-site/**` | **不提交**；集成窗口统一重建 | 各窗口本地构建可读，禁止提交产物 |
| 根目录旧版（`_build/**`、`*.html`、`题库网页/**`） | **冻结** | 任何窗口不得改（README §2 硬规则） |

三条通用纪律：
1. **新增文件优先**：能新建就不改既有文件。
2. **禁止跨窗口提交**：一个 commit 只属于一个窗口，提交信息带窗口前缀（如 `feat(s7e8-w3): …`）。
3. **契约变更单**：G0 冻结后改接口，先改本文件并广播，不允许"我这边先改了再说"。

### 5.2 六个窗口分支（均从基线 `s7e8-baseline-20261118` 创建）

| 窗口 | 分支 | 一句话定位 |
| --- | --- | --- |
| W1 | `feat/s7e8-core-contract` | 契约、URL 解析、导入校验（最先合并） |
| W2 | `content/s7e8-lectures` | 7 篇讲义源与生成脚本 |
| W3 | `feat/s7e8-lecture-ui` | 精读界面与视频播放 |
| W4 | `fix/s7e8-ui-consistency` | 清占位、补回归用例 |
| W5 | `chore/s6-closeout` | 真实迁移、回退演练、双 CI（碰真实数据） |
| W6 | `docs/s7e8-integration` | ADR、变更登记、changelog（最后回填） |
| INT | `integrate/s7-e8`（集成分支，不新增功能） | 唯一最终判定与证据表 |

### 5.3 合并顺序（串行，W1～W6 编码期可并行）

`G0（基线）→ W1（先合，`pnpm -r build` 产 dist）→ W2（rebase，复验 knowledge.json）→ W3（rebase，需 W1 类型 + W2 数据 typecheck）→ W4 → W5（可提前，建议早合跑 CI）→ W6 收尾回填 → INT 整体集成验证`

- 允许真正并行的是 W1～W6 的编码/写作阶段；合并、对账、发布验证、文档回填一律串行。
- **W5 正式迁移与 W1 契约变更不得同时生效**：契约未冻结前不迁数据。
- 单窗口报告只作过程留痕，**只有 INT 的证据表算最终判定**。

---

## 6. 契约变更单流程

```
发起人（任一窗口）
  → 在 docs/plans/ 提变更申请，写明：改哪个字段/签名、影响哪些窗口、理由
  → G0 更新本契约文本（改版本号、记录变更日期与发起人）
  → G0 广播全部窗口（W1~W6 + INT）
  → 各窗口回复确认，按新契约调整
  → 未完成确认前，旧契约仍有效，禁止任何窗口"先改了再说"
```

窗口间私下约定一律无效；合并时类型对不上的，以本文件为准回溯责任。
