/**
 * 模板 Schema 校验（S5 · T5-1）。
 *
 * 校验的不是"能不能解析"，而是"能不能开考"，分两层：
 * 1. 形状层（Zod）：字段缺失/类型不对 → `SCHEMA`，定位到字段；
 * 2. 语义层：题型是否注册、大题 ID 是否重复、筛选范围是否有效、
 *    分值加总、**题量够不够**（D-2）——每条都带 `path`。
 *
 * 题量校验必须拿到题库内容：模板说"抽 40 题"，池子里只有 30 题时
 * 必须在开考前拒绝（D-2），而不是少抽 10 题照常开始（§6-E 不可接受项）。
 */

import { z } from "zod";

import {
  ExamFilterSchema,
  ExamTemplateShapeSchema,
  type ExamFilter,
  type ExamTemplate,
  type ExamTemplateSection,
  type Question,
  type QuestionType,
  type Topic,
} from "../schema.js";
import "../questions/index.js";
import { hasQuestionType } from "../questions/registry.js";

export type TemplateIssueCode =
  | "SCHEMA"
  | "DUPLICATE_SECTION"
  | "UNKNOWN_TYPE"
  | "UNKNOWN_TOPIC"
  | "SCORE_SUM"
  | "POOL_SHORTAGE";

export interface TemplateIssue {
  readonly code: TemplateIssueCode;
  /** 定位到具体字段，如 `sections[2].count` / `totalScore` */
  readonly path: string;
  readonly message: string;
}

export interface TemplateValidation {
  readonly ok: boolean;
  /** 校验通过时返回解析后的模板；不通过为 null（不把半截模板交给调用方） */
  readonly template: ExamTemplate | null;
  readonly issues: readonly TemplateIssue[];
}

/** 题目是否落在筛选范围内：主题/标签取交集语义，难度精确匹配 */
function matchesFilter(q: Question, filter: ExamFilter | undefined): boolean {
  if (filter === undefined) return true;
  if (filter.topicIds !== undefined && filter.topicIds.length > 0) {
    const wanted = new Set(filter.topicIds);
    if (!q.topicIds.some((t) => wanted.has(t))) return false;
  }
  if (filter.tags !== undefined && filter.tags.length > 0) {
    const owned = new Set(q.tags ?? []);
    if (!filter.tags.some((t) => owned.has(t))) return false;
  }
  if (filter.difficulty !== undefined && q.difficulty !== filter.difficulty) return false;
  return true;
}

/**
 * 某个大题的可用题目池：题库 + 题型 + 筛选范围。
 * 校验器与组卷器共用这一个口径，避免"校验说够、组卷说不够"。
 */
export function sectionPool(
  questions: readonly Question[],
  bankId: string,
  section: Pick<ExamTemplateSection, "questionType" | "filter">,
): readonly Question[] {
  return questions.filter(
    (q) => q.bankId === bankId && q.type === section.questionType && matchesFilter(q, section.filter),
  );
}

/**
 * 形状层放宽 `questionType` 为字符串：
 * 「题型未注册」要给出自己的错误码与提示，而不是 Zod 的 `invalid_enum_value`。
 * 语义层确认注册后，再收窄回 `QuestionType`。
 */
const LenientTemplateSchema = ExamTemplateShapeSchema.extend({
  sections: z
    .array(
      z
        .object({
          sectionId: z.string().min(1),
          title: z.string().min(1),
          questionType: z.string().min(1),
          count: z.number().int().positive(),
          scoreEach: z.number().positive(),
          filter: ExamFilterSchema.optional(),
        })
        .strict(),
    )
    .min(1),
});

type LenientTemplate = z.infer<typeof LenientTemplateSchema>;

/**
 * 模板合法性校验。`topics` 传入后会校验筛选范围引用的知识点是否存在；
 * 不传则跳过该项（模板可能与题库分开下发）。
 */
export function validateExamTemplate(
  raw: unknown,
  questions: readonly Question[],
  topics: readonly Topic[] = [],
): TemplateValidation {
  const parsed = LenientTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      template: null,
      issues: parsed.error.issues.map((issue) => ({
        code: "SCHEMA" as const,
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    };
  }
  const input = parsed.data;
  const issues: TemplateIssue[] = [];

  const seen = new Set<string>();
  input.sections.forEach((section, index) => {
    if (seen.has(section.sectionId)) {
      issues.push({
        code: "DUPLICATE_SECTION",
        path: `sections[${index}].sectionId`,
        message: `大题 ID 重复：${section.sectionId}`,
      });
    }
    seen.add(section.sectionId);

    if (!hasQuestionType(section.questionType)) {
      issues.push({
        code: "UNKNOWN_TYPE",
        path: `sections[${index}].questionType`,
        message: `未注册的题型「${section.questionType}」`,
      });
      return;
    }

    const knownTopics = new Set(topics.map((t) => t.topicId));
    for (const topicId of section.filter?.topicIds ?? []) {
      if (topics.length > 0 && !knownTopics.has(topicId)) {
        issues.push({
          code: "UNKNOWN_TOPIC",
          path: `sections[${index}].filter.topicIds`,
          message: `筛选范围引用了不存在的知识点 ${topicId}`,
        });
      }
    }

    const pool = sectionPool(questions, input.bankId, {
      questionType: section.questionType as QuestionType,
      filter: section.filter,
    });
    if (pool.length < section.count) {
      issues.push({
        code: "POOL_SHORTAGE",
        path: `sections[${index}].count`,
        message: shortageMessage(pool.length, section.count),
      });
    }
  });

  const sum = input.sections.reduce((acc, s) => acc + s.count * s.scoreEach, 0);
  if (Math.abs(sum - input.totalScore) > 1e-9) {
    issues.push({
      code: "SCORE_SUM",
      path: "totalScore",
      message: `各题型分值合计 ${sum} 与 totalScore ${input.totalScore} 不一致`,
    });
  }

  if (issues.length > 0) return { ok: false, template: null, issues };

  const template: ExamTemplate = {
    ...input,
    sections: input.sections.map((s) => ({
      ...s,
      questionType: s.questionType as QuestionType,
    })),
  };
  return { ok: true, template, issues: [] };
}

/** D-2 的提示原文，校验器与组卷器共用，避免两处文案漂移 */
export function shortageMessage(available: number, needed: number): string {
  return `可用题目 ${available} < 需要 ${needed}`;
}
