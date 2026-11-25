/**
 * 账号卡片（S6 · T6-3）：登录 / 已登录态。
 *
 * 按运行域名选择登录方式：
 * - WorkBuddy 正式发布域名：沿用应用云登录（手机验证码 / 微信）与云同步；
 * - 其他静态部署域名（如 Trae）：使用本机账号（账号 + 密码），不依赖后端。
 *
 * 页面只经 `platform.auth`（登录态）与动作封装交互，不直连 SDK / localStorage。
 */

import { useEffect, useState } from "react";

import type { AuthUser } from "@quiz/platform";

import { loginLocalAccount, registerLocalAccount } from "../../account/localAuth";
import { cloudAuth } from "../../cloud/auth";
import {
  CLOUD_PUBLIC_CONFIG,
  isCloudOrigin,
  probeCloudLoginOrigin,
  resetCloudLoginOriginProbe,
} from "../../cloud/config";
import { usePlatform } from "../../platform/PlatformProvider";

const PHONE_RE = /^1\d{10}$/;

type LoginMethod = "phone" | "wechat";

/** "上次同步"要读得懂：相对时间比一串 ISO 有用 */
function formatSyncTime(iso: string): string {
  const ageMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ageMs) || ageMs < 60_000) return "刚刚";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return new Date(iso).toLocaleDateString();
}

function CloudAccountCard(): React.ReactElement {
  const { platform, showToast, sync, bump } = usePlatform();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<{ verificationId: string; isExistingUser: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [method, setMethod] = useState<LoginMethod>("phone");
  const [wechatBlocked, setWechatBlocked] = useState<boolean | null>(null);
  const [checkingWechat, setCheckingWechat] = useState(false);

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
    await sync.syncNow("manual");
  };

  const checkWechat = async (reset = false): Promise<void> => {
    if (reset) resetCloudLoginOriginProbe();
    // 微信 OAuth 只接受正式发布域名，localhost 等地址即使 CORS 放行也不可用
    if (globalThis.location.origin !== CLOUD_PUBLIC_CONFIG.endpoint) {
      setWechatBlocked(true);
      setCheckingWechat(false);
      return;
    }
    setCheckingWechat(true);
    try {
      setWechatBlocked(!(await probeCloudLoginOrigin()));
    } catch {
      setWechatBlocked(true);
    } finally {
      setCheckingWechat(false);
    }
  };

  const copyOrigin = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(globalThis.location.origin);
      showToast("当前地址已复制");
    } catch {
      showToast("复制失败，请手动选中地址");
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
    // 账号 ID 必须露出来：两端"都已登录"但数据不通时，第一步就是比对 ID 是否同一个
    const shortId = user.userId.slice(0, 8);
    const label = user.displayName?.trim() ? user.displayName : "微信用户";
    return (
      <section className="card">
        <h2>账号与云同步</h2>
        <div className="row">
          <span className="badge correct">已登录</span>
          <span>{`${label} · ${shortId}`}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          登录后、打开应用、切回前台与恢复联网都会自动与云端取并集；这里也可以手动触发。
          只追加表按幂等键去重、可变项以更新更晚者为准——只增不丢。
        </p>
        <p className="muted" style={{ marginTop: 4 }}>
          两端「我的」页显示的账号 ID 相同，才是同一个账号；不同就说明登成了两个账号。
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn"
            disabled={sync.phase === "syncing"}
            onClick={() => void runSync()}
          >
            {sync.phase === "syncing" ? "同步中…" : "立即同步"}
          </button>
          <button type="button" className="btn gray" onClick={() => void signOut()}>
            退出登录
          </button>
        </div>
        {sync.error === null && sync.lastSyncAt === null ? null : (
          <div className="notice small" style={{ marginTop: 8 }}>
            {sync.error ?? `已同步 · ${formatSyncTime(sync.lastSyncAt ?? "")}`}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card">
      <h2>账号与云同步</h2>
      <p className="muted">当前为本地模式。登录后可备份题库到云、同步学习记录，换设备互通。</p>

      <div className="chips" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={method === "phone" ? "chip on" : "chip"}
          onClick={() => {
            setMethod("phone");
            setError("");
          }}
        >
          手机号验证码
        </button>
        <button
          type="button"
          className={method === "wechat" ? "chip on" : "chip"}
          onClick={() => {
            setMethod("wechat");
            setError("");
            setWechatBlocked(null);
            void checkWechat();
          }}
        >
          微信扫码登录
        </button>
      </div>

      {method === "phone" ? (
        <>
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
          <p className="muted" style={{ marginTop: 6 }}>
            使用中国大陆 11 位手机号，验证码通过短信发送。
          </p>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 10 }}>
            使用微信扫描授权页二维码即可登录，首次登录会自动创建账号；本页不会收集微信密码。
          </p>

          {checkingWechat ? (
            <p className="muted">正在检查当前地址是否支持微信登录…</p>
          ) : wechatBlocked ? (
            <div className="notice small" style={{ marginTop: 8 }}>
              <strong>当前地址暂不能发起微信扫码登录。</strong>
              <div style={{ marginTop: 4 }}>
                微信扫码登录只支持 WorkBuddy 正式发布域名；本机 localhost 只能使用手机号验证码。当前地址：
              </div>
              <code style={{ display: "block", marginTop: 4, wordBreak: "break-all" }}>
                {globalThis.location.origin}
              </code>
              <div className="row" style={{ marginTop: 6 }}>
                <button type="button" className="btn gray" onClick={() => void copyOrigin()}>
                  复制地址
                </button>
                <button type="button" className="btn ghost" onClick={() => void checkWechat(true)}>
                  重新检测
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn"
              style={{ marginTop: 8 }}
              onClick={() =>
                void cloudAuth
                  .startWechat()
                  .then(() => setWechatBlocked(false))
                  .catch((e) => {
                    const msg = e instanceof Error ? e.message : "微信登录失败";
                    if (msg.includes("只支持") || msg.includes("未被应用云放行")) {
                      setWechatBlocked(true);
                      setError("");
                    } else {
                      setError(msg);
                    }
                  })
              }
            >
              打开微信扫码登录
            </button>
          )}
        </>
      )}

      {error === "" ? null : (
        <div className="notice small" style={{ marginTop: 8 }}>
          {error}
          {error.includes("未被应用云放行") ? (
            <div style={{ marginTop: 6 }}>
              <button type="button" className="btn gray" onClick={() => void copyOrigin()}>
                复制当前地址
              </button>
            </div>
          ) : null}
        </div>
      )}

      <p className="muted" style={{ marginTop: 12 }}>
        登录与云同步由应用云提供；未登录时所有刷题功能仍可在本机正常使用。
      </p>
    </section>
  );
}

