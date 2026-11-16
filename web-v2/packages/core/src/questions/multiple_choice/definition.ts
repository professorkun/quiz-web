import { MultipleChoiceQuestionSchema } from "../../schema.js";
import { defineQuestionType } from "../types.js";

/**
 * 多选：判分只比较 optionId 集合，先去重后排序。
 * 因此 `["o4","o2"]` 与 `["o2","o4"]`、以及选项展示顺序如何，都不影响结果。
 * 全对才给分（旧版口径），不做部分给分，避免与卷面分值模型冲突。
 */
export const multipleChoiceDefinition = defineQuestionType({
  type: "multiple_choice",
  label: "多选题",
  schema: MultipleChoiceQuestionSchema,
  answerKind: "optionIds",
  shuffleOptions: true,
  grade: (q, answer, maxScore) => {
    const given = Array.isArray(answer) ? [...new Set(answer.map(String))].sort() : [];
    const want = [...new Set(q.answer)].sort();
    const correct = given.length === want.length && given.every((v, i) => v === want[i]);
    return { correct, score: correct ? maxScore : 0, maxScore };
  },
});
