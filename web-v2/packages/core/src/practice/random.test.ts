/** T2-6：随机可复现（ADR-0003 三条判定检查中的第 1 条） */

import { describe, expect, it } from "vitest";

import { deriveSeed, rngFrom, shuffleWith } from "./random.js";

describe("可复现随机", () => {
  it("同一种子产出完全相同的随机序列，不同种子不同", () => {
    const a = rngFrom(20261116);
    const b = rngFrom(20261116);
    const c = rngFrom(20261117);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    const seqC = Array.from({ length: 8 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const n of seqA) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it("不同 namespace 派生出不同子种子，同一 namespace 稳定", () => {
    expect(deriveSeed(7, "qorder:javaweb:random")).toBe(deriveSeed(7, "qorder:javaweb:random"));
    expect(deriveSeed(7, "opts:javaweb:single_choice:001")).not.toBe(
      deriveSeed(7, "qorder:javaweb:random"),
    );
    expect(deriveSeed(7, "opts:x")).not.toBe(deriveSeed(8, "opts:x"));
  });

  it("shuffleWith 不修改入参，只重排；固定种子可复现", () => {
    const input = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const first = shuffleWith(input, rngFrom(99));
    const second = shuffleWith(input, rngFrom(99));
    expect(first).toEqual(second);
    expect([...first].sort()).toEqual([...input].sort());
    expect(input).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });
});
