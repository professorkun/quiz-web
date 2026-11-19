/**
 * 学习页（S3 · T3-5 / 美化 C-01）。
 *
 * 这一屏只回答「现在该干什么」：一个主 CTA、一句今日状态、一组关键数字。
 * 统计只放已经能由事件算准的数字；正确率、掌握度属于 S4，这里不提前立牌坊。
 */

import { useEffect, useState } from "react";

import {
  computeStats,
  restoreSession,
  type Attempt,
  type QuestionProgress,
} from "@quiz/core";

import { usePlatform } from "../../platform/PlatformProvider";
import { navigate } from "../../router";
import { IconCalendarClock, IconPlay, IconSpark, IconStar } from "../../ui/icons";

interface ResumeInfo {
  readonly cursor: number;
  readonly total: number;
}

export function LearnPage(): React.ReactElement {
  const { platform, activeBank, version } = usePlatform();
  const bankId = activeBank.manifest.bankId;

  const [progress, setProgress] = useState<readonly QuestionProgress[]>([]);
  const [attempts, setAttempts] = useState<readonly Attempt[]>([]);
  const [favorites, setFavorites] = useState(0);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const [rows, events, favs, snapshot] = await Promise.all([
        platform.progress.listByBank(bankId),
        platform.attempts.listByBank(bankId),
        platform.favorites.listByBank(bankId),
        platform.sessionSnapshots.load(bankId),
      ]);
      if (cancelled) return;

      setProgress(rows);
      setAttempts(events);
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
  const stats = computeStats({
    questions: activeBank.questions,
    topics: activeBank.manifest.topics,
    attempts,
    progress,
    now: new Date().toISOString(),
  });

  if (loading) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <h1>{activeBank.manifest.title}</h1>
            <div className="skeleton w-60" />
          </div>
        </header>
        <div className="card">
          <div className="skeleton w-80" />
          <div className="skeleton w-60" />
          <div className="skeleton w-80" />
        </div>
        <div className="kpis">
          {[0, 1, 2, 3].map((key) => (
            <div className="kpi" key={key}>
              <div className="skeleton w-60" />
              <div className="skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{activeBank.manifest.title}</h1>
          <p className="today-status">
            <IconCalendarClock size={16} />
            今日 <strong>{stats.dueCount}</strong> 题到期 · 已做 {touched}/{total} 题 ·{" "}
            {activeBank.manifest.topics.length} 个知识点
          </p>
        </div>
      </header>

      <section className="card hero-card">
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
        <div className="hero-actions">
          <button
            type="button"
            className="btn lg btn-primary"
            onClick={() => navigate("practice")}
          >
            <IconPlay size={16} />
            {resume === null ? "开始练习" : "继续练习"}
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate("review")}>
            <IconStar size={16} />
            去复习（{wrong} 错题 / {favorites} 收藏）
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate("banks")}>
            挑题练习
          </button>
        </div>
      </section>

      <section className="kpis" aria-label="学习概览">
        <div className="kpi">
          <div className="kpi-num">
            {touched}
            <span className="kpi-sub">/{total}</span>
          </div>
          <div className="kpi-label">做过的题</div>
        </div>
        <div className="kpi bad">
          <div className="kpi-num no">{wrong}</div>
          <div className="kpi-label">错题</div>
        </div>
        <div className="kpi due">
          <div className="kpi-num due">{stats.dueCount}</div>
          <div className="kpi-label">今日到期</div>
        </div>
        <div className="kpi ok">
          <div className="kpi-num ok">{correctOnce}</div>
          <div className="kpi-label">答对过的题</div>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <h2 className="mb-0">今天做什么</h2>
          <span className="spacer" />
          <IconSpark size={16} />
        </div>
        <p className="muted mt-2">
          {stats.dueCount === 0
            ? "现在没有到期的题。答错后按 1 天 → 3 天 → 7 天排期，连续 3 次独立复习答对即转已掌握。"
            : "这些题已经到了复习时间。到期规则见 ADR-0006：按 24 小时推进，不含已掌握的题。"}
        </p>
        {stats.dueCount === 0 ? null : (
          <div className="row mt-3">
            <button type="button" className="btn" onClick={() => navigate("review")}>
              去复习（{stats.dueCount}）
            </button>
          </div>
        )}

        <details className="stat-details">
          <summary>更多数据</summary>
          <div className="stat-grid">
            <div className="stat-item">
              <b>{(stats.firstAccuracy.value * 100).toFixed(0)}%</b>
              <span>首次正确率（{stats.firstAccuracy.total} 题）</span>
            </div>
            <div className="stat-item">
              <b>{(stats.repeatAccuracy.value * 100).toFixed(0)}%</b>
              <span>重做正确率（{stats.repeatAccuracy.total} 次）</span>
            </div>
            <div className="stat-item">
              <b>{(stats.mastery.value * 100).toFixed(0)}%</b>
              <span>
                掌握度（{stats.mastery.correct}/{stats.mastery.total}）
              </span>
            </div>
            <div className="stat-item">
              <b>{(stats.studyTimeMs / 60000).toFixed(1)} 分</b>
              <span>学习时长 · 收藏 {favorites}</span>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
