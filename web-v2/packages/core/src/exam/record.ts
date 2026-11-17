/**
 * 成绩记录（S5 · T5-5 / T5-7 数据面）。
 *
 * 两条不变式：
 * 1. **记录只增不改**：客观得分、作答原文、判分明细一经交卷就冻结
 *    （§9 回退方案：异常成绩标记作废而不是改数字）；
 * 2. **自评单字段**：`selfRating` 可改、带 `ratedAt`，但永远不写回
 *    `score / correct / answer`——D-5「自评不覆盖客观分」。
 */

import type { ExamRecord, ExamRecordItem, ExamSelfRating } from "../schema.js";
import { makeSelfRating, type SelfRatingLevel } from "../questions/short_answer/selfRating.js";
import type { ExamGradeSummary } from "./grading.js";

export interface BuildExamRecordInput {
  readonly recordId: string;
  readonly bankId: string;
  readonly templateId: string;
  readonly sessionId: string;
  readonly seed: number;
  readonly startedAt: string;
  readonly submittedAt: string;
  readonly durationSec: number;
  readonly timedOut?: boolean;
  readonly summary: ExamGradeSummary;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function totalsOf(items: readonly ExamRecordItem[]): Pick<
  ExamRecord,
  "objectiveScore" | "objectiveMax" | "selfScore" | "selfMax" | "totalScore" | "totalMax"
> {
  let objectiveScore = 0;
  let objectiveMax = 0;
  let selfScore = 0;
  let selfMax = 0;
  for (const item of items) {
    if (item.correct === null) {
      selfMax += item.maxScore;
      selfScore += item.selfRating?.score ?? 0;
    } else {
      objectiveMax += item.maxScore;
      objectiveScore += item.score;
    }
  }
  return {
    objectiveScore: round2(objectiveScore),
    objectiveMax: round2(objectiveMax),
    selfScore: round2(selfScore),
    selfMax: round2(selfMax),
    totalScore: round2(objectiveScore + selfScore),
    totalMax: round2(objectiveMax + selfMax),
  };
}

/** 交卷瞬间的成绩快照：items 来自判分结果，自评后由 `setExamSelfRating` 更新 */
export function buildExamRecord(input: BuildExamRecordInput): ExamRecord {
  const items = input.summary.items.map((item) => ({ ...item, selfRating: item.selfRating ?? null }));
  return {
    recordId: input.recordId,
    bankId: input.bankId,
    templateId: input.templateId,
    sessionId: input.sessionId,
    seed: input.seed,
    startedAt: input.startedAt,
    submittedAt: input.submittedAt,
    durationSec: input.durationSec,
    timedOut: input.timedOut ?? false,
    ...totalsOf(items),
    items,
  };
}

/**
 * 自评：只动 `items[i].selfRating` 与自评合计。
 * 客观题拒绝自评（返回原记录）；主观题分值按档位 × 该题满分。
 */
export function setExamSelfRating(
  record: ExamRecord,
  questionId: string,
  level: SelfRatingLevel,
  ratedAt: string,
): ExamRecord {
  const items = record.items.map((item): ExamRecordItem => {
    if (item.questionId !== questionId || item.correct !== null) return item;
    const rating: ExamSelfRating = {
      ...makeSelfRating(level, item.maxScore),
      ratedAt,
    };
    return { ...item, selfRating: rating };
  });
  const changed = items.some(
    (item, index) => item !== record.items[index],
  );
  if (!changed) return record;
  return { ...record, items, ...totalsOf(items) };
}

/** 清除自评（可追溯的反向操作：档位置空，客观分纹丝不动） */
export function clearExamSelfRating(record: ExamRecord, questionId: string): ExamRecord {
  const items = record.items.map((item): ExamRecordItem =>
    item.questionId === questionId && item.correct === null
      ? { ...item, selfRating: null }
      : item,
  );
  return { ...record, items, ...totalsOf(items) };
}

/** 成绩页定位：每个空位的对错明细（D-4「明细显示哪两空错误」） */
export function itemDetailMap(
  item: ExamRecordItem,
): ReadonlyMap<string, boolean | null> {
  return new Map((item.details ?? []).map((d) => [d.key, d.correct]));
}
