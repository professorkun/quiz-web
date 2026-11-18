/**
 * 旧云端 → V2 五表的完整迁移转换器（S6 · T6-5 演练）。
 *
 * 分工：
 * - mastery / wrong_questions → attempts + progress：**直接复用 S1 已验证的 `dryRunLegacyRecords`**
 *   （exams 传空，避免 exam 明细既进 attempts 又进 exam_records_v2 造成双计）。
 * - exam_records → exam_records_v2（一场一条，items 来自 detail.items）。
 * - drill_progress（云端 + localStorage）→ practice_sessions。
 *
 * 原则同 S1：旧的缺失字段一律标"推断"，每条带 `importedFrom` 来源，不冒充真实作答。
 * 本模块**只产数据与报告，不写库**——演练在隔离内存里跑，正式迁移（T6-6）才落云。
 */

import type {
  Attempt,
  ExamRecord,
  ExamRecordItem,
  ExamTemplate,
  PracticeSession,
  Question,
  QuestionProgress,
} from "@quiz/core";

import {
  dryRunLegacyRecords,
  type DryRunIssue,
  type DryRunReport,
  type LegacyExamRow,
  type LegacyRecordsExport,
} from "./legacy-records.js";

export interface LegacyDrillRow {
  kp?: string;
  q_type?: string;
  q_keys: string[];
  idx?: number;
  res?: string;
  total?: number;
  updated_at?: string | null;
}

export interface MigrationV2Input {
  readonly legacy: LegacyRecordsExport;
  /** 云端 drill_progress 行 */
  readonly drill?: LegacyDrillRow | null;
  /** localStorage `jw_drill_progress_v1`（未登录时本地进度） */
  readonly localDrill?: LegacyDrillRow | null;
  readonly legacyMap: Readonly<Record<string, string>>;
  readonly questions: readonly Question[];
  readonly templates?: readonly ExamTemplate[];
  readonly exportedAt?: string;
}

export interface MigrationV2Report {
  readonly sources: { mastery: number; wrongs: number; exams: number; drill: number };
  readonly produced: { attempts: number; progress: number; examRecords: number; sessions: number };
  readonly dryRun: DryRunReport;
  readonly examIssues: readonly DryRunIssue[];
  readonly drillIssues: readonly DryRunIssue[];
}

