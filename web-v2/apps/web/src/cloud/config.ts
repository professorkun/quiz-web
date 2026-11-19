/**
 * 云服务公开配置（S6 · T6-3）。
 *
 * 这三个值来自 `workbuddy_cloud_service` 的 activate 返回（2026-11-18），均已公开、
 * 可随前端代码发布：endpoint 是本应用的发布域数据面，publishableKey 只标识应用本身、
 * 不携带权限（服务端按 Origin 校验），oauthRelayBaseUrl 是平台统一 OAuth 中继。
 *
 * 注意：endpoint 只认 publicConfig 的值，不要改成从 location / env 猜出来。
 */
export interface CloudPublicConfig {
  readonly endpoint: string;
  readonly oauthRelayBaseUrl: string;
  readonly publishableKey: string;
}

export const CLOUD_PUBLIC_CONFIG: CloudPublicConfig = {
  endpoint: "https://wbapp-g64vx7uzdywdm0bjtvindk.app.workbuddy.host",
  oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
  publishableKey: "wbpk_g64vX7uZdYwdm0BJTVINDk_v5mWNfJXxHCaMjhaajDTlkCHUj6HHScF",
};

/**
 * 当前是否运行在应用云的正式发布域名上。
 *
 * 应用云按 Origin 放行，只有这个域名能使用手机验证码 / 微信登录与云同步；
 * 其他静态托管地址（如 Trae 部署域名）一律使用本机账号登录。
 */
export function isCloudOrigin(): boolean {
  return globalThis.location.origin === CLOUD_PUBLIC_CONFIG.endpoint;
}

/**
 * 云端鉴权按 Origin 放行：仅本机 loopback 与应用正式发布域名可用，
 * 其他部署地址（如 traesite.cn）会被 403 `origin is not allowed` 拒绝。
 */
let originProbe: Promise<boolean> | null = null;

/**
 * 运行时探测当前 Origin 是否被云端放行。
 *
 * 云端只对放行的 Origin 返回 CORS 头；未放行时 fetch 会直接失败。
 * 平台侧放行后无需改代码，重新探测即可用。
 */
export function probeCloudLoginOrigin(): Promise<boolean> {
  if (originProbe !== null) return originProbe;
  originProbe = (async () => {
    try {
      const res = await fetch(`${CLOUD_PUBLIC_CONFIG.endpoint}/.cloud/auth/v1/session`, {
        method: "GET",
        headers: { "x-wb-webapp-access-key": CLOUD_PUBLIC_CONFIG.publishableKey },
        credentials: "omit",
        cache: "no-store",
      });
      // 放行的 Origin 会正常返回 4xx（如 404）；未放行会因 CORS 被浏览器拒绝
      return res.status !== 403;
    } catch {
      return false;
    }
  })();
  return originProbe;
}

/** 清除探测缓存，供平台侧调整后手动重试 */
export function resetCloudLoginOriginProbe(): void {
  originProbe = null;
}
