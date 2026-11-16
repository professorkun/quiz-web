/**
 * 题目 ID 工具（ADR-0001）。
 *
 * 规则：
 * - ID 由「题库 + 题型 + 序号」组成，人工冻结，永不复用已删除题目的序号
 * - ID 不由内容哈希生成：改一个错别字不应等于换一道题
 * - 分隔符用 `:`，因为题型名里可能出现 `_` 与 `-`
 */

import type { QuestionType } from "./schema.js";

const ID_SEP = ":";

const SEQ_RE = /^\d{3,}$/;

/** 3 位起步、可增长：147 题够用，将来上千题也不会变成 4 位长度的不统一 */
export function padSeq(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`seq 必须是正整数，收到 ${String(seq)}`);
  }
  return String(seq).padStart(3, "0");
}

export function makeQuestionId(bankId: string, type: QuestionType, seq: number): string {
  if (!bankId || bankId.includes(ID_SEP)) {
    throw new Error(`bankId 不能为空且不能包含 "${ID_SEP}"：${bankId}`);
  }
  return [bankId, type, padSeq(seq)].join(ID_SEP);
}

export interface ParsedQuestionId {
  readonly bankId: string;
  readonly type: QuestionType;
  readonly seq: number;
}

/**
 * 解析 ID。**故意在校验上从严**：宁可让构造期就报错，
 * 也不要在运行时把 `javaweb:single_choice:abc` 悄悄当成某道题。
 */
export function parseQuestionId(id: string): ParsedQuestionId {
  const parts = id.split(ID_SEP);
  if (parts.length !== 3) {
    throw new Error(`题目 ID 必须形如 bank:type:seq，收到 ${id}`);
  }
  const [bankId, rawType, rawSeq] = parts as [string, string, string];
  if (!bankId) throw new Error(`题目 ID 缺少 bankId：${id}`);
  if (!SEQ_RE.test(rawSeq)) throw new Error(`题目 ID 的序号必须是至少 3 位数字：${id}`);
  return { bankId, type: rawType as QuestionType, seq: Number(rawSeq) };
}

/** 分配新序号：取当前最大值 +1，**不复用已删除题目的编号** */
export function nextSeq(existingIds: readonly string[], bankId: string, type: QuestionType): number {
  let max = 0;
  for (const id of existingIds) {
    let parsed: ParsedQuestionId;
    try {
      parsed = parseQuestionId(id);
    } catch {
      continue;
    }
    if (parsed.bankId === bankId && parsed.type === type && parsed.seq > max) {
      max = parsed.seq;
    }
  }
  return max + 1;
}
