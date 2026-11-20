/**
 * 云传输层（S6 · T6-4）：`SyncTransport` 的真实实现，走 `cloud.database`。
 *
 * 只做三件事：分页取全量、幂等写、更新写。**不在这里拼业务规则**——
 * 合并/LWW 在 `sync.ts` 里，便于单测。客户端不发 owner_id（RLS + DEFAULT 决定归属）。
 */

import { getCloud } from "./client";
import type { CloudRow, SyncTransport } from "./sync";

function messageOf(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m !== "") return m;
  }
  return fallback;
}

function assert(ok: { error: unknown }, fallback: string): void {
  if (ok.error) throw new Error(messageOf(ok.error, fallback));
}

/**
 * 宽松的局部类型视图：SDK 未带 `Database` 泛型时，`from()` 的行类型被推成 `never`。
 * 我们这里按未类型化行（CloudRow）使用，运行时行为不变。
 */
interface LooseQuery {
  select(cols: string): { range(a: number, b: number): Promise<{ data: unknown; error: unknown }> };
  upsert(
    rows: CloudRow[],
    opts: { onConflict: string; ignoreDuplicates?: boolean },
  ): Promise<{ data?: unknown; error: unknown }>;
}
async function getDb(): Promise<{ from(table: string): LooseQuery }> {
  const client = await getCloud();
  return client.database as unknown as { from(table: string): LooseQuery };
}

const PAGE = 1000;

export function createCloudTransport(): SyncTransport {
  return {
    async select(table: string): Promise<CloudRow[]> {
      const db = await getDb();
      const out: CloudRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const res = await db.from(table).select("*").range(from, from + PAGE - 1);
        assert(res, `拉取 ${table} 失败`);
        const batch = (res.data ?? []) as CloudRow[];
        out.push(...batch);
        if (batch.length < PAGE) break;
      }
      return out;
    },

    async insertIgnore(table, rows, onConflict): Promise<void> {
      if (rows.length === 0) return;
      const db = await getDb();
      const res = await db.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
      assert(res, `写入 ${table} 失败`);
    },

    async upsert(table, rows, onConflict): Promise<void> {
      if (rows.length === 0) return;
      const db = await getDb();
      const res = await db.from(table).upsert(rows, { onConflict });
      assert(res, `更新 ${table} 失败`);
    },
  };
}
