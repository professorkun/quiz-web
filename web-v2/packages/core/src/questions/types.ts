/**
 * 题型扩展点：三段式定义（Schema + Grader + 渲染元数据），S2 / T2-1。
 *
 * 为什么要有这一层：S1 的 `grade.ts` 是一个 `switch (q.type)`，
 * 每加一种题型就要改动"公共判分入口"；页面里再写一个同样的 switch，
 * 扩展点就彻底散了。这里把"一种题型的全部知识"收进一个对象，
 * 页面只认 `type`，永远不写 `if (q.type === ...)`。
 *
 * 约束（ADR-0002）：本文件与 registry 都在 `core`，不得出现 React / DOM / IO。
 * React 渲染器放在 `apps/web/src/renderers/<type>/`，由 Vite 自动发现。
 */

import type { z } from "zod";

import type { Question } from "../schema.js";

/** 作答形态。会话只按这几种形状序列化，避免把展示字母卷进来 */
export type AnswerKind = "optionId" | "optionIds" | "boolean" | "blanks" | "text" | "custom";

/** 逐空/逐项明细：代码填空要能定位到「第几个空错了」 */
export interface GradeDetail {
  /** blankId / optionId / pointId */
  readonly key: string;
  readonly correct: boolean | null;
  readonly given: string;
  readonly accepted?: readonly string[];
}

export interface GradeResult {
  /** `null` = 无法自动判定，交给自评，不参与对错统计 */
  readonly correct: boolean | null;
  readonly score: number;
  readonly maxScore: number;
  readonly details?: readonly GradeDetail[];
}

/** 内置题型拿到精确的判别联合成员；自定义题型退化为 Question，便于扩展 */
export type QuestionOf<T extends string> = T extends Question["type"]
  ? Extract<Question, { type: T }>
  : Question;

export interface AnyQuestionTypeDefinition {
  readonly type: string;
  readonly label: string;
  /** 该题型自己的 Zod Schema（S1 判别联合的成员），用于按题型校验形状 */
  readonly schema: z.ZodTypeAny;
  readonly answerKind: AnswerKind;
  /** 选项是否参与可复现洗牌（判断题固定两项，不洗） */
  readonly shuffleOptions: boolean;
  /** 是否需要自评档位（简答题） */
  readonly selfAssess: boolean;
  /**
   * 题干是否由渲染器自己渲染（填空题要把输入框嵌进题干文本，页面不能再画一遍原文）。
   * 这是一条声明式元数据，页面据此决定是否渲染通用题干，不做题型判断。
   */
  readonly stemInRenderer: boolean;
  /** 纯函数：无副作用、不读环境、相同输入必得相同输出 */
  readonly grade: (question: Question, answer: unknown, maxScore: number) => GradeResult;
}

export interface QuestionTypeDefinition<T extends string> {
  readonly type: T;
  readonly label: string;
  readonly schema: z.ZodTypeAny;
  readonly answerKind: AnswerKind;
  readonly shuffleOptions?: boolean;
  readonly selfAssess?: boolean;
  readonly stemInRenderer?: boolean;
  readonly grade: (question: QuestionOf<T>, answer: unknown, maxScore: number) => GradeResult;
}

/**
 * 定义一个题型。泛型保留精确题目类型，返回值擦除成统一的注册项。
 * 这是唯一允许把「具体题型」接入系统的入口。
 */
export function defineQuestionType<const T extends string>(
  def: QuestionTypeDefinition<T>,
): AnyQuestionTypeDefinition {
  return {
    type: def.type,
    label: def.label,
    schema: def.schema,
    answerKind: def.answerKind,
    shuffleOptions: def.shuffleOptions ?? false,
    selfAssess: def.selfAssess ?? false,
    stemInRenderer: def.stemInRenderer ?? false,
    grade: def.grade as unknown as AnyQuestionTypeDefinition["grade"],
  };
}
