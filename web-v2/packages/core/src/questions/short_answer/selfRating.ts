/**
 * 简答自评（T2-5），纯函数，与判分完全分离。
 *
 * 旧版 `selfEval()` 的三档是 `data-v="1 / 0.5 / 0"`，分数写在 `data-s` 上，
 * 由 `bindSelfEval()` 在交卷后整页扫描按钮绑定事件——曾因只扫了成绩卡而全部漏绑。
 * 这里把「档位 → 分数比例」收成一张表，UI 只负责回调档位，
 * 自评结果单独存 `selfRating`，绝不写回 `answer`、也绝不改 `correct`。
 */

import type { Question } from "../../schema.js";

export type ShortAnswerQuestion = Extract<Question, { type: "short_answer" }>;

export const SELF_RATING_LEVELS = ["full", "half", "none"] as const;
export type SelfRatingLevel = (typeof SELF_RATING_LEVELS)[number];

export interface SelfRating {
  readonly level: SelfRatingLevel;
  readonly score: number;
  readonly maxScore: number;
}

const FRACTION: Readonly<Record<SelfRatingLevel, number>> = {
  full: 1,
  half: 0.5,
  none: 0,
};

export function selfRatingFraction(level: SelfRatingLevel): number {
  return FRACTION[level];
}

export function makeSelfRating(level: SelfRatingLevel, maxScore: number): SelfRating {
  return { level, score: maxScore * FRACTION[level], maxScore };
}

/** 采分点分值合计，作为该题自评满分（旧版按题写死分数，新版从内容配置读） */
export function rubricMaxScore(question: Pick<ShortAnswerQuestion, "rubric">): number {
  return question.rubric.reduce((sum, point) => sum + point.score, 0);
}

export function isSelfRatingLevel(value: unknown): value is SelfRatingLevel {
  return typeof value === "string" && (SELF_RATING_LEVELS as readonly string[]).includes(value);
}
