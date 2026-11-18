/**
 * Web 平台组装入口。
 *
 * 这里做两件"不能省"的事：
 * 1. **版本闸门**：本地数据版本高于本代码支持的版本时**直接抛错、不降级**。
 *    若这时退回内存实现，用户会看到"保存成功"的假象，实际每次刷新都丢数据。
 * 2. **降级要说出口**：IndexedDB 打不开（隐私模式 / 配额）时退回内存实现，
 *    但把原因带出去给页面提示——绝不假装保存成功。
 */

import type { BankContent } from "@quiz/core";
import { StorageError, systemClock, type AuthAdapter, type Clock, type Platform } from "@quiz/platform";

import { openIndexedDbStore } from "./indexeddb.js";
import { MemoryKeyValueStore, type KeyValueStore } from "./kv.js";
import { createPlatform, LEARNING_SNAPSHOT_VERSION } from "./repositories.js";
import { ensureSchemaVersion } from "./schema-version.js";

export * from "./kv.js";
export * from "./repositories.js";
export * from "./schema-version.js";
export { openIndexedDbStore, STORAGE_DB_NAME, STORAGE_SCHEMA_VERSION } from "./indexeddb.js";

export interface CreateWebPlatformOptions {
  /** 内置题库（编译进包的，如 JavaWeb 与演示题库） */
  readonly builtinBanks: readonly BankContent[];
  readonly dbName?: string;
  readonly clock?: Clock;
  /** 真实认证适配器（S6 云登录）；不传则回退为本地游客模式 */
  readonly auth?: AuthAdapter;
}

export interface WebPlatformResult {
  readonly platform: Platform;
  /** 持久化不可用时的可读原因；null 表示正在使用真实存储 */
  readonly degraded: string | null;
}

export async function createWebPlatform(
  options: CreateWebPlatformOptions,
): Promise<WebPlatformResult> {
  const clock = options.clock ?? systemClock;
  let kv: KeyValueStore;
  let degraded: string | null = null;

  try {
    kv = await openIndexedDbStore(options.dbName === undefined ? {} : { dbName: options.dbName });
    await ensureSchemaVersion(kv);
  } catch (cause) {
    // 版本过新不是"环境不可用"，不能降级：用户看到的一切写入都是假的
    if (cause instanceof StorageError && cause.kind === "version") throw cause;
    degraded =
      cause instanceof StorageError ? cause.message : "本地存储不可用，本次记录只保存在内存中";
    kv = new MemoryKeyValueStore();
  }

  return {
    platform: createPlatform({
      kv,
      builtinBanks: options.builtinBanks,
      clock,
      ...(options.auth === undefined ? {} : { auth: options.auth }),
    }),
    degraded,
  };
}

export const SNAPSHOT_VERSION = LEARNING_SNAPSHOT_VERSION;
