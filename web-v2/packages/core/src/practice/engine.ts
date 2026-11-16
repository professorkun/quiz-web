/**
 * 练习引擎（T2-6）：选题、会话创建、作答、判分、导航。
 *
 * 全部是纯函数：`core` 不读时间、不读随机源、不碰 DOM/存储。
 * 时间与种子都由调用方注入，所以 Node 下固定种子可完整复现题序。
 */

import type { Question, QuestionProgress } from "../schema.js";
import "../questions/index.js";
import { getQuestionType, gradeAnswer } from "../questions/registry.js";
import {
  makeSelfRating,
  rubricMaxScore,
  type SelfRatingLevel,
  type ShortAnswerQuestion,
} from "../questions/short_answer/selfRating.js";
import { deriveSeed, rngFrom, shuffleWith } from "./random.js";
import {
  SESSION_VERSION,
  type AnswerValue,
  type CreateSessionInput,
  type PracticeConfig,
  type SessionSnapshot,
} from "./types.js";

/** 选题：筛选 → 未做/未掌握 → 排序（顺序 / 种子随机）→ 限量 */
export function selectQuestions(
  questions: readonly Question[],
  config: PracticeConfig,
  progress: readonly QuestionProgress[] = [],
): readonly Question[] {
  const byId = new Map(progress.map((p) => [p.questionId, p]));
  const topics = config.topicIds === undefined ? undefined : new Set(config.topicIds);
  const types = config.types === undefined ? undefined : new Set(config.types);

  let list = questions.filter((q) => {
    if (q.bankId !== config.bankId) return false;
    if (topics !== undefined && !q.topicIds.some((t) => topics.has(t))) return false;
    if (types !== undefined && !types.has(q.type)) return false;
    const p = byId.get(q.questionId);
    if (config.onlyUnseen === true && p !== undefined && p.attemptsCount > 0) return false;
    if (config.onlyUnmastered === true && p?.mastered === true) return false;
    return true;
  });

  if (config.order === "random") {
    const rng = rngFrom(deriveSeed(config.seed, `qorder:${config.bankId}:${config.order}`));
    list = shuffleWith(list, rng);
  }
  if (config.limit !== undefined) {
    list = list.slice(0, Math.max(0, config.limit));
  }
  return list;
}

/** 每题选项序由 `seed + questionId` 单独派生，与题序、其它题无关 */
export function buildOptionOrders(
  questions: readonly Question[],
  seed: number,
): Readonly<Record<string, readonly string[]>> {
  const orders: Record<string, readonly string[]> = {};
  for (const q of questions) {
    const def = getQuestionType(q.type);
    if (!def.shuffleOptions) continue;
    const options = "options" in q ? q.options : undefined;
    if (options === undefined) continue;
    const rng = rngFrom(deriveSeed(seed, `opts:${q.questionId}`));
    orders[q.questionId] = shuffleWith(
      options.map((o) => o.optionId),
      rng,
    );
  }
  return orders;
}

export function createSession(input: CreateSessionInput): SessionSnapshot {
  const picked = selectQuestions(input.questions, input.config, input.progress);
  if (picked.length === 0) {
    throw new Error(
      `题库 ${input.config.bankId} 中没有符合当前筛选条件的题目，请放宽范围`,
    );
  }
  const revisions: Record<string, string> = {};
  for (const q of picked) revisions[q.questionId] = q.revision;

  return {
    version: SESSION_VERSION,
    sessionId: input.sessionId,
    bankId: input.config.bankId,
    config: input.config,
    questionIds: picked.map((q) => q.questionId),
    optionOrders: buildOptionOrders(picked, input.config.seed),
    questionRevisions: revisions,
    answers: {},
    selfRatings: {},
    grades: {},
    cursor: 0,
    startedAt: input.now,
    updatedAt: input.now,
  };
}

export function currentQuestionId(session: SessionSnapshot): string | undefined {
  return session.questionIds[session.cursor];
}

export function isAnswered(session: SessionSnapshot, questionId: string): boolean {
  return session.grades[questionId] !== undefined;
}

export type SessionResult = "right" | "wrong" | "unseen" | "self";

export function sessionResult(session: SessionSnapshot, questionId: string): SessionResult {
  const grade = session.grades[questionId];
  if (grade === undefined) return "unseen";
  if (grade.correct === null || session.selfRatings[questionId] !== undefined) return "self";
  return grade.correct ? "right" : "wrong";
}

/** 已提交的题不允许改写答案，避免"显示对错却存了另一份作答" */
export function setAnswer(
  session: SessionSnapshot,
  questionId: string,
  answer: AnswerValue,
  now: string,
): SessionSnapshot {
  if (!session.questionIds.includes(questionId)) return session;
  if (isAnswered(session, questionId)) return session;
  return {
    ...session,
    answers: { ...session.answers, [questionId]: answer },
    updatedAt: now,
  };
}

/** 自评只写 selfRatings，绝不动 answers / grades（T2-5 不变式） */
export function setSelfRating(
  session: SessionSnapshot,
  questionId: string,
  level: SelfRatingLevel,
  now: string,
): SessionSnapshot {
  if (!session.questionIds.includes(questionId)) return session;
  const maxScore = session.grades[questionId]?.maxScore ?? 1;
  return {
    ...session,
    selfRatings: { ...session.selfRatings, [questionId]: makeSelfRating(level, maxScore) },
    updatedAt: now,
  };
}

function maxScoreOf(question: Question, fallback: number): number {
  const def = getQuestionType(question.type);
  return def.selfAssess ? rubricMaxScore(question as ShortAnswerQuestion) : fallback;
}

/** 判分只发生在 core；页面拿到的是结果，不参与规则 */
export function submitCurrent(
  session: SessionSnapshot,
  questions: readonly Question[],
  now: string,
  fallbackMaxScore = 1,
): SessionSnapshot {
  const questionId = currentQuestionId(session);
  if (questionId === undefined) return session;
  const question = questions.find((q) => q.questionId === questionId);
  if (question === undefined) {
    throw new Error(`题目 ${questionId} 在当前题库中不存在，无法判分；请恢复会话检查修订冲突`);
  }
  if (isAnswered(session, questionId)) return session;
  const grade = gradeAnswer(
    question,
    session.answers[questionId],
    maxScoreOf(question, fallbackMaxScore),
  );
  return {
    ...session,
    grades: { ...session.grades, [questionId]: grade },
    updatedAt: now,
  };
}

export function moveTo(session: SessionSnapshot, cursor: number, now: string): SessionSnapshot {
  const max = Math.max(0, session.questionIds.length - 1);
  const next = Math.max(0, Math.min(max, Math.trunc(cursor)));
  return next === session.cursor ? session : { ...session, cursor: next, updatedAt: now };
}

export function goNext(session: SessionSnapshot, now: string): SessionSnapshot {
  return moveTo(session, session.cursor + 1, now);
}

export function goPrev(session: SessionSnapshot, now: string): SessionSnapshot {
  return moveTo(session, session.cursor - 1, now);
}
