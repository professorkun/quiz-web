/**
 * 登录后自动同步（M4-A）。
 *
 * 有云账号登录态时跑一次 `syncAll`，并在登录 / 退出 / 续期事件后重跑；
 * 带 `running` 锁避免登录与切页重复同步，失败只提示不阻塞刷题。
 * 手动「立即同步」仍保留在账号卡片里作为兜底。
 */

import { useEffect } from "react";

import { usePlatform } from "../platform/PlatformProvider";
import { cloudAuth } from "./auth";
import { isCloudHost } from "./config";
import { syncAll } from "./sync";
import { createCloudTransport } from "./transport";

export function useAutoSync(): void {
  const { platform } = usePlatform();

  useEffect(() => {
    let disposed = false;
    let running = false;

    const run = async (): Promise<void> => {
      if (running || disposed) return;
      if (!isCloudHost()) return;
      // 只有应用云登录（手机验证码 / 微信）才有云会话；账号密码登录不做云同步
      const cloudUser = await cloudAuth.currentUser();
      if (cloudUser === null || cloudUser.isAnonymous) return;
      running = true;
      try {
        await syncAll(createCloudTransport(), platform);
      } catch (e) {
        console.warn("自动同步失败", e);
      } finally {
        running = false;
      }
    };

    void run();
    const unsub = platform.auth.onAuthStateChange(() => void run());
    return () => {
      disposed = true;
      unsub();
    };
  }, [platform]);
}
