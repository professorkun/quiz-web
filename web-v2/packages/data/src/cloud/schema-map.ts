/**
 * V2 云表 ↔ `core` 契约的字段对齐（S6 · T6-1）。
 *
 * 这一层只回答一个问题：**五张 V2 表是否不丢 `core` 契约的任何字段**。
 * 它是 T6-1「字段与 core 契约一致」的机器证据，也是 T6-4 同步层做行映射时的单一事实源。
 *
 * 三条约定：
 * 1. **顶层字段 1:1 落列**：`core` 的 camelCase 字段经 camel→snake 落到 SQL 列。
 * 2. **嵌套字段整块进 JSONB**：`answer` / `items` / `practice` / `results` / `questionIds`
 *    连同内部结构原样存进一列（JSONB），嵌套保真由 JSON 往返测试兜底，不在这里拆列。
 * 3. **每表一个幂等键**：重复写入同一幂等键不产生新行（迁移与同步的重放安全靠它）。
 *
 * 注意：这里只有"结构对齐"，不含 RLS（T6-2）与同步冲突规则（T6-4）。
 */

import {
  AppSettingsSchema,
  AttemptSchema,
  ExamRecordSchema,
  PracticeSessionSchema,
  QuestionProgressSchema,
} from "@quiz/core";

export type V2TableName =
  | "attempts"
  | "question_progress"
  | "practice_sessions"
  | "exam_records_v2"
  | "user_preferences";

export interface V2TableSpec {
  /** 对应的 core 契约 schema 名（文档与测试用） */
  readonly coreType: string;
  /** 幂等键列：重复写入同一键是空操作 */
  readonly idempotentKey: readonly string[];
  /** SQL 列（snake_case），含 owner_id 与记账列 */
  readonly columns: readonly string[];
}

/**
 * 五表定义。列名即 `web-v2/docs/cloud/v2-schema.sql` 里的列，两者必须一致。
 * `owner_id` 由服务端 `auth.uid()` 填，客户端不传（RLS 隔离的前提，T6-2）。
 */
export const V2_TABLES: Record<V2TableName, V2TableSpec> = {
  attempts: {
    coreType: "Attempt",
    idempotentKey: ["attempt_id"],
    columns: [
      "attempt_id",
      "owner_id",
      "bank_id",
      "question_id",
      "question_revision",
      "mode",
      "is_first_attempt",
      "started_at",
      "submitted_at",
      "answer",
      "correct",
      "score",
      "max_score",
      "session_id",
      "duration_ms",
      "imported_from",
      "created_at",
    ],
  },
  question_progress: {
    coreType: "QuestionProgress",
    idempotentKey: ["owner_id", "bank_id", "question_id"],
    columns: [
      "owner_id",
      "bank_id",
      "question_id",
      "attempts_count",
      "wrong_count",
      "first_correct_at",
      "last_attempt_at",
      "mastered",
      "status",
      "streak",
      "next_review_at",
      "error_cause",
      "note",
      "updated_at",
    ],
  },
  practice_sessions: {
    coreType: "PracticeSession",
    idempotentKey: ["owner_id", "bank_id"],
    columns: [
      "owner_id",
      "bank_id",
      "session_id",
      "mode",
      "question_ids",
      "cursor",
      "results",
      "started_at",
      "updated_at",
      "finished_at",
    ],
  },
  exam_records_v2: {
    coreType: "ExamRecord",
    idempotentKey: ["record_id"],
    columns: [
      "record_id",
      "owner_id",
      "bank_id",
      "template_id",
      "session_id",
      "seed",
      "started_at",
      "submitted_at",
      "duration_sec",
      "timed_out",
      "objective_score",
      "objective_max",
      "self_score",
      "self_max",
      "total_score",
      "total_max",
      "items",
      "created_at",
    ],
  },
  user_preferences: {
    coreType: "AppSettings",
    idempotentKey: ["owner_id"],
    columns: ["owner_id", "active_bank_id", "practice", "favorites", "updated_at"],
  },
};

/** camelCase 字段名 → snake_case 列名（顶层 1:1 落列的规则） */
export function toColumn(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** 每表对应的 core 顶层 schema，用于内省字段清单 */
const CORE_SCHEMA = {
  attempts: AttemptSchema,
  question_progress: QuestionProgressSchema,
  practice_sessions: PracticeSessionSchema,
  exam_records_v2: ExamRecordSchema,
  user_preferences: AppSettingsSchema,
} as const;

export interface CoverageGap {
  readonly table: V2TableName;
  readonly missingColumn: string;
  readonly coreField: string;
}

/**
 * 逐表核对：`core` 顶层字段是否都在列清单里。
 * 返回空数组 = 五表不丢任何 core 顶层字段。缺一个都返回它，便于定位。
 */
export function coreFieldCoverageGaps(): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const table of Object.keys(CORE_SCHEMA) as V2TableName[]) {
    const schema = CORE_SCHEMA[table];
    const columns = new Set(V2_TABLES[table].columns);
    // ZodObject.shape 的键即顶层字段名（含 .default()/.optional() 包裹的字段）
    const fields = Object.keys(schema.shape as Record<string, unknown>);
    for (const field of fields) {
      const column = toColumn(field);
      if (!columns.has(column)) {
        gaps.push({ table, missingColumn: column, coreField: field });
      }
    }
  }
  return gaps;
}

/**
 * 幂等键必须真在列清单里（否则"重复写入不重复"无从谈起）。
 * 返回空数组 = 每表幂等键都有对应列。
 */
export function idempotentKeyGaps(): { table: V2TableName; column: string }[] {
  const gaps: { table: V2TableName; column: string }[] = [];
  for (const table of Object.keys(V2_TABLES) as V2TableName[]) {
    const columns = new Set(V2_TABLES[table].columns);
    for (const column of V2_TABLES[table].idempotentKey) {
      if (!columns.has(column)) gaps.push({ table, column });
    }
  }
  return gaps;
}
