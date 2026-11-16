/**
 * 导入导出单测（S3 验收 C 的机器证据）。
 *
 * 四条判据：
 * - 非法文件被拒，且**没有部分写入**（旧版导入最严重的坑）
 * - 未知字段被拒并指到具体路径，不静默 strip
 * - 导出 → 清空 → 导入，逐项一致（diff 为空）
 * - 同 ID 事件冲突时保留既有记录，不覆盖本机历史
 */

import { describe, expect, it } from "vitest";

import {
  SCHEMA_VERSION,
  type Attempt,
  type BankContent,
  type LearningSnapshot,
} from "@quiz/core";
import { recomputeProgress } from "./progress.js";
import {
  applyLearningSnapshot,
  BANK_FILE_KIND,
  exportBankJson,
  exportLearningJson,
  LEARNING_FILE_KIND,
  mergeLearning,
  parseBankJson,
  parseLearningJson,
} from "./snapshot.js";
import { createPlatform, MemoryKeyValueStore } from "@quiz/platform-web";
import type { Clock } from "@quiz/platform";

const clock: Clock = { now: () => new Date("2026-11-16T12:00:00.000Z") };

const bank: BankContent = {
  manifest: {
    schemaVersion: SCHEMA_VERSION,
    bankId: "javaweb",
    title: "JavaWeb",
    questionCount: 1,
    topics: [{ topicId: "javaweb:topic:a", bankId: "javaweb", name: "主题", order: 0 }],
    examTemplates: [],
    createdAt: "2026-11-16T00:00:00.000Z",
  },
  questions: [
    {
      schemaVersion: SCHEMA_VERSION,
      questionId: "javaweb:single_choice:001",
      bankId: "javaweb",
      revision: "000000000001",
      topicIds: ["javaweb:topic:a"],
      stem: "题干",
      legacyKeys: [],
      type: "single_choice",
      options: [
        { optionId: "a", text: "A" },
        { optionId: "b", text: "B" },
      ],
      answer: "a",
    },
  ],
  knowledge: [],
};

function attempt(id: string, submittedAt: string, correct: boolean): Attempt {
  return {
    attemptId: id,
    bankId: "javaweb",
    questionId: "javaweb:single_choice:001",
    questionRevision: "000000000001",
    mode: "practice",
    isFirstAttempt: id === "a-1",
    startedAt: submittedAt,
    submittedAt,
    answer: "a",
    correct,
    score: correct ? 5 : 0,
    maxScore: 5,
    sessionId: "s-1",
  };
}

function makePlatform() {
  return createPlatform({ kv: new MemoryKeyValueStore(), builtinBanks: [bank], clock });
}

async function seededPlatform() {
  const platform = makePlatform();
  const attempts = [
    attempt("a-1", "2026-11-16T01:00:00.000Z", false),
    attempt("a-2", "2026-11-16T02:00:00.000Z", true),
  ];
  await platform.attempts.appendMany(attempts);
  await platform.progress.saveMany(recomputeProgress(attempts));
  await platform.favorites.add("javaweb", "javaweb:single_choice:001", "2026-11-16T02:00:00.000Z");
  await platform.sessions.save({
    sessionId: "s-1",
    bankId: "javaweb",
    mode: "practice",
    questionIds: ["javaweb:single_choice:001"],
    cursor: 0,
    results: { "javaweb:single_choice:001": "right" },
    startedAt: "2026-11-16T01:00:00.000Z",
    updatedAt: "2026-11-16T02:00:00.000Z",
  });
  await platform.settings.saveApp({
    activeBankId: "javaweb",
    practice: {},
    updatedAt: "2026-11-16T02:00:00.000Z",
  });
  return platform;
}

