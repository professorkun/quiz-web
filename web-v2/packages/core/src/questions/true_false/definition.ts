import { TrueFalseQuestionSchema } from "../../schema.js";
import { defineQuestionType } from "../types.js";

/** 判断：契约里 answer 是布尔值，"√/×" 只是展示，不参与存储与判分 */
export const trueFalseDefinition = defineQuestionType({
  type: "true_false",
  label: "判断题",
  schema: TrueFalseQuestionSchema,
  answerKind: "boolean",
  shuffleOptions: false,
  grade: (q, answer, maxScore) => {
    const correct = answer === q.answer;
    return { correct, score: correct ? maxScore : 0, maxScore };
  },
});
