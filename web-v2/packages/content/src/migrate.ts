/**
 * 旧 → 新 迁移器（T1-4）。
 *
 * 设计原则：
 * 1. **纯函数**：不读文件、不写文件、不取当前时间。IO 放在 scripts/migrate-legacy.mjs，
 *    这样迁移逻辑本身可以在 Node 里单测，也能对同一份输入反复执行（幂等的前提）。
 * 2. **可重复执行**：输出只由输入决定，同一份 `data.json` 跑两次必须逐字节相同。
 * 3. **有问题就说**：遇到无法映射的字段一律 push 一条 issue，不做静默兜底。
 *    旧版最大的坑就是「错了也不报」。
 */

import {
  SCHEMA_VERSION,
  computeRevision,
  makeQuestionId,
  type BankManifest,
  type ExamTemplate,
  type Question,
  type QuestionType,
  type Topic,
} from "@quiz/core";

import {
  LEGACY_TYPE_TO_NEW,
  TOPIC_SLUGS,
  type LegacyDataJson,
  type LegacyQuestion,
} from "./legacy.js";

export interface MigrationIssue {
  readonly code: string;
  readonly message: string;
  /** 旧题标识，如 `app-3` */
  readonly where?: string;
}

export interface MigrationOptions {
  readonly bankId?: string;
  /** 记录迁移来源，便于日后追溯「这批 ID 是哪一版数据定的」 */
  readonly sourceTag?: string;
  readonly title?: string;
}

export interface MigrationStats {
  readonly total: number;
  readonly byType: Readonly<Record<string, number>>;
  /** 代码填空唯一空位编号数（旧版基线是 89，不是字面标记数 97） */
  readonly codeBlankSlots: number;
  readonly topicCount: number;
}

export interface MigrationResult {
  readonly manifest: BankManifest;
  readonly questions: readonly Question[];
  readonly topics: readonly Topic[];
  readonly examTemplates: readonly ExamTemplate[];
  /** 旧键 → 新 ID，冻结后入库，不随题库改动重算（ADR-0001） */
  readonly legacyMap: Readonly<Record<string, string>>;
  readonly issues: readonly MigrationIssue[];
  readonly stats: MigrationStats;
}

const DEFAULT_BANK_ID = "javaweb";
const SOURCE_TAG = "legacy-javaweb-20261116";
/** 简答题总分的来源：旧版卷面 4 题 × 5 分 */
const SHORT_ANSWER_SCORE = 5;

const BLANK_MARKER = "{{BLANK}}";

function topicIdOf(bankId: string, slug: string): string {
  return `${bankId}:topic:${slug}`;
}

function splitScore(totalScore: number, parts: number): number[] {
  if (parts <= 0) return [];
  const totalCents = Math.round(totalScore * 100);
  const base = Math.floor(totalCents / parts);
  const out: number[] = [];
  let used = 0;
  for (let i = 0; i < parts; i++) {
    const cents = i === parts - 1 ? totalCents - used : base;
    used += cents;
    out.push(cents / 100);
  }
  return out;
}

interface Ctx {
  readonly bankId: string;
  readonly issues: MigrationIssue[];
  readonly seq: Record<string, number>;
}

function nextId(ctx: Ctx, type: QuestionType): string {
  const next = (ctx.seq[type] ?? 0) + 1;
  ctx.seq[type] = next;
  return makeQuestionId(ctx.bankId, type, next);
}

function revisionOf(content: Record<string, unknown>): string {
  return computeRevision(content);
}

function topicIdsFor(ctx: Ctx, q: LegacyQuestion, where: string): string[] {
  const label = q.kp ?? "";
  const slug = TOPIC_SLUGS[label];
  if (!slug) {
    ctx.issues.push({
      code: "UNKNOWN_TOPIC_LABEL",
      message: `知识点「${label}」不在 7 类映射表中，已归入 uncategorized`,
      where,
    });
    return [topicIdOf(ctx.bankId, "uncategorized")];
  }
  return [topicIdOf(ctx.bankId, slug)];
}

function baseFields(ctx: Ctx, q: LegacyQuestion, type: QuestionType, where: string) {
  const questionId = nextId(ctx, type);
  const topicIds = topicIdsFor(ctx, q, where);
  return {
    schemaVersion: SCHEMA_VERSION,
    questionId,
    bankId: ctx.bankId,
    topicIds,
    stem: "",
    ...(q.analysis ? { explanation: q.analysis } : {}),
    legacyKeys: [where],
  };
}

