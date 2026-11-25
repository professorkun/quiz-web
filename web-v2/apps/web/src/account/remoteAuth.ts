/**
 * 账号密码登录（后端数据库 · 交接方案见 docs/account-backend-handoff.md）。
 *
 * 账号存云数据库，密码只存 pgcrypto bcrypt 摘要；注册 / 登录都走数据库函数，
 * 客户端永远拿不到密码摘要。登录成功后只在本地保存会话（30 天），
 * 不保存密码、也不签发跨端 token。
 *
 * 与「应用云登录」（手机验证码 / 微信）是两套体系：
 * 账号密码只解决登录与本地数据隔离，学习记录跨端同步仍需要应用云登录。
 */

import type { AuthAdapter, AuthUser } from "@quiz/platform";

import { getCloud } from "../cloud/client";

const RPC_REGISTER = "quiz_register";
const RPC_LOGIN = "quiz_login";
const SESSION_KEY = "quiz.remote.session.v1";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_RE = /^[\p{L}\p{N}_-]{2,20}$/u;

export const ACCOUNT_PASSWORD_MIN_LENGTH = 8;

export interface AccountSession {
  readonly userId: string;
  readonly username: string;
  readonly expiresAt: string;
}

const listeners = new Set<(user: AuthUser | null) => void>();

function toUser(session: AccountSession): AuthUser {
  return { userId: session.userId, displayName: session.username, isAnonymous: false };
}

function readSession(): AccountSession | null {
  try {
    const raw = globalThis.localStorage.getItem(SESSION_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<AccountSession>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      globalThis.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { userId: parsed.userId, username: parsed.username, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeSession(session: AccountSession | null): void {
  try {
    if (session === null) globalThis.localStorage.removeItem(SESSION_KEY);
    else globalThis.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // 隐私模式写不进 localStorage 时，本次登录仍可用于当前页面
  }
}

function notify(): void {
  const user = remoteAuth.currentUser();
  for (const listener of listeners) listener(user);
}

/** 数据库函数抛出的错误码 → 中文；不把英文原文透给用户 */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_CREDENTIALS: "账号或密码不正确",
  USERNAME_TAKEN: "该账号已存在，请直接登录",
  USERNAME_INVALID: "账号需为 2-20 位字母、数字、中文、下划线或短横线",
  PASSWORD_TOO_SHORT: `密码至少需要 ${ACCOUNT_PASSWORD_MIN_LENGTH} 位`,
};

function messageOf(error: unknown): string {
  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    if (raw.includes(code)) return message;
  }
  if (/origin is not allowed|access_denied/i.test(raw)) {
    return "当前域名未被应用云放行，账号服务不可用；请在正式发布域名使用。";
  }
  if (/PGRST202|could not find the function|does not exist/i.test(raw)) {
    return "账号服务尚未部署，请按交接文档执行数据库初始化 SQL。";
  }
  if (/failed to fetch|networkerror|load failed|request failed before a response/i.test(raw)) {
    return "无法连接账号服务，请检查网络后重试。";
  }
  return "账号服务异常，请稍后重试。";
}

interface RpcResult {
  readonly data: unknown;
  readonly error: unknown;
}

async function callRpc(name: string, username: string, password: string): Promise<AuthUser> {
  const client = await getCloud();
  const database = client.database as unknown as {
    rpc(fn: string, args: Record<string, unknown>): Promise<RpcResult>;
  };
  const { data, error } = await database.rpc(name, {
    p_username: username,
    p_password: password,
  });
  if (error) throw new Error(messageOf(error));

  const row = (Array.isArray(data) ? data[0] : data) as
    | { userId?: unknown; username?: unknown }
    | null
    | undefined;
  if (row === null || row === undefined || typeof row.userId !== "string") {
    throw new Error("账号服务返回异常，请稍后重试。");
  }
  const usernameOut = typeof row.username === "string" ? row.username : username;
  const session: AccountSession = {
    userId: row.userId,
    username: usernameOut,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  writeSession(session);
  notify();
  return toUser(session);
}

function validate(username: string, password: string): void {
  if (!USERNAME_RE.test(username.trim())) {
    throw new Error(ERROR_MESSAGES.USERNAME_INVALID as string);
  }
  if (password.length < ACCOUNT_PASSWORD_MIN_LENGTH) {
    throw new Error(ERROR_MESSAGES.PASSWORD_TOO_SHORT as string);
  }
}

/** 账号密码动作（账号卡片只调这里） */
export const remoteAuth = {
  /** 注册并自动登录 */
  async register(username: string, password: string): Promise<AuthUser> {
    const name = username.trim();
    validate(name, password);
    return callRpc(RPC_REGISTER, name, password);
  },

  /** 登录（账号不存在与密码错误由数据库统一返回 INVALID_CREDENTIALS） */
  async login(username: string, password: string): Promise<AuthUser> {
    const name = username.trim();
    if (name === "") throw new Error("请输入账号");
    if (password === "") throw new Error("请输入密码");
    return callRpc(RPC_LOGIN, name, password);
  },

  /** 当前账号会话（过期或损坏返回 null） */
  currentUser(): AuthUser | null {
    const session = readSession();
    return session === null ? null : toUser(session);
  },

  signOut(): void {
    writeSession(null);
    notify();
  },

  /** 订阅账号会话变化（登录 / 注册 / 退出） */
  subscribe(listener: (user: AuthUser | null) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** 注入给组合适配器（账号密码优先于应用云登录） */
export function createRemoteAuthAdapter(): AuthAdapter {
  return {
    getUser: async () => remoteAuth.currentUser(),
    onAuthStateChange: (listener) => {
      listener(remoteAuth.currentUser());
      const unsubscribe = remoteAuth.subscribe(listener);
      return unsubscribe;
    },
    signOut: async () => remoteAuth.signOut(),
  };
}
