import { describe, expect, it } from "vitest";

import type { Passage, Question } from "@quiz/core";

import { passageForCurrent } from "./passage";

const passage: Passage = {
  passageId: "eng:passage:001",
  title: "A short story",
  body: "Tom is happy.",
};

const q = (id: string, passageId?: string): Question =>
  ({ questionId: id, passageId, type: "single_choice" }) as unknown as Question;

describe("整卷材料只渲染一次（R4-2）", () => {
  const questions = [
    q("eng:cloze:001", passage.passageId),
    q("eng:cloze:002", passage.passageId),
    q("eng:cloze:003", passage.passageId),
    q("eng:cloze:004", passage.passageId),
    q("eng:cloze:005", passage.passageId),
  ];
  const byId = new Map(questions.map((item) => [item.questionId, item]));
  const items = questions.map((item) => ({ questionId: item.questionId }));

  it("5 道小题共享一篇材料：只有第一题拿到材料", () => {
    expect(passageForCurrent(items, "eng:cloze:001", byId, [passage])?.title).toBe("A short story");
    for (const id of ["eng:cloze:002", "eng:cloze:003", "eng:cloze:004", "eng:cloze:005"]) {
      expect(passageForCurrent(items, id, byId, [passage])).toBeUndefined();
    }
  });

  it("没有 passageId 的题不拿材料", () => {
    const plain = q("eng:single_choice:001");
    const map = new Map([[plain.questionId, plain]]);
    expect(
      passageForCurrent([{ questionId: plain.questionId }], plain.questionId, map, [passage]),
    ).toBeUndefined();
  });

  it("材料缺失时返回 undefined，不抛错", () => {
    expect(
      passageForCurrent(items, "eng:cloze:001", byId, undefined),
    ).toBeUndefined();
  });
});
