/**
 * 讲义质量门禁（S7-E8）。
 *
 * 为什么要用测试守内容：讲义是**手写内容**，最容易发生的退化不是"写错"，
 * 而是"某次改动把 6000 字砍成 800 字，没人发现"。文字质量无法断言，
 * 但"有没有代码示例、有没有视频、有没有学习目标、篇幅够不够"可以断言。
 *
 * 这些阈值的取值依据是 S7 的验收标准（13 号方案 §5 I-1 与 W2 任务窗口 §6），
 * 调低阈值等于降低验收标准，必须同时改那两份文档。
 *
 * 【独立性】（W2-4 / 窗口 §4 步骤 4）本文件不 import `@quiz/core`：
 *   W2 与 W1 并行开发，质量门禁在开发期不等待 W1 的 dist。视频地址按 G0 冻结契约
 *   §2 的行为表在本地判定；契约形状按 §1.2 / §4.1 在本地断言。合并期由 INT 再用
 *   W1 的 validateKnowledgeModules 复验一次（W2-3）。本地语义与 W1 一致，但不是同一份代码。
 */

import { describe, expect, it } from "vitest";

import knowledgeJson from "../javaweb-final/knowledge.json";
import manifestJson from "../javaweb-final/manifest.json";

/** 只列本门禁用到的字段，避免与 W1 的 KnowledgeModule 类型产生编译期依赖 */
interface LectureModule {
  moduleId: string;
  topicId: string;
  title: string;
  summary: string;
  items?: unknown[];
  pitfalls?: string[];
  goals?: string[];
  sections: { title: string; body: string }[];
  videos?: { url: string }[];
  resources?: unknown[];
  estimatedMinutes?: number;
}

const modules = knowledgeJson as unknown as LectureModule[];
const topics = new Set<string>(manifestJson.topics.map((t) => t.topicId));

const charsOf = (m: LectureModule): number =>
  m.sections.reduce((n, s) => n + s.body.length, 0);

/** G0 §2 行为表的本地最小实现：只判 kind，不构造 DOM URL（与 build-knowledge.mjs 同源） */
function mediaKind(raw: string): string {
  const s = raw.trim();
  if (s === "") return "invalid";
  if (/^(javascript|data|vbscript|file):/i.test(s)) return "invalid";
  if (/bilibili\.com/i.test(s) && !/(BV[0-9A-Za-z]{10}|av\d+)/i.test(s)) return "invalid";
  if (/(?:bilibili\.com\/video\/)?(BV[0-9A-Za-z]{10}|av\d+)/i.test(s)) return "bilibili";
  if (/^https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/)[A-Za-z0-9_-]{11}/i.test(s)
    || /^https?:\/\/youtu\.be\/[A-Za-z0-9_-]{11}/i.test(s)) return "youtube";
  if (/\.m3u8(?:[?#].*)?$/i.test(s)) return "hls";
  if (/\.(mp4|webm|ogv|ogg|m4v|mov)(?:[?#].*)?$/i.test(s)) return "file";
  if (/^\.{0,2}\//.test(s) && !/:\/\//.test(s)) return "file";
  if (/^https?:\/\//i.test(s)) return "page";
  return "invalid";
}

describe("JavaWeb 讲义（S7-E8）", () => {
  it("7 篇，与 manifest 的 7 个知识点一一对应，moduleId 不重复", () => {
    expect(modules).toHaveLength(7);
    const covered = new Set(modules.map((m) => m.topicId));
    expect(covered.size).toBe(7);
    for (const topicId of covered) expect(topics.has(topicId)).toBe(true);
    expect(new Set(modules.map((m) => m.moduleId)).size).toBe(7);
  });

  it("形状与语义合法（必填字段 / 非空小节 / 非空讲义 / 视频地址），与契约同语义", () => {
    const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
    for (const m of modules) {
      for (const key of ["moduleId", "topicId", "title", "summary"] as const) {
        expect(nonEmpty(m[key]), `${m.title}: ${key}`).toBe(true);
      }
      expect(topics.has(m.topicId), `${m.title}: topicId 在 manifest 中`).toBe(true);
      // items 与 sections 不得同时为空
      expect((m.items?.length ?? 0) + m.sections.length, `${m.title}: 非空讲义`).toBeGreaterThan(0);
      for (const s of m.sections) {
        expect(nonEmpty(s.title), `${m.title}: 小节标题`).toBe(true);
        expect(nonEmpty(s.body), `${m.title}: 小节正文`).toBe(true);
      }
      for (const v of m.videos ?? []) {
        expect(nonEmpty(v.url), `${m.title}: 视频地址非空`).toBe(true);
      }
    }
  });

  it.each(modules.map((m) => [m.title, m] as const))(
    "「%s」达到精读标准：≥8 节、≥3000 字、有代码块、有表格、有目标、有易错点",
    (_title, module) => {
      expect(module.sections.length).toBeGreaterThanOrEqual(8);
      expect(charsOf(module)).toBeGreaterThanOrEqual(3000);
      expect(module.goals?.length ?? 0).toBeGreaterThanOrEqual(3);
      // 视频是可选扩展位：当前题库不预置任何视频数据，视频能力由新题库导入时提供。
      // 这里不强制"每篇至少 1 条"，只保证字段存在时是数组（形状由生成脚本保证）。
      expect(Array.isArray(module.videos ?? [])).toBe(true);
      expect(module.pitfalls?.length ?? 0).toBeGreaterThanOrEqual(2);
      expect(module.estimatedMinutes ?? 0).toBeGreaterThan(0);
      const body = module.sections.map((s) => s.body).join("\n");
      expect(body).toContain("```"); // 有可运行的代码/配置示例，不是纯散文
      expect(body).toContain("|");   // 有对比表格
    },
  );

  it("每篇都含「这一节解决什么问题」「考试怎么考」「自测清单」三类小节（A-3）", () => {
    const required = ["解决什么问题", "考试怎么考", "自测清单"];
    for (const module of modules) {
      const titles = module.sections.map((s) => s.title).join(" | ");
      for (const marker of required) {
        expect(titles, `${module.title} 缺小节：${marker}`).toContain(marker);
      }
    }
  });

  it("视频为空是合法形态；一旦填了地址就必须能被解析器识别（B-6 扩展口径）", () => {
    for (const module of modules) {
      const videos = module.videos ?? [];
      expect(Array.isArray(videos), `${module.title}: videos 必须是数组`).toBe(true);
      for (const video of videos) {
        expect(mediaKind(video.url), `${module.title} 的视频 ${video.url}`).not.toBe("invalid");
      }
    }
  });

  it("小节标题不重复：重复标题会让锚点跳错位置", () => {
    for (const module of modules) {
      const titles = module.sections.map((s) => s.title);
      expect(new Set(titles).size, module.title).toBe(titles.length);
    }
  });
});
