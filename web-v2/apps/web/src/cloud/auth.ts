/**
 * 云认证适配器（S6 · T6-3）。
 *
 * 两块，各司其职：
 * 1. `createCloudAuthAdapter()` —— 实现 `@quiz/platform` 的 `AuthAdapter`
 *    （getUser / onAuthStateChange / signOut），注入给 Platform，页面据此感知登录态。
 * 2. `cloudAuth` —— 登录动作封装（手机验证码 / 微信 / WorkBuddy OAuth），
 *    登录 UI 只调这里，**不直连 SDK**（方案 T6-3「页面不直连 SDK」）。
 *
 * 登录方式取默认：手机 OTP + 微信；WorkBuddy 账号登录作为额外入口。
 * OAuth 回调只能在已发布的 HTTPS 域名完成（localhost 会被 Relay 拒绝），见文档。
 */

import type { AuthAdapter, AuthUser } from "@quiz/platform";

import { cloud } from "./client";

type Session = NonNullable<Awaited<ReturnType<typeof cloud.auth.getSession>>["data"]>;

export interface SendOtpResult {
  readonly verificationId: string;
  readonly isExistingUser: boolean;
}

export interface OtpError {
  readonly message: string;
}

function toAuthUser(session: Session | null): AuthUser | null {
  if (session === null) return null;
  const u = session.user;
  return { userId: u.id, displayName: u.name ?? null, isAnonymous: u.isAnonymous };
}

function messageOf(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m !== "") return m;
  }
  return fallback;
}

function unwrap<T>(result: { data: T | null; error: unknown }, fallback: string): T {
  if (result.error) throw new Error(messageOf(result.error, fallback));
  if (result.data === null) throw new Error(fallback);
  return result.data;
}

/** 注入给 Platform 的认证适配器 */
export function createCloudAuthAdapter(): AuthAdapter {
  return {
    getUser: async () => {
      const { data, error } = await cloud.auth.getSession();
      if (error) return null;
      return toAuthUser(data);
    },
    onAuthStateChange: (listener) =>
      cloud.auth.onAuthStateChange((_event, session) => listener(toAuthUser(session))),
    signOut: async () => {
      await cloud.auth.signOut();
    },
  };
}

/** 登录动作封装（登录 UI 只调这些） */
export const cloudAuth = {
  /** 发送手机验证码（仅大陆 11 位；校验在 UI 层） */
  async sendPhoneOtp(phone: string): Promise<SendOtpResult> {
    const data = unwrap(await cloud.auth.sendOtp({ phone }), "验证码发送失败");
    return { verificationId: data.verificationId, isExistingUser: data.isExistingUser };
  },

  /** 校验验证码并登录/注册 */
  async verifyPhoneOtp(
    phone: string,
    verificationId: string,
    isExistingUser: boolean,
    token: string,
  ): Promise<AuthUser | null> {
    const data = unwrap(
      await cloud.auth.verifyOtp({ phone, verificationId, isExistingUser, token }),
      "验证码校验失败",
    );
    return toAuthUser(data);
  },

  /** 微信网页登录：取授权 URL 并在同标签页跳转 */
  async startWechat(): Promise<void> {
    const data = unwrap(
      await cloud.auth.signInWithOAuth({ provider: "wechat", redirectTo: globalThis.location.origin }),
      "微信登录启动失败",
    );
    globalThis.location.assign(data.url);
  },

  /** WorkBuddy 账号登录：取授权 URL 并在同标签页跳转 */
  async startWorkbuddy(): Promise<void> {
    const data = unwrap(
      await cloud.auth.signInWithOAuth({ provider: "workbuddy", redirectTo: globalThis.location.origin }),
      "WorkBuddy 登录启动失败",
    );
    globalThis.location.assign(data.url);
  },

  /**
   * 处理 OAuth 回调（应用入口、路由守卫之前调用）。
   * 无回调返回 null；有回调则分派到对应 provider 的 handler 并清理 URL 参数。
   */
  async handleCallback(): Promise<AuthUser | null> {
    const url = new URL(globalThis.location.href);
    if (!url.searchParams.has("code") && !url.searchParams.has("error")) return null;
    const provider = url.searchParams.get("provider");
    if (provider !== "workbuddy" && provider !== "wechat") return null;

    const handler =
      provider === "workbuddy" ? cloud.auth.handleWorkBuddyCallback : cloud.auth.handleWechatWebCallback;
    if (typeof handler !== "function") return null;

    const { data, error } = await handler.call(cloud.auth);
    if (error) throw new Error(messageOf(error, "登录回调处理失败"));

    for (const key of ["code", "state", "provider"]) url.searchParams.delete(key);
    globalThis.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return toAuthUser(data ?? null);
  },

  /** 当前登录用户（无会话返回 null） */
  async currentUser(): Promise<AuthUser | null> {
    const { data, error } = await cloud.auth.getSession();
    if (error) return null;
    return toAuthUser(data);
  },
};
