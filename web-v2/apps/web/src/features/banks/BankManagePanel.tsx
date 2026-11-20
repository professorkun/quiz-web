/**
 * 题库管理面板（V2.2 · R3 / 默认值 Q7：入口放在题库页内）。
 *
 * 只列「导入」的题库：内置题库不能删，列表里出现删除按钮只会制造误解。
 * 删除前的条数由面板现取，不缓存——确认框上的数字必须就是即将被删的量。
 */

import { useCallback, useEffect, useState } from "react";

import type { BankContent } from "@quiz/core";

import { usePlatform } from "../../platform/PlatformProvider";
import { DeleteBankDialog, type DeleteCounts } from "./DeleteBankDialog";

export function BankManagePanel(): React.ReactElement | null {
  const { platform, banks, reloadBanks, showToast, version } = usePlatform();
  const [importedIds, setImportedIds] = useState<readonly string[]>([]);
  const [target, setTarget] = useState<BankContent | null>(null);
  const [counts, setCounts] = useState<DeleteCounts | null>(null);
  const [busy, setBusy] = useState(false);

  const loadIds = useCallback(async (): Promise<void> => {
    setImportedIds(await platform.banks.listImportedBankIds());
  }, [platform]);

  useEffect(() => {
    void loadIds();
  }, [loadIds, version]);

  useEffect(() => {
    if (target === null) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    const bankId = target.manifest.bankId;
    void Promise.all([
      platform.attempts.listByBank(bankId),
      platform.progress.listByBank(bankId),
      platform.favorites.listByBank(bankId),
      platform.exams.listRecords(bankId),
    ]).then(([attempts, progress, favorites, exams]) => {
      if (cancelled) return;
      setCounts({
        attempts: attempts.length,
        progress: progress.length,
        favorites: favorites.length,
        exams: exams.length,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [platform, target]);

  const removable = banks.filter((bank) => importedIds.includes(bank.manifest.bankId));
  if (banks.length === 0) return null;

  const confirmDelete = async (): Promise<void> => {
    if (target === null) return;
    const bankId = target.manifest.bankId;
    setBusy(true);
    try {
      await platform.deleteImportedBank(bankId);
      await reloadBanks();
      await loadIds();
      showToast(`已删除题库「${target.manifest.title}」及其本机学习记录`);
      setTarget(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>题库管理</h2>
      <p className="muted">
        删除导入的题库会同时清空它的作答、进度、收藏与模考成绩；内置题库不可删除。
      </p>

      {removable.length === 0 ? (
        <p className="muted">当前没有可删除的导入题库。</p>
      ) : (
        <ul className="rlist">
          {removable.map((bank) => (
            <li key={bank.manifest.bankId} className="ritem">
              <div className="ritem-main">
                <div className="ritem-stem">{bank.manifest.title}</div>
                <div className="ritem-meta">
                  {bank.manifest.bankId} · {bank.questions.length} 题 · {bank.knowledge.length} 篇讲义
                </div>
              </div>
              <button type="button" className="btn danger sm" onClick={() => setTarget(bank)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      {target === null ? null : (
        <DeleteBankDialog
          bank={target}
          counts={counts}
          busy={busy}
          onCancel={() => setTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </section>
  );
}
