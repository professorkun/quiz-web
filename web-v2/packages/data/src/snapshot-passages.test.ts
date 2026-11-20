import { describe, expect, it } from "vitest";

import { computeRevision, SCHEMA_VERSION } from "@quiz/core";

import { exportBankJson, parseBankJson } from "./snapshot.js";

const manifest = {
  schemaVersion: SCHEMA_VERSION,
  bankId: "eng",
  title: "英语完形",
  questionCount: 1,
  topics: [{ topicId: "eng:topic:001", bankId: "eng", name: "完形", order: 0 }],
  examTemplates: [],
  createdAt: "2026-11-20T00:00:00.000Z",
};

const passage = {
  passageId: "eng:passage:001",
  title: "A short story",
  body: "Tom is **happy** today.",
};

function cloze(over: Record<string, unknown> = {}) {
  const content = {
    schemaVersion: SCHEMA_VERSION,
    type: "cloze",
    questionId: "eng:cloze:001",
    bankId: "eng",
    topicIds: ["eng:topic:001"],
    passageId: "eng:passage:001",
    stem: "Tom is {{b1}} and Jerry is {{b2}}.",
    sharedOptions: [
      { optionId: "o1", text: "happy" },
      { optionId: "o2", text: "sad" },
      { optionId: "o3", text: "calm" },
    ],
    blanks: [
      { blankId: "b1", optionId: "o1" },
      { blankId: "b2", optionId: "o2" },
    ],
    reuseOptions: false,
    legacyKeys: [],
    ...over,
  };
  return { ...content, revision: computeRevision(content) };
}

function bankJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: "quiz.bank",
    manifest,
    questions: [cloze()],
    knowledge: [],
    passages: [passage],
    ...over,
  });
}

describe("题库包材料（R4-2）", () => {
  it("带 passages 的包能导入，材料随 BankContent 返回", () => {
    const result = parseBankJson(bankJson());
    expect(result.ok).toBe(true);
    expect(result.value?.passages).toHaveLength(1);
    expect(result.value?.passages?.[0]?.title).toBe("A short story");
    expect(result.value?.questions[0]?.type).toBe("cloze");
  });

  it("cloze 缺 passages 被拒，错误为中文且定位到题目", () => {
    const result = parseBankJson(bankJson({ passages: [] }));
    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes("题库缺少 passages"))).toBe(true);
    expect(result.issues.some((issue) => issue.path === "eng:cloze:001")).toBe(true);
  });

  it("旧包（无 passages、无 cloze）照常导入", () => {
    const legacy = JSON.stringify({
      kind: "quiz.bank",
      manifest: {
        ...manifest,
        questionCount: 1,
      },
      questions: [
        {
          schemaVersion: SCHEMA_VERSION,
          type: "single_choice",
          questionId: "eng:single_choice:001",
          bankId: "eng",
          revision: "000000000001",
          topicIds: ["eng:topic:001"],
          stem: "old",
          legacyKeys: [],
          options: [
            { optionId: "o1", text: "A" },
            { optionId: "o2", text: "B" },
          ],
          answer: "o1",
        },
      ],
      knowledge: [],
    });
    const result = parseBankJson(legacy);
    expect(result.ok).toBe(true);
    expect(result.value?.passages).toEqual([]);
  });

  it("导出再导入保持材料不丢", () => {
    const parsed = parseBankJson(bankJson());
    expect(parsed.ok).toBe(true);
    if (parsed.value === null) return;

    const json = exportBankJson(parsed.value);
    expect(json).toContain('"passages"');
    const again = parseBankJson(json);
    expect(again.ok).toBe(true);
    expect(again.value?.passages).toHaveLength(1);
  });
});
