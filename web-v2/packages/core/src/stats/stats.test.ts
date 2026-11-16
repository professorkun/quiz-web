/**
 * 统计口径（S4 G4-5 / §6-D）。
 *
 * 重点不在"公司司会算百分比"，而在两条禁令：
 * - 重做不能抬高首次正确率；
 * - 同一份事件算两次必须一模一样（没有隐藏的计数器）。
 */

import { describe, expect, it } from "vitest";

import { computeStats, type StatsInput } from "./index.js";
import type { Attempt, Question, QuestionProgress, Topic } from "../schema.js";

const questions: readonly Question[] = [
  {
    schemaVersion: 1,
    questionId: "javaweb:single_choice:001",
    bankId: "javaweb",
    revision: "000000000001",
    topicIds: ["javaweb:topic:a"],
    stem: "A",
    legacyKeys: [],
    type: "single_choice",
    options: [
      { optionId: "a", text: "a" },
      { optionId: "b", text: "b" },
    ],
    answer: "a",
  },
  {
    schemaVersion: 1,
    questionId: "javaweb:single_choice:002",
    bankId: "javaweb",
    revision: "000000000002",
    topicIds: ["javaweb:topic:b"],
    stem: "B",
    legacyKeys: [],
    type: "single_choice",
    options: [
      { optionId: "a", text: "a" },
      { optionId: "b", text: "b" },
    ],
    answer: "b",
  },
];

const topics: readonly Topic[] = [
  { topicId: "javaweb:topic:a", bankId: "javaweb", name: "甲", order: 0 },
  { topicId: "javaweb:topic:b", bankId: "javaweb", name: "乙", order: 1 },
  { topicId: "javaweb:topic:c", bankId: "javaweb", name: "丙", order: 2 },
];

function attempt(over: Partial<Attempt> & { readonly attemptId: string }): Attempt {
  return {
    bankId: "javaweb",
    questionId: "javaweb:single_choice:001",
    questionRevision: "000000000001",
    mode: "practice",
    isFirstAttempt: true,
    startedAt: "2026-11-16T09:00:00.000Z",
    submittedAt: "2026-11-16T09:00:10.000Z",
    answer: "a",
    correct: true,
    score: 5,
    maxScore: 5,
    ...over,
  };
}

function progress(over: Partial<QuestionProgress>): QuestionProgress {
  return {
    bankId: "javaweb",
    questionId: "javaweb:single_choice:001",
    attemptsCount: 0,
    wrongCount: 0,
    firstCorrectAt: null,
    lastAttemptAt: null,
    mastered: false,
    status: "new",
    streak: 0,
    nextReviewAt: null,
    errorCause: null,
    ...over,
  };
}

const NOW = "2026-11-16T12:00:00.000Z";

describe("首次正确率", () => {
  it("重做答对 3 次也不会抬高首次正确率", () => {
    const attempts = [
      attempt({ attemptId: "a-1", correct: false, durationMs: 10000 }),
      attempt({
        attemptId: "a-2",
        isFirstAttempt: false,
        correct: true,
        submittedAt: "2026-11-17T09:00:00.000Z",
        durationMs: 5000,
      }),
      attempt({
        attemptId: "a-3",
        isFirstAttempt: false,
        correct: true,
        submittedAt: "2026-11-20T09:00:00.000Z",
      }),
      attempt({
        attemptId: "a-4",
        isFirstAttempt: false,
        correct: true,
        submittedAt: "2026-11-27T09:00:00.000Z",
      }),
    ];
    const stats = computeStats({ questions, attempts, progress: [], now: NOW });

    expect(stats.firstAccuracy).toEqual({ correct: 0, total: 1, value: 0 });
    expect(stats.repeatAccuracy).toEqual({ correct: 3, total: 3, value: 1 });
    // 时长来自真实事件，缺 durationMs 的那条不加也不伪造 0
    expect(stats.studyTimeMs).toBe(15000);
  });

  it("主观题未自评（correct=null）不进分母", () => {
    const stats = computeStats({
      questions,
      attempts: [
        attempt({ attemptId: "a-1" }),
        attempt({ attemptId: "a-2", correct: null }),
      ],
      progress: [],
      now: NOW,
    });
    expect(stats.firstAccuracy.total).toBe(1);
  });

  it("无样本时返回 0 而不是 NaN", () => {
    const stats = computeStats({ questions, attempts: [], progress: [], now: NOW });
    expect(stats.firstAccuracy.value).toBe(0);
    expect(stats.repeatAccuracy.value).toBe(0);
    expect(Number.isNaN(stats.mastery.value)).toBe(false);
  });
});

describe("统计口径", () => {
  it("知识点覆盖率按知识点算，不按题目数算", () => {
    const stats = computeStats({
      questions,
      topics,
      attempts: [attempt({ attemptId: "a-1" })],
      progress: [],
      now: NOW,
    });
    expect(stats.topicCoverage).toEqual({ correct: 1, total: 3, value: 1 / 3 });
  });

  it("掌握度 = 已掌握题数 / 全库题数", () => {
    const stats = computeStats({
      questions,
      attempts: [],
      progress: [
        progress({ questionId: "javaweb:single_choice:001", status: "mastered", mastered: true }),
      ],
      now: NOW,
    });
    expect(stats.mastery).toEqual({ correct: 1, total: 2, value: 0.5 });
  });

  it("待复习量只算 to 期且未掌握", () => {
    const stats = computeStats({
      questions,
      attempts: [],
      progress: [
        progress({
          questionId: "javaweb:single_choice:001",
          status: "learning",
          nextReviewAt: "2026-11-16T08:00:00.000Z",
        }),
        progress({
          questionId: "javaweb:single_choice:002",
          status: "reviewing",
          nextReviewAt: "2026-11-17T08:00:00.000Z",
        }),
        progress({
          questionId: "javaweb:single_choice:002",
          status: "mastered",
          nextReviewAt: null,
          mastered: true,
        }),
      ],
      now: NOW,
    });
    expect(stats.dueCount).toBe(1);
  });
});

describe("mode 隔离与可重算", () => {
  const attempts = [
    attempt({ attemptId: "p-1", mode: "practice", correct: true }),
    attempt({ attemptId: "r-1", mode: "review", correct: false, isFirstAttempt: false }),
    attempt({ attemptId: "e-1", mode: "exam", correct: true, isFirstAttempt: false }),
  ];

  it("练习 / 复习 / 模考三类分别统计", () => {
    const stats = computeStats({ questions, attempts, progress: [], now: NOW });
    expect(stats.byMode.practice.attempts).toBe(1);
    expect(stats.byMode.review.attempts).toBe(1);
    expect(stats.byMode.exam.attempts).toBe(1);
    expect(stats.byMode.review.accuracy.value).toBe(0);
  });

  it("mode 过滤只影响基于事件的指标", () => {
    const all = computeStats({ questions, attempts, progress: [], now: NOW });
    const onlyReview = computeStats({ questions, attempts, progress: [], now: NOW, mode: "review" });
    expect(all.firstAccuracy.total).toBe(1);
    expect(onlyReview.firstAccuracy.total).toBe(0);
    expect(onlyReview.repeatAccuracy.total).toBe(1);
  });

  it("同一输入算两次结果完全一致，且不改输入", () => {
    const input: StatsInput = { questions, attempts, progress: [], now: NOW };
    const snapshot = JSON.stringify(input);
    const first = computeStats(input);
    const second = computeStats(input);
    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
