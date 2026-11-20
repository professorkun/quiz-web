/**
 * 导入导出（S3 · T3-9）。
 *
 * 三条设计取向，全部来自旧版踩过的坑：
 *
 * 1. **先校验后写入**：解析不通过就一个字节都不写。旧版导入是"边读边写"，
 *    第 3 题出错时前两题已经进库，用户看到"导入失败"却已经脏了数据。
 * 2. **未知字段不静默丢**：Zod 默认会 strip 未知键，那等于"字段名写错了但导入成功"。
 *    这里对每条记录显式比对允许字段，多一个就报错并给出路径。
 * 3. **导入后对账**：条数对不上直接抛错。宁可失败，也不要"导入了 20 条、实际 18 条"。
 *
 * 进度不参与"导入"：它是派生数据。合并后由 `recomputeProgress` 重算，
 * 这样即使导入方给的 progress 是旧的、错的，也不会污染结果。
 */

import {
  LearningSnapshotSchema,
  PassageSchema,
  topLevelKeyHint,
  validateBankPackage,
  validateKnowledgeModules,
  zhErrorMap,
  type Attempt,
  type BankContent,
  type ExamRecord,
  type FavoriteEntry,
  type LearningSnapshot,
  type Passage,
  type PracticeSession,
} from "@quiz/core";
import type { Platform } from "@quiz/platform";

import { recomputeProgress } from "./progress.js";

export const LEARNING_FILE_KIND = "quiz.learning";
export const BANK_FILE_KIND = "quiz.bank";

/** 当前快照结构版本；与 `platform/web` 的 `LEARNING_SNAPSHOT_VERSION` 必须同步 */
export const SNAPSHOT_VERSION = 1;

export interface ImportIssue {
  /** 具体位置，如 `attempts[3].foobar` 或 `questions[2].options` */
  readonly path: string;
  readonly message: string;
}

export interface ParseResult<T> {
  readonly ok: boolean;
  readonly value: T | null;
  readonly issues: readonly ImportIssue[];
  /** 能解析但不能直接用的警告（如记录所属题库未安装） */
  readonly warnings: readonly string[];
}

const ATTEMPT_KEYS = [
  "attemptId",
  "bankId",
  "questionId",
  "questionRevision",
  "mode",
  "isFirstAttempt",
  "startedAt",
  "submittedAt",
  "answer",
  "correct",
  "score",
  "maxScore",
  "sessionId",
  "durationMs",
  "importedFrom",
] as const;

const PROGRESS_KEYS = [
  "bankId",
  "questionId",
  "attemptsCount",
  "wrongCount",
  "firstCorrectAt",
  "lastAttemptAt",
  "mastered",
  // S4 的派生字段：缺字段的旧文件由 Zod 默认值补齐，但不能当成"未知字段"拒绝
  "status",
  "streak",
  "nextReviewAt",
  "errorCause",
  "note",
] as const;

const FAVORITE_KEYS = ["bankId", "questionId", "addedAt"] as const;

const SESSION_KEYS = [
  "sessionId",
  "bankId",
  "mode",
  "questionIds",
  "cursor",
  "results",
  "startedAt",
  "updatedAt",
  "finishedAt",
] as const;

/** S5 模考成绩：只增不改；`selfRating` 是唯一可更新字段 */
const EXAM_RECORD_KEYS = [
  "recordId",
  "bankId",
  "templateId",
  "sessionId",
  "seed",
  "startedAt",
  "submittedAt",
  "durationSec",
  "timedOut",
  "objectiveScore",
  "objectiveMax",
  "selfScore",
  "selfMax",
  "totalScore",
  "totalMax",
  "items",
] as const;

const EXAM_ITEM_KEYS = [
  "questionId",
  "questionRevision",
  "questionType",
  "sectionId",
  "answered",
  "answer",
  "maxScore",
  "score",
  "correct",
  "details",
  "selfRating",
] as const;

