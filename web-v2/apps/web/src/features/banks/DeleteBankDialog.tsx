/**
 * 删除题库确认框（V2.2 · R3 / 默认值 Q6）。
 *
 * 三条防线，缺一条都算设计失败：
 * 1. 先列清楚会删掉什么（四类条数），用户不是盲删；
 * 2. 必须手输题库名才能确认——删库不可撤销，误点一次不该毁掉记录；
 * 3. 明说「只删本机」：导出的 JSON 与云端备份不受影响，避免用户以为资料全没了。
 */

import { useState } from "react";

import type { BankContent } from "@quiz/core";

export interface DeleteCounts {
  readonly attempts: number;
  readonly favorites: number;
  readonly progress: number;
  readonly exams: number;
}

export function DeleteBankDialog(props: {
  readonly bank: BankContent;
  readonly counts: DeleteCounts | null;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): React.ReactElement {
  const [typed, setTyped] = useState("");
  const title = props.bank.manifest.title;
  const matched = typed.trim() === title;

  return (
    <div className="dialog-backdrop" onClick={props.onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-bank-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="delete-bank-title">删除题库「{title}」</h2>
        <p className="muted">
          这会删除本机保存的题库包，并级联清空它名下的学习数据。已导出的 JSON 与云端备份不受影响。
        </p>

        {props.counts === null ? (
          <div className="skeleton w-80" />
        ) : (
          <ul className="dialog-counts">
            <li>作答记录：{props.counts.attempts} 条</li>
            <li>学习进度：{props.counts.progress} 条</li>
            <li>收藏：{props.counts.favorites} 条</li>
            <li>模考成绩：{props.counts.exams} 条</li>
          </ul>
        )}

        <label className="field mt-3">
          <span className="muted">输入题库名「{title}」以确认</span>
          <input
            className="input"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={title}
            aria-label="输入题库名确认删除"
          />
        </label>

        <div className="row mt-3">
          <button
            type="button"
            className="btn danger"
            disabled={!matched || props.busy}
            onClick={props.onConfirm}
          >
            {props.busy ? "删除中…" : "确认删除"}
          </button>
          <button type="button" className="btn gray" onClick={props.onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
