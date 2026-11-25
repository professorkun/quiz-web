// @vitest-environment jsdom
/**
 * 自动同步（M4-A）：应用云登录后跑一次、匿名不跑、登录态变化后重跑。
 * 账号密码登录没有云会话，不应触发云同步。
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  syncAll: vi.fn(),
  transport: { name: "fake-transport" },
  createCloudTransport: vi.fn(),
  cloudHost: { value: true },
  listener: { current: null as ((user: unknown) => void) | null },
  currentUser: vi.fn(),
  platform: {
    auth: {
      onAuthStateChange: vi.fn(),
    },
  },
}));

vi.mock("../platform/PlatformProvider", () => ({
  usePlatform: () => ({ platform: mocks.platform }),
}));
vi.mock("./auth", () => ({ cloudAuth: { currentUser: mocks.currentUser } }));
vi.mock("./sync", () => ({ syncAll: mocks.syncAll }));
vi.mock("./transport", () => ({ createCloudTransport: mocks.createCloudTransport }));
vi.mock("./config", () => ({ isCloudHost: () => mocks.cloudHost.value }));

import { useAutoSync } from "./useAutoSync";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cloudHost.value = true;
  mocks.createCloudTransport.mockReturnValue(mocks.transport);
  mocks.platform.auth.onAuthStateChange.mockImplementation((listener: (user: unknown) => void) => {
    mocks.listener.current = listener;
    return () => undefined;
  });
});

describe("登录后自动同步", () => {
  it("有云会话时调用一次 syncAll", async () => {
    mocks.currentUser.mockResolvedValue({
      userId: "u1",
      displayName: null,
      isAnonymous: false,
    });
    renderHook(() => useAutoSync());

    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledTimes(1));
    expect(mocks.syncAll).toHaveBeenCalledWith(mocks.transport, mocks.platform);
  });

  it("账号密码登录没有云会话时不同步", async () => {
    mocks.currentUser.mockResolvedValue(null);
    renderHook(() => useAutoSync());

    await waitFor(() => expect(mocks.currentUser).toHaveBeenCalled());
    expect(mocks.syncAll).not.toHaveBeenCalled();
  });

  it("登录态变化后再次同步", async () => {
    mocks.currentUser.mockResolvedValue({
      userId: "u1",
      displayName: null,
      isAnonymous: false,
    });
    renderHook(() => useAutoSync());
    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledTimes(1));

    mocks.listener.current?.(null);
    await waitFor(() => expect(mocks.syncAll).toHaveBeenCalledTimes(2));
  });

  it("非云域名不触发同步", async () => {
    mocks.cloudHost.value = false;
    mocks.currentUser.mockResolvedValue({
      userId: "u1",
      displayName: null,
      isAnonymous: false,
    });
    renderHook(() => useAutoSync());

    await waitFor(() => expect(mocks.platform.auth.onAuthStateChange).toHaveBeenCalled());
    expect(mocks.syncAll).not.toHaveBeenCalled();
  });
});
