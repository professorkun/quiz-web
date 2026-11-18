// @vitest-environment jsdom
/**
 * B-4 断网点播放提示 + A-4 刷新后保持当前篇（W3 组件级）。
 *
 * 这两条都是"错误场景"验收：断网时点播放不能挂空 iframe；
 * 刷新后（组件重挂载）要回到同一篇，而不是跳回第一篇。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeModule, Topic } from "@quiz/core";

import { KnowledgePanel } from "./KnowledgePanel";

afterEach(() => {
  cleanup();
  globalThis.sessionStorage?.clear();
});

const topics: Topic[] = [
  { topicId: "javaweb:topic:a", bankId: "javaweb", name: "甲主题", order: 0 },
];

function makeModules(): KnowledgeModule[] {
  return Array.from({ length: 5 }, (_, i) => ({
    moduleId: `javaweb:kb:m${i + 1}`,
    topicId: "javaweb:topic:a",
    title: `第 ${i + 1} 篇`,
    summary: `概要 ${i + 1}`,
    items: [],
    pitfalls: [],
    goals: [],
    sections: [{ title: "第一节", body: "正文" }],
    videos: [{ url: "https://www.bilibili.com/video/BV1Y7411K7zz", title: "配套视频" }],
    resources: [],
  }));
}

function setOnline(value: boolean): void {
  Object.defineProperty(globalThis.navigator, "onLine", {
    value,
    configurable: true,
  });
}

describe("B-4：断网时点播放给「需联网」提示", () => {
  beforeEach(() => setOnline(false));
  afterEach(() => setOnline(true));

  it("断网点播放不挂 iframe，显示需联网提示，正文标题仍在（讲义可读）", () => {
    const { container } = render(
      <KnowledgePanel
        modules={makeModules()}
        topics={topics}
        onPractice={vi.fn()}
        storageKey="javaweb"
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /播放/ }));

    // 不挂 iframe（挂了只会转圈）
    expect(container.querySelector("iframe")).toBeNull();
    // 需联网提示可见
    expect(screen.getByText(/需要联网/)).toBeTruthy();
    // 讲义本体不受影响：标题仍在
    expect(screen.getAllByText("第 1 篇").length).toBeGreaterThan(0);
  });

  it("联网后点播放正常挂 iframe（netHint 不再拦截）", () => {
    setOnline(true);
    const { container } = render(
      <KnowledgePanel modules={makeModules()} topics={topics} onPractice={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /播放/ }));
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(screen.queryByText(/需要联网/)).toBeNull();
  });
});

describe("A-4：刷新（重挂载）后仍在同一篇", () => {
  beforeEach(() => setOnline(true));

  it("选第 5 篇 → 卸载重挂载 → 仍是第 5 篇", () => {
    const modules = makeModules();
    const first = render(
      <KnowledgePanel
        modules={modules}
        topics={topics}
        onPractice={vi.fn()}
        storageKey="javaweb"
      />,
    );
    fireEvent.click(screen.getByText("第 5 篇"));
    expect(
      screen.getAllByRole("heading", { level: 2 })[0]?.textContent,
    ).toContain("第 5 篇");
    first.unmount();

    // 模拟刷新：组件重新挂载，sessionStorage 仍在
    render(
      <KnowledgePanel
        modules={modules}
        topics={topics}
        onPractice={vi.fn()}
        storageKey="javaweb"
      />,
    );
    expect(
      screen.getAllByRole("heading", { level: 2 })[0]?.textContent,
    ).toContain("第 5 篇");
  });

  it("不传 storageKey 时不做持久化，重挂载回第一篇", () => {
    const modules = makeModules();
    const first = render(
      <KnowledgePanel modules={modules} topics={topics} onPractice={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("第 5 篇"));
    first.unmount();

    render(<KnowledgePanel modules={modules} topics={topics} onPractice={vi.fn()} />);
    expect(
      screen.getAllByRole("heading", { level: 2 })[0]?.textContent,
    ).toContain("第 1 篇");
  });

  it("A-7：只写「当前篇」这一条 UI 状态，不落任何学习记录", () => {
    const modules = makeModules();
    const { unmount } = render(
      <KnowledgePanel
        modules={modules}
        topics={topics}
        onPractice={vi.fn()}
        storageKey="javaweb"
      />,
    );
    fireEvent.click(screen.getByText("第 3 篇"));
    fireEvent.click(screen.getByRole("button", { name: /播放/ })); // 交互也不写记录
    unmount();

    // storage 里只有阅读位置本身；localStorage 一条都不许有（学习记录口径 A-7）
    const keys = Object.keys(globalThis.sessionStorage ?? {});
    expect(keys).toEqual(["quiz:lecture:selected:javaweb"]);
    expect(Object.keys(globalThis.localStorage ?? {})).toEqual([]);
  });
});
