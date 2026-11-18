/**
 * 讲义导入校验（S7-E8 · W1）：C-3 / C-4 / W1-3 的机器证据。
 *
 * 三条判据：
 * - C-3 含非法视频字段的题库包**整包拒绝**：哪怕只有第二篇坏，value 也必须为 null，
 *   调用方拿不到任何可写入的值（宁可失败，不要"导入了一半"）
 * - C-4 导出 → 再导入恒等，讲义篇数与小节数不变
 * - W1-3 旧形态讲义（仅 items）、连 knowledge 键都没有的旧包、第二学科题库均不回退
 */

import { describe, expect, it } from "vitest";

import {
  SCHEMA_VERSION,
  type Attempt,
  type BankContent,
  type KnowledgeModule,
  type Question,
} from "@quiz/core";
import type { Clock } from "@quiz/platform";
import { createPlatform, MemoryKeyValueStore } from "@quiz/platform-web";

import { BANK_FILE_KIND, exportBankJson, parseBankJson } from "./snapshot.js";

const clock: Clock = { now: () => new Date("2026-11-18T12:00:00.000Z") };

const question: Question = {
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
};

const manifest = {
  schemaVersion: SCHEMA_VERSION,
  bankId: "javaweb",
  title: "JavaWeb",
  questionCount: 1,
  topics: [{ topicId: "javaweb:topic:a", bankId: "javaweb", name: "主题", order: 0 }],
  examTemplates: [],
  createdAt: "2026-11-18T00:00:00.000Z",
};

/** 新形态：正文小节 + 视频 + 资源 + 六个新字段齐全（键序与 Schema 一致，保证字节恒等） */
const fullModule: KnowledgeModule = {
  moduleId: "javaweb:kb:servlet",
  topicId: "javaweb:topic:a",
  title: "Servlet 生命周期",
  summary: "init、service、destroy 与线程模型",
  items: [{ title: "三个方法", detail: "init 一次、service 多次、destroy 一次" }],
  pitfalls: ["service 是多线程的"],
  goals: ["能复述生命周期"],
  sections: [
    { title: "生命周期", body: "正文一" },
    { title: "线程模型", body: "正文二" },
    { title: "常见坑", body: "正文三" },
  ],
  videos: [{ url: "https://www.bilibili.com/video/BV1Y7411K7zz?p=3", title: "讲解" }],
  resources: [{ title: "规范", url: "https://jakarta.ee/" }],
  estimatedMinutes: 25,
  examFocus: "填空高频",
};

/** 新形态但两个可选字段缺省：缺省必须留空，不能伪造 */
const secondModule: KnowledgeModule = {
  moduleId: "javaweb:kb:jsp",
  topicId: "javaweb:topic:a",
  title: "JSP",
  summary: "内置对象与指令",
  items: [{ title: "四个作用域", detail: "page / request / session / application" }],
  pitfalls: ["getProperty 没有 value 属性"],
  goals: ["能列出九个内置对象"],
  sections: [
    { title: "内置对象", body: "正文" },
    { title: "指令", body: "正文" },
  ],
  videos: [],
  resources: [],
};

const bankWithKnowledge: BankContent = {
  manifest,
  questions: [question],
  knowledge: [fullModule, secondModule],
};

function bankJsonWith(mutation: (json: Record<string, unknown>) => void): string {
  const json = JSON.parse(exportBankJson(bankWithKnowledge)) as Record<string, unknown>;
  mutation(json);
  return JSON.stringify(json);
}

