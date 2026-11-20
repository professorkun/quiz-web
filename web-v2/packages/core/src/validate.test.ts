import { describe, expect, it } from "vitest";

import {
  SCHEMA_VERSION,
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
