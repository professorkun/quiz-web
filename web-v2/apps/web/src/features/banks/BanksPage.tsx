/**
 * 题库页（S3 · T3-4）：切换题库、筛选、搜索、预览、知识讲义。
 *
 * 筛选逻辑刻意**留在这个页面里**，不下沉到存储层：
 * 存储只管"取本库全部"，口径属于业务（ADR-0005 的"筛选放上层"）。
 * 这样 Web/小程序/云端的筛选语义只有一份，不会各写一套。
 */

import { useEffect, useMemo, useState } from "react";

import {
  getQuestionType,
  listQuestionTypes,
  type Question,
  type QuestionProgress,
  type QuestionType,
} from "@quiz/core";

import { RichText } from "../../components/RichText";
import { usePlatform } from "../../platform/PlatformProvider";
import { getRenderer } from "../../renderers";

type StatusFilter = "all" | "unseen" | "wrong" | "correct";

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "全部",
  unseen: "未做",
  wrong: "答错",
  correct: "答对过",
};

function statusOf(progress: QuestionProgress | undefined): StatusFilter {
  if (progress === undefined || progress.attemptsCount === 0) return "unseen";
  if (progress.wrongCount > 0) return "wrong";
  return "correct";
}

function stemPreview(stem: string, limit = 60): string {
  const flat = stem.replace(/\s+/g, " ").replace(/[#*`>|-]/g, "").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit)}…`;
}

export function BanksPage(): React.ReactElement {
  const { platform, activeBank, banks, selectBank, version, bump, showToast } = usePlatform();
  const bankId = activeBank.manifest.bankId;

  const [progress, setProgress] = useState<readonly QuestionProgress[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(new Set());
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<QuestionType | "all">("all");
  const [topicId, setTopicId] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const [rows, favorites] = await Promise.all([
        platform.progress.listByBank(bankId),
        platform.favorites.listByBank(bankId),
      ]);
      if (cancelled) return;
      setProgress(rows);
      setFavoriteIds(new Set(favorites.map((f) => f.questionId)));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [platform, bankId, version]);

  const progressMap = useMemo(() => {
    const map = new Map<string, QuestionProgress>();
    for (const row of progress) map.set(row.questionId, row);
    return map;
  }, [progress]);

  const topicName = useMemo(() => {
    const map = new Map<string, string>();
    for (const topic of activeBank.manifest.topics) map.set(topic.topicId, topic.name);
    return map;
  }, [activeBank]);

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return activeBank.questions.filter((question) => {
      if (type !== "all" && question.type !== type) return false;
      if (topicId !== "all" && !question.topicIds.includes(topicId)) return false;
      if (status !== "all" && statusOf(progressMap.get(question.questionId)) !== status) return false;
      if (needle !== "" && !question.stem.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [activeBank.questions, type, topicId, status, keyword, progressMap]);

  const selected: Question | undefined =
    filtered.find((q) => q.questionId === selectedId) ??
    filtered[0] ??
    activeBank.questions.find((q) => q.questionId === selectedId);

  const toggleFavorite = async (questionId: string): Promise<void> => {
    try {
      if (favoriteIds.has(questionId)) {
        await platform.favorites.remove(bankId, questionId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(questionId);
          return next;
        });
      } else {
        await platform.favorites.add(bankId, questionId, new Date().toISOString());
        setFavoriteIds((prev) => new Set(prev).add(questionId));
      }
      bump();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "收藏操作失败");
    }
  };

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of activeBank.questions) {
      counts.set(question.type, (counts.get(question.type) ?? 0) + 1);
    }
    return counts;
  }, [activeBank.questions]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>题库</h1>
          <p className="muted">切换题库、按题型/知识点/状态筛选，或直接搜题干。</p>
        </div>
      </header>

      <section className="card">
        <h2>题库切换</h2>
        <div className="chips">
          {banks.map((bank) => (
            <button
              key={bank.manifest.bankId}
              type="button"
              className={bank.manifest.bankId === bankId ? "chip on" : "chip"}
              onClick={() => void selectBank(bank.manifest.bankId)}
            >
              {bank.manifest.title}（{bank.questions.length}）
            </button>
          ))}
        </div>
        {banks.length < 2 ? (
          <p className="muted">只有一份题库时切换器没有意义；可在「我的」页导入第二份题库包。</p>
        ) : null}
      </section>

      <section className="card">
        <div className="toolbar">
          <input
            className="input"
            type="search"
            placeholder="搜索题干关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            aria-label="搜索题干"
          />
          <span className="muted">命中 {filtered.length} 题</span>
        </div>

        <div className="chips">
          <button
            type="button"
            className={type === "all" ? "chip on" : "chip"}
            onClick={() => setType("all")}
          >
            全部题型
          </button>
          {listQuestionTypes().map((def) => {
            const count = typeCounts.get(def.type) ?? 0;
            return (
              <button
                key={def.type}
                type="button"
                disabled={count === 0}
                className={type === def.type ? "chip on" : "chip"}
                onClick={() => setType(def.type as QuestionType)}
              >
                {def.label}（{count}）
              </button>
            );
          })}
        </div>

        <div className="chips">
          <button
            type="button"
            className={topicId === "all" ? "chip on" : "chip"}
            onClick={() => setTopicId("all")}
          >
            全部知识点
          </button>
          {activeBank.manifest.topics.map((topic) => (
            <button
              key={topic.topicId}
              type="button"
              className={topicId === topic.topicId ? "chip on" : "chip"}
              onClick={() => setTopicId(topic.topicId)}
            >
              {topic.name}
            </button>
          ))}
        </div>

        <div className="chips">
          {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              className={status === key ? "chip on" : "chip"}
              onClick={() => setStatus(key)}
            >
              {STATUS_LABEL[key]}
            </button>
          ))}
        </div>
      </section>

      <div className="split">
        <section className="card listpane">
          {filtered.length === 0 ? (
            <div className="empty">
              <p>没有符合条件的题目。</p>
              <p className="muted">放宽题型或状态筛选试试；搜索只匹配题干文字。</p>
              <button
                type="button"
                className="btn gray"
                onClick={() => {
                  setKeyword("");
                  setType("all");
                  setTopicId("all");
                  setStatus("all");
                }}
              >
                清空筛选
              </button>
            </div>
          ) : (
            <ul className="qlist">
              {filtered.map((question, index) => {
                const state = statusOf(progressMap.get(question.questionId));
                const isFavorite = favoriteIds.has(question.questionId);
                return (
                  <li key={question.questionId}>
                    <button
                      type="button"
                      className={
                        question.questionId === selected?.questionId ? "qrow on" : "qrow"
                      }
                      onClick={() => setSelectedId(question.questionId)}
                      data-question-id={question.questionId}
                    >
                      <span className="qrow-seq">{index + 1}</span>
                      <span className="qrow-main">
                        <span className="qrow-stem">{stemPreview(question.stem)}</span>
                        <span className="qrow-meta">
                          {getQuestionType(question.type).label} ·{" "}
                          {question.topicIds.map((id) => topicName.get(id) ?? id).join(" / ")}
                        </span>
                      </span>
                      <span className={`badge ${state}`}>{STATUS_LABEL[state]}</span>
                      {isFavorite ? <span className="badge fav">★</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card preview">
          {selected === undefined ? (
            <div className="empty">
              <p>从左侧选一道题查看完整题面。</p>
            </div>
          ) : (
            <>
              <div className="row">
                <h2 style={{ margin: 0 }}>{getQuestionType(selected.type).label}</h2>
                <span className="spacer" />
                <button
                  type="button"
                  className="chip"
                  onClick={() => void toggleFavorite(selected.questionId)}
                >
                  {favoriteIds.has(selected.questionId) ? "★ 已收藏" : "☆ 收藏"}
                </button>
              </div>
              <QuestionPreview question={selected} />
              <p className="muted" style={{ marginTop: 10 }}>
                答案与解析在作答后显示。
              </p>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h2>知识讲义</h2>
        {activeBank.knowledge.length === 0 ? (
          <p className="muted">这份题库还没配知识讲义。</p>
        ) : (
          <div className="knowledge">
            {activeBank.knowledge.map((module) => (
              <details key={module.moduleId} className="kmodule">
                <summary>
                  {module.title}
                  <span className="muted"> · {topicName.get(module.topicId) ?? module.topicId}</span>
                </summary>
                <p className="muted">{module.summary}</p>
                <ul>
                  {module.items.map((item) => (
                    <li key={item.title}>
                      <strong>{item.title}</strong>：{item.detail}
                    </li>
                  ))}
                </ul>
                {module.pitfalls.length === 0 ? null : (
                  <div className="notice small">
                    易错点：
                    {module.pitfalls.map((pitfall) => (
                      <div key={pitfall}>· {pitfall}</div>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * 只读预览：直接用该题型的渲染器，页面不判断"这题该怎么画"。
 *
 * 判断题/选择题/填空/代码填空都由各自的渲染器决定形态；
 * 新增题型只要注册，这里自动就支持——这才是扩展点该有的样子（ADR-0004）。
 */
function QuestionPreview(props: { readonly question: Question }): React.ReactElement {
  const Renderer = getRenderer(props.question.type);
  return (
    <div style={{ marginTop: 10 }}>
      <Renderer
        question={props.question}
        answer={undefined}
        optionOrder={undefined}
        grade={undefined}
        selfRating={undefined}
        locked
        onChange={() => undefined}
        onSelfRating={() => undefined}
      />
    </div>
  );
}
