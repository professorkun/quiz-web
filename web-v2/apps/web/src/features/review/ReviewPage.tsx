/**
 * 复习页（S3 · T3-7 的壳，S4 补状态机与调度）。
 *
 * 本阶段的边界写得很明确：**只做"能列出、能跳回去重做"**，
 * 不做 1/3/7 天排期、不做"连续 3 次独立答对转已掌握"——那是 S4。
 * 但错题口径已经按 S4 的方向定死了：**答错一次就一直在错题里**，
 * 不会因为"重做时答对了一次"就悄悄消失（那正是 S4 明令禁止的做法）。
 */

import { useEffect, useState } from "react";

import { getQuestionType, type FavoriteEntry, type Question, type QuestionProgress } from "@quiz/core";

import { RichText } from "../../components/RichText";
import { usePlatform } from "../../platform/PlatformProvider";
import { navigate } from "../../router";

type Tab = "wrong" | "favorite";

const TABS: readonly { key: Tab; label: string }[] = [
  { key: "wrong", label: "错题" },
  { key: "favorite", label: "收藏" },
];

function stemPreview(stem: string, limit = 70): string {
  const flat = stem.replace(/\s+/g, " ").replace(/[#*`>|-]/g, "").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit)}…`;
}

function forgotAt(iso: string | null): string {
  if (iso === null) return "未记录";
  const date = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReviewPage(): React.ReactElement {
  const { platform, activeBank, version, startCustomSession, showToast, bump } = usePlatform();
  const bankId = activeBank.manifest.bankId;

  const [tab, setTab] = useState<Tab>("wrong");
  const [progress, setProgress] = useState<readonly QuestionProgress[]>([]);
  const [favorites, setFavorites] = useState<readonly FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

  const wrong = progress
    .filter((row) => row.wrongCount > 0)
    .sort((a, b) => (b.lastAttemptAt ?? "").localeCompare(a.lastAttemptAt ?? ""));

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

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>复习 · {activeBank.manifest.title}</h1>
          <p className="muted">
            错题与收藏两条线互不影响：答对、以后掌握，都不会把收藏清掉。
          </p>
        </div>
      </header>

      <section className="card">
        <div className="tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? "tab on" : "tab"}
              onClick={() => setTab(item.key)}
            >
              {item.label}（{item.key === "wrong" ? wrong.length : favorites.length}）
            </button>
          ))}
          <button type="button" className="tab" disabled title="S4 用 1/3/7 天排期">
            到期复习（待 S4）
          </button>
          <button type="button" className="tab" disabled title="S4 引入掌握状态机">
            已掌握（待 S4）
          </button>
        </div>

        {loading ? <p className="muted">正在读取记录…</p> : null}

        {!loading && tab === "wrong" ? (
          wrong.length === 0 ? (
            <div className="empty">
              <p>还没有错题。</p>
              <p className="muted">
                答错一题就会出现在这里，并一直保留到你把它练熟（S4 才做"练熟"的判定）。
              </p>
              <button type="button" className="btn" onClick={() => navigate("practice")}>
                去练习
              </button>
            </div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => redo(wrong.map((row) => row.questionId))}
                >
                  全部重做（{wrong.length}）
                </button>
                <span className="muted">按最近答错时间排序</span>
              </div>
              <ul className="rlist">
                {wrong.map((row) => {
                  const question = questionMap.get(row.questionId);
                  return (
                    <li key={row.questionId} className="ritem">
                      <div className="ritem-main">
                        <div className="ritem-stem">
                          {question === undefined ? (
                            <span className="muted">〔题目已不在题库中〕</span>
                          ) : (
                            <RichText text={stemPreview(question.stem)} />
                          )}
                        </div>
                        <div className="muted">
                          错 {row.wrongCount} 次 · 共作答 {row.attemptsCount} 次 · 最近{" "}
                          {forgotAt(row.lastAttemptAt)}
                          {question === undefined ? "" : ` · ${getQuestionType(question.type).label}`}
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
                <button
                  type="button"
                  className="btn"
                  onClick={() => redo(favorites.map((f) => f.questionId))}
                >
                  全部重做（{favorites.length}）
                </button>
              </div>
              <ul className="rlist">
                {favorites.map((entry) => {
                  const question = questionMap.get(entry.questionId);
                  return (
                    <li key={entry.questionId} className="ritem">
                      <div className="ritem-main">
                        <div className="ritem-stem">
                          {question === undefined ? (
                            <span className="muted">〔题目已不在题库中〕</span>
                          ) : (
                            <RichText text={stemPreview(question.stem)} />
                          )}
                        </div>
                        <div className="muted">收藏于 {forgotAt(entry.addedAt)}</div>
                      </div>
                      <button
                        type="button"
                        className="btn gray"
                        disabled={question === undefined}
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
                  );
                })}
              </ul>
            </>
          )
        ) : null}
      </section>
    </div>
  );
}
