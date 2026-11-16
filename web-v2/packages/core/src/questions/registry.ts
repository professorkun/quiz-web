/**
 * 题型注册表（T2-1）。全局唯一分派点：`gradeAnswer` 只查表，不写 switch。
 *
 * 装配清单在 `./index.js`（六个内置题型）。注册表本身不 import 任何具体题型，
 * 这样"注册一个假题型"的测试才能证明扩展点是真的，而不是把六种写死在里面。
 */

import type { Question } from "../schema.js";

import type { AnyQuestionTypeDefinition, GradeResult } from "./types.js";

const registry = new Map<string, AnyQuestionTypeDefinition>();

/** 重复 import 同一份定义是合法的；用不同实现悄悄覆盖则拒绝（避免"改了不生效"） */
export function registerQuestionType(def: AnyQuestionTypeDefinition): void {
  const existing = registry.get(def.type);
  if (existing !== undefined && existing !== def) {
    throw new Error(`题型「${def.type}」已注册，拒绝静默覆盖；请检查装配清单`);
  }
  registry.set(def.type, def);
}

/** 供扩展点回归测试清理现场；生产代码不需要调用 */
export function unregisterQuestionType(type: string): void {
  registry.delete(type);
}

export function hasQuestionType(type: string): boolean {
  return registry.has(type);
}

export function getQuestionType(type: string): AnyQuestionTypeDefinition {
  const def = registry.get(type);
  if (def === undefined) {
    throw new Error(
      `未注册的题型「${type}」。新增题型请在 packages/core/src/questions/<type>/ 加一个目录，并在 index.ts 装配`,
    );
  }
  return def;
}

export function listQuestionTypes(): readonly AnyQuestionTypeDefinition[] {
  return [...registry.values()];
}

/** 判分唯一入口：全部逻辑都在各题型目录的 grader 里 */
export function gradeAnswer(question: Question, answer: unknown, maxScore = 1): GradeResult {
  return getQuestionType(question.type).grade(question, answer, maxScore);
}

/** 按题型自己的 Schema 校验形状（S1 联合层的跨字段校验仍由 QuestionSchema 负责） */
export function validateQuestionShape(question: Question): boolean {
  return getQuestionType(question.type).schema.safeParse(question).success;
}