export interface MigrationV2Result {
  readonly attempts: readonly Attempt[];
  readonly progress: readonly QuestionProgress[];
  readonly examRecords: readonly ExamRecord[];
  readonly sessions: readonly PracticeSession[];
  readonly report: MigrationV2Report;
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

function migrateExams(
  exams: readonly LegacyExamRow[],
  legacyMap: Readonly<Record<string, string>>,
  questions: readonly Question[],
  templates: readonly ExamTemplate[],
  exportedAt: string,
): { records: ExamRecord[]; issues: DryRunIssue[] } {
  const byId = new Map(questions.map((q) => [q.questionId, q]));
  const records: ExamRecord[] = [];
  const issues: DryRunIssue[] = [];

  for (const exam of exams) {
    const detailItems = exam.detail?.items ?? [];
    if (detailItems.length === 0) {
      issues.push({
        source: "exam_records",
        legacyKey: String(exam.id),
        reason: "该场考试没有 detail.items，无法还原到题目级",
      });
      continue;
    }
    const at = exam.created_at && exam.created_at.length ? exam.created_at : exportedAt;

    const items: ExamRecordItem[] = [];
    for (const it of detailItems) {
      const questionId = legacyMap[it.k];
      const q = questionId === undefined ? undefined : byId.get(questionId);
      if (!q) {
        issues.push({
          source: "exam_records",
          legacyKey: it.k,
          reason: "detail 里的题键无法解析",
        });
        continue;
      }
      const maxScore = sectionScoreOf(templates, q.type);
      const score = Math.max(0, Math.min(it.s, maxScore));
      const correct = score >= maxScore - 1e-9 ? true : score === 0 ? false : null;
      items.push({
        questionId: q.questionId,
        questionRevision: q.revision,
        questionType: q.type,
        sectionId: "imported",
        answered: true,
        answer: null,
        maxScore,
        score,
        correct,
        selfRating: null,
      });
    }
    if (items.length === 0) {
      issues.push({
        source: "exam_records",
        legacyKey: String(exam.id),
        reason: "题目明细一条都没能解析，整场丢弃",
      });
      continue;
    }

    const totalMax = items.reduce((n, i) => n + i.maxScore, 0);
    const totalScore = items.reduce((n, i) => n + i.score, 0);
    const objFull = exam.obj_full ?? 0;
    const subFull = exam.sub_full ?? 0;
    records.push({
      recordId: `legacy-exam-${String(exam.id)}`,
      bankId: questions[0]?.bankId ?? "javaweb",
      templateId: "legacy-imported",
      sessionId: `legacy-exam-${String(exam.id)}`,
      seed: 0,
      startedAt: at,
      submittedAt: at,
      durationSec: Math.max(0, Math.floor(exam.duration_sec ?? 0)),
      timedOut: false,
      objectiveScore: Math.max(0, exam.obj_score ?? 0),
      objectiveMax: Math.max(0, objFull),
      selfScore: Math.max(0, exam.sub_score ?? 0),
      selfMax: Math.max(0, subFull),
      totalScore,
      totalMax: Math.max(1, totalMax),
      items,
    });
  }
  return { records, issues };
}

function migrateDrill(
  drill: LegacyDrillRow | null | undefined,
  source: string,
  legacyMap: Readonly<Record<string, string>>,
  questions: readonly Question[],
  exportedAt: string,
): { session: PracticeSession | null; issues: DryRunIssue[] } {
  if (!drill || !Array.isArray(drill.q_keys) || drill.q_keys.length === 0) {
    return { session: null, issues: [] };
  }
  const issues: DryRunIssue[] = [];
  const questionIds: string[] = [];
  for (const k of drill.q_keys) {
    const qid = legacyMap[k];
    if (qid === undefined) {
      issues.push({ source, legacyKey: k, reason: "续刷队列里的旧键无法解析，已跳过该题" });
      continue;
    }
    questionIds.push(qid);
  }
  if (questionIds.length === 0) return { session: null, issues };

  // res 是位串（编码未完全确认）：长度与题数一致时按 1=right / 0=wrong 还原；否则留空
  const results: Record<string, "right" | "wrong" | "unseen"> = {};
  const res = drill.res ?? "";
  if (res.length === questionIds.length && /^[01]+$/.test(res)) {
    questionIds.forEach((qid, i) => {
      results[qid] = res[i] === "1" ? "right" : "wrong";
    });
  } else {
    for (const qid of questionIds) results[qid] = "unseen";
  }

  const at = drill.updated_at && drill.updated_at.length ? drill.updated_at : exportedAt;
  return {
    session: {
      sessionId: `legacy-drill-${at}-${String(drill.idx ?? 0)}`,
      bankId: questions[0]?.bankId ?? "javaweb",
      mode: "practice",
      questionIds,
      cursor: Math.max(0, Math.min(drill.idx ?? 0, questionIds.length)),
      results,
      startedAt: at,
      updatedAt: at,
    },
    issues,
  };
}

export function migrateLegacyToV2(input: MigrationV2Input): MigrationV2Result {
  const exportedAt = input.exportedAt ?? input.legacy.exportedAt ?? UNKNOWN_TIME;
  const templates = input.templates ?? [];

  // mastery + wrong_questions → attempts + progress（复用 S1，exams 传空避免双计）
  const dry = dryRunLegacyRecords(
    { exportedAt, mastery: input.legacy.mastery ?? [], wrongs: input.legacy.wrongs ?? [], exams: [] },
    input.legacyMap,
    input.questions,
    templates,
  );

  const exams = migrateExams(input.legacy.exams ?? [], input.legacyMap, input.questions, templates, exportedAt);

  const drillCloud = migrateDrill(input.drill ?? null, "drill_progress", input.legacyMap, input.questions, exportedAt);
  const drillLocal = migrateDrill(input.localDrill ?? null, "localStorage:jw_drill_progress_v1", input.legacyMap, input.questions, exportedAt);
  const sessions = [drillCloud.session, drillLocal.session].filter((s): s is PracticeSession => s !== null);

  return {
    attempts: dry.attempts,
    progress: dry.progress,
    examRecords: exams.records,
    sessions,
    report: {
      sources: {
        mastery: (input.legacy.mastery ?? []).length,
        wrongs: (input.legacy.wrongs ?? []).length,
        exams: (input.legacy.exams ?? []).length,
        drill: (input.drill ? 1 : 0) + (input.localDrill ? 1 : 0),
      },
      produced: {
        attempts: dry.attempts.length,
        progress: dry.progress.length,
        examRecords: exams.records.length,
        sessions: sessions.length,
      },
      dryRun: dry.report,
      examIssues: exams.issues,
      drillIssues: [...drillCloud.issues, ...drillLocal.issues],
    },
  };
}