function migrateChoice(ctx: Ctx, q: Extract<LegacyQuestion, { type: "choice" }>, where: string): Question {
  const options = q.options.map((o, i) => ({ optionId: `o${i + 1}`, text: o.text }));
  const hit = q.options.findIndex((o) => o.key === q.answer);
  if (hit < 0) {
    ctx.issues.push({
      code: "ANSWER_NOT_IN_OPTIONS",
      message: `答案「${q.answer}」不在选项 A~${String.fromCharCode(64 + q.options.length)} 中`,
      where,
    });
  }
  const answer = `o${Math.max(hit, 0) + 1}`;
  const stem = q.stem;
  // 修订号只覆盖「影响作答的含义」，不含 questionId / legacyKeys / topicIds：
  // 改知识点归类不该被算成换了一版题
  const revision = revisionOf({ type: "single_choice", stem, options, answer, explanation: q.analysis });
  return {
    ...baseFields(ctx, q, "single_choice", where),
    type: "single_choice",
    stem,
    options,
    answer,
    revision,
  } as Question;
}

function migrateJudge(ctx: Ctx, q: Extract<LegacyQuestion, { type: "judge" }>, where: string): Question {
  let answer: boolean;
  if (q.answer === "√") answer = true;
  else if (q.answer === "×") answer = false;
  else {
    ctx.issues.push({
      code: "UNKNOWN_JUDGE_ANSWER",
      message: `判断题答案既不是 √ 也不是 ×：${q.answer}`,
      where,
    });
    answer = false;
  }
  const stem = q.stem;
  const revision = revisionOf({ type: "true_false", stem, answer, explanation: q.analysis });
  return {
    ...baseFields(ctx, q, "true_false", where),
    type: "true_false",
    stem,
    answer,
    revision,
  } as Question;
}

function migrateFillBlank(
  ctx: Ctx,
  q: Extract<LegacyQuestion, { type: "blank" }>,
  where: string,
): Question | null {
  const markers = q.stem.split(BLANK_MARKER).length - 1;
  if (markers !== q.blanks.length) {
    ctx.issues.push({
      code: "BLANK_COUNT_MISMATCH",
      message: `题干有 ${markers} 个 ${BLANK_MARKER}，但 blanks 有 ${q.blanks.length} 项`,
      where,
    });
  }
  const count = Math.min(markers, q.blanks.length);
  if (count === 0) {
    ctx.issues.push({ code: "BLANK_EMPTY", message: "填空题没有可映射的空位", where });
    return null;
  }

  let used = 0;
  const stem = q.stem.replaceAll(BLANK_MARKER, () => {
    used += 1;
    return used <= count ? `{{b${used}}}` : "";
  });

  const blanks = q.blanks.slice(0, count).map((answer, i) => ({
    blankId: `b${i + 1}`,
    accepted: [answer],
    ...(q.hint ? { hint: q.hint } : {}),
  }));

  const revision = revisionOf({ type: "fill_blank", stem, blanks, explanation: q.analysis });
  return {
    ...baseFields(ctx, q, "fill_blank", where),
    type: "fill_blank",
    stem,
    blanks,
    revision,
  } as Question;
}

function migrateShort(
  ctx: Ctx,
  q: Extract<LegacyQuestion, { type: "short" }>,
  where: string,
): Question | null {
  if (!q.points.length) {
    ctx.issues.push({ code: "SHORT_NO_POINTS", message: "简答题没有采分点", where });
    return null;
  }
  const scores = splitScore(SHORT_ANSWER_SCORE, q.points.length);
  const rubric = q.points.map((text, i) => ({
    pointId: `p${i + 1}`,
    text,
    score: scores[i] ?? 0,
  }));
  const stem = q.stem;
  const revision = revisionOf({ type: "short_answer", stem, rubric, explanation: q.analysis });
  return {
    ...baseFields(ctx, q, "short_answer", where),
    type: "short_answer",
    stem,
    rubric,
    revision,
  } as Question;
}

function migrateApp(ctx: Ctx, q: Extract<LegacyQuestion, { type: "app" }>, where: string): Question | null {
  if (q.code.length !== q.blankCode.length) {
    ctx.issues.push({
      code: "CODE_BLOCK_MISMATCH",
      message: `code 有 ${q.code.length} 段，blankCode 有 ${q.blankCode.length} 段，无法一一对应`,
      where,
    });
    if (!q.blankCode.length) return null;
  }

  const files = q.blankCode.map((block, i) => {
    const full = q.code[i];
    return {
      fileId: `f${i + 1}`,
      label: block.label,
      language: block.lang,
      code: block.text,
      ...(full ? { solutionCode: full.text } : {}),
    };
  });

  // 空位：按答案表顺序去重，并定位到第一个出现该标记的文件
  const seen = new Set<string>();
  const blanks: { blankId: string; fileId: string; accepted: string[] }[] = [];
  for (const [blankId, value] of q.answer) {
    if (!blankId) continue;
    const marker = `___(${blankId})___`;
    const owner = files.find((f) => f.code.includes(marker));
    if (!owner) {
      ctx.issues.push({
        code: "BLANK_WITHOUT_MARKER",
        message: `答案表里的空位 ${blankId} 在代码中找不到标记 ${marker}`,
        where,
      });
      continue;
    }
    if (seen.has(blankId)) continue;
    seen.add(blankId);
    blanks.push({ blankId, fileId: owner.fileId, accepted: [value] });
  }

  // 反向：代码里有标记却没有答案（旧版 89/97 差异就藏在这里）
  for (const f of files) {
    for (const m of f.code.matchAll(/___\(([^)]+)\)___/g)) {
      const id = m[1];
      if (id !== undefined && !seen.has(id)) {
        ctx.issues.push({
          code: "MARKER_WITHOUT_ANSWER",
          message: `文件 ${f.fileId} 中的空位 ${id} 没有答案`,
          where,
        });
        seen.add(id);
      }
    }
  }

  if (!blanks.length) {
    ctx.issues.push({ code: "APP_NO_BLANKS", message: "应用题没有可映射的空位", where });
    return null;
  }

  const stem = q.stem;
  const revision = revisionOf({ type: "code_blank", stem, files, blanks, explanation: q.analysis });
  return {
    ...baseFields(ctx, q, "code_blank", where),
    type: "code_blank",
    stem,
    files,
    blanks,
    revision,
  } as Question;
}

