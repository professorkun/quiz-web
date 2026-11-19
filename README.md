# quiz-web · 通用刷题

一套**不预置题库**的通用刷题 Web 应用：把任意科目的题目资料转成题库包（JSON），导入即用。
学习 / 题库 / 刷题 / 模考 / 复习 / 我的，六个入口开箱即用。

- **空壳设计**：产品不含任何内置题库，打开即是刷题主页；尚未导入题库时，首页提供导入入口。
- **六种题型**：单选、多选、判断、填空、代码填空、简答（主观题自评打分）。
- **本地优先**：不登录也能用——题库与学习记录默认保存在浏览器本地（IndexedDB），可随时导出 JSON 备份。
- **登录云同步**：支持手机验证码 / 微信 / WorkBuddy 登录，学习记录可同步到云端（WorkBuddy 云），题库包也可备份到云端、换设备恢复。
- **PWA**：可安装到桌面，离线可用。

---

## 1. 快速开始

```bash
cd web-v2
pnpm install
pnpm dev          # http://localhost:5173
```

打开即是刷题主页——尚未导入题库时，在首页选择一份题库包（`.json`）导入，即可开始练习。

```bash
pnpm verify       # 边界扫描 + 扩展点扫描 + 构建 + 全量单测（提交前跑这个）
```

> 技术细节（包结构、ADR、数据契约）见 [`web-v2/docs/`](web-v2/docs/)；本页是产品介绍与题库制作入口。

## 2. 题库包格式（`quiz.bank` JSON）

导入的文件是一个 JSON 对象，顶层**只允许四个字段**：

```json
{
  "kind": "quiz.bank",
  "manifest": { "schemaVersion": 1, "bankId": "os_final", "title": "操作系统期末题库", "...": "..." },
  "questions": [ "…" ],
  "knowledge": []
}
```

| 字段 | 说明 |
| --- | --- |
| `kind` | 固定 `"quiz.bank"`，标识这是一个题库包 |
| `manifest` | 题库清单：`bankId` / `title` / `questionCount`（必须等于题目数）/ `topics`（至少 1 个知识点）/ `examTemplates`（模考模板）/ `createdAt` |
| `questions` | 题目数组，每题含共同字段 + 题型专属字段（见下） |
| `knowledge` | 讲义数组，可为空 `[]` |

每道题的共同字段：`schemaVersion`(1)、`questionId`（形如 `os_final:single_choice:001`，题型段必须与 `type` 一致）、`bankId`（与 manifest 相同）、`revision`（12 位小写十六进制）、`topicIds`（引用 manifest 里的知识点，至少 1 个）、`stem`、`explanation?`、`legacyKeys`(`[]`)。

六种题型的专属字段：

| `type` | 专属字段 | 答案 |
| --- | --- | --- |
| `single_choice` | `options`：`[{optionId, text}]` ≥2 | `answer`：单个 `optionId` |
| `multiple_choice` | `options` ≥2 | `answer`：`optionId` 数组 |
| `true_false` | — | `answer`：`true` / `false` |
| `fill_blank` | `blanks`：`[{blankId, accepted[], hint?}]` ≥1，题干里用 `{{blankId}}` 标空位 | 每空一组等价写法 |
| `code_blank` | `files`：`[{fileId, label, language, code, solutionCode?}]` + `blanks`，代码里用 `___(blankId)___` 标空位 | 每空一组等价写法 |
| `short_answer` | `rubric`：`[{pointId, text, score}]` ≥1 | 按采分点自评 |

导入校验**宁可拒绝、不静默丢题**：字段拼错、选项答案引用不存在的 `optionId`、空位标记对不上、题量与 `questionCount` 不符，都会整包拒绝并给出精确到题目字段的错误位置。

完整 schema 见 [`web-v2/packages/core/src/schema.ts`](web-v2/packages/core/src/schema.ts)，样例见 [`web-v2/apps/web/src/data/demoBank.ts`](web-v2/apps/web/src/data/demoBank.ts)。

## 3. 用 AI 把文档转成题库包（转换提示词）

