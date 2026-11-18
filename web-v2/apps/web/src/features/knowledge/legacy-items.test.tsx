// @vitest-environment jsdom
/**
 * 旧形态讲义（只有 items）的正文兜底渲染（W3）。
 *
 * 契约里 `items` 是「一句话要点」，旧题库（含 legacy 迁移产物、第二学科）
 * 只有它。UI 若只认 `sections`，旧讲义正文就整块空白——「旧数据零改动可读」
 * 落到 UI 就是这条：items 必须渲染出来。
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeModule, Topic } from "@quiz/core";

import { KnowledgePanel } from "./KnowledgePanel";

afterEach(() => cleanup());

const topics: Topic[] = [
  { topicId: "chem:topic:matter", bankId: "chem", name: "物质的分类", order: 0 },
];

const legacyOnly: KnowledgeModule = {
  moduleId: "chem:knowledge:matter",
  topicId: "chem:topic:matter",
  title: "物质的分类",
  summary: "先分清混合物与纯净物。",
  items: [
    { title: "混合物", detail: "由两种或两种以上物质组成。" },
    { title: "纯净物", detail: "只由一种物质组成。" },
  ],
  pitfalls: ["由同种元素组成的不一定是单质。"],
} as unknown as KnowledgeModule;

describe("旧形态讲义正文兜底", () => {
  it("items 渲染为「要点」正文，不是空白页", () => {
    render(<KnowledgePanel modules={[legacyOnly]} topics={topics} onPractice={vi.fn()} />);
    expect(screen.getByText("要点")).toBeTruthy();
    expect(screen.getByText("混合物")).toBeTruthy();
    expect(screen.getByText(/由两种或两种以上物质组成/)).toBeTruthy();
    expect(screen.getByText("纯净物")).toBeTruthy();
  });

  it("易错点仍然展示；没有 sections 时不渲染「0 节」徽标与空目录", () => {
    const { container } = render(
      <KnowledgePanel modules={[legacyOnly]} topics={topics} onPractice={vi.fn()} />,
    );
    expect(screen.getByText(/由同种元素组成的不一定是单质/)).toBeTruthy();
    expect(screen.queryByText("0 节")).toBeNull();
    expect(container.querySelector(".lecture-toc")).toBeNull();
  });
});
