/**
 * 空壳态引导页：产品不含内置题库时显示，引导用户导入第一份题库。
 *
 * 只做一件事——导入题库包（data 的 parseBankJson → platform.banks.saveImportedBank）。
 * 导入成功后 Provider.reloadBanks 会加载出新题库，App 守卫随即切到正常功能界面，
 * 并自动选中刚导入的题库。这里刻意不提供"导出"能力（空态无内容可导出）。
 */

import { useState } from "react";

import type { BankContent } from "@quiz/core";
import { parseBankJson } from "@quiz/data";

import { usePlatform } from "../../platform/PlatformProvider";

export function EmptyState(): React.ReactElement {
  const { platform, reloadBanks, selectBank } = usePlatform();
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BankContent | null>(null);

  const pickFile = async (file: File): Promise<void> => {
    setIssues([]);
    setPending(null);
    const text = await file.text();
    const result = parseBankJson(text);
    if (!result.ok || result.value === null) {
      setIssues(result.issues.map((i) => `${i.path ?? ""} ${i.message}`.trim()));
      return;
    }
    setPending(result.value);
  };

  const confirm = async (): Promise<void> => {
    if (pending === null) return;
    setBusy(true);
    try {
      await platform.banks.saveImportedBank(pending);
      await reloadBanks();
      await selectBank(pending.manifest.bankId);
    } catch (cause) {
      setIssues([cause instanceof Error ? cause.message : String(cause)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 620, margin: "48px auto" }}>
        <h1>欢迎使用通用刷题</h1>
        <p className="muted">
          这是一个通用刷题应用，没有预置题库。导入一份题库包（JSON）即可开始练习、模考与复习。
        </p>

        <div className="row" style={{ marginTop: 16 }}>
          <label className="btn" style={{ display: "inline-block" }}>
            选择题库包文件
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
          <span className="muted">题库包是导出的 .json 文件，选择后确认即可导入</span>
        </div>

        {issues.length > 0 ? (
          <div className="notice" style={{ marginTop: 12 }}>
            <strong>文件被拒绝（{issues.length} 处问题）</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {issues.slice(0, 12).map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
            <div className="muted" style={{ marginTop: 6 }}>没有写入任何数据。修好后重新选择。</div>
          </div>
        ) : null}

        {pending !== null ? (
          <div className="previewbox" style={{ marginTop: 12 }}>
            <strong>
              题库包：{pending.manifest.title}（{pending.questions.length} 题）
            </strong>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn" disabled={busy} onClick={() => void confirm()}>
                {busy ? "导入中…" : "确认导入并开始"}
              </button>
              <button type="button" className="btn gray" onClick={() => setPending(null)}>
                取消
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
