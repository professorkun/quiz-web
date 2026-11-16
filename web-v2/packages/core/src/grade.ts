/**
 * 兼容入口（S1 的 T1-8 判分器雏形 → S2 的注册表）。
 *
 * S1 的调用方与单测仍 import 这里的 `gradeQuestion` / `normalizeAnswer`；
 * 实现已整体迁到 `questions/` 各题型目录，本文件只做委托，不再包含任何判分规则。
 * 这是 T2-1 的关键：`switch (q.type)` 从公共入口消失，判分规则各自归位。
 */

import type { Question } from "./schema.js";
import "./questions/index.js";
import { gradeAnswer } from "./questions/registry.js";

export { normalizeAnswer, matchesAccepted, asAnswerRecord } from "./questions/normalize.js";
export type { GradeResult, GradeDetail, AnswerKind } from "./questions/types.js";

/** @deprecated 新代码请直接用 `gradeAnswer`；保留此名以兼容 S1 调用方 */
export function gradeQuestion(question: Question, answer: unknown, maxScore = 1) {
  return gradeAnswer(question, answer, maxScore);
}
