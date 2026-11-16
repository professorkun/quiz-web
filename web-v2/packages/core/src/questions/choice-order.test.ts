/**
 * T2-2 判据：判分只看 optionId 集合，与展示顺序无关。
 *
 * 题库包里没有 multiple_choice 真题（S1 分布 62/45/27/8/5 与旧版一致），
 * 所以这里用构造题固定住这条不变式，另由演示夹具提供 6/6 手测入口。
 */

import { describe, expect, it } from "vitest";

import { computeRevision } from "../revision.js";
import { SCHEMA_VERSION, type Question } from "../schema.js";
import { gradeAnswer } from "./registry.js";
import "./index.js";

const q = (over: Record<string, unknown>): Question =>
  ({
    schemaVersion: SCHEMA_VERSION,
    bankId: "javaweb",
    topicIds: ["t"],
    revision: computeRevision(over),
    ...over,
  }) as Question;

const multiple = (options: readonly { optionId: string; text: string }[]): Question =>
  q({
    type: "multiple_choice",
    questionId: "javaweb:multiple_choice:001",
    stem: "选出正确的两项",
    options,
    answer: ["opt_b", "opt_d"],
  });

const ORIGINAL = [
  { optionId: "opt_a", text: "甲" },
  { optionId: "opt_b", text: "乙" },
  { optionId: "opt_c", text: "丙" },
  { optionId: "opt_d", text: "丁" },
];

describe("选择题判分与展示顺序解耦", () => {
  it("多选：正确项为 opt_b/opt_d，以 opt_d+opt_b 作答仍判正确", () => {
    const result = gradeAnswer(multiple(ORIGINAL), ["opt_d", "opt_b"], 2);
    expect(result).toEqual({ correct: true, score: 2, maxScore: 2 });
  });

  it("多选：把 options 展示顺序整个倒过来，判分结果逐项不变", () => {
    const reversed = [...ORIGINAL].reverse();
    for (const answer of [["opt_b", "opt_d"], ["opt_d", "opt_b"], ["opt_a", "opt_c"], []]) {
      expect(gradeAnswer(multiple(ORIGINAL), answer, 3)).toEqual(
        gradeAnswer(multiple(reversed), answer, 3),
      );
    }
  });

  it("多选：只认集合，重复选择同一项不算多答，少选判错", () => {
    expect(gradeAnswer(multiple(ORIGINAL), ["opt_b", "opt_d", "opt_b"]).correct).toBe(true);
    expect(gradeAnswer(multiple(ORIGINAL), ["opt_b"]).correct).toBe(false);
    expect(gradeAnswer(multiple(ORIGINAL), ["opt_b", "opt_d", "opt_a"]).correct).toBe(false);
  });

  it("单选：交换展示顺序、重复作答，结果稳定", () => {
    const single = (options: typeof ORIGINAL) =>
      q({
        type: "single_choice",
        questionId: "javaweb:single_choice:001",
        stem: "x",
        options,
        answer: "opt_b",
      });
    const first = gradeAnswer(single(ORIGINAL), "opt_b", 5);
    const again = gradeAnswer(single([...ORIGINAL].reverse()), "opt_b", 5);
    expect(first).toEqual({ correct: true, score: 5, maxScore: 5 });
    expect(again).toEqual(first);
    expect(gradeAnswer(single(ORIGINAL), "opt_a").correct).toBe(false);
  });

  it("判断：同一题目重复作答结果稳定，答案存布尔而非 √/×", () => {
    const tf = q({
      type: "true_false",
      questionId: "javaweb:true_false:001",
      stem: "x",
      answer: false,
    });
    expect(gradeAnswer(tf, false).correct).toBe(true);
    expect(gradeAnswer(tf, false).correct).toBe(true);
    expect(gradeAnswer(tf, "×").correct).toBe(false);
    expect(gradeAnswer(tf, true).correct).toBe(false);
  });
});
