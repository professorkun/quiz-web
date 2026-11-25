/**
 * 本机账号密码摘要（M2）。
 *
 * 新账号一律 PBKDF2-HMAC-SHA256（600,000 次迭代 + 每账号 16 字节随机盐）；
 * 旧记录仍可校验，并在登录成功后升级：
 * - v1 / 64 位 hex：单轮 SHA-256(salt:password)；
 * - 更早的非安全上下文记录：16 位 hex 的 FNV-1a（只校验、不生成）。
 *
 * 本机密码只是访问锁，不是跨端账号安全；云模式由平台校验密码。
 */

export const CREDENTIAL_VERSION = 2;
export const PBKDF2_ITERATIONS = 600_000;
export const PASSWORD_KDF = "pbkdf2-sha256";

/** 校验所需的最小账号字段，避免与 accountDb 互相依赖 */
export interface PasswordRecord {
  readonly salt: string;
  readonly passwordHash: string;
  readonly credentialVersion?: 1 | 2;
  readonly kdf?: "sha256" | "pbkdf2-sha256";
  readonly iterations?: number;
}

export interface Credential {
  readonly salt: string;
  readonly passwordHash: string;
  readonly credentialVersion: 2;
  readonly kdf: "pbkdf2-sha256";
  readonly iterations: number;
}

export interface VerifyResult {
  readonly ok: boolean;
  /** 旧摘要校验通过，登录后应升级到 v2 */
  readonly needsUpgrade: boolean;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/**
 * 测试宿主可注入 WebCrypto：部分测试运行器会把 `globalThis.crypto` 换成
 * 只带 getRandomValues、不带 SubtleCrypto 的桩。浏览器运行时无需注入。
 */
let injectedSubtle: SubtleCrypto | null = null;

export function setCryptoSubtle(subtle: SubtleCrypto | null): void {
  injectedSubtle = subtle;
}

function requireSubtle(): SubtleCrypto {
  const subtle = injectedSubtle ?? globalThis.crypto?.subtle;
  // 先取出方法引用再判断：某些运行环境的 crypto 是带副作用的 getter
  const digest = subtle?.digest;
  const importKey = subtle?.importKey;
  if (typeof digest !== "function" || typeof importKey !== "function") {
    throw new Error("当前环境不支持安全密码校验，请使用 HTTPS");
  }
  return subtle as SubtleCrypto;
}

/** 每账号 16 字节随机盐；拿不到安全随机源就失败，不用 Math.random 兜底 */
export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("当前环境不支持安全密码校验，请使用 HTTPS");
  }
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** 逐字节 XOR 累计，避免按字符提前返回泄露摘要信息 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** PBKDF2-HMAC-SHA256，输出 32 字节 hex */
export async function derivePbkdf2(
  salt: string,
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const subtle = requireSubtle();
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

/** 旧版摘要：单轮 SHA-256(salt:password) */
export async function deriveLegacySha256(salt: string, password: string): Promise<string> {
  const subtle = requireSubtle();
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${password}`),
  );
  return toHex(new Uint8Array(digest));
}

/** 更早的非安全上下文摘要：16 位 hex 的 FNV-1a，仅用于校验旧记录 */
export function deriveLegacyFnv(salt: string, password: string): string {
  const text = `${salt}:${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ code, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/** 生成新账号的盐与摘要（v2） */
export async function createCredential(password: string): Promise<Credential> {
  const salt = randomSalt();
  return {
    salt,
    passwordHash: await derivePbkdf2(salt, password, PBKDF2_ITERATIONS),
    credentialVersion: CREDENTIAL_VERSION,
    kdf: PASSWORD_KDF,
    iterations: PBKDF2_ITERATIONS,
  };
}

/** 按记录自身版本校验；旧格式通过时标记 needsUpgrade */
export async function verifyPassword(
  record: PasswordRecord,
  password: string,
): Promise<VerifyResult> {
  const version = record.credentialVersion ?? 1;
  if (version >= 2) {
    const iterations = record.iterations ?? PBKDF2_ITERATIONS;
    const actual = await derivePbkdf2(record.salt, password, iterations);
    return { ok: constantTimeEqual(actual, record.passwordHash), needsUpgrade: false };
  }
  // 旧记录：64 位 hex 是 SHA-256；16 位 hex 是更早的 FNV-1a
  if (record.passwordHash.length === 16) {
    const ok = constantTimeEqual(deriveLegacyFnv(record.salt, password), record.passwordHash);
    return { ok, needsUpgrade: ok };
  }
  const actual = await deriveLegacySha256(record.salt, password);
  const ok = constantTimeEqual(actual, record.passwordHash);
  return { ok, needsUpgrade: ok };
}
