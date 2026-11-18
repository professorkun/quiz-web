/**
 * 我的（S3 · T3-8）：练习记录、存储占用、导入导出、清库。
 *
 * 这里的数字全部来自「取数后现算」，没有一张"统计缓存表"——
 * 这正是 S4 要求的"统计可由事件重算"在 S3 的早期形态。
 * 现在就算错，也只是页面算错；一旦引入缓存，错的就是数据。
 */

import { useCallback, useEffect, useState } from "react";

import type { Attempt } from "@quiz/core";
import type { StorageInfo } from "@quiz/platform";
import { recomputeBank, verifyBank } from "@quiz/data";

import { useInstallPrompt } from "../../pwa";
import { usePlatform } from "../../platform/PlatformProvider";
import { AccountCard } from "./AccountCard";
import { ImportExport } from "./ImportExport";

interface SessionRow {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly total: number;
  readonly right: number;
  readonly wrong: number;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function groupSessions(attempts: readonly Attempt[]): readonly SessionRow[] {
  const map = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    const key = attempt.sessionId ?? "未归属会话";
    const list = map.get(key);
    if (list === undefined) map.set(key, [attempt]);
    else list.push(attempt);
  }
  const rows: SessionRow[] = [];
  for (const [sessionId, list] of map) {
    const sorted = [...list].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    rows.push({
      sessionId,
      startedAt: sorted[0]?.submittedAt ?? "",
      total: sorted.length,
      right: sorted.filter((a) => a.correct === true).length,
      wrong: sorted.filter((a) => a.correct === false).length,
    });
  }
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function MePage(): React.ReactElement {
  const { platform, activeBank, banks, version, bump, showToast } = usePlatform();
  const bankId = activeBank.manifest.bankId;
  const { canInstall, promptInstall } = useInstallPrompt();

  const [attempts, setAttempts] = useState<readonly Attempt[]>([]);
  const [favorites, setFavorites] = useState(0);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [reconcile, setReconcile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    const [rows, favs, storage] = await Promise.all([
      platform.attempts.listByBank(bankId),
      platform.favorites.listByBank(bankId),
      platform.info(),
    ]);
    setAttempts(rows);
    setFavorites(favs.length);
    setInfo(storage);
  }, [platform, bankId]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const sessions = groupSessions(attempts);
  const firstAttempts = attempts.filter((a) => a.isFirstAttempt);
  const firstCorrect = firstAttempts.filter((a) => a.correct === true).length;

  const runReconcile = async (): Promise<void> => {
    setBusy(true);
    try {
      const before = await verifyBank(platform, bankId);
      const after = await recomputeBank(platform, bankId);
      setReconcile(
        `检查 ${before.beforeCount} 条进度，发现 ${before.changed} 条与事件不一致；` +
          `重算后 ${after.afterCount} 条全部一致。`,
      );
      bump();
    } catch (cause) {
      setReconcile(cause instanceof Error ? cause.message : "重算失败");
    } finally {
      setBusy(false);
    }
  };

  const clearBank = async (): Promise<void> => {
    const confirmed = globalThis.confirm(
      `确定清空「${activeBank.manifest.title}」的学习记录吗？\n\n` +
        "会删除该题库的全部作答、错题、收藏与未完成会话；题库内容本身不受影响。\n" +
        "建议先导出学习记录备份。",
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await platform.clearLearningData(bankId);
      await load();
      bump();
      showToast("已清空该题库的学习记录");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "清空失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>我的</h1>
          <p className="muted">当前题库：{activeBank.manifest.title} · 共 {banks.length} 个题库</p>
        </div>
      </header>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-num">{attempts.length}</div>
          <div className="kpi-label">作答事件</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{sessions.length}</div>
          <div className="kpi-label">练习轮次</div>
        </div>
        <div className="kpi">
          <div className="kpi-num ok">{firstCorrect}</div>
          <div className="kpi-label">首答即对</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{favorites}</div>
          <div className="kpi-label">收藏</div>
        </div>
      </section>

      <section className="card">
        <h2>练习记录</h2>
        {sessions.length === 0 ? (
          <p className="muted">还没有作答记录。做一轮练习后，这里会按轮次列出对错。</p>
        ) : (
          <ul className="rlist">
            {sessions.slice(0, 10).map((row) => (
              <li key={row.sessionId} className="ritem">
                <div className="ritem-main">
                  <div className="ritem-stem">{formatTime(row.startedAt)}</div>
                  <div className="muted">
                    共 {row.total} 题 · 对 {row.right} · 错 {row.wrong} · 会话 {row.sessionId}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {sessions.length > 10 ? (
          <p className="muted">只显示最近 10 轮；完整记录可导出学习记录查看。</p>
        ) : null}
      </section>

      <ImportExport />

      <section className="card">
        <h2>数据一致性</h2>
        <p className="muted">
          进度与统计只是作答事件的投影。若怀疑状态被写坏，可以直接从事件重算并逐条对账。
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn gray" disabled={busy} onClick={() => void runReconcile()}>
            {busy ? "重算中…" : "由事件重算并对账"}
          </button>
        </div>
        {reconcile === null ? null : (
          <div className="notice small" style={{ marginTop: 8 }}>
            {reconcile}
          </div>
        )}
      </section>

      <section className="card">
        <h2>存储</h2>
        {info === null ? (
          <p className="muted">正在读取存储状态…</p>
        ) : (
          <>
            <div className="row muted">
              <span>占用约 {formatBytes(info.usageBytes)}</span>
              <span>·</span>
              <span>{info.writable ? "可正常写入" : `不可写：${info.reason ?? "原因未知"}`}</span>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>
              数据只存在这个浏览器里，换设备请用上面的「导出学习记录」搬运。
            </p>
          </>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn gray" disabled={busy} onClick={() => void clearBank()}>
            清空当前题库的学习记录
          </button>
        </div>
      </section>

      <AccountCard />

      <section className="card">
        <h2>安装到桌面 · 离线可用</h2>
        <p className="muted">
          装到桌面/主屏后，断网也能打开并继续刷已缓存的题库；有更新时会提示你刷新。
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          {canInstall ? (
            <button type="button" className="btn" onClick={() => void promptInstall()}>
              安装到桌面
            </button>
          ) : (
            <span className="muted">
              可点浏览器地址栏的「安装」，或在菜单里选「安装应用 / 添加到主屏幕」。
            </span>
          )}
        </div>
      </section>

      <section className="card muted">
        <h2>关于</h2>
        <p className="muted" style={{ margin: 0 }}>
          通用刷题 V1 · 数据本地优先，六题型练习 + 模考 + 错题复习闭环。后续增强项（编辑器、AI 讲题等）见 S7 路线。
        </p>
      </section>
    </div>
  );
}
