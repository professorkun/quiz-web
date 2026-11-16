// @vitest-environment jsdom
/**
 * 集成判据（方案 §5「可运行的练习页：能选范围并连续作答 10 题」+ §6-B 刷新恢复）。
 *
 * 用演示题库跑真实组件交互，不 mock 引擎：选题、判分、会话保存全部走实际代码。
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { demoBank } from "../data/demoBank";
import { PracticePage } from "./PracticePage";

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

/** 按当前渲染出的控件作答：选择点第一个、填空/代码填空填第一个、简答写一句 */
function answerCurrent(container: HTMLElement): void {
  const option = container.querySelector<HTMLButtonElement>(".opts .optbtn");
  if (option !== null) {
    fireEvent.click(option);
    return;
  }
  const judge = container.querySelector<HTMLButtonElement>(".tf .tfb");
  if (judge !== null) {
    fireEvent.click(judge);
    return;
  }
  const input = container.querySelector<HTMLInputElement>(".blankin");
  if (input !== null) {
    fireEvent.change(input, { target: { value: "POOLED" } });
    return;
  }
  const textarea = container.querySelector<HTMLTextAreaElement>(".answer-text");
  if (textarea !== null) {
    fireEvent.change(textarea, { target: { value: "我的作答要点" } });
    return;
  }
  throw new Error("当前题目没有可作答控件");
}

describe("练习页集成", () => {
  it("开始练习后可连续作答 10 题，最后显示完成统计", () => {
    const { container } = render(<PracticePage bank={demoBank} />);
    fireEvent.click(screen.getByText("开始练习"));

    for (let index = 0; index < 10; index++) {
      expect(container.querySelector(".feedback")).toBeNull();
      answerCurrent(container);
      fireEvent.click(screen.getByText("提交答案"));
      expect(container.querySelector(".feedback"), `第 ${index + 1} 题提交后应有反馈`).not.toBeNull();
      if (index < 9) fireEvent.click(screen.getByText("下一题"));
    }

    expect(screen.getByText("本轮完成")).toBeTruthy();
    expect(screen.getByText(/答对 \d+/)).toBeTruthy();
  });

  it("刷新后仍在同一题，已答状态与选项顺序保持一致", async () => {
    const first = render(<PracticePage bank={demoBank} />);
    fireEvent.click(screen.getByText("开始练习"));
    answerCurrent(first.container);
    fireEvent.click(screen.getByText("提交答案"));

    const feedbackBefore = first.container.querySelector(".feedback")?.textContent ?? "";
    const stemBefore = first.container.querySelector(".stem")?.textContent ?? "";
    expect(feedbackBefore).not.toBe("");
    first.unmount();

    const second = render(<PracticePage bank={demoBank} />);
    await waitFor(() => expect(second.container.querySelector(".feedback")).not.toBeNull());
    expect(second.container.querySelector(".stem")?.textContent).toBe(stemBefore);
    expect(second.container.querySelector(".feedback")?.textContent).toBe(feedbackBefore);
    expect(screen.getByText(/第 1 \/ 10 题/)).toBeTruthy();
  });

  it("提交后按钮锁定，答案不能被改写", () => {
    const { container } = render(<PracticePage bank={demoBank} />);
    fireEvent.click(screen.getByText("开始练习"));
    answerCurrent(container);
    fireEvent.click(screen.getByText("提交答案"));

    const submit = screen.getByText("提交答案") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const option = container.querySelector<HTMLButtonElement>(".opts .optbtn");
    if (option !== null) expect(option.disabled).toBe(true);
  });

  it("筛出空范围时给出明确提示，而不是空白页", () => {
    render(<PracticePage bank={demoBank} />);
    // 演示题库所有题都在「基础」，「进阶」下没有题 → 必须明确提示
    fireEvent.click(screen.getByText("进阶"));
    fireEvent.click(screen.getByText("开始练习"));
    expect(screen.getByText(/没有符合当前筛选条件的题目/)).toBeTruthy();
  });
});