const SNAPSHOT_KEYS = [
  "kind",
  "schemaVersion",
  "exportedAt",
  "attempts",
  "progress",
  "favorites",
  "sessions",
  "settings",
  // S5 追加：旧文件没有该键时由 Zod 默认 [] 补齐（与 S4 的进度字段同一先例）
  "examRecords",
] as const;

const BANK_KEYS = ["kind", "manifest", "questions", "knowledge", "passages"] as const;

function unknownKeyIssues(
  rows: unknown,
  allowed: readonly string[],
  basePath: string,
): ImportIssue[] {
  if (!Array.isArray(rows)) return [];
  const allowedSet = new Set(allowed);
  const issues: ImportIssue[] = [];
  rows.forEach((row, index) => {
    if (row === null || typeof row !== "object") return;
    for (const key of Object.keys(row)) {
      if (!allowedSet.has(key)) {
        issues.push({
          path: `${basePath}[${index}].${key}`,
          message: `不认识的字段「${key}」；该文件可能来自更新版本，或字段名写错了`,
        });
      }
    }
  });
  return issues;
}

/** 成绩明细是两层结构：记录级与题目级都要拦未知字段 */
function examItemKeyIssues(records: unknown): ImportIssue[] {
  if (!Array.isArray(records)) return [];
  const issues: ImportIssue[] = [];
  records.forEach((record, index) => {
    if (record === null || typeof record !== "object") return;
    const items = (record as Record<string, unknown>)["items"];
    issues.push(...unknownKeyIssues(items, EXAM_ITEM_KEYS, `examRecords[${index}].items`));
  });
  return issues;
}

function readJson(text: string): { value: unknown } | { error: ImportIssue } {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (cause) {
    return {
      error: {
        path: "$",
        message: `不是合法的 JSON：${cause instanceof Error ? cause.message : String(cause)}`,
      },
    };
  }
}

function zodIssues(result: {
  success: boolean;
  error?: { issues: readonly { path: (string | number)[]; message: string }[] };
}): ImportIssue[] {
  if (result.success || result.error === undefined) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.length === 0 ? "$" : issue.path.join("."),
    message: issue.message,
  }));
}

/* ------------------------------------------------------------ 学习记录 */

export function exportLearningJson(snapshot: LearningSnapshot): string {
  return JSON.stringify(
    { kind: LEARNING_FILE_KIND, ...snapshot },
    null,
    2,
  );
}

