/** T5-4 / T5-5：整卷判分、空位计分（D-4）、自评不覆盖客观分（D-5） */

import { describe, expect, it } from "vitest";

import type { ExamRecordItem, Question } from "../schema.js";
import { makeQuestion } from "../practice/fixtures.js";
import type { ExamPaperItem } from "./assemble.js";
import { gradeExamPaper, scoreBySection } from "./grading.js";
import {
  buildExamRecord,
  clearExamSelfRating,
  itemDetailMap,
  setExamSelfRating,
} from "./record.js";

function codeBlank5(id: string): Question {
  return makeQuestion({
    type: "code_blank",
    questionId: id,
    stem: "应用题",
    files: [
      {
        fileId: "f1",
        label: "Main.java",
        language: "java",
        code: "class A { ___(b1)___ m() { ___(b2)___ x = ___(b3)___; ___(b4)___; ___(b5)___; } }",
      },
    ],
    blanks: [
      { blankId: "b1", accepted: ["public"] },
      { blankId: "b2", accepted: ["int"] },
      { blankId: "b3", accepted: ["0"] },
      { blankId: "b4", accepted: ["return"] },
      { blankId: "b5", accepted: ["x"] },
    ],
  });
}

function fillBlank2(id: string): Question {
  return makeQuestion({
    type: "fill_blank",
    questionId: id,
    stem: "填 {{f1}} 与 {{f2}}",
    blanks: [
      { blankId: "f1", accepted: ["甲"] },
      { blankId: "f2", accepted: ["乙"] },
    ],
  });
}

function shortAnswer(id: string): Question {
  return makeQuestion({
    type: "short_answer",
    questionId: id,
    stem: "简述",
    rubric: [
      { pointId: "p1", text: "要点一", score: 3 },
      { pointId: "p2", text: "要点二", score: 2 },
    ],
  });
}

function singleChoice(id: string): Question {
  return makeQuestion({
    type: "single_choice",
    questionId: id,
    options: [
      { optionId: "o1", text: "甲" },
      { optionId: "o2", text: "乙" },
    ],
    answer: "o1",
  });
}

const item = (q: Question, maxScore: number, sectionId = "s"): ExamPaperItem => ({
  sectionId,
  questionId: q.questionId,
  maxScore,
});

