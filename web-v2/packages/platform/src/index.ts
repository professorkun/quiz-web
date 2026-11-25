/**
 * 平台适配器接口（ADR-0002、ADR-0005）。
 *
 * 这一层**只有接口，没有实现**：Web 端实现放 `platform/web`，
 * 将来的 Android / 小程序各写一份。业务规则一律不许出现在这一层。
 *
 * 为什么不直接 `localStorage.getItem`：那样 `core` 就没法在 Node 里测，
 * 也没法换存储。旧版就是一路 `localStorage` + 云 SDK 直接写进页面逻辑，
 * 结果是判分和存储焊死，连单测都做不了。
 *
 * S3 的三条追加约束（ADR-0005）：
 * 1. 仓储方法只表达「取什么、存什么」，不出现游标/索引/事务等存储实现概念；
 * 2. 所有记录强制带 `bankId`，查询必带库过滤——串库是 S3 的头号风险；
 * 3. 存储不可用必须抛 `StorageError`，页面据此提示，不许静默吞掉。
 */

import type {
  Attempt,
  BankContent,
  ExamRecord,
  ExamSelfRating,
  KnowledgeModule,
  Passage,
  PracticeSession,
  Question,
  QuestionProgress,
  BankManifest,
  AppSettings,
  FavoriteEntry,
  LearningSnapshot,
  PracticeSettings,
  SelfRatingLevel,
} from "@quiz/core";

export type { AppSettings, FavoriteEntry, LearningSnapshot, PracticeSettings };

/** 时间必须注入：否则「最近 7 天复习」这类统计无法测试 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** 存储失败的分类。页面文案按 kind 分支，不靠匹配错误字符串 */
export type StorageFailureKind = "unavailable" | "quota" | "corrupt" | "version";

export class StorageError extends Error {
  readonly kind: StorageFailureKind;

  constructor(kind: StorageFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StorageError";
    this.kind = kind;
  }
}

export interface StorageInfo {
  /** 已占用字节数的估算；实现给不出时为 null（不许编一个数字） */
  readonly usageBytes: number | null;
  /** 写入是否可用。隐私模式/配额满时为 false，页面要提示而不是白屏 */
  readonly writable: boolean;
  /** 不可写时的可读原因 */
  readonly reason: string | null;
}

/** 题库包：内容来自 `packages/content`（内置）或用户导入（本地） */
export interface BankRepository {
  /** 当前可用的题库 ID 列表（内置 + 导入），顺序稳定 */
  listBankIds(): Promise<readonly string[]>;
  /** 只列「导入」的题库：内置题库不可删，管理面板据此决定是否显示删除 */
  listImportedBankIds(): Promise<readonly string[]>;
  getManifest(bankId: string): Promise<BankManifest | null>;
  listQuestions(bankId: string): Promise<readonly Question[]>;
  /** 知识讲义随题库走，换库即换内容（S3 验收 D 的最后一条） */
  listKnowledge(bankId: string): Promise<readonly KnowledgeModule[]>;
  /** 共享材料（R4-2）：旧题库没有该字段时返回空数组 */
  listPassages(bankId: string): Promise<readonly Passage[]>;
  /** 导入的题库落本地；同名 bankId 视为覆盖，调用方必须先确认 */
  saveImportedBank(pkg: BankContent): Promise<void>;
  /** 只删导入的题库；内置题库不可删，实现应直接忽略 */
  removeImportedBank(bankId: string): Promise<void>;
}

/**
 * 答题事件是**只追加**的。任何"覆盖上一次作答"的实现都违反契约，
 * 因为 `isFirstAttempt` 与首次正确率都要靠这段历史算出来。
 *
 * `append` 必须幂等：同一 `attemptId` 重复写入是空操作（重试不产生副本）。
 */
export interface AttemptRepository {
  append(attempt: Attempt): Promise<void>;
  appendMany(attempts: readonly Attempt[]): Promise<void>;
  listByBank(bankId: string): Promise<readonly Attempt[]>;
  listByQuestion(bankId: string, questionId: string): Promise<readonly Attempt[]>;
  /** 清空派生状态后重算（S4）用；只清题库，不跨库 */
  clearByBank(bankId: string): Promise<void>;
}

/** 进度是派生数据，允许重算覆盖 */
export interface ProgressRepository {
  get(bankId: string, questionId: string): Promise<QuestionProgress | null>;
  listByBank(bankId: string): Promise<readonly QuestionProgress[]>;
  save(progress: QuestionProgress): Promise<void>;
  saveMany(progress: readonly QuestionProgress[]): Promise<void>;
  clearByBank(bankId: string): Promise<void>;
}

