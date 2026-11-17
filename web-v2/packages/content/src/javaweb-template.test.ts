/**
 * T5-6 对账：JavaWeb 模板 vs 旧版卷面（`_build/data.json` 的 buildPaper 结构）。
 *
 * 旧版卷面基线（题库网页/index.html `renderExamHome` 的卷面说明 + G2 冒烟 #2）：
 * 选择 15×2=30 · 判断 10×1=10 · 填空 5×2=10 · 简答 4×5=20 · 应用 4 题共 30 → 满分 100 / 共 38 题。
 * 每条断言都是「对账表的一行」，可重跑。
 */

import { describe, expect, it } from "vitest";

import {
  assemblePaper,
  checkPaperMatchesTemplate,
  validateExamTemplate,
  type BankManifest,
  type ExamTemplate,
  type Question,
} from "@quiz/core";

import examTemplatesJson from "../javaweb-final/examTemplates.json";
import manifestJson from "../javaweb-final/manifest.json";
import questionsJson from "../javaweb-final/questions.json";

const templates = examTemplatesJson as unknown as ExamTemplate[];
const manifest = manifestJson as unknown as BankManifest;
const questions = questionsJson as unknown as Question[];

describe("JavaWeb 模板对账（T5-6 / G5-3）", () => {
  const template = templates[0]!;

  it("卷面规模：38 题 / 100 分（与旧版一致）", () => {
    const count = template.sections.reduce((a, s) => a + s.count, 0);
    expect(count).toBe(38);
    expect(template.totalScore).toBe(100);
  });

  it("逐题型数量与分值：15×2 + 10×1 + 5×2 + 4×5 + 4×7.5（旧版 15/10/5/4/4，30-10-10-20-30）", () => {
    expect(template.sections.map((s) => [s.questionType, s.count, s.scoreEach])).toEqual([
      ["single_choice", 15, 2],
      ["true_false", 10, 1],
      ["fill_blank", 5, 2],
      ["short_answer", 4, 5],
      ["code_blank", 4, 7.5],
    ]);
    expect(template.sections.map((s) => s.count * s.scoreEach)).toEqual([30, 10, 10, 20, 30]);
  });

  it("时长已配置：闭卷 120 分钟（G5-1 时长可配置的实证）", () => {
    expect(template.durationSec).toBe(7200);
  });

  it("模板与题库内容校验通过（题量够不够：62/45/27/8/5 对 15/10/5/4/4）", () => {
    const result = validateExamTemplate(template, questions, manifest.topics);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("组卷一次：38 题 / 100 分 / 题型分布严格等于模板（G5-2）", () => {
    const paper = assemblePaper({ template, questions, seed: 20261117 });
    expect(paper.items).toHaveLength(38);
    expect(paper.items.reduce((a, i) => a + i.maxScore, 0)).toBe(100);
    expect(checkPaperMatchesTemplate(paper, template)).toBe(true);
    const byType = new Map<string, number>();
    for (const item of paper.items) {
      const q = questions.find((x) => x.questionId === item.questionId)!;
      byType.set(q.type, (byType.get(q.type) ?? 0) + 1);
    }
    expect(Object.fromEntries(byType)).toEqual({
      single_choice: 15,
      true_false: 10,
      fill_blank: 5,
      short_answer: 4,
      code_blank: 4,
    });
  });

  it("同种子可复现：两份卷逐题一致", () => {
    const a = assemblePaper({ template, questions, seed: 1 });
    const b = assemblePaper({ template, questions, seed: 1 });
    expect(a.items).toEqual(b.items);
  });

  it("清单内嵌模板与 examTemplates.json 一致（单一来源，不漂移）", () => {
    expect(manifest.examTemplates).toEqual(templates);
  });
});
