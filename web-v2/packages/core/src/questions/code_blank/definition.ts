import { CodeBlankQuestionSchema } from "../../schema.js";
import { asAnswerRecord, matchesAccepted } from "../normalize.js";
import { defineQuestionType } from "../types.js";

/**
 * 代码填空：按 `q.blanks` 的 **blankId 定义顺序**逐空判分、部分给分。
 * 代码里同一空位可能出现多次（89 个定义空位 / 97 处标记），
 * 所以分母是定义数、不是标记数；`details.key` 即 blankId，可直接定位到空位。
 * 结构解析见 `./structure.ts`，渲染层不得重排。
 */
export const codeBlankDefinition = defineQuestionType({
  type: "code_blank",
  label: "代码填空",
  schema: CodeBlankQuestionSchema,
  answerKind: "blanks",
  grade: (q, answer, maxScore) => {
    const given = asAnswerRecord(answer);
    const details = q.blanks.map((blank) => ({
      key: blank.blankId,
      correct: matchesAccepted(given[blank.blankId], blank.accepted),
      given: String(given[blank.blankId] ?? ""),
      accepted: blank.accepted,
    }));
    const hit = details.filter((d) => d.correct).length;
    const correct = hit === q.blanks.length;
    const score = q.blanks.length === 0 ? 0 : (maxScore * hit) / q.blanks.length;
    return { correct, score, maxScore, details };
  },
});
