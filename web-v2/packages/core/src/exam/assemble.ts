/**
 * 组卷器（S5 · T5-2）：按模板抽题，纯 TS、种子可复现。
 *
 * 三条硬要求，对应 §6-E 的不可接受情形：
 * 1. 题量、总分、题型分布**严格**等于模板——只多不少、也不少抽；
 * 2. 题量不足 / 范围为空 → 抛 `PaperAssemblyError`（「可用题目 X < 需要 Y」），
 *    绝不生成残缺试卷照常开始；
 * 3. 同一种子必得同一份卷（题序 + 选项序），供对照与回归。
 *
 * 跨大题共用一个题目池时（两个大题同题型同筛选），按模板顺序依次抽走，
 * 后面的大题按**剩余**池子判够不够——校验器的逐大题检查是必要条件，
 * 这里补上充分条件，两层都过了才出卷。
 */

import type { ExamTemplate, Question } from "../schema.js";
import { buildOptionOrders } from "../practice/engine.js";
import { deriveSeed, rngFrom, shuffleWith } from "../practice/random.js";
import {
  sectionPool,
  shortageMessage,
  validateExamTemplate,
  type TemplateIssue,
} from "./template.js";

export interface ExamPaperItem {
  readonly sectionId: string;
  readonly questionId: string;
  /** 本题满分 = 模板该大题的每题分值 */
  readonly maxScore: number;
}

export interface ExamPaper {
  readonly templateId: string;
  readonly bankId: string;
  readonly title: string;
  readonly seed: number;
  /** 大题顺序 = 模板顺序；大题内为种子洗牌后的作答顺序 */
  readonly items: readonly ExamPaperItem[];
  readonly optionOrders: Readonly<Record<string, readonly string[]>>;
  readonly questionRevisions: Readonly<Record<string, string>>;
  readonly totalScore: number;
  readonly durationSec?: number;
}

/** 组卷失败：带着可定位的问题列表，UI 直接展示，不再二次解读 */
export class PaperAssemblyError extends Error {
  readonly issues: readonly TemplateIssue[];

  constructor(issues: readonly TemplateIssue[]) {
    super(issues.map((i) => i.message).join("；") || "组卷失败");
    this.name = "PaperAssemblyError";
    this.issues = issues;
  }
}

export interface AssemblePaperInput {
  readonly template: ExamTemplate;
  readonly questions: readonly Question[];
  /** 32 位无符号种子，由调用方生成；同种子同卷 */
  readonly seed: number;
}

export function assemblePaper(input: AssemblePaperInput): ExamPaper {
  const { template, questions, seed } = input;

  // 第一层：模板合法性（含逐大题题量）。不合法的问题一次性全部抛出
  const validation = validateExamTemplate(template, questions);
  if (!validation.ok) throw new PaperAssemblyError(validation.issues);

  // 第二层：跨大题共池时按剩余池子抽，防止两个大题把同一道题抽两次
  const picked: ExamPaperItem[] = [];
  const used = new Set<string>();
  template.sections.forEach((section, index) => {
    const pool = sectionPool(questions, template.bankId, section).filter(
      (q) => !used.has(q.questionId),
    );
    if (pool.length < section.count) {
      throw new PaperAssemblyError([
        {
          code: "POOL_SHORTAGE",
          path: `sections[${index}].count`,
          message: shortageMessage(pool.length, section.count),
        },
      ]);
    }
    const rng = rngFrom(deriveSeed(seed, `exam:${template.templateId}:${section.sectionId}`));
    for (const q of shuffleWith(pool, rng).slice(0, section.count)) {
      used.add(q.questionId);
      picked.push({
        sectionId: section.sectionId,
        questionId: q.questionId,
        maxScore: section.scoreEach,
      });
    }
  });

  const pickedQuestions = picked
    .map((item) => questions.find((q) => q.questionId === item.questionId))
    .filter((q): q is Question => q !== undefined);

  const revisions: Record<string, string> = {};
  for (const q of pickedQuestions) revisions[q.questionId] = q.revision;

  return {
    templateId: template.templateId,
    bankId: template.bankId,
    title: template.title,
    seed,
    items: picked,
    optionOrders: buildOptionOrders(pickedQuestions, seed),
    questionRevisions: revisions,
    totalScore: template.totalScore,
    ...(template.durationSec === undefined ? {} : { durationSec: template.durationSec }),
  };
}

/** 卷面自检：题量与总分严格等于模板（判分前再核一次，防止调用方手改 items） */
export function checkPaperMatchesTemplate(paper: ExamPaper, template: ExamTemplate): boolean {
  const bySection = new Map<string, { count: number; score: number }>();
  for (const item of paper.items) {
    const acc = bySection.get(item.sectionId) ?? { count: 0, score: 0 };
    bySection.set(item.sectionId, { count: acc.count + 1, score: acc.score + item.maxScore });
  }
  if (bySection.size !== template.sections.length) return false;
  for (const section of template.sections) {
    const acc = bySection.get(section.sectionId);
    if (acc === undefined) return false;
    if (acc.count !== section.count) return false;
    if (Math.abs(acc.score - section.count * section.scoreEach) > 1e-9) return false;
  }
  const total = paper.items.reduce((sum, item) => sum + item.maxScore, 0);
  return Math.abs(total - template.totalScore) <= 1e-9;
}
