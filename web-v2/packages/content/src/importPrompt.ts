/**
 * 题库包转换提示词 v2（V2.1 · R1.4）。
 *
 * 这份常量是**唯一权威源**：README §3 的提示词必须与它逐字一致（有测试校验）。
 * 提示词与校验器是同一份契约的两面——校验器收紧/放宽，提示词必须同步，
 * 否则用户会拿到「照着提示词写却被拒绝」的产物。
 *
 * v2 相对 v1 的变化：
 * 1. 讲义不再是空数组占位，而是可选的完整规范（含只挂课程链接的合法形态）；
 * 2. 明确三向关联：topicId ↔ question.topicIds ↔ knowledge.topicId；
 * 3. 开放可选 `tags` / `difficulty`，并给出取值；
 * 4. 增补英语六类题型的映射表与「听力不导入」的纪律；
 * 5. 输出前自检清单逐条可勾选。
 */

export const IMPORT_PROMPT_VERSION = "v2" as const;

export const IMPORT_PROMPT_V2 = `题斋题库包转换器 v2（契约版本 schemaVersion = 1）

你是题库数据转换器。请把我提供的文档内容转换为「题斋」的题库包 JSON。
只输出纯 JSON 本身：不要解释文字、不要 Markdown 代码块包裹，JSON 必须能通过下述全部校验规则。

【零、输出纪律】
1. 以文档为准：不捏造文档里没有的题目；答案、选项文字忠实于原文（可轻度规整格式，不改语义）。
2. 顶层只允许 kind / manifest / questions / knowledge 四个字段，不多不少。
3. 题目与 manifest 上出现契约里没有的字段会被整包拒绝；讲义上多出来的字段只警告，但也不要依赖这一点。
4. 只输出 JSON，从 { 开始到 } 结束。

【一、顶层结构】
{
  "kind": "quiz.bank",
  "manifest": { …见【二】… },
  "questions": [ …见【三】【四】… ],
  "knowledge": [ …见【五】… ]
}
knowledge 可以为空数组；只有文档里确实有讲义/课程链接时才填写。

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
  "examTemplates": [ …见【六】… ],
  "createdAt": "2026-01-01T00:00:00.000Z"
}
规则：
- topics 至少 1 个；按文档章节/知识体系划分，每道题必须归属至少一个 topicId。
- topicId 形如 <bankId>:topic:001，全包唯一。
- 不要输出上述清单以外的字段。

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
  "tags": ["可选：标签，如 <bankId>:tag:高频"],
  "difficulty": "可选：easy / medium / hard",
  "type": "题型名",
  …题型专属字段，见【四】
}
规则：
- questionId 的题型段必须与 type 一致（例如 os_final:single_choice:001 的 type 必须是 single_choice）。
- questionId 全包唯一，序号从 001 起连续补零。
- revision：恰好 12 位小写十六进制字符。推荐对「题干+答案」取确定性哈希（如 MD5 前 12 位）；无法精确计算时，可按题目顺序生成 000000000001、000000000002……（必须 12 位）。同一题内容不变时该值保持稳定。
- legacyKeys 固定输出 []。
- tags 与 difficulty 只在文档有明确依据时填写；没有就省略，不要给每道题都硬贴一个难度。
- 除以上字段与题型专属字段外，不要输出任何其它字段。

【四、题型专属字段与英语题型映射】

1) single_choice 单选
   "type": "single_choice",
   "options": [ { "optionId": "o1", "text": "选项A" }, { "optionId": "o2", "text": "选项B" } ],
   "answer": "o1"
   规则：至少 2 个选项；answer 是单个存在的 optionId。

2) multiple_choice 多选
   "type": "multiple_choice",
   "options": [ …至少 2 个… ],
   "answer": ["o1", "o3"]
   规则：answer 是 optionId 数组，至少 1 个。

3) true_false 判断
   "type": "true_false",
   "answer": true
   规则：布尔值；「对 / √ / 正确 / True」→ true，「错 / × / 错误 / False」→ false。

4) fill_blank 填空
   "type": "fill_blank",
   "stem": "题干中用 {{b1}}、{{b2}} 标出每个空位",
   "blanks": [ { "blankId": "b1", "accepted": ["标准答案", "等价写法"], "hint": "可省略" } ]
   规则：每个 blank 的 {{blankId}} 必须出现在 stem 中；accepted 至少 1 个写法。
   同一题干有多个空时，所有空都要出现在 stem 里，顺序与原文一致。

5) code_blank 代码填空
   "type": "code_blank",
   "files": [ { "fileId": "f1", "label": "Main.java", "language": "java",
                "code": "挖空后的代码，空位写成 ___(b1)___",
                "solutionCode": "完整答案代码，可省略" } ],
   "blanks": [ { "blankId": "b1", "fileId": "f1", "accepted": ["答案"] } ]
   规则：每个标记 ___(blankId)___ 必须出现在对应的 fileId 代码里；
   代码里出现的每个标记都必须有对应的 blank（不允许孤儿标记）。

6) short_answer 简答
   "type": "short_answer",
   "rubric": [ { "pointId": "r1", "text": "采分点描述", "score": 2 } ]
   规则：至少 1 个采分点，score > 0。参考答案拆成可逐条对照的采分点，不要写成一大段。

英语题型映射（只映射到既有题型，不新增类型）：
- 词汇/语法单项选择 → single_choice
- 多项选择（七选五之外的多选）→ multiple_choice
- 判断正误（True/False）→ true_false
- 单句完形/选词填空/词形转换 → fill_blank（每个空一组 accepted）
- 翻译/句型转换 → short_answer（按「关键结构 + 关键词」拆采分点）
- 书面表达/作文 → short_answer（按内容要点、结构、语言拆采分点）
- 阅读理解与完形篇章：本期没有材料复用能力，**不要**把整篇阅读塞进题干后硬拆成多题；
  只提取能独立成题的词汇/语法小题。听力题不导入（应用无听力入口）。

【五、knowledge 讲义（v2 新增规范）】
讲义数组的每一项是一篇，字段如下（summary / items / pitfalls / goals / sections / videos / resources 均可省略，省略即空）：
{
  "moduleId": "<bankId>:kb:001",
  "topicId": "必须是 manifest.topics 里存在的 topicId",
  "title": "讲义标题",
  "summary": "一句话概述（可省略）",
  "items": [ { "title": "要点标题", "detail": "一句话说明" } ],
  "pitfalls": ["易错点"],
  "goals": ["学完能做到什么（动词开头）"],
  "sections": [ { "title": "小节标题", "body": "Markdown 正文（表格/代码块可用）" } ],
  "videos": [ { "url": "课程视频地址", "title": "视频标题", "note": "对应本节哪部分", "startSec": 0 } ],
  "resources": [ { "title": "拓展阅读标题", "url": "https://…", "note": "可省略" } ],
  "estimatedMinutes": 25,
  "examFocus": "一句话说明考试里怎么考"
}
规则：
- moduleId 形如 <bankId>:kb:001，全包唯一；topicId 必须能在 manifest.topics 找到。
- 一篇讲义至少要有 items / sections / videos / resources 中的一项；四项全空会被拒绝。
- 只挂课程链接是合法形态：文档只给了课程地址时，输出 { moduleId, topicId, title, resources } 即可，
  不要为了凑字段编造正文或概述。
- body 用 Markdown；不要输出 HTML。
- 讲义上出现契约外字段只会被忽略，所以宁可省略，也不要自创字段名。

【六、三向关联（必须自洽）】
1. manifest.topics[].topicId 是唯一的知识点权威列表；
2. 每道题的 topicIds 只能引用上面列出的 topicId，且至少 1 个；
3. 每篇讲义的 topicId 也必须引用上面列出的 topicId。
三者任一悬空都会被拒绝导入。topic 名称按文档章节命名，不要用「第一章」这类无法定位的空名。

【七、examTemplates 模考模板】至少输出 1 个：
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
- 每项 count × scoreEach 之和必须等于 totalScore。
- count 不得超过该题型实际题数；只包含文档里实际存在的题型。
- durationSec 为秒，可省略（省略 = 不限时）。

【八、输出前自检清单（逐条确认）】
□ 顶层只有 kind / manifest / questions / knowledge 四个字段；
□ kind 是 "quiz.bank"；manifest.schemaVersion 与每题 schemaVersion 都是 1；
□ questionCount 等于 questions 数组长度；
□ 每题 questionId 唯一，且题型段与 type 一致；
□ 每题 topicIds 非空，且每个 topicId 都在 manifest.topics 里；
□ 每篇讲义的 topicId 都在 manifest.topics 里，且至少一项内容非空；
□ 选择题的 answer 引用的 optionId 都存在；多选题 answer 非空；
□ 填空题每个 {{blankId}} 都在 stem 里，code_blank 每个标记都有对应 blank；
□ 简答题每题至少 1 个采分点，score 大于 0；
□ examTemplates 的分值合计与 totalScore 一致；
□ 没有输出 tags / difficulty 以外的自创字段；没有输出听力题。

我的文档内容如下：
（把文档内容粘贴在这里）`;

/** 复制到剪贴板用的完整文本（与 README 校验的是同一份） */
export function importPromptText(): string {
  return IMPORT_PROMPT_V2;
}
