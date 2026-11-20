/**
 * 整卷材料去重（R4-2）：同一篇材料只挂在第一道引用它的题上。
 *
 * 抽成纯函数是为了可测：题目顺序、当前题、题库映射都在参数里，
 * 页面只负责把结果交给渲染器。
 */

import type { Passage, Question } from "@quiz/core";

export function passageForCurrent(
  items: readonly { readonly questionId: string }[],
  currentQuestionId: string,
  questionsById: ReadonlyMap<string, Question>,
  passages: readonly Passage[] | undefined,
): Passage | undefined {
  const question = questionsById.get(currentQuestionId);
  if (question?.passageId === undefined) return undefined;

  const currentIndex = items.findIndex((item) => item.questionId === currentQuestionId);
  const earlierSamePassage = items
    .slice(0, currentIndex < 0 ? 0 : currentIndex)
    .some((item) => questionsById.get(item.questionId)?.passageId === question.passageId);
  if (earlierSamePassage) return undefined;

  return passages?.find((passage) => passage.passageId === question.passageId);
}