describe("整卷判分（T5-4）", () => {
  it("应用题逐空比例分：5 空对 3 → 3/5，明细定位到两个错空（D-4）", () => {
    const q = codeBlank5("javaweb:code_blank:001");
    const summary = gradeExamPaper({
      items: [item(q, 7.5)],
      questions: [q],
      answers: {
        [q.questionId]: { b1: "public", b2: "int", b3: "1", b4: "retrn", b5: "x" },
      },
    });
    const graded = summary.items[0]!;
    expect(graded.score).toBe(4.5); // 7.5 × 3/5
    expect(graded.correct).toBe(false);
    expect(graded.answered).toBe(true);
    const detail = itemDetailMap(graded);
    expect(detail.get("b1")).toBe(true);
    expect(detail.get("b2")).toBe(true);
    expect(detail.get("b3")).toBe(false);
    expect(detail.get("b4")).toBe(false);
    expect(detail.get("b5")).toBe(true);
    expect(graded.details).toHaveLength(5);
  });

  it("填空题按空比例给分，全对满分", () => {
    const q = fillBlank2("javaweb:fill_blank:001");
    const half = gradeExamPaper({
      items: [item(q, 2)],
      questions: [q],
      answers: { [q.questionId]: { f1: "甲", f2: "错" } },
    });
    expect(half.items[0]!.score).toBe(1);
    const full = gradeExamPaper({
      items: [item(q, 2)],
      questions: [q],
      answers: { [q.questionId]: { f1: "甲", f2: "乙" } },
    });
    expect(full.items[0]!.score).toBe(2);
    expect(full.items[0]!.correct).toBe(true);
    expect(full.objectiveScore).toBe(2);
  });

  it("客观题自动判分；主观题 correct=null、得分 0 留给自评", () => {
    const sc = singleChoice("javaweb:single_choice:001");
    const sa = shortAnswer("javaweb:short_answer:001");
    const summary = gradeExamPaper({
      items: [item(sc, 2, "s1"), item(sa, 5, "s2")],
      questions: [sc, sa],
      answers: {
        [sc.questionId]: "o1",
        [sa.questionId]: "我的答案要点",
      },
    });
    const objective = summary.items[0]!;
    const subjective = summary.items[1]!;
    expect(objective.correct).toBe(true);
    expect(subjective.correct).toBeNull();
    expect(subjective.score).toBe(0);
    expect(summary.objectiveScore).toBe(2);
    expect(summary.objectiveMax).toBe(2);
    expect(summary.selfMax).toBe(5);
    expect(summary.totalMax).toBe(7);
  });

  it("未作答客观题：0 分、correct=false、answered=false，不与答错混淆", () => {
    const sc = singleChoice("javaweb:single_choice:001");
    const summary = gradeExamPaper({
      items: [item(sc, 2)],
      questions: [sc],
      answers: {},
    });
    const graded = summary.items[0]!;
    expect(graded.answered).toBe(false);
    expect(graded.score).toBe(0);
    expect(graded.correct).toBe(false);
    expect(graded.details).toBeUndefined();
  });

  it("分题型汇总给成绩页用", () => {
    const sc = singleChoice("javaweb:single_choice:001");
    const sa = shortAnswer("javaweb:short_answer:001");
    const summary = gradeExamPaper({
      items: [item(sc, 2, "s1"), item(sa, 5, "s2")],
      questions: [sc, sa],
      answers: { [sc.questionId]: "o2", [sa.questionId]: "答" },
    });
    expect(scoreBySection(summary)).toEqual([
      { sectionId: "s1", score: 0, max: 2, count: 1 },
      { sectionId: "s2", score: 0, max: 5, count: 1 },
    ]);
  });
});

