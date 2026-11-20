/**
 * 题库页（S3 · T3-4 / 美化 D-03）：切换题库、筛选、搜索、预览、知识讲义。
 *
 * 筛选逻辑刻意**留在这个页面里**，不下沉到存储层：
 * 存储只管"取本库全部"，口径属于业务（ADR-0005 的"筛选放上层"）。
 * 这样 Web/小程序/云端的筛选语义只有一份，不会各写一套。
 *
 * 移动端：筛选收进底部抽屉，列表全屏，点题进入全屏预览层；
 * 筛选条件与列表滚动位置按题库记在会话存储里（不写学习记录）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getQuestionType,
  listQuestionTypes,
  type Question,
  type QuestionProgress,
  type QuestionType,
} from "@quiz/core";

import { RichText } from "../../components/RichText";
import { KnowledgePanel } from "../knowledge/KnowledgePanel";
import { applyTopicPractice } from "../knowledge/practiceLink";
import { usePlatform } from "../../platform/PlatformProvider";
import { navigate } from "../../router";
import { getRenderer } from "../../renderers";
import { IconBack, IconFilter, IconSearch, IconStar } from "../../ui/icons";
import { BankManagePanel } from "./BankManagePanel";

type StatusFilter = "all" | "unseen" | "wrong" | "correct";

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "全部",
  unseen: "未做",
  wrong: "答错",
  correct: "答对过",
};

const FILTER_KEY = "quiz:banks:filters";

interface SavedFilters {
  readonly keyword: string;
  readonly type: QuestionType | "all";
  readonly topicId: string;
  readonly status: StatusFilter;
  readonly scrollTop: number;
}

function readFilters(bankId: string): SavedFilters | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(`${FILTER_KEY}:${bankId}`);
    return raw === null || raw === undefined ? null : (JSON.parse(raw) as SavedFilters);
  } catch {
    return null;
  }
}

function writeFilters(bankId: string, value: SavedFilters): void {
  try {
    globalThis.sessionStorage?.setItem(`${FILTER_KEY}:${bankId}`, JSON.stringify(value));
  } catch {
    /* 隐私模式存不了就只保留页面内状态 */
  }
}

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

  const saved = useMemo(() => readFilters(bankId), [bankId]);

  const [progress, setProgress] = useState<readonly QuestionProgress[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(new Set());
  const [keyword, setKeyword] = useState(saved?.keyword ?? "");
  const [type, setType] = useState<QuestionType | "all">(saved?.type ?? "all");
  const [topicId, setTopicId] = useState<string>(saved?.topicId ?? "all");
  const [status, setStatus] = useState<StatusFilter>(saved?.status ?? "all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const listRef = useRef<HTMLElement | null>(null);

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

  // 切换题库时按该库自己的会话状态重置筛选（每个库各记一份）
  useEffect(() => {
    const next = readFilters(bankId);
    setKeyword(next?.keyword ?? "");
    setType(next?.type ?? "all");
    setTopicId(next?.topicId ?? "all");
    setStatus(next?.status ?? "all");
  }, [bankId]);

  // 记住筛选与滚动位置：从预览层返回 / 去练习再回来都接着看
  useEffect(() => {
    writeFilters(bankId, { keyword, type, topicId, status, scrollTop: listRef.current?.scrollTop ?? 0 });
  }, [bankId, keyword, type, topicId, status]);

  useEffect(() => {
    if (saved === null) return;
    const node = listRef.current;
    if (node !== null) node.scrollTop = saved.scrollTop;
    // 只在进页面时恢复一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // 连续查看（T-06）：移动范围跟着当前筛选走，不跳到被筛掉的题
  const currentIndex =
    selected === undefined ? -1 : filtered.findIndex((q) => q.questionId === selected.questionId);

  const [navHint, setNavHint] = useState<string | null>(null);

  const moveSelection = useCallback(
    (delta: number): void => {
      if (filtered.length === 0) return;
      const base = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = base + delta;
      if (nextIndex < 0) {
        setNavHint("已经是筛选结果的第一题");
        return;
      }
      if (nextIndex >= filtered.length) {
        setNavHint("已经是筛选结果的最后一题");
        return;
      }
      setSelectedId(filtered[nextIndex]?.questionId ?? null);
      setNavHint(null);
    },
    [filtered, currentIndex],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        moveSelection(1);
        return;
      }
      if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        moveSelection(-1);
        return;
      }
      // 空格切换答案；焦点在按钮上时交给浏览器，避免一次按键触发两次
      if (event.key === " " && tag !== "BUTTON") {
        event.preventDefault();
        setReveal((prev) => !prev);
        return;
      }
      if (event.key === "Escape") {
        if (mobilePreviewOpen) setMobilePreviewOpen(false);
        else if (reveal) setReveal(false);
      }
    };
    globalThis.addEventListener?.("keydown", onKey);
    return () => globalThis.removeEventListener?.("keydown", onKey);
  }, [moveSelection, mobilePreviewOpen, reveal]);

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

  /**
   * 从讲义跳去练习（S7-E8）：把当前知识点写进练习设置，其余设置不动。
   * 这样"学完一节就练这一节"不需要新入口，复用既有刷题页即可。
   */
  const startTopicPractice = useCallback(
    async (topicIdValue: string): Promise<void> => {
      try {
        const current = await platform.settings.getPractice(bankId);
        // 只改 topicIds 与 onlyUnseen，其余偏好原样保留（不变式见 practiceLink.ts）
        await platform.settings.savePractice(bankId, applyTopicPractice(current, topicIdValue));
        navigate("practice");
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : "无法进入练习");
      }
    },
    [platform, bankId, showToast],
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of activeBank.questions) {
      counts.set(question.type, (counts.get(question.type) ?? 0) + 1);
    }
    return counts;
  }, [activeBank.questions]);

  const activeFilterCount =
    (type === "all" ? 0 : 1) +
    (topicId === "all" ? 0 : 1) +
    (status === "all" ? 0 : 1) +
    (keyword.trim() === "" ? 0 : 1);

  const clearFilters = (): void => {
    setKeyword("");
    setType("all");
    setTopicId("all");
    setStatus("all");
  };

  const selectedTopicLabel = topicId === "all" ? "" : topicName.get(topicId) ?? topicId;

  const openQuestion = (questionId: string): void => {
    setSelectedId(questionId);
    setMobilePreviewOpen(true);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>题库</h1>
          <p className="muted">切换题库、按题型/知识点/状态筛选，或直接搜题干。</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => document.getElementById("lectures")?.scrollIntoView({ behavior: "smooth" })}
          >
            跳到知识讲义
          </button>
        </div>
      </header>

      <section className="card filter-card">
        <div className="toolbar">
          <span className="muted filter-toolbar-hint">
            <IconSearch size={16} />
          </span>
          <input
            className="input"
            type="search"
            placeholder="搜索题干关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            aria-label="搜索题干"
          />
          <span className="muted">命中 {filtered.length} 题</span>
          <button
            type="button"
            className="btn gray filter-toggle"
            onClick={() => setFiltersOpen(true)}
          >
            <IconFilter size={16} />
            筛选{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
          </button>
        </div>

        {activeFilterCount > 0 ? (
          <div className="filter-summary">
            {type === "all" ? null : (
              <span className="chip tag" data-active>
                {getQuestionType(type).label}
              </span>
            )}
            {selectedTopicLabel === "" ? null : (
              <span className="chip tag" data-active>
                {selectedTopicLabel}
              </span>
            )}
            {status === "all" ? null : (
              <span className="chip tag" data-active>
                {STATUS_LABEL[status]}
              </span>
            )}
            {keyword.trim() === "" ? null : (
              <span className="chip tag" data-active>
                “{keyword.trim()}”
              </span>
            )}
          </div>
        ) : null}

        <div className="filter-panel" data-open={filtersOpen}>
          <div className="drawer-head">
            <h2>筛选</h2>
            <button type="button" className="btn gray sm" onClick={() => setFiltersOpen(false)}>
              收起
            </button>
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

          <div className="drawer-foot">
            <button type="button" className="btn gray" onClick={clearFilters}>
              重置全部
            </button>
            <button type="button" className="btn" onClick={() => setFiltersOpen(false)}>
              查看 {filtered.length} 题
            </button>
          </div>
        </div>
      </section>

      <div className="filter-backdrop" data-open={filtersOpen} onClick={() => setFiltersOpen(false)} />

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

      <BankManagePanel />

      <div className="split">
        <section className="card listpane" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="empty">
              <p>没有符合条件的题目。</p>
              <p className="muted">放宽题型或状态筛选试试；搜索只匹配题干文字。</p>
              <button type="button" className="btn gray" onClick={clearFilters}>
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
                      className={question.questionId === selected?.questionId ? "qrow on" : "qrow"}
                      onClick={() => openQuestion(question.questionId)}
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
                      {isFavorite ? (
                        <span className="badge fav">
                          <IconStar size={16} filled />
                        </span>
                      ) : null}
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
                <h2 className="mb-0">{getQuestionType(selected.type).label}</h2>
                <span className="spacer" />
                <button
                  type="button"
                  className="chip"
                  onClick={() => void toggleFavorite(selected.questionId)}
                >
                  <IconStar size={16} filled={favoriteIds.has(selected.questionId)} />
                  {favoriteIds.has(selected.questionId) ? "已收藏" : "收藏"}
                </button>
              </div>
              <div className="preview-nav">
                <span className="muted">
                  第 {currentIndex + 1} / {filtered.length} 题
                </span>
                <span className="spacer" />
                <button type="button" className="btn gray sm" onClick={() => moveSelection(-1)}>
                  上一题 K
                </button>
                <button type="button" className="btn gray sm" onClick={() => moveSelection(1)}>
                  下一题 J
                </button>
              </div>
              {navHint === null ? null : (
                <div className="notice small" role="status">
                  {navHint}
                </div>
              )}
              <QuestionPreview
                question={selected}
                reveal={reveal}
                onToggleReveal={() => setReveal((prev) => !prev)}
              />
              <p className="muted mt-2">
                可展开查看答案与解析；J / K 翻题，Esc 收起，查看不会产生作答记录。
              </p>
            </>
          )}
        </section>
      </div>

      {selected === undefined ? null : (
        <div className="mobile-preview" data-open={mobilePreviewOpen}>
          <div className="mobile-preview-head">
            <button type="button" className="btn ghost sm" onClick={() => setMobilePreviewOpen(false)}>
              <IconBack size={16} />
              返回列表
            </button>
            <span className="badge">{getQuestionType(selected.type).label}</span>
            <button
              type="button"
              className="chip"
              onClick={() => void toggleFavorite(selected.questionId)}
            >
              <IconStar size={16} filled={favoriteIds.has(selected.questionId)} />
              {favoriteIds.has(selected.questionId) ? "已收藏" : "收藏"}
            </button>
          </div>
          <div className="mobile-preview-body">
            <div className="preview-nav">
              <span className="muted">
                第 {currentIndex + 1} / {filtered.length} 题
              </span>
              <span className="spacer" />
              <button type="button" className="btn gray sm" onClick={() => moveSelection(-1)}>
                上一题 K
              </button>
              <button type="button" className="btn gray sm" onClick={() => moveSelection(1)}>
                下一题 J
              </button>
            </div>
            {navHint === null ? null : (
              <div className="notice small" role="status">
                {navHint}
              </div>
            )}
            <QuestionPreview
              question={selected}
              reveal={reveal}
              onToggleReveal={() => setReveal((prev) => !prev)}
            />
            <p className="muted mt-3">
              可展开查看答案与解析；J / K 翻题，Esc 关闭，查看不会产生作答记录。
            </p>
          </div>
        </div>
      )}

      <section className="card" id="lectures">
        <h2>知识讲义</h2>
        <p className="muted">
          左边选一节精读，右边是正文、配套视频与易错点；读完可以直接去练这一节。
        </p>
        <KnowledgePanel
          modules={activeBank.knowledge}
          topics={activeBank.manifest.topics}
          storageKey={bankId}
          onPractice={(topicIdValue) => void startTopicPractice(topicIdValue)}
        />
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
function QuestionPreview(props: {
  readonly question: Question;
  readonly reveal: boolean;
  readonly onToggleReveal: () => void;
}): React.ReactElement {
  const Renderer = getRenderer(props.question.type);
  return (
    <div className="mt-2 q-preview">
      <Renderer
        question={props.question}
        answer={undefined}
        optionOrder={undefined}
        grade={undefined}
        selfRating={undefined}
        locked
        preview
        reveal={props.reveal}
        onToggleReveal={props.onToggleReveal}
        onChange={() => undefined}
        onSelfRating={() => undefined}
      />
    </div>
  );
}
