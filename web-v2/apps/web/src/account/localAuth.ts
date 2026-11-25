/**
 * 本机账号登录（静态站点可用）。
 *
 * 站点由纯静态文件托管（如 Trae 部署），没有可放行域名校验的后端，
 * 因此登录使用浏览器内的本机账号：
 * - 账号、密码摘要与会话存入 IndexedDB（见 `accountDb.ts`），密码只存加盐摘要；
 * - 每个账号拥有独立的数据数据库（见 `userStorage.ts`），刷题进度与导入题库互不干扰；
 * - 不联网即可注册 / 登录 / 退出，任何部署域名都能用。
 *
 * 实现 `@quiz/platform` 的 `AuthAdapter`，页面无需感知存储细节。
 */

import type { AuthAdapter, AuthUser } from "@quiz/platform";

import { loadAccounts, readSession, saveAccount, writeSession, type StoredAccount } from "./accountDb";
import { createCredential, verifyPassword } from "./password";

const USERNAME_RE = /^[\p{L}\p{N}_-]{2,20}$/u;

export const PASSWORD_MIN_LENGTH = 8;

/** 连续失败 5 次锁定 60 秒 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 60_000;

const listeners = new Set<(user: AuthUser | null) => void>();

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return toHex(bytes);
}

function toUser(account: StoredAccount): AuthUser {
  return { userId: account.userId, displayName: account.username, isAnonymous: false };
}

async function findAccount(username: string): Promise<StoredAccount | undefined> {
  const key = username.trim().toLowerCase();
  const accounts = await loadAccounts();
  return accounts.find((account) => account.username.toLowerCase() === key);
}

async function currentUser(): Promise<AuthUser | null> {
  const session = await readSession();
  if (session === null) return null;
  const account = (await loadAccounts()).find((item) => item.userId === session.userId);
  return account === undefined ? null : toUser(account);
}

function notify(): void {
  void currentUser().then((user) => {
    for (const listener of listeners) listener(user);
  });
}

/** 注册校验：账号格式 + 新密码长度；登录不校验长度，避免旧账号被拦 */
function validateRegistration(username: string, password: string): void {
  if (!USERNAME_RE.test(username.trim())) {
    throw new Error("账号需为 2-20 位字母、数字、中文、下划线或短横线");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`密码至少需要 ${PASSWORD_MIN_LENGTH} 位`);
  }
}

async function startSession(account: StoredAccount): Promise<AuthUser> {
  await writeSession(account.userId);
  notify();
  return toUser(account);
}

/** 注册并自动登录；同名账号（忽略大小写）会被拒绝 */
export async function registerLocalAccount(username: string, password: string): Promise<AuthUser> {
  const name = username.trim();
  validateRegistration(name, password);
  if ((await findAccount(name)) !== undefined) throw new Error("该账号已存在，请直接登录");

  const credential = await createCredential(password);
  const account: StoredAccount = {
    userId: `local_${Date.now().toString(36)}_${randomHex(4)}`,
    username: name,
    ...credential,
    createdAt: new Date().toISOString(),
  };
  await saveAccount(account);
  return startSession(account);
}

/** 失败计数 +1；达到上限锁 60 秒，并把计数归零，锁过期后重新计数 */
function lockedRecord(account: StoredAccount): StoredAccount {
  const failedAttempts = (account.failedAttempts ?? 0) + 1;
  if (failedAttempts < MAX_FAILED_ATTEMPTS) {
    return { ...account, failedAttempts };
  }
  return {
    ...account,
    failedAttempts: 0,
    lockedUntil: new Date(Date.now() + LOCK_MS).toISOString(),
  };
}

export async function loginLocalAccount(username: string, password: string): Promise<AuthUser> {
  const name = username.trim();
  if (name === "") throw new Error("请输入账号");
  if (password === "") throw new Error("请输入密码");

  const account = await findAccount(name);
  if (account === undefined) throw new Error("账号或密码不正确");

  if (account.lockedUntil !== undefined) {
    const remainMs = Date.parse(account.lockedUntil) - Date.now();
    if (remainMs > 0) {
      throw new Error(`尝试过多，请 ${Math.ceil(remainMs / 1000)} 秒后再试`);
    }
  }

  const result = await verifyPassword(account, password);
  if (!result.ok) {
    await saveAccount(lockedRecord(account));
    throw new Error("账号或密码不正确");
  }

  // 旧摘要校验通过后升级到 v2；记录本身也清掉失败计数与锁定
  const upgraded: StoredAccount =
    result.needsUpgrade
      ? { ...account, ...(await createCredential(password)), failedAttempts: 0, lockedUntil: undefined }
      : { ...account, failedAttempts: 0, lockedUntil: undefined };
  if (result.needsUpgrade) await saveAccount(upgraded);
  else if ((account.failedAttempts ?? 0) > 0 || account.lockedUntil !== undefined) {
    await saveAccount(upgraded);
  }
  return startSession(upgraded);
}

export async function signOutLocalAccount(): Promise<void> {
  await writeSession(null).catch(() => null);
  notify();
}

export function getCurrentLocalUser(): Promise<AuthUser | null> {
  return currentUser();
}

/** 本机账号列表（只读）：云端登录后用于提示迁移旧本机数据 */
export function listLocalAccounts(): Promise<StoredAccount[]> {
  return loadAccounts();
}

/** 注入给 Platform 的认证适配器（本机账号） */
export function createLocalAuthAdapter(): AuthAdapter {
  return {
    getUser: () => currentUser(),
    onAuthStateChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    signOut: signOutLocalAccount,
  };
}

// 跨标签页同步登录态：另一个标签登录 / 退出后，本页也刷新（环境不支持则忽略）
if (typeof globalThis.BroadcastChannel === "function") {
  const channel = new BroadcastChannel("quiz-local-auth");
  channel.addEventListener("message", notify);
}
