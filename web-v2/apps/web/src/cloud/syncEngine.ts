/**
 * 云同步引擎（P0）：把「什么时候同步」从页面里拿出来。
 *
 * 之前只有「我的 → 立即同步」一个按钮能触发，两台设备各自写本地、谁也没去拉，
 * 于是"同一账号两端不同步"是必然结果而不是偶发故障。这里补上触发时机，并加三条保护：
 *
 *  - **单飞**：同一时刻只有一次同步在跑，重复触发复用同一个 Promise，
 *    避免"切前台 + 联网 + 写后防抖"同时打三次云。
 *  - **退避重试**：1s / 4s / 16s；三次都失败才把错误交给界面。
 *    移动网络切换、平板切后台都会让一次同步半途而废，没有重试就只能靠人再点一次。
 *  - **写后防抖**：本地写入后 15s 合并成一次同步，而不是每答一题发一次请求。
 *
 * 页面不直接调 `syncAll`，只经 `syncNow()` 与 `subscribe()` 拿状态。
 */

import type { Platform } from "@quiz/platform";

import { isCloudOrigin } from "./config";
import { syncAll } from "./sync";
import { createCloudTransport } from "./transport";

/** 三次机会：瞬时断网、移动网络切换、云函数冷启动都够用 */
const RETRY_DELAYS = [1_000, 4_000, 16_000] as const;
const WRITE_DEBOUNCE_MS = 15_000;
const LAST_SYNC_KEY = "quiz:last-sync-at";

/** 上次同步时间只对本机有意义（不是用户数据），存 localStorage；隐私模式下读不到就当没有 */
function readLastSync(): string | null {
  try {
    return globalThis.localStorage?.getItem(LAST_SYNC_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeLastSync(at: string): void {
  try {
    globalThis.localStorage?.setItem(LAST_SYNC_KEY, at);
  } catch {
    /* 存不下只是少一行展示，不影响同步本身 */
  }
}

export type SyncPhase = "idle" | "syncing" | "ok" | "error";

export interface SyncSnapshot {
  readonly phase: SyncPhase;
  readonly lastSyncAt: string | null;
  readonly error: string | null;
}

export interface SyncEngine {
  /** 注册自动触发点，返回卸载函数 */
  start(): () => void;
  /** 手动 / 自动统一入口；并发调用复用同一次同步 */
  syncNow(reason?: string): Promise<void>;
  /** 本地写入后调用：防抖合并成一次同步 */
  noteLocalWrite(): void;
  getSnapshot(): SyncSnapshot;
  subscribe(listener: (snapshot: SyncSnapshot) => void): () => void;
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message !== "" ? cause.message : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSyncEngine(options: {
  readonly platform: Platform;
  /** 同步成功后调用，让页面重新取数 */
  readonly onSynced: () => void;
}): SyncEngine {
  const { platform, onSynced } = options;
  let snapshot: SyncSnapshot = { phase: "idle", lastSyncAt: readLastSync(), error: null };
  const listeners = new Set<(snapshot: SyncSnapshot) => void>();
  let running: Promise<void> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (next: Partial<SyncSnapshot>): void => {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener(snapshot);
  };

  /**
   * 只有「正式发布域名 + 已登录且非匿名」才有云可同步。
   * 其他域名走本机账号（账号库就在这台浏览器里），同步既没意义也会报 CORS——
   * 这是默认形态，不进控制台，免得把真正的错误淹掉。
   */
  const canSync = async (): Promise<"ok" | "local" | "anonymous"> => {
    if (!isCloudOrigin()) return "local";
    const user = await platform.auth.getUser().catch(() => null);
    if (user === null || user.isAnonymous) return "anonymous";
    return "ok";
  };

  const runOnce = async (reason: string): Promise<void> => {
    const startedAt = Date.now();
    await syncAll(createCloudTransport(), platform);
    const lastSyncAt = new Date().toISOString();
    writeLastSync(lastSyncAt);
    emit({ phase: "ok", lastSyncAt, error: null });
    console.info(`[sync] ok reason=${reason} ms=${Date.now() - startedAt} at=${lastSyncAt}`);
    onSynced();
  };

  const syncNow = (reason = "manual"): Promise<void> => {
    if (running !== null) return running;
    running = (async () => {
      try {
        const guard = await canSync();
        if (guard === "local") {
          emit({ phase: "idle" });
          return;
        }
        if (guard === "anonymous") {
          emit({ phase: "idle" });
          console.info(`[sync] skip reason=${reason}（未登录，本机数据未上云）`);
          return;
        }
        emit({ phase: "syncing", error: null });
        for (let attempt = 0; ; attempt += 1) {
          try {
            await runOnce(reason);
            return;
          } catch (cause) {
            const delay = RETRY_DELAYS[attempt];
            if (delay === undefined) {
              const error = messageOf(cause, "同步失败");
              emit({ phase: "error", error });
              console.warn(`[sync] fail reason=${reason} attempt=${attempt + 1}`, cause);
              return;
            }
            console.warn(`[sync] retry reason=${reason} attempt=${attempt + 1} in=${delay}ms`, cause);
            await sleep(delay);
          }
        }
      } finally {
        running = null;
      }
    })();
    return running;
  };

  const noteLocalWrite = (): void => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void syncNow("local-write");
    }, WRITE_DEBOUNCE_MS);
  };

  const start = (): (() => void) => {
    // 登录不必单独触发：登录会让 PlatformProvider 按新账号重装数据库，
    // 新引擎的 boot 就是一次完整同步；反过来在旧引擎上抢跑会把游客库推到新账号名下。
    void syncNow("boot");

    const onVisible = (): void => {
      if (globalThis.document?.visibilityState === "visible") void syncNow("visible");
    };
    const onOnline = (): void => void syncNow("online");

    globalThis.document?.addEventListener("visibilitychange", onVisible);
    globalThis.addEventListener("online", onOnline);

    return () => {
      globalThis.document?.removeEventListener("visibilitychange", onVisible);
      globalThis.removeEventListener("online", onOnline);
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };
  };

  return {
    start,
    syncNow,
    noteLocalWrite,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
