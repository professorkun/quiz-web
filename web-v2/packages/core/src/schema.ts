/**
 * 核心数据契约（S1 / T1-3）。
 *
 * 三条贯穿全文件的规矩：
 * 1. **身份与内容分离**：`questionId` 表达「是哪道题」，`revision` 表达「哪一版」（ADR-0001）
 * 2. **选项用稳定 `optionId`，A/B/C/D 只是展示序号**：否则选项一乱序，历史作答就指错
 * 3. **题库内容不进代码**：`core` 只认识结构，不认识 JavaWeb（ADR-0002）
 *
 * 实现注意：Zod 的判别联合要求成员必须是 `ZodObject`，所以**成员上不允许挂 superRefine**
 * （那会包成 ZodEffects 导致 TS2740）。所有跨字段校验统一放在联合层的 superRefine 里。
 */

import { z } from "zod";

/** 契约版本。任何破坏性变更必须升这个数，并在迁移逻辑里按版本分支 */
export const SCHEMA_VERSION = 1 as const;

const IdStr = z.string().min(1);

/** 形如 `javaweb:single_choice:001`。序号至少 3 位，给将来扩到上千题留位 */
export const QuestionIdSchema = z
  .string()
  .regex(/^[^:]+:[a-z_]+:\d{3,}$/, "题目 ID 必须形如 bank:type:seq（如 javaweb:single_choice:001）");

export const QuestionTypeSchema = z.enum([
  "single_choice",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "code_blank",
  "short_answer",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

/** 修订号：12 位小写十六进制，由 `computeRevision()` 从内容算出，不手写 */
export const RevisionSchema = z.string().regex(/^[0-9a-f]{12}$/, "revision 必须是 12 位小写十六进制");

export const OptionSchema = z.object({
  optionId: IdStr,
  text: z.string().min(1),
});
export type Option = z.infer<typeof OptionSchema>;

/** 一个待填空：`accepted` 允许多个等价写法（如 `POOLED` 与 `pooled`） */
export const BlankSchema = z.object({
  blankId: IdStr,
  accepted: z.array(z.string().min(1)).min(1),
  hint: z.string().optional(),
});
export type Blank = z.infer<typeof BlankSchema>;

const questionBase = {
  schemaVersion: z.literal(SCHEMA_VERSION),
  questionId: QuestionIdSchema,
  bankId: IdStr,
  revision: RevisionSchema,
  topicIds: z.array(IdStr).min(1, "每题至少归属一个知识点"),
  stem: z.string().min(1),
  explanation: z.string().optional(),
  /** 旧版 `q_key` 等历史键，只读；迁移后不再写 */
  legacyKeys: z.array(IdStr).default([]),
};

export const SingleChoiceQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("single_choice"),
  options: z.array(OptionSchema).min(2, "单选题至少 2 个选项"),
  answer: IdStr,
});

export const MultipleChoiceQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("multiple_choice"),
  options: z.array(OptionSchema).min(2, "多选题至少 2 个选项"),
  answer: z.array(IdStr).min(1, "多选题至少 1 个正确选项"),
});

export const TrueFalseQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("true_false"),
  /** 用布尔值，不用 `√/×` 或「对/错」：那是展示层的事 */
  answer: z.boolean(),
});

export const FillBlankQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("fill_blank"),
  blanks: z.array(BlankSchema).min(1, "填空题至少 1 个空"),
});

export const CodeFileSchema = z.object({
  fileId: IdStr,
  label: z.string().min(1),
  language: z.string().min(1),
  /** 挖空后的代码：学习者在页面上看到的就是这一份 */
  code: z.string().min(1),
  /** 完整代码（答案版），用于“查看答案”与自评对照；旧版 `code` 字段对应这一份 */
  solutionCode: z.string().optional(),
});
export type CodeFile = z.infer<typeof CodeFileSchema>;

export const CodeBlankSlotSchema = z.object({
  blankId: IdStr,
  fileId: IdStr,
  accepted: z.array(z.string().min(1)).min(1),
  hint: z.string().optional(),
});
export type CodeBlankSlot = z.infer<typeof CodeBlankSlotSchema>;

