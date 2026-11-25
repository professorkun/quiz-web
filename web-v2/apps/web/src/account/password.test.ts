// @vitest-environment node
/**
 * 密码模块（M2）：PBKDF2 新摘要、常量时间比较、旧摘要（SHA-256 / FNV）校验与升级标记。
 */

import { beforeEach, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";

import {
  constantTimeEqual,
  createCredential,
  deriveLegacyFnv,
  deriveLegacySha256,
  derivePbkdf2,
  PBKDF2_ITERATIONS,
  setCryptoSubtle,
  verifyPassword,
} from "./password";

// 测试运行器的 node 环境不提供 SubtleCrypto，注入 Node 的 WebCrypto
beforeEach(() => {
  setCryptoSubtle(webcrypto.subtle as unknown as SubtleCrypto);
});

describe("PBKDF2 新摘要", () => {
  it("生成 v2 凭据：16 字节盐 + 64 位 hex 摘要 + 600,000 次迭代", async () => {
    const credential = await createCredential("correct horse");
    expect(credential.credentialVersion).toBe(2);
    expect(credential.kdf).toBe("pbkdf2-sha256");
    expect(credential.iterations).toBe(PBKDF2_ITERATIONS);
    expect(credential.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(credential.passwordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("同一密码每次注册得到不同盐与摘要，但都能校验通过", async () => {
    const a = await createCredential("same-password");
    const b = await createCredential("same-password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.passwordHash).not.toBe(b.passwordHash);
    expect((await verifyPassword(a, "same-password")).ok).toBe(true);
    expect((await verifyPassword(a, "wrong-password")).ok).toBe(false);
  });

  it("常量时间比较：同长不同值、不同长都不相等", () => {
    expect(constantTimeEqual("abcd", "abcd")).toBe(true);
    expect(constantTimeEqual("abcd", "abce")).toBe(false);
    expect(constantTimeEqual("abcd", "abcde")).toBe(false);
  });
});

describe("旧摘要兼容", () => {
  it("64 位 hex 的 SHA-256 旧账号可校验，并标记需要升级", async () => {
    const salt = "0123456789abcdef";
    const passwordHash = await deriveLegacySha256(salt, "secret123");
    const result = await verifyPassword(
      { salt, passwordHash, credentialVersion: 1, kdf: "sha256" },
      "secret123",
    );
    expect(result).toEqual({ ok: true, needsUpgrade: true });
  });

  it("16 位 hex 的 FNV 旧账号可校验，并标记需要升级", () => {
    const salt = "fedcba9876543210";
    const passwordHash = deriveLegacyFnv(salt, "oldpass");
    expect(passwordHash).toMatch(/^[0-9a-f]{16}$/);
    return verifyPassword({ salt, passwordHash }, "oldpass").then((result) => {
      expect(result).toEqual({ ok: true, needsUpgrade: true });
    });
  });
});

describe("PBKDF2 参数", () => {
  it("相同盐与密码得到稳定摘要，不同盐得到不同摘要", async () => {
    const one = await derivePbkdf2("salt-a", "pw", 1000);
    const two = await derivePbkdf2("salt-a", "pw", 1000);
    const three = await derivePbkdf2("salt-b", "pw", 1000);
    expect(one).toBe(two);
    expect(one).not.toBe(three);
  });
});
