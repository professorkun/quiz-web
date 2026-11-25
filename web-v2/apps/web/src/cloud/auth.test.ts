// @vitest-environment jsdom
/**
 * 云认证动作（M3）：密码登录按标识分派、注册携带密码、未放行域的可读错误。
 * 不依赖真实 SDK 与验证码，client / config 全部 mock。
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  client: {
    auth: {
      signInWithPassword: vi.fn(),
      verifyOtp: vi.fn(),
      sendOtp: vi.fn(),
      getSession: vi.fn(),
    },
  },
  originOk: { value: true },
}));

vi.mock("./client", () => ({
  getCloud: async () => state.client,
}));

vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return { ...actual, probeCloudLoginOrigin: async () => state.originOk.value };
});

import { cloudAuth } from "./auth";

const session = {
  accessToken: "token",
  refreshToken: "refresh",
  expiresAt: Date.now() + 60_000,
  user: { id: "user-1", name: "测试用户", isAnonymous: false },
};

afterEach(() => {
  vi.clearAllMocks();
  state.originOk.value = true;
});

describe("密码登录", () => {
  it("11 位手机号按 phone + password 传给 SDK", async () => {
    state.client.auth.signInWithPassword.mockResolvedValue({ data: session, error: null });
    const user = await cloudAuth.signInWithPassword("13800000000", "pw123456");
    expect(state.client.auth.signInWithPassword).toHaveBeenCalledWith({
      phone: "13800000000",
      password: "pw123456",
    });
    expect(user?.userId).toBe("user-1");
  });

  it("邮箱按 email + password 传给 SDK", async () => {
    state.client.auth.signInWithPassword.mockResolvedValue({ data: session, error: null });
    await cloudAuth.signInWithPassword("a@b.com", "pw123456");
    expect(state.client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pw123456",
    });
  });

  it("当前域未被放行时给出中文可读错误", async () => {
    state.originOk.value = false;
    await expect(cloudAuth.signInWithPassword("13800000000", "pw123456")).rejects.toThrow(
      "未被应用云放行",
    );
    expect(state.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("验证码注册", () => {
  it("isExistingUser=false 时把 password 一并传给 verifyOtp", async () => {
    state.client.auth.verifyOtp.mockResolvedValue({ data: session, error: null });
    await cloudAuth.verifyPhoneOtp("13800000000", "vid-1", false, "123456", "pw123456");
    expect(state.client.auth.verifyOtp).toHaveBeenCalledWith({
      phone: "13800000000",
      verificationId: "vid-1",
      isExistingUser: false,
      token: "123456",
      password: "pw123456",
    });
  });

  it("不传 password 时请求体里没有该字段", async () => {
    state.client.auth.verifyOtp.mockResolvedValue({ data: session, error: null });
    await cloudAuth.verifyPhoneOtp("13800000000", "vid-1", true, "123456");
    expect(state.client.auth.verifyOtp).toHaveBeenCalledWith({
      phone: "13800000000",
      verificationId: "vid-1",
      isExistingUser: true,
      token: "123456",
    });
  });
});
