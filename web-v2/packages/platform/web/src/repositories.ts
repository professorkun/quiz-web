/**
 * 仓储实现（ADR-0005）：所有查询都在键值能力上拼装，业务概念只出现在这里。
 *
 * 三条硬约束，直接对应 S3 的三个风险：
 * 1. **查询必带 `bankId`**：键名前缀就是库，想串库都得多写一行代码（风险：记录串库）。
 * 2. **作答只追加**：`append` 先查存在性，同 ID 直接跳过，永不覆盖（风险：历史被冲掉）。
 * 3. **收藏单独一条线**：不挂在 progress 上，所以进度重算不可能带走收藏（S3 验收 C）。
 *
 * 读的时候一律过 Schema：本地数据被手工改坏、或旧版本残留字段时，
 * 要在这里抛 `corrupt`，而不是把半截对象喂给页面。
 */

import {
  AppSettingsSchema,
  AttemptSchema,
  ExamRecordSchema,
  FavoriteEntrySchema,
  PracticeSessionSchema,
  PracticeSettingsSchema,
  QuestionProgressSchema,
  clearExamSelfRating,
  setExamSelfRating,
  type AppSettings,
  type Attempt,
  type BankContent,
  type BankManifest,
  type ExamRecord,
  type FavoriteEntry,
  type KnowledgeModule,
  type LearningSnapshot,
  type PracticeSettings,
  type Question,
  type QuestionProgress,
  type PracticeSession,
  type SelfRatingLevel,
} from "@quiz/core";
import {
  DEFAULT_PRACTICE_SETTINGS,
  StorageError,
  type AttemptRepository,
  type BankRepository,
  type Clock,
  type ExamRepository,
  type FavoriteRepository,
  type Platform,
  type ProgressRepository,
  type SessionRepository,
  type SessionSnapshotRepository,
  type SettingsRepository,
  type StorageInfo,
} from "@quiz/platform";

import type { KeyValueStore } from "./kv.js";

/** 当前快照版本：导出文件与本地存储共用，改结构时必须 +1 并写迁移 */
export const LEARNING_SNAPSHOT_VERSION = 1;

const K = {
  meta: "__meta__:schemaVersion",
  attempts: (bankId: string): string => `attempt:${bankId}:`,
  progress: (bankId: string): string => `progress:${bankId}:`,
  session: (bankId: string): string => `session:${bankId}`,
  favorites: (bankId: string): string => `favorite:${bankId}:`,
  appSettings: "settings:app",
  practiceSettings: (bankId: string): string => `settings:practice:${bankId}`,
  sessionSnapshot: (bankId: string): string => `session-snapshot:${bankId}`,
  examSessionSnapshot: (bankId: string): string => `exam-session:${bankId}`,
  examRecords: (bankId: string): string => `exam-record:${bankId}:`,
  examRecord: (bankId: string, recordId: string): string => `exam-record:${bankId}:${recordId}`,
  importedBanks: "bank:imported:",
  importedBank: (bankId: string): string => `bank:imported:${bankId}`,
  probe: "__probe__",
} as const;

function parseRow<T>(
  raw: string | null,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  label: string,
): T | null {
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new StorageError("corrupt", `${label} 的本地数据已损坏，无法解析`, { cause });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success || parsed.data === undefined) {
    throw new StorageError("corrupt", `${label} 的本地数据结构不符合契约`, { cause: parsed });
  }
  return parsed.data;
}

const byTimeThenId = (a: Attempt, b: Attempt): number =>
  a.submittedAt === b.submittedAt
    ? a.attemptId.localeCompare(b.attemptId)
    : a.submittedAt.localeCompare(b.submittedAt);

/* ------------------------------------------------------------------ 题库 */

class BankRepositoryImpl implements BankRepository {
  private readonly builtin = new Map<string, BankContent>();

  constructor(
    private readonly kv: KeyValueStore,
    builtin: readonly BankContent[],
  ) {
    for (const bank of builtin) this.builtin.set(bank.manifest.bankId, bank);
  }

  async listBankIds(): Promise<readonly string[]> {
    const importedKeys = await this.kv.keys(K.importedBanks);
    const imported = importedKeys
      .map((key) => key.slice(K.importedBanks.length))
      .filter((id) => !this.builtin.has(id))
      .sort((a, b) => a.localeCompare(b));
    return [...this.builtin.keys(), ...imported];
  }

