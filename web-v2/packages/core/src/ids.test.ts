import { describe, expect, it } from "vitest";

import { makeAttemptId } from "./ids.js";

describe("makeAttemptId", () => {
  it("同一会话连续生成不重复：两端续刷同一轮练习不会撞号", () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeAttemptId("s-1-2")));
    expect(ids.size).toBe(50);
  });

  it("保留会话前缀，按轮次排查时能一眼归组", () => {
    expect(makeAttemptId("s-1-2").startsWith("s-1-2-")).toBe(true);
  });
});
