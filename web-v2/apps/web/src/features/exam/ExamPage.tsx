/**
 * 模考页（S5 · T5-3 / T5-5 / T5-7 / 美化 D-05）：组卷 → 计时作答 → 交卷 → 成绩明细。
 *
 * 与旧版的对等点：
 * - 「还有 N 题未作答，确定交卷？」的交卷确认（冒烟 #3）；
 * - 客观题自动判分、应用题逐空给分（D-4）、简答对照参考答案自评（D-5）；
 * - 顶部计时：限时模板倒计时、超时自动交卷有提示；不限时模板像旧版一样累计用时。
 *
 * 有意差异（对照表见 docs/reports/s5-feature-parity.md）：
 * - 作答按题分页（D-3「回到第 20 题」以逐题为准），旧版是整卷长页；
 * - 未作答的客观题记 0 分但**不写 Attempt**，不再像旧版那样灌进错题本。
 *
 * 时间一律走 `platform.clock`（可注入），核心判分/组卷/计时全在 `@quiz/core`。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import {
  PaperAssemblyError,
  assemblePaper,
  buildAttempt,
  buildExamRecord,
  createExamSession,
  currentExamQuestionId,
  examGoNext,
  examGoPrev,
  getQuestionType,
  gradeExamPaper,
  isExamExpired,
  itemDetailMap,
  moveExamTo,
  remainingMs,
  restoreExamSession,
  scoreBySection,
  serializeExamSession,
  setExamAnswer,
  unansweredQuestionIds,
  type AnswerValue,
  type Attempt,
  type ExamPaper,
  type ExamRecord,
  type ExamSessionSnapshot,
  type Question,
  type SelfRatingLevel,
} from "@quiz/core";
import { computeProgress } from "@quiz/data";

import { RichText } from "../../components/RichText";
import { usePlatform } from "../../platform/PlatformProvider";
import { getRenderer } from "../../renderers";
import { navigate } from "../../router";
import { IconCheck, IconCheckCircle, IconClock, IconClose, IconExam, IconXCircle } from "../../ui/icons";

const round = (value: number): number => Math.round(value * 100) / 100;

/** mm:ss；超过 1 小时用 h:mm:ss。旧版 fmtTime 同形（不足补零） */
function fmtTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

type Verdict = "right" | "wrong" | "unanswered" | "self";

const VERDICT_LABEL: Record<Verdict, string> = {
  right: "答对了",
  wrong: "答错了",
  unanswered: "未作答",
  self: "主观题 · 对照参考答案自评",
};

function verdictOf(item: ExamRecord["items"][number]): Verdict {
  if (!item.answered && item.correct !== null) return "unanswered";
  if (item.correct === null) return "self";
  return item.correct ? "right" : "wrong";
}

function VerdictIcon(props: { readonly verdict: Verdict }): React.ReactElement {
  if (props.verdict === "right") return <IconCheckCircle size={16} />;
  if (props.verdict === "wrong") return <IconXCircle size={16} />;
  if (props.verdict === "unanswered") return <IconClock size={16} />;
  return <IconExam size={16} />;
}

