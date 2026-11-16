/**
 * 重算与对账（S4 · T4-8）。
 *
 * 进度是事件的投影，因此"数据坏了"不该修进度，而是**从事件重新投影一遍**。
 * 这个函数同时提供两种用法：
 * - `verifyBank`：只看不改，报告当前进度与重算结果差多少；
 * - `recomputeBank`：写入重算结果，并在写完后再次比对确认一致。
 *
 * 对账失败（写完后仍不一致）必须抛错，不能只 warn——静默的对账等于没有对账。
 */

import type { QuestionProgress } from "@quiz/core";
import type { Platform } from "@quiz/platform";

import { recomputeProgress } from "./progress.js";

export interface ReconcileReport {
  readonly bankId: string;
  readonly beforeCount: number;
  readonly afterCount: number;
  /** 与"由事件重算的结果"不一致的条目数 */
  readonly changed: number;
  /** 写入后是否与重算结果逐项一致 */
  readonly identical: boolean;
}

function keyOf(progress: QuestionProgress): string {
  return progress.questionId;
}

function diffCount(
  actual: readonly QuestionProgress[],
  expected: readonly QuestionProgress[],
): number {
  const map = new Map(actual.map((p) => [keyOf(p), p]));
  let changed = 0;
  for (const item of expected) {
    const current = map.get(keyOf(item));
    if (current === undefined || JSON.stringify(current) !== JSON.stringify(item)) changed += 1;
    map.delete(keyOf(item));
  }
  // 多出来的派生条目也要算差异（例如题目下线后残留的旧进度）
  return changed + map.size;
}

async function calculate(
  platform: Platform,
  bankId: string,
): Promise<{ expected: readonly QuestionProgress[]; before: readonly QuestionProgress[] }> {
  const attempts = await platform.attempts.listByBank(bankId);
  return {
    expected: recomputeProgress(attempts),
    before: await platform.progress.listByBank(bankId),
  };
}

/** 只读检查：当前进度与"由 Attempt 重算的结果"差几条 */
export async function verifyBank(platform: Platform, bankId: string): Promise<ReconcileReport> {
  const { expected, before } = await calculate(platform, bankId);
  return {
    bankId,
    beforeCount: before.length,
    afterCount: before.length,
    changed: diffCount(before, expected),
    identical: false,
  };
}

/**
 * 重算并写回，然后再次读取对账。
 * `identical === false` 时抛错，因为这说明存储层没有真正落盘（配额、权限、版本问题）。
 */
export async function recomputeBank(
  platform: Platform,
  bankId: string,
): Promise<ReconcileReport> {
  const { expected, before } = await calculate(platform, bankId);
  await platform.progress.saveMany(expected);

  const after = await platform.progress.listByBank(bankId);
  const changed = diffCount(after, expected);
  if (changed !== 0) {
    throw new Error(
      `重算对账失败：${bankId} 写入后仍有 ${changed} 条进度与事件不一致，请检查存储是否可写`,
    );
  }

  return {
    bankId,
    beforeCount: before.length,
    afterCount: after.length,
    changed: diffCount(before, expected),
    identical: true,
  };
}
