/**
 * 练习会话契约（T2-6 / T2-7，ADR-0003）。
 *
 * `SessionSnapshot` 是可序列化的全部状态：种子 + **实际**题序 + 每题选项序都在里面，
 * 恢复时原样读回，不重放随机数——题库内容更新后不会静默错位。
 */

import type { Question, QuestionProgress, QuestionType } from "../schema.js";
import type { GradeResult } from "../questions/types.js";
import type { SelfRating } from "../questions/short_answer/selfRating.js";

export const SESSION_VERSION = 1 as const;

/** 作答只存 optionId / 布尔 / 文本 / 逐空文本，**永不存展示字母 A/B/C/D** */
export type AnswerValue =
  | string
  | boolean
  | readonly string[]
  | Readonly<Record<string, string>>;

export type PracticeOrder = "sequential" | "random";

export interface PracticeConfig {
  readonly bankId: string;
  readonly order: PracticeOrder;
  /** 32 位无符号种子，由调用方生成（Web 端 crypto.getRandomValues），core 不自行取随机 */
  readonly seed: number;
  readonly topicIds?: readonly string[];
  readonly types?: readonly QuestionType[];
  readonly onlyUnseen?: boolean;
  readonly onlyUnmastered?: boolean;
  readonly limit?: number;
}

export interface SessionSnapshot {
  readonly version: typeof SESSION_VERSION;
  readonly sessionId: string;
  readonly bankId: string;
  readonly config: PracticeConfig;
  readonly questionIds: readonly string[];
  /** 每题选项的 optionId 展示顺序；判断题不洗牌，故没有条目 */
  readonly optionOrders: Readonly<Record<string, readonly string[]>>;
  readonly questionRevisions: Readonly<Record<string, string>>;
  readonly answers: Readonly<Record<string, AnswerValue>>;
  readonly selfRatings: Readonly<Record<string, SelfRating>>;
  readonly grades: Readonly<Record<string, GradeResult>>;
  readonly cursor: number;
  readonly startedAt: string;
  readonly updatedAt: string;
}

export interface CreateSessionInput {
  readonly questions: readonly Question[];
  readonly config: PracticeConfig;
  /** 「只刷未做 / 未掌握」依赖的派生进度，由调用方注入 */
  readonly progress?: readonly QuestionProgress[];
  readonly sessionId: string;
  /** 时间必须注入：core 不读 Date（ADR-0002） */
  readonly now: string;
}

export interface PreservedRecord {
  readonly questionId: string;
  readonly answer?: AnswerValue;
  readonly grade?: GradeResult;
  readonly selfRating?: SelfRating;
}

export interface RestoreResult {
  readonly ok: boolean;
  readonly session: SessionSnapshot | null;
  /** 版本不兼容 / 数据损坏时的提示，UI 必须显示而不是静默清空 */
  readonly reason?: string;
  /** revision 变化或题目下线的题：按新版本重新作答 */
  readonly conflicts: readonly string[];
  readonly warnings: readonly string[];
  /** 会话过期时仍保留的已完成记录 */
  readonly preserved: readonly PreservedRecord[];
}