/**
 * 代码填空：旧版一个 `app` 题会带多段代码（web.xml + 配置类…），
 * 所以这里天然是「多文件 + 多空位」，不是单文件单空。
 * 空位标记沿用 `___(blankId)___`，与旧版 `___(5-1)___` 同形，便于对照。
 */
export const CodeBlankQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("code_blank"),
  files: z.array(CodeFileSchema).min(1, "至少 1 个代码文件"),
  blanks: z.array(CodeBlankSlotSchema).min(1, "至少 1 个待填空位"),
});

export const RubricPointSchema = z.object({
  pointId: IdStr,
  text: z.string().min(1),
  score: z.number().positive("采分点分值必须大于 0"),
});
export type RubricPoint = z.infer<typeof RubricPointSchema>;

export const ShortAnswerQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("short_answer"),
  rubric: z.array(RubricPointSchema).min(1, "简答题至少 1 个采分点"),
});

function checkOptionAnswer(
  options: readonly Option[],
  answerIds: readonly string[],
): string | null {
  const known = new Set(options.map((o) => o.optionId));
  const missing = answerIds.filter((id) => !known.has(id));
  if (missing.length) return `答案引用了不存在的 optionId：${missing.join(", ")}`;
  if (new Set(answerIds).size !== answerIds.length) return "答案中存在重复的 optionId";
  return null;
}

export const QuestionSchema = z
  .discriminatedUnion("type", [
    SingleChoiceQuestionSchema,
    MultipleChoiceQuestionSchema,
    TrueFalseQuestionSchema,
    FillBlankQuestionSchema,
    CodeBlankQuestionSchema,
    ShortAnswerQuestionSchema,
  ])
  .superRefine((q, ctx) => {
    const add = (message: string, path: (string | number)[]): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    };

    // 身份与类型必须自洽：`javaweb:true_false:001` 不可能是单选题
    const seg = q.questionId.split(":")[1];
    if (seg !== q.type) {
      add(`questionId 的题型段（${String(seg)}）与 type（${q.type}）不一致`, ["questionId"]);
    }

    if (q.type === "single_choice") {
      const err = checkOptionAnswer(q.options, [q.answer]);
      if (err) add(err, ["answer"]);
    }

    if (q.type === "multiple_choice") {
      const err = checkOptionAnswer(q.options, q.answer);
      if (err) add(err, ["answer"]);
    }

    if (q.type === "fill_blank") {
      for (const b of q.blanks) {
        if (!q.stem.includes(`{{${b.blankId}}}`)) {
          add(`题干中缺少空位占位符 {{${b.blankId}}}`, ["blanks"]);
        }
      }
    }

    if (q.type === "code_blank") {
      const fileIds = new Set(q.files.map((f) => f.fileId));
      const blankIds = new Set<string>();
      for (const b of q.blanks) {
        if (blankIds.has(b.blankId)) add(`空位编号重复：${b.blankId}`, ["blanks"]);
        blankIds.add(b.blankId);
        if (!fileIds.has(b.fileId)) {
          add(`空位 ${b.blankId} 指向不存在的文件 ${b.fileId}`, ["blanks"]);
          continue;
        }
        const file = q.files.find((f) => f.fileId === b.fileId);
        const marker = `___(${b.blankId})___`;
        if (file && !file.code.includes(marker)) {
          add(`文件 ${b.fileId} 中找不到空位标记 ${marker}`, ["blanks"]);
        }
      }
      // 反向检查：代码里有标记却没定义答案，属「静默丢空」，必须拦
      for (const f of q.files) {
        for (const m of f.code.matchAll(/___\(([^)]+)\)___/g)) {
          const id = m[1];
          if (id !== undefined && !blankIds.has(id)) {
            add(`文件 ${f.fileId} 中的空位 ${id} 没有对应答案`, ["files"]);
          }
        }
      }
    }
  });
export type Question = z.infer<typeof QuestionSchema>;

export const TopicSchema = z.object({
  topicId: IdStr,
  bankId: IdStr,
  name: z.string().min(1),
  order: z.number().int().nonnegative().optional(),
});
export type Topic = z.infer<typeof TopicSchema>;

/**
 * 知识讲义（「知识」Tab 的内容）。
 *
 * 旧版把这批文字硬编码在 `template.html` 的 `POINTS` 常量里，
 * 换一门课就得改业务源码——这是 S1 要拆掉的东西之一（T1-7）。
 */
