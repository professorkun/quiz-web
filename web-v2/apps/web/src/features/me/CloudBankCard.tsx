/**
 * 题库云备份卡片（「我的」页）：登录后把当前题库上传到云，换设备可恢复。
 *
 * 登录动作仍由 AccountCard 负责，这里只消费 `platform.auth` 的登录态；
 * 未登录时说明用途，不展示上传按钮。
 */

import { useCallback, useEffect, useState } from "react";

import type { AuthUser } from "@quiz/platform";

import {
  downloadBankFromCloud,
  listCloudBanks,
  uploadBankToCloud,
  type CloudBankEntry,
} from "../../cloud/bankBackup";
import { usePlatform } from "../../platform/PlatformProvider";

function formatTime(iso: string | null): string {
  if (iso === null) return "";
  const date = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CloudBankCard(): React.ReactElement {
  const { platform, activeBank, banks, reloadBanks, selectBank, showToast, version } = usePlatform();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<readonly CloudBankEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void platform.auth.getUser().then((u) => {
      if (alive) {
        setUser(u);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [platform, version]);

  useEffect(() => {
    return platform.auth.onAuthStateChange((u) => setUser(u));
  }, [platform]);

  const refresh = useCallback(
    async (userId: string): Promise<void> => {
      setBusy("list");
      try {
        setEntries(await listCloudBanks(userId));
        setMessage("");
      } catch (cause) {
        setEntries([]);
        setMessage(cause instanceof Error ? cause.message : "读取云端题库失败");
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const loggedIn = user !== null && !user.isAnonymous;

  useEffect(() => {
    if (loggedIn && user !== null) void refresh(user.userId);
    else setEntries([]);
  }, [loggedIn, user, refresh]);

  const upload = async (): Promise<void> => {
    if (user === null || banks.length === 0) return;
    setBusy("upload");
    setMessage("");
    try {
      await uploadBankToCloud(user.userId, activeBank);
      setMessage(`已上传题库「${activeBank.manifest.title}」`);
      showToast("题库已备份到云端");
      await refresh(user.userId);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "上传题库失败");
    } finally {
      setBusy(null);
    }
  };

  const restore = async (entry: CloudBankEntry): Promise<void> => {
    setBusy(entry.path);
    setMessage("");
    try {
      const bank = await downloadBankFromCloud(entry.path);
      await platform.banks.saveImportedBank(bank);
      await reloadBanks();
      await selectBank(bank.manifest.bankId);
      setMessage(`已恢复题库「${bank.manifest.title}」（${bank.questions.length} 题）`);
      showToast("云端题库已恢复到本机");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "恢复题库失败");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card">
      <h2>题库云备份</h2>
      <p className="muted">
        登录后可把当前题库上传到云端；换设备登录后可直接恢复，不必再找原始 JSON 文件。
      </p>

      {!ready ? (
        <p className="muted">正在读取登录状态…</p>
      ) : loggedIn && user !== null ? (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn"
              disabled={banks.length === 0 || busy !== null}
              onClick={() => void upload()}
            >
              {busy === "upload" ? "上传中…" : "上传当前题库"}
            </button>
            <button
              type="button"
              className="btn gray"
              disabled={busy !== null}
              onClick={() => void refresh(user.userId)}
            >
              {busy === "list" ? "刷新中…" : "刷新云端列表"}
            </button>
            <span className="muted">
              {banks.length === 0 ? "先在首页或上方导入题库" : `当前：${activeBank.manifest.title}`}
            </span>
          </div>

          {message === "" ? null : (
            <div className="notice small" style={{ marginTop: 8 }}>
              {message}
            </div>
          )}

          <h2 style={{ marginTop: 14 }}>云端题库</h2>
          {entries.length === 0 ? (
            <p className="muted">
              {busy === "list" ? "正在读取云端题库…" : "云端还没有题库备份。"}
            </p>
          ) : (
            <ul className="rlist">
              {entries.map((entry) => (
                <li key={entry.path} className="ritem">
                  <div className="ritem-main">
                    <div className="ritem-stem">{entry.name}</div>
                    <div className="muted">
                      {entry.updatedAt === null ? "上传时间未知" : `上传于 ${formatTime(entry.updatedAt)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn gray"
                    disabled={busy !== null}
                    onClick={() => void restore(entry)}
                  >
                    {busy === entry.path ? "恢复中…" : "恢复到本机"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>
          当前为本地模式。先在上方完成登录，才能上传与恢复云端题库。
        </p>
      )}
    </section>
  );
}
