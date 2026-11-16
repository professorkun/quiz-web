/**
 * Web 端入口（占位）。
 *
 * T1-1 只要求「可 `pnpm -r build` 的空骨架」，所以这里暂时不引入 React：
 * 先让分层边界能编译通过，S2 再换 React + Vite。
 *
 * 注意：`apps/web` 是**唯一**允许出现 DOM API 的层（tsconfig 里加了 `lib: DOM`），
 * `packages/core` 没有 DOM 类型，越界会直接编译失败——这比靠自觉可靠。
 */

import type { Question, QuestionProgress } from "@quiz/core";
import { computeProgress } from "@quiz/data";
import type { Platform } from "@quiz/platform";

export interface AppContext {
  readonly platform: Platform;
  readonly questions: readonly Question[];
}

export function describeBank(ctx: AppContext): string {
  return `已加载 ${ctx.questions.length} 道题`;
}

/** 供上层（S2 的页面）调用；此处仅为验证各层能连起来编译 */
export function progressOf(
  ctx: AppContext,
  bankId: string,
  questionId: string,
): Promise<QuestionProgress> {
  return ctx.platform.attempts
    .listByQuestion(bankId, questionId)
    .then((attempts) => computeProgress(bankId, questionId, attempts));
}
