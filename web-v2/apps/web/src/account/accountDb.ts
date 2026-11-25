/**
 * 本机账号数据库（IndexedDB）。
 *
 * 账号、密码摘要与登录会话都存进数据库，而不是 localStorage：
 * - 数据库 `quiz-auth`，表 `accounts`（账号）与 `session`（当前登录会话）；
 * - 浏览器不支持 IndexedDB（如单测环境）时退回进程内内存，接口不变；
 * - 首次启动把旧版本 localStorage 里的账号与会话迁移进来，迁移后删除旧键。
 */

const DB_NAME = "quiz-auth";
const DB_VERSION = 1;
const ACCOUNT_STORE = "accounts";
const SESSION_STORE = "session";
const SESSION_KEY = "current";

const LEGACY_ACCOUNTS_KEY = "quiz.local.accounts.v1";
const LEGACY_SESSION_KEY = "quiz.local.session.v1";

export interface StoredAccount {
  readonly userId: string;
  readonly username: string;
  readonly salt: string;
  readonly passwordHash: string;
  readonly createdAt: string;
  /** 旧记录没有该字段，按 version=1 处理 */
  readonly credentialVersion?: 1 | 2;
  readonly kdf?: "sha256" | "pbkdf2-sha256";
  readonly iterations?: number;
  readonly failedAttempts?: number;
  readonly lockedUntil?: string;
}

export interface StoredSession {
  readonly id: typeof SESSION_KEY;
  readonly userId: string;
  /** 随机 32 字节 hex；旧会话可无 */
  readonly token?: string;
  /** ISO 过期时间；旧会话可无（按兼容接受） */
  readonly expiresAt?: string;
}

/** 会话有效期：30 天 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const memory = {
  accounts: new Map<string, StoredAccount>(),
  session: null as StoredSession | null,
};

let dbPromise: Promise<IDBDatabase> | null = null;
let legacyMigrated = false;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 请求失败"));
  });
}

function isStoredAccount(value: unknown): value is StoredAccount {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<StoredAccount>;
  return (
    typeof row.userId === "string" &&
    typeof row.username === "string" &&
    typeof row.salt === "string" &&
    typeof row.passwordHash === "string" &&
    typeof row.createdAt === "string"
  );
}

async function allAccounts(db: IDBDatabase): Promise<StoredAccount[]> {
  const tx = db.transaction(ACCOUNT_STORE, "readonly");
  const rows = await requestToPromise(
    tx.objectStore(ACCOUNT_STORE).getAll() as IDBRequest<unknown[]>,
  );
  return rows.filter(isStoredAccount);
}

async function putAccount(db: IDBDatabase, account: StoredAccount): Promise<void> {
  const tx = db.transaction(ACCOUNT_STORE, "readwrite");
  await requestToPromise(tx.objectStore(ACCOUNT_STORE).put(account));
}

async function getSession(db: IDBDatabase): Promise<StoredSession | null> {
  const tx = db.transaction(SESSION_STORE, "readonly");
  const row = await requestToPromise(
    tx.objectStore(SESSION_STORE).get(SESSION_KEY) as IDBRequest<StoredSession | undefined>,
  );
  if (row === undefined) return null;
  // 过期会话直接作废：读完即删，避免下次启动又被当成登录态
  if (row.expiresAt !== undefined && Date.parse(row.expiresAt) <= Date.now()) {
    await putSessionRecord(db, null);
    return null;
  }
  return row;
}

async function putSessionRecord(db: IDBDatabase, session: StoredSession | null): Promise<void> {
  const tx = db.transaction(SESSION_STORE, "readwrite");
  const store = tx.objectStore(SESSION_STORE);
  if (session === null) await requestToPromise(store.delete(SESSION_KEY));
  else await requestToPromise(store.put(session));
}

function randomToken(): string | undefined {
  if (typeof globalThis.crypto?.getRandomValues !== "function") return undefined;
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

function buildSession(userId: string): StoredSession {
  const token = randomToken();
  return {
    id: SESSION_KEY,
    userId,
    ...(token === undefined ? {} : { token }),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

async function putSession(db: IDBDatabase, userId: string | null): Promise<void> {
  await putSessionRecord(db, userId === null ? null : buildSession(userId));
}

/** 把旧版本存在 localStorage 的账号 / 会话搬进数据库，只执行一次 */
async function migrateLegacy(db: IDBDatabase): Promise<void> {
  if (legacyMigrated) return;
  legacyMigrated = true;

  let rawAccounts: string | null = null;
  let legacySession: string | null = null;
  try {
    rawAccounts = globalThis.localStorage.getItem(LEGACY_ACCOUNTS_KEY);
    legacySession = globalThis.localStorage.getItem(LEGACY_SESSION_KEY);
  } catch {
    return;
  }
  if (rawAccounts === null && legacySession === null) return;

  if (rawAccounts !== null) {
    try {
      const parsed: unknown = JSON.parse(rawAccounts);
      const rows = Array.isArray(parsed) ? parsed.filter(isStoredAccount) : [];
      if (rows.length > 0) {
        const existing = new Set((await allAccounts(db)).map((a) => a.username.toLowerCase()));
        for (const account of rows) {
          if (existing.has(account.username.toLowerCase())) continue;
          await putAccount(db, account);
          existing.add(account.username.toLowerCase());
        }
      }
    } catch {
      // 旧数据损坏就跳过，不阻塞登录
    }
  }
  if (legacySession !== null && (await getSession(db)) === null) {
    await putSession(db, legacySession);
  }

  try {
    globalThis.localStorage.removeItem(LEGACY_ACCOUNTS_KEY);
    globalThis.localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // 清不掉旧键也不影响使用
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise !== null) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前环境没有 IndexedDB"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ACCOUNT_STORE)) {
        db.createObjectStore(ACCOUNT_STORE, { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      void migrateLegacy(db)
        .catch(() => null)
        .finally(() => resolve(db));
    };
    request.onerror = () => reject(request.error ?? new Error("无法打开账号数据库"));
  });
  return dbPromise;
}

export async function loadAccounts(): Promise<StoredAccount[]> {
  try {
    return await allAccounts(await openDb());
  } catch {
    return [...memory.accounts.values()];
  }
}

export async function saveAccount(account: StoredAccount): Promise<void> {
  try {
    await putAccount(await openDb(), account);
  } catch {
    memory.accounts.set(account.userId, account);
  }
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    return await getSession(await openDb());
  } catch {
    const session = memory.session;
    if (session?.expiresAt !== undefined && Date.parse(session.expiresAt) <= Date.now()) {
      memory.session = null;
      return null;
    }
    return session;
  }
}

export async function writeSession(userId: string | null): Promise<void> {
  try {
    await putSession(await openDb(), userId);
  } catch {
    memory.session = userId === null ? null : buildSession(userId);
  }
}

/** 直接写入完整会话记录（测试与迁移用；正常登录走 writeSession） */
export async function writeSessionRecord(session: StoredSession | null): Promise<void> {
  try {
    await putSessionRecord(await openDb(), session);
  } catch {
    memory.session = session;
  }
}
