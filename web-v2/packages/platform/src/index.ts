/**
 * 平台适配器接口（ADR-0002）。
 *
 * 这一层**只有接口，没有实现**：Web 端实现放 `platform/web`，
 * 将来的 Android / 小程序各写一份。业务规则一律不许出现在这一层。
 *
 * 为什么不直接 `localStorage.getItem`：那样 `core` 就没法在 Node 里测，
 * 也没法换存储。旧版就是一路 `localStorage` + 云 SDK 直接写进页面逻辑，
 * 结果是判分和存储焊死，连单测都做不了。
 */

import type {
  Attempt,
  BankManifest,
  PracticeSession,
  Question,
  QuestionProgress,
} from "@quiz/core";

/** 时间必须注入：否则「最近 7 天复习」这类统计无法测试 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export interface BankRepository {
  getManifest(bankId: string): Promise<BankManifest | null>;
  listQuestions(bankId: string): Promise<readonly Question[]>;
}

/**
 * 答题事件是**只追加**的。任何"覆盖上一次作答"的实现都违反契约，
 * 因为 `isFirstAttempt` 与首次正确率都要靠这段历史算出来。
 */
export interface AttemptRepository {
  append(attempt: Attempt): Promise<void>;
  listByBank(bankId: string): Promise<readonly Attempt[]>;
  listByQuestion(bankId: string, questionId: string): Promise<readonly Attempt[]>;
}

/** 进度是派生数据，允许重算覆盖 */
export interface ProgressRepository {
  get(bankId: string, questionId: string): Promise<QuestionProgress | null>;
  listByBank(bankId: string): Promise<readonly QuestionProgress[]>;
  save(progress: QuestionProgress): Promise<void>;
}

/** 续刷会话：一人一题库一份 */
export interface SessionRepository {
  getCurrent(bankId: string): Promise<PracticeSession | null>;
  save(session: PracticeSession): Promise<void>;
  clear(bankId: string): Promise<void>;
}

export interface AuthUser {
  readonly userId: string;
  readonly displayName: string | null;
  readonly isAnonymous: boolean;
}

export interface AuthAdapter {
  getUser(): Promise<AuthUser | null>;
  onAuthStateChange(listener: (user: AuthUser | null) => void): () => void;
  signOut(): Promise<void>;
}

/** 一个应用所需的全部外部能力，由各端组装后注入 */
export interface Platform {
  readonly clock: Clock;
  readonly banks: BankRepository;
  readonly attempts: AttemptRepository;
  readonly progress: ProgressRepository;
  readonly sessions: SessionRepository;
  readonly auth: AuthAdapter;
}
