/**
 * 会话序列化与恢复（T2-7，ADR-0003 §4/§5）。
 *
 * 三条硬要求：
 * - 恢复 = 把快照原样读回（题序、选项序、作答、游标逐项一致），**不重放随机数**；
 * - 题目 revision 变化 → 明确提示 + 该题按新版本重新作答，其余已完成记录保留；
 * - 会话带 version；不兼容时提示「会话已过期」，绝不崩溃、绝不静默清空。
 */

import type { Question } from "../schema.js";
import type { GradeResult } from "../questions/types.js";
import type { SelfRating } from "../questions/short_answer/selfRating.js";
import {
  SESSION_VERSION,
  type AnswerValue,
  type PreservedRecord,
  type RestoreResult,
  type SessionSnapshot,
} from "./types.js";

export function serializeSession(session: SessionSnapshot): string {
  return JSON.stringify(session);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** 即使会话过期，已完成的作答/判分/自评也要作为记录交给 UI 保留 */
function extractPreserved(raw: unknown): PreservedRecord[] {
  const snap = asRecord(raw);
  const grades = asRecord(snap.grades);
  const answers = asRecord(snap.answers);
  const ratings = asRecord(snap.selfRatings);
  return Object.keys(grades).map((questionId) => ({
    questionId,
    grade: grades[questionId] as GradeResult,
    answer: answers[questionId] as AnswerValue | undefined,
    selfRating: ratings[questionId] as PreservedRecord["selfRating"],
  }));
}

function reject(reason: string, raw: unknown): RestoreResult {
  return {
    ok: false,
    session: null,
    reason,
    conflicts: [],
    warnings: [],
    preserved: extractPreserved(raw),
  };
}

export function restoreSession(
  raw: string | unknown,
  currentQuestions: readonly Question[],
): RestoreResult {
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return reject("会话数据已损坏，无法解析；请重新开始，已完成记录已保留", null);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return reject("会话格式无法识别；请重新开始，已完成记录已保留", parsed);
  }

  const snap = parsed as Partial<SessionSnapshot>;
  if (snap.version !== SESSION_VERSION) {
    return reject(
      `会话版本 ${String(snap.version)} 与当前版本 ${SESSION_VERSION} 不兼容，已过期；请重新开始，已完成记录已保留`,
      parsed,
    );
  }
  if (
    !Array.isArray(snap.questionIds) ||
    snap.questionIds.length === 0 ||
    typeof snap.cursor !== "number" ||
    typeof snap.sessionId !== "string" ||
    typeof snap.config !== "object"
  ) {
    return reject("会话字段缺失或格式错误；请重新开始，已完成记录已保留", parsed);
  }

  const byId = new Map(currentQuestions.map((q) => [q.questionId, q]));
  const conflicts: string[] = [];
  const warnings: string[] = [];
  const answers: Record<string, AnswerValue> = { ...asRecord(snap.answers) } as Record<
    string,
    AnswerValue
  >;
  const grades: Record<string, GradeResult> = { ...asRecord(snap.grades) } as Record<
    string,
    GradeResult
  >;
  const selfRatings: Record<string, SelfRating> = { ...asRecord(snap.selfRatings) } as Record<
    string,
    SelfRating
  >;
  const revisions: Record<string, string> = { ...asRecord(snap.questionRevisions) } as Record<
    string,
    string
  >;
  const optionOrders: Record<string, readonly string[]> = {
    ...asRecord(snap.optionOrders),
  } as Record<string, readonly string[]>;

  for (const questionId of snap.questionIds) {
    const question = byId.get(questionId);
    if (question === undefined) {
      conflicts.push(questionId);
      warnings.push(`题目 ${questionId} 已从题库下线，无法恢复该题`);
      delete answers[questionId];
      delete grades[questionId];
      delete revisions[questionId];
      delete optionOrders[questionId];
      continue;
    }

    const before = revisions[questionId];
    if (before !== question.revision) {
      conflicts.push(questionId);
      warnings.push(
        `题目 ${questionId} 已更新（revision ${String(before)} → ${question.revision}），该题按新版本重新作答`,
      );
      delete answers[questionId];
      delete grades[questionId];
      delete selfRatings[questionId];
      revisions[questionId] = question.revision;
    }

    // 选项集合变了：保留已有顺序，把新选项追加末尾，与渲染层 orderedOptions 口径一致
    const order = optionOrders[questionId];
    if (order !== undefined && "options" in question) {
      const ids = question.options.map((o) => o.optionId);
      const valid = order.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !valid.includes(id));
      if (valid.length !== order.length || missing.length > 0) {
        warnings.push(`题目 ${questionId} 的选项有更新，已补齐且未重排已有顺序`);
        optionOrders[questionId] = [...valid, ...missing];
      }
    }
  }

  const maxCursor = Math.max(0, snap.questionIds.length - 1);
  const cursor = Math.max(0, Math.min(maxCursor, Math.trunc(snap.cursor)));
  if (cursor !== snap.cursor) {
    warnings.push(`当前题位置 ${snap.cursor} 超出范围，已调整到 ${cursor}`);
  }

  const session: SessionSnapshot = {
    version: SESSION_VERSION,
    sessionId: snap.sessionId,
    bankId: typeof snap.bankId === "string" ? snap.bankId : "",
    config: snap.config as SessionSnapshot["config"],
    questionIds: snap.questionIds,
    optionOrders,
    questionRevisions: revisions,
    answers,
    selfRatings,
    grades,
    cursor,
    startedAt: typeof snap.startedAt === "string" ? snap.startedAt : "",
    updatedAt: typeof snap.updatedAt === "string" ? snap.updatedAt : "",
  };

  return { ok: true, session, conflicts, warnings, preserved: [] };
}
