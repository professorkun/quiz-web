/**
 * 模考会话（S5 · T5-3）：卷面快照 + 作答 + 计时 + 中断恢复。
 *
 * 与练习会话的差别：
 * 1. **判分不在会话里**——整卷交卷时才判（旧版口径），会话只有作答；
 * 2. 答案在交卷前可改（旧版 `S.submitted` 锁定前随便改），练习是逐题提交不可改；
 * 3. 计时是**倒计时**：`deadlineAt` 是绝对时刻，刷新/关页面后剩余时间天然正确
 *    （D-3：剩 12 分钟刷新 → 仍剩约 12 分钟，而不是从头再来）。
 *
 * 恢复口径与练习会话一致（ADR-0003 §5）：原样读回题序、选项序、已答、游标；
 * revision 变化的题单独提示重答，不整卷作废。
 */

import type { ExamTemplate, Question } from "../schema.js";
import type { AnswerValue } from "../practice/types.js";
import type { ExamPaper, ExamPaperItem } from "./assemble.js";

export const EXAM_SESSION_VERSION = 1 as const;

export interface ExamSessionSnapshot {
  readonly version: typeof EXAM_SESSION_VERSION;
  readonly sessionId: string;
  readonly bankId: string;
  readonly templateId: string;
  readonly title: string;
  readonly seed: number;
  /** 组卷结果冻结进快照：恢复不重抽，题序就是当时的题序 */
  readonly items: readonly ExamPaperItem[];
  readonly optionOrders: Readonly<Record<string, readonly string[]>>;
  readonly questionRevisions: Readonly<Record<string, string>>;
  readonly answers: Readonly<Record<string, AnswerValue>>;
  readonly cursor: number;
  readonly startedAt: string;
  readonly updatedAt: string;
  /** 截止时刻（ISO）。null = 不限时（旧版行为），此时只显示已用时 */
  readonly deadlineAt: string | null;
  readonly durationSec?: number;
}

export interface CreateExamSessionInput {
  readonly paper: ExamPaper;
  readonly sessionId: string;
  /** 注入的当前时刻（ISO）：core 不读系统时钟 */
  readonly now: string;
}

export function createExamSession(input: CreateExamSessionInput): ExamSessionSnapshot {
  const { paper, sessionId, now } = input;
  const questionIds = paper.items.map((i) => i.questionId);
  if (questionIds.length === 0) {
    throw new Error("空卷不能开考：组卷结果为 0 题");
  }
  return {
    version: EXAM_SESSION_VERSION,
    sessionId,
    bankId: paper.bankId,
    templateId: paper.templateId,
    title: paper.title,
    seed: paper.seed,
    items: paper.items,
    optionOrders: paper.optionOrders,
    questionRevisions: paper.questionRevisions,
    answers: {},
    cursor: 0,
    startedAt: now,
    updatedAt: now,
    deadlineAt:
      paper.durationSec === undefined
        ? null
        : new Date(Date.parse(now) + paper.durationSec * 1000).toISOString(),
    ...(paper.durationSec === undefined ? {} : { durationSec: paper.durationSec }),
  };
}

/** 交卷前答案可改（旧版口径）；卷面里没有的题不收 */
export function setExamAnswer(
  session: ExamSessionSnapshot,
  questionId: string,
  answer: AnswerValue,
  now: string,
): ExamSessionSnapshot {
  if (!session.items.some((i) => i.questionId === questionId)) return session;
  return {
    ...session,
    answers: { ...session.answers, [questionId]: answer },
    updatedAt: now,
  };
}

export function moveExamTo(
  session: ExamSessionSnapshot,
  cursor: number,
  now: string,
): ExamSessionSnapshot {
  const max = Math.max(0, session.items.length - 1);
  const next = Math.max(0, Math.min(max, Math.trunc(cursor)));
  return next === session.cursor ? session : { ...session, cursor: next, updatedAt: now };
}

export function examGoNext(session: ExamSessionSnapshot, now: string): ExamSessionSnapshot {
  return moveExamTo(session, session.cursor + 1, now);
}

export function examGoPrev(session: ExamSessionSnapshot, now: string): ExamSessionSnapshot {
  return moveExamTo(session, session.cursor - 1, now);
}

export function currentExamQuestionId(session: ExamSessionSnapshot): string | undefined {
  return session.items[session.cursor]?.questionId;
}

/**
 * 剩余毫秒；null = 不限时。可以为负（已超时），由调用方决定提示与自动交卷。
 * 用注入的 `now` 算差值，不读系统时钟——测试可做时间旅行。
 */
export function remainingMs(session: ExamSessionSnapshot, now: string): number | null {
  if (session.deadlineAt === null) return null;
  return Date.parse(session.deadlineAt) - Date.parse(now);
}

export function isExamExpired(session: ExamSessionSnapshot, now: string): boolean {
  const remaining = remainingMs(session, now);
  return remaining !== null && remaining <= 0;
}