export const KnowledgeItemSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
});
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

export const KnowledgeModuleSchema = z.object({
  moduleId: IdStr,
  topicId: IdStr,
  title: z.string().min(1),
  summary: z.string().min(1),
  items: z.array(KnowledgeItemSchema).min(1),
  /** 易错点：旧版 `pits`，展示在模块末尾 */
  pitfalls: z.array(z.string().min(1)).default([]),
});
export type KnowledgeModule = z.infer<typeof KnowledgeModuleSchema>;

export const ExamTemplateSectionSchema = z.object({
  sectionId: IdStr,
  title: z.string().min(1),
  questionType: QuestionTypeSchema,
  count: z.number().int().positive(),
  scoreEach: z.number().positive(),
});
export type ExamTemplateSection = z.infer<typeof ExamTemplateSectionSchema>;

/** 卷面结构从代码里搬出来（旧版 `buildPaper()` 写死了 15/10/5/4/4） */
export const ExamTemplateSchema = z
  .object({
    templateId: IdStr,
    bankId: IdStr,
    title: z.string().min(1),
    durationSec: z.number().int().positive().optional(),
    sections: z.array(ExamTemplateSectionSchema).min(1),
    totalScore: z.number().positive(),
  })
  .superRefine((t, ctx) => {
    const sum = t.sections.reduce((acc, s) => acc + s.count * s.scoreEach, 0);
    if (Math.abs(sum - t.totalScore) > 1e-9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `各题型分值合计 ${sum} 与 totalScore ${t.totalScore} 不一致`,
        path: ["totalScore"],
      });
    }
  });
export type ExamTemplate = z.infer<typeof ExamTemplateSchema>;

export const BankManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  bankId: IdStr,
  title: z.string().min(1),
  subject: z.string().optional(),
  questionCount: z.number().int().nonnegative(),
  topics: z.array(TopicSchema).min(1),
  examTemplates: z.array(ExamTemplateSchema).default([]),
  createdAt: z.string().min(1),
  updatedAt: z.string().optional(),
});
export type BankManifest = z.infer<typeof BankManifestSchema>;

export const AttemptModeSchema = z.enum(["practice", "exam", "review"]);
export type AttemptMode = z.infer<typeof AttemptModeSchema>;

/**
 * 答题事件：**不可变**（ADR 要求）。
 * 掌握状态必须能由 Attempt 序列重算，所以这里存 `questionRevision`——
 * 题目改版后仍能知道「当时答的是哪一版」。
 */
export const AttemptSchema = z.object({
  attemptId: IdStr,
  bankId: IdStr,
  questionId: QuestionIdSchema,
  questionRevision: RevisionSchema,
  mode: AttemptModeSchema,
  isFirstAttempt: z.boolean(),
  startedAt: z.string().min(1),
  submittedAt: z.string().min(1),
  answer: z.unknown(),
  correct: z.boolean().nullable(),
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
  sessionId: IdStr.optional(),
  /**
   * 从哪个旧数据源导入的（如 `mastery` / `wrong_questions` / `exam_records:17`）。
   * 迁移产生的 Attempt 必然缺原始时间戳与原始答案，标记来源是为了让「这条是推断出来的」
   * 一眼可见，而不是混进真实作答里冒充事实。
   */
  importedFrom: z.string().min(1).optional(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

/** 进度是**派生**数据，不是事实源；随时可由 Attempt 重算 */
export const QuestionProgressSchema = z.object({
  bankId: IdStr,
  questionId: QuestionIdSchema,
  attemptsCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  firstCorrectAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  mastered: z.boolean(),
});
export type QuestionProgress = z.infer<typeof QuestionProgressSchema>;

export const PracticeSessionSchema = z.object({
  sessionId: IdStr,
  bankId: IdStr,
  mode: z.enum(["practice", "review"]),
  questionIds: z.array(QuestionIdSchema).min(1),
  cursor: z.number().int().nonnegative(),
  results: z.record(z.enum(["right", "wrong", "unseen"])),
  startedAt: z.string().min(1),
  updatedAt: z.string().min(1),
  finishedAt: z.string().optional(),
});
export type PracticeSession = z.infer<typeof PracticeSessionSchema>;
