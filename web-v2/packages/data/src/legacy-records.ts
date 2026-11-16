/**
 * T1-6：旧学习记录 → 新契约的 **dry-run**（只出报告与候选数据，不写库）。
 *
 * 旧数据的三张表都缺关键信息，所以这里的原则是：
 * **宁可标成"推断"也不假装是事实**。每条合成 Attempt 都带 `importedFrom`。
 *
 * 三个源的事实密度完全不同：
 * - `quiz_mastery`：只知道「做对过」，无时间、无次数 → 合成 1 条 correct=true
 * - `wrong_questions`：知道错了几次、最后一次时间 → 合成 wrong_count 条 correct=false
 * - `exam_records.detail`：知道每题得分，但不知道答案 → correct 依分数推断，部分分记 null
 */

import type {
  Attempt,
  AttemptMode,
  ExamTemplate,
  Question,
  QuestionProgress,
} from "@quiz/core";
import { computeProgress } from "./progress.js";

export interface LegacyMasteryRow {
  q_key: string;
  q_type: string;
}

export interface LegacyWrongRow {
  q_key: string;
  q_type: string;
  q_no?: number;
  kp?: string;
  stem?: string;
  wrong_count: number;
  last_wrong_at?: string | null;
}

export interface LegacyExamRow {
  id: string | number;
  total?: number;
  obj_score?: number;
  sub_score?: number;
  obj_full?: number;
  sub_full?: number;
  question_count?: number;
  duration_sec?: number;
  detail?: { items?: { k: string; s: number }[] } | null;
  created_at?: string | null;
}

export interface LegacyRecordsExport {
  exportedAt?: string;
  mastery?: LegacyMasteryRow[];
  wrongs?: LegacyWrongRow[];
  exams?: LegacyExamRow[];
}

export interface DryRunIssue {
  readonly source: string;
  readonly legacyKey: string;
  readonly reason: string;
}

export interface DryRunReport {
  readonly totals: {
    readonly mastery: number;
    readonly wrongs: number;
    readonly exams: number;
    readonly examItems: number;
    readonly legacyKeys: number;
  };
  readonly mappedKeys: number;
  /** 0–1；验收要求 1.0 */
  readonly mappingRate: number;
  readonly unmapped: readonly DryRunIssue[];
  readonly conflicts: readonly DryRunIssue[];
  readonly dropped: readonly DryRunIssue[];
  /** 因源数据缺失而只能推断的字段说明 */
  readonly estimated: readonly string[];
  readonly attemptsByMode: Readonly<Record<string, number>>;
}

export interface DryRunResult {
  readonly attempts: readonly Attempt[];
  readonly progress: readonly QuestionProgress[];
  readonly report: DryRunReport;
}

const UNKNOWN_TIME = "1970-01-01T00:00:00.000Z";

function sectionScoreOf(templates: readonly ExamTemplate[], questionType: string): number {
  for (const t of templates) {
    for (const s of t.sections) {
      if (s.questionType === questionType) return s.scoreEach;
    }
  }
  return 1;
}

