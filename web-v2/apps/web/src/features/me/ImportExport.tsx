/**
 * 导入导出面板（S3 · T3-9 的界面侧）。
 *
 * 交互上只有一条不能妥协：**先预览、再确认**。
 * 旧版是"选中文件即导入"，用户没有机会看到"这份文件里有 3 条重复 ID"，
 * 只能在一个已经脏了的库上善后。
 */

import { useState } from "react";

import type { BankContent, LearningSnapshot } from "@quiz/core";
import {
  applyLearningSnapshot,
  exportBankJson,
  exportLearningJson,
  parseBankJson,
  parseLearningJson,
  type ImportIssue,
} from "@quiz/data";

import { downloadText, todayStamp } from "../../lib/download";
import { usePlatform } from "../../platform/PlatformProvider";

interface Preview {
  readonly kind: "learning" | "bank";
  readonly label: string;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  readonly fileName: string;
  readonly learning?: LearningSnapshot;
  readonly bank?: BankContent;
}

export function ImportExport(): React.ReactElement {
  const { platform, activeBank, banks, reloadBanks, selectBank, bump, showToast } = usePlatform();
  const [issues, setIssues] = useState<readonly ImportIssue[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
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

  const pickFile = async (file: File): Promise<void> => {
    setIssues([]);
    setPreview(null);
    const text = await file.text();

    let rawKind: unknown;
    try {
      rawKind = (JSON.parse(text) as { kind?: unknown }).kind;
    } catch {
      // 交给下面的解析器给出更具体的错误（它会指出是 JSON 哪一步坏了）
      rawKind = undefined;
    }

    if (rawKind === "quiz.bank" || rawKind === undefined) {
      const bankResult = parseBankJson(text);
      if (bankResult.ok && bankResult.value !== null) {
        const bank = bankResult.value;
        const overwrite = banks.some((b) => b.manifest.bankId === bank.manifest.bankId);
        setPreview({
          kind: "bank",
          label: `题库包：${bank.manifest.title}`,
          lines: [
            `${bank.questions.length} 道题 · ${bank.manifest.topics.length} 个知识点 · ${bank.knowledge.length} 篇讲义`,
            `bankId：${bank.manifest.bankId}`,
            overwrite
              ? "⚠ 已存在同名题库，确认导入会覆盖它在本机的版本"
              : "这是新题库，确认后可在「题库」页切换",
          ],
          warnings: bankResult.warnings,
          fileName: file.name,
          bank,
        });
        return;
      }

      const learningResult = parseLearningJson(text, {
        knownBankIds: banks.map((b) => b.manifest.bankId),
      });
      if (learningResult.ok && learningResult.value !== null) {
        const snapshot = learningResult.value;
        setPreview({
          kind: "learning",
          label: "学习记录",
          lines: [
            `${snapshot.attempts.length} 条作答 · ${snapshot.favorites.length} 条收藏 · ${snapshot.sessions.length} 个未完成会话`,
            `导出时间：${snapshot.exportedAt}`,
            "导入采用合并：同一条记录冲突时保留本机已有版本，不会被文件覆盖",
          ],
          warnings: learningResult.warnings,
          fileName: file.name,
          learning: snapshot,
        });
        return;
      }

      // 两份都失败：优先展示题库包的错误（它更可能是用户想导的东西）
      setIssues(bankResult.issues.length > 0 ? bankResult.issues : learningResult.issues);
      return;
    }

    const learningResult = parseLearningJson(text, {
      knownBankIds: banks.map((b) => b.manifest.bankId),
    });
    if (learningResult.ok && learningResult.value !== null) {
      const snapshot = learningResult.value;
      setPreview({
        kind: "learning",
        label: "学习记录",
        lines: [
          `${snapshot.attempts.length} 条作答 · ${snapshot.favorites.length} 条收藏`,
          `导出时间：${snapshot.exportedAt}`,
        ],
        warnings: learningResult.warnings,
        fileName: file.name,
        learning: snapshot,
      });
      return;
    }
    setIssues(learningResult.issues);
  };

  const confirmImport = async (): Promise<void> => {
    if (preview === null) return;
    setBusy(true);
    try {
      if (preview.kind === "learning" && preview.learning !== undefined) {
        const stats = await applyLearningSnapshot(platform, preview.learning);
        showToast(
          `导入完成：新增 ${stats.attemptsAdded} 条作答、${stats.favoritesAdded} 条收藏` +
            (stats.attemptsKept > 0 ? `；${stats.attemptsKept} 条已存在（未覆盖）` : ""),
        );
        bump();
      }
      if (preview.kind === "bank" && preview.bank !== undefined) {
        await platform.banks.saveImportedBank(preview.bank);
        await reloadBanks();
        await selectBank(preview.bank.manifest.bankId);
        showToast(`已导入题库「${preview.bank.manifest.title}」`);
      }
      setPreview(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "导入失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>数据导入导出</h2>
      <p className="muted">
        导出的 JSON 就是备份：可以换浏览器、换设备重灌。题库包与学习记录分开导出，互不绑定。
      </p>

      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn" onClick={() => void exportLearning()}>
          导出学习记录
        </button>
        <button type="button" className="btn gray" onClick={exportBank}>
          导出当前题库包
        </button>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <label className="btn gray" style={{ display: "inline-block" }}>
          选择文件导入
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file !== undefined) void pickFile(file);
            }}
          />
        </label>
        <span className="muted">支持题库包与学习记录，自动识别文件类型</span>
      </div>

      {issues.length > 0 ? (
        <div className="notice" style={{ marginTop: 12 }}>
          <strong>文件被拒绝：{issues.length} 处问题</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {issues.slice(0, 12).map((issue, index) => (
              <li key={index}>
                <code>{issue.path}</code> {issue.message}
              </li>
            ))}
          </ul>
          {issues.length > 12 ? <div>…还有 {issues.length - 12} 处</div> : null}
          <div className="muted" style={{ marginTop: 6 }}>
            没有写入任何数据。修好上述字段后重新导入。
          </div>
        </div>
      ) : null}

      {preview !== null ? (
        <div className="previewbox" style={{ marginTop: 12 }}>
          <strong>
            {preview.label}（{preview.fileName}）
          </strong>
          <ul>
            {preview.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {preview.warnings.map((warning) => (
            <div key={warning} className="notice small">
              {warning}
            </div>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" disabled={busy} onClick={() => void confirmImport()}>
              {busy ? "导入中…" : "确认导入"}
            </button>
            <button type="button" className="btn gray" onClick={() => setPreview(null)}>
              取消
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
