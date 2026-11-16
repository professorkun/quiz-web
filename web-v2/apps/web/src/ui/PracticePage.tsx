import { useEffect, useMemo, useState } from "react";

import {
  createSession,
  currentQuestionId,
  getQuestionType,
  goNext,
  goPrev,
  listQuestionTypes,
  selectQuestions,
  sessionResult,
  setAnswer,
  setSelfRating,
  submitCurrent,
  type AnswerValue,
  type BankPackage,
  type PracticeConfig,
  type QuestionType,
  type SelfRatingLevel,
  type SessionResult,
  type SessionSnapshot,
} from "@quiz/core";

import { RichText } from "../components/RichText";
import { getRenderer } from "../renderers";
import { clearSession, loadSession, saveSession } from "../session/storage";

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

interface PracticePageProps {
  readonly bank: BankPackage;
}

export function PracticePage(props: PracticePageProps): React.ReactElement {
  const { bank } = props;
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [notices, setNotices] = useState<readonly string[]>([]);
  const [topicId, setTopicId] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<QuestionType | "all">("all");
  const [order, setOrder] = useState<"sequential" | "random">("random");
  const [limit, setLimit] = useState<number>(10);

  // 开场先尝试恢复上次会话；版本不兼容/修订冲突都通过 notices 明确展示
  useEffect(() => {
    const restored = loadSession(bank.manifest.bankId, bank.questions);
    if (restored === null) return;
    if (restored.ok && restored.session !== null) {
      setSession(restored.session);
      setNotices(restored.warnings);
    } else {
      setNotices([restored.reason ?? "会话已过期，请重新开始"]);
      clearSession(bank.manifest.bankId);
    }
  }, [bank]);

  useEffect(() => {
    if (session !== null) saveSession(bank.manifest.bankId, session);
  }, [session, bank]);

  const start = (): void => {
    const config: PracticeConfig = {
      bankId: bank.manifest.bankId,
      order,
      seed: newSeed(),
      ...(topicId === "all" ? {} : { topicIds: [topicId] }),
      ...(typeFilter === "all" ? {} : { types: [typeFilter] }),
      ...(limit === 0 ? {} : { limit }),
    };
    try {
      const created = createSession({
        questions: bank.questions,
        config,
        sessionId: `s-${Date.now()}`,
        now: nowIso(),
      });
      setSession(created);
      setNotices([]);
    } catch (error) {
      setNotices([error instanceof Error ? error.message : "无法开始练习"]);
    }
  };

  const restart = (): void => {
    clearSession(bank.manifest.bankId);
    setSession(null);
    setNotices([]);
  };

  const counts = useMemo<Record<SessionResult, number>>(() => {
    const base: Record<SessionResult, number> = { right: 0, wrong: 0, unseen: 0, self: 0 };
    if (session !== null) {
      for (const id of session.questionIds) base[sessionResult(session, id)] += 1;
    }
    return base;
  }, [session]);

  const view = useMemo(() => {
    if (session === null) return null;
    const questionId = currentQuestionId(session);
    const question =
      questionId === undefined
        ? undefined
        : bank.questions.find((q) => q.questionId === questionId);
    return {
      questionId,
      question,
      grade: questionId === undefined ? undefined : session.grades[questionId],
    };
  }, [session, bank]);

  if (session === null) {
    const types = listQuestionTypes();
    return (
      <div className="wrap">
        <div className="card">
          <h1>{bank.manifest.title}</h1>
          <p className="muted">
            共 {bank.questions.length} 题 · {bank.manifest.topics.length} 个知识点
          </p>

          {notices.length > 0 ? (
            <div className="notice">
              {notices.map((text, index) => (
                <div key={index}>{text}</div>
              ))}
            </div>
          ) : null}

          <h2>知识点</h2>
          <div className="chips">
            <button type="button" className={chip(topicId === "all")} onClick={() => setTopicId("all")}>
              全部
            </button>
            {bank.manifest.topics.map((topic) => (
              <button
                key={topic.topicId}
                type="button"
                className={chip(topicId === topic.topicId)}
                onClick={() => setTopicId(topic.topicId)}
              >
                {topic.name}
              </button>
            ))}
          </div>

          <h2>题型</h2>
          <div className="chips">
            <button
              type="button"
              className={chip(typeFilter === "all")}
              onClick={() => setTypeFilter("all")}
            >
              全部
            </button>
            {types.map((def) => {
              // 用引擎的选题函数计数，避免在页面里另写一套筛选口径
              const count = selectQuestions(bank.questions, {
                bankId: bank.manifest.bankId,
                order: "sequential",
                seed: 0,
                types: [def.type as QuestionType],
              }).length;
              return (
                <button
                  key={def.type}
                  type="button"
                  disabled={count === 0}
                  className={chip(typeFilter === def.type)}
                  onClick={() => setTypeFilter(def.type as QuestionType)}
                >
                  {def.label}（{count}）
                </button>
              );
            })}
          </div>

          <h2>顺序</h2>
          <div className="chips">
            <button type="button" className={chip(order === "random")} onClick={() => setOrder("random")}>
              随机（可复现种子）
            </button>
            <button type="button" className={chip(order === "sequential")} onClick={() => setOrder("sequential")}>
              题库原序
            </button>
          </div>

          <h2>本轮题量</h2>
          <div className="chips">
            {[10, 20, 0].map((value) => (
              <button
                key={value}
                type="button"
                className={chip(limit === value)}
                onClick={() => setLimit(value)}
              >
                {value === 0 ? "全部" : `${value} 题`}
              </button>
            ))}
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={start}>
              开始练习
            </button>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            选完立刻可提交；刷新页面会回到同一题、同一选项顺序。
            「只刷未做 / 未掌握」由练习引擎支持，待 S4 接入学习记录后在此开放。
          </p>
        </div>
      </div>
    );
  }

  if (view === null || view.questionId === undefined || view.question === undefined) {
    return (
      <div className="wrap">
        <div className="card">
          <div className="notice">当前题目已不在题库中，无法继续；已完成记录已保留。</div>
          <button type="button" className="btn" onClick={restart}>
            重新开始
          </button>
        </div>
      </div>
    );
  }

  const { questionId, question, grade } = view;
  const Renderer = getRenderer(question.type);
  // 填空题把输入框嵌在题干里，题干由渲染器负责，页面不再画一遍原文
  const stemInRenderer = getQuestionType(question.type).stemInRenderer;
  const done = counts.unseen === 0 && counts.right + counts.wrong + counts.self > 0;

  return (
    <div className="wrap">
      <header className="card">
        <div className="row">
          <h1>{bank.manifest.title}</h1>
          <span className="spacer" />
          <span className="muted">
            第 {session.cursor + 1} / {session.questionIds.length} 题
          </span>
        </div>
        <div className="progress">
          <i style={{ width: `${((session.cursor + 1) / session.questionIds.length) * 100}%` }} />
        </div>
        {notices.length > 0 ? (
          <div className="notice" style={{ marginTop: 10 }}>
            {notices.map((text, index) => (
              <div key={index}>{text}</div>
            ))}
          </div>
        ) : null}
      </header>

      <section className="card" data-question-id={questionId}>
        {stemInRenderer ? null : (
          <div className="stem">
            <RichText text={question.stem} />
          </div>
        )}

        <Renderer
          question={question}
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

        {grade !== undefined ? (
          <div
            className={`feedback ${
              grade.correct === null ? "self" : grade.correct ? "ok" : "no"
            }`}
          >
            {grade.correct === null
              ? "主观题：请对照参考答案自评"
              : `${grade.correct ? "✔ 答对了" : "✘ 答错了"} · ${round(grade.score)} / ${grade.maxScore} 分`}
          </div>
        ) : null}

        {/* 简答题的解析由渲染器在参考答案区展示，这里只负责客观题的解析 */}
        {grade !== undefined && grade.correct !== null && question.explanation !== undefined ? (
          <div className="muted" style={{ marginTop: 8 }}>
            <RichText text={question.explanation} />
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 14 }}>
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
            disabled={grade !== undefined}
            onClick={() => setSession(submitCurrent(session, bank.questions, nowIso()))}
          >
            提交答案
          </button>
          <button
            type="button"
            className="btn gray"
            disabled={session.cursor >= session.questionIds.length - 1}
            onClick={() => setSession(goNext(session, nowIso()))}
          >
            下一题
          </button>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={restart}>
            重新开始
          </button>
        </div>
      </section>

      {done ? (
        <section className="card">
          <h2>本轮完成</h2>
          <div className="row muted">
            答对 {counts.right} · 答错 {counts.wrong} · 待自评 {counts.self} · 未答 {counts.unseen}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={restart}>
              再来一轮
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
