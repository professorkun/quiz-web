import type { Attempt, QuestionProgress } from "@quiz/core";

/**
 * 由不可变 Attempt 序列重算进度。
 *
 * 这条函数是所有统计的唯一入口：只要 Attempt 是真的，进度随时可以推翻重算；
 * 反过来，如果允许直接改 Progress，历史一旦算错就永远错下去。
 */
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
