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

/**
 * 由全量事件重算进度（S3 的导入后重算、S4 的 T4-8 对账共用）。
 *
 * 排序是必须的：`lastAttemptAt` 依赖时间序，乱序输入会让"最后一次作答"
 * 取到中间某一条，统计就开始飘。
 */
export function recomputeProgress(attempts: readonly Attempt[]): readonly QuestionProgress[] {
  const groups = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    const key = `${attempt.bankId}\u0000${attempt.questionId}`;
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [attempt]);
    else list.push(attempt);
  }

  const out: QuestionProgress[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) =>
      a.submittedAt === b.submittedAt
        ? a.attemptId.localeCompare(b.attemptId)
        : a.submittedAt.localeCompare(b.submittedAt),
    );
    const first = list[0]!;
    out.push(computeProgress(first.bankId, first.questionId, list));
  }
  return out;
}
