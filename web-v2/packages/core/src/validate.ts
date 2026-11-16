/**
 * 题库包校验（T1-5 的骨架部分）。
 *
 * 设计取向：**宁可拒绝导入，也不静默丢题**（S1 验收 §B）。
 * 所以这里返回的是「问题清单」，调用方必须显式决定「拒绝」还是「带警告导入」，
 * 没有默认值兜底。
 */

import {
  BankManifestSchema,
  QuestionSchema,
  type BankManifest,
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

export function validateBankPackage(input: unknown): ValidateResult {
  const issues: ValidationIssue[] = [];
  const questions: Question[] = [];

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
