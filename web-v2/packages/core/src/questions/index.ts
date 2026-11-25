/**
 * 题型装配清单（**唯一**需要为新题型加一行的地方）。
 *
 * `apps/web` 侧的渲染器由 Vite 的 `import.meta.glob` 自动发现，
 * 新增题型时页面文件、练习页、会话、练习引擎**都不用改**。
 * 详见 `web-v2/docs/adr/0004-question-type-extension.md`。
 */

import { registerQuestionType } from "./registry.js";
import type { AnyQuestionTypeDefinition } from "./types.js";
import { singleChoiceDefinition } from "./single_choice/definition.js";
import { multipleChoiceDefinition } from "./multiple_choice/definition.js";
import { trueFalseDefinition } from "./true_false/definition.js";
import { fillBlankDefinition } from "./fill_blank/definition.js";
import { codeBlankDefinition } from "./code_blank/definition.js";
import { shortAnswerDefinition } from "./short_answer/definition.js";
import { clozeDefinition } from "./cloze/definition.js";

export const BUILTIN_QUESTION_TYPES: readonly AnyQuestionTypeDefinition[] = [
  singleChoiceDefinition,
  multipleChoiceDefinition,
  trueFalseDefinition,
  fillBlankDefinition,
  codeBlankDefinition,
  shortAnswerDefinition,
  clozeDefinition,
];

for (const def of BUILTIN_QUESTION_TYPES) {
  registerQuestionType(def);
}

export {
  singleChoiceDefinition,
  multipleChoiceDefinition,
  trueFalseDefinition,
  fillBlankDefinition,
  codeBlankDefinition,
  shortAnswerDefinition,
  clozeDefinition,
};
