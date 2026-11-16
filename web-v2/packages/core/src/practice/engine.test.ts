/** T2-6：选题、会话创建、判分、导航 */

import { describe, expect, it } from "vitest";

import type { Question } from "../schema.js";
import { BANK_ID, makeMixedQuestions, makeProgress } from "./fixtures.js";
import {
  buildOptionOrders,
  createSession,
  currentQuestionId,
  goNext,
  goPrev,
  isAnswered,
  moveTo,
  selectQuestions,
  sessionResult,
  setAnswer,
  setSelfRating,
  submitCurrent,
} from "./engine.js";
import type { PracticeConfig, SessionSnapshot } from "./types.js";

const questions = makeMixedQuestions();
const NOW = "2026-11-16T20:00:00.000Z";

const config = (over: Partial<PracticeConfig> = {}): PracticeConfig => ({
  bankId: BANK_ID,
  order: "random",
  seed: 20261116,
  ...over,
});

const newSession = (over: Partial<PracticeConfig> = {}): SessionSnapshot =>
  createSession({ questions, config: config(over), sessionId: "s-1", now: NOW });

describe("选题与可复现题序", () => {
  it("同一种子两次生成的 questionIds 与 optionOrders 逐项一致", () => {
    const a = createSession({ questions, config: config(), sessionId: "s-a", now: NOW });
    const b = createSession({ questions, config: config(), sessionId: "s-b", now: "另一个时间" });
    expect(a.questionIds).toEqual(b.questionIds);
    expect(a.optionOrders).toEqual(b.optionOrders);
  });

  it("不同种子产生不同题序", () => {
    expect(newSession().questionIds).not.toEqual(newSession({ seed: 20261117 }).questionIds);
  });

  it("顺序模式按题库原序，不走随机", () => {
    const s = newSession({ order: "sequential" });
    expect(s.questionIds).toEqual(questions.map((q) => q.questionId));
  });

  it("选项洗牌只作用于选择类题型，判断题没有 optionOrders", () => {
    const s = newSession();
    for (const q of questions) {
      const has = s.optionOrders[q.questionId] !== undefined;
      expect(has, q.questionId).toBe(q.type === "single_choice" || q.type === "multiple_choice");
    }
  });

  it("每题选项序是独立子流：移除其它题不改变该题选项序", () => {
    const seed = 4242;
    const full = buildOptionOrders(questions, seed);
    const one = buildOptionOrders([questions[0]!], seed);
    expect(one[questions[0]!.questionId]).toEqual(full[questions[0]!.questionId]);
  });

  it("筛选：知识点 / 题型 / 限量可组合", () => {
    expect(selectQuestions(questions, config({ order: "sequential", topicIds: ["t1"] })).length).toBeGreaterThan(0);
    const byType = selectQuestions(
      questions,
      config({ order: "sequential", types: ["single_choice"] }),
    );
    expect(byType).toHaveLength(6);
    expect(selectQuestions(questions, config({ order: "sequential", limit: 3 }))).toHaveLength(3);
  });

  it("只刷未做 / 只刷未掌握：按注入的 progress 排除", () => {
    const done = questions[0]!.questionId;
    const mastered = questions[1]!.questionId;
    const progress = [
      makeProgress(done, { attemptsCount: 2 }),
      makeProgress(mastered, { attemptsCount: 1, mastered: true }),
    ];
    const unseen = selectQuestions(
      questions,
      config({ order: "sequential", onlyUnseen: true }),
      progress,
    );
    expect(unseen.some((q) => q.questionId === done)).toBe(false);
    const unmastered = selectQuestions(
      questions,
      config({ order: "sequential", onlyUnmastered: true }),
      progress,
    );
    expect(unmastered.some((q) => q.questionId === mastered)).toBe(false);
    expect(unmastered.some((q) => q.questionId === done)).toBe(true);
  });

  it("筛不出题时给出明确提示，不静默返回空会话", () => {
    expect(() => newSession({ topicIds: ["不存在的知识点"] })).toThrow(/没有符合当前筛选条件/);
  });
});

describe("作答、判分与导航", () => {
  it("上一题 / 下一题 / 越界钳制", () => {
    const s = newSession({ order: "sequential" });
    expect(s.cursor).toBe(0);
    expect(goNext(s, NOW).cursor).toBe(1);
    expect(goPrev(goNext(s, NOW), NOW).cursor).toBe(0);
    expect(goPrev(s, NOW).cursor).toBe(0);
    expect(moveTo(s, 999, NOW).cursor).toBe(questions.length - 1);
    expect(currentQuestionId(moveTo(s, 999, NOW))).toBe(questions.at(-1)?.questionId);
  });

  it("提交后判分写入 grades，已提交状态可被识别", () => {
    const s = newSession({ order: "sequential" });
    const q = questions[0] as Question;
    const answered = setAnswer(s, q.questionId, "o2", NOW);
    const graded = submitCurrent(answered, questions, NOW);
    expect(graded.grades[q.questionId]).toEqual({ correct: true, score: 1, maxScore: 1 });
    expect(isAnswered(graded, q.questionId)).toBe(true);
    expect(sessionResult(graded, q.questionId)).toBe("right");
  });

  it("打乱选项展示顺序后判分不变（判分只看 optionId）", () => {
    const s1 = newSession({ order: "sequential" });
    const s2 = { ...s1, optionOrders: { ...s1.optionOrders, [questions[0]!.questionId]: ["o3", "o1", "o2"] } };
    const qid = questions[0]!.questionId;
    const g1 = submitCurrent(setAnswer(s1, qid, "o2", NOW), questions, NOW);
    const g2 = submitCurrent(setAnswer(s2, qid, "o2", NOW), questions, NOW);
    expect(g1.grades[qid]).toEqual(g2.grades[qid]);
  });

  it("简答提交后 correct=null，自评单独存且绝不覆盖作答原文与判分", () => {
    const s0 = newSession({ order: "sequential" });
    const short = questions.find((q) => q.type === "short_answer")!;
    const at = s0.questionIds.indexOf(short.questionId);
    let s = moveTo(s0, at, NOW);
    s = setAnswer(s, short.questionId, "我的作答原文", NOW);
    s = submitCurrent(s, questions, NOW);
    expect(s.grades[short.questionId]?.correct).toBeNull();
    expect(s.grades[short.questionId]?.maxScore).toBe(5); // rubric 2 + 3

    const rated = setSelfRating(s, short.questionId, "half", NOW);
    expect(rated.selfRatings[short.questionId]).toEqual({ level: "half", score: 2.5, maxScore: 5 });
    expect(rated.answers[short.questionId]).toBe("我的作答原文");
    expect(rated.grades[short.questionId]).toEqual(s.grades[short.questionId]);
    expect(sessionResult(rated, short.questionId)).toBe("self");
  });

  it("已提交的题不能改写答案，避免展示与存储不一致", () => {
    const s = newSession({ order: "sequential" });
    const qid = questions[0]!.questionId;
    const graded = submitCurrent(setAnswer(s, qid, "o2", NOW), questions, NOW);
    const changed = setAnswer(graded, qid, "o1", NOW);
    expect(changed.answers[qid]).toBe("o2");
    expect(changed.grades[qid]?.correct).toBe(true);
  });
});