function buildExamTemplate(bankId: string): ExamTemplate {
  return {
    templateId: `${bankId}:exam:final`,
    bankId,
    title: "JavaWeb 期末考试（模拟）",
    sections: [
      { sectionId: "s1", title: "选择题", questionType: "single_choice", count: 15, scoreEach: 2 },
      { sectionId: "s2", title: "判断题", questionType: "true_false", count: 10, scoreEach: 1 },
      { sectionId: "s3", title: "填空题", questionType: "fill_blank", count: 5, scoreEach: 2 },
      { sectionId: "s4", title: "简答题", questionType: "short_answer", count: 4, scoreEach: 5 },
      // 应用题按空数给分（1 空 1 分，共 30 空），模板里只能写均值；精确分配在 T1-7 建模
      { sectionId: "s5", title: "应用题", questionType: "code_blank", count: 4, scoreEach: 7.5 },
    ],
    totalScore: 100,
  };
}

export function migrateLegacyBank(input: LegacyDataJson, options: MigrationOptions = {}): MigrationResult {
  const bankId = options.bankId ?? DEFAULT_BANK_ID;
  const issues: MigrationIssue[] = [];
  const ctx: Ctx = { bankId, issues, seq: {} };
  const questions: Question[] = [];
  const legacyMap: Record<string, string> = {};

  for (const q of input.questions) {
    const where = `${q.type}-${q.no}`;
    let made: Question | null = null;

    switch (q.type) {
      case "choice":
        made = migrateChoice(ctx, q, where);
        break;
      case "judge":
        made = migrateJudge(ctx, q, where);
        break;
      case "blank":
        made = migrateFillBlank(ctx, q, where);
        break;
      case "short":
        made = migrateShort(ctx, q, where);
        break;
      case "app":
        made = migrateApp(ctx, q, where);
        break;
    }

    if (!made) continue;
    if (legacyMap[where] !== undefined) {
      issues.push({
        code: "DUP_LEGACY_KEY_IN_SOURCE",
        message: `旧键 ${where} 在源数据中重复出现`,
        where,
      });
    }
    legacyMap[where] = made.questionId;
    questions.push(made);
  }

  const topicIds = new Set<string>();
  for (const q of questions) for (const t of q.topicIds) topicIds.add(t);
  const slugToLabel: Record<string, string> = {};
  for (const [label, slug] of Object.entries(TOPIC_SLUGS)) slugToLabel[slug] = label;

  const topics: Topic[] = [...topicIds]
    .sort()
    .map((topicId) => {
      const slug = topicId.split(":").pop() ?? topicId;
      return {
        topicId,
        bankId,
        // 名字用回中文原名，别把 slug 当展示文案
        name: slugToLabel[slug] ?? slug,
        order: Object.values(TOPIC_SLUGS).indexOf(slug),
      };
    });

  const byType: Record<string, number> = {};
  let codeBlankSlots = 0;
  for (const q of questions) {
    byType[q.type] = (byType[q.type] ?? 0) + 1;
    if (q.type === "code_blank") codeBlankSlots += q.blanks.length;
  }

  const manifest: BankManifest = {
    schemaVersion: SCHEMA_VERSION,
    bankId,
    title: options.title ?? input.meta?.title ?? "JavaWeb 期末题库",
    questionCount: questions.length,
    topics,
    examTemplates: [buildExamTemplate(bankId)],
    createdAt: options.sourceTag ?? SOURCE_TAG,
  };

  return {
    manifest,
    questions,
    topics,
    examTemplates: manifest.examTemplates,
    legacyMap,
    issues,
    stats: { total: questions.length, byType, codeBlankSlots, topicCount: topics.length },
  };
}

export { LEGACY_TYPE_TO_NEW, TOPIC_SLUGS } from "./legacy.js";
export type { LegacyDataJson, LegacyQuestion } from "./legacy.js";
