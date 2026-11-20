// @vitest-environment jsdom
/**
 * 完形填空渲染器（R4-2）：
 * 材料只出现一次、题干两个空位、reveal 显示正确答案、词库不洗牌。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { computeRevision, QuestionSchema, type Passage, type Question } from "@quiz/core";

import ClozeRenderer from "./Renderer";
import type { RendererProps } from "../types";

const passage: Passage = {
  passageId: "eng:passage:001",
  title: "A short story",
  body: "Tom is happy and Jerry is sad.",
};

function cloze(): Question {
  const content = {
    schemaVersion: 1,
    type: "cloze",
    bankId: "eng",
    questionId: "eng:cloze:001",
    topicIds: ["eng:topic:001"],
    passageId: "eng:passage:001",
    stem: "Tom is {{b1}} and Jerry is {{b2}}.",
    sharedOptions: [
      { optionId: "o1", text: "happy" },
      { optionId: "o2", text: "sad" },
      { optionId: "o3", text: "calm" },
    ],
    blanks: [
      { blankId: "b1", optionId: "o1" },
      { blankId: "b2", optionId: "o2" },
    ],
    reuseOptions: false,
    legacyKeys: [],
  };
  return QuestionSchema.parse({ ...content, revision: computeRevision(content) });
}

const props = (over: Partial<RendererProps> = {}): RendererProps => ({
  question: cloze(),
  passage,
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

describe("完形填空渲染器（R4-2）", () => {
  it("材料标题只出现一次，题干渲染两个空位", () => {
    const { container } = render(<ClozeRenderer {...props()} />);
    expect(screen.getAllByText("A short story")).toHaveLength(1);
    expect(screen.getByText(/Tom is happy and Jerry is sad\./)).toBeTruthy();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(container.querySelectorAll(".cloze-chip")).toHaveLength(3);
  });

  it("reuseOptions=false：第一个空选过的词在第二个空禁用", () => {
    const onChange = vi.fn();
    render(<ClozeRenderer {...props({ onChange, answer: { b1: "o1" } })} />);
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const options = Array.from(selects[1]!.options);
    const used = options.find((option) => option.value === "o1");
    expect(used?.disabled).toBe(true);
  });

  it("reveal 时显示每个空的正确答案", () => {
    render(<ClozeRenderer {...props({ locked: true, reveal: true, preview: true })} />);
    expect(screen.getByText("答案：happy")).toBeTruthy();
    expect(screen.getByText("答案：sad")).toBeTruthy();
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects.every((select) => select.disabled)).toBe(true);
  });

  it("选择后回传 { blankId: optionId }", () => {
    const onChange = vi.fn();
    render(<ClozeRenderer {...props({ onChange })} />);
    fireEvent.change(screen.getAllByRole("combobox")[0]!, { target: { value: "o3" } });
    expect(onChange).toHaveBeenCalledWith({ b1: "o3" });
  });
});
