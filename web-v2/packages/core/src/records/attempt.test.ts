/**
 * 作答事件构造（G4-1「事件不可变」在 S3 的落地形态）。
 *
 * 这些用例守的是同一条线：**页面不能决定"这是不是第一次"**。
 * 一旦允许页面传 true，重做就能把首次正确率刷上去，S4 的整套统计失去意义。
 */

import { describe, expect, it } from "vitest";

import { buildAttempt, isFirstAttemptFor, type Attempt } from "../index.js";
import { makeMixedQuestions } from "../practice/fixtures.js";

const demoQuestions = makeMixedQuestions();
const QUESTION = demoQuestions[0]!;

const gradeOk = { correct: true, score: 5, maxScore: 5 } as const;
const gradeBad = { correct: false, score: 0, maxScore: 5 } as const;

const base = {
  question: QUESTION,
  answer: "a",
  mode: "practice",
  sessionId: "s-1",
  startedAt: "2026-11-16T01:00:00.000Z",
  submittedAt: "2026-11-16T01:00:10.000Z",
} as const;

describe("isFirstAttemptFor", () => {
  it("没有历史时算第一次", () => {
    expect(isFirstAttemptFor(QUESTION.questionId, [])).toBe(true);
  });

  it("已有过该题作答（哪怕答错）就不再是第一次", () => {
    const prior = buildAttempt({
      ...base,
      attemptId: "s-1-1",
      grade: gradeBad,
      history: [],
    });
    expect(isFirstAttemptFor(QUESTION.questionId, [prior])).toBe(false);
  });

  it("别的题的历史不算", () => {
    const other = buildAttempt({
      ...base,
      question: demoQuestions[1]!,
      attemptId: "s-1-1",
      grade: gradeBad,
      history: [],
    });
    expect(isFirstAttemptFor(QUESTION.questionId, [other])).toBe(true);
  });
});

describe("buildAttempt", () => {
  it("写入题目当时那一版 revision，而不是最新版", () => {
    const attempt = buildAttempt({ ...base, attemptId: "s-1-1", grade: gradeOk, history: [] });
    expect(attempt.questionRevision).toBe(QUESTION.revision);
    expect(attempt.bankId).toBe(QUESTION.bankId);
    expect(attempt.schemaVersion).toBeUndefined(); // Attempt 不重复携带契约版本，版本在题库包上
  });

  it("durationMs 未提供时不写 0", () => {
    const attempt = buildAttempt({ ...base, attemptId: "s-1-1", grade: gradeOk, history: [] });
    expect("durationMs" in attempt).toBe(false);
  });

  it("durationMs 取整后写入", () => {
    const attempt = buildAttempt({
      ...base,
      attemptId: "s-1-1",
      grade: gradeOk,
      history: [],
      durationMs: 1234.6,
    });
    expect(attempt.durationMs).toBe(1235);
  });

  it("负数耗时当未记录，不写 -1 这种非法值", () => {
    const attempt = buildAttempt({
      ...base,
      attemptId: "s-1-1",
      grade: gradeOk,
      history: [],
      durationMs: -5,
    });
    expect(attempt.durationMs).toBeUndefined();
  });

  it("主观题 correct 为 null 时照实记录，不伪造对错", () => {
    const attempt = buildAttempt({
      ...base,
      attemptId: "s-1-1",
      grade: { correct: null, score: 3, maxScore: 5 },
      history: [],
    });
    expect(attempt.correct).toBeNull();
    expect(attempt.score).toBe(3);
  });

  it("第二次作答生成新事件，第一次标记不会翻新", () => {
    const first = buildAttempt({ ...base, attemptId: "s-1-1", grade: gradeBad, history: [] });
    const second = buildAttempt({
      ...base,
      attemptId: "s-1-2",
      grade: gradeOk,
      history: [first],
      submittedAt: "2026-11-16T02:00:00.000Z",
    });
    expect(first.isFirstAttempt).toBe(true);
    expect(second.isFirstAttempt).toBe(false);
    expect(second.attemptId).not.toBe(first.attemptId);
    // 两条是完全独立的记录：改哪一条都不影响另一条
    const history: readonly Attempt[] = [first, second];
    expect(history).toHaveLength(2);
  });

  it("迁移来的推断事件带来源标记，真实作答不带", () => {
    const migrated = buildAttempt({
      ...base,
      attemptId: "legacy-1",
      grade: gradeOk,
      history: [],
      importedFrom: "mastery",
    });
    expect(migrated.importedFrom).toBe("mastery");
    expect(
      buildAttempt({ ...base, attemptId: "s-1-1", grade: gradeOk, history: [] }).importedFrom,
    ).toBeUndefined();
  });
});