export function parseLearningJson(
  text: string,
  options: { readonly knownBankIds?: readonly string[] } = {},
): ParseResult<LearningSnapshot> {
  const read = readJson(text);
  if ("error" in read) return { ok: false, value: null, issues: [read.error], warnings: [] };

  const raw = read.value;
  const issues: ImportIssue[] = [];

  if (raw === null || typeof raw !== "object") {
    return {
      ok: false,
      value: null,
      issues: [{ path: "$", message: "文件顶层必须是对象" }],
      warnings: [],
    };
  }

  const record = raw as Record<string, unknown>;
  if (record["kind"] !== LEARNING_FILE_KIND) {
    issues.push({
      path: "$.kind",
      message: `不是学习记录文件（期望 kind = "${LEARNING_FILE_KIND}"）`,
    });
  }
  for (const key of Object.keys(record)) {
    if (!(SNAPSHOT_KEYS as readonly string[]).includes(key)) {
      issues.push({ path: `$.${key}`, message: `不认识的字段「${key}」` });
    }
  }
  issues.push(
    ...unknownKeyIssues(record["attempts"], ATTEMPT_KEYS, "attempts"),
    ...unknownKeyIssues(record["progress"], PROGRESS_KEYS, "progress"),
    ...unknownKeyIssues(record["favorites"], FAVORITE_KEYS, "favorites"),
    ...unknownKeyIssues(record["sessions"], SESSION_KEYS, "sessions"),
    ...unknownKeyIssues(record["examRecords"], EXAM_RECORD_KEYS, "examRecords"),
    ...examItemKeyIssues(record["examRecords"]),
  );

  const parsed = LearningSnapshotSchema.safeParse(raw, { errorMap: zhErrorMap });
  issues.push(...zodIssues(parsed));
  if (!parsed.success) return { ok: false, value: null, issues, warnings: [] };

  if (parsed.data.schemaVersion > SNAPSHOT_VERSION) {
    return {
      ok: false,
      value: null,
      issues: [
        ...issues,
        {
          path: "$.schemaVersion",
          message: `文件版本 v${parsed.data.schemaVersion} 高于当前支持的 v${SNAPSHOT_VERSION}`,
        },
      ],
      warnings: [],
    };
  }

  // 重复事件 ID：合并时会静默丢一条，所以必须在导入前拦住
  const seen = new Set<string>();
  parsed.data.attempts.forEach((attempt, index) => {
    if (seen.has(attempt.attemptId)) {
      issues.push({
        path: `attempts[${index}].attemptId`,
        message: `attemptId 重复：${attempt.attemptId}`,
      });
    }
    seen.add(attempt.attemptId);
  });

  // 成绩同理：recordId 重复 = 同一场考试写了两遍
  const seenRecords = new Set<string>();
  parsed.data.examRecords.forEach((record, index) => {
    if (seenRecords.has(record.recordId)) {
      issues.push({
        path: `examRecords[${index}].recordId`,
        message: `recordId 重复：${record.recordId}`,
      });
    }
    seenRecords.add(record.recordId);
  });

  const warnings: string[] = [];
  if (options.knownBankIds !== undefined) {
    const known = new Set(options.knownBankIds);
    const missing = new Set(
      [
        ...parsed.data.attempts.map((a) => a.bankId),
        ...parsed.data.favorites.map((f) => f.bankId),
      ].filter((id) => !known.has(id)),
    );
    for (const bankId of missing) {
      warnings.push(
        `记录里包含题库 ${bankId}，但本机尚未安装该题库包；这些记录会被保存，安装题库后可见`,
      );
    }
  }

  return { ok: issues.length === 0, value: issues.length === 0 ? parsed.data : null, issues, warnings };
}

/* -------------------------------------------------------------- 题库包 */

export function exportBankJson(bank: BankContent): string {
  return JSON.stringify(
    {
      kind: BANK_FILE_KIND,
      manifest: bank.manifest,
      questions: bank.questions,
      knowledge: bank.knowledge,
      passages: bank.passages ?? [],
    },
    null,
    2,
  );
}

