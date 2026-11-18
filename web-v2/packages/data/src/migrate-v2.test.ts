/**
 * 旧云 → V2 迁移转换器的行为证据（S6 · T6-5）。
 * 真实数据演练见 scripts/rehearse-migration.mjs；本测试用合成小样本进 CI。
 */

import { describe, expect, it } from "vitest";

import type { Question } from "@quiz/core";

import { migrateLegacyToV2 } from "./migrate-v2.js";

const q: Question = {
  schemaVersion: 1,
  questionId: "javaweb:single_choice:001",
  bankId: "javaweb",
  revision: "abc123def456",
  topicIds: ["javaweb:t:a"],
  stem: "题干",
  type: "single_choice",
  options: [
    { optionId: "oa", text: "A" },
    { optionId: "ob", text: "B" },
  ],
  answer: "oa",
  legacyKeys: [],
};

const legacyMap = { "choice-1": "javaweb:single_choice:001" };

describe("旧云 → V2 迁移", () => {
  it("mastery/错题 → attempts+progress，exam → exam_records_v2，drill → session", () => {
    const r = migrateLegacyToV2({
      legacy: {
        exportedAt: "2026-11-18T00:00:00.000Z",
        mastery: [{ q_key: "choice-1", q_type: "choice" }],
        wrongs: [{ q_key: "choice-1", q_type: "choice", wrong_count: 2 }],
        exams: [
          { id: 1, detail: { items: [{ k: "choice-1", s: 1 }] }, obj_full: 1, obj_score: 1, duration_sec: 60 },
        ],
      },
      drill: { q_keys: ["choice-1"], idx: 0, res: "0", updated_at: "2026-11-18T00:00:00.000Z" },
      legacyMap,
      questions: [q],
      templates: [],
    });

    // 1 条 mastery(correct=true) + 2 条错题(correct=false)
    expect(r.attempts).toHaveLength(3);
    expect(r.attempts.filter((a) => a.correct === false)).toHaveLength(2);

    expect(r.progress).toHaveLength(1);
    expect(r.progress[0]!.attemptsCount).toBe(3);
    expect(r.progress[0]!.wrongCount).toBe(2);

    expect(r.examRecords).toHaveLength(1);
    expect(r.examRecords[0]!.items).toHaveLength(1);

    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0]!.questionIds).toEqual(["javaweb:single_choice:001"]);

    expect(r.report.dryRun.mappingRate).toBe(1);
    expect(r.report.examIssues).toHaveLength(0);
    expect(r.report.drillIssues).toHaveLength(0);
  });

  it("无法解析的题键进入 issue，不静默丢弃", () => {
    const r = migrateLegacyToV2({
      legacy: {
        mastery: [{ q_key: "unknown-x", q_type: "choice" }],
        wrongs: [],
        exams: [],
      },
      legacyMap,
      questions: [q],
    });
    expect(r.attempts).toHaveLength(0);
    expect(r.report.dryRun.unmapped.length).toBe(1);
  });
});