  private async loadImported(bankId: string): Promise<BankContent | null> {
    const raw = await this.kv.get(K.importedBank(bankId));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as BankContent;
    } catch (cause) {
      throw new StorageError("corrupt", `导入题库 ${bankId} 的本地数据已损坏`, { cause });
    }
  }

  private async resolve(bankId: string): Promise<BankContent | null> {
    return this.builtin.get(bankId) ?? (await this.loadImported(bankId));
  }

  async getManifest(bankId: string): Promise<BankManifest | null> {
    const bank = await this.resolve(bankId);
    return bank === null ? null : bank.manifest;
  }

  async listQuestions(bankId: string): Promise<readonly Question[]> {
    const bank = await this.resolve(bankId);
    return bank === null ? [] : bank.questions;
  }

  async listKnowledge(bankId: string): Promise<readonly KnowledgeModule[]> {
    const bank = await this.resolve(bankId);
    return bank === null ? [] : bank.knowledge;
  }

  async saveImportedBank(pkg: BankContent): Promise<void> {
    const bankId = pkg.manifest.bankId;
    if (this.builtin.has(bankId)) {
      throw new StorageError(
        "corrupt",
        `题库 ${bankId} 是内置题库，不能被导入覆盖；请换一个 bankId`,
      );
    }
    await this.kv.set(K.importedBank(bankId), JSON.stringify(pkg));
  }

  async removeImportedBank(bankId: string): Promise<void> {
    if (this.builtin.has(bankId)) return; // 内置题库不可删，静默忽略而不是报错
    await this.kv.delete(K.importedBank(bankId));
  }
}

/* ------------------------------------------------------------- 答题事件 */

class AttemptRepositoryImpl implements AttemptRepository {
  constructor(private readonly kv: KeyValueStore) {}

  async append(attempt: Attempt): Promise<void> {
    const key = `${K.attempts(attempt.bankId)}${attempt.attemptId}`;
    const existing = await this.kv.get(key);
    // 幂等：同 ID 重放是空操作，绝不覆盖已有事件
    if (existing !== null) return;
    await this.kv.set(key, JSON.stringify(attempt));
  }

  async appendMany(attempts: readonly Attempt[]): Promise<void> {
    for (const attempt of attempts) await this.append(attempt);
  }

  async listByBank(bankId: string): Promise<readonly Attempt[]> {
    const keys = await this.kv.keys(K.attempts(bankId));
    const out: Attempt[] = [];
    for (const key of keys) {
      const row = parseRow<Attempt>(await this.kv.get(key), AttemptSchema, "答题记录");
      if (row !== null) out.push(row);
    }
    return out.sort(byTimeThenId);
  }

  async listByQuestion(bankId: string, questionId: string): Promise<readonly Attempt[]> {
    const all = await this.listByBank(bankId);
    return all.filter((a) => a.questionId === questionId);
  }

  async clearByBank(bankId: string): Promise<void> {
    for (const key of await this.kv.keys(K.attempts(bankId))) await this.kv.delete(key);
  }
}

/* ------------------------------------------------------------------ 进度 */

class ProgressRepositoryImpl implements ProgressRepository {
  constructor(private readonly kv: KeyValueStore) {}

  async get(bankId: string, questionId: string): Promise<QuestionProgress | null> {
    return parseRow<QuestionProgress>(
      await this.kv.get(`${K.progress(bankId)}${questionId}`),
      QuestionProgressSchema,
      "学习进度",
    );
  }

  async listByBank(bankId: string): Promise<readonly QuestionProgress[]> {
    const keys = await this.kv.keys(K.progress(bankId));
    const out: QuestionProgress[] = [];
    for (const key of keys) {
      const row = parseRow<QuestionProgress>(
        await this.kv.get(key),
        QuestionProgressSchema,
        "学习进度",
      );
      if (row !== null) out.push(row);
    }
    return out;
  }

  async save(progress: QuestionProgress): Promise<void> {
    await this.kv.set(`${K.progress(progress.bankId)}${progress.questionId}`, JSON.stringify(progress));
  }

  async saveMany(progress: readonly QuestionProgress[]): Promise<void> {
    for (const p of progress) await this.save(p);
  }

  async clearByBank(bankId: string): Promise<void> {
    for (const key of await this.kv.keys(K.progress(bankId))) await this.kv.delete(key);
  }
}

/* ------------------------------------------------------------------ 会话 */

class SessionRepositoryImpl implements SessionRepository {
  constructor(private readonly kv: KeyValueStore) {}

  async getCurrent(bankId: string): Promise<PracticeSession | null> {
    return parseRow<PracticeSession>(
      await this.kv.get(K.session(bankId)),
      PracticeSessionSchema,
      "练习会话",
    );
  }

  async save(session: PracticeSession): Promise<void> {
    await this.kv.set(K.session(session.bankId), JSON.stringify(session));
  }

  async clear(bankId: string): Promise<void> {
    await this.kv.delete(K.session(bankId));
  }
}

/* ------------------------------------------------------------------ 收藏 */

class FavoriteRepositoryImpl implements FavoriteRepository {
  constructor(private readonly kv: KeyValueStore) {}