export function parseBankJson(text: string): ParseResult<BankContent> {
  const read = readJson(text);
  if ("error" in read) return { ok: false, value: null, issues: [read.error], warnings: [] };

  const raw = read.value;
  if (raw === null || typeof raw !== "object") {
    return {
      ok: false,
      value: null,
      issues: [{ path: "$", message: "文件顶层必须是对象" }],
      warnings: [],
    };
  }

  const record = raw as Record<string, unknown>;
  const issues: ImportIssue[] = [];

  if (record["kind"] !== BANK_FILE_KIND) {
    issues.push({ path: "$.kind", message: `不是题库包文件（期望 kind = "${BANK_FILE_KIND}"）` });
  }
  for (const key of Object.keys(record)) {
    if (!(BANK_KEYS as readonly string[]).includes(key)) {
      // 顶层键名写错是最常见的手写事故：直接给出「是不是想写 X」
      issues.push({ path: `$.${key}`, message: topLevelKeyHint(key) });
    }
  }

  const manifest = record["manifest"];
  const questions = record["questions"];
  if (manifest === undefined || questions === undefined) {
    issues.push({ path: "$", message: "题库包必须包含 manifest 与 questions" });
    return { ok: false, value: null, issues, warnings: [] };
  }

  const passagesRaw = record["passages"] ?? [];
  if (!Array.isArray(passagesRaw)) {
    return {
      ok: false,
      value: null,
      issues: [...issues, { path: "$.passages", message: "passages 必须是数组" }],
      warnings: [],
    };
  }
  const passages: Passage[] = [];
  passagesRaw.forEach((raw, index) => {
    const parsed = PassageSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          path: `passages[${index}].${issue.path.join(".")}`,
          message: issue.message,
        });
      }
      return;
    }
    passages.push(parsed.data);
  });
  const seenPassage = new Set<string>();
  for (const p of passages) {
    if (seenPassage.has(p.passageId)) {
      issues.push({ path: "$.passages", message: `材料 ID 重复：${p.passageId}` });
    }
    seenPassage.add(p.passageId);
  }

  const validated = validateBankPackage({ manifest, questions, passages: passagesRaw });
  for (const issue of validated.issues) {
    issues.push({ path: issue.path ?? "$", message: `[${issue.code}] ${issue.message}` });
  }

  const knowledge = record["knowledge"] ?? [];
  if (!Array.isArray(knowledge)) {
    issues.push({ path: "$.knowledge", message: "knowledge 必须是数组" });
    return { ok: false, value: null, issues, warnings: [] };
  }

  // 讲义走与题目同样的校验强度：形状不对就拒绝，并指出是第几篇的哪个字段
  const validatedKnowledge = validateKnowledgeModules(knowledge);
  for (const issue of validatedKnowledge.issues) {
    issues.push({ path: issue.path ?? "$.knowledge", message: `[${issue.code}] ${issue.message}` });
  }

  const warnings = [...validatedKnowledge.warnings];
  if (issues.length > 0) return { ok: false, value: null, issues, warnings };

  return {
    ok: true,
    value: {
      manifest: manifest as BankContent["manifest"],
      questions: validated.questions,
      knowledge: validatedKnowledge.modules,
      passages,
    },
    issues,
    warnings,
  };
}

/* -------------------------------------------------------------- 合并 */

export interface MergeStats {
  readonly attemptsAdded: number;
  readonly attemptsKept: number;
  readonly favoritesAdded: number;
  readonly examRecordsAdded: number;
  readonly conflicts: readonly string[];
}

export interface MergeResult {
  readonly snapshot: LearningSnapshot;
  readonly stats: MergeStats;
}

/**
 * 合并两份快照：事件取并集，冲突不覆盖既有记录。
 *
 * "既有记录优先"是刻意的：导入是一份可能来自旧备份的文件，
 * 它没有资格改写本机已经发生的作答。
 */
