/**
 * 题库包校验（T1-5 的骨架部分）。
 *
 * 设计取向：**宁可拒绝导入，也不静默丢题**（S1 验收 §B）。
 * 所以这里返回的是「问题清单」，调用方必须显式决定「拒绝」还是「带警告导入」，
 * 没有默认值兜底。
 */

import {
  BankManifestSchema,
  KnowledgeModuleSchema,
  QuestionSchema,
  type BankManifest,
  type KnowledgeModule,
  type Question,
} from "./schema.js";

export const ValidationCode = {
  SCHEMA_INVALID: "SCHEMA_INVALID",
  DUP_QUESTION_ID: "DUP_QUESTION_ID",
  DUP_TOPIC_ID: "DUP_TOPIC_ID",
  UNKNOWN_TOPIC: "UNKNOWN_TOPIC",
  DUP_LEGACY_KEY: "DUP_LEGACY_KEY",
  BANK_MISMATCH: "BANK_MISMATCH",
  QUESTION_COUNT_MISMATCH: "QUESTION_COUNT_MISMATCH",
  /** 出现契约里没有的字段。默认拒绝，避免"字段名写错了却静默通过" */
  UNKNOWN_FIELD: "UNKNOWN_FIELD",
  SCHEMA_VERSION_UNSUPPORTED: "SCHEMA_VERSION_UNSUPPORTED",
} as const;
export type ValidationCode = (typeof ValidationCode)[keyof typeof ValidationCode];

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly message: string;
  /** JSON 路径，便于定位到具体题目 */
  readonly path?: string;
}

export interface BankPackage {
  readonly manifest: BankManifest;
  readonly questions: readonly Question[];
}

export interface ValidateResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  /** 通过 Schema 校验后的问题对象，便于调用方继续使用 */
  readonly questions: readonly Question[];
}

const BASE_KEYS = [
  "schemaVersion",
  "questionId",
  "bankId",
  "revision",
  "topicIds",
  "stem",
  "explanation",
  "legacyKeys",
  "type",
] as const;

const TYPE_KEYS: Readonly<Record<string, readonly string[]>> = {
  single_choice: ["options", "answer"],
  multiple_choice: ["options", "answer"],
  true_false: ["answer"],
  fill_blank: ["blanks"],
  code_blank: ["files", "blanks"],
  short_answer: ["rubric"],
};

const MANIFEST_KEYS = [
  "schemaVersion",
  "bankId",
  "title",
  "subject",
  "questionCount",
  "topics",
  "examTemplates",
  "createdAt",
  "updatedAt",
] as const;

/**
 * 未知字段策略：**拒绝并定位**，不静默丢弃。
 *
 * Zod 默认会把未知字段 strip 掉——这正是最危险的行为：把 `optons` 拼错成
 * `optins`，解析照样成功，只是那个字段消失了。旧版就是因为「错了也不报」
 * 才积累了那么多静默问题，这里必须反过来。
 */
function collectUnknownKeys(
  raw: unknown,
  allowed: readonly string[],
  path: string,
): ValidationIssue[] {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return [];
  const allowedSet = new Set(allowed);
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (!allowedSet.has(key)) {
      issues.push({
        code: ValidationCode.UNKNOWN_FIELD,
        message: `出现契约里没有的字段「${key}」`,
        path: `${path}.${key}`,
      });
    }
  }
  return issues;
}

