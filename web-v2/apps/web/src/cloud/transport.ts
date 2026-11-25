/**
 * 云传输层（S6 · T6-4）：`SyncTransport` 的真实实现，走 `cloud.database`。
 *
 * 只做三件事：分页取全量、幂等写、更新写。**不在这里拼业务规则**——
 * 合并/LWW 在 `sync.ts` 里，便于单测。客户端不发 owner_id（RLS + DEFAULT 决定归属）。
 */

import { cloud } from "./client";
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
interface RangeBuilder {
  range(from: number, to: number): Promise<{ data: unknown; error: unknown }>;
}

interface SelectBuilder extends RangeBuilder {
  order(column: string, options?: { ascending?: boolean }): RangeBuilder;
}

interface LooseQuery {
  select(cols: string): SelectBuilder;
  upsert(
    rows: CloudRow[],
    opts: { onConflict: string; ignoreDuplicates?: boolean },
  ): Promise<{ data?: unknown; error: unknown }>;
}
const db = cloud.database as unknown as { from(table: string): LooseQuery };

const PAGE = 1000;

/**
 * 分页必须有稳定的排序键，否则 `range()` 在无序集合上会跳行/重复——
 * SDK 自己就写了「没有 order 时 range 的行为不可预期」。
 * 用主键列排序：天然唯一、一定存在，且不会随写入变化。
 */
const ORDER_BY: Record<string, string> = {
  attempts: "attempt_id",
  exam_records_v2: "record_id",
  question_progress: "question_id",
  practice_sessions: "bank_id",
  user_preferences: "owner_id",
};

export function createCloudTransport(): SyncTransport {
  return {
    async select(table: string): Promise<CloudRow[]> {
      const query = db.from(table).select("*");
      const orderColumn = ORDER_BY[table];
      const page = (from: number): Promise<{ data: unknown; error: unknown }> =>
        orderColumn === undefined
          ? query.range(from, from + PAGE - 1)
          : query.order(orderColumn, { ascending: true }).range(from, from + PAGE - 1);

      const out: CloudRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const res = await page(from);
        assert(res, `拉取 ${table} 失败`);
        const batch = (res.data ?? []) as CloudRow[];
        out.push(...batch);
        if (batch.length < PAGE) break;
      }
      return out;
    },

    async insertIgnore(table, rows, onConflict): Promise<void> {
      if (rows.length === 0) return;
      const res = await db.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
      assert(res, `写入 ${table} 失败`);
    },

    async upsert(table, rows, onConflict): Promise<void> {
      if (rows.length === 0) return;
      const res = await db.from(table).upsert(rows, { onConflict });
      assert(res, `更新 ${table} 失败`);
    },
  };
}
