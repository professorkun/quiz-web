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

/**
 * 作答事件 ID：`sessionId` 前缀只为排查方便，唯一性由随机段保证。
 *
 * **不能**用「会话 + 第几题」拼：会话是跨设备同步的，两端续刷同一轮练习时
 * 会拼出同一个 ID，云端主键冲突后 `ON CONFLICT DO NOTHING` 会把后到的那条
 * 作答**静默吞掉**——不报错、不落日志，用户只看到"这题我明明做过"。
 */
export function makeAttemptId(sessionId: string): string {
  // core 不依赖 DOM 类型：这里按最小结构取随机源，非安全上下文（局域网 http）自动退回时间戳
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const uuid = cryptoApi?.randomUUID?.();
  const tail =
    typeof uuid === "string"
      ? uuid
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  // 前缀只为人肉排查：同一轮练习的记录聚在一起，一眼能看出属于哪次会话
  return `${sessionId}-${tail}`;
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