手写几百道题的 JSON 不现实。把下面的提示词连同你的题目文档（Word / PDF / Markdown / 纯文本均可）一起发给任意 AI 助手（WorkBuddy、ChatGPT、Claude……），让它输出可直接导入的题库包 JSON。

**用法**：复制下方整块提示词 → 粘贴给 AI → 在提示词末尾附上你的文档内容 → 把 AI 返回的 JSON 保存为 `xxx.json` → 在应用「我的 → 数据导入导出」或首屏引导页导入。若被拒绝，把应用报错原样贴回给 AI 让它修复。

````text
你是题库数据转换器。请把我提供的文档内容转换为「通用刷题」应用的题库包 JSON。
要求：只输出纯 JSON 本身（不要解释文字、不要 Markdown 代码块包裹），JSON 必须能通过下述全部校验规则。

【一、顶层结构】只允许 4 个字段，不多不少：
{
  "kind": "quiz.bank",
  "manifest": { …见【二】… },
  "questions": [ …见【三】【四】… ],
  "knowledge": []
}
knowledge 固定输出空数组。

【二、manifest 题库清单】
{
  "schemaVersion": 1,
  "bankId": "小写英文/数字/下划线，如 os_final",
  "title": "题库标题",
  "subject": "科目名（可省略）",
  "questionCount": 与 questions 数组长度严格相等的整数,
  "topics": [
    { "topicId": "<bankId>:topic:001", "bankId": "同 manifest.bankId", "name": "知识点名称", "order": 0 }
  ],
  "examTemplates": [ …见【五】… ],
  "createdAt": "2026-01-01T00:00:00.000Z"
}
规则：
- topics 至少 1 个；按文档章节/知识体系划分，每道题必须归属至少一个 topicId。
- topicId 形如 <bankId>:topic:001，全包唯一。
- 不要输出上述清单以外的字段（多余字段会被整包拒绝）。

【三、每道题的共同字段】
{
  "schemaVersion": 1,
  "questionId": "<bankId>:<type>:<三位数以上序号，如 001>",
  "bankId": "同 manifest.bankId",
  "revision": "12 位小写十六进制，见下方说明",
  "topicIds": ["引用 manifest.topics 中的 topicId，至少 1 个"],
  "stem": "题干原文",
  "explanation": "解析（文档有才写，可省略）",
  "legacyKeys": [],
  "type": "题型名",
  …题型专属字段，见【四】
}
规则：
- questionId 的题型段必须与 type 一致（例如 os_final:single_choice:001 的 type 必须是 single_choice）。
- questionId 全包唯一，序号从 001 起连续补零。
- revision：恰好 12 位小写十六进制字符。推荐对「题干+答案」取确定性哈希（如 MD5 前 12 位）；无法精确计算时，可按题目顺序生成 000000000001、000000000002……（必须 12 位）。同一题内容不变时该值保持稳定即可。
- legacyKeys 固定输出 []。
- 绝对不要输出 tags、difficulty 或任何未列出的字段——出现未知字段整包会被拒绝。

【四、六种题型的专属字段】

1) single_choice 单选
   "type": "single_choice",
   "options": [ { "optionId": "o1", "text": "选项A" }, { "optionId": "o2", "text": "选项B" } ],  // 至少 2 个
   "answer": "o1"    // 单个 optionId

2) multiple_choice 多选
   "type": "multiple_choice",
   "options": [ …至少 2 个，同上… ],
   "answer": ["o1", "o3"]    // optionId 数组，至少 1 个

3) true_false 判断
   "type": "true_false",
   "answer": true    // 布尔值；「对/√/正确」→ true，「错/×/错误」→ false

4) fill_blank 填空
   "type": "fill_blank",
   "stem": "题干中用 {{b1}}、{{b2}} 标出每个空位",
   "blanks": [
     { "blankId": "b1", "accepted": ["标准答案", "可接受的等价写法"], "hint": "可省略" }
   ]
   规则：每个 blank 的 {{blankId}} 必须出现在 stem 中；accepted 至少 1 个写法。