export function validateBankPackage(input: unknown): ValidateResult {
  const issues: ValidationIssue[] = [];
  const questions: Question[] = [];

  issues.push(...collectUnknownKeys((input as { manifest?: unknown } | null)?.manifest, MANIFEST_KEYS, "manifest"));

  const manifestParsed = BankManifestSchema.safeParse(
    (input as { manifest?: unknown } | null)?.manifest,
  );
  if (!manifestParsed.success) {
    for (const issue of manifestParsed.error.issues) {
      issues.push({
        code: ValidationCode.SCHEMA_INVALID,
        message: `manifest: ${issue.message}`,
        path: `manifest.${issue.path.join(".")}`,
      });
    }
    return { ok: false, issues, questions: [] };
  }
  const manifest = manifestParsed.data;

  const rawQuestions = (input as { questions?: unknown })?.questions;
  if (!Array.isArray(rawQuestions)) {
    issues.push({
      code: ValidationCode.SCHEMA_INVALID,
      message: "questions 必须是数组",
      path: "questions",
    });
    return { ok: false, issues, questions: [] };
  }

  rawQuestions.forEach((raw, index) => {
    const rawType = (raw as { type?: unknown } | null)?.type;
    if (typeof rawType === "string") {
      const allowed = [...BASE_KEYS, ...(TYPE_KEYS[rawType] ?? [])];
      issues.push(...collectUnknownKeys(raw, allowed, `questions[${index}]`));
    }
    const parsed = QuestionSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          code: ValidationCode.SCHEMA_INVALID,
          message: issue.message,
          path: `questions[${index}].${issue.path.join(".")}`,
        });
      }
      return;
    }
    questions.push(parsed.data);
  });

  // 重复题目 ID
  const seenQ = new Map<string, number>();
  for (const q of questions) {
    const first = seenQ.get(q.questionId);
    if (first !== undefined) {
      issues.push({
        code: ValidationCode.DUP_QUESTION_ID,
        message: `题目 ID 重复：${q.questionId}`,
        path: `questions[${first}] / ${q.questionId}`,
      });
    } else {
      seenQ.set(q.questionId, questions.indexOf(q));
    }
    if (q.bankId !== manifest.bankId) {
      issues.push({
        code: ValidationCode.BANK_MISMATCH,
        message: `题目的 bankId（${q.bankId}）与 manifest（${manifest.bankId}）不一致`,
        path: q.questionId,
      });
    }
  }

  // 重复知识点 ID
  const topicIds = new Set<string>();
  for (const t of manifest.topics) {
    if (topicIds.has(t.topicId)) {
      issues.push({
        code: ValidationCode.DUP_TOPIC_ID,
        message: `知识点 ID 重复：${t.topicId}`,
        path: "manifest.topics",
      });
    }
    topicIds.add(t.topicId);
  }

  // 悬空 topicId
  for (const q of questions) {
    for (const tid of q.topicIds) {
      if (!topicIds.has(tid)) {
        issues.push({
          code: ValidationCode.UNKNOWN_TOPIC,
          message: `题目引用了不存在的知识点：${tid}`,
          path: q.questionId,
        });
      }
    }
  }

  // 旧键重复：一个 legacyKey 只能指向一道题，否则迁移会一对多
  const legacySeen = new Map<string, string>();
  for (const q of questions) {
    for (const key of q.legacyKeys) {
      const owner = legacySeen.get(key);
      if (owner !== undefined && owner !== q.questionId) {
        issues.push({
          code: ValidationCode.DUP_LEGACY_KEY,
          message: `旧键 ${key} 同时指向 ${owner} 与 ${q.questionId}，迁移会出现一对多`,
          path: q.questionId,
        });
      } else {
        legacySeen.set(key, q.questionId);
      }
    }
  }

  if (manifest.questionCount !== questions.length) {
    issues.push({
      code: ValidationCode.QUESTION_COUNT_MISMATCH,
      message: `manifest.questionCount=${manifest.questionCount}，实际解析出 ${questions.length} 道题`,
      path: "manifest.questionCount",
    });
  }

  return { ok: issues.length === 0, issues, questions };
}

export interface KnowledgeValidateResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly modules: readonly KnowledgeModule[];
}

/**
 * 讲义校验（S7-E8）：导入题库包时**必须**走这一道。
 *
 * 之前的实现把 `knowledge` 直接 `as BankContent["knowledge"]` 断言过去，
 * 等于"讲义写错了也不报"——正是 S1 要消灭的那类静默失败。
 * 这里除了形状校验，还查一条形状表达不了的语义：**一篇讲义不能什么都没有**。
 */
export function validateKnowledgeModules(input: unknown): KnowledgeValidateResult {
  const issues: ValidationIssue[] = [];
  const modules: KnowledgeModule[] = [];

  if (!Array.isArray(input)) {
    issues.push({ code: ValidationCode.SCHEMA_INVALID, message: "knowledge 必须是数组", path: "knowledge" });
    return { ok: false, issues, modules };
  }

  input.forEach((raw, index) => {
    const parsed = KnowledgeModuleSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          code: ValidationCode.SCHEMA_INVALID,
          message: issue.message,
          path: `knowledge[${index}].${issue.path.join(".")}`,
        });
      }
      return;
    }
    const module = parsed.data;
    if (module.items.length === 0 && module.sections.length === 0) {
      issues.push({
        code: ValidationCode.SCHEMA_INVALID,
        message: `讲义「${module.title}」既没有要点（items）也没有正文（sections）`,
        path: `knowledge[${index}]`,
      });
      return;
    }
    modules.push(module);
  });

  return { ok: issues.length === 0, issues, modules };
}
