// @vitest-environment jsdom
/**
 * W3 组件级测试（W3-2）：只测 features/knowledge/** 内的组件，不碰 app.test.tsx。
 *
 * 覆盖契约关键点：
 * - A-4 切篇：点目录项后正文切到对应讲义；
 * - 旧形态讲义（只有 items、无 sections/videos 等）不把整页打崩（W1 契约 default([]) 的 UI 侧兜底）；
 * - B-3 站外视频未点击前不挂 iframe（零第三方请求的结构性证据）；
 * - invalid 地址显示可读 reason，不渲染黑框；
 * - 「去练本节」只回传 topicId，不改其它设置。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeModule, Topic } from "@quiz/core";

import { KnowledgePanel } from "./KnowledgePanel";

afterEach(() => cleanup());

const topics: Topic[] = [
  { topicId: "javaweb:topic:a", bankId: "javaweb", name: "甲主题", order: 0 },
  { topicId: "javaweb:topic:b", bankId: "javaweb", name: "乙主题", order: 1 },
];

/** 旧形态讲义：只有 items，数组新字段全部缺省 —— 模拟未经 Zod 校验的原始数据 */
const legacyModule = {
  moduleId: "javaweb:kb:legacy",
  topicId: "javaweb:topic:a",
  title: "旧讲义",
  summary: "只有要点",
  items: [{ title: "要点一", detail: "细节" }],
} as unknown as KnowledgeModule;

const fullModule: KnowledgeModule = {
  moduleId: "javaweb:kb:full",
  topicId: "javaweb:topic:b",
  title: "新讲义",
  summary: "精读版",
  items: [],
  pitfalls: [],
  goals: ["能说出生命周期"],
  sections: [
    { title: "第一节", body: "正文一" },
    { title: "第二节", body: "正文二" },
  ],
  videos: [
    { url: "https://www.bilibili.com/video/BV1Y7411K7zz", title: "B 站视频" },
    { url: "javascript:alert(1)", title: "坏地址" },
  ],
  resources: [],
};

/** 六节以上才渲染目录（LectureArticle 的 showToc 阈值） */
const tocModule: KnowledgeModule = {
  moduleId: "javaweb:kb:toc",
  topicId: "javaweb:topic:a",
  title: "目录讲义",
  summary: "六节",
  items: [],
  pitfalls: [],
  goals: [],
  sections: Array.from({ length: 6 }, (_, i) => ({ title: `第${i + 1}节`, body: `正文${i + 1}` })),
  videos: [],
  resources: [],
};

/** 直链 mp4 + 起播秒数（契约 §2 第 5 行 → kind=file） */
const mp4Module: KnowledgeModule = {
  moduleId: "javaweb:kb:mp4",
  topicId: "javaweb:topic:a",
  title: "视频讲义",
  summary: "直链",
  items: [],
  pitfalls: [],
  goals: [],
  sections: [],
  videos: [{ url: "https://cdn.example.com/lesson.mp4", title: "直链课", startSec: 30 }],
  resources: [],
};

/** HLS 流（契约 §2 第 7 行 → kind=hls） */
const hlsModule: KnowledgeModule = {
  moduleId: "javaweb:kb:hls",
  topicId: "javaweb:topic:a",
  title: "HLS 讲义",
  summary: "流媒体",
  items: [],
  pitfalls: [],
  goals: [],
  sections: [],
  videos: [{ url: "https://example.com/live/master.m3u8", title: "HLS 课" }],
  resources: [],
};

describe("KnowledgePanel（W3 组件级）", () => {
  it("旧形态讲义缺数组字段时不崩溃，按空数组渲染", () => {
    expect(() =>
      render(
        <KnowledgePanel modules={[legacyModule]} topics={topics} onPractice={vi.fn()} />,
      ),
    ).not.toThrow();
    // 标题在导航项与正文各出现一次（A-4 当前篇常驻可见），用 getAllByText
    expect(screen.getAllByText("旧讲义").length).toBeGreaterThan(0);
  });

  it("A-4：点目录项切换当前篇", () => {
    render(
      <KnowledgePanel modules={[legacyModule, fullModule]} topics={topics} onPractice={vi.fn()} />,
    );
    // 默认显示第一篇
    expect(screen.getAllByText("旧讲义").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("新讲义"));
    expect(screen.getAllByText("新讲义").length).toBeGreaterThan(0);
    // 标题带主题前缀（避免与导航行同名重复命中），断言包含即可
    expect(screen.getAllByRole("heading", { level: 2 })[0]?.textContent).toContain("新讲义");
  });

  it("B-3：站外视频未点击前不挂 iframe", () => {
    const { container } = render(
      <KnowledgePanel modules={[fullModule]} topics={topics} onPractice={vi.fn()} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    const play = screen.getByRole("button", { name: /播放/ });
    fireEvent.click(play);
    expect(container.querySelector("iframe")).not.toBeNull();
  });

  it("invalid 地址显示可读原因，不渲染 iframe", () => {
    const { container } = render(
      <KnowledgePanel modules={[fullModule]} topics={topics} onPractice={vi.fn()} />,
    );
    expect(screen.getByText(/地址无法识别/)).toBeTruthy();
    // 坏地址不会变成可点的播放按钮（只有 B 站那条是按钮）
    expect(screen.getAllByRole("button", { name: /播放/ })).toHaveLength(1);
    expect(container.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("A-6：去练本节只回传 topicId", () => {
    const onPractice = vi.fn();
    render(
      <KnowledgePanel modules={[fullModule]} topics={topics} onPractice={onPractice} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /去练/ }));
    expect(onPractice).toHaveBeenCalledWith("javaweb:topic:b");
  });

  it("A-4：六节以上显示目录，锚点 href 与小节 id 一一对应", () => {
    const { container } = render(
      <KnowledgePanel modules={[tocModule]} topics={topics} onPractice={vi.fn()} />,
    );
    const links = container.querySelectorAll(".lecture-toc a[href^='#sec-']");
    expect(links).toHaveLength(6);
    expect(links[0]?.getAttribute("href")).toBe("#sec-0");
    expect(links[5]?.getAttribute("href")).toBe("#sec-5");
    expect(container.querySelector("section[id='sec-0']")).not.toBeNull();
    expect(container.querySelector("section[id='sec-5']")).not.toBeNull();
  });

  it("B-5：直链 mp4 用原生 video、不挂 iframe，startSec 在 loadedmetadata 后生效", () => {
    const { container } = render(
      <KnowledgePanel modules={[mp4Module]} topics={topics} onPractice={vi.fn()} />,
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("controls")).not.toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    if (video === null) return;
    Object.defineProperty(video, "duration", { value: 100, configurable: true });
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(video.currentTime).toBe(30);
  });

  it("B-3/HLS：HLS 给出浏览器差异提示，原生 video 且无 iframe", () => {
    const { container } = render(
      <KnowledgePanel modules={[hlsModule]} topics={topics} onPractice={vi.fn()} />,
    );
    expect(screen.getByText(/HLS 流在 Safari 可直接播放/)).toBeTruthy();
    expect(container.querySelector("video")).not.toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });
});
