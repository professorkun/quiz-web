/**
 * IndexedDB 键值实现（ADR-0005 的唯一 Web 落地）。
 *
 * 为什么不用 Dexie：Dexie 的价值是索引与事务，而接口刻意不要这两样（见 ADR-0005）。
 * 为了一个只用 `get/set/keys` 的接口引一个 80KB 依赖，换不来任何能力，
 * 却会把"存储实现"变成一个需要联网安装、需要跟着升级的包袱。
 *
 * 索引与游标全部留在本文件内：外面看到的仍然是 ADR-0005 的五个方法。
 */

import { StorageError } from "@quiz/platform";

import { toStorageError, utf8Bytes, type KeyValueStore } from "./kv.js";

export const STORAGE_DB_NAME = "quiz-web";

/** 逻辑 schema 版本：结构变更时 +1，并在 `migrate.ts` 里补一条迁移 */
export const STORAGE_SCHEMA_VERSION = 1;

const STORE_NAME = "kv";

interface KvRow {
  readonly key: string;
  readonly value: string;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 请求失败"));
  });
}

function openDb(name: string, version: number): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name, version);
    } catch (cause) {
      reject(toStorageError(cause, "无法打开本地数据库"));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toStorageError(request.error, "无法打开本地数据库"));
    // 另一个标签页占着旧版本连接时不要静默卡死，直接给可读错误
    request.onblocked = () =>
      reject(
        new StorageError("version", "另一个标签页正在使用旧版本数据，请关闭其他页面后重试"),
      );
  });
}

class IndexedDbKeyValueStore implements KeyValueStore {
  constructor(private readonly db: IDBDatabase) {}

  private async withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    try {
      const tx = this.db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const result = await run(store);
      // 读操作也要等事务结束，避免"读到一半换版本"
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("事务失败"));
        tx.onabort = () => reject(tx.error ?? new Error("事务被中止"));
      });
      return result;
    } catch (cause) {
      throw toStorageError(cause, "本地存储操作失败");
    }
  }

  async get(key: string): Promise<string | null> {
    return this.withStore("readonly", async (store) => {
      const row = (await requestToPromise(store.get(key) as IDBRequest<KvRow | undefined>)) ?? null;
      return row === null ? null : row.value;
    });
  }

  async set(key: string, value: string): Promise<void> {
    await this.withStore("readwrite", async (store) => {
      await requestToPromise(store.put({ key, value } satisfies KvRow));
    });
  }

  async delete(key: string): Promise<void> {
    await this.withStore("readwrite", async (store) => {
      await requestToPromise(store.delete(key));
    });
  }

  async keys(prefix?: string): Promise<readonly string[]> {
    return this.withStore("readonly", async (store) => {
      const range =
        prefix === undefined || prefix === ""
          ? undefined
          : IDBKeyRange.bound(prefix, `${prefix}\uffff`);
      const keys = await requestToPromise(store.getAllKeys(range) as IDBRequest<IDBValidKey[]>);
      return keys.map((k) => String(k));
    });
  }

  async clear(): Promise<void> {
    await this.withStore("readwrite", async (store) => {
      await requestToPromise(store.clear());
    });
  }

  async usageBytes(): Promise<number | null> {
    const keys = await this.keys();
    let total = 0;
    for (const key of keys) {
      const value = await this.get(key);
      total += utf8Bytes(key) + (value === null ? 0 : utf8Bytes(value));
    }
    return total;
  }

  close(): void {
    this.db.close();
  }
}

export interface OpenStoreOptions {
  readonly dbName?: string;
}

/**
 * 打开 Web 端存储。失败一律抛 `StorageError`，由调用方决定降级还是提示，
 * 不在这一层偷偷回退成内存——那会让"数据没保存"变成静默事实。
 */
export async function openIndexedDbStore(options: OpenStoreOptions = {}): Promise<KeyValueStore> {
  if (typeof indexedDB === "undefined") {
    throw new StorageError("unavailable", "当前环境没有 IndexedDB，无法保存学习记录");
  }
  const db = await openDb(options.dbName ?? STORAGE_DB_NAME, STORAGE_SCHEMA_VERSION);
  return new IndexedDbKeyValueStore(db);
}
