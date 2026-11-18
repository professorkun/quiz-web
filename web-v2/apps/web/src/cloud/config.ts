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
