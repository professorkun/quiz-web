/**
 * 云客户端单例（S6 · T6-3）。
 *
 * 全应用只初始化一次；Auth / Database 共用同一个 client（登录后数据库请求自动带会话）。
 * 页面与业务代码**不直接 import 这个文件**，只经 `auth.ts` / `sync.ts` 的封装使用。
 */

import { createWorkBuddyCloud } from "@tencent-ai/workbuddy-cloud-sdk";

import { CLOUD_PUBLIC_CONFIG } from "./config";

export const cloud = createWorkBuddyCloud({
  endpoint: CLOUD_PUBLIC_CONFIG.endpoint,
  oauthRelayBaseUrl: CLOUD_PUBLIC_CONFIG.oauthRelayBaseUrl,
  publishableKey: CLOUD_PUBLIC_CONFIG.publishableKey,
});
