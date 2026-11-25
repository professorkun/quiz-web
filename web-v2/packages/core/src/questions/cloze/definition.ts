import { ClozeQuestionSchema } from "../../schema.js";
import { asAnswerRecord } from "../normalize.js";
import { defineQuestionType } from "../types.js";

/**
 * 完形 / 选词 / 七选五（R4-2）。
 *
 * 与 fill_blank 的差别只有两点：答案来自共用选项库，而不是自由输入；
 * 以及 `reuseOptions=false` 时「一个词只能用一次」。
 *
 * 最后这条必须在判分里执行，不能只靠录入时校验：用户完全可以把同一个词
 * 填进两个空。规则是——重复使用的那一次算错，第一次使用不受影响。
 */
export const clozeDefinition = defineQuestionType({
  type: "cloze",
  label: "完形填空",
  schema: ClozeQuestionSchema,
  answerKind: "blanks",
  /** 空位嵌在题干里，页面不能再渲染一遍原文 */
  stemInRenderer: true,
  grade: (q, answer, maxScore) => {
    const given = asAnswerRecord(answer);
    const used = new Set<string>();
    const details = q.blanks.map((blank) => {
      const raw = given[blank.blankId];
      const picked = typeof raw === "string" ? raw : "";
      const duplicated = q.reuseOptions === false && picked !== "" && used.has(picked);
      if (picked !== "") used.add(picked);
      return {
        key: blank.blankId,
        correct: picked === blank.optionId && !duplicated,
        given: picked,
        accepted: [blank.optionId],
      };
    });
    const hit = details.filter((d) => d.correct).length;
    const correct = details.length > 0 && hit === details.length;
    const score = details.length === 0 ? 0 : (maxScore * hit) / details.length;
    return { correct, score, maxScore, details };
  },
});