  async add(bankId: string, questionId: string, addedAt: string): Promise<void> {
    const entry: FavoriteEntry = { bankId, questionId, addedAt };
    await this.kv.set(`${K.favorites(bankId)}${questionId}`, JSON.stringify(entry));
  }

  async remove(bankId: string, questionId: string): Promise<void> {
    await this.kv.delete(`${K.favorites(bankId)}${questionId}`);
  }

  async has(bankId: string, questionId: string): Promise<boolean> {
    return (await this.kv.get(`${K.favorites(bankId)}${questionId}`)) !== null;
  }

  async listByBank(bankId: string): Promise<readonly FavoriteEntry[]> {
    const keys = await this.kv.keys(K.favorites(bankId));
    const out: FavoriteEntry[] = [];
    for (const key of keys) {
      const row = parseRow<FavoriteEntry>(
        await this.kv.get(key),
        FavoriteEntrySchema,
        "收藏记录",
      );
      if (row !== null) out.push(row);
    }
    return out.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
}

/* ------------------------------------------------------------ 会话快照 */

class SessionSnapshotRepositoryImpl implements SessionSnapshotRepository {
  constructor(private readonly kv: KeyValueStore) {}

  async load(bankId: string): Promise<string | null> {
    return this.kv.get(K.sessionSnapshot(bankId));
  }

  async save(bankId: string, raw: string): Promise<void> {
    await this.kv.set(K.sessionSnapshot(bankId), raw);
  }

  async clear(bankId: string): Promise<void> {
    await this.kv.delete(K.sessionSnapshot(bankId));
  }
}

/* ------------------------------------------------------------------ 模考 */

class ExamRepositoryImpl implements ExamRepository {
  constructor(private readonly kv: KeyValueStore) {}

  async getSessionSnapshot(bankId: string): Promise<string | null> {
    return this.kv.get(K.examSessionSnapshot(bankId));
  }

  async saveSessionSnapshot(bankId: string, raw: string): Promise<void> {
    await this.kv.set(K.examSessionSnapshot(bankId), raw);
  }

  async clearSessionSnapshot(bankId: string): Promise<void> {
    await this.kv.delete(K.examSessionSnapshot(bankId));
  }

  /** 幂等：同 recordId 重放是空操作（成绩只增不改） */
  async appendRecord(record: ExamRecord): Promise<void> {
    const key = K.examRecord(record.bankId, record.recordId);
    if ((await this.kv.get(key)) !== null) return;
    await this.kv.set(key, JSON.stringify(record));
  }

  async listRecords(bankId: string): Promise<readonly ExamRecord[]> {
    const keys = await this.kv.keys(K.examRecords(bankId));
    const out: ExamRecord[] = [];
    for (const key of keys) {
      const row = parseRow<ExamRecord>(await this.kv.get(key), ExamRecordSchema, "模考成绩");
      if (row !== null) out.push(row);
    }
    // 新成绩在前；同一秒内按 recordId 稳定排序
    return out.sort((a, b) =>
      a.submittedAt === b.submittedAt
        ? b.recordId.localeCompare(a.recordId)
        : b.submittedAt.localeCompare(a.submittedAt),
    );
  }

  async getRecord(bankId: string, recordId: string): Promise<ExamRecord | null> {
    return parseRow<ExamRecord>(
      await this.kv.get(K.examRecord(bankId, recordId)),
      ExamRecordSchema,
      "模考成绩",
    );
  }

  /**
   * 自评是唯一可更新字段。走 core 的纯函数变换，
   * 客观得分/作答/明细在结构上就没有被写的路径。
   */
  async updateSelfRating(
    bankId: string,
    recordId: string,
    questionId: string,
    level: SelfRatingLevel | null,
    ratedAt: string,
  ): Promise<void> {
    const record = await this.getRecord(bankId, recordId);
    if (record === null) {
      throw new StorageError("corrupt", `成绩记录 ${recordId} 不存在，无法写入自评`);
    }
    const next =
      level === null
        ? clearExamSelfRating(record, questionId)
        : setExamSelfRating(record, questionId, level, ratedAt);
    await this.kv.set(K.examRecord(bankId, recordId), JSON.stringify(next));
  }

  async clearRecords(bankId: string): Promise<void> {
    for (const key of await this.kv.keys(K.examRecords(bankId))) await this.kv.delete(key);
    await this.clearSessionSnapshot(bankId);
  }
}

/* ------------------------------------------------------------------ 设置 */
class SettingsRepositoryImpl implements SettingsRepository {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly clock: Clock,
  ) {}

  async getApp(): Promise<AppSettings> {
    const row = parseRow<AppSettings>(
      await this.kv.get(K.appSettings),
      AppSettingsSchema,
      "应用设置",
    );
    return row ?? { activeBankId: null, practice: {}, updatedAt: this.clock.now().toISOString() };
  }

