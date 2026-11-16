/**
 * 复习页（S4 · T4-4/T4-6）：到期 / 错题 / 收藏 / 已掌握四个视图。
 *
 * 四条线刻意分开：
 * - 错题看"历史上错过没有"（`wrongCount > 0`），答对不自动移出；
 * - 到期看排期（`nextReviewAt <= now` 且未掌握），可按计划重做；
 * - 收藏是独立存储，任何状态变化都不动它；
 * - 已掌握看状态机结论（连续 3 次独立答对），不是"做对过一次"。
 *
 * 错因标记只写 `progress.errorCause`，不改判分、不改排期（S4 §4）。
 */

import { useEffect, useState } from "react";

import {
  ERROR_CAUSES,
  ERROR_CAUSE_LABEL,
  getQuestionType,
  isDueAt,
  type ErrorCause,
  type FavoriteEntry,
  type Question,
  type QuestionProgress,
} from "@quiz/core";

import { RichText } from "../../components/RichText";
import { usePlatform } from "../../platform/PlatformProvider";
import { navigate } from "../../router";

type Tab = "due" | "wrong" | "favorite" | "mastered";

function stemPreview(stem: string, limit = 70): string {
  const flat = stem.replace(/\s+/g, " ").replace(/[#*`>|-]/g, "").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit)}…`;
}

function formatTime(iso: string | null): string {
  if (iso === null) return "未记录";
  const date = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReviewPage(): React.ReactElement {
  const { platform, activeBank, version, startCustomSession, showToast, bump } = usePlatform();
  const bankId = activeBank.manifest.bankId;

  const [tab, setTab] = useState<Tab>("due");
  const [progress, setProgress] = useState<readonly QuestionProgress[]>([]);
  const [favorites, setFavorites] = useState<readonly FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date().toISOString();

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const [rows, favs] = await Promise.all([
        platform.progress.listByBank(bankId),
        platform.favorites.listByBank(bankId),
      ]);
      if (cancelled) return;
      setProgress(rows);
      setFavorites(favs);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [platform, bankId, version]);

  const questionMap = new Map<string, Question>();
  for (const question of activeBank.questions) questionMap.set(question.questionId, question);

  const due = progress
    .filter((row) => isDueAt(row.status, row.nextReviewAt, now))
    .sort((a, b) => (a.nextReviewAt ?? "").localeCompare(b.nextReviewAt ?? ""));
  const wrong = progress
    .filter((row) => row.wrongCount > 0)
    .sort((a, b) => (b.lastAttemptAt ?? "").localeCompare(a.lastAttemptAt ?? ""));
  const mastered = progress
    .filter((row) => row.status === "mastered" || row.mastered)
    .sort((a, b) => (b.lastAttemptAt ?? "").localeCompare(a.lastAttemptAt ?? ""));

  const tabs: readonly { key: Tab; label: string; count: number }[] = [
    { key: "due", label: "到期复习", count: due.length },
    { key: "wrong", label: "错题", count: wrong.length },
    { key: "favorite", label: "收藏", count: favorites.length },
    { key: "mastered", label: "已掌握", count: mastered.length },
  ];

  const redo = (ids: readonly string[]): void => {
    const available = ids.filter((id) => questionMap.has(id));
    if (available.length === 0) {
      showToast("这些题已不在当前题库中，无法重做");
      return;
    }
    startCustomSession(available, "review", "复习");
    navigate("practice");
  };

  const removeFavorite = async (questionId: string): Promise<void> => {
    try {
      await platform.favorites.remove(bankId, questionId);
      setFavorites((prev) => prev.filter((f) => f.questionId !== questionId));
      bump();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "取消收藏失败");
    }
  };

  /** 错因可改可清；只改派生进度，历史作答不动 */
  const markCause = async (questionId: string, cause: ErrorCause | null): Promise<void> => {
    const row = progress.find((p) => p.questionId === questionId);
    if (row === undefined) return;
    try {
      await platform.progress.save({ ...row, errorCause: cause });
      setProgress((prev) =>
        prev.map((p) => (p.questionId === questionId ? { ...p, errorCause: cause } : p)),
      );
      bump();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "错因保存失败");
    }
  };

  /** 备注可选，离开输入框才写一次；不做逐字符写入 */
  const markNote = async (questionId: string, note: string): Promise<void> => {
    const row = progress.find((p) => p.questionId === questionId);
    if (row === undefined || (row.note ?? "") === note) return;
    try {
      await platform.progress.save({ ...row, note });
      setProgress((prev) =>
        prev.map((p) => (p.questionId === questionId ? { ...p, note } : p)),
      );
      bump();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "备注保存失败");
    }
  };

  const rowTitle = (questionId: string): React.ReactNode => {
    const question = questionMap.get(questionId);
    return question === undefined ? (
      <span className="muted">〔题目已不在题库中〕</span>
    ) : (
      <RichText text={stemPreview(question.stem)} />
    );
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>复习 · {activeBank.manifest.title}</h1>
          <p className="muted">
            到期按 1/3/7 天排期（ADR-0006）；收藏与错题互不影响；掌握需要连续 3 次独立答对。
          </p>
        </div>
      </header>

      <section className="card">
        <div className="tabs" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? "tab on" : "tab"}
              onClick={() => setTab(item.key)}
            >
              {item.label}（{item.count}）
            </button>
          ))}
        </div>

        {loading ? <p className="muted">正在读取记录…</p> : null}

        {!loading && tab === "due" ? (
          due.length === 0 ? (
            <div className="empty">
              <p>现在没有到期的题。</p>
              <p className="muted">答错后 1 天、复习答对后 3 天 / 7 天会再次到期；已掌握不再排期。</p>
              <button type="button" className="btn gray" onClick={() => navigate("practice")}>
                去练习
              </button>
            </div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 10 }}>
                <button type="button" className="btn" onClick={() => redo(due.map((r) => r.questionId))}>
                  开始本轮复习（{due.length}）
                </button>
                <span className="muted">按到期时间从早到晚</span>
              </div>
              <ul className="rlist">
                {due.map((row) => (
                  <li key={row.questionId} className="ritem">
                    <div className="ritem-main">
                      <div className="ritem-stem">{rowTitle(row.questionId)}</div>
                      <div className="muted">
                        {row.status === "learning" ? "首次重做" : `复习第 ${row.streak + 1} 次`} · 到期{" "}
                        {formatTime(row.nextReviewAt)} · 错 {row.wrongCount} 次
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn gray"
                      onClick={() => redo([row.questionId])}
                    >
                      重做
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}

        {!loading && tab === "wrong" ? (
          wrong.length === 0 ? (
            <div className="empty">
              <p>还没有错题。</p>
              <p className="muted">答错一次就会出现在这里；重做答对只进入复习计划，不会把它悄悄移走。</p>
              <button type="button" className="btn" onClick={() => navigate("practice")}>
                去练习
              </button>
            </div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 10 }}>
                <button type="button" className="btn" onClick={() => redo(wrong.map((r) => r.questionId))}>
                  全部重做（{wrong.length}）
                </button>
                <span className="muted">错因可随时修改或清空</span>
              </div>
              <ul className="rlist">
                {wrong.map((row) => {
                  const question = questionMap.get(row.questionId);
                  return (
                    <li key={row.questionId} className="ritem">
                      <div className="ritem-main">
                        <div className="ritem-stem">{rowTitle(row.questionId)}</div>
                        <div className="muted">
                          错 {row.wrongCount} 次 · 共作答 {row.attemptsCount} 次 · 最近{" "}
                          {formatTime(row.lastAttemptAt)}
                          {question === undefined ? "" : ` · ${getQuestionType(question.type).label}`}
                        </div>
                        <div className="row" style={{ marginTop: 6 }}>
                          <label className="muted" htmlFor={`cause-${row.questionId}`}>
                            错因
                          </label>
                          <select
                            id={`cause-${row.questionId}`}
                            className="input"
                            style={{ flex: "0 1 210px" }}
                            value={row.errorCause ?? ""}
                            onChange={(event) =>
                              void markCause(
                                row.questionId,
                                event.target.value === ""
                                  ? null
                                  : (event.target.value as ErrorCause),
                              )
                            }
                          >
                            <option value="">未标记</option>
                            {ERROR_CAUSES.map((cause) => (
                              <option key={cause} value={cause}>
                                {ERROR_CAUSE_LABEL[cause]}
                              </option>
                            ))}
                          </select>
                          <span className="badge">{row.status}</span>
                          <input
                            className="input"
                            style={{ flex: "1 1 180px" }}
                            aria-label={`备注 ${row.questionId}`}
                            placeholder="备注（可选）"
                            defaultValue={row.note ?? ""}
                            onBlur={(event) => void markNote(row.questionId, event.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn gray"
                        disabled={question === undefined}
                        onClick={() => redo([row.questionId])}
                      >
                        重做
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )
        ) : null}

        {!loading && tab === "favorite" ? (
          favorites.length === 0 ? (
            <div className="empty">
              <p>还没有收藏。</p>
              <p className="muted">在题库页或答题时点「☆ 收藏」，值得回看的题会留在这里。</p>
              <button type="button" className="btn gray" onClick={() => navigate("banks")}>
                去题库挑题
              </button>
            </div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 10 }}>
                <button type="button" className="btn" onClick={() => redo(favorites.map((f) => f.questionId))}>
                  全部重做（{favorites.length}）
                </button>
              </div>
              <ul className="rlist">
                {favorites.map((entry) => (
                  <li key={entry.questionId} className="ritem">
                    <div className="ritem-main">
                      <div className="ritem-stem">{rowTitle(entry.questionId)}</div>
                      <div className="muted">收藏于 {formatTime(entry.addedAt)}</div>
                    </div>
                    <button
                      type="button"
                      className="btn gray"
                      disabled={!questionMap.has(entry.questionId)}
                      onClick={() => redo([entry.questionId])}
                    >
                      重做
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void removeFavorite(entry.questionId)}
                    >
                      取消收藏
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}

        {!loading && tab === "mastered" ? (
          mastered.length === 0 ? (
            <div className="empty">
              <p>还没有已掌握的题。</p>
              <p className="muted">答错过的题连续 3 次独立复习答对后转已掌握，之后不再进入到期列表。</p>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 10 }}>
                已掌握只表示"按规则退出复习排期"，历史作答仍可查；收藏也不会因此消失。
              </p>
              <ul className="rlist">
                {mastered.map((row) => (
                  <li key={row.questionId} className="ritem">
                    <div className="ritem-main">
                      <div className="ritem-stem">{rowTitle(row.questionId)}</div>
                      <div className="muted">
                        连续答对 {row.streak} 次 · 最近作答 {formatTime(row.lastAttemptAt)}
                      </div>
                    </div>
                    <span className="badge ok">已掌握</span>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}
      </section>
    </div>
  );
}
