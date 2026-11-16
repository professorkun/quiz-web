/**
 * 重算对账（S4 §6-F-4 / G4-4 / §9 回退方案第 1 条）的机器证据。
 *
 * 核心等式：**删掉所有派生状态 → 由 Attempt 重算 → 与删除前一致**。
 * 这条等式成立，才敢说"状态坏了不用修，重算即可"。
 */

import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION, type Attempt, type BankContent } from "@quiz/core";
import type { Clock } from "@quiz/platform";
import { createPlatform, MemoryKeyValueStore } from "@quiz/platform-web";

import { recomputeBank, verifyBank } from "./recompute.js";

const clock: Clock = { now: () => new Date("2026-11-16T12:00:00.000Z") };

function bankOf(bankId: string): BankContent {
  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      bankId,
      title: bankId,
      questionCount: 1,
      topics: [{ topicId: `${bankId}:topic:a`, bankId, name: "主题", order: 0 }],
      examTemplates: [],
      createdAt: "2026-11-16T00:00:00.000Z",
    },
    questions: [],
    knowledge: [],
  };
}

const a = bankOf("javaweb");
const b = bankOf("chem");

function attempt(bankId: string, id: string, at: string, correct: boolean): Attempt {
  return {
    attemptId: id,
    bankId,
    questionId: `${bankId}:single_choice:001`,
    questionRevision: "000000000001",
    mode: "practice",
    isFirstAttempt: id.endsWith("-1"),
    startedAt: at,
    submittedAt: at,
    answer: "a",
    correct,
    score: correct ? 5 : 0,
    maxScore: 5,
    sessionId: `s-${id}`,
  };
}

async function setup() {
  const platform = createPlatform({
    kv: new MemoryKeyValueStore(),
    builtinBanks: [a, b],
    clock,
  });
  await platform.attempts.appendMany([
    attempt("javaweb", "a-1", "2026-11-16T01:00:00.000Z", false),
    attempt("javaweb", "a-2", "2026-11-17T01:00:00.000Z", true),
    attempt("chem", "b-1", "2026-11-16T02:00:00.000Z", true),
  ]);
  await recomputeBank(platform, "javaweb");
  await recomputeBank(platform, "chem");
  return platform;
}

describe("重算与对账", () => {
  it("健康数据：verifyBank 报 0 条差异", async () => {
    const platform = await setup();
    const report = await verifyBank(platform, "javaweb");
    expect(report.changed).toBe(0);
  });

  it("派生状态被写坏后能被检出并修复", async () => {
    const platform = await setup();
    const broken = await platform.progress.listByBank("javaweb");
    await platform.progress.save({
      ...broken[0]!,
      wrongCount: 99,
      status: "mastered",
      mastered: true,
    });

    const before = await verifyBank(platform, "javaweb");
    expect(before.changed).toBe(1);

    const fixed = await recomputeBank(platform, "javaweb");
    expect(fixed.changed).toBe(1);
    expect(fixed.identical).toBe(true);
    expect((await verifyBank(platform, "javaweb")).changed).toBe(0);
    expect((await platform.progress.listByBank("javaweb"))[0]?.wrongCount).toBe(1);
  });

  it("清空全部 progress 后重算，与清空前逐项一致（G4-4）", async () => {
    const platform = await setup();
    const before = await platform.progress.listByBank("javaweb");

    await platform.progress.clearByBank("javaweb");
    expect(await platform.progress.listByBank("javaweb")).toHaveLength(0);

    await recomputeBank(platform, "javaweb");
    expect(await platform.progress.listByBank("javaweb")).toEqual(before);
  });

  it("重算只作用于指定题库", async () => {
    const platform = await setup();
    const chemBefore = await platform.progress.listByBank("chem");
    await platform.progress.clearByBank("javaweb");
    await platform.progress.clearByBank("chem");

    await recomputeBank(platform, "javaweb");

    expect(await platform.progress.listByBank("javaweb")).toHaveLength(1);
    expect(await platform.progress.listByBank("chem")).toHaveLength(0);
    expect(chemBefore).toHaveLength(1);
  });
});
