// @vitest-environment jsdom
/**
 * 本机账号单元用例：注册、登录、会话保持、退出与错误分支。
 * 存储用 jsdom 的 localStorage，正好覆盖真实浏览器里的同一套逻辑。
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  createLocalAuthAdapter,
  loginLocalAccount,
  registerLocalAccount,
} from "./localAuth";

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe("本机账号", () => {
  it("注册后自动登录，刷新会话保留，退出后清除", async () => {
    const user = await registerLocalAccount("alice", "secret123");
    expect(user.displayName).toBe("alice");

    // 新的适配器实例模拟"刷新页面后重新读取会话"
    const adapter = createLocalAuthAdapter();
    expect(await adapter.getUser()).toEqual(user);

    await adapter.signOut();
    expect(await adapter.getUser()).toBeNull();

    const again = await loginLocalAccount("alice", "secret123");
    expect(again.userId).toBe(user.userId);
  });

  it("密码错误与重复账号会被拒绝", async () => {
    await registerLocalAccount("bob", "secret123");
    await expect(loginLocalAccount("bob", "wrong-pass")).rejects.toThrow("账号或密码不正确");
    await expect(registerLocalAccount("BOB", "secret123")).rejects.toThrow("已存在");
  });

  it("校验账号与密码格式", async () => {
    await expect(registerLocalAccount("a", "secret123")).rejects.toThrow("账号");
    await expect(registerLocalAccount("carol", "123")).rejects.toThrow("密码");
  });
});
