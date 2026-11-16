/**
 * 作答事件的构造（S3 · T3-1 的写入侧，S4 的 T4-1 复用）。
 *
 * 只有一条规矩：**事件一旦产生就不可变**。
 * 所以这里不提供 `updateAttempt`，`attemptId` 由调用方生成、本函数不重算，
 * `isFirstAttempt` 也必须从历史推断——不允许页面传一个"我猜是第一次"的布尔进来。
 *
 * `core` 不读系统时间：`startedAt / submittedAt / durationMs` 全部由调用方用注入的时钟算好。
 */

import type { Attempt, AttemptMode, Question } from "../schema.js";
import type { AnswerValue } from "../practice/types.js";
import type { GradeResult } from "../questions/types.js";

/** 该题此前是否已有作答：首次正确率只认第一次，重做不能把它抬高 */
export function isFirstAttemptFor(
  questionId: string,
  history: readonly Attempt[],
): boolean {
  return !history.some((a) => a.questionId === questionId);
}

export interface BuildAttemptInput {
  /** 由调用方生成（通常是 `${sessionId}-${seq}` + 随机后缀），保证重试不产生副本 */
  readonly attemptId: string;
  readonly question: Question;
  readonly answer: AnswerValue;
  readonly grade: GradeResult;
  readonly mode: AttemptMode;
  readonly sessionId: string;
  readonly startedAt: string;
  readonly submittedAt: string;
  /** 未记录时留空，不写 0——"没测"与"用了 0 毫秒"是两件事 */
  readonly durationMs?: number;
  /** 该题已有的作答历史，用于推断 `isFirstAttempt` */
  readonly history: readonly Attempt[];
  /** 迁移来的推断事件标记来源，真实作答不传 */
  readonly importedFrom?: string;
}

export function buildAttempt(input: BuildAttemptInput): Attempt {
  const durationMs =
    input.durationMs === undefined || input.durationMs < 0
      ? undefined
      : Math.round(input.durationMs);

  return {
    attemptId: input.attemptId,
    bankId: input.question.bankId,
    questionId: input.question.questionId,
    // 存"当时答的是哪一版"：题目改版后历史仍可解释（ADR-0001）
    questionRevision: input.question.revision,
    mode: input.mode,
    isFirstAttempt: isFirstAttemptFor(input.question.questionId, input.history),
    startedAt: input.startedAt,
    submittedAt: input.submittedAt,
    answer: input.answer,
    correct: input.grade.correct,
    score: input.grade.score,
    maxScore: input.grade.maxScore,
    sessionId: input.sessionId,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(input.importedFrom === undefined ? {} : { importedFrom: input.importedFrom }),
  };
}
