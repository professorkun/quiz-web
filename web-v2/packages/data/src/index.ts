/**
 * 迁移与派算层（T1-4 / T1-6 落在这里）。
 *
 * 现在只导出占位，等 T1-4 实现：
 * - `migrateLegacyBank(dataJson)`：旧 `_build/data.json` → 新题库包
 * - `migrateLegacyRecords(mastery, wrongs, exams)`：旧学习记录 → Attempt/Progress dry-run
 */

import type { Attempt, QuestionProgress } from "@quiz/core";

/** 由不可变 Attempt 序列重算进度（派生数据必须可重算，否则历史一旦算错就永远错下去） */
export function computeProgress(
  bankId: string,
  questionId: string,
  attempts: readonly Attempt[],
): QuestionProgress {
  let wrongCount = 0;
  let firstCorrectAt: string | null = null;
  let lastAttemptAt: string | null = null;

  for (const a of attempts) {
    if (a.correct === false) wrongCount += 1;
    if (a.correct === true && firstCorrectAt === null) firstCorrectAt = a.submittedAt;
    if (lastAttemptAt === null || a.submittedAt > lastAttemptAt) lastAttemptAt = a.submittedAt;
  }

  return {
    bankId,
    questionId,
    attemptsCount: attempts.length,
    wrongCount,
    firstCorrectAt,
    lastAttemptAt,
    mastered: firstCorrectAt !== null,
  };
}
