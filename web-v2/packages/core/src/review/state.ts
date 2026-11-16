/**
 * 复习状态机（S4 · T4-2）与调度（T4-3）。
 *
 * 设计上只做两件事，且都必须是纯函数：
 * - `reduceReview(state, event, config)`：一次作答如何改变状态（增量，供页面即时反馈）
 * - `replayReview(attempts, config)`：整段历史如何折叠成状态（全量，供重算与对账）
 *
 * 两者必须等价——S4 的 G4-4「清空派生状态后由 Attempt 重算，结果一致」就是这条等式。
 * 所以 `replayReview` 直接由 `reduceReview` 折叠而来，不另写一套判断。
 *
 * 时间：只做毫秒算术（`Date.parse` + n 小时），不碰日期/时区（ADR-0006）。
 */

import type { Attempt } from "../schema.js";

import {
  DEFAULT_REVIEW_CONFIG,
  INITIAL_REVIEW_STATE,
  type ReviewConfig,
  type ReviewEvent,
  type ReviewState,
} from "./types.js";

const HOUR_MS = 60 * 60 * 1000;

/** 只做毫秒加法：不取年月日，也就不会有时区问题 */
export function addHours(iso: string, hours: number): string {
  const base = Date.parse(iso);
  if (Number.isNaN(base)) throw new Error(`时间格式非法：${iso}`);
  return new Date(base + hours * HOUR_MS).toISOString();
}

/** 到期判定：只有 learning / reviewing 有到期概念；mastered 永不到期 */
export function isDueAt(
  status: ReviewState["status"],
  nextReviewAt: string | null,
  now: string,
): boolean {
  if (status !== "learning" && status !== "reviewing") return false;
  if (nextReviewAt === null) return false;
  return Date.parse(nextReviewAt) <= Date.parse(now);
}

export function isDue(state: ReviewState, now: string): boolean {
  return isDueAt(state.status, state.nextReviewAt, now);
}

/**
 * 一次答对是否算"独立复习"（ADR-0006）。
 *
 * 三条缺一不可：不是同一会话、已到期、处于 reviewing。
 * `learning` 状态的重做答对走另一条规则（见 `reduceReview`），
 * 因为它属于"重做"而不是"复习"。
 */
export function isIndependentReview(
  state: ReviewState,
  event: ReviewEvent,
  now: string = event.submittedAt,
): boolean {
  if (state.status !== "reviewing") return false;
  if (event.sessionId !== null && event.sessionId === state.lastCountedSessionId) return false;
  if (state.nextReviewAt !== null && Date.parse(now) < Date.parse(state.nextReviewAt)) return false;
  return true;
}

/**
 * 状态迁移（S4 §4 的规则表逐条落地）：
 *
 * | 事件 | 结果 |
 * | --- | --- |
 * | 答错（任意状态） | → learning，streak 归零，+24h |
 * | learning 答对（重做） | → reviewing，streak=1，+72h |
 * | reviewing 独立答对 | streak+1；未满则 +72h/+168h，满了 → mastered |
 * | reviewing 非独立答对 | 不变（同会话连点、提前重做都不推进） |
 * | mastered 答对 | 保持 mastered（不再排期） |
 * | mastered 答错 | 回落 learning，+24h |
 * | correct === null（主观未自评） | 不变 |
 */
export function reduceReview(
  state: ReviewState,
  event: ReviewEvent,
  config: ReviewConfig = DEFAULT_REVIEW_CONFIG,
): ReviewState {
  // 主观题没判定前，状态机不替用户做决定
  if (event.correct === null) return state;

  if (event.correct === false) {
    return {
      ...state,
      status: "learning",
      streak: 0,
      // 答错后 1 天再复习；"立即可重做"是界面能力，不是排期（ADR-0006）
      nextReviewAt: addHours(event.submittedAt, config.intervalsHours[0]),
      lastCountedSessionId: null,
    };
  }

  if (state.status === "new") {
    // 首次就答对：不进复习流程。复习闭环是针对错题的，不是给每题都排期
    return state;
  }

  if (state.status === "mastered") return state;

  if (state.status === "learning") {
    // "重做答对"直接进复习计划，但不永久移出错题（S4 §4）
    return {
      ...state,
      status: "reviewing",
      streak: 1,
      nextReviewAt: addHours(event.submittedAt, config.intervalsHours[1]),
      lastCountedSessionId: event.sessionId,
    };
  }

  // status === "reviewing"
  if (!isIndependentReview(state, event)) return state;

  const streak = state.streak + 1;
  if (streak >= config.masteryStreak) {
    return {
      ...state,
      status: "mastered",
      streak,
      nextReviewAt: null,
      lastCountedSessionId: event.sessionId,
    };
  }

  const interval =
    config.intervalsHours[Math.min(streak, config.intervalsHours.length - 1)] ??
    config.intervalsHours[config.intervalsHours.length - 1]!;
  return {
    ...state,
    status: "reviewing",
    streak,
    nextReviewAt: addHours(event.submittedAt, interval),
    lastCountedSessionId: event.sessionId,
  };
}

/** 把一条 Attempt 变成状态机事件；`correct` 直接沿用事件的判定（含 null） */
export function eventOf(attempt: Attempt): ReviewEvent {
  return {
    correct: attempt.correct,
    submittedAt: attempt.submittedAt,
    sessionId: attempt.sessionId ?? null,
  };
}

/**
 * 全量重放：按提交时间排序后逐条折叠。
 *
 * 排序必须稳定（同一毫秒按 attemptId），否则"最后一次作答"会在等价输入上抖动，
 * 重算对账就会偶尔不一致——那是比算错更难查的 bug。
 */
export function replayReview(
  attempts: readonly Attempt[],
  config: ReviewConfig = DEFAULT_REVIEW_CONFIG,
): ReviewState {
  const sorted = [...attempts].sort((a, b) =>
    a.submittedAt === b.submittedAt
      ? a.attemptId.localeCompare(b.attemptId)
      : a.submittedAt.localeCompare(b.submittedAt),
  );
  return sorted.reduce<ReviewState>(
    (state, attempt) => reduceReview(state, eventOf(attempt), config),
    INITIAL_REVIEW_STATE,
  );
}

/** 到期列表用的筛选：只要 due 的题，且不含 mastered（S4 §6-B） */
export function dueQuestionIds(
  entries: readonly { readonly questionId: string; readonly state: ReviewState }[],
  now: string,
): readonly string[] {
  return entries.filter((entry) => isDue(entry.state, now)).map((entry) => entry.questionId);
}
