import { describe, expect, it } from "vitest";

import { dryRunLegacyRecords, type LegacyRecordsExport } from "./index.js";

/** 最小题库：两题，一选一填 */
const questions = [
  {
    schemaVersion: 1,
    questionId: "javaweb:single_choice:001",
    bankId: "javaweb",
    revision: "0123456789ab",
    topicIds: ["javaweb:topic:jsp"],
    stem: "占位符",
    legacyKeys: ["choice-1"],
    type: "single_choice",
    options: [
      { optionId: "o1", text: "#{name}" },
      { optionId: "o2", text: "${name}" },
    ],
    answer: "o1",
  },
  {
    schemaVersion: 1,
    questionId: "javaweb:fill_blank:001",
    bankId: "javaweb",
    revision: "0123456789ab",
    topicIds: ["javaweb:topic:jdbc"],
    stem: "{{b1}}",
    legacyKeys: ["blank-1"],
    type: "fill_blank",
    blanks: [{ blankId: "b1", accepted: ["POOLED"] }],
  },
] as never;

const legacyMap = { "choice-1": "javaweb:single_choice:001", "blank-1": "javaweb:fill_blank:001" };
const templates = [
  {
    templateId: "javaweb:exam:final",
    bankId: "javaweb",
    title: "卷",
    sections: [{ sectionId: "s1", title: "选择", questionType: "single_choice", count: 1, scoreEach: 2 }],
    totalScore: 2,
  },
] as never;

const run = (payload: LegacyRecordsExport) => dryRunLegacyRecords(payload, legacyMap, questions, templates);

describe("T1-6 旧记录 dry-run", () => {
  it("掌握记录 → 1 条 correct=true，且不虚报首次作答", () => {
    const { attempts, report } = run({ mastery: [{ q_key: "choice-1", q_type: "choice" }] });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.correct).toBe(true);
    expect(attempts[0]?.isFirstAttempt).toBe(false);
    expect(attempts[0]?.importedFrom).toBe("quiz_mastery");
    expect(report.mappingRate).toBe(1);
  });

  it("错题按 wrong_count 展开，累计错次不失真", () => {
    const { attempts, progress, report } = run({
      wrongs: [{ q_key: "blank-1", q_type: "blank", wrong_count: 4 }],
    });
    expect(attempts).toHaveLength(4);
    expect(attempts.every((a) => a.correct === false)).toBe(true);
    const p = progress.find((x) => x.questionId === "javaweb:fill_blank:001");
    expect(p?.wrongCount).toBe(4);
    expect(p?.mastered).toBe(false);
    expect(report.attemptsByMode.practice).toBe(4);
  });

  it("模考明细：满分判对、0 分判错、部分分记 null", () => {
    const { attempts } = run({
      exams: [
        {
          id: 7,
          detail: { items: [{ k: "choice-1", s: 2 }] },
        },
      ],
    });
    expect(attempts[0]?.correct).toBe(true);
    expect(attempts[0]?.score).toBe(2);
    expect(attempts[0]?.maxScore).toBe(2);

    const partial = run({
      exams: [{ id: 8, detail: { items: [{ k: "choice-1", s: 1 }] } }],
    });
    expect(partial.attempts[0]?.correct).toBeNull(); // 部分分不敢断言对错
  });

  it("未知旧键进 unmapped，映射率下降", () => {
    const { report } = run({
      mastery: [
        { q_key: "choice-1", q_type: "choice" },
        { q_key: "choice-999", q_type: "choice" },
      ],
    });
    expect(report.unmapped).toHaveLength(1);
    expect(report.unmapped[0]?.legacyKey).toBe("choice-999");
    expect(report.mappingRate).toBeCloseTo(0.5);
  });

  it("有映射但题库缺题 → 记冲突，不静默丢", () => {
    const onlyFirst = { "choice-1": "javaweb:single_choice:001", "ghost-1": "javaweb:single_choice:404" };
    const { report } = dryRunLegacyRecords(
      { mastery: [{ q_key: "ghost-1", q_type: "choice" }] },
      onlyFirst,
      questions,
      templates,
    );
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]?.reason).toContain("404");
  });

  it("模考没有 detail 时记为丢弃，而不是当 0 分", () => {
    const { attempts, report } = run({ exams: [{ id: 9, detail: null }] });
    expect(attempts).toHaveLength(0);
    expect(report.dropped).toHaveLength(1);
  });

  it("进度由 Attempt 重算：先错后对 → mastered 且保留错次", () => {
    const { progress } = run({
      wrongs: [{ q_key: "choice-1", q_type: "choice", wrong_count: 2, last_wrong_at: "2026-11-01T00:00:00Z" }],
      mastery: [{ q_key: "choice-1", q_type: "choice" }],
    });
    const p = progress.find((x) => x.questionId === "javaweb:single_choice:001");
    expect(p?.mastered).toBe(true);
    expect(p?.wrongCount).toBe(2);
    expect(p?.attemptsCount).toBe(3);
  });
});
