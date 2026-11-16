/**
 * 键值能力（ADR-0005）。
 *
 * 这一层刻意做得**很笨**：只有 get / set / delete / keys(prefix) / clear。
 * 没有游标、没有索引、没有事务——因为小程序只有 `wx.storage`，云端的"游标"
 * 与本地"游标"语义也不同。业务需要的查询全部在 `repositories.ts` 里拼装。
 *
 * 之所以还留一个内存实现：单测就在 Node 里跑同一份仓储代码，
 * 不需要为了模拟浏览器再引一个 `fake-indexeddb`。
 */

import { StorageError } from "@quiz/platform";

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** 传 prefix 时只返回该前缀的键；不传返回全部 */
  keys(prefix?: string): Promise<readonly string[]>;
  clear(): Promise<void>;
  /** 已占用字节数的估算；实现给不出就返回 null（不编数字） */
  usageBytes(): Promise<number | null>;
}

/** UTF-8 字节数。不依赖 TextEncoder：Node 与小程序环境都要能跑 */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1; // 代理对，占 4 字节
    } else bytes += 3;
  }
  return bytes;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async keys(prefix?: string): Promise<readonly string[]> {
    const all = [...this.data.keys()];
    return prefix === undefined ? all : all.filter((k) => k.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async usageBytes(): Promise<number | null> {
    let total = 0;
    for (const [key, value] of this.data) total += utf8Bytes(key) + utf8Bytes(value);
    return total;
  }
}

/** 把底层异常统一翻译成页面能读的 StorageError，避免把 IndexedDB 的错误名漏到 UI */
export function toStorageError(cause: unknown, fallback: string): StorageError {
  if (cause instanceof StorageError) return cause;
  const name = cause instanceof Error ? cause.name : "";
  if (name === "QuotaExceededError") {
    return new StorageError("quota", "本地存储已满，请先导出备份再清理旧记录", { cause });
  }
  if (name === "InvalidStateError" || name === "SecurityError" || name === "NotAllowedError") {
    return new StorageError("unavailable", "浏览器未允许本地存储（隐私模式？），本次记录只保存在内存中", {
      cause,
    });
  }
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new StorageError("corrupt", `${fallback}：${detail}`, { cause });
}