describe("学习记录解析", () => {
  it("不是 JSON 时给出具体错误", () => {
    const result = parseLearningJson("{不是 json");
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toBe("$");
    expect(result.issues[0]?.message).toContain("JSON");
  });

  it("kind 不符时拒绝", () => {
    const result = parseLearningJson(JSON.stringify({ kind: "quiz.bank", schemaVersion: 1 }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "$.kind")).toBe(true);
  });

  it("未知字段被拒并指到具体条目", async () => {
    const platform = await seededPlatform();
    const snapshot = await platform.exportAll();
    const json = JSON.parse(exportLearningJson(snapshot)) as Record<string, unknown>;
    const attempts = json["attempts"] as Record<string, unknown>[];
    attempts[1]!["foobar"] = 1;

    const result = parseLearningJson(JSON.stringify(json));
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toContain("attempts[1].foobar");
  });

  it("重复 attemptId 被拒（否则合并会静默丢一条）", async () => {
    const platform = await seededPlatform();
    const json = JSON.parse(exportLearningJson(await platform.exportAll())) as Record<string, unknown>;
    const attempts = json["attempts"] as Record<string, unknown>[];
    attempts[1]!["attemptId"] = attempts[0]!["attemptId"];

    const result = parseLearningJson(JSON.stringify(json));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("attemptId 重复"))).toBe(true);
  });

  it("文件版本高于当前支持时拒绝", async () => {
    const platform = await seededPlatform();
    const json = JSON.parse(exportLearningJson(await platform.exportAll())) as Record<string, unknown>;
    json["schemaVersion"] = 99;

    const result = parseLearningJson(JSON.stringify(json));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "$.schemaVersion")).toBe(true);
  });

  it("记录所属题库未安装时给出警告而不是拒绝", async () => {
    const platform = await seededPlatform();
    const text = exportLearningJson(await platform.exportAll());
    const result = parseLearningJson(text, { knownBankIds: ["chem"] });
    expect(result.ok).toBe(true);
    expect(result.warnings.join()).toContain("javaweb");
  });
});

describe("题库包解析", () => {
  it("合法题库包可解析", () => {
    const result = parseBankJson(exportBankJson(bank));
    expect(result.ok).toBe(true);
    expect(result.value?.questions).toHaveLength(1);
  });

  it("题目字段非法时指出题号与字段（验收 F-4）", () => {
    const text = JSON.stringify({
      kind: BANK_FILE_KIND,
      manifest: bank.manifest,
      questions: [
        { ...bank.questions[0], options: [] },
        { ...bank.questions[0], questionId: "javaweb:single_choice:002", options: [] },
      ],
      knowledge: [],
    });
    const result = parseBankJson(text);
    expect(result.ok).toBe(false);
    // 至少能定位到题目，而不是只丢一句"导入失败"
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.path.includes("questions"))).toBe(true);
  });

  it("kind 不符时拒绝", () => {
    const text = JSON.stringify({ kind: LEARNING_FILE_KIND, manifest: {}, questions: [] });
    const result = parseBankJson(text);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "$.kind")).toBe(true);
  });
});

describe("导出 → 清空 → 导入", () => {
  it("记录逐项一致（diff 为空）", async () => {
    const platform = await seededPlatform();
    const before = await platform.exportAll();
    const text = exportLearningJson(before);

    await platform.clearLearningData();
    expect((await platform.exportAll()).attempts).toHaveLength(0);

    const parsed = parseLearningJson(text);
    expect(parsed.ok).toBe(true);
    await applyLearningSnapshot(platform, parsed.value!);

    const after = await platform.exportAll();
    expect(after.attempts).toEqual(before.attempts);
    expect(after.favorites).toEqual(before.favorites);
    expect(after.progress).toEqual(before.progress);
    expect(after.sessions).toEqual(before.sessions);
    expect(after.settings).toEqual(before.settings);
  });

  it("重复导入是幂等的", async () => {
    const platform = await seededPlatform();
    const parsed = parseLearningJson(exportLearningJson(await platform.exportAll()));
    await applyLearningSnapshot(platform, parsed.value!);
    const again = await applyLearningSnapshot(platform, parsed.value!);
    expect(again.attemptsAdded).toBe(0);
    expect((await platform.exportAll()).attempts).toHaveLength(2);
  });
});

describe("合并策略", () => {
  it("同 ID 冲突保留既有记录，并报告冲突", async () => {
    const platform = await seededPlatform();
    const base = await platform.exportAll();

    const tampered: LearningSnapshot = {
      ...base,
      attempts: base.attempts.map((a) => ({ ...a, score: 999 })),
    };
    const merged = mergeLearning(base, tampered);
    expect(merged.stats.attemptsKept).toBe(2);
    expect(merged.stats.conflicts).toHaveLength(2);
    expect(merged.snapshot.attempts[0]?.score).toBe(0);
  });

  it("导入的进度不被采信，由事件重算", async () => {
    const platform = await seededPlatform();
    const base = await platform.exportAll();
    const incoming: LearningSnapshot = {
      ...base,
      attempts: [],
      progress: base.progress.map((p) => ({ ...p, attemptsCount: 99, mastered: true })),
    };
    const merged = mergeLearning(base, incoming);
    expect(merged.snapshot.progress[0]?.attemptsCount).toBe(2);
    // 由事件算出来，不是导入文件说了算；1 次答对只进 reviewing
    expect(merged.snapshot.progress[0]?.mastered).toBe(false);
    expect(merged.snapshot.progress[0]?.status).toBe("reviewing");
    expect(merged.snapshot.progress[0]?.streak).toBe(1);
  });
});
