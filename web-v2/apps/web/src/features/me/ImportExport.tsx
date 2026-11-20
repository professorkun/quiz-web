/**
 * 导入导出面板（S3 · T3-9 的界面侧；V2.1 · R1.3 拆出题库导入）。
 *
 * 交互上只有一条不能妥协：**先预览、再确认**。
 * 题库导入是独立面板（JSON 主位 / Word Beta），这里只负责学习记录与导出；
 * 两个入口分开，是因为它们的风险不同：记录导入是合并，题库导入是覆盖。
 */

import { useState } from "react";

import type { LearningSnapshot } from "@quiz/core";
import {
  applyLearningSnapshot,
  exportBankJson,
  exportLearningJson,
  parseLearningJson,
  type ImportIssue,
} from "@quiz/data";

import { downloadText, todayStamp } from "../../lib/download";
import { usePlatform } from "../../platform/PlatformProvider";
import { IconDownload, IconUpload } from "../../ui/icons";
import { BankImportPanel } from "./BankImportPanel";

export function ImportExport(): React.ReactElement {
  const { platform, activeBank, banks, bump, showToast } = usePlatform();
  const hasBank = banks.length > 0;
  const [issues, setIssues] = useState<readonly ImportIssue[]>([]);
  const [preview, setPreview] = useState<{ snapshot: LearningSnapshot; fileName: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const exportLearning = async (): Promise<void> => {
    try {
      const snapshot = await platform.exportAll();
      downloadText(`quiz-learning-${todayStamp()}.json`, exportLearningJson(snapshot));
      showToast(
        `已导出 ${snapshot.attempts.length} 条作答、${snapshot.favorites.length} 条收藏`,
      );
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "导出失败");
    }
  };

  const exportBank = (): void => {
    downloadText(
      `quiz-bank-${activeBank.manifest.bankId}-${todayStamp()}.json`,
      exportBankJson(activeBank),
    );
    showToast(`已导出题库包「${activeBank.manifest.title}」（${activeBank.questions.length} 题）`);
  };

  const pickLearning = async (file: File): Promise<void> => {
    setIssues([]);
    setPreview(null);
    const result = parseLearningJson(await file.text(), {
      knownBankIds: banks.map((b) => b.manifest.bankId),
    });
    if (!result.ok || result.value === null) {
      setIssues(result.issues);
      return;
    }
    setPreview({ snapshot: result.value, fileName: file.name });
  };

  const confirmLearning = async (): Promise<void> => {
    if (preview === null) return;
    setBusy(true);
    try {
      const stats = await applyLearningSnapshot(platform, preview.snapshot);
      showToast(
        `导入完成：新增 ${stats.attemptsAdded} 条作答、${stats.favoritesAdded} 条收藏` +
          (stats.attemptsKept > 0 ? `；${stats.attemptsKept} 条已存在（未覆盖）` : ""),
      );
      bump();
      setPreview(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "导入失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card">
        <h2>数据导入导出</h2>
        <p className="muted">
          导出的 JSON 就是备份：可以换浏览器、换设备重灌。题库包与学习记录分开导出，互不绑定。
        </p>

        <div className="row mt-2">
          <button type="button" className="btn" onClick={() => void exportLearning()}>
            <IconDownload size={16} />
            导出学习记录
          </button>
          <button type="button" className="btn gray" disabled={!hasBank} onClick={exportBank}>
            {hasBank ? "导出当前题库包" : "导出当前题库包（暂无题库）"}
          </button>
        </div>

        <div className="row mt-3">
          <label className="btn gray">
            <IconUpload size={16} />
            导入学习记录
            <input
              type="file"
              accept="application/json,.json"
              className="file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file !== undefined) void pickLearning(file);
              }}
            />
          </label>
          <span className="muted">只接受学习记录备份；题库包请在下方「导入题库」中导入</span>
        </div>

        {issues.length > 0 ? (
          <div className="notice mt-3">
            <strong>文件被拒绝：{issues.length} 处问题</strong>
            <ul>
              {issues.slice(0, 12).map((issue, index) => (
                <li key={index}>
                  <code>{issue.path}</code> {issue.message}
                </li>
              ))}
            </ul>
            {issues.length > 12 ? <div>…还有 {issues.length - 12} 处</div> : null}
            <div className="muted mt-1">没有写入任何数据。修好上述字段后重新导入。</div>
          </div>
        ) : null}

        {preview !== null ? (
          <div className="previewbox mt-3">
            <strong>学习记录（{preview.fileName}）</strong>
            <ul>
              <li>
                {preview.snapshot.attempts.length} 条作答 · {preview.snapshot.favorites.length} 条收藏 ·{" "}
                {preview.snapshot.sessions.length} 个未完成会话
              </li>
              <li>导出时间：{preview.snapshot.exportedAt}</li>
              <li>导入采用合并：同一条记录冲突时保留本机已有版本，不会被文件覆盖</li>
            </ul>
            <div className="row mt-2">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void confirmLearning()}
              >
                {busy ? "导入中…" : "确认导入"}
              </button>
              <button type="button" className="btn gray" onClick={() => setPreview(null)}>
                取消
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <BankImportPanel />
    </>
  );
}
