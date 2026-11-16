/**
 * 复习状态机的类型与规则配置（S4 · T4-2/T4-3）。
 *
 * 状态只有四个：`new → learning → reviewing → mastered`，加上"任一环节答错回退"。
 * 这里刻意不出现"权重""难度系数"——S4 文件 §8 写死了：出现"再考虑一下权重"的讨论，
 * 就说明规则开始玄学化了，要锁回 1/3/7 天。
 */

/** 五类错因（S4 §4）。文案是展示层的事，这里只存 key，避免改文案动数据 */
export const ERROR_CAUSES = [
  "knowledge_gap",
  "method_error",
  "misread",
  "calculation_slip",
  "time_shortage",
] as const;
export type ErrorCause = (typeof ERROR_CAUSES)[number];

export const ERROR_CAUSE_LABEL: Record<ErrorCause, string> = {
  knowledge_gap: "知识漏洞",
  method_error: "方法错误",
  misread: "审题不清",
  calculation_slip: "计算与输入失误",
  time_shortage: "时间不足",
};

export type ReviewStatus = "new" | "learning" | "reviewing" | "mastered";

/** 一个题目的复习状态。全部字段都是 `Attempt` 序列的投影，可随时重算 */
export interface ReviewState {
  readonly status: ReviewStatus;
  /** 连续独立答对次数；答错即归零 */
  readonly streak: number;
  /** 下次到期时间（ISO）；`mastered` 时为 null */
  readonly nextReviewAt: string | null;
  /** 错因只记最近一次标记，不改判分、不参与调度 */
  readonly errorCause: ErrorCause | null;
  /** 上一次被计入 streak 的会话；用于"同一会话连点不计数" */
  readonly lastCountedSessionId: string | null;
}

export interface ReviewConfig {
  /**
   * 三个间隔（小时）：答错后 1 天、第 1 次答对后 3 天、第 2 次答对后 7 天。
   * 用小时而不是天，是因为口径按 24h 推进（ADR-0006）。
   */
  readonly intervalsHours: readonly [number, number, number];
  /** 连续独立答对多少次转已掌握 */
  readonly masteryStreak: number;
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  intervalsHours: [24, 72, 168],
  masteryStreak: 3,
};

/** 一次作答对状态机的影响。来自 `Attempt`，但只取判定需要的字段 */
export interface ReviewEvent {
  readonly correct: boolean | null;
  readonly submittedAt: string;
  readonly sessionId: string | null;
}

export const INITIAL_REVIEW_STATE: ReviewState = {
  status: "new",
  streak: 0,
  nextReviewAt: null,
  errorCause: null,
  lastCountedSessionId: null,
};
