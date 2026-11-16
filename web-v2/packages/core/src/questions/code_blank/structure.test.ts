/**
 * T2-4 判据：多代码块结构不重排、空位按 blankId 定位、逐空部分给分。
 *
 * 模拟题刻意复刻真实题库的两个坑：同一 blankId 出现多次、出现顺序与定义顺序不同。
 * 同时遵守真实数据的约束：重复标记发生在**同一个文件内**（fileId 与定义一致）。
 */

import { describe, expect, it } from "vitest";

import { computeRevision } from "../../revision.js";
import { SCHEMA_VERSION, type Question } from "../../schema.js";
import { gradeAnswer } from "../registry.js";
import "../index.js";
import { buildCodeStructure, checkCodeBlankStructure, type CodeBlankQuestion } from "./structure.js";

const question = ({
  type: "code_blank",
  questionId: "javaweb:code_blank:001",
  bankId: "javaweb",
  schemaVersion: SCHEMA_VERSION,
  topicIds: ["t"],
  revision: computeRevision({ type: "code_blank" }),
  stem: "应用题：多文件 + 重复空位",
  files: [
    {
      fileId: "f1",
      label: "A.java",
      language: "java",
      code: "class ___(1-2)___ { ___(1-1)___ x; }", // 出现顺序与定义顺序相反
    },
    {
      fileId: "f2",
      label: "web.xml",
      language: "xml",
      code: "<x>___(1-3)___</x><y>___(1-3)___</y>", // 同一空位在同一文件里出现两次
    },
  ],
  blanks: [
    { blankId: "1-1", fileId: "f1", accepted: ["int"] },
    { blankId: "1-2", fileId: "f1", accepted: ["User"] },
    { blankId: "1-3", fileId: "f2", accepted: ["value"] },
  ],
}) as unknown as Question;

const codeQuestion = question as CodeBlankQuestion;
const ALL_RIGHT = { "1-1": "int", "1-2": "User", "1-3": "value" };

describe("代码填空结构解析", () => {
  it("文件顺序与代码文本原样保留，标记按出现位置切段", () => {
    const s = buildCodeStructure(codeQuestion);
    expect(s.files.map((f) => f.fileId)).toEqual(["f1", "f2"]);
    expect(s.files[0]?.segments.map((x) => x.kind)).toEqual([
      "code",
      "blank",
      "code",
      "blank",
      "code",
    ]);
    expect(s.files[0]?.segments.filter((x) => x.kind === "blank").map((x) => x.blankId)).toEqual([
      "1-2",
      "1-1",
    ]);
    expect(s.files[0]?.code).toContain("___(1-2)___");
  });

  it("唯一空位按定义顺序，标记次数单独统计，两者不混淆", () => {
    const s = buildCodeStructure(codeQuestion);
    expect(s.blankIdsInOrder).toEqual(["1-1", "1-2", "1-3"]);
    expect(s.uniqueBlankCount).toBe(3);
    expect(s.slotCount).toBe(4); // f1 两处 + f2 两处（1-3 重复）
  });

  it("结构对账：重复标记合法，未定义/缺失/文件不符才报错", () => {
    expect(checkCodeBlankStructure(codeQuestion)).toEqual([]);
  });

  it("跨文件重复或标记缺失都能被对账发现", () => {
    const broken = {
      ...codeQuestion,
      files: [
        ...codeQuestion.files,
        { fileId: "f3", label: "extra", language: "xml", code: "___(1-1)___" },
      ],
    } as CodeBlankQuestion;
    expect(checkCodeBlankStructure(broken).map((i) => i.code)).toContain("FILE_MISMATCH");
  });

  it("空位 ID 定位：代码里出现顺序颠倒不影响判分", () => {
    expect(gradeAnswer(question, ALL_RIGHT, 12)).toMatchObject({
      correct: true,
      score: 12,
      maxScore: 12,
    });
  });

  it("部分给分：答对 1/3 空得 1/3 分，details 定位到具体空位", () => {
    const result = gradeAnswer(question, { "1-1": "int" }, 12);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(4);
    expect(result.details).toEqual([
      { key: "1-1", correct: true, given: "int", accepted: ["int"] },
      { key: "1-2", correct: false, given: "", accepted: ["User"] },
      { key: "1-3", correct: false, given: "", accepted: ["value"] },
    ]);
  });

  it("同一空位在代码里出现多次，作答只需填一次", () => {
    const s = buildCodeStructure(codeQuestion);
    const occurrences = s.files.flatMap((f) =>
      f.segments.filter((x) => x.kind === "blank" && x.blankId === "1-3"),
    );
    expect(occurrences).toHaveLength(2);
    expect(gradeAnswer(question, ALL_RIGHT).correct).toBe(true);
  });
});