export function dryRunLegacyRecords(
  payload: LegacyRecordsExport,
  legacyMap: Readonly<Record<string, string>>,
  questions: readonly Question[],
  templates: readonly ExamTemplate[] = [],
): DryRunResult {
  const byId = new Map(questions.map((q) => [q.questionId, q]));
  const attempts: Attempt[] = [];
  const unmapped: DryRunIssue[] = [];
  const conflicts: DryRunIssue[] = [];
  const dropped: DryRunIssue[] = [];
  const estimated = new Set<string>();
  const mapping: Record<string, AttemptMode> = {};

  const exportedAt = payload.exportedAt && payload.exportedAt.length ? payload.exportedAt : UNKNOWN_TIME;
  if (!payload.exportedAt) estimated.add("所有缺失时间戳一律记为 1970-01-01（源数据没有该字段）");

  let seq = 0;
  const nextId = (prefix: string): string => {
    seq += 1;
    return `imported:${prefix}:${String(seq).padStart(4, "0")}`;
  };

  /**
   * 解析旧键 → 题目。两类失败必须分开记：
   * - 映射表里根本没有这个键 → `unmapped`（迁移器没覆盖到，属漏映射）
   * - 映射表指向了题，但题库包里没有这道题 → `conflict`（数据不一致）
   * 混在一起会让人以为「漏映射」和「数据坏了」是同一件事。
   */
  const resolve = (legacyKey: string, source: string): Question | null => {
    const questionId = legacyMap[legacyKey];
    if (!questionId) {
      unmapped.push({ source, legacyKey, reason: "legacy-map 中没有这个旧键" });
      return null;
    }
    const q = byId.get(questionId);
    if (!q) {
      conflicts.push({ source, legacyKey, reason: `映射到 ${questionId}，但题库包中没有这道题` });
      return null;
    }
    return q;
  };

  // —— mastery：只知「做对过」
  for (const row of payload.mastery ?? []) {
    const q = resolve(row.q_key, "mastery");
    if (!q) continue;
    mapping[row.q_key] = "practice";
    attempts.push({
      attemptId: nextId("mastery"),
      bankId: q.bankId,
      questionId: q.questionId,
      questionRevision: q.revision,
      mode: "practice",
      // 旧数据无法判断是不是首次作答，保守记 false（不虚增"首次正确率"）
      isFirstAttempt: false,
      startedAt: exportedAt,
      submittedAt: exportedAt,
      answer: null,
      correct: true,
      score: 1,
      maxScore: 1,
      importedFrom: "quiz_mastery",
    });
  }

  // —— wrong_questions：错了几次就补几条
  for (const row of payload.wrongs ?? []) {
    const q = resolve(row.q_key, "wrong_questions");
    if (!q) continue;
    mapping[row.q_key] = "practice";
    const times = Math.max(1, Math.floor(row.wrong_count ?? 1));
    const at = row.last_wrong_at && row.last_wrong_at.length ? row.last_wrong_at : exportedAt;
    if (!row.last_wrong_at) estimated.add("错题的最后错误时间缺失，已用导出时间兜底");
    for (let i = 0; i < times; i++) {
      attempts.push({
        attemptId: nextId("wrong"),
        bankId: q.bankId,
        questionId: q.questionId,
        questionRevision: q.revision,
        mode: "practice",
        isFirstAttempt: false,
        startedAt: at,
        submittedAt: at,
        answer: null,
        correct: false,
        score: 0,
        maxScore: 1,
        importedFrom: "wrong_questions",
      });
    }
  }

  // —— exam_records.detail：逐题得分 → 推断对错
  let examItems = 0;
  for (const exam of payload.exams ?? []) {
    const items = exam.detail?.items ?? [];
    if (!items.length) {
      dropped.push({
        source: "exam_records",
        legacyKey: String(exam.id),
        reason: "该场考试没有 detail.items，无法还原到题目级",
      });
      continue;
    }
    const at = exam.created_at && exam.created_at.length ? exam.created_at : exportedAt;
    if (!exam.created_at) estimated.add("模考记录缺少 created_at，已用导出时间兜底");

    for (const item of items) {
      examItems += 1;
      const q = resolve(item.k, `exam_records:${String(exam.id)}`);
      if (!q) {
        dropped.push({
          source: "exam_records",
          legacyKey: item.k,
          reason: "detail 里的题键无法解析",
        });
        continue;
      }
      mapping[item.k] = "exam";
      const maxScore = sectionScoreOf(templates, q.type);
      const score = Math.max(0, Math.min(item.s, maxScore));
      // 有得分但没满分 → 多半是主观题自评的部分分，不能断言对或错
      const correct = score >= maxScore - 1e-9 ? true : score === 0 ? false : null;
      attempts.push({
        attemptId: nextId("exam"),
        bankId: q.bankId,
        questionId: q.questionId,
        questionRevision: q.revision,
        mode: "exam",
        isFirstAttempt: false,
        startedAt: at,
        submittedAt: at,
        answer: null,
        correct,
        score,
        maxScore,
        importedFrom: `exam_records:${String(exam.id)}`,
      });
    }
  }

  // —— 进度由 Attempt 重算（派生数据必须可重算）
  const grouped = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = grouped.get(a.questionId);
    if (list) list.push(a);
    else grouped.set(a.questionId, [a]);
  }
  const progress: QuestionProgress[] = [];
  for (const [questionId, list] of grouped) {
    const q = byId.get(questionId);
    if (!q) continue;
    progress.push(computeProgress(q.bankId, questionId, list));
  }

  const legacyKeys = new Set<string>([
    ...(payload.mastery ?? []).map((r) => r.q_key),
    ...(payload.wrongs ?? []).map((r) => r.q_key),
    ...(payload.exams ?? []).flatMap((e) => (e.detail?.items ?? []).map((i) => i.k)),
  ]);

  const attemptsByMode: Record<string, number> = {};
  for (const a of attempts) attemptsByMode[a.mode] = (attemptsByMode[a.mode] ?? 0) + 1;

  const report: DryRunReport = {
    totals: {
      mastery: (payload.mastery ?? []).length,
      wrongs: (payload.wrongs ?? []).length,
      exams: (payload.exams ?? []).length,
      examItems,
      legacyKeys: legacyKeys.size,
    },
    mappedKeys: Object.keys(mapping).length,
    mappingRate: legacyKeys.size === 0 ? 1 : Object.keys(mapping).length / legacyKeys.size,
    unmapped,
    conflicts,
    dropped,
    estimated: [...estimated],
    attemptsByMode,
  };

  return { attempts, progress, report };
}
