/**
 * 学习页（S3 · T3-5）。
 *
 * 这一年段的真实定位是「一眼知道现在该干什么」：
 * 有未完成会话就续上，没有就开始一轮，有错题就去复习。
 * 统计只放**已经能由事件算准**的数字；正确率、掌握度属于 S4，这里不提前立牌坊。
 */

import { useEffect, useState } from "react";

import { restoreSession, type QuestionProgress } from "@quiz/core";

import { usePlatform } from "../../platform/PlatformProvider";
import { navigate } from "../../router";

interface ResumeInfo {
  readonly cursor: number;
  readonly total: number;
}

export function LearnPage(): React.ReactElement {
  const { platform, activeBank, version } = usePlatform();
  const bankId = activeBank.manifest.bankId;

  const [progress, setProgress] = useState<readonly QuestionProgress[]>([]);
  const [favorites, setFavorites] = useState(0);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const [rows, favs, snapshot] = await Promise.all([
        platform.progress.listByBank(bankId),
        platform.favorites.listByBank(bankId),
        platform.sessionSnapshots.load(bankId),
      ]);
      if (cancelled) return;

      setProgress(rows);
      setFavorites(favs.length);

      if (snapshot === null) {
        setResume(null);
      } else {
        const restored = restoreSession(snapshot, activeBank.questions);
        setResume(
          restored.ok && restored.session !== null
            ? { cursor: restored.session.cursor, total: restored.session.questionIds.length }
            : null,
        );
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [platform, bankId, activeBank.questions, version]);

  const total = activeBank.questions.length;
  const touched = progress.length;
  const wrong = progress.filter((p) => p.wrongCount > 0).length;
  const correctOnce = progress.filter((p) => p.firstCorrectAt !== null).length;

  if (loading) {
    return (
      <div className="page">
        <p className="muted">正在读取学习记录…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{activeBank.manifest.title}</h1>
          <p className="muted">
            {activeBank.manifest.subject ?? "未标注学科"} · {total} 题 ·{" "}
            {activeBank.manifest.topics.length} 个知识点
          </p>
        </div>
      </header>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-num">
            {touched}
            <span className="kpi-sub">/{total}</span>
          </div>
          <div className="kpi-label">做过的题</div>
        </div>
        <div className="kpi">
          <div className="kpi-num ok">{correctOnce}</div>
          <div className="kpi-label">答对过的题</div>
        </div>
        <div className="kpi">
          <div className="kpi-num no">{wrong}</div>
          <div className="kpi-label">错题</div>
        </div>
        <div className="kpi">
          <div className="kpi-num">{favorites}</div>
          <div className="kpi-label">收藏</div>
        </div>
      </section>

      <section className="card">
        <h2>{resume === null ? "开始一轮练习" : "继续上次练习"}</h2>
        {resume === null ? (
          <p className="muted">
            {touched === 0
              ? "还没有任何记录。先做 10 题，错题会自动进入复习列表。"
              : `上次会话已结束。可以直接开新一轮，或去「复习」把 ${wrong} 道错题重做一遍。`}
          </p>
        ) : (
          <p className="muted">
            上次停在 第 {resume.cursor + 1} / {resume.total} 题，题序与选项顺序都已保留。
          </p>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => navigate("practice")}>
            {resume === null ? "开始练习" : "继续练习"}
          </button>
          <button type="button" className="btn gray" onClick={() => navigate("review")}>
            去复习（{wrong} 错题 / {favorites} 收藏）
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate("banks")}>
            挑题练习
          </button>
        </div>
      </section>

      <section className="card muted">
        <h2>今日待复习</h2>
        <p>
          到期复习需要 1/3/7 天间隔调度，属于 S4 的范围；本阶段先把错题、收藏与作答历史
          沉淀下来，等 S4 用这些真实事件排期。
        </p>
      </section>
    </div>
  );
}
