/**
 * 全量快照同步的行为证据（S6 · T6-4）。
 *
 * 用内存平台 + mock 传输，验证三条最容易出数据 bug 的性质：
 *  1. 并集：本地独有 + 云独有 → 同步后两边都齐
 *  2. 幂等：连续同步不产生重复
 *  3. LWW：可变表（进度）以更新更晚的一方为准
 */

import { describe, expect, it } from "vitest";

import type { Attempt, BankContent, QuestionProgress } from "@quiz/core";
import type { Clock } from "@quiz/platform";
import { createPlatform, MemoryKeyValueStore } from "@quiz/platform-web";

import { attemptToRow, syncAll, type CloudRow, type SyncTransport } from "./sync";

const clock: Clock = { now: () => new Date("2026-11-18T00:00:00.000Z") };

const bank: BankContent = {
  manifest: {
    schemaVersion: 1,
    bankId: "javaweb",
    title: "JavaWeb",
    questionCount: 0,
    topics: [{ topicId: "javaweb:t:a", bankId: "javaweb", name: "T", order: 0 }],
    examTemplates: [],
    createdAt: "2026-11-18T00:00:00.000Z",
  },
  questions: [],
  knowledge: [],
};

function makePlatform(): ReturnType<typeof createPlatform> {
  return createPlatform({ kv: new MemoryKeyValueStore(), builtinBanks: [bank], clock });
}

function attempt(id: string, questionId: string): Attempt {
  return {
    attemptId: id,
    bankId: "javaweb",
    questionId,
    questionRevision: "abc123def456",
    mode: "practice",
    isFirstAttempt: true,
    startedAt: "2026-11-18T00:00:00.000Z",
    submittedAt: "2026-11-18T00:00:10.000Z",
    answer: null,
    correct: true,
    score: 1,
    maxScore: 1,
  };
}

function progress(questionId: string, count: number): QuestionProgress {
  return {
    bankId: "javaweb",
    questionId,
    attemptsCount: count,
    wrongCount: 0,
    firstCorrectAt: "2026-11-18T00:00:00.000Z",
    lastAttemptAt: "2026-11-18T00:00:00.000Z",
    mastered: false,
    status: "learning",
    streak: 0,
    nextReviewAt: null,
    errorCause: null,
  };
}

function mockTransport(initial: { attempts?: CloudRow[]; question_progress?: CloudRow[] } = {}): SyncTransport & {
  tables: Record<string, CloudRow[]>;
} {
  const tables: Record<string, CloudRow[]> = {
    attempts: [...(initial.attempts ?? [])],
    question_progress: [...(initial.question_progress ?? [])],
    exam_records_v2: [],
    practice_sessions: [],
    user_preferences: [],
  };
  const key = (row: CloudRow, onConflict: string): string =>
    onConflict
      .split(",")
      .map((c) => String(row[c]))
      .join("::");

  return {
    tables,
    async select(table) {
      return tables[table] ?? [];
    },
    async insertIgnore(table, rows, onConflict) {
      const t = tables[table] ?? (tables[table] = []);
      const seen = new Set(t.map((r) => key(r, onConflict)));
      for (const r of rows) {
        const k = key(r, onConflict);
        if (!seen.has(k)) {
          t.push(r);
          seen.add(k);
        }
      }
    },
    async upsert(table, rows, onConflict) {
      const t = tables[table] ?? (tables[table] = []);
      for (const r of rows) {
        const k = key(r, onConflict);
        const i = t.findIndex((x) => key(x, onConflict) === k);
        if (i >= 0) t[i] = { ...t[i], ...r };
        else t.push(r);
      }
    },
  };
}

describe("全量快照同步", () => {
  it("并集：本地独有 + 云独有，同步后两边都齐", async () => {
    const platform = makePlatform();
    await platform.attempts.append(attempt("a-local", "javaweb:single_choice:001"));

    const cloud = mockTransport({ attempts: [attemptToRow(attempt("a-cloud", "javaweb:single_choice:002"))] });

    await syncAll(cloud, platform);

    const localIds = (await platform.attempts.listByBank("javaweb")).map((a) => a.attemptId).sort();
    const cloudIds = (cloud.tables.attempts ?? []).map((r) => String(r.attempt_id)).sort();
    expect(localIds).toEqual(["a-cloud", "a-local"]);
    expect(cloudIds).toEqual(["a-cloud", "a-local"]);
  });

  it("幂等：连续同步两次不产生重复", async () => {
    const platform = makePlatform();
    await platform.attempts.append(attempt("a1", "javaweb:single_choice:001"));
    const cloud = mockTransport({ attempts: [attemptToRow(attempt("a2", "javaweb:single_choice:002"))] });

    await syncAll(cloud, platform);
    await syncAll(cloud, platform);

    expect(await platform.attempts.listByBank("javaweb")).toHaveLength(2);
    expect(cloud.tables.attempts ?? []).toHaveLength(2);
  });

  it("LWW：云端进度更新（attemptsCount 更大）覆盖本地", async () => {
    const platform = makePlatform();
    await platform.progress.save(progress("javaweb:single_choice:001", 2));

    const cloud = mockTransport({
      question_progress: [
        {
          bank_id: "javaweb",
          question_id: "javaweb:single_choice:001",
          attempts_count: 3,
          wrong_count: 0,
          first_correct_at: null,
          last_attempt_at: "2026-11-18T00:00:00.000Z",
          mastered: false,
          status: "learning",
          streak: 0,
          next_review_at: null,
          error_cause: null,
          note: null,
          updated_at: "2026-11-18T00:00:00.000Z",
        },
      ],
    });

    await syncAll(cloud, platform);

    const local = await platform.progress.get("javaweb", "javaweb:single_choice:001");
    expect(local?.attemptsCount).toBe(3);
  });
});