export function mergeLearning(base: LearningSnapshot, incoming: LearningSnapshot): MergeResult {
  const attempts = new Map<string, Attempt>();
  for (const attempt of base.attempts) attempts.set(attempt.attemptId, attempt);

  let attemptsAdded = 0;
  let attemptsKept = 0;
  const conflicts: string[] = [];
  for (const attempt of incoming.attempts) {
    const existing = attempts.get(attempt.attemptId);
    if (existing === undefined) {
      attempts.set(attempt.attemptId, attempt);
      attemptsAdded += 1;
      continue;
    }
    attemptsKept += 1;
    if (JSON.stringify(existing) !== JSON.stringify(attempt)) {
      conflicts.push(attempt.attemptId);
    }
  }

  const favorites = new Map<string, FavoriteEntry>();
  for (const favorite of base.favorites) {
    favorites.set(`${favorite.bankId}\u0000${favorite.questionId}`, favorite);
  }
  let favoritesAdded = 0;
  for (const favorite of incoming.favorites) {
    const key = `${favorite.bankId}\u0000${favorite.questionId}`;
    const existing = favorites.get(key);
    if (existing === undefined) {
      favorites.set(key, favorite);
      favoritesAdded += 1;
    } else if (favorite.addedAt < existing.addedAt) {
      // 收藏时间取最早一次：它记录的是"我什么时候开始关注这道题"
      favorites.set(key, favorite);
    }
  }

  const mergedAttempts = [...attempts.values()].sort((a, b) =>
    a.submittedAt === b.submittedAt
      ? a.attemptId.localeCompare(b.attemptId)
      : a.submittedAt.localeCompare(b.submittedAt),
  );

  // 进度一律重算：导入文件里的 progress 只是别人算过的结果，不是事实
  const progress = recomputeProgress(mergedAttempts);

  const sessions = new Map<string, PracticeSession>();
  for (const session of base.sessions) sessions.set(session.bankId, session);
  for (const session of incoming.sessions) {
    const existing = sessions.get(session.bankId);
    if (existing === undefined || session.updatedAt >= existing.updatedAt) {
      sessions.set(session.bankId, session);
    }
  }

  // 成绩只增不改：同 recordId 以既有为准（导入文件没有资格改写本机成绩）
  const examRecords = new Map<string, ExamRecord>();
  for (const record of base.examRecords ?? []) examRecords.set(record.recordId, record);
  let examRecordsAdded = 0;
  for (const record of incoming.examRecords ?? []) {
    const existing = examRecords.get(record.recordId);
    if (existing === undefined) {
      examRecords.set(record.recordId, record);
      examRecordsAdded += 1;
    } else if (JSON.stringify(existing) !== JSON.stringify(record)) {
      conflicts.push(record.recordId);
    }
  }

  const snapshot: LearningSnapshot = {
    schemaVersion: SNAPSHOT_VERSION,
    exportedAt: incoming.exportedAt,
    attempts: mergedAttempts,
    progress: [...progress],
    favorites: [...favorites.values()],
    sessions: [...sessions.values()],
    settings: {
      activeBankId: incoming.settings.activeBankId ?? base.settings.activeBankId,
      practice: { ...base.settings.practice, ...incoming.settings.practice },
      // 时间戳取导入文件自己的：它是"这份数据什么时候定型的"证据，
      // 若用本地默认值覆盖，导出→导入就不再是恒等变换（对账会永远差一秒）
      updatedAt: incoming.settings.updatedAt,
    },
    examRecords: [...examRecords.values()],
  };

  return {
    snapshot,
    stats: { attemptsAdded, attemptsKept, favoritesAdded, examRecordsAdded, conflicts },
  };
}

/**
 * 落盘。写入前已经解析完毕，所以这里不会产生"部分写入"。
 * 写完立刻对账：条数对不上就抛错，让调用方把文件交给人看，而不是显示"导入成功"。
 */
export async function applyLearningSnapshot(
  platform: Platform,
  incoming: LearningSnapshot,
): Promise<MergeStats> {
  const base = await platform.exportAll();
  const { snapshot, stats } = mergeLearning(base, incoming);

  await platform.attempts.appendMany(snapshot.attempts);
  await platform.progress.saveMany(snapshot.progress);
  for (const favorite of snapshot.favorites) {
    await platform.favorites.add(favorite.bankId, favorite.questionId, favorite.addedAt);
  }
  for (const session of snapshot.sessions) await platform.sessions.save(session);
  for (const record of snapshot.examRecords) await platform.exams.appendRecord(record);
  await platform.settings.saveApp(snapshot.settings);

  const after = await platform.exportAll();
  if (after.attempts.length !== snapshot.attempts.length) {
    throw new Error(
      `导入对账失败：预期 ${snapshot.attempts.length} 条作答，实际写入 ${after.attempts.length} 条`,
    );
  }
  if (after.favorites.length !== snapshot.favorites.length) {
    throw new Error(
      `导入对账失败：预期 ${snapshot.favorites.length} 条收藏，实际 ${after.favorites.length} 条`,
    );
  }
  if ((after.examRecords?.length ?? 0) !== snapshot.examRecords.length) {
    throw new Error(
      `导入对账失败：预期 ${snapshot.examRecords.length} 条成绩，实际写入 ${after.examRecords?.length ?? 0} 条`,
    );
  }
  return stats;
}
