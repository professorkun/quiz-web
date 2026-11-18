/**
 * PWA 能力（S6 · T6-9）：Service Worker 注册 + 更新提示 + 安装入口。
 *
 * 只在生产构建启用 SW：开发服务器下注册 SW 会缓存 Vite 的模块请求、
 * 破坏热更新并污染控制台，所以 dev 环境直接不注册（也不报错）。
 */

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** 是否处于可安装状态（浏览器触发 beforeinstallprompt 后为 true） */
export function useInstallPrompt(): {
  readonly canInstall: boolean;
  readonly promptInstall: () => Promise<void>;
} {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event): void => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    globalThis.addEventListener("beforeinstallprompt", handler);
    return () => globalThis.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = async (): Promise<void> => {
    if (event === null) return;
    await event.prompt();
    setEvent(null);
  };

  return { canInstall: event !== null, promptInstall };
}

/**
 * 注册 SW 并跟踪是否有新版本可用。
 * `applyUpdate` 让等待中的新 SW 立即接管，接管后自动刷新。
 */
export function useServiceWorker(): {
  readonly hasUpdate: boolean;
  readonly applyUpdate: () => void;
} {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;

    const register = async (): Promise<void> => {
      try {
        const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
        if (disposed) return;

        // 已有等待中的新版本（上次没更新就关掉了页面）
        if (reg.waiting !== null && navigator.serviceWorker.controller !== null) {
          setWaiting(reg.waiting);
          setHasUpdate(true);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (installing === null) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller !== null) {
              setWaiting(installing);
              setHasUpdate(true);
            }
          });
        });
      } catch {
        /* SW 注册失败不影响应用使用：离线能力降级，其余功能照常 */
      }
    };

    void register();
    return () => {
      disposed = true;
    };
  }, []);

  const applyUpdate = (): void => {
    if (waiting === null) {
      globalThis.location.reload();
      return;
    }
    navigator.serviceWorker.addEventListener("controllerchange", () => globalThis.location.reload(), {
      once: true,
    });
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return { hasUpdate, applyUpdate };
}

/** 全局「有新版本」提示条；无更新时返回 null */
export function PwaUpdateBar(): React.ReactElement | null {
  const { hasUpdate, applyUpdate } = useServiceWorker();
  if (!hasUpdate) return null;
  return (
    <div className="notice banner" role="status">
      应用有新版本可用。
      <button type="button" className="btn ghost" style={{ marginLeft: 8 }} onClick={applyUpdate}>
        立即更新
      </button>
    </div>
  );
}
