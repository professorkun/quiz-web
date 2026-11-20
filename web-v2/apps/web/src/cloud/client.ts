/**
 * 云客户端懒加载（S6 · T6-3 / P3 体积治理）。
 *
 * 云 SDK 只在「正式发布域名 + 需要登录/同步」时才下载；本地游客模式永远不加载。
 * 页面与业务代码**不直接 import 这个文件**，只经 `auth.ts` / `sync.ts` 的封装使用。
 */

import { CLOUD_PUBLIC_CONFIG } from "./config";

type CloudModule = typeof import("@tencent-ai/workbuddy-cloud-sdk");
export type CloudClient = ReturnType<CloudModule["createWorkBuddyCloud"]>;

let instance: CloudClient | null = null;
let pending: Promise<CloudClient> | null = null;

/**
 * 取云客户端；首次调用触发动态 import，后续复用同一实例。
 * 初始化失败时清掉 pending，允许用户重试（不把失败永久缓存）。
 */
export function getCloud(): Promise<CloudClient> {
  if (instance !== null) return Promise.resolve(instance);
  pending ??= import("@tencent-ai/workbuddy-cloud-sdk")
    .then(({ createWorkBuddyCloud }) => {
      instance = createWorkBuddyCloud({
        endpoint: CLOUD_PUBLIC_CONFIG.endpoint,
        oauthRelayBaseUrl: CLOUD_PUBLIC_CONFIG.oauthRelayBaseUrl,
        publishableKey: CLOUD_PUBLIC_CONFIG.publishableKey,
      });
      return instance;
    })
    .catch((cause: unknown) => {
      pending = null;
      throw cause;
    });
  return pending;
}

/** 已初始化时同步取；未初始化返回 null（不为拿实例而提前下载 SDK） */
export function peekCloud(): CloudClient | null {
  return instance;
}
