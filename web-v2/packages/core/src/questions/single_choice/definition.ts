import { SingleChoiceQuestionSchema } from "../../schema.js";
import { defineQuestionType } from "../types.js";

/** 单选：只认 optionId，与选项展示顺序、展示字母完全无关 */
export const singleChoiceDefinition = defineQuestionType({
  type: "single_choice",
  label: "单选题",
  schema: SingleChoiceQuestionSchema,
  answerKind: "optionId",
  shuffleOptions: true,
  grade: (q, answer, maxScore) => {
    const correct = answer === q.answer;
    return { correct, score: correct ? maxScore : 0, maxScore };
  },
});