export function ExamPage(): React.ReactElement {
  const { platform, activeBank, version, bump, showToast } = usePlatform();
  const bankId = activeBank.manifest.bankId;

  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<ExamSessionSnapshot | null>(null);
  const [record, setRecord] = useState<ExamRecord | null>(null);
  const [records, setRecords] = useState<readonly ExamRecord[]>([]);
  const [notices, setNotices] = useState<readonly string[]>([]);
  const [nowTick, setNowTick] = useState(() => platform.clock.now().toISOString());
  const submitting = useRef(false);

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of activeBank.questions) map.set(q.questionId, q);
    return map;
  }, [activeBank.questions]);

  /* ---------------------------------------------------------- 载入与恢复 */

  const reloadRecords = useCallback(async (): Promise<void> => {
    setRecords(await platform.exams.listRecords(bankId));
  }, [platform, bankId]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const raw = await platform.exams.getSessionSnapshot(bankId);
      if (cancelled) return;
      if (raw === null) {
        setSession(null);
      } else {
        const restored = restoreExamSession(raw, activeBank.questions);
        if (restored.ok && restored.session !== null) {
          setSession(restored.session);
          setNotices(restored.warnings);
        } else {
          setNotices([restored.reason ?? "上次模考会话已过期，请重新开始"]);
          await platform.exams.clearSessionSnapshot(bankId);
        }
      }
      await reloadRecords();
      if (!cancelled) setReady(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [platform, bankId, activeBank.questions, reloadRecords]);

  // 会话变化即落盘：刷新/关页面后按原题序、原选项序、原剩余时间恢复（D-3）
  useEffect(() => {
    if (!ready || session === null) return;
    void platform.exams.saveSessionSnapshot(bankId, serializeExamSession(session));
  }, [platform, bankId, session, ready]);

  // 一秒一跳的计时源：统一从注入时钟取"现在"
  useEffect(() => {
    const timer = setInterval(() => setNowTick(platform.clock.now().toISOString()), 1000);
    return () => clearInterval(timer);
  }, [platform]);

  /* -------------------------------------------------------------- 交卷 */

  const submitPaper = useCallback(
    async (timedOut: boolean): Promise<void> => {
      if (session === null || submitting.current) return;
      submitting.current = true;
      try {
        const submittedAt = platform.clock.now().toISOString();
        const summary = gradeExamPaper({
          items: session.items,
          questions: activeBank.questions,
          answers: session.answers,
        });

        // 逐题写入作答事件（mode: "exam"）；未作答的不写——未答不是一次作答事件
        const allHistory = await platform.attempts.listByBank(bankId);
        const historyByQuestion = new Map<string, Attempt[]>();
        for (const a of allHistory) {
          const list = historyByQuestion.get(a.questionId) ?? [];
          list.push(a);
          historyByQuestion.set(a.questionId, list);
        }
        const derived: ReturnType<typeof computeProgress>[] = [];
        for (const [index, item] of summary.items.entries()) {
          if (!item.answered) continue;
          const question = questionsById.get(item.questionId);
          if (question === undefined) continue;
          const history = historyByQuestion.get(item.questionId) ?? [];
          const attempt = buildAttempt({
            attemptId: `${session.sessionId}-${index}`,
            question,
            answer: item.answer as AnswerValue,
            grade: {
              correct: item.correct,
              score: item.score,
              maxScore: item.maxScore,
              ...(item.details === undefined ? {} : { details: item.details }),
            },
            mode: "exam",
            sessionId: session.sessionId,
            startedAt: session.startedAt,
            submittedAt,
            history,
          });
          await platform.attempts.append(attempt);
          derived.push(computeProgress(bankId, item.questionId, [...history, attempt]));
        }
        for (const row of derived) await platform.progress.save(row);

        const durationSec = Math.max(
          0,
          Math.round((Date.parse(submittedAt) - Date.parse(session.startedAt)) / 1000),
        );
        const examRecord = buildExamRecord({
          // 同一会话重复交卷（异常重试）落到同一条记录上，幂等
          recordId: `r-${session.sessionId}`,
          bankId,
          templateId: session.templateId,
          sessionId: session.sessionId,
          seed: session.seed,
          startedAt: session.startedAt,
          submittedAt,
          durationSec,
          timedOut,
          summary,
        });
        await platform.exams.appendRecord(examRecord);
        await platform.exams.clearSessionSnapshot(bankId);

        setSession(null);
        setRecord(examRecord);
        setNotices([]);
        await reloadRecords();
        bump();
        showToast(timedOut ? "考试时间到，已自动交卷" : "交卷成功，成绩已保存");
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : "交卷失败，请重试");
      } finally {
        submitting.current = false;
      }
    },
    [session, platform, activeBank.questions, bankId, questionsById, reloadRecords, bump, showToast],
  );

  // 超时自动交卷：倒计时走到 0 触发（T5-3）
  useEffect(() => {
    if (!ready || session === null) return;
    if (isExamExpired(session, nowTick)) void submitPaper(true);
  }, [ready, session, nowTick, submitPaper]);

  /* -------------------------------------------------------- 自评（成绩页） */

  const rateSelf = async (questionId: string, level: SelfRatingLevel | null): Promise<void> => {
    if (record === null) return;
    try {
      await platform.exams.updateSelfRating(
        bankId,
        record.recordId,
        questionId,
        level,
        platform.clock.now().toISOString(),
      );
      const fresh = await platform.exams.getRecord(bankId, record.recordId);
      if (fresh !== null) setRecord(fresh);
      bump();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "自评保存失败");
    }
  };

  /* -------------------------------------------------------------- 开考 */

  const startExam = (templateId: string): void => {
    const template = activeBank.manifest.examTemplates.find((t) => t.templateId === templateId);
    if (template === undefined) return;
    try {
      // 32 位无符号种子（XOR 结果可能是负数，>>> 0 归一，record.seed 契约要求非负）
      const seed =
        (platform.clock.now().getTime() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
      const paper: ExamPaper = assemblePaper({
        template,
        questions: activeBank.questions,
        seed,
      });
      setRecord(null);
      setSession(createExamSession({ paper, sessionId: newId("e"), now: platform.clock.now().toISOString() }));
      setNotices([]);
    } catch (error) {
      if (error instanceof PaperAssemblyError) {
        setNotices(error.issues.map((i) => `${i.message}（${i.path}）`));
      } else {
        setNotices([error instanceof Error ? error.message : "无法开始考试"]);
      }
    }
  };

  const abandonExam = async (): Promise<void> => {
    if (session === null) return;
    if (!window.confirm("放弃本次考试？已作答内容不会保存成绩。")) return;
    await platform.exams.clearSessionSnapshot(bankId);
    setSession(null);
    setNotices([]);
    bump();
  };

  if (!ready) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <h1>模考</h1>
            <div className="skeleton w-60" />
          </div>
        </header>
        <div className="card">
          <div className="skeleton w-80" />
          <div className="skeleton w-60" />
          <div className="skeleton w-80" />
        </div>
      </div>
    );
  }

  /* ================================================== 成绩页（交卷后） */

  if (record !== null) {
    return (
      <ExamScoreView
        record={record}
        questionsById={questionsById}
        bankTitle={activeBank.manifest.title}
        onRateSelf={rateSelf}
        onBack={() => {
          setRecord(null);
          void reloadRecords();
        }}
      />
    );
  }

  /* ==================================================== 考试进行中 */

  if (session !== null) {
    const questionId = currentExamQuestionId(session);
    const question = questionId === undefined ? undefined : questionsById.get(questionId);
    const remaining = remainingMs(session, nowTick);
    const unanswered = unansweredQuestionIds(session, activeBank.questions);

    if (questionId === undefined || question === undefined) {
      return (
        <div className="page">
          <div className="card">
            <div className="notice">当前题目已不在题库中，无法继续。</div>
            <button type="button" className="btn" onClick={() => void abandonExam()}>
              放弃本次考试
            </button>
          </div>
        </div>
      );
    }

    const Renderer = getRenderer(question.type);
    const stemInRenderer = getQuestionType(question.type).stemInRenderer;
    const urgent = remaining !== null && remaining <= 5 * 60 * 1000;

    return (
      <div className="page practice-page">
        <header className="card exam-head">
          <div className="row">
            <h1>{session.title}</h1>
            <span className="spacer" />
            <span
              className={urgent ? "exam-timer urgent" : "exam-timer"}
              data-testid="exam-timer"
              title={remaining === null ? "不限时，累计用时" : "剩余时间，到点自动交卷"}
            >
              <IconClock size={16} />
              {remaining === null ? fmtTime(Date.parse(nowTick) - Date.parse(session.startedAt)) : fmtTime(remaining)}
            </span>
            <button
              type="button"
              className="btn"
              data-testid="submit-paper"
              onClick={() => {
                // 与旧版一致：有未答题才拦一道确认（冒烟 #3）
                if (
                  unanswered.length > 0 &&
                  !window.confirm(`还有 ${unanswered.length} 题未作答，确定交卷？`)
                ) {
                  return;
                }
                void submitPaper(false);
              }}
            >
              交 卷
            </button>
          </div>
          <div className="row muted mt-1">
            {`第 ${session.cursor + 1} / ${session.items.length} 题 · 已答 ${session.items.length - unanswered.length} · 未答 ${unanswered.length}`}
          </div>
          <details className="qpanel" open>
            <summary>题号 · {session.cursor + 1}/{session.items.length}</summary>
            <div className="qgrid">
              {session.items.map((item, index) => {
                const answered = session.answers[item.questionId] !== undefined;
                const cls = [
                  "qnum",
                  index === session.cursor ? "current" : "",
                  answered ? "answered" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={item.questionId}
                    type="button"
                    className={cls}
                    aria-label={`第 ${index + 1} 题${answered ? "，已作答" : "，未作答"}`}
                    aria-current={index === session.cursor ? "true" : undefined}
                    onClick={() => setSession(moveExamTo(session, index, platform.clock.now().toISOString()))}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </details>
          {notices.length > 0 ? (
            <div className="notice mt-2">
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
            locked={false}
            grade={undefined}
            selfRating={undefined}
            onChange={(answer: AnswerValue) =>
              setSession(setExamAnswer(session, questionId, answer, platform.clock.now().toISOString()))
            }
            onSelfRating={undefined}
          />

          <div className="practice-actions">
            <button
              type="button"
              className="btn gray"
              disabled={session.cursor === 0}
              onClick={() => setSession(examGoPrev(session, platform.clock.now().toISOString()))}
            >
              上一题
            </button>
            <button
              type="button"
              className="btn gray"
              disabled={session.cursor >= session.items.length - 1}
              onClick={() => setSession(examGoNext(session, platform.clock.now().toISOString()))}
            >
              下一题
            </button>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => void abandonExam()}>
              <IconClose size={16} />
              放弃考试
            </button>
          </div>
        </section>

        <p className="muted mt-2">
          交卷后显示得分、逐空明细与解析；简答题对照参考答案自评。刷新页面会回到本题，倒计时按绝对截止时间继续走。
        </p>
      </div>
    );
  }

  /* ====================================================== 首页（选卷） */

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{`模考 · ${activeBank.manifest.title}`}</h1>
          <p className="muted">按模板随机组卷，交卷后自动判分；简答与应用题对照参考答案自评。</p>
        </div>
      </header>

      {notices.length > 0 ? (
        <div className="notice">
          {notices.map((text, index) => (
            <div key={index}>{text}</div>
          ))}
        </div>
      ) : null}

      {activeBank.manifest.examTemplates.length === 0 ? (
        <section className="card">
          <h2>还没有可考的试卷模板</h2>
          <p className="muted">这个题库没有配置考试模板。导入带模板的题库包，或换一个题库。</p>
        </section>
      ) : (
        activeBank.manifest.examTemplates.map((template) => {
          const count = template.sections.reduce((a, s) => a + s.count, 0);
          return (
            <section className="card clickable" key={template.templateId}>
              <h2>{template.title}</h2>
              <div className="row muted">
                {`共 ${count} 题 / ${template.totalScore} 分 · ${
                  template.durationSec === undefined ? "不限时" : `限时 ${fmtTime(template.durationSec * 1000)}`
                }`}
              </div>
              <div className="chips mt-2">
                {template.sections.map((s) => (
                  <span key={s.sectionId} className="chip tag">
                    {`${s.title} ${s.count} 题 × ${s.scoreEach} 分`}
                  </span>
                ))}
              </div>
              <div className="row mt-3">
                <button
                  type="button"
                  className="btn"
                  data-testid={`start-${template.templateId}`}
                  onClick={() => startExam(template.templateId)}
                >
                  <IconExam size={16} />
                  开始考试
                </button>
              </div>
            </section>
          );
        })
      )}

      <section className="card">
        <h2>历史成绩</h2>
        {records.length === 0 ? (
          <p className="muted">还没有成绩记录，做一套卷试试。</p>
        ) : (
          <ul className="rlist">
            {records.map((row) => (
              <li className="ritem" key={row.recordId}>
                <div className="ritem-main">
                  <div className="ritem-stem">
                    {`${row.submittedAt.slice(0, 10)} · ${round(row.totalScore)} / ${row.totalMax} 分`}
                  </div>
                  {row.timedOut ? <div className="ritem-meta">超时交卷</div> : null}
                </div>
                <button type="button" className="chip" onClick={() => setRecord(row)}>
                  查看
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* --------------------------------------------------------- 成绩页组件 */

function ExamScoreView(props: {
  readonly record: ExamRecord;
  readonly questionsById: ReadonlyMap<string, Question>;
  readonly bankTitle: string;
  readonly onRateSelf: (questionId: string, level: SelfRatingLevel | null) => Promise<void>;
  readonly onBack: () => void;
}): React.ReactElement {
  const { record, questionsById } = props;
  const sections = scoreBySection({
    items: record.items,
    objectiveScore: record.objectiveScore,
    objectiveMax: record.objectiveMax,
    selfMax: record.selfMax,
    totalMax: record.totalMax,
  });
  const total = record.objectiveScore + record.selfScore;
  const percent = record.totalMax === 0 ? 0 : Math.round((total / record.totalMax) * 100);
  const levelText =
    total >= 90
      ? "稳了，保持手感"
      : total >= 75
        ? "不错，重点补错题"
        : total >= 60
          ? "刚好及格，主观题再背一轮"
          : "客观题还没过关，回题库刷一遍";

  return (
    <div className="page">
      <header className="card score-card">
        <h1>成绩 · {record.templateId}</h1>
        <div
          className="score-ring"
          style={{ "--pct": percent } as CSSProperties}
          role="img"
          aria-label={`总分 ${round(total)} / ${record.totalMax} 分`}
        >
          <div className="score-ring-inner">
            <div className="score-total" data-testid="exam-total">
              {round(total)}
              <small> / {record.totalMax}</small>
            </div>
            <div className="muted">得分</div>
          </div>
        </div>
        <div className="muted">{levelText}</div>
        <div className="chips mt-2">
          <span className="chip tag">
            {`客观题 ${round(record.objectiveScore)} / ${record.objectiveMax}`}
          </span>
          <span className="chip tag">
            {`主观题自评 ${round(record.selfScore)} / ${record.selfMax}`}
          </span>
          <span className="chip tag">{`用时 ${fmtTime(record.durationSec * 1000)}`}</span>
          {record.timedOut ? <span className="chip tag">超时自动交卷</span> : null}
        </div>

        <div className="score-sections">
          {sections.map((s) => {
            const pct = s.max === 0 ? 0 : Math.round((s.score / s.max) * 100);
            return (
              <div className="score-section" key={s.sectionId}>
                <div className="score-section-head">
                  <span>{`${s.sectionId}（${s.count} 题）`}</span>
                  <b>{`${round(s.score)} / ${s.max}`}</b>
                </div>
                <div className="score-bar">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="row mt-3">
          <button type="button" className="btn gray" onClick={props.onBack}>
            返回模考
          </button>
          <button type="button" className="btn" onClick={() => navigate("review")}>
            去复习错题
          </button>
        </div>
      </header>

      {record.items.map((item, index) => {
        const question = questionsById.get(item.questionId);
        const verdict = verdictOf(item);
        return (
          <section className="card" key={item.questionId} data-question-id={item.questionId}>
            <div className="row">
              <b>{`第 ${index + 1} 题 · ${question ? getQuestionType(question.type).label : item.questionType}`}</b>
              <span className="spacer" />
              <span className="muted">{`${round(item.score + (item.selfRating?.score ?? 0))} / ${item.maxScore} 分`}</span>
            </div>
            <div
              className={`feedback ${verdict === "right" ? "ok" : verdict === "wrong" ? "no" : "self"}`}
            >
              <VerdictIcon verdict={verdict} />
              {VERDICT_LABEL[verdict]}
            </div>

            {item.details !== undefined ? (
              // 空位题：明细逐空对错（D-4「明细显示哪两空错误」），按"有无明细"分流，不判题型
              <div className="chips mt-2">
                {item.details.map((d) => {
                  const detail = itemDetailMap(item).get(d.key);
                  return (
                    <span
                      key={d.key}
                      className="chip tag"
                      title={`你的作答：${d.given || "（空）"}`}
                      aria-label={`${d.key} ${detail === true ? "正确" : "错误"}`}
                    >
                      {d.key}
                      {detail === true ? <IconCheck size={16} /> : <IconClose size={16} />}
                    </span>
                  );
                })}
              </div>
            ) : question === undefined ? null : (
              <div className="stem mt-2">
                <RichText text={question.stem} />
              </div>
            )}

            {question?.explanation === undefined ? null : (
              <div className="muted mt-1">
                <RichText text={question.explanation} />
              </div>
            )}

            {item.correct === null ? (
              <div className="chips mt-2">
                <button
                  type="button"
                  className={item.selfRating?.level === "full" ? "chip on" : "chip"}
                  onClick={() => void props.onRateSelf(item.questionId, "full")}
                >
                  {`全对 ${item.maxScore} 分`}
                </button>
                <button
                  type="button"
                  className={item.selfRating?.level === "half" ? "chip on" : "chip"}
                  onClick={() => void props.onRateSelf(item.questionId, "half")}
                >
                  {`一半 ${item.maxScore / 2} 分`}
                </button>
                <button
                  type="button"
                  className={item.selfRating?.level === "none" ? "chip on" : "chip"}
                  onClick={() => void props.onRateSelf(item.questionId, "none")}
                >
                  没答对 0 分
                </button>
                {item.selfRating === null ? (
                  <span className="muted">未自评</span>
                ) : (
                  <span className="muted">
                    {`已自评：${
                      item.selfRating.level === "full" ? "全对" : item.selfRating.level === "half" ? "一半" : "没答对"
                    }`}
                  </span>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
