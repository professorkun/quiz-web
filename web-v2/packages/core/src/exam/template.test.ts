/** T5-1：模板校验——非法模板被拒绝并定位到具体字段 */

import { describe, expect, it } from "vitest";

import type { ExamTemplate, Question, Topic } from "../schema.js";
import { makeMixedQuestions } from "../practice/fixtures.js";
import { sectionPool, validateExamTemplate } from "./template.js";

const questions = makeMixedQuestions();

/** 合法模板：6 单选 ×2 + 2 判断 ×1 + 1 填空 ×2 = 16 分，正好把池子用满 */
function goodTemplate(over: Partial<ExamTemplate> = {}): ExamTemplate {
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

const issueOf = (raw: unknown, code: string, at?: number) =>
  validateExamTemplate(raw, questions).issues.filter((i) => i.code === code)[at ?? 0];

describe("模板校验（T5-1）", () => {
  it("合法模板通过，返回解析后的模板", () => {
    const result = validateExamTemplate(goodTemplate(), questions);
    expect(result.ok).toBe(true);
    expect(result.template?.templateId).toBe("javaweb:exam:test");
    expect(result.issues).toEqual([]);
  });

  it("分值加总不符 → 指向 totalScore 并给出两个数字", () => {
    const result = validateExamTemplate(goodTemplate({ totalScore: 100 }), questions);
    expect(result.ok).toBe(false);
    expect(result.template).toBeNull();
    expect(issueOf(goodTemplate({ totalScore: 100 }), "SCORE_SUM")).toMatchObject({
      path: "totalScore",
      message: expect.stringContaining("16"),
    });
  });

  it("题量不足 → 「可用题目 X < 需要 Y」并定位到 sections[i].count", () => {
    const over: ExamTemplate = {
      ...goodTemplate(),
      sections: [
        { sectionId: "s1", title: "单选", questionType: "single_choice", count: 40, scoreEach: 2 },
      ],
      totalScore: 80,
    };
    const result = validateExamTemplate(over, questions);
    expect(result.ok).toBe(false);
    expect(issueOf(over, "POOL_SHORTAGE")).toMatchObject({
      path: "sections[0].count",
      message: "可用题目 6 < 需要 40",
    });
  });

  it("筛选范围把池子缩到不够时也拒绝（难度筛完只剩 0 题）", () => {
    const over: ExamTemplate = {
      ...goodTemplate(),
      sections: [
        {
          sectionId: "s1",
          title: "单选",
          questionType: "single_choice",
          count: 6,
          scoreEach: 2,
          filter: { difficulty: "hard" },
        },
      ],
      totalScore: 12,
    };
    const issue = issueOf(over, "POOL_SHORTAGE");
    expect(issue?.message).toBe("可用题目 0 < 需要 6");
  });

  it("筛选范围引用不存在的知识点 → UNKNOWN_TOPIC（传入 topics 时）", () => {
    const topics: Topic[] = [{ topicId: "t1", bankId: "javaweb", name: "知识点 1" }];
    const over = goodTemplate({
      sections: [
        {
          sectionId: "s1",
          title: "单选",
          questionType: "single_choice",
          count: 6,
          scoreEach: 2,
          filter: { topicIds: ["t-nope"] },
        },
      ],
      totalScore: 12,
    });
    const result = validateExamTemplate(over, questions, topics);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: "UNKNOWN_TOPIC", path: "sections[0].filter.topicIds" });
  });

  it("大题 ID 重复 → DUPLICATE_SECTION", () => {
    const over = goodTemplate({
      sections: [
        { sectionId: "s1", title: "单选", questionType: "single_choice", count: 6, scoreEach: 2 },
        { sectionId: "s1", title: "单选二", questionType: "single_choice", count: 6, scoreEach: 2 },
      ],
      totalScore: 24,
    });
    const result = validateExamTemplate(over, questions);
    expect(result.ok).toBe(false);
    const dup = result.issues.find((i) => i.code === "DUPLICATE_SECTION");
    expect(dup?.path).toBe("sections[1].sectionId");
  });

  it("Schema 级错误（scoreEach 非法）定位到字段，且不进入池子校验", () => {
    const over = goodTemplate({
      sections: [
        { sectionId: "s1", title: "单选", questionType: "single_choice", count: 6, scoreEach: -1 },
      ],
      totalScore: -6,
    });
    const result = validateExamTemplate(over, questions);
    expect(result.ok).toBe(false);
    expect(result.issues.every((i) => i.code === "SCHEMA")).toBe(true);
    expect(result.issues.map((i) => i.path)).toContain("sections.0.scoreEach");
  });

  it("未注册的题型 → UNKNOWN_TYPE", () => {
    const over = goodTemplate({
      sections: [
        { sectionId: "s1", title: "怪题", questionType: "essay" as never, count: 1, scoreEach: 1 },
      ],
      totalScore: 1,
    });
    expect(issueOf(over, "UNKNOWN_TYPE")?.path).toBe("sections[0].questionType");
  });
});

describe("筛选池口径（校验器与组卷器共用）", () => {
  it("缺省筛选 = 全部该题型", () => {
    const pool = sectionPool(questions, "javaweb", {
      sectionId: "s",
      title: "t",
      questionType: "single_choice",
      count: 6,
      scoreEach: 2,
    });
    expect(pool).toHaveLength(6);
  });

  it("主题筛选取交集语义（任一主题命中即可）", () => {
    const pool = sectionPool(questions, "javaweb", {
      sectionId: "s",
      title: "t",
      questionType: "single_choice",
      count: 6,
      scoreEach: 2,
      filter: { topicIds: ["t1"] },
    });
    // 夹具里奇数题在 t1：3 道
    expect(pool).toHaveLength(3);
  });

  it("标签与难度只在题目带了字段时生效", () => {
    const tagged: Question[] = questions.map((q, i) =>
      q.type === "single_choice" && i % 2 === 0
        ? ({ ...q, tags: ["重点"], difficulty: "easy" } as Question)
        : q,
    );
    const byTag = sectionPool(tagged, "javaweb", {
      sectionId: "s",
      title: "t",
      questionType: "single_choice",
      count: 1,
      scoreEach: 1,
      filter: { tags: ["重点"] },
    });
    expect(byTag.length).toBeGreaterThan(0);
    expect(byTag.every((q) => (q.tags ?? []).includes("重点"))).toBe(true);

    const byDifficulty = sectionPool(tagged, "javaweb", {
      sectionId: "s",
      title: "t",
      questionType: "single_choice",
      count: 1,
      scoreEach: 1,
      filter: { difficulty: "easy" },
    });
    expect(byDifficulty).toEqual(byTag);
  });
});
