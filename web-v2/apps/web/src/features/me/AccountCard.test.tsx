// @vitest-environment jsdom
/**
 * 账号卡片：默认账号密码入口、登录成功、手机注册被已注册手机号拦截。
 * 后端账号动作、平台上下文与域名判定全部 mock。
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: { auth: { getUser: vi.fn(), onAuthStateChange: vi.fn() } },
  showToast: vi.fn(),
  bump: vi.fn(),
  remoteLogin: vi.fn(),
  remoteRegister: vi.fn(),
  remoteCurrentUser: vi.fn(),
  sendPhoneOtp: vi.fn(),
  verifyPhoneOtp: vi.fn(),
}));

vi.mock("../../platform/PlatformProvider", () => ({
  usePlatform: () => ({
    platform: mocks.platform,
    showToast: mocks.showToast,
    bump: mocks.bump,
  }),
}));

vi.mock("../../account/remoteAuth", () => ({
  ACCOUNT_PASSWORD_MIN_LENGTH: 8,
  remoteAuth: {
    login: mocks.remoteLogin,
    register: mocks.remoteRegister,
    currentUser: mocks.remoteCurrentUser,
    signOut: vi.fn(),
  },
}));

vi.mock("../../cloud/auth", () => ({
  cloudAuth: {
    sendPhoneOtp: mocks.sendPhoneOtp,
    verifyPhoneOtp: mocks.verifyPhoneOtp,
    startWechat: vi.fn(),
  },
}));

vi.mock("../../cloud/config", () => ({
  CLOUD_PUBLIC_CONFIG: { endpoint: "https://wb.example.com" },
  isCloudHost: () => true,
  isCloudOrigin: () => false,
  probeCloudLoginOrigin: async () => true,
  resetCloudLoginOriginProbe: vi.fn(),
}));

vi.mock("../../cloud/sync", () => ({ syncAll: vi.fn() }));
vi.mock("../../cloud/transport", () => ({ createCloudTransport: vi.fn() }));

import { AccountCard } from "./AccountCard";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platform.auth.getUser.mockResolvedValue(null);
  mocks.platform.auth.onAuthStateChange.mockReturnValue(() => undefined);
  mocks.remoteCurrentUser.mockReturnValue(null);
});

afterEach(cleanup);

function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("账号卡片", () => {
  it("默认显示账号密码入口，并保留验证码与手机注册", async () => {
    render(<AccountCard />);
    expect(await screen.findByText("账号密码")).toBeTruthy();
    expect(screen.getByText("验证码登录")).toBeTruthy();
    expect(screen.getByText("手机注册")).toBeTruthy();
    expect(screen.queryByText("微信扫码登录")).toBeNull();
  });

  it("账号密码登录成功后显示「已登录」", async () => {
    mocks.remoteLogin.mockResolvedValue({
      userId: "user-1",
      displayName: "alice",
      isAnonymous: false,
    });
    mocks.remoteCurrentUser.mockReturnValue({
      userId: "user-1",
      displayName: "alice",
      isAnonymous: false,
    });

    render(<AccountCard />);
    await screen.findByText("账号密码");

    fill("账号", "alice");
    fill("密码", "pw123456");
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("已登录")).toBeTruthy();
    expect(mocks.remoteLogin).toHaveBeenCalledWith("alice", "pw123456");
    expect(mocks.showToast).toHaveBeenCalledWith("已登录");
  });

  it("已注册手机号走手机注册时被拦截并提示改用登录", async () => {
    mocks.sendPhoneOtp.mockResolvedValue({ verificationId: "v1", isExistingUser: true });
    render(<AccountCard />);
    await screen.findByText("账号密码");

    fireEvent.click(screen.getByRole("button", { name: "手机注册" }));
    fill("注册手机号", "13800000000");
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    expect(await screen.findByText(/该手机号已注册/)).toBeTruthy();
    expect(mocks.verifyPhoneOtp).not.toHaveBeenCalled();
  });
});
