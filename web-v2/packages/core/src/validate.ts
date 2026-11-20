/**
 * 题库包校验（T1-5 的骨架部分）。
 *
 * 设计取向：**宁可拒绝导入，也不静默丢题**（S1 验收 §B）。
 * 所以这里返回的是「问题清单」，调用方必须显式决定「拒绝」还是「带警告导入」，
 * 没有默认值兜底。
 */

import { z } from "zod";

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
  // V2.1 · R1.5：schema 早就接受这两个可选字段，白名单漏了会把合法题库拒之门外
  "tags",
  "difficulty",
  // R4-2：材料引用
  "passageId",
] as const;

const TYPE_KEYS: Readonly<Record<string, readonly string[]>> = {
  single_choice: ["options", "answer"],
  multiple_choice: ["options", "answer"],
  true_false: ["answer"],
  fill_blank: ["blanks"],
  code_blank: ["files", "blanks"],
  short_answer: ["rubric"],
  cloze: ["passageId", "sharedOptions", "blanks", "reuseOptions"],
};

const PASSAGE_KEYS = ["passageId", "title", "body", "source"] as const;

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

/* ---------------------------------------------- 中文报错（V2.1 · R1.1） */

const TYPE_LABEL: Readonly<Record<string, string>> = {
  string: "字符串",
  number: "数字",
  boolean: "布尔值",
  array: "数组",
  object: "对象",
  integer: "整数",
  undefined: "缺失",
  null: "空值",
};

/**
 * 把 Zod 的英文默认文案翻成中文。
 *
 * 规则里自带的断言消息（如「单选题至少 2 个选项」）本来就是中文，
 * 以字母开头的才视为 Zod 默认文案去翻译——自定义消息绝不被覆盖。
 */
export const zhErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (!/^[A-Za-z]/.test(ctx.defaultError)) return { message: ctx.defaultError };
  const at = issue.path.length === 0 ? "顶层" : `「${issue.path.join(".")}」`;
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return {
        message: `${at}应为${TYPE_LABEL[issue.expected] ?? issue.expected}，实际是${
          TYPE_LABEL[issue.received] ?? issue.received
        }`,
      };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `${at}只能是 ${issue.options.join(" / ")} 之一` };
    case z.ZodIssueCode.invalid_literal:
      return { message: `${at}必须是 ${JSON.stringify(issue.expected)}` };
    case z.ZodIssueCode.too_small: {
      const unit = issue.type === "array" ? " 项" : issue.type === "string" ? " 个字符" : "";
      return { message: `${at}至少需要 ${issue.minimum}${unit}` };
    }
    case z.ZodIssueCode.too_big: {
      const unit = issue.type === "array" ? " 项" : issue.type === "string" ? " 个字符" : "";
      return { message: `${at}最多允许 ${issue.maximum}${unit}` };
    }
    case z.ZodIssueCode.invalid_string:
      return { message: `${at}格式不正确` };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `${at}出现契约里没有的字段：${issue.keys.join("、")}` };
    default:
      return { message: `${at}不符合契约要求` };
  }
};

/* ------------------------------------------------ 顶层键名提示（V2.1 · R1.1） */

const TOP_LEVEL_ALLOWED = ["kind", "manifest", "questions", "knowledge"] as const;

/** 常见手写错误：单数/驼峰/旧字段名。给出「是不是想写 X」比只说「不认识」有用 */
const TOP_LEVEL_SUGGESTIONS: Readonly<Record<string, string>> = {
  question: "questions",
  questionList: "questions",
  questionss: "questions",
  bankManifest: "manifest",
  manifests: "manifest",
  knowledge_modules: "knowledge",
  knowledgeModules: "knowledge",
};

