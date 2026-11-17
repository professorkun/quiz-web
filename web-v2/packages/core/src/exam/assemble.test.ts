/** T5-2：组卷——严格符合模板、种子可复现、题量不足拒绝开考 */

import { describe, expect, it } from "vitest";

import type { ExamTemplate } from "../schema.js";
import { makeMixedQuestions } from "../practice/fixtures.js";
import { PaperAssemblyError, assemblePaper, checkPaperMatchesTemplate } from "./assemble.js";

const questions = makeMixedQuestions();

function template(over: Partial<ExamTemplate> = {}): ExamTemplate {
  return {
    templateId: "javaweb:exam:test",
    bankId: "javaweb",
    title: "测试卷",
    sections: [
      { sectionId: "s1", title: "单选", questionType: "single_choice", count: 6, scoreEach: 2 },
      { sectionId: "s2", title: "判断", questionType: "true_false", count: 2, scoreEach: 1 },
      { sectionId: "s3", title: "填空", questionType: "fill_blank", count: 1, scoreEach: 2 },
    ],
    totalScore: 16,
    ...over,
  };
}

describe("组卷（T5-2）", () => {
  it("同一种子两次组卷：题序、选项序、修订逐项一致（可复现）", () => {
    const a = assemblePaper({ template: template(), questions, seed: 20261117 });
    const b = assemblePaper({ template: template(), questions, seed: 20261117 });
    expect(a.items).toEqual(b.items);
    expect(a.optionOrders).toEqual(b.optionOrders);
    expect(a.questionRevisions).toEqual(b.questionRevisions);
  });

  it("不同种子换题序，但都严格符合模板（G5-2）", () => {
    const a = assemblePaper({ template: template(), questions, seed: 1 });
    const b = assemblePaper({ template: template(), questions, seed: 2 });
    expect(checkPaperMatchesTemplate(a, template())).toBe(true);
    expect(checkPaperMatchesTemplate(b, template())).toBe(true);
    expect(a.items).not.toEqual(b.items);
  });

  it("题量、总分、题型分布严格等于模板", () => {
    const paper = assemblePaper({ template: template(), questions, seed: 7 });
    expect(paper.items).toHaveLength(9);
    const bySection = new Map<string, number>();
    for (const item of paper.items) {
      bySection.set(item.sectionId, (bySection.get(item.sectionId) ?? 0) + 1);
    }
    expect(Object.fromEntries(bySection)).toEqual({ s1: 6, s2: 2, s3: 1 });
    expect(paper.items.reduce((sum, i) => sum + i.maxScore, 0)).toBe(16);
    expect(paper.totalScore).toBe(16);
  });

  it("单选/多选带选项序，判断题不洗牌（G5-2 渲染契约）", () => {
    const paper = assemblePaper({ template: template(), questions, seed: 9 });
    const sc = paper.items.find((i) => i.questionId.includes("single_choice"));
    expect(paper.optionOrders[sc?.questionId ?? ""]).toBeDefined();
    for (const item of paper.items.filter((i) => i.questionId.includes("true_false"))) {
      expect(paper.optionOrders[item.questionId]).toBeUndefined();
    }
  });

  it("题量不足 → 「可用题目 X < 需要 Y」，不生成残卷（D-2）", () => {
    const over = template({
      sections: [
        { sectionId: "s1", title: "单选", questionType: "single_choice", count: 40, scoreEach: 2 },
      ],
      totalScore: 80,
    });
    let error: unknown;
    try {
      assemblePaper({ template: over, questions, seed: 1 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(PaperAssemblyError);
    const issues = (error as PaperAssemblyError).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "POOL_SHORTAGE",
      path: "sections[0].count",
      message: "可用题目 6 < 需要 40",
    });
  });

  it("跨大题共用一个池子时按剩余池子判，不会一题抽两次", () => {
    // 两个大题都从 6 道单选里抽：各 4 道可行；各 6 道则后者只剩 0
    const ok = template({
      sections: [
        { sectionId: "s1", title: "单选一", questionType: "single_choice", count: 4, scoreEach: 2 },
        { sectionId: "s2", title: "单选二", questionType: "single_choice", count: 2, scoreEach: 1 },
      ],
      totalScore: 10,
    });
    const paper = assemblePaper({ template: ok, questions, seed: 3 });
    const ids = paper.items.map((i) => i.questionId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(paper.items.filter((i) => i.sectionId === "s2")).toHaveLength(2);

    const over = template({
      sections: [
        { sectionId: "s1", title: "单选一", questionType: "single_choice", count: 6, scoreEach: 2 },
        { sectionId: "s2", title: "单选二", questionType: "single_choice", count: 1, scoreEach: 1 },
      ],
      totalScore: 13,
    });
    expect(() => assemblePaper({ template: over, questions, seed: 3 })).toThrow(PaperAssemblyError);
    try {
      assemblePaper({ template: over, questions, seed: 3 });
    } catch (e) {
      expect((e as PaperAssemblyError).issues[0]?.message).toBe("可用题目 0 < 需要 1");
    }
  });

  it("筛选范围为空 → 同样拒绝（范围为空即题量 0）", () => {
    const over = template({
      sections: [
        {
          sectionId: "s1",
          title: "单选",
          questionType: "single_choice",
          count: 1,
          scoreEach: 2,
          filter: { difficulty: "hard" },
        },
      ],
      totalScore: 2,
    });
    expect(() => assemblePaper({ template: over, questions, seed: 1 })).toThrow(
      /可用题目 0 < 需要 1/,
    );
  });

  it("时长随模板带入卷面", () => {
    const paper = assemblePaper({
      template: template({ durationSec: 3600 }),
      questions,
      seed: 5,
    });
    expect(paper.durationSec).toBe(3600);
  });
});
