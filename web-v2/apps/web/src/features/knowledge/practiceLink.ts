/**
 * 「去练本节」的设置改写（S7-E8 · W3）。
 *
 * 契约（任务窗口 §4.4）：只把 `topicIds` 改成 `[topicId]` 并把 `onlyUnseen`
 * 置 false，其余字段一律不动。抽成纯函数是为了让这条不变式可单测——
 * 页面悄悄改掉用户设好的题量/顺序/题型是最难发现的回归。
 */

import type { PracticeSettings } from "@quiz/core";

export function applyTopicPractice(
  current: PracticeSettings,
  topicId: string,
): PracticeSettings {
  return {
    ...current,
    topicIds: [topicId],
    onlyUnseen: false,
  };
}
