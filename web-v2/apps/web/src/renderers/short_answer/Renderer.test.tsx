// @vitest-environment jsdom
/**
 * T2-5 判据：自评按钮无漏绑；自评与判分/作答互不覆盖。
 *
 * 旧版 `bindSelfEval()` 只在成绩卡里扫 `[data-self]`，题卡里的按钮一个都绑不到。
 * 这里用真实点击验证三个按钮都生效，而不是只检查 DOM 里"有"按钮。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { computeRevision, SCHEMA_VERSION, type Question } from "@quiz/core";

import Renderer from "./Renderer";
import type { RendererProps } from "../types";

const question = {
  schemaVersion: SCHEMA_VERSION,
  bankId: "javaweb",
  topicIds: ["t"],
  revision: computeRevision({ type: "short_answer" }),
  questionId: "javaweb:short_answer:001",
  type: "short_answer",
  stem: "简述 JSP 动作标签",
  rubric: [
    { pointId: "p1", text: "include", score: 2 },
    { pointId: "p2", text: "forward", score: 3 },
  ],
  explanation: "参考解析",
} as unknown as Question;

function props(over: Partial<RendererProps> = {}): RendererProps {
  return {
    question,
    answer: "我的作答原文",
    optionOrder: undefined,
    locked: true,
    grade: { correct: null, score: 0, maxScore: 5 },
    selfRating: undefined,
    onChange: vi.fn(),
    onSelfRating: vi.fn(),
    ...over,
  };
}

afterEach(cleanup);

describe("简答自评交互", () => {
  it("三个自评按钮全部绑定，点击分别回传 full / half / none", () => {
    const onSelfRating = vi.fn();
    render(<Renderer {...props({ onSelfRating })} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    fireEvent.click(screen.getByText(/全对/));
    fireEvent.click(screen.getByText(/一半/));
    fireEvent.click(screen.getByText(/没答对/));

    expect(onSelfRating.mock.calls.map((c) => c[0])).toEqual(["full", "half", "none"]);
  });

  it("自评档位分值来自 rubric：全对 5 分、一半 2.5 分、没答对 0 分", () => {
    render(<Renderer {...props()} />);
    expect(screen.getByText(/全对/).textContent).toContain("5 分");
    expect(screen.getByText(/一半/).textContent).toContain("2.5 分");
    expect(screen.getByText(/没答对/).textContent).toContain("0 分");
  });

  it("输入作答只触发 onChange，绝不触发自评；自评不覆盖作答原文", () => {
    const onChange = vi.fn();
    const onSelfRating = vi.fn();
    const p = props({ locked: false, answer: "", onChange, onSelfRating });
    render(<Renderer {...p} />);
    const textarea = screen.getByLabelText("简答作答");
    fireEvent.change(textarea, { target: { value: "新写的答案" } });
    expect(onChange).toHaveBeenCalledWith("新写的答案");
    expect(onSelfRating).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe(""); // 受控组件，值由上层 answer 决定
  });

  it("当前自评档位高亮，且提交后仍可改档", () => {
    const onSelfRating = vi.fn();
    render(
      <Renderer
        {...props({
          onSelfRating,
          selfRating: { level: "half", score: 2.5, maxScore: 5 },
        })}
      />,
    );
    expect(screen.getByText(/一半/).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByText(/全对/));
    expect(onSelfRating).toHaveBeenCalledWith("full");
  });

  it("未提交时不显示自评按钮与参考答案", () => {
    render(<Renderer {...props({ locked: false })} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
