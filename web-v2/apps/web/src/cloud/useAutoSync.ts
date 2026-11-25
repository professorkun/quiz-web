/**
 * 登录后自动同步（M4-A，补强触发与重试）。
 *
 * 触发时机：挂载、登录态变化、回到前台、恢复联网。
 * 只挂「登录」一个时机的问题很实际：手机上切个应用回来、地铁里断网恢复，
 * 数据都不会动，用户看到的还是进入页面那一刻的旧快照。
 *
 * 三道保护：
 *  - 单飞：`running` 锁，登录事件与切前台同时到达只跑一次；
 *  - 退避重试：1s / 4s / 16s，三次都失败才放弃（移动网络切换常让一次同步半途而废）；
 *  - 失败只告警不阻塞：同步是增强能力，不能把刷题堵死。
 *
 * 口径不变：只有应用云登录（手机验证码 / 微信）才有云会话；账号密码登录不参与云同步。
 */

import { useEffect } from "react";

import { usePlatform } from "../platform/PlatformProvider";
import { cloudAuth } from "./auth";
import { isCloudHost } from "./config";
import { syncAll } from "./sync";
import { createCloudTransport } from "./transport";

const RETRY_DELAYS = [1_000, 4_000, 16_000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useAutoSync(): void {
  const { platform } = usePlatform();

  useEffect(() => {
    let disposed = false;
    let running = false;

    /** 真正的一次同步；返回 false 表示"当前不该同步"（非云域名 / 没有云会话） */
    const syncOnce = async (): Promise<boolean> => {
      if (disposed) return false;
      if (!isCloudHost()) return false;
      const cloudUser = await cloudAuth.currentUser();
      if (cloudUser === null || cloudUser.isAnonymous) return false;
      await syncAll(createCloudTransport(), platform);
      return true;
    };

    const run = async (): Promise<void> => {
      if (running || disposed) return;
      running = true;
      try {
        for (let attempt = 0; ; attempt += 1) {
          try {
            await syncOnce();
            return;
          } catch (error) {
            const delay = RETRY_DELAYS[attempt];
            if (delay === undefined) {
              console.warn("自动同步失败", error);
              return;
            }
            console.warn(`自动同步失败，${delay}ms 后重试`, error);
            await sleep(delay);
            if (disposed) return;
          }
        }
      } finally {
        running = false;
      }
    };

    void run();
    const unsub = platform.auth.onAuthStateChange(() => void run());

    const onVisible = (): void => {
      if (globalThis.document?.visibilityState === "visible") void run();
    };
    const onOnline = (): void => void run();
    globalThis.document?.addEventListener("visibilitychange", onVisible);
    globalThis.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      unsub();
      globalThis.document?.removeEventListener("visibilitychange", onVisible);
      globalThis.removeEventListener("online", onOnline);
    };
  }, [platform]);
}