describe("主观自评（T5-5）", () => {
  function recordWithSubjective() {
    const sc = singleChoice("javaweb:single_choice:001");
    const sa = shortAnswer("javaweb:short_answer:001");
    const summary = gradeExamPaper({
      items: [item(sc, 2, "s1"), item(sa, 5, "s2")],
      questions: [sc, sa],
      answers: { [sc.questionId]: "o1", [sa.questionId]: "原始作答" },
    });
    return buildExamRecord({
      recordId: "r-1",
      bankId: "javaweb",
      templateId: "javaweb:exam:test",
      sessionId: "e-1",
      seed: 1,
      startedAt: "2026-11-17T09:00:00.000Z",
      submittedAt: "2026-11-17T10:00:00.000Z",
      durationSec: 3600,
      summary,
    });
  }

  it("自评部分正确：档位单独显示，客观分不受影响，原始作答可回看（D-5）", () => {
    const record = recordWithSubjective();
    expect(record.objectiveScore).toBe(2);
    expect(record.selfScore).toBe(0);

    const rated = setExamSelfRating(record, "javaweb:short_answer:001", "half", "2026-11-17T10:05:00.000Z");
    const subjectItem = rated.items.find((i) => i.questionId === "javaweb:short_answer:001")!;
    const objectItem = rated.items.find((i) => i.questionId === "javaweb:single_choice:001")!;

    // 自评档位单独存在
    expect(subjectItem.selfRating).toMatchObject({ level: "half", score: 2.5, maxScore: 5 });
    // 客观题得分与作答原文纹丝不动
    expect(rated.objectiveScore).toBe(record.objectiveScore);
    expect(objectItem.score).toBe(2);
    expect(objectItem.correct).toBe(true);
    expect(subjectItem.answer).toBe("原始作答");
    expect(subjectItem.correct).toBeNull();
    // 总分 = 客观 + 自评（旧版 renderScore 同口径）
    expect(rated.selfScore).toBe(2.5);
    expect(rated.totalScore).toBe(4.5);
  });

  it("自评可改：换档位只改 selfRating，客观字段不变", () => {
    const record = recordWithSubjective();
    const half = setExamSelfRating(record, "javaweb:short_answer:001", "half", "t1");
    const full = setExamSelfRating(half, "javaweb:short_answer:001", "full", "t2");
    expect(full.items[1]!.selfRating).toMatchObject({ level: "full", score: 5, ratedAt: "t2" });
    expect(full.objectiveScore).toBe(2);
    expect(full.selfScore).toBe(5);
    expect(full.totalScore).toBe(7);
  });

  it("客观题拒绝自评（返回原记录，不静默改分）", () => {
    const record = recordWithSubjective();
    const after = setExamSelfRating(record, "javaweb:single_choice:001", "full", "t1");
    expect(after).toBe(record);
  });

  it("清除自评只置空档位", () => {
    const record = recordWithSubjective();
    const rated = setExamSelfRating(record, "javaweb:short_answer:001", "full", "t1");
    const cleared = clearExamSelfRating(rated, "javaweb:short_answer:001");
    expect(cleared.items[1]!.selfRating).toBeNull();
    expect(cleared.selfScore).toBe(0);
    expect(cleared.objectiveScore).toBe(2);
  });

  it("成绩只增不改：客观字段冻结（交卷后再改自评不触碰 items 的 score/correct/answer）", () => {
    const record = recordWithSubjective();
    const frozen = record.items.map(({ score, correct, answer }) => ({ score, correct, answer }));
    let next = record;
    for (const level of ["none", "half", "full", "half"] as const) {
      next = setExamSelfRating(next, "javaweb:short_answer:001", level, "t");
    }
    expect(
      next.items.map(({ score, correct, answer }) => ({ score, correct, answer })),
    ).toEqual(frozen);
    // 自评历史可追溯到当前档位与其时间
    expect(next.items[1]!.selfRating?.level).toBe("half");
  });

  it("未作答的主观题也能自评（旧版：留空对照答案后给自己打分）", () => {
    const sa = shortAnswer("javaweb:short_answer:001");
    const summary = gradeExamPaper({
      items: [item(sa, 5)],
      questions: [sa],
      answers: {},
    });
    const record = buildExamRecord({
      recordId: "r-2",
      bankId: "javaweb",
      templateId: "t",
      sessionId: "e-1",
      seed: 1,
      startedAt: "t0",
      submittedAt: "t1",
      durationSec: 0,
      summary,
    });
    expect(record.items[0]!.answered).toBe(false);
    const rated = setExamSelfRating(record, sa.questionId, "none", "t2");
    expect(rated.selfScore).toBe(0);
    expect(rated.items[0]!.selfRating?.level).toBe("none");
  });
});

describe("成绩记录汇总", () => {
  it("交卷即得：客观合计、自评满分、总分口径", () => {
    const sc = singleChoice("javaweb:single_choice:001");
    const cb = codeBlank5("javaweb:code_blank:001");
    const sa = shortAnswer("javaweb:short_answer:001");
    const summary = gradeExamPaper({
      items: [item(sc, 2, "s1"), item(cb, 7.5, "s2"), item(sa, 5, "s3")],
      questions: [sc, cb, sa],
      answers: {
        [sc.questionId]: "o1",
        [cb.questionId]: { b1: "public", b2: "int", b3: "0", b4: "return", b5: "x" },
        [sa.questionId]: "答",
      },
    });
    const record = buildExamRecord({
      recordId: "r-3",
      bankId: "javaweb",
      templateId: "t",
      sessionId: "e-1",
      seed: 9,
      startedAt: "t0",
      submittedAt: "t1",
      durationSec: 600,
      timedOut: true,
      summary,
    });
    expect(record.objectiveScore).toBe(9.5);
    expect(record.objectiveMax).toBe(9.5);
    expect(record.selfMax).toBe(5);
    expect(record.totalScore).toBe(9.5);
    expect(record.totalMax).toBe(14.5);
    expect(record.timedOut).toBe(true);
    expect(record.templateId).toBe("t");
  });
});
