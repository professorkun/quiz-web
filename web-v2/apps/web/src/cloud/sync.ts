/**
 * 全量快照同步（S6 · T6-4）。
 *
 * 口径：**每次同步 = 拉取云快照 → 与本地合并成并集 → 写回云**（本地随后已是并集）。
 * 取舍理由：个人题库数据量小，全量最稳；增量双向的冲突规则更易出错。
 *
 * 结构上刻意分成三块，便于测试：
 *  1. `SyncTransport` —— 云读写抽象（真实实现走 cloud.database，测试用内存实现）。
 *  2. 纯映射函数 `xxxToRow` / `rowToXxx`（core ↔ 云行，camelCase ↔ snake_case，JSONB 原样）。
 *  3. `pushAll` / `pullAndMerge` / `syncAll`（编排）。
 *
 * 四条硬约束：
 *  - **客户端绝不发 owner_id**：由 `DEFAULT auth.uid()` + RLS 决定归属。
 *  - **只追加表用幂等键去重**（attempts.attempt_id / exam_records_v2.record_id）。
 *  - **可变表（progress/sessions/settings）按各自的时间戳 LWW**：
 *    progress 用 `updatedAt`、sessions/settings 用 `updatedAt`，没有时间戳的旧数据才退回按次数比。
 *  - **进度只是事件的投影**：拉完先按事件重算，且没有事件支撑的进度行不推上云；
 *    收藏的"取消"用墓碑（removedAt）表达，否则并集会把它复活。
 */

import type {
  AppSettings,
  Attempt,
  ExamRecord,
  FavoriteEntry,
  PracticeSession,
  QuestionProgress,
} from "@quiz/core";
import { recomputeProgress } from "@quiz/data";
import type { Platform } from "@quiz/platform";

export type CloudRow = Record<string, unknown>;

export interface SyncTransport {
  select(table: string): Promise<CloudRow[]>;
  /** 存在则忽略（只追加表用） */
  insertIgnore(table: string, rows: CloudRow[], onConflict: string): Promise<void>;
  /** 存在则更新（可变表用） */
  upsert(table: string, rows: CloudRow[], onConflict: string): Promise<void>;
}

/* --------------------------------------------------------- 映射：core ↔ 行 */

