import { ShortAnswerQuestionSchema } from "../../schema.js";
import { defineQuestionType } from "../types.js";

/**
 * 简答：自动判分返回 `correct: null`（不是 false）。
 * 自评档位由练习页写进会话的 `selfRatings`，与 `answers` 分开存，
 * 绝不覆盖作答原文，也绝不把"没自评"当成答错。
 */
export const shortAnswerDefinition = defineQuestionType({
  type: "short_answer",
  label: "简答题",
  schema: ShortAnswerQuestionSchema,
  answerKind: "text",
  selfAssess: true,
  grade: (_q, _answer, maxScore) => ({ correct: null, score: 0, maxScore }),
});