  async saveApp(settings: AppSettings): Promise<void> {
    await this.kv.set(K.appSettings, JSON.stringify(settings));
  }

  async getPractice(bankId: string): Promise<PracticeSettings> {
    const app = await this.getApp();
    const row = parseRow<PracticeSettings>(
      await this.kv.get(K.practiceSettings(bankId)),
      PracticeSettingsSchema,
      "练习设置",
    );
    return row ?? app.practice[bankId] ?? DEFAULT_PRACTICE_SETTINGS;
  }

  async savePractice(bankId: string, settings: PracticeSettings): Promise<void> {
    await this.kv.set(K.practiceSettings(bankId), JSON.stringify(settings));
    // 同时写回 app.practice，导出文件里才不会丢掉"每题库存了什么筛选条件"
    const app = await this.getApp();
    await this.saveApp({
      ...app,
      practice: { ...app.practice, [bankId]: settings },
      updatedAt: this.clock.now().toISOString(),
    });
  }
}

/* ------------------------------------------------------------------ 组装 */

export interface CreatePlatformOptions {
  readonly kv: KeyValueStore;
  readonly builtinBanks: readonly BankContent[];
  readonly clock: Clock;
}

/** 游客态：S3 不做登录，S6 换成真实适配器，接口不变 */
function createAnonymousAuth(): Platform["auth"] {
  return {
    getUser: async () => ({ userId: "local-guest", displayName: null, isAnonymous: true }),
    onAuthStateChange: () => () => {
      /* S6 才有登录态变化 */
    },
    signOut: async () => {
      /* 游客无会话可退 */
    },
  };
}

export function createPlatform(options: CreatePlatformOptions): Platform {
  const { kv, builtinBanks, clock } = options;
  const banks = new BankRepositoryImpl(kv, builtinBanks);
  const attempts = new AttemptRepositoryImpl(kv);
  const progress = new ProgressRepositoryImpl(kv);
  const sessions = new SessionRepositoryImpl(kv);
  const sessionSnapshots = new SessionSnapshotRepositoryImpl(kv);
  const exams = new ExamRepositoryImpl(kv);
  const favorites = new FavoriteRepositoryImpl(kv);
  const settings = new SettingsRepositoryImpl(kv, clock);

  const info = async (): Promise<StorageInfo> => {
    let writable = true;
    let reason: string | null = null;
    try {
      await kv.set(K.probe, "1");
      await kv.delete(K.probe);
    } catch (cause) {
      writable = false;
      reason =
        cause instanceof StorageError
          ? cause.message
          : "本地存储不可写，本次记录只保存在内存中";
    }
    const usageBytes = await kv.usageBytes().catch(() => null);
    return { usageBytes, writable, reason };
  };

  const exportAll = async (): Promise<LearningSnapshot> => {
    const bankIds = await banks.listBankIds();
    const allAttempts: Attempt[] = [];
    const allProgress: QuestionProgress[] = [];
    const allFavorites: FavoriteEntry[] = [];
    const allSessions: PracticeSession[] = [];
    const allExamRecords: ExamRecord[] = [];
    for (const bankId of bankIds) {
      allAttempts.push(...(await attempts.listByBank(bankId)));
      allProgress.push(...(await progress.listByBank(bankId)));
      allFavorites.push(...(await favorites.listByBank(bankId)));
      allExamRecords.push(...(await exams.listRecords(bankId)));
      const session = await sessions.getCurrent(bankId);
      if (session !== null) allSessions.push(session);
    }
    return {
      schemaVersion: LEARNING_SNAPSHOT_VERSION,
      exportedAt: clock.now().toISOString(),
      attempts: allAttempts,
      progress: allProgress,
      favorites: allFavorites,
      sessions: allSessions,
      settings: await settings.getApp(),
      examRecords: allExamRecords,
    };
  };

  /**
   * 清空学习记录：保留导入的题库与 schema 版本标记。
   * 题库内容不是"学习记录"，清记录连题库一起删会让「清空后重练」变成「要重新导入」。
   */
  const clearLearningData = async (bankId?: string): Promise<void> => {
    if (bankId !== undefined) {
      await attempts.clearByBank(bankId);
      await progress.clearByBank(bankId);
      await sessions.clear(bankId);
      await exams.clearRecords(bankId);
      for (const key of await kv.keys(K.favorites(bankId))) await kv.delete(key);
      await kv.delete(K.practiceSettings(bankId));
      return;
    }
    for (const key of await kv.keys()) {
      if (key === K.meta || key.startsWith(K.importedBanks)) continue;
      await kv.delete(key);
    }
  };

  return {
    clock,
    banks,
    attempts,
    progress,
    sessions,
    sessionSnapshots,
    exams,
    favorites,
    settings,
    auth: createAnonymousAuth(),
    info,
    exportAll,
    clearLearningData,
  };
}

export { K as STORAGE_KEYS };
