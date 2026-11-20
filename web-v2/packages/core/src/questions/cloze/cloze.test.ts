import { describe, expect, it } from "vitest";

// 装配清单会注册全部内置题型；直接 import registry 不会触发注册
import "../index.js";
import { gradeAnswer } from "../registry.js";
import { computeRevision } from "../../revision.js";
import { QuestionSchema, type Question } from "../../schema.js";
import { clozeDefinition } from "./definition.js";

const base = (over: Record<string, unknown>): Record<string, unknown> => {
  const content = {
    schemaVersion: 1,
    type: "cloze",
    bankId: "eng",
    questionId: "eng:cloze:001",
    passageId: "eng:passage:001",
    topicIds: ["eng:topic:001"],
    stem: "Tom is {{b1}}, Jerry is {{b2}}.",
    sharedOptions: [
      { optionId: "o1", text: "happy" },
      { optionId: "o2", text: "sad" },
      { optionId: "o3", text: "calm" },
    ],
    blanks: [
      { blankId: "b1", optionId: "o1" },
      { blankId: "b2", optionId: "o2" },
    ],
    reuseOptions: false,
    ...over,
  };
  return { ...content, revision: computeRevision(content) };
};

function question(over: Record<string, unknown> = {}): Question {
  return QuestionSchema.parse(base(over));
}

describe("完形填空契约（R4-2）", () => {
  it("选项必须存在于 sharedOptions", () => {
    const parsed = QuestionSchema.safeParse(
      base({ blanks: [{ blankId: "b1", optionId: "nope" }] }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes("不存在的选项"))).toBe(true);
    }
  });

  it("空位编号不能重复，且题干必须含占位符", () => {
    const duplicated = QuestionSchema.safeParse(
      base({
        blanks: [
          { blankId: "b1", optionId: "o1" },
          { blankId: "b1", optionId: "o2" },
        ],
      }),
    );
    expect(duplicated.success).toBe(false);

    const missing = QuestionSchema.safeParse(
      base({ stem: "没有占位符", blanks: [{ blankId: "b1", optionId: "o1" }] }),
    );
    expect(missing.success).toBe(false);
  });

  it("reuseOptions=false 时同一个选项不能填两个空", () => {
    const parsed = QuestionSchema.safeParse(
      base({
        blanks: [
          { blankId: "b1", optionId: "o1" },
          { blankId: "b2", optionId: "o1" },
        ],
      }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes("复用"))).toBe(true);
    }
  });

  it("reuseOptions=true 时允许复用同一选项", () => {
    const parsed = QuestionSchema.safeParse(
      base({
        reuseOptions: true,
        blanks: [
          { blankId: "b1", optionId: "o1" },
          { blankId: "b2", optionId: "o1" },
        ],
      }),
    );
    expect(parsed.success).toBe(true);
  });
});

describe("完形填空判分（R4-2）", () => {
  it("全对 → score === maxScore", () => {
    const result = gradeAnswer(question(), { b1: "o1", b2: "o2" }, 5);
    expect(result.correct).toBe(true);
    expect(result.score).toBe(5);
    expect(result.details).toHaveLength(2);
  });

  it("reuseOptions=false 时重复用词：第二个空判错", () => {
    // 两个空都选了 o1；第二个空（b2）应判错，第一个空不受影响
    const result = gradeAnswer(question(), { b1: "o1", b2: "o1" }, 4);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(2);
    const details = result.details ?? [];
    expect(details.find((d) => d.key === "b1")?.correct).toBe(true);
    expect(details.find((d) => d.key === "b2")?.correct).toBe(false);
  });

  it("reuseOptions=true 时同一选项两空都算对", () => {
    const result = gradeAnswer(
      question({
        reuseOptions: true,
        blanks: [
          { blankId: "b1", optionId: "o1" },
          { blankId: "b2", optionId: "o1" },
        ],
      }),
      { b1: "o1", b2: "o1" },
      2,
    );
    expect(result.correct).toBe(true);
    expect(result.score).toBe(2);
  });

  it("未作答的空计入错项，不抛错", () => {
    const result = gradeAnswer(question(), { b1: "o1" }, 2);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(1);
    expect(result.details?.find((d) => d.key === "b2")?.given).toBe("");
  });

  it("定义元数据：不洗牌、题干由渲染器负责", () => {
    expect(clozeDefinition.shuffleOptions).toBe(false);
    expect(clozeDefinition.stemInRenderer).toBe(true);
    expect(clozeDefinition.answerKind).toBe("blanks");
  });
});
