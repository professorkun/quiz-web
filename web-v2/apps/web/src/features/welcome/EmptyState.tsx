/**
 * 首页（尚未导入题库时）：应用始终进入主界面，这里在首页内引导导入第一份题库。
 *
 * 美化 C-02：几何线稿 + 三段式说明（发生了什么 → 为什么 → 现在做什么）+
 * 三步预期（导入 → 选题 → 开刷），导入卡是唯一主视觉。
 */

import { useState } from "react";

import type { BankContent } from "@quiz/core";
import { parseBankJson } from "@quiz/data";

import { usePlatform } from "../../platform/PlatformProvider";
import { EmptyArt, IconUpload } from "../../ui/icons";

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
    <div className="page">
      <header className="page-head">
        <div>
          <h1>通用刷题</h1>
          <p className="muted">导入题库包后，就能按知识点刷题、模考与复习。</p>
        </div>
      </header>

      <section className="card">
        <div className="empty-state">
          <EmptyArt />
          <h2>还没有题库</h2>
          <p className="muted">
            这是一套不预置题库的通用刷题应用。选择一份题库包（JSON）导入，即可开始练习。
          </p>
        </div>

        <div className="import-drop">
          <label className="btn lg">
            <IconUpload size={16} />
            导入题库包
            <input
              type="file"
              accept="application/json,.json"
              className="file-input"
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
          <div className="notice mt-3">
            <strong>文件被拒绝（{issues.length} 处问题）</strong>
            <ul>
              {issues.slice(0, 12).map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
            <div className="muted mt-1">没有写入任何数据。修好后重新选择。</div>
          </div>
        ) : null}

        {pending !== null ? (
          <div className="previewbox mt-3">
            <strong>
              题库包：{pending.manifest.title}（{pending.questions.length} 题）
            </strong>
            <div className="row mt-2">
              <button type="button" className="btn" disabled={busy} onClick={() => void confirm()}>
                {busy ? "导入中…" : "确认导入并开始"}
              </button>
              <button type="button" className="btn gray" onClick={() => setPending(null)}>
                取消
              </button>
            </div>
          </div>
        ) : null}

        <div className="steps">
          <div className="step">
            <span className="step-no">1</span>
            <b>选择题库包</b>
            <span>选择一份 JSON，先预览题数与知识点，再确认写入。</span>
          </div>
          <div className="step">
            <span className="step-no">2</span>
            <b>选题与范围</b>
            <span>按题型、知识点或错题状态筛选，决定本轮练什么。</span>
          </div>
          <div className="step">
            <span className="step-no">3</span>
            <b>开始刷题</b>
            <span>六种题型即时判分，错题自动进入 1/3/7 天复习计划。</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>导入后可以做什么</h2>
        <ul className="muted">
          <li>学习：看总体进度，继续上次练习。</li>
          <li>题库：按题型、知识点、状态筛选与搜索。</li>
          <li>刷题 / 模考：六种题型，限时组卷、自动判分。</li>
          <li>复习：错题、收藏、到期重做与掌握度。</li>
        </ul>
        <p className="muted mt-2">
          没有现成题库包？把讲义或大纲整理成题目，再按「导出题库包」的 JSON 结构导入即可。
        </p>
      </section>
    </div>
  );
}
