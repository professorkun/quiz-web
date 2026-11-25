import { describe, expect, it } from "vitest";

import {
  SCHEMA_VERSION,
  computeRevision,
  topLevelKeyHint,
  validateBankPackage,
  validateKnowledgeModules,
} from "./index.js";

/** 一份最小合法题库包：一个知识点、一道单选题 */
function manifest() {
  return {
    schemaVersion: SCHEMA_VERSION,
    bankId: "os_final",
    title: "操作系统期末",
    questionCount: 1,
    topics: [{ topicId: "os_final:topic:001", bankId: "os_final", name: "进程", order: 0 }],
    examTemplates: [],
    createdAt: "2026-11-20T00:00:00.000Z",
  };
}

function question() {
  return {
    schemaVersion: SCHEMA_VERSION,
    questionId: "os_final:single_choice:001",
    bankId: "os_final",
    revision: "000000000001",
    topicIds: ["os_final:topic:001"],
    stem: "以下哪个是进程调度算法？",
    legacyKeys: [],
    type: "single_choice",
    options: [
      { optionId: "o1", text: "FCFS" },
      { optionId: "o2", text: "TCP" },
    ],
    answer: "o1",
  };
}

const courseLinkModule = {
  moduleId: "os_final:kb:001",
  topicId: "os_final:topic:001",
  title: "进程与线程",
  resources: [{ title: "课程回放", url: "https://example.com/lesson/1" }],
};

describe("讲义校验放宽（V2.1 · R1.1）", () => {
  it("只含课程链接的讲义可导入", () => {
    const result = validateKnowledgeModules([courseLinkModule]);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.modules).toHaveLength(1);
  });

  it("summary 缺失也能导入，不伪造概述", () => {
    const result = validateKnowledgeModules([courseLinkModule]);
    expect(result.modules[0]?.summary).toBeUndefined();
  });

  it("讲义未知字段只警告、不拒绝", () => {
    const result = validateKnowledgeModules([
      { ...courseLinkModule, remarks: "老师补充：重点看 3.2 节" },
    ]);
    expect(result.ok).toBe(true);
    expect(result.modules).toHaveLength(1);
    expect(result.warnings.join()).toContain("remarks");
  });

  it("四项皆空的讲义仍然拒绝，并定位到第几篇", () => {
    const result = validateKnowledgeModules([
      courseLinkModule,
      { moduleId: "os_final:kb:002", topicId: "os_final:topic:001", title: "空壳" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.modules).toHaveLength(1);
    expect(result.issues[0]?.path).toBe("knowledge[1]");
    expect(result.issues[0]?.message).toContain("空壳");
  });
});

describe("中文报错与键名提示（V2.1 · R1.1）", () => {
  it("Zod 报错为中文，并带字段路径", () => {
    const broken = { ...manifest(), title: undefined };
    const result = validateBankPackage({ manifest: broken, questions: [] });
    const hit = result.issues.find((issue) => issue.path === "manifest.title");
    expect(hit).toBeDefined();
    expect(hit?.message).toMatch(/应为字符串/);
  });

  it("题目字段类型错误时给出中文与题目路径", () => {
    const broken = { ...question(), stem: 123 };
    const result = validateBankPackage({ manifest: manifest(), questions: [broken] });
    const hit = result.issues.find((issue) => issue.path === "questions[0].stem");
    expect(hit?.message).toMatch(/应为字符串/);
  });

  it("顶层键名写错时提示正确拼写", () => {
    expect(topLevelKeyHint("question")).toContain("questions");
    expect(topLevelKeyHint("bankManifest")).toContain("manifest");
    expect(topLevelKeyHint("whatever")).toContain("只允许");
  });
});

describe("材料与完形（R4-2）", () => {
  const passage = {
    passageId: "os_final:passage:001",
    title: "进程调度短文",
    body: "FCFS 是最简单的调度算法，但可能出现**饥饿**。",
    source: "课程讲义",
  };

  function clozeQuestion(over: Record<string, unknown> = {}) {
    const content = {
      schemaVersion: SCHEMA_VERSION,
      type: "cloze",
      questionId: "os_final:cloze:001",
      bankId: "os_final",
      topicIds: ["os_final:topic:001"],
      passageId: "os_final:passage:001",
      stem: "FCFS 可能造成 {{b1}}，它属于 {{b2}} 调度。",
      sharedOptions: [
        { optionId: "o1", text: "饥饿" },
        { optionId: "o2", text: "非抢占式" },
        { optionId: "o3", text: "抢占式" },
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

  function manifestFor(count: number) {
    return { ...manifest(), questionCount: count };
  }

  it("带 passages 的题库可导入，且材料随结果返回", () => {
    const result = validateBankPackage({
      manifest: manifestFor(1),
      questions: [clozeQuestion()],
      passages: [passage],
    });
    expect(result.ok).toBe(true);
    expect(result.passages).toHaveLength(1);
    expect(result.passages[0]?.title).toBe("进程调度短文");
  });

  it("cloze 缺少 passages 被拒，错误为中文", () => {
    const result = validateBankPackage({
      manifest: manifestFor(1),
      questions: [clozeQuestion()],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("题库缺少 passages"))).toBe(true);
  });

  it("题目引用不存在的材料被拒并定位到题目", () => {
    const result = validateBankPackage({
      manifest: manifestFor(1),
      questions: [clozeQuestion({ passageId: "os_final:passage:404" })],
      passages: [passage],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "UNKNOWN_PASSAGE")).toBe(true);
  });

  it("材料未知字段与重复 ID 都被拒", () => {
    const unknown = validateBankPackage({
      manifest: manifestFor(1),
      questions: [clozeQuestion()],
      passages: [{ ...passage, remarks: "多余" }],
    });
    expect(unknown.ok).toBe(false);
    expect(unknown.issues.some((issue) => issue.code === "UNKNOWN_FIELD")).toBe(true);

    const duplicated = validateBankPackage({
      manifest: manifestFor(1),
      questions: [clozeQuestion()],
      passages: [passage, passage],
    });
    expect(duplicated.ok).toBe(false);
    expect(duplicated.issues.some((issue) => issue.code === "DUP_PASSAGE_ID")).toBe(true);
  });
});

describe("标签与难度进入白名单（V2.1 · R1.5）", () => {
  it("带 tags / difficulty 的题库可导入", () => {
    const tagged = {
      ...question(),
      tags: ["os_final:tag:exam"],
      difficulty: "hard",
    };
    const result = validateBankPackage({ manifest: manifest(), questions: [tagged] });
    expect(result.ok).toBe(true);
    expect(result.questions[0]?.tags).toEqual(["os_final:tag:exam"]);
    expect(result.questions[0]?.difficulty).toBe("hard");
  });

  it("拼错的可选字段仍然拒绝，不放宽成静默忽略", () => {
    const typo = { ...question(), tag: ["os_final:tag:exam"] };
    const result = validateBankPackage({ manifest: manifest(), questions: [typo] });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "UNKNOWN_FIELD")).toBe(true);
  });
});
