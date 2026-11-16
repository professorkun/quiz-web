/**
 * 会话本地暂存（S2 的"最小本地暂存"，不是 Dexie 持久化）。
 *
 * 只存一份当前会话；`bankId` 不匹配直接忽略，避免把 A 题库的作答串到 B 题库。
 * 读取一律走 `restoreSession`，所以版本不兼容/修订冲突都会走同一套提示逻辑。
 */

import {
  restoreSession,
  serializeSession,
  type Question,
  type RestoreResult,
  type SessionSnapshot,
} from "@quiz/core";

const KEY_PREFIX = "quiz.session.v1";

/** 按题库分 key：切到演示题库不能把真实题库的会话覆盖掉 */
const keyOf = (bankId: string): string => `${KEY_PREFIX}.${bankId}`;

interface Envelope {
  readonly bankId: string;
  readonly raw: string;
}

export function saveSession(bankId: string, session: SessionSnapshot): void {
  try {
    const envelope: Envelope = { bankId, raw: serializeSession(session) };
    localStorage.setItem(keyOf(bankId), JSON.stringify(envelope));
  } catch {
    // 存储不可用（隐私模式/配额满）不应打断作答，会话仍在内存里
  }
}

export function loadSession(bankId: string, questions: readonly Question[]): RestoreResult | null {
  const stored = localStorage.getItem(keyOf(bankId));
  if (stored === null) return null;
  try {
    const envelope = JSON.parse(stored) as Envelope;
    if (envelope.bankId !== bankId || typeof envelope.raw !== "string") return null;
    return restoreSession(envelope.raw, questions);
  } catch {
    return {
      ok: false,
      session: null,
      reason: "本地会话数据已损坏，请重新开始；已完成记录已保留",
      conflicts: [],
      warnings: [],
      preserved: [],
    };
  }
}

export function clearSession(bankId: string): void {
  try {
    localStorage.removeItem(keyOf(bankId));
  } catch {
    // 同上：清不掉也不该崩
  }
}
