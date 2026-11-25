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

import { listLocalAccounts, loginLocalAccount, registerLocalAccount } from "../../account/localAuth";
import { readSession, type StoredAccount } from "../../account/accountDb";
import { ACCOUNT_PASSWORD_MIN_LENGTH, remoteAuth } from "../../account/remoteAuth";
import { accountDbName, copyDataBetweenDbs } from "../../account/userStorage";
import { cloudAuth } from "../../cloud/auth";
import {
  CLOUD_PUBLIC_CONFIG,
  isCloudHost,
  isCloudOrigin,
  probeCloudLoginOrigin,
  resetCloudLoginOriginProbe,
} from "../../cloud/config";
import { syncAll } from "../../cloud/sync";
import { createCloudTransport } from "../../cloud/transport";
import { usePlatform } from "../../platform/PlatformProvider";

const PHONE_RE = /^1\d{10}$/;

type LoginMethod = "account" | "otp" | "register" | "wechat";

function CloudAccountCard(): React.ReactElement {
  const { platform, showToast, bump } = usePlatform();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState<LoginMethod>("account");
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<{ verificationId: string; isExistingUser: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [wechatBlocked, setWechatBlocked] = useState<boolean | null>(null);
  const [checkingWechat, setCheckingWechat] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<readonly StoredAccount[]>([]);
  const [migrationUserId, setMigrationUserId] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [remoteUser, setRemoteUser] = useState<AuthUser | null>(() => remoteAuth.currentUser());
  // 微信 OAuth 只允许正式发布域；Trae 等白名单域不显示微信入口
  const wechatAvailable = isCloudOrigin();
  const isRemoteUser = remoteUser !== null && user !== null && remoteUser.userId === user.userId;

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

  // 账号密码会话与应用云会话各自独立：记录当前用户是否来自账号密码登录
  useEffect(() => {
    setRemoteUser(remoteAuth.currentUser());
  }, [user]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 云账号登录后检测本机账号：默认选中最近登录过的本机账号，供用户确认迁移
  useEffect(() => {
    if (user === null || user.isAnonymous) {
      setLocalAccounts([]);
      return;
    }
    let alive = true;
    void (async () => {
      const accounts = await listLocalAccounts();
      const session = await readSession();
      if (!alive || accounts.length === 0) return;
      setLocalAccounts(accounts);
      const preferred = accounts.find((item) => item.userId === session?.userId);
      setMigrationUserId(preferred?.userId ?? accounts[0]?.userId ?? "");
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const finishLogin = (u: AuthUser | null): void => {
    setUser(u);
    setPending(null);
    setCode("");
    setPassword("");
    setConfirm("");
    showToast("已登录");
    bump();
  };

  const sendCode = async (target: "otp" | "register"): Promise<void> => {
    if (!PHONE_RE.test(phone)) {
      setError("请输入正确的 11 位手机号");
      return;
    }
    setError("");
    setSending(true);
    try {
      const r = await cloudAuth.sendPhoneOtp(phone);
      // 已注册手机号不允许再走注册：立刻停住并切到登录，避免建出重复账号
      if (target === "register" && r.isExistingUser) {
        setPending(null);
        setMethod("otp");
        setError("该手机号已注册，请用密码或验证码登录");
        return;
      }
      setPending(r);
      setCountdown(60);
      showToast("验证码已发送");
    } catch (e) {
      setError(e instanceof Error ? e.message : "验证码发送失败");
    } finally {
      setSending(false);
    }
  };

  const loginWithOtp = async (): Promise<void> => {
    if (pending === null) {
      setError("请先获取验证码");
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      setError("请输入收到的验证码");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const u = await cloudAuth.verifyPhoneOtp(
        phone,
        pending.verificationId,
        pending.isExistingUser,
        code,
      );
      finishLogin(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 账号密码（后端数据库）：默认入口，登录后只隔离本机数据，不做云同步
  const submitAccount = async (): Promise<void> => {
    const name = identifier.trim();
    if (name === "") {
      setError("请输入账号");
      return;
    }
    if (password === "") {
      setError("请输入密码");
      return;
    }
    if (accountMode === "register") {
      if (password.length < ACCOUNT_PASSWORD_MIN_LENGTH) {
        setError(`密码至少需要 ${ACCOUNT_PASSWORD_MIN_LENGTH} 位`);
        return;
      }
      if (password !== confirm) {
        setError("两次输入的密码不一致");
        return;
      }
    }
    setError("");
    setSubmitting(true);
    try {
      const u =
        accountMode === "register"
          ? await remoteAuth.register(name, password)
          : await remoteAuth.login(name, password);
      finishLogin(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const registerWithPhone = async (): Promise<void> => {
    if (pending === null) {
      setError("请先获取验证码");
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      setError("请输入收到的验证码");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const u = await cloudAuth.verifyPhoneOtp(
        phone,
        pending.verificationId,
        false,
        code,
        password,
      );
      finishLogin(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setSubmitting(false);
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

  // 旧本机账号 → 云账号：只复制不删除，目标库已有数据时跳过
  const migrateLocalData = async (): Promise<void> => {
    if (user === null || migrationUserId === "") return;
    setMigrating(true);
    setSyncMsg("");
    try {
      const copied = await copyDataBetweenDbs(
        accountDbName(migrationUserId),
        accountDbName(user.userId),
      );
      // 账号密码登录没有云会话：只在本机迁移，不触发云同步
      if (!isRemoteUser) await syncAll(createCloudTransport(), platform);
      bump();
      setLocalAccounts([]);
      if (copied === 0) {
        setSyncMsg("当前账号已有数据，未重复迁移");
      } else if (isRemoteUser) {
        setSyncMsg(`已迁移 ${copied} 项（保存在本机）`);
      } else {
        setSyncMsg(`已迁移 ${copied} 项；云端合并完成`);
      }
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "迁移失败");
    } finally {
      setMigrating(false);
    }
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
    return (
      <section className="card">
        <h2>{isRemoteUser ? "账号与登录" : "账号与云同步"}</h2>
        <div className="row">
          <span className="badge correct">已登录</span>
          <span>{user.displayName ?? `用户 ${user.userId.slice(0, 8)}`}</span>
        </div>
        {isRemoteUser ? (
          <p className="muted" style={{ marginTop: 8 }}>
            账号密码登录：账号存在云数据库，学习数据保存在当前浏览器；跨设备数据同步请使用手机验证码登录。
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>
            点「立即同步」把本地记录与云端取并集：只追加表按幂等键去重、可变项以更新更晚者为准——只增不丢。
          </p>
        )}
        {localAccounts.length === 0 ? null : (
          <div className="notice small" style={{ marginTop: 8 }}>
            <div>检测到本机账号数据，是否迁移到当前账号？迁移只复制、不删除原本机数据，可回滚。</div>
            {localAccounts.length > 1 ? (
              <select
                className="input"
                aria-label="选择要迁移的本机账号"
                style={{ marginTop: 6 }}
                value={migrationUserId}
                onChange={(e) => setMigrationUserId(e.target.value)}
              >
                {localAccounts.map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {item.username}
                  </option>
                ))}
              </select>
            ) : (
              <div className="muted" style={{ marginTop: 4 }}>
                本机账号：{localAccounts[0]?.username}
              </div>
            )}
            <button
              type="button"
              className="btn gray"
              style={{ marginTop: 6 }}
              disabled={migrating}
              onClick={() => void migrateLocalData()}
            >
              {migrating ? "迁移中…" : "迁移到当前账号"}
            </button>
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          {isRemoteUser ? null : (
            <button type="button" className="btn" disabled={syncing} onClick={() => void runSync()}>
              {syncing ? "同步中…" : "立即同步"}
            </button>
          )}
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
      <h2>账号与登录</h2>
      <p className="muted">
        账号密码存在云数据库，登录时检索；手机号验证码 / 微信仍可用，登录后可备份题库到云。
      </p>

      <div className="chips" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={method === "account" ? "chip on" : "chip"}
          onClick={() => {
            setMethod("account");
            setError("");
          }}
        >
          账号密码
        </button>
        <button
          type="button"
          className={method === "otp" ? "chip on" : "chip"}
          onClick={() => {
            setMethod("otp");
            setError("");
          }}
        >
          验证码登录
        </button>
        <button
          type="button"
          className={method === "register" ? "chip on" : "chip"}
          onClick={() => {
            setMethod("register");
            setError("");
          }}
        >
          手机注册
        </button>
        {wechatAvailable ? (
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
        ) : null}
      </div>

      {method === "account" ? (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input"
              autoComplete="username"
              placeholder="账号（2-20 位字母 / 数字 / 中文）"
              aria-label="账号"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value.trim());
                setError("");
              }}
            />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              type="password"
              autoComplete={accountMode === "register" ? "new-password" : "current-password"}
              placeholder={`密码${accountMode === "register" ? `（至少 ${ACCOUNT_PASSWORD_MIN_LENGTH} 位）` : ""}`}
              aria-label="密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
            />
          </div>
          {accountMode === "register" ? (
            <div className="row" style={{ marginTop: 8 }}>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="再次输入密码"
                aria-label="确认密码"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError("");
                }}
              />
            </div>
          ) : null}
          <div className="row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={() => void submitAccount()}
            >
              {submitting ? "处理中…" : accountMode === "register" ? "注册并登录" : "登录"}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setAccountMode(accountMode === "register" ? "login" : "register");
                setError("");
                setConfirm("");
              }}
            >
              {accountMode === "register" ? "已有账号，去登录" : "没有账号，去注册"}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            账号密码保存在云数据库；学习数据仍按账号隔离在本机浏览器。
          </p>
        </>
      ) : method === "otp" ? (
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
              onClick={() => void sendCode("otp")}
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
            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={() => void loginWithOtp()}
            >
              {submitting ? "登录中…" : "登录"}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            使用中国大陆 11 位手机号，验证码通过短信发送。
          </p>
        </>
      ) : method === "register" ? (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="手机号"
              aria-label="注册手机号"
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
              onClick={() => void sendCode("register")}
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
              aria-label="注册验证码"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.trim());
                setError("");
              }}
            />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="设置密码（至少 8 位）"
              aria-label="设置密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
            />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="再次输入密码"
              aria-label="确认密码"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError("");
              }}
            />
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn"
              disabled={submitting}
              onClick={() => void registerWithPhone()}
            >
              {submitting ? "注册中…" : "注册并登录"}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            注册需要短信验证；该手机号已注册时会提示改用密码或验证码登录。
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
        <h2>账号与登录（本机）</h2>
        <p className="muted">正在读取登录状态…</p>
      </section>
    );
  }

  if (user !== null && !user.isAnonymous) {
    return (
      <section className="card">
        <h2>账号与登录（本机）</h2>
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
      <h2>账号与登录（本机）</h2>
      <p className="muted">
        当前为 Trae 静态部署，账号与数据只保存在本浏览器；换设备请使用正式发布域名的云账号。
        本机账号不跨端，清除站点数据后需要重新注册。
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
            placeholder="密码（至少 8 位）"
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

/** 按运行域名选择登录面板：正式发布域 / 白名单域走应用云，其他静态部署走本机账号 */
export function AccountCard(): React.ReactElement {
  return isCloudHost() ? <CloudAccountCard /> : <LocalAccountCard />;
}
