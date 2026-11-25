// @vitest-environment jsdom
/**
 * 账号密码登录（后端数据库）：RPC 调用参数、错误映射、会话过期与退出。
 * 账号服务用 mock 代替，不需要真实数据库。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../cloud/client", () => ({
  getCloud: async () => ({ database: { rpc: mocks.rpc } }),
}));

import { remoteAuth } from "./remoteAuth";

const SESSION_KEY = "quiz.remote.session.v1";

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.localStorage.clear();
});

describe("账号密码登录", () => {
  it("登录成功后写入会话并可读取当前用户", async () => {
    mocks.rpc.mockResolvedValue({
      data: { userId: "user-1", username: "alice" },
      error: null,
    });

    const user = await remoteAuth.login("alice", "pw123456");
    expect(mocks.rpc).toHaveBeenCalledWith("quiz_login", {
      p_username: "alice",
      p_password: "pw123456",
    });
    expect(user.userId).toBe("user-1");
    expect(remoteAuth.currentUser()?.displayName).toBe("alice");
    expect(globalThis.localStorage.getItem(SESSION_KEY)).toContain("user-1");
  });

  it("注册走 quiz_register，并在成功后自动登录", async () => {
    mocks.rpc.mockResolvedValue({
      data: { userId: "user-2", username: "bob" },
      error: null,
    });

    await remoteAuth.register("bob", "pw123456");
    expect(mocks.rpc).toHaveBeenCalledWith("quiz_register", {
      p_username: "bob",
      p_password: "pw123456",
    });
    expect(remoteAuth.currentUser()?.userId).toBe("user-2");
  });

  it("密码错误统一映射为中文，不泄露账号是否存在", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "INVALID_CREDENTIALS" },
    });
    await expect(remoteAuth.login("alice", "wrong")).rejects.toThrow("账号或密码不正确");
    expect(remoteAuth.currentUser()).toBeNull();
  });

  it("重复注册提示直接登录", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "USERNAME_TAKEN" } });
    await expect(remoteAuth.register("alice", "pw123456")).rejects.toThrow("该账号已存在");
  });

  it("数据库函数未部署时给出部署提示", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "PGRST202 Could not find the function public.quiz_login" },
    });
    await expect(remoteAuth.login("alice", "pw123456")).rejects.toThrow("账号服务尚未部署");
  });

  it("注册前校验账号与密码格式", async () => {
    await expect(remoteAuth.register("a", "pw123456")).rejects.toThrow("账号需为");
    await expect(remoteAuth.register("carol", "1234567")).rejects.toThrow("密码至少需要 8 位");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("过期会话视为未登录并清除", () => {
    globalThis.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        userId: "user-1",
        username: "alice",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );
    expect(remoteAuth.currentUser()).toBeNull();
    expect(globalThis.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("退出登录清空会话", async () => {
    mocks.rpc.mockResolvedValue({ data: { userId: "user-1", username: "alice" }, error: null });
    await remoteAuth.login("alice", "pw123456");
    remoteAuth.signOut();
    expect(remoteAuth.currentUser()).toBeNull();
  });
});
