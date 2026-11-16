/**
 * 第二学科题库自身的合法性（T3-10 的机器证据）。
 *
 * 为什么值得单独测：这份题库是"通用性"的证物。它一旦不合法，
 * S3 验收 D 就变成"用一个人工修过的包证明了通用"——证明力为零。
 */

import { describe, expect, it } from "vitest";

import { gradeAnswer, validateBankPackage } from "@quiz/core";

import { chemistryBank } from "./chemistry.js";

describe("化学题库", () => {
  it("通过题库包校验，且题数与 manifest 一致", () => {
    const result = validateBankPackage({
      manifest: chemistryBank.manifest,
      questions: chemistryBank.questions,
    });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(chemistryBank.manifest.questionCount).toBe(chemistryBank.questions.length);
  });

  it("至少覆盖 3 种题型", () => {
    const types = new Set(chemistryBank.questions.map((q) => q.type));
    expect(types.size).toBeGreaterThanOrEqual(3);
  });

  it("题量与 S3 约定的上限（20 题）之内", () => {
    expect(chemistryBank.questions.length).toBeLessThanOrEqual(20);
    expect(chemistryBank.questions.length).toBeGreaterThanOrEqual(10);
  });

  it("每道题的知识点都在 manifest 里，知识讲义也指向同一批知识点", () => {
    const topics = new Set(chemistryBank.manifest.topics.map((t) => t.topicId));
    for (const q of chemistryBank.questions) {
      for (const topicId of q.topicIds) expect(topics.has(topicId)).toBe(true);
    }
    for (const module of chemistryBank.knowledge) expect(topics.has(module.topicId)).toBe(true);
  });

  it("bankId 与 JavaWeb 不冲突", () => {
    expect(chemistryBank.manifest.bankId).toBe("chem");
    expect(chemistryBank.questions.every((q) => q.bankId === "chem")).toBe(true);
  });
});

/**
 * 判分可用性（S3 验收 D-2）：换学科后判分器不改一行，也必须判得对。
 *
 * 这里刻意不 mock 判分：走的就是 `core` 的注册表与 `gradeAnswer`，
 * 与 JavaWeb 题库用的是同一条路径。
 */
describe("化学题库可正常判分", () => {
  function correctAnswer(question: (typeof chemistryBank.questions)[number]): unknown {
    switch (question.type) {
      case "single_choice":
        return question.answer;
      case "multiple_choice":
        return question.answer;
      case "true_false":
        return question.answer;
      case "fill_blank":
        return Object.fromEntries(question.blanks.map((b) => [b.blankId, b.accepted[0]]));
      case "code_blank":
        return Object.fromEntries(question.blanks.map((b) => [b.blankId, b.accepted[0]]));
      case "short_answer":
        return "";
    }
  }

  function wrongAnswer(question: (typeof chemistryBank.questions)[number]): unknown {
    switch (question.type) {
      case "single_choice": {
        const other = question.options.find((o) => o.optionId !== question.answer);
        return other?.optionId ?? question.answer;
      }
      case "multiple_choice": {
        const other = question.options.find((o) => !question.answer.includes(o.optionId));
        return [other?.optionId ?? question.options[0]!.optionId];
      }
      case "true_false":
        return !question.answer;
      case "fill_blank":
        return Object.fromEntries(question.blanks.map((b) => [b.blankId, "肯定不对的答案"]));
      case "code_blank":
        return Object.fromEntries(question.blanks.map((b) => [b.blankId, "肯定不对的答案"]));
      case "short_answer":
        return "";
    }
  }

  it("每道题的正确写法都判对", () => {
    for (const question of chemistryBank.questions) {
      const result = gradeAnswer(question, correctAnswer(question), 5);
      expect(result.correct, `${question.questionId} 应判对`).toBe(true);
    }
  });

  it("每道题的错答都判错", () => {
    for (const question of chemistryBank.questions) {
      const result = gradeAnswer(question, wrongAnswer(question), 5);
      expect(result.correct, `${question.questionId} 应判错`).toBe(false);
    }
  });
});