describe("题库包讲义导入（S7-E8）", () => {
  it("导出 → 再导入恒等，讲义篇数与小节数不变（C-4）", () => {
    const text1 = exportBankJson(bankWithKnowledge);
    const r1 = parseBankJson(text1);
    expect(r1.ok).toBe(true);
    expect(r1.value!.knowledge).toHaveLength(2);
    expect(r1.value!.knowledge[0]!.sections).toHaveLength(3);

    const text2 = exportBankJson(r1.value!);
    const r2 = parseBankJson(text2);
    expect(r2.ok).toBe(true);
    expect(r2.value).toEqual(r1.value);
    expect(r2.value!.knowledge).toHaveLength(2);
    expect(r2.value!.knowledge[0]!.sections).toHaveLength(3);
    expect(r2.value!.knowledge[1]!.sections).toHaveLength(2);
    // 恒等变换：再次导出的字节与第一次导出一致
    expect(text2).toBe(text1);
  });

  it("含非法视频字段（缺 url）整包拒绝，value 为 null（C-3）", () => {
    const text = bankJsonWith((json) => {
      const knowledge = json["knowledge"] as Record<string, unknown>[];
      // 第一篇仍然合法、第二篇坏——若 value 非 null 就等于"导入了一半"
      knowledge[1]!["videos"] = [{ title: "缺地址" }];
    });
    const r = parseBankJson(text);
    expect(r.ok).toBe(false);
    expect(r.value).toBeNull();
    expect(r.issues.some((i) => i.path === "knowledge[1].videos.0.url")).toBe(true);
    expect(r.issues.some((i) => i.message.startsWith("[SCHEMA_INVALID]"))).toBe(true);
  });

  it("空讲义（items 与 sections 同空）被拒并定位到 knowledge[i]", () => {
    const text = bankJsonWith((json) => {
      (json["knowledge"] as Record<string, unknown>[]).push({
        moduleId: "javaweb:kb:empty",
        topicId: "javaweb:topic:a",
        title: "空壳",
        summary: "没有内容",
      });
    });
    const r = parseBankJson(text);
    expect(r.ok).toBe(false);
    expect(r.value).toBeNull();
    expect(r.issues.some((i) => i.path === "knowledge[2]")).toBe(true);
    expect(r.issues.some((i) => i.message.includes("空壳"))).toBe(true);
  });

  it("导入失败时既有仓储纹丝不动（C-3 的不写入半边）", async () => {
    const platform = createPlatform({ kv: new MemoryKeyValueStore(), builtinBanks: [], clock });
    const attempt: Attempt = {
      attemptId: "a-1",
      bankId: "javaweb",
      questionId: "javaweb:single_choice:001",
      questionRevision: "000000000001",
      mode: "practice",
      isFirstAttempt: true,
      startedAt: "2026-11-18T01:00:00.000Z",
      submittedAt: "2026-11-18T01:00:05.000Z",
      answer: "a",
      correct: true,
      score: 5,
      maxScore: 5,
    };
    await platform.attempts.appendMany([attempt]);
    const before = await platform.exportAll();

    const text = bankJsonWith((json) => {
      (json["knowledge"] as Record<string, unknown>[])[1]!["videos"] = [{ title: "缺地址" }];
    });
    const r = parseBankJson(text);
    expect(r.ok).toBe(false);
    expect(r.value).toBeNull();
    expect(await platform.exportAll()).toEqual(before);
  });

  it("旧形态讲义（仅 items）与无讲义旧包照常导入（W1-3）", () => {
    const legacyText = JSON.stringify({
      kind: BANK_FILE_KIND,
      manifest,
      questions: [question],
      knowledge: [
        {
          moduleId: "javaweb:kb:jsp",
          topicId: "javaweb:topic:a",
          title: "JSP",
          summary: "旧版要点",
          items: [{ title: "四个作用域", detail: "page / request / session / application" }],
          pitfalls: ["getProperty 没有 value 属性"],
        },
      ],
    });
    const r = parseBankJson(legacyText);
    expect(r.ok).toBe(true);
    expect(r.value!.knowledge).toHaveLength(1);
    // 新字段补默认空数组，可选标量留空——不伪造数据
    expect(r.value!.knowledge[0]!.sections).toEqual([]);
    expect(r.value!.knowledge[0]!.videos).toEqual([]);
    expect(r.value!.knowledge[0]!.resources).toEqual([]);
    expect(r.value!.knowledge[0]!.goals).toEqual([]);
    expect(r.value!.knowledge[0]!.estimatedMinutes).toBeUndefined();
    expect(r.value!.knowledge[0]!.examFocus).toBeUndefined();

    const r2 = parseBankJson(
      JSON.stringify({ kind: BANK_FILE_KIND, manifest, questions: [question] }),
    );
    expect(r2.ok).toBe(true);
    expect(r2.value!.knowledge).toEqual([]);
  });

  it("第二学科题库（chem）同构导入不回退（W1-3）", () => {
    const chemQuestion: Question = {
      ...question,
      questionId: "chem:single_choice:001",
      bankId: "chem",
      topicIds: ["chem:topic:matter"],
    };
    const r = parseBankJson(
      JSON.stringify({
        kind: BANK_FILE_KIND,
        manifest: {
          schemaVersion: SCHEMA_VERSION,
          bankId: "chem",
          title: "化学基础",
          questionCount: 1,
          topics: [{ topicId: "chem:topic:matter", bankId: "chem", name: "物质", order: 0 }],
          examTemplates: [],
          createdAt: "2026-11-18T00:00:00.000Z",
        },
        questions: [chemQuestion],
        knowledge: [
          {
            moduleId: "chem:kb:matter",
            topicId: "chem:topic:matter",
            title: "物质分类",
            summary: "混合物与纯净物",
            items: [{ title: "分类依据", detail: "是否由同种物质组成" }],
            pitfalls: ["同种元素组成的不一定是纯净物"],
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.value!.knowledge).toHaveLength(1);
    expect(r.value!.knowledge[0]!.title).toBe("物质分类");
  });
});
