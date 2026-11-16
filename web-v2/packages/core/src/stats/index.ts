/**
 * 统计（S4 · T4-7）。
 *
 * 唯一原则：**统计是 Attempt 的投影，不是计数器**。
 * 这里没有任何 `counter++`、没有缓存，输入只有事件、进度、题目和时间。
 * 清空所有派生数据再调用本函数，结果必须一模一样（S4 G4-4）。
 *
 * 时间由调用方注入（ADR-0002）；这里不读系统时钟。
 */

import { isDueAt } from "../review/index.js";
import type { Attempt, AttemptMode, Question, QuestionProgress, Topic } from "../schema.js";

export interface Rate {
  readonly correct: number;
  readonly total: number;
  /** 无样本时为 0，不用 NaN 或 null——界面不需要到处判空 */
  readonly value: number;
}

const rate = (correct: number, total: number): Rate => ({
  correct,
  total,
  value: total === 0 ? 0 : correct / total,
});

export interface StatsInput {
  readonly questions: readonly Question[];
  readonly attempts: readonly Attempt[];
  readonly progress: readonly QuestionProgress[];
  /** 到期判定的"现在"，必须注入 */
  readonly now: string;
  /** 只统计某一类作答；不传则统计全部 */
  readonly mode?: AttemptMode | "all";
  /** 知识点全集；不传则从题目里推导 */
  readonly topics?: readonly Topic[];
}

export interface Stats {
  readonly totalQuestions: number;
  readonly attemptedQuestions: number;
  /** 只认 `isFirstAttempt`，重做不抬高（G4-5） */
  readonly firstAccuracy: Rate;
  /** 非首次作答的正确率，与首次正确率分开（G4-5） */
  readonly repeatAccuracy: Rate;
  /** 答过的题覆盖了多少知识点 */
  readonly topicCoverage: Rate;
  /** 已掌握题数 / 题库总题数 */
  readonly mastery: Rate;
  /** `nextReviewAt <= now` 且未掌握的题数 */
  readonly dueCount: number;
  /** 毫秒；没记录耗时的事件不贡献时长，不拿 0 冒充 */
  readonly studyTimeMs: number;
  readonly byMode: Readonly<Record<AttemptMode, { readonly attempts: number; readonly accuracy: Rate }>>;
}

function inMode(attempt: Attempt, mode: StatsInput["mode"]): boolean {
  return mode === undefined || mode === "all" || attempt.mode === mode;
}

export function computeStats(input: StatsInput): Stats {
  const { questions, attempts, progress, now } = input;
  const scoped = attempts.filter((a) => inMode(a, input.mode));

  const first = scoped.filter((a) => a.isFirstAttempt && a.correct !== null);
  const repeat = scoped.filter((a) => !a.isFirstAttempt && a.correct !== null);

  const allTopics = input.topics?.map((t) => t.topicId) ?? [
    ...new Set(questions.flatMap((q) => q.topicIds)),
  ];
  const questionById = new Map(questions.map((q) => [q.questionId, q]));
  const coveredTopics = new Set<string>();
  for (const attempt of scoped) {
    const question = questionById.get(attempt.questionId);
    if (question === undefined) continue;
    for (const topicId of question.topicIds) coveredTopics.add(topicId);
  }

  const mastery = progress.filter((p) => p.status === "mastered" || p.mastered).length;
  // 掌握度是状态投影，不随 mode 过滤（进度本身没有 mode 维度）
  const dueCount = progress.filter((p) => isDueAt(p.status, p.nextReviewAt, now)).length;

  const byMode = (["practice", "review", "exam"] as const).reduce<
    Record<AttemptMode, { attempts: number; accuracy: Rate }>
  >(
    (acc, mode) => {
      const rows = attempts.filter((a) => a.mode === mode && a.correct !== null);
      acc[mode] = {
        attempts: attempts.filter((a) => a.mode === mode).length,
        accuracy: rate(rows.filter((a) => a.correct === true).length, rows.length),
      };
      return acc;
    },
    { practice: { attempts: 0, accuracy: rate(0, 0) }, review: { attempts: 0, accuracy: rate(0, 0) }, exam: { attempts: 0, accuracy: rate(0, 0) } },
  );

  return {
    totalQuestions: questions.length,
    attemptedQuestions: new Set(scoped.map((a) => a.questionId)).size,
    firstAccuracy: rate(first.filter((a) => a.correct === true).length, first.length),
    repeatAccuracy: rate(repeat.filter((a) => a.correct === true).length, repeat.length),
    topicCoverage: rate(
      allTopics.filter((id) => coveredTopics.has(id)).length,
      allTopics.length,
    ),
    mastery: rate(mastery, questions.length),
    dueCount,
    studyTimeMs: scoped.reduce((sum, a) => sum + (a.durationMs ?? 0), 0),
    byMode,
  };
}
