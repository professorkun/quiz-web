/** T2-5：自评档位映射、参考答案满分、自评与判分互不覆盖 */

import { describe, expect, it } from "vitest";

import { computeRevision } from "../../revision.js";
import { SCHEMA_VERSION, type Question } from "../../schema.js";
import { gradeAnswer } from "../registry.js";
import "../index.js";
import {
  SELF_RATING_LEVELS,
  isSelfRatingLevel,
  makeSelfRating,
  rubricMaxScore,
  selfRatingFraction,
} from "./selfRating.js";

const question = {
  schemaVersion: SCHEMA_VERSION,
  bankId: "javaweb",
  topicIds: ["t"],
  revision: computeRevision({ type: "short_answer" }),
  questionId: "javaweb:short_answer:001",
  type: "short_answer",
  stem: "简述 JSP 动作标签",
  rubric: [
    { pointId: "p1", text: "include", score: 0.71 },
    { pointId: "p2", text: "forward", score: 0.71 },
    { pointId: "p3", text: "plugin", score: 3.58 },
  ],
} as unknown as Question;

describe("简答自评", () => {
  it("三档比例对齐旧版 1 / 0.5 / 0", () => {
    expect(SELF_RATING_LEVELS).toEqual(["full", "half", "none"]);
    expect(selfRatingFraction("full")).toBe(1);
    expect(selfRatingFraction("half")).toBe(0.5);
    expect(selfRatingFraction("none")).toBe(0);
  });

  it("自评映射为 { level, score, maxScore }，不含作答原文", () => {
    expect(makeSelfRating("full", 5)).toEqual({ level: "full", score: 5, maxScore: 5 });
    expect(makeSelfRating("half", 5)).toEqual({ level: "half", score: 2.5, maxScore: 5 });
    expect(makeSelfRating("none", 5)).toEqual({ level: "none", score: 0, maxScore: 5 });
    expect(Object.keys(makeSelfRating("half", 5))).not.toContain("answer");
  });

  it("自评满分来自 rubric 采分点合计，不从代码写死", () => {
    expect(rubricMaxScore(question as never)).toBeCloseTo(5, 10);
  });

  it("自评不改变判分：简答仍为 correct=null，不参与对错统计", () => {
    const before = gradeAnswer(question, "我的作答原文", 5);
    makeSelfRating("full", 5);
    const after = gradeAnswer(question, "我的作答原文", 5);
    expect(before).toEqual({ correct: null, score: 0, maxScore: 5 });
    expect(after).toEqual(before);
  });

  it("非法档位被拒绝，不会静默变成 0 分", () => {
    expect(isSelfRatingLevel("full")).toBe(true);
    expect(isSelfRatingLevel("half")).toBe(true);
    expect(isSelfRatingLevel("none")).toBe(true);
    expect(isSelfRatingLevel("1")).toBe(false);
    expect(isSelfRatingLevel(undefined)).toBe(false);
  });
});
