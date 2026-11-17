/**
 * T5-9 / G5-7 / D-6：多题库模考隔离。
 *
 * 两个题库各有各的模板，互不借用题池、互不越界：
 * 化学小测 10 题 / 50 分（含主题筛选 + 30 分钟），JavaWeb 期末 38 题 / 100 分。
 * 模板与成绩的归属靠 `bankId` + `templateId`，交叉组卷必须失败而不是"凑合出卷"。
 */

import { describe, expect, it } from "vitest";

import {
  PaperAssemblyError,
  assemblePaper,
  checkPaperMatchesTemplate,
  validateExamTemplate,
} from "@quiz/core";

import { chemistryBank } from "./banks/chemistry.js";
import examTemplatesJson from "../javaweb-final/examTemplates.json";
import questionsJson from "../javaweb-final/questions.json";
import type { ExamTemplate, Question } from "@quiz/core";

const javawebTemplates = examTemplatesJson as unknown as ExamTemplate[];
const javawebQuestions = questionsJson as unknown as Question[];
const chemTemplate = chemistryBank.manifest.examTemplates[0]!;
const javawebTemplate = javawebTemplates[0]!;

describe("多题库模考隔离（T5-9）", () => {
  it("化学小测模板：10 题 / 50 分，与题库校验通过（含主题筛选）", () => {
    const result = validateExamTemplate(
      chemTemplate,
      chemistryBank.questions,
      chemistryBank.manifest.topics,
    );
    expect(result.issues).toEqual([]);
    expect(chemTemplate.sections.reduce((a, s) => a + s.count, 0)).toBe(10);
    expect(chemTemplate.totalScore).toBe(50);
    expect(chemTemplate.durationSec).toBe(1800);
  });

  it("两模板四项配置互不相同（G5-1：题量/分值/范围/时长均可配置）", () => {
    expect(chemTemplate.sections.map((s) => s.count)).not.toEqual(
      javawebTemplate.sections.map((s) => s.count),
    );
    expect(chemTemplate.sections.map((s) => s.scoreEach)).not.toEqual(
      javawebTemplate.sections.map((s) => s.scoreEach),
    );
    expect(chemTemplate.durationSec).not.toBe(javawebTemplate.durationSec);
    const chemFiltered = chemTemplate.sections.some((s) => s.filter !== undefined);
    const jwFiltered = javawebTemplate.sections.some((s) => s.filter !== undefined);
    expect(chemFiltered).toBe(true);
    expect(jwFiltered).toBe(false);
  });

  it("各从各的题池组卷：10 题 / 50 分与 38 题 / 100 分都严格符合模板（D-6）", () => {
    const chemPaper = assemblePaper({
      template: chemTemplate,
      questions: chemistryBank.questions,
      seed: 2,
    });
    expect(chemPaper.items).toHaveLength(10);
    expect(checkPaperMatchesTemplate(chemPaper, chemTemplate)).toBe(true);
    // 题目全部来自 chem 库
    expect(chemPaper.items.every((i) => i.questionId.startsWith("chem:"))).toBe(true);

    const jwPaper = assemblePaper({
      template: javawebTemplate,
      questions: javawebQuestions,
      seed: 2,
    });
    expect(jwPaper.items).toHaveLength(38);
    expect(jwPaper.items.every((i) => i.questionId.startsWith("javaweb:"))).toBe(true);
  });

  it("填空题的主题筛选生效：只从「物质」「溶液」两个主题抽", () => {
    const paper = assemblePaper({
      template: chemTemplate,
      questions: chemistryBank.questions,
      seed: 3,
    });
    const fbItems = paper.items.filter((i) => i.sectionId === "q4");
    expect(fbItems).toHaveLength(3);
    for (const item of fbItems) {
      const q = chemistryBank.questions.find((x) => x.questionId === item.questionId)!;
      expect(q.type).toBe("fill_blank");
      expect(
        q.topicIds.some((t) => t === "chem:topic:matter" || t === "chem:topic:solution"),
      ).toBe(true);
    }
  });

  it("交叉组卷失败：化学模板进 JavaWeb 题池、JavaWeb 模板进化学题池都被拒绝（不互相借用）", () => {
    expect(() =>
      assemblePaper({ template: chemTemplate, questions: javawebQuestions, seed: 1 }),
    ).toThrow(PaperAssemblyError);
    try {
      assemblePaper({ template: javawebTemplate, questions: chemistryBank.questions, seed: 1 });
      expect.unreachable("应当抛出 PaperAssemblyError");
    } catch (e) {
      expect(e).toBeInstanceOf(PaperAssemblyError);
      // 题库归属不同（bankId 不匹配）：可用题目 0 < 需要 15
      expect((e as PaperAssemblyError).issues[0]?.message).toBe("可用题目 0 < 需要 15");
    }
  });
});
