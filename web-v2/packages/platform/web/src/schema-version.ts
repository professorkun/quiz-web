/**
 * 逻辑 schema 版本闸门（S3 验收 E「存储 schema 有版本号与升级函数」）。
 *
 * 为什么必须在写入前检查：本地数据版本比代码新，说明用户用过更新的版本。
 * 这时若继续按旧结构写，新版本里多出来的字段会在下一次保存时被抹掉——
 * 那是**不可逆**的数据损坏，比"打不开"严重得多。
 */

import { StorageError } from "@quiz/platform";

import { STORAGE_SCHEMA_VERSION } from "./indexeddb.js";
import type { KeyValueStore } from "./kv.js";

export const META_KEY = "__meta__:schemaVersion";

/** 从 n 迁到 n+1。v1 是首版，所以现在是空的；补迁移时只加不改 */
export const MIGRATIONS: Readonly<Record<number, (kv: KeyValueStore) => Promise<void>>> = {};

export async function ensureSchemaVersion(
  kv: KeyValueStore,
  target: number = STORAGE_SCHEMA_VERSION,
): Promise<void> {
  const raw = await kv.get(META_KEY);
  if (raw === null) {
    await kv.set(META_KEY, String(target));
    return;
  }
  const found = Number(raw);
  if (!Number.isFinite(found)) {
    throw new StorageError("corrupt", "本地数据的版本标记已损坏，请导出备份后重置");
  }
  if (found > target) {
    throw new StorageError(
      "version",
      `本地数据来自更新版本（v${found} > v${target}），已停止写入以免覆盖新版本的数据`,
    );
  }
  for (let version = found; version < target; version += 1) {
    const migrate = MIGRATIONS[version];
    if (migrate === undefined) {
      throw new StorageError(
        "version",
        `缺少 v${version} → v${version + 1} 的迁移，已停止写入以免损坏数据`,
      );
    }
    await migrate(kv);
    await kv.set(META_KEY, String(version + 1));
  }
}
