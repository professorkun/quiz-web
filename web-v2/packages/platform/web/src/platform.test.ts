/**
 * 存储层单测（S3 G3 证据）。
 *
 * 全部在 Node 里用内存键值实现跑**同一份仓储代码**——这正是 ADR-0005 的目的：
 * 实现层如果要靠浏览器特性才能工作，这些用例会直接红。
 *
 * 覆盖的四类判据：
 * - 作答只追加（验收 A「重复作答不覆盖历史」）
 * - 跨库隔离（验收 B「记录完全隔离」）
 * - 收藏独立（验收 C）
 * - 版本闸门与存储不可用（验收 B 最后一条 + 验收 E）
 */

import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION, type Attempt, type BankContent } from "@quiz/core";
import { StorageError, type Clock } from "@quiz/platform";

import { MemoryKeyValueStore, type KeyValueStore } from "./kv.js";
import { createPlatform, LEARNING_SNAPSHOT_VERSION, STORAGE_KEYS } from "./repositories.js";
import { ensureSchemaVersion, META_KEY } from "./schema-version.js";

const fixedClock: Clock = { now: () => new Date("2026-11-16T10:00:00.000Z") };

function makeBank(bankId: string, title: string): BankContent {
  const questionId = `${bankId}:single_choice:001`;
  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      bankId,
      title,
      questionCount: 1,
      topics: [{ topicId: `${bankId}:topic:a`, bankId, name: "主题", order: 0 }],
      examTemplates: [],
      createdAt: "2026-11-16T00:00:00.000Z",
    },
    questions: [
      {
        schemaVersion: SCHEMA_VERSION,
        questionId,
        bankId,
        revision: "000000000001",
        topicIds: [`${bankId}:topic:a`],
        stem: `${title} 的第一题`,
        legacyKeys: [],
        type: "single_choice",
        options: [
          { optionId: "a", text: "选项 A" },
          { optionId: "b", text: "选项 B" },
        ],
        answer: "a",
      },
    ],
    knowledge: [],
  };
}

const BANK_A = makeBank("javaweb", "JavaWeb");
const BANK_B = makeBank("chem", "化学基础");

const qid = (bankId: string): string => `${bankId}:single_choice:001`;

function attemptOf(
  bankId: string,
  attemptId: string,
  correct: boolean,
  submittedAt: string,
  extra: Partial<Attempt> = {},
): Attempt {
  return {
    attemptId,
    bankId,
    questionId: qid(bankId),
    questionRevision: "000000000001",
    mode: "practice",
    isFirstAttempt: attemptId.endsWith("-1"),
    startedAt: submittedAt,
    submittedAt,
    answer: "b",
    correct,
    score: correct ? 5 : 0,
    maxScore: 5,
    sessionId: `s-${bankId}`,
    ...extra,
  };
}

function platformWith(kv: KeyValueStore = new MemoryKeyValueStore()) {
  return { kv, platform: createPlatform({ kv, builtinBanks: [BANK_A, BANK_B], clock: fixedClock }) };
}

describe("作答事件", () => {
  it("同一 attemptId 重复写入不产生副本（幂等）", async () => {
    const { platform } = platformWith();
    const a = attemptOf("javaweb", "a-1", false, "2026-11-16T01:00:00.000Z");
    await platform.attempts.append(a);
    await platform.attempts.append(a);
    expect(await platform.attempts.listByBank("javaweb")).toHaveLength(1);
  });

  it("重复作答保留旧记录，旧记录内容不变", async () => {
    const { platform } = platformWith();
    const first = attemptOf("javaweb", "a-1", false, "2026-11-16T01:00:00.000Z");
    const second = attemptOf("javaweb", "a-2", true, "2026-11-16T02:00:00.000Z", {
      isFirstAttempt: false,
    });
    await platform.attempts.appendMany([first, second]);

    const history = await platform.attempts.listByBank("javaweb");
    expect(history.map((a) => a.attemptId)).toEqual(["a-1", "a-2"]);
    expect(history[0]).toEqual(first);
    // 首次作答标记只落在第一条上，重做不会改写它
    expect(history.filter((a) => a.isFirstAttempt)).toHaveLength(1);
  });

  it("按题查询只返回该题历史", async () => {
    const { platform } = platformWith();
    await platform.attempts.append(attemptOf("javaweb", "a-1", false, "2026-11-16T01:00:00.000Z"));
    await platform.attempts.append(
      attemptOf("javaweb", "a-2", true, "2026-11-16T02:00:00.000Z", {
        questionId: "javaweb:single_choice:001",
      }),
    );
    expect(await platform.attempts.listByQuestion("javaweb", qid("javaweb"))).toHaveLength(2);
    expect(await platform.attempts.listByQuestion("javaweb", "javaweb:single_choice:999")).toHaveLength(
      0,
    );
  });
});