export function topLevelKeyHint(key: string): string {
  const suggestion = TOP_LEVEL_SUGGESTIONS[key];
  if (suggestion !== undefined) {
    return `顶层字段「${key}」可能想写「${suggestion}」；题库包顶层只允许 ${TOP_LEVEL_ALLOWED.join(" / ")}`;
  }
  return `题库包顶层只允许 ${TOP_LEVEL_ALLOWED.join(" / ")}，「${key}」是多余字段`;
}

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
    { errorMap: zhErrorMap },
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
    const parsed = QuestionSchema.safeParse(raw, { errorMap: zhErrorMap });
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

  // 材料引用：题干里写了 passageId，就必须真的有这篇材料
  const passageRefs = (input as { passages?: unknown } | null)?.passages;
  if (Array.isArray(passageRefs)) {
    const ids = new Set<string>();
    passageRefs.forEach((raw, index) => {
      const id = (raw as { passageId?: unknown } | null)?.passageId;
      if (typeof id === "string") ids.add(id);
      issues.push(...collectUnknownKeys(raw, PASSAGE_KEYS, `passages[${index}]`));
    });
    for (const q of questions) {
      if (q.passageId !== undefined && !ids.has(q.passageId)) {
        issues.push({
          code: ValidationCode.UNKNOWN_TOPIC,
          message: `题目引用了不存在的材料：${q.passageId}`,
          path: q.questionId,
        });
      }
      if (q.type === "cloze" && q.passageId === undefined) {
        issues.push({
          code: ValidationCode.SCHEMA_INVALID,
          message: "完形填空必须引用一篇材料（passageId）",
          path: q.questionId,
        });
      }
    }
  } else {
    for (const q of questions) {
      if (q.type === "cloze") {
        issues.push({
          code: ValidationCode.SCHEMA_INVALID,
          message: "题库缺少 passages，完形填空无法引用材料",
          path: q.questionId,
        });
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
  /** 能导入但不影响使用的提示（如讲义里的未识别字段）；页面决定展示与否 */
  readonly warnings: readonly string[];
  readonly modules: readonly KnowledgeModule[];
}

const KNOWLEDGE_KEYS = [
  "moduleId",
  "topicId",
  "title",
  "summary",
  "items",
  "pitfalls",
  "goals",
  "sections",
  "videos",
  "resources",
  "estimatedMinutes",
  "examFocus",
] as const;

/**
 * 讲义校验（S7-E8）：导入题库包时**必须**走这一道。
 *
 * 之前的实现把 `knowledge` 直接 `as BankContent["knowledge"]` 断言过去，
 * 等于"讲义写错了也不报"——正是 S1 要消灭的那类静默失败。
 * 这里除了形状校验，还查一条形状表达不了的语义：**一篇讲义不能什么都没有**。
 */
export function validateKnowledgeModules(input: unknown): KnowledgeValidateResult {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  const modules: KnowledgeModule[] = [];

  if (!Array.isArray(input)) {
    issues.push({ code: ValidationCode.SCHEMA_INVALID, message: "knowledge 必须是数组", path: "knowledge" });
    return { ok: false, issues, warnings, modules };
  }

  input.forEach((raw, index) => {
    // 讲义多出来的字段**降级为警告**（V2.1 · R1.1）：
    // 讲义是给人读的内容，多一个「备注」不该让整包题都导不进来；
    // 但也不能静默吞掉，否则字段名写错永远没人发现。
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      const allowed = new Set<string>(KNOWLEDGE_KEYS);
      for (const key of Object.keys(raw)) {
        if (!allowed.has(key)) {
          warnings.push(`knowledge[${index}] 的字段「${key}」不在契约内，已忽略`);
        }
      }
    }

    const parsed = KnowledgeModuleSchema.safeParse(raw, { errorMap: zhErrorMap });
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
    // 只挂课程链接的讲义是合法形态：四者（要点/正文/视频/资源）有一个就算有内容
    const hasContent =
      module.items.length > 0 ||
      module.sections.length > 0 ||
      module.videos.length > 0 ||
      module.resources.length > 0;
    if (!hasContent) {
      issues.push({
        code: ValidationCode.SCHEMA_INVALID,
        message: `讲义「${module.title}」四项皆空（items / sections / videos / resources），没有任何可读内容`,
        path: `knowledge[${index}]`,
      });
      return;
    }
    modules.push(module);
  });

  return { ok: issues.length === 0, issues, warnings, modules };
}
