/**
 * 「去练本节」设置改写的不变式（W3 · A-6）：
 * 只改 topicIds 与 onlyUnseen，其余偏好一个字段都不许动。
 */

import { describe, expect, it } from "vitest";

import type { PracticeSettings } from "@quiz/core";

import { applyTopicPractice } from "./practiceLink";

const base: PracticeSettings = {
  order: "random",
  topicIds: ["javaweb:topic:a", "javaweb:topic:b"],
  types: ["single_choice", "code_blank"],
  limit: 20,
  onlyUnseen: true,
  onlyUnmastered: true,
  mode: "review",
};

describe("applyTopicPractice（去练本节只改 topicIds）", () => {
  it("topicIds 变成单个目标知识点，onlyUnseen 强制为 false", () => {
    const next = applyTopicPractice(base, "javaweb:topic:servlet");
    expect(next.topicIds).toEqual(["javaweb:topic:servlet"]);
    expect(next.onlyUnseen).toBe(false);
  });

  it("其余字段原样保留（顺序/题型/题量/只刷未掌握/模式）", () => {
    const next = applyTopicPractice(base, "javaweb:topic:servlet");
    expect(next.order).toBe("random");
    expect(next.types).toEqual(["single_choice", "code_blank"]);
    expect(next.limit).toBe(20);
    expect(next.onlyUnmastered).toBe(true);
    expect(next.mode).toBe("review");
  });

  it("不改原对象（纯函数，调用方可能还在用旧引用）", () => {
    applyTopicPractice(base, "javaweb:topic:servlet");
    expect(base.topicIds).toEqual(["javaweb:topic:a", "javaweb:topic:b"]);
    expect(base.onlyUnseen).toBe(true);
  });
});
