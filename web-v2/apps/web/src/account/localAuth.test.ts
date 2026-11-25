// @vitest-environment node
/**
 * 本机账号单元用例（M2）：注册、登录、会话保持与过期、失败限流、旧摘要升级。
 *
 * 用 node 环境跑：PBKDF2 需要 `crypto.subtle`（jsdom 不提供）；
 * 存储层在无 IndexedDB 时退回进程内内存，覆盖的是与浏览器相同的公开接口。
 */

import { beforeEach, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";

// 测试运行器的 node 环境不提供 SubtleCrypto，注入 Node 的 WebCrypto；账号库退回内存
beforeEach(() => {
  setCryptoSubtle(webcrypto.subtle as unknown as SubtleCrypto);
  globalThis.localStorage?.clear();
});

import {
  loadAccounts,
  saveAccount,
  writeSessionRecord,
  type StoredAccount,
} from "./accountDb";
import {
  createLocalAuthAdapter,
  loginLocalAccount,
  registerLocalAccount,
} from "./localAuth";
import { deriveLegacyFnv, deriveLegacySha256, setCryptoSubtle } from "./password";

async function accountByName(username: string): Promise<StoredAccount | undefined> {
  const accounts = await loadAccounts();
  return accounts.find((account) => account.username === username);
}

describe("本机账号", () => {
  it("注册后自动登录，刷新会话保留，退出后清除", async () => {
    const user = await registerLocalAccount("alice", "secret123");
    expect(user.displayName).toBe("alice");

    // 新的适配器实例模拟"刷新页面后重新读取会话"
    const adapter = createLocalAuthAdapter();
    expect(await adapter.getUser()).toEqual(user);

    await adapter.signOut();
    expect(await adapter.getUser()).toBeNull();

    const again = await loginLocalAccount("alice", "secret123");
    expect(again.userId).toBe(user.userId);
  });

  it("注册写入 v2 凭据字段，且不存明文密码", async () => {
    await registerLocalAccount("v2user", "secret123");
    const account = await accountByName("v2user");
    expect(account?.credentialVersion).toBe(2);
    expect(account?.kdf).toBe("pbkdf2-sha256");
    expect(account?.iterations).toBe(600_000);
    expect(account?.passwordHash).not.toContain("secret123");
    expect(account?.passwordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("密码错误与重复账号会被拒绝", async () => {
    await registerLocalAccount("bob", "secret123");
    await expect(loginLocalAccount("bob", "wrong-pass")).rejects.toThrow("账号或密码不正确");
    await expect(registerLocalAccount("BOB", "secret123")).rejects.toThrow("已存在");
  });

  it("账号不存在与密码错误使用同一句提示", async () => {
    await registerLocalAccount("nobody-check", "secret123");
    const unknown = await loginLocalAccount("not-registered", "whatever").catch((e: Error) => e.message);
    const wrong = await loginLocalAccount("nobody-check", "wrong-pass").catch((e: Error) => e.message);
    expect(unknown).toBe("账号或密码不正确");
    expect(wrong).toBe(unknown);
  });

  it("弱密码（<8）注册被拒，旧 6 位账号仍可登录", async () => {
    await expect(registerLocalAccount("shortpw", "1234567")).rejects.toThrow("密码至少需要 8 位");

    await saveAccount({
      userId: "local_legacy_short",
      username: "legacy6",
      salt: "0123456789abcdef",
      passwordHash: await deriveLegacySha256("0123456789abcdef", "secret"),
      createdAt: new Date().toISOString(),
      credentialVersion: 1,
      kdf: "sha256",
    });
    const user = await loginLocalAccount("legacy6", "secret");
    expect(user.displayName).toBe("legacy6");
  });

  it("旧 SHA-256 账号登录后升级为 v2", async () => {
    await saveAccount({
      userId: "local_legacy_sha",
      username: "oldsha",
      salt: "abcdef0123456789",
      passwordHash: await deriveLegacySha256("abcdef0123456789", "oldpass1"),
      createdAt: new Date().toISOString(),
    });
    await loginLocalAccount("oldsha", "oldpass1");
    const account = await accountByName("oldsha");
    expect(account?.credentialVersion).toBe(2);
    expect(account?.kdf).toBe("pbkdf2-sha256");
    expect(account?.iterations).toBe(600_000);
  });

  it("16 位 FNV 旧账号登录后升级为 v2", async () => {
    await saveAccount({
      userId: "local_legacy_fnv",
      username: "oldfnv",
      salt: "0011223344556677",
      passwordHash: deriveLegacyFnv("0011223344556677", "oldpass2"),
      createdAt: new Date().toISOString(),
    });
    await loginLocalAccount("oldfnv", "oldpass2");
    const account = await accountByName("oldfnv");
    expect(account?.credentialVersion).toBe(2);
    expect(account?.passwordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("错误密码累加失败计数，5 次后锁定 60 秒", async () => {
    await registerLocalAccount("locker", "secret123");
    await expect(loginLocalAccount("locker", "bad-pass")).rejects.toThrow("账号或密码不正确");
    expect((await accountByName("locker"))?.failedAttempts).toBe(1);

    for (let i = 0; i < 4; i += 1) {
      await expect(loginLocalAccount("locker", "bad-pass")).rejects.toThrow("账号或密码不正确");
    }
    const locked = await accountByName("locker");
    expect(locked?.lockedUntil).toBeDefined();
    expect(Date.parse(locked?.lockedUntil ?? "")).toBeGreaterThan(Date.now());

    // 锁定期间即使密码正确也拒绝，并给出剩余秒数
    await expect(loginLocalAccount("locker", "secret123")).rejects.toThrow("尝试过多");
  });

  it("过期会话视为未登录", async () => {
    const user = await registerLocalAccount("expired", "secret123");
    await writeSessionRecord({
      id: "current",
      userId: user.userId,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await createLocalAuthAdapter().getUser()).toBeNull();
  });

  it("校验账号格式", async () => {
    await expect(registerLocalAccount("a", "secret123")).rejects.toThrow("账号");
  });
});
