/** 练习引擎测试夹具：混合六类题型，供 T2-6 / T2-7 回归用例共用 */

import { computeRevision } from "../revision.js";
import { SCHEMA_VERSION, type Question, type QuestionProgress } from "../schema.js";

export const BANK_ID = "javaweb";

export function makeQuestion(over: Record<string, unknown>): Question {
  return {
    schemaVersion: SCHEMA_VERSION,
    bankId: BANK_ID,
    topicIds: ["t1"],
    stem: "题干",
    revision: computeRevision(over),
    legacyKeys: [],
    ...over,
  } as unknown as Question;
}

const seq = (type: string, n: number): string =>
  `${BANK_ID}:${type}:${String(n).padStart(3, "0")}`;

/** 13 道题：6 单选 / 2 多选 / 2 判断 / 1 填空 / 1 代码填空 / 1 简答 */
export function makeMixedQuestions(revisionTag = 1): Question[] {
  const list: Question[] = [];
  const rev = (id: string): string => computeRevision({ id, tag: revisionTag });
  const topic = (n: number): string[] => (n % 2 === 1 ? ["t1"] : ["t2"]);

  for (let i = 1; i <= 6; i++) {
    const id = seq("single_choice", i);
    list.push(
      makeQuestion({
        type: "single_choice",
        questionId: id,
        topicIds: topic(i),
        stem: `单选 ${i}`,
        options: [
          { optionId: "o1", text: "甲" },
          { optionId: "o2", text: "乙" },
          { optionId: "o3", text: "丙" },
        ],
        answer: "o2",
        revision: rev(id),
      }),
    );
  }
  for (let i = 1; i <= 2; i++) {
    const id = seq("multiple_choice", i);
    list.push(
      makeQuestion({
        type: "multiple_choice",
        questionId: id,
        topicIds: topic(i),
        stem: `多选 ${i}`,
        options: [
          { optionId: "o1", text: "甲" },
          { optionId: "o2", text: "乙" },
          { optionId: "o3", text: "丙" },
        ],
        answer: ["o1", "o3"],
        revision: rev(id),
      }),
    );
  }
  for (let i = 1; i <= 2; i++) {
    const id = seq("true_false", i);
    list.push(
      makeQuestion({
        type: "true_false",
        questionId: id,
        topicIds: topic(i),
        stem: `判断 ${i}`,
        answer: i === 1,
        revision: rev(id),
      }),
    );
  }
  {
    const id = seq("fill_blank", 1);
    list.push(
      makeQuestion({
        type: "fill_blank",
        questionId: id,
        stem: "{{b1}} 是啥",
        blanks: [{ blankId: "b1", accepted: ["Servlet"] }],
        revision: rev(id),
      }),
    );
  }
  {
    const id = seq("code_blank", 1);
    list.push(
      makeQuestion({
        type: "code_blank",
        questionId: id,
        stem: "代码填空",
        files: [{ fileId: "f1", label: "A.java", language: "java", code: "___(c1)___ x;" }],
        blanks: [{ blankId: "c1", fileId: "f1", accepted: ["int"] }],
        revision: rev(id),
      }),
    );
  }
  {
    const id = seq("short_answer", 1);
    list.push(
      makeQuestion({
        type: "short_answer",
        questionId: id,
        stem: "简答题",
        rubric: [
          { pointId: "p1", text: "要点一", score: 2 },
          { pointId: "p2", text: "要点二", score: 3 },
        ],
        revision: rev(id),
      }),
    );
  }
  return list;
}

export function makeProgress(
  questionId: string,
  over: Partial<QuestionProgress> = {},
): QuestionProgress {
  return {
    bankId: BANK_ID,
    questionId,
    attemptsCount: 0,
    wrongCount: 0,
    firstCorrectAt: null,
    lastAttemptAt: null,
    mastered: false,
    status: "new",
    streak: 0,
    nextReviewAt: null,
    errorCause: null,
    ...over,
  };
}
