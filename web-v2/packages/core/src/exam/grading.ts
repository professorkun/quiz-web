/**
 * 整卷判分（S5 · T5-4）：交卷时一次性判完，客观题自动、主观题留自评。
 *
 * 计分口径：
 * - 客观题走 S2 判分器（`gradeAnswer`），**逐空比例分**——应用/代码填空
 *   对 3 空得 3/5（D-4），明细能定位到具体空位（`details.key` = blankId）；
 * - 主观题（简答）自动判分不裁决（`correct: null`），分值交给自评（T5-5）；
 * - 未作答客观题记 0 分且不写 Attempt（未答不是一次作答事件，
 *   避免旧版「没答也进错题本」的缺陷——G2 实测已登记）。
 */

import type { ExamRecordItem, ExamTemplate, Question } from "../schema.js";
import type { AnswerValue } from "../practice/types.js";
import "../questions/index.js";
import { getQuestionType, gradeAnswer } from "../questions/registry.js";
import type { ExamPaperItem } from "./assemble.js";
import { unansweredQuestionIds } from "./session.js";

export interface ExamGradeInput {
  readonly items: readonly ExamPaperItem[];
  readonly questions: readonly Question[];
  readonly answers: Readonly<Record<string, AnswerValue>>;
}

export interface ExamGradeSummary {
  readonly items: readonly ExamRecordItem[];
  /** 客观题（自动判分）合计 */
  readonly objectiveScore: number;
  readonly objectiveMax: number;
  /** 主观题满分（自评对象）；得分由后续自评累加 */
  readonly selfMax: number;
  readonly totalMax: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function gradeExamPaper(input: ExamGradeInput): ExamGradeSummary {
  const { items, questions, answers } = input;
  const byId = new Map(questions.map((q) => [q.questionId, q]));
  const unanswered = new Set(unansweredQuestionIds({ items, answers }, questions));

  const graded: ExamRecordItem[] = [];
  let objectiveScore = 0;
  let objectiveMax = 0;
  let selfMax = 0;

  for (const item of items) {
    const question = byId.get(item.questionId);
    if (question === undefined) {
      throw new Error(`题目 ${item.questionId} 不在当前题库中，无法判分`);
    }
    const def = getQuestionType(question.type);
    const isSubjective = def.selfAssess;
    const answered = !unanswered.has(item.questionId);
    const maxScore = item.maxScore;

    if (isSubjective) {
      selfMax += maxScore;
      graded.push({
        questionId: item.questionId,
        questionRevision: question.revision,
        questionType: question.type,
        sectionId: item.sectionId,
        answered,
        answer: answers[item.questionId] ?? null,
        maxScore,
        score: 0,
        correct: null,
        selfRating: null,
      });
      continue;
    }

    objectiveMax += maxScore;
    if (!answered) {
      graded.push({
        questionId: item.questionId,
        questionRevision: question.revision,
        questionType: question.type,
        sectionId: item.sectionId,
        answered: false,
        answer: answers[item.questionId] ?? null,
        maxScore,
        score: 0,
        correct: false,
        selfRating: null,
      });
      continue;
    }

    const result = gradeAnswer(question, answers[item.questionId], maxScore);
    objectiveScore += result.score;
    graded.push({
      questionId: item.questionId,
      questionRevision: question.revision,
      questionType: question.type,
      sectionId: item.sectionId,
      answered: true,
      answer: answers[item.questionId] ?? null,
      maxScore,
      score: round2(result.score),
      correct: result.correct,
      // 明细是判分器的只读视图，落档时逐字段复制成可序列化的普通数组
      ...(result.details === undefined
        ? {}
        : {
            details: result.details.map((d) => ({
              key: d.key,
              correct: d.correct,
              given: d.given,
              ...(d.accepted === undefined ? {} : { accepted: [...d.accepted] }),
            })),
          }),
      selfRating: null,
    });
  }

  return {
    items: graded,
    objectiveScore: round2(objectiveScore),
    objectiveMax: round2(objectiveMax),
    selfMax: round2(selfMax),
    totalMax: round2(objectiveMax + selfMax),
  };
}

/** 分题型得分汇总：成绩页的「分题型」一栏直接用 */
export function scoreBySection(
  summary: ExamGradeSummary,
): readonly { sectionId: string; score: number; max: number; count: number }[] {
  const map = new Map<string, { sectionId: string; score: number; max: number; count: number }>();
  for (const item of summary.items) {
    const acc = map.get(item.sectionId) ?? {
      sectionId: item.sectionId,
      score: 0,
      max: 0,
      count: 0,
    };
    const selfScore = item.selfRating?.score ?? 0;
    map.set(item.sectionId, {
      sectionId: item.sectionId,
      score: round2(acc.score + item.score + selfScore),
      max: round2(acc.max + item.maxScore),
      count: acc.count + 1,
    });
  }
  return [...map.values()];
}

/** 供校验：模板定义的卷面（判分前自检，D-1「题型数量与模板一致」） */
export function templateOfSection(
  template: ExamTemplate,
  sectionId: string,
): ExamTemplate["sections"][number] | undefined {
  return template.sections.find((s) => s.sectionId === sectionId);
}