type LocalMode = "login" | "register";

/** 本机账号：注册 / 登录 / 退出，全部在浏览器内完成，静态部署域名可用 */
function LocalAccountCard(): React.ReactElement {
  const { platform, showToast, bump } = usePlatform();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<LocalMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  const switchMode = (next: LocalMode): void => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  };

  const submit = async (): Promise<void> => {
    if (busy) return;
    if (mode === "register" && password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const next =
        mode === "register"
          ? await registerLocalAccount(username, password)
          : await loginLocalAccount(username, password);
      setUser(next);
      setPassword("");
      setConfirm("");
      showToast(mode === "register" ? "注册成功，已登录" : "已登录");
      bump();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async (): Promise<void> => {
    await platform.auth.signOut();
    setUser(null);
    showToast("已退出登录");
  };

  if (!ready) {
    return (
      <section className="card">
        <h2>账号与登录</h2>
        <p className="muted">正在读取登录状态…</p>
      </section>
    );
  }

  if (user !== null && !user.isAnonymous) {
    return (
      <section className="card">
        <h2>账号与登录</h2>
        <div className="row">
          <span className="badge correct">已登录</span>
          <span>{user.displayName ?? `用户 ${user.userId.slice(0, 8)}`}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          刷题进度、错题、收藏与导入的题库都保存在当前账号自己的本地数据库里，切换账号互不影响。
          换设备或清除站点数据后需要重新登录。
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn gray" onClick={() => void signOut()}>
            退出登录
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>账号与登录</h2>
      <p className="muted">
        当前站点为静态部署，使用本机账号：注册后自动登录，无需联网验证。
        账号、刷题进度与导入的题库都保存在本机数据库，并按账号隔离。
      </p>

      <div className="chips" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={mode === "login" ? "chip on" : "chip"}
          onClick={() => switchMode("login")}
        >
          登录
        </button>
        <button
          type="button"
          className={mode === "register" ? "chip on" : "chip"}
          onClick={() => switchMode("register")}
        >
          注册
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="row" style={{ marginTop: 10 }}>
          <input
            className="input"
            autoComplete="username"
            placeholder="账号（2-20 位字母 / 数字 / 中文）"
            aria-label="账号"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError("");
            }}
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            className="input"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            placeholder="密码（至少 6 位）"
            aria-label="密码"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
          />
        </div>
        {mode === "register" ? (
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="再次输入密码"
              aria-label="确认密码"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
                setError("");
              }}
            />
          </div>
        ) : null}
        <div className="row" style={{ marginTop: 10 }}>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "处理中…" : mode === "register" ? "注册并登录" : "登录"}
          </button>
        </div>
      </form>

      {error === "" ? null : (
        <div className="notice small" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      <p className="muted" style={{ marginTop: 12 }}>
        账号与数据只保存在当前浏览器；未登录时使用游客数据。清除站点数据或更换设备后需要重新注册。
      </p>
    </section>
  );
}

/** 按运行域名选择登录面板：正式发布域名走应用云，其他静态部署走本机账号 */
export function AccountCard(): React.ReactElement {
  return isCloudOrigin() ? <CloudAccountCard /> : <LocalAccountCard />;
}