function iso(value: unknown): string {
  return typeof value === "string" ? value : new Date(String(value)).toISOString();
}
function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return new Date(String(value)).toISOString();
}
function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}
function str(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

/* ---- attempts ---- */
function attemptToRow(a: Attempt): CloudRow {
  return {
    attempt_id: a.attemptId,
    bank_id: a.bankId,
    question_id: a.questionId,
    question_revision: a.questionRevision,
    mode: a.mode,
    is_first_attempt: a.isFirstAttempt,
    started_at: a.startedAt,
    submitted_at: a.submittedAt,
    answer: a.answer ?? null,
    correct: a.correct,
    score: a.score,
    max_score: a.maxScore,
    session_id: a.sessionId ?? null,
    duration_ms: a.durationMs ?? null,
    imported_from: a.importedFrom ?? null,
  };
}
function rowToAttempt(r: CloudRow): Attempt {
  return {
    attemptId: str(r.attempt_id),
    bankId: str(r.bank_id),
    questionId: str(r.question_id),
    questionRevision: str(r.question_revision),
    mode: str(r.mode) as Attempt["mode"],
    isFirstAttempt: r.is_first_attempt === true,
    startedAt: iso(r.started_at),
    submittedAt: iso(r.submitted_at),
    answer: r.answer,
    correct: typeof r.correct === "boolean" ? r.correct : null,
    score: num(r.score),
    maxScore: num(r.max_score),
    ...(r.session_id == null ? {} : { sessionId: str(r.session_id) }),
    ...(r.duration_ms == null ? {} : { durationMs: num(r.duration_ms) }),
    ...(r.imported_from == null ? {} : { importedFrom: str(r.imported_from) }),
  };
}

/* ---- question_progress ---- */
function progressToRow(p: QuestionProgress, now: string): CloudRow {
  return {
    bank_id: p.bankId,
    question_id: p.questionId,
    attempts_count: p.attemptsCount,
    wrong_count: p.wrongCount,
    first_correct_at: p.firstCorrectAt,
    last_attempt_at: p.lastAttemptAt,
    mastered: p.mastered,
    status: p.status,
    streak: p.streak,
    next_review_at: p.nextReviewAt,
    error_cause: p.errorCause,
    note: p.note ?? null,
    // 用行自己的变更时间，而不是"推送这一刻"：否则云端 updated_at 全等，
    // LWW 永远偏向最后同步的设备（实测 35 条进度行时间戳完全一致）。
    updated_at: p.updatedAt ?? now,
  };
}
function rowToProgress(r: CloudRow): QuestionProgress {
  return {
    bankId: str(r.bank_id),
    questionId: str(r.question_id),
    attemptsCount: num(r.attempts_count),
    wrongCount: num(r.wrong_count),
    firstCorrectAt: isoOrNull(r.first_correct_at),
    lastAttemptAt: isoOrNull(r.last_attempt_at),
    mastered: r.mastered === true,
    status: str(r.status) as QuestionProgress["status"],
    streak: num(r.streak),
    nextReviewAt: isoOrNull(r.next_review_at),
    errorCause: (r.error_cause ?? null) as QuestionProgress["errorCause"],
    ...(r.note == null ? {} : { note: str(r.note) }),
    ...(r.updated_at == null ? {} : { updatedAt: iso(r.updated_at) }),
  };
}

/* ---- practice_sessions ---- */
function sessionToRow(s: PracticeSession): CloudRow {
  return {
    bank_id: s.bankId,
    session_id: s.sessionId,
    mode: s.mode,
    question_ids: s.questionIds,
    cursor: s.cursor,
    results: s.results,
    started_at: s.startedAt,
    updated_at: s.updatedAt,
    finished_at: s.finishedAt ?? null,
  };
}
function rowToSession(r: CloudRow): PracticeSession {
  return {
    sessionId: str(r.session_id),
    bankId: str(r.bank_id),
    mode: str(r.mode) as PracticeSession["mode"],
    questionIds: (r.question_ids as string[]) ?? [],
    cursor: num(r.cursor),
    results: (r.results as PracticeSession["results"]) ?? {},
    startedAt: iso(r.started_at),
    updatedAt: iso(r.updated_at),
    ...(r.finished_at == null ? {} : { finishedAt: iso(r.finished_at) }),
  };
}

/* ---- exam_records_v2 ---- */
function examRecordToRow(e: ExamRecord): CloudRow {
  return {
    record_id: e.recordId,
    bank_id: e.bankId,
    template_id: e.templateId,
    session_id: e.sessionId,
    seed: e.seed,
    started_at: e.startedAt,
    submitted_at: e.submittedAt,
    duration_sec: e.durationSec,
    timed_out: e.timedOut,
    objective_score: e.objectiveScore,
    objective_max: e.objectiveMax,
    self_score: e.selfScore,
    self_max: e.selfMax,
    total_score: e.totalScore,
    total_max: e.totalMax,
    items: e.items,
  };
}
function rowToExamRecord(r: CloudRow): ExamRecord {
  return {
    recordId: str(r.record_id),
    bankId: str(r.bank_id),
    templateId: str(r.template_id),
    sessionId: str(r.session_id),
    seed: num(r.seed),
    startedAt: iso(r.started_at),
    submittedAt: iso(r.submitted_at),
    durationSec: num(r.duration_sec),
    timedOut: r.timed_out === true,
    objectiveScore: num(r.objective_score),
    objectiveMax: num(r.objective_max),
    selfScore: num(r.self_score),
    selfMax: num(r.self_max),
    totalScore: num(r.total_score),
    totalMax: num(r.total_max),
    items: (r.items as ExamRecord["items"]) ?? [],
  };
}

/* --------------------------------------------------------------- 上行（推） */

const pk = (bankId: string, questionId: string): string => `${bankId}::${questionId}`;

function progressByKey(list: readonly QuestionProgress[]): Map<string, QuestionProgress> {
  const m = new Map<string, QuestionProgress>();
  for (const p of list) m.set(`${p.bankId}::${p.questionId}`, p);
  return m;
}

/**
 * 进度冲突判定：**有时间戳就按时间戳**（这是唯一能分辨"次数相同、备注被改过"的依据），
 * 时间戳相同或缺失（升级前的旧数据）才退回"作答次数大者胜"。
 */
function pickProgress(
  local: QuestionProgress,
  cloud: QuestionProgress,
  countsNewer: boolean,
): { readonly side: "cloud" | "local"; readonly byTimestamp: boolean } {
  const lAt = local.updatedAt;
  const cAt = cloud.updatedAt;
  if (lAt !== undefined && cAt !== undefined && lAt !== cAt) {
    return { side: cAt > lAt ? "cloud" : "local", byTimestamp: true };
  }
  return { side: countsNewer ? "cloud" : "local", byTimestamp: false };
}

/** 把本地快照推到云（存在则更新/忽略，幂等） */
export async function pushAll(transport: SyncTransport, platform: Platform): Promise<void> {
  const snapshot = await platform.exportAll();

  if (snapshot.attempts.length > 0) {
    await transport.insertIgnore("attempts", snapshot.attempts.map(attemptToRow), "attempt_id");
  }
  if (snapshot.examRecords.length > 0) {
    await transport.insertIgnore(
      "exam_records_v2",
      snapshot.examRecords.map(examRecordToRow),
      "record_id",
    );
  }

  const now = new Date().toISOString();
  // 进度只能是事件的投影：没有作答事件支撑的进度行不上云，
  // 否则会把「有进度、没记录」的漂移从一个设备搬到另一个设备。
  const answered = new Set(snapshot.attempts.map((a) => pk(a.bankId, a.questionId)));
  const progressRows = snapshot.progress
    .filter((p) => answered.has(pk(p.bankId, p.questionId)))
    .map((p) => progressToRow(p, now));
  if (progressRows.length > 0) {
    await transport.upsert("question_progress", progressRows, "owner_id,bank_id,question_id");
  }

  // 会话：一人一题库一份，逐库 upsert
  const banks = await platform.banks.listBankIds();
  const sessionRows: CloudRow[] = [];
  for (const bankId of banks) {
    const s = await platform.sessions.getCurrent(bankId);
    if (s !== null) sessionRows.push(sessionToRow(s));
  }
  if (sessionRows.length > 0) {
    await transport.upsert("practice_sessions", sessionRows, "owner_id,bank_id");
  }

  // 偏好 + 收藏：一人一行
  const favorites: FavoriteEntry[] = [];
  // listForSync 带墓碑：不带的话「取消收藏」永远传不出去（云端并集会把删掉的又加回来）
  for (const bankId of banks) favorites.push(...(await platform.favorites.listForSync(bankId)));
  const settings = snapshot.settings;
  await transport.upsert(
    "user_preferences",
    [
      {
        active_bank_id: settings.activeBankId,
        practice: settings.practice,
        favorites,
        updated_at: settings.updatedAt,
      },
    ],
    "owner_id",
  );
}

/* --------------------------------------------------------------- 下行（拉） */

/** 拉云快照并与本地合并成并集（写回本地） */
export async function pullAndMerge(transport: SyncTransport, platform: Platform): Promise<void> {
  // 只追加：append 幂等（同 attemptId / recordId 跳过）
  const attemptRows = await transport.select("attempts");
  if (attemptRows.length > 0) {
    await platform.attempts.appendMany(attemptRows.map(rowToAttempt));
  }
  const examRows = await transport.select("exam_records_v2");
  for (const row of examRows) {
    await platform.exams.appendRecord(rowToExamRecord(row));
  }

  // 进度：计数与时间取更新的一方；备注/错因按字段合并（否则"备注改了传不过去"）
  const cloudProgress = (await transport.select("question_progress")).map(rowToProgress);
  const localProgress = new Map<string, QuestionProgress>();
  for (const bankId of await platform.banks.listBankIds()) {
    for (const p of await platform.progress.listByBank(bankId)) localProgress.set(pk(p.bankId, p.questionId), p);
  }
  for (const c of cloudProgress) {
    const l = localProgress.get(pk(c.bankId, c.questionId));
    if (l === undefined) {
      await platform.progress.save(c);
      continue;
    }
    const countsNewer =
      c.attemptsCount > l.attemptsCount ||
      (c.attemptsCount === l.attemptsCount && (c.lastAttemptAt ?? "") > (l.lastAttemptAt ?? ""));
    const winner = pickProgress(l, c, countsNewer);
    const base = winner.side === "cloud" ? c : l;
    // 按时间戳判出胜负时，整行取胜方（包括"备注被清空"这种意图）；
    // 只有无法判新旧时才按"非空优先"兜底，避免旧数据互相抹备注。
    const note = winner.byTimestamp ? base.note : (c.note ?? l.note);
    const errorCause = winner.byTimestamp ? base.errorCause : (c.errorCause ?? l.errorCause);
    const merged: QuestionProgress = {
      ...base,
      ...(note === undefined ? {} : { note }),
      ...(errorCause === null || errorCause === undefined ? {} : { errorCause }),
    };
    const changed =
      merged.attemptsCount !== l.attemptsCount ||
      merged.status !== l.status ||
      merged.note !== l.note ||
      merged.errorCause !== l.errorCause ||
      merged.updatedAt !== l.updatedAt;
    if (changed) await platform.progress.save(merged);
  }

  // 会话：LWW（updatedAt 晚者胜）
  for (const row of await transport.select("practice_sessions")) {
    const s = rowToSession(row);
    const local = await platform.sessions.getCurrent(s.bankId);
    if (local === null || s.updatedAt > local.updatedAt) await platform.sessions.save(s);
  }

  // 偏好：LWW（updatedAt 晚者胜）；收藏：按最后一次动作（新增或取消）的时间戳裁决
  const prefRows = await transport.select("user_preferences");
  if (prefRows.length > 0) {
    const r = prefRows[0]!;
    const current = await platform.settings.getApp();
    const cloudUpdated = iso(r.updated_at);
    if (prefRows.length > 0 && cloudUpdated > current.updatedAt) {
      const next: AppSettings = {
        // `|| null` 而不是 `?? null`：兼容旧客户端写进云端的空串（契约只认 null 或真实 ID）
        activeBankId: (r.active_bank_id || null) as string | null,
        practice: (r.practice as AppSettings["practice"]) ?? {},
        updatedAt: cloudUpdated,
      };
      // 偏好是 LWW 合并，单行不合契约不应连累后面的收藏合并：跳过并留痕，不中断同步
      await platform.settings.saveApp(next).catch((cause) => {
        console.warn("云端偏好行不符合契约，已跳过合并（本机设置不受影响）", cause);
      });
    }
    const cloudFavs = (r.favorites as FavoriteEntry[]) ?? [];
    if (cloudFavs.length > 0) {
      const localFavs = new Map<string, FavoriteEntry>();
      for (const bankId of await platform.banks.listBankIds()) {
        for (const f of await platform.favorites.listForSync(bankId)) localFavs.set(pk(f.bankId, f.questionId), f);
      }
      // 收藏/取消都按"最后一次动作"判新旧：取消是墓碑（removedAt），不是删除行
      const stamp = (entry: FavoriteEntry): string => entry.removedAt ?? entry.addedAt;
      for (const f of cloudFavs) {
        const mine = localFavs.get(pk(f.bankId, f.questionId));
        if (mine === undefined || stamp(f) > stamp(mine)) await platform.favorites.put(f);
      }
    }
  }

  // 合并完事件，再按事件重算一遍进度：进度是投影，不是第二份真源。
  // 这一步同时修掉"云端有进度、本地没有对应事件"的漂移（实测云上 35 条进度只对得上 4 条事件）。
  await reprojectProgress(platform);
}

/**
 * 由（已合并的）作答事件重算进度并写回本地。
 *
 * 只算"有事件"的题：没有事件的进度行留着不动——它可能是旧版导入的
 * 掌握标记，删掉等于替用户做决定；但 `pushAll` 不会再把它推上云。
 * 备注（note）是手写标注、事件里没有，重算时必须原样带回，否则一次同步就抹掉。
 */
export async function reprojectProgress(platform: Platform): Promise<void> {
  for (const bankId of await platform.banks.listBankIds()) {
    const attempts = await platform.attempts.listByBank(bankId);
    if (attempts.length === 0) continue;

    const previous = new Map<string, QuestionProgress>();
    for (const p of await platform.progress.listByBank(bankId)) previous.set(pk(p.bankId, p.questionId), p);

    const next = recomputeProgress(attempts).map((derived) => {
      const before = previous.get(pk(derived.bankId, derived.questionId));
      if (before === undefined) return derived; // 新行，落库时会盖上当前时间
      // 重算只改派生字段；手写备注与**原变更时间**必须原样带回——
      // 每次同步都刷新时间戳的话，LWW 就永远偏向最后同步的那台设备。
      return {
        ...derived,
        ...(before.note === undefined ? {} : { note: before.note }),
        ...(before.updatedAt === undefined ? {} : { updatedAt: before.updatedAt }),
      };
    });
    await platform.progress.saveMany(next);
  }
}

/** 一次完整同步：先拉取合并（本地→并集），再推回云（云→并集） */
export async function syncAll(transport: SyncTransport, platform: Platform): Promise<void> {
  await pullAndMerge(transport, platform);
  await pushAll(transport, platform);
}

export { attemptToRow, rowToAttempt, progressByKey };
