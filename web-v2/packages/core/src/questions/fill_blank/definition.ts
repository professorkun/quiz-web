import { FillBlankQuestionSchema } from "../../schema.js";
import { asAnswerRecord, matchesAccepted } from "../normalize.js";
import { defineQuestionType } from "../types.js";

/**
 * 普通填空：按空计分，`{ blankId: 文本 }`。
 * 匹配规则见 `normalize.ts` 的 N1–N8 清单与 `misjudgment-blacklist.ts`；
 * 逐空明细写进 `details`，渲染层据此把对错定位到具体空位。
 */
export const fillBlankDefinition = defineQuestionType({
  type: "fill_blank",
  label: "填空题",
  schema: FillBlankQuestionSchema,
  answerKind: "blanks",
  /** 题干里的 {{blankId}} 要就地变成输入框，页面不能再渲染一遍原文 */
  stemInRenderer: true,
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
