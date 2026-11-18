/**
 * 账号卡片（S6 · T6-3）：登录 / 已登录态 + 云同步入口。
 *
 * 页面只经 `platform.auth`（登录态）与 `cloudAuth`（登录动作）交互，不直连 SDK。
 * 手机验证码可本机试；微信 / WorkBuddy OAuth 只能在已发布 HTTPS 域名完成回调
 * （localhost 被 Relay 拒），卡片上有明确提示。
 */

import { useEffect, useState } from "react";

import type { AuthUser } from "@quiz/platform";

import { cloudAuth } from "../../cloud/auth";
import { syncAll } from "../../cloud/sync";
import { createCloudTransport } from "../../cloud/transport";
import { usePlatform } from "../../platform/PlatformProvider";

const PHONE_RE = /^1\d{10}$/;

export function AccountCard(): React.ReactElement {
  const { platform, showToast, bump } = usePlatform();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<{ verificationId: string; isExistingUser: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    let alive = true;
    void platform.auth.getUser().then((u) => {
      if (alive) {
        setUser(u);
        setReady(true);
      }
    });
    const unsub = platform.auth.onAuthStateChange((u) => {
      if (alive) setUser(u);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [platform]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendCode = async (): Promise<void> => {
    if (!PHONE_RE.test(phone)) {
      setError("请输入正确的 11 位手机号");
      return;
    }
    setError("");
    setSending(true);
    try {
      const r = await cloudAuth.sendPhoneOtp(phone);
      setPending(r);
      setCountdown(60);
      showToast("验证码已发送");
    } catch (e) {
      setError(e instanceof Error ? e.message : "验证码发送失败");
    } finally {
      setSending(false);
    }
  };

  const login = async (): Promise<void> => {
    if (pending === null) {
      setError("请先获取验证码");
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      setError("请输入收到的验证码");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const u = await cloudAuth.verifyPhoneOtp(phone, pending.verificationId, pending.isExistingUser, code);
      setUser(u);
      setPending(null);
      setCode("");
      showToast("已登录");
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setVerifying(false);
    }
  };

  const signOut = async (): Promise<void> => {
    await platform.auth.signOut();
    setUser(null);
    showToast("已退出登录");
  };

  const runSync = async (): Promise<void> => {
    setSyncing(true);
    setSyncMsg("");
    try {
      await syncAll(createCloudTransport(), platform);
      bump();
      setSyncMsg("同步完成：本地与云端已取并集");
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  if (!ready) {
    return (
      <section className="card">
        <h2>账号与云同步</h2>
        <p className="muted">正在读取登录状态…</p>
      </section>
    );
  }

  if (user !== null && !user.isAnonymous) {
    return (
      <section className="card">
        <h2>账号与云同步</h2>
        <div className="row">
          <span className="badge correct">已登录</span>
          <span>{user.displayName ?? `用户 ${user.userId.slice(0, 8)}`}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          点「立即同步」把本地记录与云端取并集：只追加表按幂等键去重、可变项以更新更晚者为准——只增不丢。
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={syncing} onClick={() => void runSync()}>
            {syncing ? "同步中…" : "立即同步"}
          </button>
          <button type="button" className="btn gray" onClick={() => void signOut()}>
            退出登录
          </button>
        </div>
        {syncMsg === "" ? null : (
          <div className="notice small" style={{ marginTop: 8 }}>
            {syncMsg}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card">
      <h2>账号与云同步</h2>
      <p className="muted">当前为本地模式。登录后可把学习记录同步到云端、换设备互通。</p>

      <div className="row" style={{ marginTop: 10 }}>
        <input
          className="input"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="手机号"
          aria-label="手机号"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value.trim());
            setError("");
          }}
        />
        <button
          type="button"
          className="btn gray"
          disabled={sending || countdown > 0}
          onClick={() => void sendCode()}
        >
          {countdown > 0 ? `${countdown}s` : sending ? "发送中…" : "获取验证码"}
        </button>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <input
          className="input"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="验证码"
          aria-label="验证码"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.trim());
            setError("");
          }}
        />
        <button type="button" className="btn" disabled={verifying} onClick={() => void login()}>
          {verifying ? "登录中…" : "登录"}
        </button>
      </div>

      {error === "" ? null : (
        <div className="notice small" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      <div className="row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn ghost"
          onClick={() => void cloudAuth.startWechat().catch((e) => setError(e instanceof Error ? e.message : "微信登录失败"))}
        >
          微信登录
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => void cloudAuth.startWorkbuddy().catch((e) => setError(e instanceof Error ? e.message : "WorkBuddy 登录失败"))}
        >
          使用 WorkBuddy 登录
        </button>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        微信 / WorkBuddy 登录需在已发布的 HTTPS 域名下完成（本地 localhost 会被拒）；手机验证码可先在本机试。
      </p>
    </section>
  );
}
