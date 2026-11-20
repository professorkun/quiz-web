/**
 * 刷题页（S3 · T3-6 / 美化 C-05）：练习设置 + 当前会话 + 作答落库。
 *
 * 与 S2 版本的差别只有三处，但每一处都对应一条验收：
 * 1. 设置从本地存储读写（进页面恢复上次的范围/题量），不再只活在内存里；
 * 2. 每次提交生成一条**不可变** `Attempt`，并据此重算该题的派生态；
 * 3. 会话快照交给存储适配器，刷新/关浏览器后仍能续上（且能跨库各存一份）。
 *
 * 时间一律走 `Date.now()` 的**唯一入口**（`nowIso` / `questionStart`），
 * 方便 S4 换成注入时钟后做时间旅行测试。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildAttempt,
  createSession,
  currentQuestionId,
  getQuestionType,
  goNext,
  goPrev,
  restoreSession,
  selectQuestions,
  serializeSession,
  sessionResult,
  setAnswer,
  setSelfRating,
  submitCurrent,
  type AnswerValue,
  type PracticeConfig,
  type PracticeSettings,
  type Question,
  type QuestionProgress,
  type QuestionType,
  type SelfRatingLevel,
  type SessionResult,
  type SessionSnapshot,
} from "@quiz/core";
import { computeProgress } from "@quiz/data";

import { RichText } from "../../components/RichText";
import { usePlatform } from "../../platform/PlatformProvider";
import { getRenderer } from "../../renderers";
import { navigate } from "../../router";
import {
  IconCheckCircle,
  IconClock,
  IconClose,
  IconPencil,
  IconStar,
  IconXCircle,
} from "../../ui/icons";

const nowIso = (): string => new Date().toISOString();

function newSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] ?? 1;
  }
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

const round = (value: number): number => Math.round(value * 100) / 100;
const chip = (on: boolean): string => (on ? "chip on" : "chip");

type SessionMode = "practice" | "review";

const MODE_LABEL: Record<SessionMode, string> = { practice: "练习", review: "复习" };

export function PracticePage(): React.ReactElement {
  const { platform, activeBank, version, bump, showToast, pendingSession, consumePendingSession } =
    usePlatform();
  const bankId = activeBank.manifest.bankId;

  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [mode, setMode] = useState<SessionMode>("practice");
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [progress, setProgress] = useState<readonly QuestionProgress[]>([]);
  const [notices, setNotices] = useState<readonly string[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [ready, setReady] = useState(false);
  const questionStart = useRef<number>(Date.now());
  const submitting = useRef(false);

  // 进页面：读设置 + 恢复会话快照（快照按题库分开存，不会串库）
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const [saved, rows, snapshot, lastSession] = await Promise.all([
        platform.settings.getPractice(bankId),
        platform.progress.listByBank(bankId),
        platform.sessionSnapshots.load(bankId),
        platform.sessions.getCurrent(bankId),
      ]);
      if (cancelled) return;
      setSettings(saved);
      setProgress(rows);

      if (snapshot === null) {
        setSession(null);
      } else {
        const restored = restoreSession(snapshot, activeBank.questions);
        if (restored.ok && restored.session !== null) {
          setSession(restored.session);
          // 模式不写进快照（那是引擎的结构），改从会话摘要里认；认不出就按练习处理
          setMode(
            lastSession !== null &&
              lastSession.sessionId === restored.session.sessionId &&
              lastSession.mode === "review"
              ? "review"
              : "practice",
          );
          setNotices(restored.warnings);
        } else {
          setNotices([restored.reason ?? "上次会话已过期，请重新开始"]);
          await platform.sessionSnapshots.clear(bankId);
        }
      }
      setReady(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [platform, bankId, activeBank.questions]);

  // 会话变化即落盘：快照只存一份，后写覆盖前写（它就是"当前进度"）
  useEffect(() => {
    if (!ready || session === null) return;
    void platform.sessionSnapshots.save(bankId, serializeSession(session));
  }, [platform, bankId, session, ready]);

  // 换题就重置计时器——"本题耗时"从看清题干那一刻算起
  const currentId = session === null ? undefined : currentQuestionId(session);
  useEffect(() => {
    questionStart.current = Date.now();
    if (currentId === undefined) return;
    let cancelled = false;
    void platform.favorites.has(bankId, currentId).then((has) => {
      if (!cancelled) setFavorite(has);
    });
    return () => {
      cancelled = true;
    };
  }, [platform, bankId, currentId, version]);

  const saveSettings = async (next: PracticeSettings): Promise<void> => {
    setSettings(next);
    try {
      await platform.settings.savePractice(bankId, next);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "设置保存失败");
    }
  };

  const beginSession = useCallback(
    (questions: readonly Question[], config: PracticeConfig, nextMode: SessionMode): void => {
      const created = createSession({
        questions,
        config,
        progress,
        sessionId: `s-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        now: nowIso(),
      });
      setSession(created);
      setMode(nextMode);
      setNotices([]);
    },
    [progress],
  );

  // 从「复习」带过来的题单：只练这些题，顺序固定，便于逐题核对
  useEffect(() => {
    if (!ready || pendingSession === null || settings === null) return;
    const picked: Question[] = [];
    for (const id of pendingSession.questionIds) {
      const found = activeBank.questions.find((q) => q.questionId === id);
      if (found !== undefined) picked.push(found);
    }
    consumePendingSession();
    if (picked.length === 0) {
      setNotices([`${pendingSession.origin}里的题目已不在当前题库中，可能题库换版本了`]);
      return;
    }
    beginSession(
      picked,
      { bankId, order: "sequential", seed: newSeed(), limit: picked.length },
      pendingSession.mode,
    );
  }, [ready, pendingSession, settings, activeBank.questions, bankId, beginSession, consumePendingSession]);

  const start = (): void => {
    if (settings === null) return;
    const config: PracticeConfig = {
      bankId,
      order: settings.order,
      seed: newSeed(),
      ...(settings.topicIds.length === 0 ? {} : { topicIds: settings.topicIds }),
      ...(settings.types.length === 0 ? {} : { types: settings.types }),
      ...(settings.limit === 0 ? {} : { limit: settings.limit }),
      ...(settings.onlyUnseen ? { onlyUnseen: true } : {}),
      ...(settings.onlyUnmastered ? { onlyUnmastered: true } : {}),
    };
    try {
      beginSession(activeBank.questions, config, "practice");
    } catch (error) {
      setNotices([error instanceof Error ? error.message : "无法开始练习"]);
    }
  };

  const restart = async (): Promise<void> => {
    await platform.sessionSnapshots.clear(bankId);
    setSession(null);
    setMode("practice");
    setNotices([]);
    bump();
  };

  /**
   * 提交：先算判分，再把事件落库。
   * 事件写入失败不能影响本轮作答——页面上已经显示对错，记录下次还能补；
   * 所以这里提示而不是回滚 UI。
   */
  const submit = async (): Promise<void> => {
    if (session === null || submitting.current) return;
    const questionId = currentQuestionId(session);
    if (questionId === undefined) return;
    const question = activeBank.questions.find((q) => q.questionId === questionId);
    const answer = session.answers[questionId];
    if (question === undefined || answer === undefined) return;

    submitting.current = true;
    try {
      const submittedAt = nowIso();
      const next = submitCurrent(session, activeBank.questions, submittedAt);
      setSession(next);

      const grade = next.grades[questionId];
      if (grade === undefined) return;

      const history = await platform.attempts.listByQuestion(bankId, questionId);
      const attempt = buildAttempt({
        attemptId: `${next.sessionId}-${history.length + 1}`,
        question,
        answer,
        grade,
        mode,
        sessionId: next.sessionId,
        startedAt: new Date(questionStart.current).toISOString(),
        submittedAt,
        durationMs: Date.now() - questionStart.current,
        history,
      });
      await platform.attempts.append(attempt);

      const derived = computeProgress(bankId, questionId, [...history, attempt]);
      await platform.progress.save(derived);

      await platform.sessions.save({
        sessionId: next.sessionId,
        bankId,
        mode,
        questionIds: [...next.questionIds],
        cursor: next.cursor,
        results: summarize(next),
        startedAt: next.startedAt,
        updatedAt: submittedAt,
      });

      setProgress((prev) => {
        const rest = prev.filter((p) => p.questionId !== questionId);
        return [...rest, derived];
      });
      bump();
    } catch (cause) {
      showToast(
        cause instanceof Error
          ? `本题记录未保存：${cause.message}`
          : "本题记录未保存，请检查本地存储",
      );
    } finally {
      submitting.current = false;
    }
  };

  const toggleFavorite = async (): Promise<void> => {
    if (currentId === undefined) return;
    try {
      if (favorite) {
        await platform.favorites.remove(bankId, currentId);
        setFavorite(false);
      } else {
        await platform.favorites.add(bankId, currentId, nowIso());
        setFavorite(true);
      }
      bump();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "收藏操作失败");
    }
  };

  const counts = useMemo<Record<SessionResult, number>>(() => {
    const base: Record<SessionResult, number> = { right: 0, wrong: 0, unseen: 0, self: 0 };
    if (session !== null) {
      for (const id of session.questionIds) base[sessionResult(session, id)] += 1;
    }
    return base;
  }, [session]);

  // 未掌握 = 还没有被 S4 状态机判定为 mastered 的题（与新题、错题划等号，正好是可刷范围）
  const unmasteredCount = useMemo(
    () =>
      activeBank.questions.filter(
        (q) => progress.find((p) => p.questionId === q.questionId)?.mastered !== true,
      ).length,
    [activeBank.questions, progress],
  );

  if (!ready || settings === null) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <h1>刷题</h1>
            <div className="skeleton w-60" />
          </div>
        </header>
        <div className="card">
          <div className="skeleton w-80" />
          <div className="skeleton w-60" />
          <div className="skeleton w-80" />
          <div className="skeleton w-60" />
        </div>
      </div>
    );
  }

  if (session === null) {
    const types = settings.types;
    return (
      <div className="page practice-page">
        <header className="page-head">
          <div>
            <h1>刷题 · {activeBank.manifest.title}</h1>
            <p className="muted">设置会按题库保存，下次进来还是这一套。</p>
          </div>
        </header>

        {notices.length > 0 ? (
          <div className="notice">
            {notices.map((text, index) => (
              <div key={index}>{text}</div>
            ))}
          </div>
        ) : null}

        <section className="card">
          <h2>范围</h2>
          <div className="chips">
            <button
              type="button"
              className={chip(!settings.onlyUnseen && !settings.onlyUnmastered)}
              onClick={() => void saveSettings({ ...settings, onlyUnseen: false, onlyUnmastered: false })}
            >
              全部题目
            </button>
            <button
              type="button"
              className={chip(settings.onlyUnseen)}
              onClick={() => void saveSettings({ ...settings, onlyUnseen: true, onlyUnmastered: false })}
            >
              只刷未做（{Math.max(0, activeBank.questions.length - progress.length)}）
            </button>
            <button
              type="button"
              className={chip(settings.onlyUnmastered)}
              disabled={unmasteredCount === 0}
              title={unmasteredCount === 0 ? "当前题库没有未掌握的题" : undefined}
              onClick={() => void saveSettings({ ...settings, onlyUnseen: false, onlyUnmastered: true })}
            >
              只刷未掌握（{unmasteredCount}）
            </button>
          </div>

          <h2 className="mt-4">本轮题量</h2>
          <div className="chips seg">
            {[10, 20, 0].map((value) => (
              <button
                key={value}
                type="button"
                className={chip(settings.limit === value)}
                onClick={() => void saveSettings({ ...settings, limit: value })}
              >
                {value === 0 ? "全部" : `${value} 题`}
              </button>
            ))}
          </div>

          <h2 className="mt-4">顺序</h2>
          <div className="chips seg">
            <button
              type="button"
              className={chip(settings.order === "random")}
              onClick={() => void saveSettings({ ...settings, order: "random" })}
            >
              随机（可复现种子）
            </button>
            <button
              type="button"
              className={chip(settings.order === "sequential")}
              onClick={() => void saveSettings({ ...settings, order: "sequential" })}
            >
              题库原序
            </button>
          </div>

          <details className="stat-details">
            <summary>
              知识点（{settings.topicIds.length === 0 ? "全部" : settings.topicIds.length}）
            </summary>
            <div className="chips">
              <button
                type="button"
                className={chip(settings.topicIds.length === 0)}
                onClick={() => void saveSettings({ ...settings, topicIds: [] })}
              >
                全部
              </button>
              {activeBank.manifest.topics.map((topic) => {
                const on = settings.topicIds.includes(topic.topicId);
                return (
                  <button
                    key={topic.topicId}
                    type="button"
                    className={chip(on)}
                    onClick={() =>
                      void saveSettings({
                        ...settings,
                        topicIds: on
                          ? settings.topicIds.filter((id) => id !== topic.topicId)
                          : [...settings.topicIds, topic.topicId],
                      })
                    }
                  >
                    {topic.name}
                  </button>
                );
              })}
            </div>
          </details>

          <details className="stat-details">
            <summary>题型（{types.length === 0 ? "全部" : types.length}）</summary>
            <div className="chips">
              <button
                type="button"
                className={chip(types.length === 0)}
                onClick={() => void saveSettings({ ...settings, types: [] })}
              >
                全部
              </button>
              {Array.from(new Set(activeBank.questions.map((q) => q.type))).map((key) => {
                const count = selectQuestions(activeBank.questions, {
                  bankId,
                  order: "sequential",
                  seed: 0,
                  types: [key as QuestionType],
                }).length;
                const on = types.includes(key as QuestionType);
                return (
                  <button
                    key={key}
                    type="button"
                    className={chip(on)}
                    onClick={() =>
                      void saveSettings({
                        ...settings,
                        types: on ? types.filter((t) => t !== key) : [...types, key as QuestionType],
                      })
                    }
                  >
                    {getQuestionType(key).label}（{count}）
                  </button>
                );
              })}
            </div>
          </details>

          <h2 className="mt-4">模式</h2>
          <div className="chips">
            <button type="button" className={chip(true)} onClick={() => undefined}>
              练习
            </button>
            <button type="button" className="chip" disabled title="从「复习」页进入">
              复习（从复习页进入）
            </button>
            <button type="button" className="chip" onClick={() => navigate("exam")}>
              模考（去模考页）
            </button>
          </div>
        </section>

        <div className="setup-bar">
          <button type="button" className="btn lg block" onClick={start}>
            <IconPencil size={16} />
            开始练习
          </button>
          <p className="muted mt-2">
            选完立刻可提交；刷新页面会回到同一题、同一选项顺序。作答记录只追加，不会被覆盖。
          </p>
        </div>
      </div>
    );
  }

  const questionId = currentQuestionId(session);
  const question =
    questionId === undefined
      ? undefined
      : activeBank.questions.find((q) => q.questionId === questionId);
  // 共享材料（R4-2）：练习一次只显示一题，材料随题出现
  const passage =
    question?.passageId === undefined
      ? undefined
      : activeBank.passages?.find((item) => item.passageId === question.passageId);

  if (questionId === undefined || question === undefined) {
    return (
      <div className="page">
        <div className="card">
          <div className="notice">当前题目已不在题库中，无法继续；已完成记录已保留。</div>
          <button type="button" className="btn" onClick={() => void restart()}>
            重新开始
          </button>
        </div>
      </div>
    );
  }

  const grade = session.grades[questionId];
  const Renderer = getRenderer(question.type);
  const stemInRenderer = getQuestionType(question.type).stemInRenderer;
  const done = counts.unseen === 0 && counts.right + counts.wrong + counts.self > 0;
  const progressPercent = ((session.cursor + 1) / session.questionIds.length) * 100;

  return (
    <div className="page practice-page">
      <header className="practice-head">
        <div className="practice-head-row">
          <h1>
            {MODE_LABEL[mode]} · {activeBank.manifest.title}
          </h1>
          <span className="spacer" />
          <span className="muted">
            第 {session.cursor + 1} / {session.questionIds.length} 题
          </span>
          <button type="button" className="chip" aria-pressed={favorite} onClick={() => void toggleFavorite()}>
            <IconStar size={16} filled={favorite} />
            {favorite ? "已收藏" : "收藏"}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => void restart()}>
            <IconClose size={16} />
            结束本轮
          </button>
        </div>
        <div className="progress-row mt-2">
          <div
            className="progress"
            role="progressbar"
            aria-label="练习进度"
            aria-valuemin={0}
            aria-valuemax={session.questionIds.length}
            aria-valuenow={session.cursor + 1}
          >
            <i style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="progress-value">
            {session.cursor + 1} / {session.questionIds.length}
          </span>
        </div>
        {notices.length > 0 ? (
          <div className="notice mt-2">
            {notices.map((text, index) => (
              <div key={index}>{text}</div>
            ))}
          </div>
        ) : null}
      </header>

      <section className="card motion-question" key={questionId} data-question-id={questionId}>
        {stemInRenderer ? null : (
          <div className="stem">
            <RichText text={question.stem} />
          </div>
        )}

        <Renderer
          question={question}
          passage={passage}
          answer={session.answers[questionId]}
          optionOrder={session.optionOrders[questionId]}
          locked={grade !== undefined}
          grade={grade}
          selfRating={session.selfRatings[questionId]}
          onChange={(answer: AnswerValue) =>
            setSession(setAnswer(session, questionId, answer, nowIso()))
          }
          onSelfRating={(level: SelfRatingLevel) =>
            setSession(setSelfRating(session, questionId, level, nowIso()))
          }
        />

        <div className="feedback-slot practice-feedback" aria-live="polite">
          {grade === undefined ? null : (
            <div className={`feedback ${grade.correct === null ? "self" : grade.correct ? "ok" : "no"}`}>
              {grade.correct === null ? (
                <>
                  <IconClock size={16} />
                  主观题：请对照参考答案自评
                </>
              ) : grade.correct ? (
                <>
                  <IconCheckCircle size={16} />
                  答对了 · {round(grade.score)} / {grade.maxScore} 分
                </>
              ) : (
                <>
                  <IconXCircle size={16} />
                  答错了 · {round(grade.score)} / {grade.maxScore} 分
                </>
              )}
            </div>
          )}
        </div>

        {grade !== undefined && grade.correct !== null && question.explanation !== undefined ? (
          <div className="muted mt-1">
            <RichText text={question.explanation} />
          </div>
        ) : null}
      </section>

      <div className="practice-actions">
        <button
          type="button"
          className="btn gray"
          disabled={session.cursor === 0}
          onClick={() => setSession(goPrev(session, nowIso()))}
        >
          上一题
        </button>
        <button
          type="button"
          className="btn"
          disabled={grade !== undefined || session.answers[questionId] === undefined}
          onClick={() => void submit()}
        >
          提交答案
        </button>
        <button
          type="button"
          className={grade === undefined ? "btn gray" : "btn"}
          disabled={session.cursor >= session.questionIds.length - 1}
          onClick={() => setSession(goNext(session, nowIso()))}
        >
          下一题
        </button>
      </div>

      {done ? (
        <section className="card mt-4">
          <h2>本轮完成</h2>
          <div className="row muted">
            答对 {counts.right} · 答错 {counts.wrong} · 待自评 {counts.self} · 未答 {counts.unseen}
          </div>
          <div className="row mt-3">
            <button type="button" className="btn gray" onClick={() => void restart()}>
              再来一轮
            </button>
            <button type="button" className="btn" onClick={() => navigate("review")}>
              去复习错题
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** 会话结果摘要给「我的 · 练习记录」用；主观题未自评时按"未判定"记为 unseen */
function summarize(session: SessionSnapshot): Record<string, "right" | "wrong" | "unseen"> {
  const out: Record<string, "right" | "wrong" | "unseen"> = {};
  for (const id of session.questionIds) {
    const result = sessionResult(session, id);
    out[id] = result === "right" ? "right" : result === "wrong" ? "wrong" : "unseen";
  }
  return out;
}
