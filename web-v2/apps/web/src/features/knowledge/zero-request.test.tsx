// @vitest-environment jsdom
/**
 * B-3 结构性证据：站外视频（B 站 / YouTube）未点击前，DOM 里不出现
 * 任何指向第三方的资源引用——iframe、外链 script/img/link、video 全查一遍。
 *
 * 浏览器网络面板实测是最终证据；这条单测保证"组件层不可能在点击前挂外链"，
 * 即使后续有人改坏了挂载时机，CI 也会先红。
 */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeModule, Topic } from "@quiz/core";

import { KnowledgePanel } from "./KnowledgePanel";

afterEach(() => cleanup());

const topics: Topic[] = [
  { topicId: "javaweb:topic:a", bankId: "javaweb", name: "甲主题", order: 0 },
];

const module: KnowledgeModule = {
  moduleId: "javaweb:kb:ext",
  topicId: "javaweb:topic:a",
  title: "站外视频讲义",
  summary: "两条站外视频",
  items: [],
  pitfalls: [],
  goals: [],
  sections: [{ title: "第一节", body: "正文" }],
  videos: [
    { url: "https://www.bilibili.com/video/BV1Y7411K7zz", title: "B 站课" },
    { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "YouTube 课" },
    { url: "https://b23.tv/abc123", title: "短链" },
    { url: "javascript:alert(1)", title: "坏地址" },
  ],
  resources: [{ title: "官方文档", url: "https://tomcat.apache.org/" }],
};

/**
 * 只算"渲染即发请求"的引用：iframe/video/source/img/script 的 src、
 * link 的 href、embed/object 的 data。普通 `<a href>` 是导航链接，
 * 不点不发请求，不算。
 */
function loadableRefs(root: HTMLElement): string[] {
  const hits: string[] = [];
  const selectors: Array<[string, string]> = [
    ["iframe", "src"],
    ["video", "src"],
    ["source", "src"],
    ["img", "src"],
    ["img", "srcset"],
    ["script", "src"],
    ["link", "href"],
    ["embed", "src"],
    ["object", "data"],
  ];
  for (const [tag, attr] of selectors) {
    for (const el of root.querySelectorAll(tag)) {
      const value = el.getAttribute(attr);
      if (value !== null && /^https?:\/\//i.test(value)) hits.push(`${tag}[${attr}]=${value}`);
    }
  }
  return hits;
}

describe("B-3：未点击前零第三方请求（结构性证据）", () => {
  it("挂载后 DOM 不含任何会自动加载的第三方资源引用", () => {
    const { container } = render(
      <KnowledgePanel modules={[module]} topics={topics} onPractice={vi.fn()} />,
    );
    expect(loadableRefs(container)).toEqual([]);
    expect(container.querySelector("iframe")).toBeNull();
    // 拓展阅读的 <a href> 仍在（导航链接不点不发请求）
    expect(container.querySelector("a[href='https://tomcat.apache.org/']")).not.toBeNull();
  });

  it("第三方引用只在点击播放后出现（iframe），其余仍是纯链接", () => {
    const { container } = render(
      <KnowledgePanel modules={[module]} topics={topics} onPractice={vi.fn()} />,
    );
    // 点第一条（B 站）的播放按钮——注意 b23 短链那条是 <a>，只取 <button>
    const buttons = container.querySelectorAll<HTMLButtonElement>("button.video-placeholder");
    fireEvent.click(buttons[0] as Element);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toContain("player.bilibili.com");
    // 第二条 YouTube 仍未激活
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
  });
});
