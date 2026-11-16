import { describe, expect, it } from "vitest";

import { computeRevision } from "./revision.js";
import { gradeQuestion, normalizeAnswer } from "./grade.js";
import { SCHEMA_VERSION, type Question } from "./schema.js";

const rev = (o: unknown) => computeRevision(o);

const q = (over: Record<string, unknown>): Question =>
  ({ schemaVersion: SCHEMA_VERSION, bankId: "javaweb", topicIds: ["t"], revision: rev(over), ...over }) as Question;

describe("判分器雏形", () => {
  it("单选：选对得满分，选错 0 分", () => {
    const question = q({
      type: "single_choice",
      questionId: "javaweb:single_choice:001",
      stem: "占位符",
      options: [
        { optionId: "o1", text: "#{name}" },
        { optionId: "o2", text: "${name}" },
      ],
      answer: "o1",
    });
    expect(gradeQuestion(question, "o1", 2)).toEqual({ correct: true, score: 2, maxScore: 2 });
    expect(gradeQuestion(question, "o2", 2)).toEqual({ correct: false, score: 0, maxScore: 2 });
  });

  it("多选：顺序无关，少选也算错（旧版口径）", () => {
    const question = q({
      type: "multiple_choice",
      questionId: "javaweb:multiple_choice:001",
      stem: "x",
      options: [
        { optionId: "o1", text: "A" },
        { optionId: "o2", text: "B" },
        { optionId: "o3", text: "C" },
      ],
      answer: ["o1", "o3"],
    });
    expect(gradeQuestion(question, ["o3", "o1"], 2).correct).toBe(true);
    expect(gradeQuestion(question, ["o1"], 2).correct).toBe(false);
  });

  it("填空：忽略大小写、空白与引号", () => {
    const question = q({
      type: "fill_blank",
      questionId: "javaweb:fill_blank:001",
      stem: "{{b1}} 与 {{b2}}",
      blanks: [
        { blankId: "b1", accepted: ["POOLED"] },
        { blankId: "b2", accepted: ["UNPOOLED"] },
      ],
    });
    const all = gradeQuestion(question, { b1: " pooled ", b2: "unPOOLED" }, 4);
    expect(all.correct).toBe(true);
    expect(all.score).toBe(4);

    const half = gradeQuestion(question, { b1: "POOLED" }, 4);
    expect(half.correct).toBe(false);
    expect(half.score).toBe(2); // 按空计分：对 1 个空得一半
  });

  it("代码填空：自闭合写法视为等价", () => {
    const question = q({
      type: "code_blank",
      questionId: "javaweb:code_blank:001",
      stem: "配置",
      files: [
        { fileId: "f1", label: "web.xml", language: "xml", code: "<param-value>___(b1)___</param-value>" },
      ],
      blanks: [{ blankId: "b1", fileId: "f1", accepted: ["<url-pattern>/x</url-pattern>"] }],
    });
    expect(gradeQuestion(question, { b1: "<url-pattern>/x</url-pattern>" }).correct).toBe(true);
    // 自闭合写法等价：`<x/>` 与 `<x>`
    expect(normalizeAnswer("<a/>")).toBe(normalizeAnswer("<a>"));
  });

  it("简答：不自动判定，返回 null 交给自评", () => {
    const question = q({
      type: "short_answer",
      questionId: "javaweb:short_answer:001",
      stem: "x",
      rubric: [{ pointId: "p1", text: "要点", score: 5 }],
    });
    expect(gradeQuestion(question, "随便写点").correct).toBeNull();
  });
});