/** 续刷会话：一人一题库一份 */
export interface SessionRepository {
  getCurrent(bankId: string): Promise<PracticeSession | null>;
  save(session: PracticeSession): Promise<void>;
  clear(bankId: string): Promise<void>;
}

/**
 * 引擎会话快照（`SessionSnapshot` 的原始串）。
 *
 * 为什么不并进 `SessionRepository`：那个存的是"这道题对还是错"的摘要，
 * 快照存的是"选项按什么顺序展示、当时选了什么"，两者版本与用途都不同。
 * 这里刻意只进出字符串，避免存储层认识引擎的内部结构。
 */
export interface SessionSnapshotRepository {
  load(bankId: string): Promise<string | null>;
  save(bankId: string, raw: string): Promise<void>;
  clear(bankId: string): Promise<void>;
}

/**
 * 模考（S5）：会话快照与成绩记录分开两条线。
 *
 * 成绩记录**只增不改**（§9 回退方案）：`appendRecord` 幂等（同 recordId 跳过），
 * 唯一允许的更新是主观题自评（`updateSelfRating`）——仓库只接受档位，
 * 客观得分、作答原文、判分明细没有任何写入口。
 */
export interface ExamRepository {
  /** 未交卷的模考会话快照（原始串）；按题库各一份，不与练习快照混存 */
  getSessionSnapshot(bankId: string): Promise<string | null>;
  saveSessionSnapshot(bankId: string, raw: string): Promise<void>;
  clearSessionSnapshot(bankId: string): Promise<void>;
  appendRecord(record: ExamRecord): Promise<void>;
  listRecords(bankId: string): Promise<readonly ExamRecord[]>;
  getRecord(bankId: string, recordId: string): Promise<ExamRecord | null>;
  /**
   * 自评档位（`level` 传 null 清除）。只动该题的 `selfRating` 与自评合计；
   * 对客观题调用是空操作（与 core 的不变式一致）。
   */
  updateSelfRating(
    bankId: string,
    recordId: string,
    questionId: string,
    level: SelfRatingLevel | null,
    ratedAt: string,
  ): Promise<void>;
  clearRecords(bankId: string): Promise<void>;
}

/**
 * 收藏**独立于错题**（S3 验收 C / S4 验收 C）：
 * 答对、掌握、移出错题都不许删除收藏，所以这里没有"按状态联动清理"的入口。
 */
export interface FavoriteRepository {
  add(bankId: string, questionId: string, addedAt: string): Promise<void>;
  remove(bankId: string, questionId: string): Promise<void>;
  /** 原样写入一条（可能带墓碑）：同步合并用，避免"删除"被重新盖章 */
  put(entry: FavoriteEntry): Promise<void>;
  has(bankId: string, questionId: string): Promise<boolean>;
  /** 展示用：已过滤墓碑 */
  listByBank(bankId: string): Promise<readonly FavoriteEntry[]>;
  /** 同步用：**包含**墓碑，否则"取消收藏"永远传不到另一台设备 */
  listForSync(bankId: string): Promise<readonly FavoriteEntry[]>;
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  order: "random",
  topicIds: [],
  types: [],
  limit: 10,
  onlyUnseen: false,
  onlyUnmastered: false,
  mode: "practice",
};

export function defaultAppSettings(now: string): AppSettings {
  return { activeBankId: null, practice: {}, updatedAt: now };
}

/** 设置读不到时返回默认值，而不是 null——页面不必到处判空 */
export interface SettingsRepository {
  getApp(): Promise<AppSettings>;
  saveApp(settings: AppSettings): Promise<void>;
  getPractice(bankId: string): Promise<PracticeSettings>;
  savePractice(bankId: string, settings: PracticeSettings): Promise<void>;
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
  readonly sessionSnapshots: SessionSnapshotRepository;
  readonly exams: ExamRepository;
  readonly favorites: FavoriteRepository;
  readonly settings: SettingsRepository;
  readonly auth: AuthAdapter;
  /** 存储健康度（占用、可写性）。页面在「我的」页展示 */
  info(): Promise<StorageInfo>;
  /** 导出全部学习记录（不含题库内容） */
  exportAll(): Promise<LearningSnapshot>;
  /** 清空学习记录；传 bankId 时只清该库 */
  clearLearningData(bankId?: string): Promise<void>;
  /**
   * 删除导入题库并**级联清理该库的全部派生键**（V2.2 · R3）：
   * 作答 / 进度 / 会话 / 会话快照 / 收藏 / 练习设置 / 模考成绩 / 模考会话。
   * 内置题库不可删：方法静默返回，不清理任何记录（避免"删了题却留着记录"）。
   */
  deleteImportedBank(bankId: string): Promise<void>;
}
