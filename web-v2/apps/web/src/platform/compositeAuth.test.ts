// @vitest-environment node
/**
 * 组合认证（M3 调整）：账号密码优先、退出清空全部、订阅透传。
 */

import { describe, expect, it, vi } from "vitest";

import type { AuthAdapter, AuthUser } from "@quiz/platform";

import { createCompositeAuthAdapter } from "./compositeAuth";

const user = (userId: string): AuthUser => ({ userId, displayName: userId, isAnonymous: false });

function adapter(over: Partial<AuthAdapter> = {}): AuthAdapter {
  return {
    getUser: async () => null,
    onAuthStateChange: () => () => undefined,
    signOut: async () => undefined,
    ...over,
  };
}

describe("组合认证", () => {
  it("按顺序取第一个非匿名用户", async () => {
    const composite = createCompositeAuthAdapter([
      adapter({ getUser: async () => user("remote") }),
      adapter({ getUser: async () => user("cloud") }),
    ]);
    expect((await composite.getUser())?.userId).toBe("remote");
  });

  it("跳过 null 与匿名用户", async () => {
    const composite = createCompositeAuthAdapter([
      adapter({ getUser: async () => ({ userId: "anon", displayName: null, isAnonymous: true }) }),
      adapter({ getUser: async () => null }),
      adapter({ getUser: async () => user("cloud") }),
    ]);
    expect((await composite.getUser())?.userId).toBe("cloud");
  });

  it("退出登录清空全部，单个失败不影响其它", async () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => {
      throw new Error("cloud offline");
    });
    const third = vi.fn(async () => undefined);
    const composite = createCompositeAuthAdapter([
      adapter({ signOut: first }),
      adapter({ signOut: second }),
      adapter({ signOut: third }),
    ]);

    await composite.signOut();
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    expect(third).toHaveBeenCalled();
  });

  it("登录态订阅透传到所有适配器，并可统一取消", () => {
    const unsubscribes = [vi.fn(), vi.fn()];
    const subscribe = (index: number) => () => unsubscribes[index]!();
    const composite = createCompositeAuthAdapter([
      adapter({ onAuthStateChange: () => subscribe(0) }),
      adapter({ onAuthStateChange: () => subscribe(1) }),
    ]);

    const unsubscribe = composite.onAuthStateChange(() => undefined);
    unsubscribe();
    expect(unsubscribes[0]).toHaveBeenCalled();
    expect(unsubscribes[1]).toHaveBeenCalled();
  });
});
