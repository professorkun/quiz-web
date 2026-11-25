/**
 * 题库导入面板（V2.1 · R1.3）。
 *
 * 入口有主次：**JSON 是主位**（本版本唯一可用的完整链路），
 * Word 是同宽的次位并明确标注 Beta——不把半成品伪装成和 JSON 等价的能力。
 *
 * 交互仍然只有一条不能妥协：先预览、再确认。失败时不写入任何数据，
 * 并把中文错误定位到具体字段（校验器给出的中文报错直接展示）。
 */

import { useState } from "react";

import { getQuestionType, type BankContent } from "@quiz/core";
import { parseBankJson, type ImportIssue } from "@quiz/data";
import type { DocxDraft } from "@quiz/data/docx";
import { importPromptText } from "@quiz/content";

import { downloadText, todayStamp } from "../../lib/download";
import { usePlatform } from "../../platform/PlatformProvider";
import { IconCopy, IconUpload } from "../../ui/icons";
import { buildDocxBank, docxDraftJson, parseDocxFile } from "./docxImport";

interface Preview {
  readonly bank: BankContent;
  readonly fileName: string;
  readonly overwrite: boolean;
  readonly sections: number;
}

/** 讲义节数合计：只做展示换算，不动解析 */
function sectionTotal(bank: BankContent): number {
  let total = 0;
  for (const module of bank.knowledge) {
    total += module.sections.length;
  }
  return total;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非安全上下文（http 内网地址）没有 clipboard API，退回隐藏 textarea
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function BankImportPanel(): React.ReactElement {
  const { platform, banks, reloadBanks, selectBank, showToast } = usePlatform();
  const [issues, setIssues] = useState<readonly ImportIssue[]>([]);
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DocxDraft | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [docxError, setDocxError] = useState<string | null>(null);
  const [docxBusy, setDocxBusy] = useState(false);

  const pickJson = async (file: File): Promise<void> => {
    setIssues([]);
    setWarnings([]);
    setPreview(null);
    const result = parseBankJson(await file.text());
    if (!result.ok || result.value === null) {
      setIssues(result.issues);
      setWarnings(result.warnings);
      return;
    }
    const bank = result.value;
    setWarnings(result.warnings);
    setPreview({
      bank,
      fileName: file.name,
      overwrite: banks.some((b) => b.manifest.bankId === bank.manifest.bankId),
      sections: sectionTotal(bank),
    });
  };

  const confirm = async (): Promise<void> => {
    if (preview === null) return;
    setBusy(true);
    try {
      await platform.banks.saveImportedBank(preview.bank);
      await reloadBanks();
      await selectBank(preview.bank.manifest.bankId);
      showToast(`已导入题库「${preview.bank.manifest.title}」`);
      setPreview(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "导入失败");
    } finally {
      setBusy(false);
    }
  };

  const copyPrompt = async (): Promise<void> => {
    const ok = await copyText(importPromptText());
    showToast(ok ? "转换提示词已复制，粘贴给 AI 即可" : "浏览器未允许自动复制，请到 README 第 3 节手动复制");
  };

  const pickDocx = async (file: File): Promise<void> => {
    setIssues([]);
    setWarnings([]);
    setPreview(null);
    setDraft(null);
    setDocxError(null);
    setDocxBusy(true);
    try {
      const result = await parseDocxFile(file);
      setDraft(result);
      // 默认只勾「高置信度且已生成成品」的题；低置信度必须人工确认
      setSelected(
        new Set(
          result.questions
            .filter((entry) => entry.confidence === "high" && entry.question !== null)
            .map((entry) => entry.index),
        ),
      );
    } catch (cause) {
      setDocxError(cause instanceof Error ? cause.message : "Word 解析失败");
    } finally {
      setDocxBusy(false);
    }
  };

  const toggleDraft = (index: number): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const acceptHighConfidence = (): void => {
    if (draft === null) return;
    setSelected(
      new Set(
        draft.questions
          .filter((entry) => entry.confidence === "high" && entry.question !== null)
          .map((entry) => entry.index),
      ),
    );
  };

  const confirmDocx = async (): Promise<void> => {
    if (draft === null) return;
    setBusy(true);
    try {
      const bank = await buildDocxBank(draft, [...selected]);
      await platform.banks.saveImportedBank(bank);
      await reloadBanks();
      await selectBank(bank.manifest.bankId);
      showToast(`已导入「${bank.manifest.title}」${bank.questions.length} 题（Word Beta）`);
      setDraft(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "导入失败");
    } finally {
      setBusy(false);
    }
  };

  const exportDraft = async (): Promise<void> => {
    if (draft === null) return;
    try {
      downloadText(
        `docx-draft-${draft.bankId}-${todayStamp()}.json`,
        await docxDraftJson(draft, [...selected]),
      );
      showToast("已导出草稿：可先备份，也可用 JSON 导入复核");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "导出草稿失败");
    }
  };

  return (
    <section className="card">
      <h2>导入题库</h2>
      <p className="muted">
        JSON 题库包是完整链路；Word 导入为 Beta，识别结果需要逐题确认。文件先预览、确认后才写入。
      </p>

      <div className="row mt-2">
        <label className="btn">
          <IconUpload size={16} />
          导入题库包 JSON
          <input
            type="file"
            accept="application/json,.json"
            className="file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file !== undefined) void pickJson(file);
            }}
          />
        </label>
        <label className="btn gray" title="解析 .docx 后逐题确认；.doc / 扫描件不支持">
          <IconUpload size={16} />
          {docxBusy ? "识别中…" : "导入 Word"}
          <span className="badge">Beta</span>
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="file-input"
            disabled={docxBusy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file !== undefined) void pickDocx(file);
            }}
          />
        </label>
        <button type="button" className="btn ghost" onClick={() => void copyPrompt()}>
          <IconCopy size={16} />
          复制转换提示词
        </button>
      </div>
      <p className="muted mt-1">
        没有 JSON 题库包？复制提示词，连同讲义文档一起发给 AI，让它按契约输出可导入的 JSON。
      </p>

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

      {warnings.length > 0 ? (
        <div className="notice small mt-2">
          {warnings.slice(0, 6).map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}

      {docxError === null ? null : (
        <div className="notice mt-3">
          <strong>Word 文件无法解析</strong>
          <div>{docxError}</div>
          <div className="muted mt-1">
            支持 .docx；旧版 .doc、扫描件与图片型 PDF 需先另存/转换为可选中文字的 .docx。
          </div>
        </div>
      )}

      {draft !== null ? (
        <div className="previewbox mt-3">
          <strong>
            Word 识别结果：{draft.title}（可导入 {draft.stats.parsed}/{draft.stats.totalQuestions} 题）
          </strong>
          <div className="muted">
            高置信度 {draft.stats.highConfidence} 题 · 讲义 {draft.stats.knowledgeSections} 节 · 表格行{" "}
            {draft.stats.tableRows}。低置信度题不会默认勾选，建议回原文档修正后重新导入。
          </div>

          <ul className="docx-list mt-2">
            {draft.questions.map((entry) => (
              <li key={entry.index} className="docx-row">
                <label className="docx-check">
                  <input
                    type="checkbox"
                    checked={selected.has(entry.index)}
                    disabled={entry.question === null}
                    onChange={() => toggleDraft(entry.index)}
                    aria-label={`选择第 ${entry.index} 题`}
                  />
                  <span className="docx-stem">
                    {entry.index}. {entry.stem.slice(0, 70)}
                    {entry.stem.length > 70 ? "…" : ""}
                  </span>
                </label>
                <span className={`badge ${entry.confidence === "high" ? "correct" : "wrong"}`}>
                  {entry.confidence === "high" ? "高置信度" : "需确认"}
                </span>
                {entry.type === null ? null : (
                  <span className="muted">{getQuestionType(entry.type).label}</span>
                )}
                {entry.problems.length === 0 ? null : (
                  <span className="muted">{entry.problems.join("；")}</span>
                )}
              </li>
            ))}
          </ul>

          <div className="row mt-2">
            <button type="button" className="btn gray" onClick={acceptHighConfidence}>
              全部接受高置信度
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || selected.size === 0}
              onClick={() => void confirmDocx()}
            >
              {busy ? "导入中…" : `确认导入所选（${selected.size} 题）`}
            </button>
            <button type="button" className="btn gray" onClick={() => void exportDraft()}>
              导出草稿 JSON
            </button>
            <button type="button" className="btn ghost" onClick={() => setDraft(null)}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      {preview !== null ? (
        <div className="previewbox mt-3">
          <strong>
            题库包：{preview.bank.manifest.title}（{preview.fileName}）
          </strong>
          <ul>
            <li>
              {preview.bank.questions.length} 道题 · {preview.bank.manifest.topics.length} 个知识点 ·{" "}
              {preview.bank.knowledge.length} 篇讲义
              {preview.sections > 0 ? ` · ${preview.sections} 节` : ""}
            </li>
            <li>bankId：{preview.bank.manifest.bankId}</li>
            <li>
              {preview.overwrite
                ? "⚠ 已存在同名题库，确认导入会覆盖它在本机的版本"
                : "这是新题库，确认后可在「题库」页切换"}
            </li>
          </ul>
          <div className="row mt-2">
            <button type="button" className="btn" disabled={busy} onClick={() => void confirm()}>
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