describe("跨库隔离", () => {
  it("A 库的作答不出现在 B 库", async () => {
    const { platform } = platformWith();
    await platform.attempts.append(attemptOf("javaweb", "a-1", false, "2026-11-16T01:00:00.000Z"));

    expect(await platform.attempts.listByBank("javaweb")).toHaveLength(1);
    expect(await platform.attempts.listByBank("chem")).toHaveLength(0);

    await platform.progress.save({
      bankId: "javaweb",
      questionId: qid("javaweb"),
      attemptsCount: 1,
      wrongCount: 1,
      firstCorrectAt: null,
      lastAttemptAt: "2026-11-16T01:00:00.000Z",
      mastered: false,
      status: "learning",
      streak: 0,
      nextReviewAt: "2026-11-17T01:00:00.000Z",
      errorCause: "knowledge_gap",
    });
    expect(await platform.progress.listByBank("chem")).toHaveLength(0);
  });

  it("收藏与练习设置同样按库隔离", async () => {
    const { platform } = platformWith();
    await platform.favorites.add("javaweb", qid("javaweb"), "2026-11-16T01:00:00.000Z");
    await platform.settings.savePractice("javaweb", {
      order: "sequential",
      topicIds: ["javaweb:topic:a"],
      types: [],
      limit: 20,
      onlyUnseen: true,
      onlyUnmastered: false,
      mode: "practice",
    });

    expect(await platform.favorites.listByBank("chem")).toHaveLength(0);
    const chemSettings = await platform.settings.getPractice("chem");
    expect(chemSettings.order).toBe("random");
    expect(chemSettings.topicIds).toEqual([]);
  });

  it("clearLearningData(bankId) 只清该库", async () => {
    const { platform } = platformWith();
    await platform.attempts.append(attemptOf("javaweb", "a-1", false, "2026-11-16T01:00:00.000Z"));
    await platform.attempts.append(attemptOf("chem", "b-1", false, "2026-11-16T01:00:00.000Z"));
    await platform.favorites.add("chem", qid("chem"), "2026-11-16T01:00:00.000Z");

    await platform.clearLearningData("javaweb");

    expect(await platform.attempts.listByBank("javaweb")).toHaveLength(0);
    expect(await platform.attempts.listByBank("chem")).toHaveLength(1);
    expect(await platform.favorites.listByBank("chem")).toHaveLength(1);
  });
});

describe("收藏与进度独立", () => {
  it("进度被重算/覆盖后收藏仍在", async () => {
    const { platform } = platformWith();
    await platform.favorites.add("javaweb", qid("javaweb"), "2026-11-16T01:00:00.000Z");
    await platform.progress.save({
      bankId: "javaweb",
      questionId: qid("javaweb"),
      attemptsCount: 3,
      wrongCount: 0,
      firstCorrectAt: "2026-11-16T02:00:00.000Z",
      lastAttemptAt: "2026-11-16T03:00:00.000Z",
      mastered: true,
      status: "mastered",
      streak: 3,
      nextReviewAt: null,
      errorCause: null,
    });
    // 模拟 S4 的"清空派生状态后重算"
    await platform.progress.clearByBank("javaweb");

    expect(await platform.progress.listByBank("javaweb")).toHaveLength(0);
    expect(await platform.favorites.has("javaweb", qid("javaweb"))).toBe(true);
  });
});

