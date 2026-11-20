/**
 * 扩展点回归测试（T2-1 完成判据：新增一种题型不改任何页面文件）。
 *
 * 这里用一个**契约里不存在**的假题型 `demo_rating` 真实走一遍注册 → 分派，
 * 而不是只断言"六个内置题型都在"。后者用 if/else 也能做到，证明不了扩展点。
 * 页面侧的零改动由 `scripts/check-extension-point.mjs` 静态扫描给出证据。
 */

import { afterEach, describe, expect, it } from "vitest";

import { computeRevision } from "../revision.js";
import { SCHEMA_VERSION, type Question } from "../schema.js";
import { defineQuestionType, type AnyQuestionTypeDefinition } from "./types.js";
import {
  getQuestionType,
  gradeAnswer,
  hasQuestionType,
  listQuestionTypes,
  registerQuestionType,
  unregisterQuestionType,
  validateQuestionShape,
} from "./registry.js";
import { trueFalseDefinition } from "./index.js";

const CUSTOM_TYPE = "demo_rating";

afterEach(() => {
  unregisterQuestionType(CUSTOM_TYPE);
});

const q = (over: Record<string, unknown>): Question =>
  ({
    schemaVersion: SCHEMA_VERSION,
    bankId: "javaweb",
    topicIds: ["t"],
    revision: computeRevision(over),
    ...over,
  }) as Question;

describe("题型注册表", () => {
  it("七个内置题型全部注册，且与 Schema 的判别联合一一对应", () => {
    const types = listQuestionTypes().map((d) => d.type).sort();
    expect(types).toEqual([
      "cloze",
      "code_blank",
      "fill_blank",
      "multiple_choice",
      "short_answer",
      "single_choice",
      "true_false",
    ]);
  });

  it("公共判分入口按 type 分派，六类题型结果正确", () => {
    const single = q({
      type: "single_choice",
      questionId: "javaweb:single_choice:001",
      stem: "x",
      options: [
        { optionId: "o1", text: "A" },
        { optionId: "o2", text: "B" },
      ],
      answer: "o1",
    });
    expect(gradeAnswer(single, "o1", 2)).toEqual({ correct: true, score: 2, maxScore: 2 });

    const multiple = q({
      type: "multiple_choice",
      questionId: "javaweb:multiple_choice:001",
      stem: "x",
      options: [
        { optionId: "o1", text: "A" },
        { optionId: "o2", text: "B" },
      ],
      answer: ["o1", "o2"],
    });
    expect(gradeAnswer(multiple, ["o2", "o1"]).correct).toBe(true);

    const tf = q({
      type: "true_false",
      questionId: "javaweb:true_false:001",
      stem: "x",
      answer: false,
    });
    expect(gradeAnswer(tf, false).correct).toBe(true);

    const blank = q({
      type: "fill_blank",
      questionId: "javaweb:fill_blank:001",
      stem: "{{b1}}",
      blanks: [{ blankId: "b1", accepted: ["Servlet"] }],
    });
    expect(gradeAnswer(blank, { b1: " servlet " }).correct).toBe(true);

    const code = q({
      type: "code_blank",
      questionId: "javaweb:code_blank:001",
      stem: "x",
      files: [{ fileId: "f1", label: "c", language: "java", code: "___(b1)___" }],
      blanks: [{ blankId: "b1", fileId: "f1", accepted: ["int"] }],
    });
    expect(gradeAnswer(code, { b1: "int" }).correct).toBe(true);

    const short = q({
      type: "short_answer",
      questionId: "javaweb:short_answer:001",
      stem: "x",
      rubric: [{ pointId: "p1", text: "要点", score: 5 }],
    });
    expect(gradeAnswer(short, "写了点东西").correct).toBeNull();

    const cloze = q({
      type: "cloze",
      questionId: "javaweb:cloze:001",
      passageId: "javaweb:passage:001",
      stem: "Tom is {{b1}} and Jerry is {{b2}}.",
      sharedOptions: [
        { optionId: "o1", text: "happy" },
        { optionId: "o2", text: "sad" },
      ],
      blanks: [
        { blankId: "b1", optionId: "o1" },
        { blankId: "b2", optionId: "o2" },
      ],
      reuseOptions: false,
    });
    expect(gradeAnswer(cloze, { b1: "o1", b2: "o2" }, 2)).toMatchObject({
      correct: true,
      score: 2,
    });
  });

  it("扩展点：注册一个契约外的假题型后，公共判分入口直接分派成功", () => {
    const custom = defineQuestionType({
      type: CUSTOM_TYPE,
      label: "演示：评分题",
      schema: getQuestionType("short_answer").schema,
      answerKind: "custom",
      grade: (_question, answer, maxScore) => ({
        correct: answer === "ok",
        score: answer === "ok" ? maxScore : 0,
        maxScore,
      }),
    });
    registerQuestionType(custom);

    expect(hasQuestionType(CUSTOM_TYPE)).toBe(true);
    expect(getQuestionType(CUSTOM_TYPE)).toBe(custom);
    // 关键：假题型的题目对象照样走同一个 gradeAnswer，无需改任何公共代码
    const fake = { ...q({ type: "short_answer" }), type: CUSTOM_TYPE } as unknown as Question;
    expect(gradeAnswer(fake, "ok", 7)).toEqual({ correct: true, score: 7, maxScore: 7 });
    expect(gradeAnswer(fake, "no", 7).score).toBe(0);
    expect(listQuestionTypes()).toHaveLength(8);
  });

  it("拒绝用不同实现静默覆盖已有题型", () => {
    const duplicate: AnyQuestionTypeDefinition = {
      ...getQuestionType("single_choice"),
      label: "冒名顶替",
    };
    expect(() => registerQuestionType(duplicate)).toThrow(/拒绝静默覆盖/);
  });

  it("未注册题型给出可定位的错误，而不是静默判错", () => {
    unregisterQuestionType("true_false");
    try {
      const tf = q({
        type: "true_false",
        questionId: "javaweb:true_false:001",
        stem: "x",
        answer: true,
      });
      expect(() => gradeAnswer(tf, true)).toThrow(/未注册的题型「true_false」/);
    } finally {
      registerQuestionType(trueFalseDefinition);
    }
  });

  it("按题型自己的 Schema 校验形状", () => {
    const blank = q({
      type: "fill_blank",
      questionId: "javaweb:fill_blank:001",
      stem: "{{b1}}",
      blanks: [{ blankId: "b1", accepted: ["x"] }],
    });
    expect(validateQuestionShape(blank)).toBe(true);
    expect(validateQuestionShape({ ...blank, blanks: [] } as unknown as Question)).toBe(false);
  });
});
