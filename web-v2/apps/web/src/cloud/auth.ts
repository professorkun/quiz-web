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
import { CLOUD_PUBLIC_CONFIG, probeCloudLoginOrigin } from "./config";

type Session = NonNullable<Awaited<ReturnType<typeof cloud.auth.getSession>>["data"]>;

export interface SendOtpResult {
  readonly verificationId: string;
  readonly isExistingUser: boolean;
}

export interface OtpError {
  readonly message: string;
}

/** 云端只放行本机 localhost 与应用正式发布域名；其他地址直接说明可用的登录方式 */
function originHint(): string {
  return `当前域名未被应用云放行：${globalThis.location.origin}。云登录仅支持本机 localhost（手机号）和 WorkBuddy 正式发布域名（手机号 / 微信）。`;
}

/** 微信 OAuth 只接受正式发布域名的 https 回调，localhost 会被中继直接拒绝 */
function assertWechatOrigin(): void {
  if (globalThis.location.origin !== CLOUD_PUBLIC_CONFIG.endpoint) {
    throw new Error("微信扫码登录只支持 WorkBuddy 正式发布域名；本机 localhost 仅支持手机号验证码。");
  }
}

function assertLoginOrigin(): Promise<void> {
  return probeCloudLoginOrigin().then((ok) => {
    if (!ok) throw new Error(originHint());
  });
}

function toAuthUser(session: Session | null): AuthUser | null {
  if (session === null) return null;
  const u = session.user;
  return { userId: u.id, displayName: u.name ?? null, isAnonymous: u.isAnonymous };
}

function messageOf(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m !== "") {
      // 有些路径会把云端 403 原样抛出
      if (/origin is not allowed|access_denied/i.test(m)) return originHint();
      // 浏览器 CORS 拦截时只会得到 Failed to fetch，不能再把英文原文透给用户
      if (/failed to fetch|request failed before a response|networkerror|load failed/i.test(m)) {
        return "无法连接登录服务，请检查网络后重试；云登录仅支持本机 localhost（手机号）和 WorkBuddy 正式发布域名。";
      }
      return m;
    }
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
    await assertLoginOrigin();
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

  /** 微信网页登录：取授权 URL 并在同标签页跳转（微信侧展示扫码页） */
  async startWechat(): Promise<void> {
    await assertLoginOrigin();
    assertWechatOrigin();
    const data = unwrap(
      await cloud.auth.signInWithOAuth({ provider: "wechat", redirectTo: globalThis.location.origin }),
      "微信登录启动失败",
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
