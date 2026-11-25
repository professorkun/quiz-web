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

function progressRow(
  questionId: string,
  count: number,
  note: string | null,
  updatedAt = "2026-11-18T00:00:00.000Z",
): CloudRow {
  return {
    bank_id: "javaweb",
    question_id: questionId,
    attempts_count: count,
    wrong_count: 0,
    first_correct_at: null,
    last_attempt_at: "2026-11-18T00:00:00.000Z",
    mastered: false,
    status: "learning",
    streak: 0,
    next_review_at: null,
    error_cause: null,
    note,
    updated_at: updatedAt,
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

describe("P0 修复：进度是事件的投影", () => {
  it("备注按字段合并：次数相同，云端备注也能落到本地", async () => {
    const platform = makePlatform();
    await platform.progress.save({ ...progress("javaweb:single_choice:001", 1), note: "本地旧备注" });

    const cloud = mockTransport({
      question_progress: [progressRow("javaweb:single_choice:001", 1, "云端新备注")],
    });
    await syncAll(cloud, platform);

    const local = await platform.progress.get("javaweb", "javaweb:single_choice:001");
    expect(local?.note).toBe("云端新备注");
  });

  it("拉取后按事件重算：写坏的进度会被改回真实次数，手写备注不丢", async () => {
    const platform = makePlatform();
    await platform.attempts.append(attempt("a1", "javaweb:single_choice:001"));
    // 本地进度被写成 5 次，但只有 1 条事件
    await platform.progress.save({ ...progress("javaweb:single_choice:001", 5), note: "手写备注" });

    const cloud = mockTransport({});
    await syncAll(cloud, platform);

    const local = await platform.progress.get("javaweb", "javaweb:single_choice:001");
    expect(local?.attemptsCount).toBe(1);
    expect(local?.note).toBe("手写备注");
    // 推上云的也必须是重算后的值，而不是本地那份坏的
    expect(cloud.tables.question_progress?.[0]?.attempts_count).toBe(1);
  });

  it("没有事件支撑的进度不上云（不把漂移搬给另一台设备）", async () => {
    const platform = makePlatform();
    await platform.attempts.append(attempt("a1", "javaweb:single_choice:001"));
    await platform.progress.save(progress("javaweb:single_choice:001", 1));
    // 孤儿进度：有进度、没有任何作答事件（实测云端 35 条进度只对得上 4 条事件）
    await platform.progress.save(progress("javaweb:single_choice:009", 3));

    const cloud = mockTransport({});
    await syncAll(cloud, platform);

    const pushed = (cloud.tables.question_progress ?? []).map((row) => String(row.question_id));
    expect(pushed).toEqual(["javaweb:single_choice:001"]);
  });

  it("云端事件多于本地且没有进度行时，拉取后能按事件补出进度", async () => {
    const platform = makePlatform();
    const cloud = mockTransport({
      attempts: [
        attemptToRow(attempt("c1", "javaweb:single_choice:002")),
        attemptToRow(attempt("c2", "javaweb:single_choice:002")),
        attemptToRow(attempt("c3", "javaweb:single_choice:002")),
      ],
    });

    await syncAll(cloud, platform);

    const local = await platform.progress.get("javaweb", "javaweb:single_choice:002");
    expect(local?.attemptsCount).toBe(3);
    expect(local?.firstCorrectAt).not.toBeNull();
  });
});

describe("P1：时间戳与墓碑", () => {
  it("本地备注更新更晚时，不被云端旧备注覆盖", async () => {
    const platform = makePlatform();
    // 有事件支撑的进度才会被推上云，所以先造一条作答
    await platform.attempts.append(attempt("a1", "javaweb:single_choice:001"));
    // 本地这条带的是"现在"（测试时钟 2026-11-18），云端是前一天的旧备注
    await platform.progress.save({ ...progress("javaweb:single_choice:001", 1), note: "本地新备注" });

    const cloud = mockTransport({
      question_progress: [
        progressRow("javaweb:single_choice:001", 1, "云端旧备注", "2026-11-17T00:00:00.000Z"),
      ],
    });
    await syncAll(cloud, platform);

    const local = await platform.progress.get("javaweb", "javaweb:single_choice:001");
    expect(local?.note).toBe("本地新备注");
    // 推回云端的也得是本地这条，且时间戳不能被"推送时刻"覆盖
    expect(cloud.tables.question_progress?.[0]?.note).toBe("本地新备注");
    expect(cloud.tables.question_progress?.[0]?.updated_at).toBe("2026-11-18T00:00:00.000Z");
  });

  it("取消收藏以墓碑同步出去，不靠云端并集复活", async () => {
    const platform = makePlatform();
    await platform.favorites.add("javaweb", "javaweb:single_choice:001", "2026-11-17T00:00:00.000Z");
    await platform.favorites.remove("javaweb", "javaweb:single_choice:001");

    const cloud = mockTransport({});
    await syncAll(cloud, platform);

    const pushed = (cloud.tables.user_preferences?.[0]?.favorites ?? []) as { removedAt?: string }[];
    expect(pushed[0]?.removedAt).toBeDefined();
    expect(await platform.favorites.listByBank("javaweb")).toHaveLength(0);
  });

  it("云端墓碑比本地收藏更新时，本地也取消", async () => {
    const platform = makePlatform();
    await platform.favorites.add("javaweb", "javaweb:single_choice:001", "2026-11-17T00:00:00.000Z");

    const cloud = mockTransport({});
    cloud.tables.user_preferences = [
      {
        owner_id: "u-1",
        active_bank_id: null,
        practice: {},
        updated_at: "2026-11-17T00:00:00.000Z",
        favorites: [
          {
            bankId: "javaweb",
            questionId: "javaweb:single_choice:001",
            addedAt: "2026-11-17T00:00:00.000Z",
            removedAt: "2026-11-18T00:00:00.000Z",
          },
        ],
      },
    ];

    await syncAll(cloud, platform);

    expect(await platform.favorites.has("javaweb", "javaweb:single_choice:001")).toBe(false);
  });
});