/** 未作答的题：选择/判断无选择、文本全空白、空位题一个空都没填 */
export function unansweredQuestionIds(
  session: Pick<ExamSessionSnapshot, "items" | "answers">,
  questions: readonly Question[],
): readonly string[] {
  const byId = new Map(questions.map((q) => [q.questionId, q]));
  const out: string[] = [];
  for (const item of session.items) {
    const question = byId.get(item.questionId);
    const answer = session.answers[item.questionId];
    if (answer === undefined) {
      out.push(item.questionId);
      continue;
    }
    if (question === undefined) continue;
    if (question.type === "fill_blank" || question.type === "code_blank") {
      const record = answer as Readonly<Record<string, string>>;
      const anyFilled = Object.values(record).some((v) => v.trim() !== "");
      if (!anyFilled) out.push(item.questionId);
    } else if (question.type === "short_answer") {
      if (String(answer).trim() === "") out.push(item.questionId);
    }
  }
  return out;
}

export function serializeExamSession(session: ExamSessionSnapshot): string {
  return JSON.stringify(session);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export interface ExamRestoreResult {
  readonly ok: boolean;
  readonly session: ExamSessionSnapshot | null;
  /** 版本不兼容 / 数据损坏时的提示，UI 必须显示而不是静默清空 */
  readonly reason?: string;
  /** revision 变化或下线的题：按新版本重新作答 */
  readonly conflicts: readonly string[];
  readonly warnings: readonly string[];
}

function reject(reason: string): ExamRestoreResult {
  return { ok: false, session: null, reason, conflicts: [], warnings: [] };
}

/**
 * 恢复模考会话：题序、选项序、已答、游标、剩余时间全部原样读回（D-3）。
 * 截止时刻是绝对时间，恢复时不重新计算——刷新浪费的时间不会被"补回来"。
 */
export function restoreExamSession(
  raw: string | unknown,
  currentQuestions: readonly Question[],
): ExamRestoreResult {
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return reject("模考会话数据已损坏，无法解析；请重新开始，已作答内容会保留到成绩里");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return reject("模考会话格式无法识别；请重新开始，已作答内容会保留到成绩里");
  }
  const snap = parsed as Partial<ExamSessionSnapshot>;
  if (snap.version !== EXAM_SESSION_VERSION) {
    return reject(`模考会话版本 ${String(snap.version)} 与当前 ${EXAM_SESSION_VERSION} 不兼容，已过期`);
  }
  if (
    !Array.isArray(snap.items) ||
    snap.items.length === 0 ||
    typeof snap.cursor !== "number" ||
    typeof snap.sessionId !== "string"
  ) {
    return reject("模考会话字段缺失或格式错误；请重新开始");
  }

  const byId = new Map(currentQuestions.map((q) => [q.questionId, q]));
  const conflicts: string[] = [];
  const warnings: string[] = [];
  const answers: Record<string, AnswerValue> = {
    ...asRecord(snap.answers),
  } as Record<string, AnswerValue>;
  const revisions: Record<string, string> = {
    ...asRecord(snap.questionRevisions),
  } as Record<string, string>;
  const optionOrders: Record<string, readonly string[]> = {
    ...asRecord(snap.optionOrders),
  } as Record<string, readonly string[]>;
  const items: ExamPaperItem[] = [];

  for (const rawItem of snap.items) {
    const item = rawItem as ExamPaperItem;
    const question = byId.get(item.questionId);
    if (question === undefined) {
      conflicts.push(item.questionId);
      warnings.push(`题目 ${item.questionId} 已从题库下线，该题无法继续作答`);
      delete answers[item.questionId];
      continue;
    }
    const before = revisions[item.questionId];
    if (before !== undefined && before !== question.revision) {
      conflicts.push(item.questionId);
      warnings.push(
        `题目 ${item.questionId} 已更新（revision ${before} → ${question.revision}），该题按新版本重新作答`,
      );
      delete answers[item.questionId];
      revisions[item.questionId] = question.revision;
    }
    items.push(item);
  }

  const maxCursor = Math.max(0, items.length - 1);
  const cursor = Math.max(0, Math.min(maxCursor, Math.trunc(snap.cursor)));
  if (cursor !== snap.cursor) {
    warnings.push(`当前题位置 ${snap.cursor} 超出范围，已调整到 ${cursor}`);
  }

  const session: ExamSessionSnapshot = {
    version: EXAM_SESSION_VERSION,
    sessionId: snap.sessionId,
    bankId: typeof snap.bankId === "string" ? snap.bankId : "",
    templateId: typeof snap.templateId === "string" ? snap.templateId : "",
    title: typeof snap.title === "string" ? snap.title : "",
    seed: typeof snap.seed === "number" ? snap.seed : 0,
    items,
    optionOrders,
    questionRevisions: revisions,
    answers,
    cursor,
    startedAt: typeof snap.startedAt === "string" ? snap.startedAt : "",
    updatedAt: typeof snap.updatedAt === "string" ? snap.updatedAt : "",
    deadlineAt: typeof snap.deadlineAt === "string" ? snap.deadlineAt : snap.deadlineAt ?? null,
    ...(snap.durationSec === undefined ? {} : { durationSec: snap.durationSec }),
  };
  return { ok: true, session, conflicts, warnings };
}

/** 会话里的卷面是否仍然符合模板（交卷前自检，防手改快照） */
export function examSessionMatchesTemplate(
  session: ExamSessionSnapshot,
  template: ExamTemplate,
): boolean {
  const bySection = new Map<string, number>();
  for (const item of session.items) {
    bySection.set(item.sectionId, (bySection.get(item.sectionId) ?? 0) + 1);
  }
  return template.sections.every(
    (s) => bySection.get(s.sectionId) === s.count && bySection.size === template.sections.length,
  );
}
