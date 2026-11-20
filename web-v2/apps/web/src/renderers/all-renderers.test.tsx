// @vitest-environment jsdom
/**
 * 六类题型渲染器可作答（G2-1 的机器证据）+ 演示题库自身合法性。
 *
 * 演示题库顺序固定：0-1 单选、2-3 多选、4-5 判断、6-7 填空、8-9 代码填空、10-11 简答。
 * 这里用索引取题，避免在页面测试里出现按题型硬分派（扩展点扫描会拦）。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Question } from "@quiz/core";

import { demoBank, demoBankIssues } from "../data/demoBank";
import CodeBlankRenderer from "./code_blank/Renderer";
import FillBlankRenderer from "./fill_blank/Renderer";
import MultipleChoiceRenderer from "./multiple_choice/Renderer";
import ShortAnswerRenderer from "./short_answer/Renderer";
import SingleChoiceRenderer from "./single_choice/Renderer";
import TrueFalseRenderer from "./true_false/Renderer";
import type { RendererProps } from "./types";

const q = (index: number): Question => demoBank.questions[index] as Question;

const props = (question: Question, over: Partial<RendererProps> = {}): RendererProps => ({
  question,
  answer: undefined,
  optionOrder: undefined,
  locked: false,
  grade: undefined,
  selfRating: undefined,
  onChange: vi.fn(),
  onSelfRating: vi.fn(),
  ...over,
});

afterEach(cleanup);

describe("演示题库", () => {
  it("自身通过题库包校验：12 题、六类各 2 道", () => {
    expect(demoBankIssues).toEqual([]);
    expect(demoBank.questions).toHaveLength(12);
    expect(demoBank.questions[0]?.type).toBe("single_choice");
    expect(demoBank.questions[2]?.type).toBe("multiple_choice");
    expect(demoBank.questions[4]?.type).toBe("true_false");
    expect(demoBank.questions[6]?.type).toBe("fill_blank");
    expect(demoBank.questions[8]?.type).toBe("code_blank");
    expect(demoBank.questions[10]?.type).toBe("short_answer");
  });
});

describe("六类渲染器可查看答案（R2）", () => {
  it("单选：展开后标出正确选项，并显示解析", () => {
    const { container } = render(
      <SingleChoiceRenderer {...props(q(0), { preview: true, locked: true, reveal: true })} />,
    );
    expect(container.querySelectorAll(".optbtn.ok")).toHaveLength(1);
    expect(container.querySelector(".reveal-explanation")).not.toBeNull();
  });

  it("多选：展开后标出全部正确选项", () => {
    const { container } = render(
      <MultipleChoiceRenderer {...props(q(2), { preview: true, locked: true, reveal: true })} />,
    );
    expect(container.querySelectorAll(".optbtn.ok").length).toBeGreaterThan(1);
  });

  it("判断：展开后给正确项打标，另一个不打", () => {
    const { container } = render(
      <TrueFalseRenderer {...props(q(4), { preview: true, locked: true, reveal: true })} />,
    );
    expect(container.querySelectorAll(".tfb.ok")).toHaveLength(1);
  });

  it("填空：展开后每个空位显示可接受答案", () => {
    const { container } = render(
      <FillBlankRenderer {...props(q(6), { preview: true, locked: true, reveal: true })} />,
    );
    expect(container.querySelectorAll(".mark").length).toBe(2);
  });

  it("代码填空：展开后标出空位并给出答案版代码", () => {
    const { container } = render(
      <CodeBlankRenderer {...props(q(8), { preview: true, locked: true, reveal: true })} />,
    );
    expect(container.querySelectorAll(".slot.ok").length).toBeGreaterThan(0);
    expect(container.querySelector(".solution")).not.toBeNull();
    expect(container.querySelectorAll(".blank-row .mark").length).toBeGreaterThan(0);
  });

  it("简答：展开后显示参考答案，但不出现自评按钮（不产生评分）", () => {
    const { container } = render(
      <ShortAnswerRenderer {...props(q(10), { preview: true, locked: true, reveal: true })} />,
    );
    expect(screen.getByText(/参考答案/)).toBeTruthy();
    expect(container.querySelectorAll(".self-btn")).toHaveLength(0);
  });
});

describe("六类渲染器可作答", () => {
  it("单选：选项数正确，点击回传 optionId", () => {
    const onChange = vi.fn();
    const question = q(0);
    const { container } = render(<SingleChoiceRenderer {...props(question, { onChange })} />);
    const buttons = container.querySelectorAll(".optbtn");
    expect(buttons).toHaveLength(4);
    fireEvent.click(buttons[2]!);
    expect(onChange).toHaveBeenCalledWith("o3");
  });

  it("多选：点击回传 optionId 数组", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MultipleChoiceRenderer {...props(q(2), { onChange, answer: [] })} />,
    );
    expect(container.querySelectorAll(".optbtn")).toHaveLength(4);
    fireEvent.click(container.querySelectorAll(".optbtn")[1]!);
    expect(onChange).toHaveBeenCalledWith(["o2"]);
  });

  it("判断：两个按钮，回传布尔值而不是 √/×", () => {
    const onChange = vi.fn();
    const { container } = render(<TrueFalseRenderer {...props(q(4), { onChange })} />);
    const buttons = container.querySelectorAll(".tfb");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    expect(onChange).toHaveBeenCalledWith(true);
    fireEvent.click(buttons[1]!);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("填空：每个 {{blankId}} 一个输入框，按 blankId 存", () => {
    const onChange = vi.fn();
    const question = q(6);
    const { container } = render(<FillBlankRenderer {...props(question, { onChange })} />);
    const inputs = container.querySelectorAll(".blankin");
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[0]!, { target: { value: "POOLED" } });
    expect(onChange).toHaveBeenCalledWith({ b1: "POOLED" });
  });

  it("代码填空：多代码块结构 + 每个定义空位一个输入框 + 标记可定位", () => {
    const onChange = vi.fn();
    const question = q(9);
    const { container } = render(<CodeBlankRenderer {...props(question, { onChange })} />);
    expect(container.querySelectorAll(".code-file").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".slot").length).toBe(2);
    const inputs = container.querySelectorAll(".blankin");
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[0]!, { target: { value: "com.demo.HelloServlet" } });
    expect(onChange).toHaveBeenCalledWith({ "1-1": "com.demo.HelloServlet" });
  });

  it("简答：作答框 + 提交后显示参考答案与三档自评", () => {
    const onSelfRating = vi.fn();
    const question = q(10);
    const { container } = render(
      <ShortAnswerRenderer {...props(question, { locked: true, onSelfRating, answer: "我的答案" })} />,
    );
    expect(container.querySelector(".answer-text")).not.toBeNull();
    expect(screen.getByText(/参考答案/)).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    fireEvent.click(screen.getByText(/没答对/));
    expect(onSelfRating).toHaveBeenCalledWith("none");
  });
});