describe("题库注册", () => {
  it("内置题库按注入顺序列出，不能删除也不能被导入覆盖", async () => {
    const { platform } = platformWith();
    expect(await platform.banks.listBankIds()).toEqual(["javaweb", "chem"]);
    await platform.banks.removeImportedBank("javaweb");
    expect(await platform.banks.listBankIds()).toEqual(["javaweb", "chem"]);
    await expect(platform.banks.saveImportedBank(BANK_A)).rejects.toThrow(/内置题库/);
  });

  it("导入的题库出现在列表末尾，并随记录一起隔离", async () => {
    const { platform } = platformWith();
    const imported = makeBank("net", "网络原理");
    await platform.banks.saveImportedBank(imported);

    expect(await platform.banks.listBankIds()).toEqual(["javaweb", "chem", "net"]);
    expect((await platform.banks.listQuestions("net")).length).toBe(1);

    await platform.banks.removeImportedBank("net");
    expect(await platform.banks.listBankIds()).toEqual(["javaweb", "chem"]);
  });

  it("知识讲义随题库走，换库即换内容", async () => {
    const { platform } = platformWith();
    expect(await platform.banks.listKnowledge("javaweb")).toEqual([]);
    await platform.banks.saveImportedBank({
      ...makeBank("net", "网络原理"),
      knowledge: [
        {
          moduleId: "net:m1",
          topicId: "net:topic:a",
          title: "OSI",
          summary: "七层模型",
          items: [{ title: "物理层", detail: "比特流" }],
          pitfalls: [],
        },
      ],
    });
    expect((await platform.banks.listKnowledge("net"))[0]?.moduleId).toBe("net:m1");
    expect(await platform.banks.listKnowledge("javaweb")).toEqual([]);
  });
});

describe("版本与降级", () => {
  it("首次打开写入当前版本号", async () => {
    const kv = new MemoryKeyValueStore();
    await ensureSchemaVersion(kv);
    expect(await kv.get(META_KEY)).toBe("1");
  });

  it("本地数据版本高于代码支持时抛 version 错误，不静默降级", async () => {
    const kv = new MemoryKeyValueStore();
    await kv.set(META_KEY, "99");
    await expect(ensureSchemaVersion(kv)).rejects.toBeInstanceOf(StorageError);
    await expect(ensureSchemaVersion(kv)).rejects.toMatchObject({ kind: "version" });
  });

  it("存储不可写时 info() 给出 writable=false 与可读原因", async () => {
    const broken: KeyValueStore = {
      get: async () => null,
      set: async () => {
        throw new StorageError("quota", "本地存储已满，请先导出备份再清理旧记录");
      },
      delete: async () => undefined,
      keys: async () => [],
      clear: async () => undefined,
      usageBytes: async () => null,
    };
    const platform = createPlatform({ kv: broken, builtinBanks: [BANK_A], clock: fixedClock });
    const info = await platform.info();
    expect(info.writable).toBe(false);
    expect(info.reason).toContain("已满");
  });

  it("损坏的记录被识别为 corrupt，而不是当作空数据跳过", async () => {
    const { kv, platform } = platformWith();
    await kv.set(`${STORAGE_KEYS.attempts("javaweb")}broken-1`, "{不是 json");
    await expect(platform.attempts.listByBank("javaweb")).rejects.toMatchObject({ kind: "corrupt" });
  });
});

describe("导出快照", () => {
  it("exportAll 汇总各库记录，且含 schemaVersion", async () => {
    const { platform } = platformWith();
    await platform.attempts.append(attemptOf("javaweb", "a-1", false, "2026-11-16T01:00:00.000Z"));
    await platform.attempts.append(attemptOf("chem", "b-1", true, "2026-11-16T01:30:00.000Z"));
    await platform.favorites.add("chem", qid("chem"), "2026-11-16T01:30:00.000Z");

    const snapshot = await platform.exportAll();
    expect(snapshot.schemaVersion).toBe(LEARNING_SNAPSHOT_VERSION);
    expect(snapshot.attempts).toHaveLength(2);
    expect(snapshot.favorites).toHaveLength(1);
    expect(snapshot.exportedAt).toBe("2026-11-16T10:00:00.000Z");
  });

  it("清空全部记录保留导入的题库", async () => {
    const { platform } = platformWith();
    await platform.banks.saveImportedBank(makeBank("net", "网络原理"));
    await platform.attempts.append(attemptOf("javaweb", "a-1", false, "2026-11-16T01:00:00.000Z"));

    await platform.clearLearningData();

    expect(await platform.attempts.listByBank("javaweb")).toHaveLength(0);
    expect(await platform.banks.listBankIds()).toContain("net");
  });
});