5) code_blank 代码填空
   "type": "code_blank",
   "files": [
     { "fileId": "f1", "label": "Main.java", "language": "java",
       "code": "挖空后的代码，空位写成 ___(b1)___",
       "solutionCode": "完整答案代码，可省略" }
   ],
   "blanks": [
     { "blankId": "b1", "fileId": "f1", "accepted": ["答案"], "hint": "可省略" }
   ]
   规则：每个 blank 的标记 ___(blankId)___ 必须出现在其 fileId 指向的 code 里；
   code 里出现的每个标记都必须有对应的 blank（不能有无答案的孤儿标记）。

6) short_answer 简答
   "type": "short_answer",
   "rubric": [
     { "pointId": "r1", "text": "采分点描述", "score": 2 },   // score > 0，至少 1 个采分点
     { "pointId": "r2", "text": "第二个采分点", "score": 3 }
   ]

【五、examTemplates 模考模板】至少输出 1 个：
{
  "templateId": "<bankId>:exam:full",
  "bankId": "同 manifest.bankId",
  "title": "全真模考",
  "durationSec": 3600,
  "sections": [
    { "sectionId": "s1", "title": "单选题", "questionType": "single_choice", "count": 20, "scoreEach": 2 },
    { "sectionId": "s2", "title": "判断题", "questionType": "true_false", "count": 10, "scoreEach": 1 }
  ],
  "totalScore": 50
}
规则：
- sections 的 count × scoreEach 之和必须等于 totalScore。
- 每个 section 的 count 不得超过该题型实际拥有的题数；只包含文档里实际存在的题型。
- durationSec 为秒，可省略（省略 = 不限时）。

【六、转换纪律】
1. 以文档为准：不捏造文档里没有的题目；答案、选项文字忠实于原文（可轻度规整格式，不改语义）。
2. 题型识别：明确「多选」→ multiple_choice；「判断/对错」→ true_false；挖空填空 → fill_blank；带代码挖空 → code_blank；「简答/问答/论述」→ short_answer（把答案拆成采分点）；其余 → single_choice。
3. 输出前自检：questionCount = 题目数；questionId / topicId 全包唯一；每题 topicIds 都能在 topics 里找到；选择题 answer 引用的 optionId 都存在；填空/代码填空的每个标记都有答案。
4. 只输出 JSON，从 { 开始到 } 结束。

我的文档内容如下：
```（把文档内容粘贴在这里）```
````

> 提示：仓库里的 [`JavaWeb期末全题型题库.md`](JavaWeb期末全题型题库.md) 是一份完整样例文档（147 题、5 种题型），可以直接拿来试跑这条提示词。

## 4. 构建产物与部署

```bash
cd web-v2
pnpm build        # 产物在 apps/web/dist/
```

产物是纯静态站点，可用任意静态服务器托管；WorkBuddy「发布为应用」可一键发布到保留域名（云登录需要与云同域的 HTTPS Origin）。仓库根的 `.wbapp_*.genie` 是本机发布凭据，不入库。

## 5. 仓库构成

| 路径 | 说明 |
| --- | --- |
| `web-v2/` | **当前产品**：通用刷题 Web 应用（源码、测试、ADR、报告） |
| `JavaWeb期末全题型题库.md` | 样例文档：147 题的原始 Markdown，可作转换提示词的测试材料 |
| `项目规划/` | 阶段计划、执行协议与任务窗口记录 |
| `通用刷题Web改造方案与执行计划.md` 等根目录文档 | 历史方案与交接文档，保留备查 |
| `题库网页/`、`sdk.js`、`tools/` | 旧版单文件应用与数据导出工具，历史留存 |

## 6. 常见问题

**导入被拒绝怎么办？** 应用会指出具体是哪道题的哪个字段有问题（如 `questions[12].answer 引用了不存在的 optionId`）。把报错原文贴回给 AI，让它修好后重新输出整包即可。整包要么导入成功，要么完全不写入——不存在导入一半的情况。

**数据存在哪里？** 不登录：全部在浏览器本地（IndexedDB），换浏览器/清缓存会丢，建议定期用「我的 → 数据导入导出」备份。登录后：学习记录可同步云端。

**能改题目吗？** 题库包是纯 JSON，改完重新导入即可（同 `bankId` 覆盖）。`revision` 是内容指纹——内容变了应换新值。
