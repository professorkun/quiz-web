/** T5-3：模考会话——计时、中断恢复（D-3）、超时判定 */

import { describe, expect, it } from "vitest";

import type { Question } from "../schema.js";
import { makeQuestion } from "../practice/fixtures.js";
import type { ExamPaper } from "./assemble.js";
import {
  createExamSession,
  currentExamQuestionId,
  examGoNext,
  examGoPrev,
  isExamExpired,
  moveExamTo,
  remainingMs,
  restoreExamSession,
  serializeExamSession,
  setExamAnswer,
  unansweredQuestionIds,
  type ExamSessionSnapshot,
} from "./session.js";

const NOW = "2026-11-17T09:00:00.000Z";

/** 20 道单选：复刻 D-3「进行到第 20 题」的卷面规模 */
function makeQuestions(): Question[] {
  return Array.from({ length: 20 }, (_, i) =>
    makeQuestion({
      type: "single_choice",
      questionId: `javaweb:single_choice:${String(i + 1).padStart(3, "0")}`,
      stem: `第 ${i + 1} 题`,
      options: [
        { optionId: "o1", text: "甲" },
        { optionId: "o2", text: "乙" },
      ],
      answer: "o1",
    }),
  );
}

function makePaper(durationSec?: number): ExamPaper {
  const questions = makeQuestions();
  return {
    templateId: "javaweb:exam:test",
    bankId: "javaweb",
    title: "测试卷",
    seed: 42,
    items: questions.map((q) => ({
      sectionId: "s1",
      questionId: q.questionId,
      maxScore: 2,
    })),
    optionOrders: Object.fromEntries(questions.map((q) => [q.questionId, ["o2", "o1"]])),
    questionRevisions: Object.fromEntries(questions.map((q) => [q.questionId, q.revision])),
    totalScore: 40,
    ...(durationSec === undefined ? {} : { durationSec }),
  };
}

describe("模考会话创建与计时", () => {
  it("限时卷：deadlineAt = now + durationSec；剩余时间随 now 走", () => {
    const session = createExamSession({
      paper: makePaper(3600),
      sessionId: "e-1",
      now: NOW,
    });
    expect(session.deadlineAt).toBe("2026-11-17T10:00:00.000Z");
    expect(remainingMs(session, NOW)).toBe(3600 * 1000);
    expect(remainingMs(session, "2026-11-17T09:48:00.000Z")).toBe(12 * 60 * 1000);
  });

  it("不限时卷（旧版行为）：deadlineAt 为 null，不判定超时", () => {
    const session = createExamSession({ paper: makePaper(), sessionId: "e-1", now: NOW });
    expect(session.deadlineAt).toBeNull();
    expect(remainingMs(session, "2030-01-01T00:00:00.000Z")).toBeNull();
    expect(isExamExpired(session, "2030-01-01T00:00:00.000Z")).toBe(false);
  });

  it("过了截止时刻 → isExamExpired，剩余为负（超时自动交卷的触发条件）", () => {
    const session = createExamSession({ paper: makePaper(600), sessionId: "e-1", now: NOW });
    expect(isExamExpired(session, "2026-11-17T09:09:59.000Z")).toBe(false);
    expect(isExamExpired(session, "2026-11-17T09:10:00.000Z")).toBe(true);
    expect(remainingMs(session, "2026-11-17T09:11:00.000Z")).toBe(-60_000);
  });
});

describe("中断恢复（D-3）", () => {
  function midExamSession(): ExamSessionSnapshot {
    let s = createExamSession({ paper: makePaper(3600), sessionId: "e-3", now: NOW });
    for (let i = 0; i < 19; i++) {
      s = setExamAnswer(s, s.items[i]!.questionId, "o1", NOW);
      s = examGoNext(s, NOW);
    }
    return s;
  }

  it("进行到第 20 题、剩 12 分钟 → 序列化恢复后题号、已答、剩余时间、选项序全在", () => {
    const questions = makeQuestions();
    const s = midExamSession();
    expect(currentExamQuestionId(s)).toBe(questions[19]!.questionId);
    const now = "2026-11-17T09:48:00.000Z";
    expect(remainingMs(s, now)).toBe(12 * 60 * 1000);

    const restored = restoreExamSession(serializeExamSession(s), questions);
    expect(restored.ok).toBe(true);
    const r = restored.session!;
    expect(r.cursor).toBe(19);
    expect(currentExamQuestionId(r)).toBe(questions[19]!.questionId);
    expect(Object.keys(r.answers)).toHaveLength(19);
    expect(r.answers[questions[0]!.questionId]).toBe("o1");
    // 剩余时间按绝对截止时刻算，刷新耗时不会被"补回来"
    expect(remainingMs(r, now)).toBe(12 * 60 * 1000);
    expect(r.optionOrders).toEqual(s.optionOrders);
    expect(r.items.map((i) => i.questionId)).toEqual(s.items.map((i) => i.questionId));
    expect(restored.conflicts).toEqual([]);
  });

  it("revision 变化的题：只清该题作答并提示，其余保留", () => {
    const questions = makeQuestions();
    const s = midExamSession();
    const changed = questions.map((q, i) =>
      i === 0 ? ({ ...q, revision: "abcdef123456" } as Question) : q,
    );
    const restored = restoreExamSession(serializeExamSession(s), changed);
    expect(restored.ok).toBe(true);
    expect(restored.conflicts).toEqual([questions[0]!.questionId]);
    expect(restored.session!.answers[questions[0]!.questionId]).toBeUndefined();
    expect(restored.session!.answers[questions[1]!.questionId]).toBe("o1");
    expect(restored.warnings[0]).toContain("已更新");
  });

  it("题目下线：从卷面剔除并提示，游标不越界", () => {
    const questions = makeQuestions();
    const s = moveExamTo(midExamSession(), 19, NOW);
    const removed = questions.slice(0, 19);
    const restored = restoreExamSession(serializeExamSession(s), removed);
    expect(restored.ok).toBe(true);
    expect(restored.conflicts).toEqual([questions[19]!.questionId]);
    expect(restored.session!.items).toHaveLength(19);
    expect(restored.session!.cursor).toBe(18);
  });

  it("会话版本不兼容 → 明确提示，不静默清空", () => {
    const s = midExamSession();
    const restored = restoreExamSession(
      JSON.stringify({ ...s, version: 99 }),
      makeQuestions(),
    );
    expect(restored.ok).toBe(false);
    expect(restored.reason).toContain("不兼容");
    expect(restored.session).toBeNull();
  });

  it("损坏数据 → 明确提示", () => {
    expect(restoreExamSession("{不是 JSON", makeQuestions()).ok).toBe(false);
    expect(restoreExamSession("42", makeQuestions()).ok).toBe(false);
    expect(restoreExamSession(JSON.stringify({ version: 1 }), makeQuestions()).reason).toContain(
      "字段缺失",
    );
  });
});

describe("作答与未答统计", () => {
  it("交卷前答案可改（与练习逐题锁定不同）", () => {
    const questions = makeQuestions();
    let s = createExamSession({ paper: makePaper(600), sessionId: "e-1", now: NOW });
    const id = questions[0]!.questionId;
    s = setExamAnswer(s, id, "o1", NOW);
    s = setExamAnswer(s, id, "o2", NOW);
    expect(s.answers[id]).toBe("o2");
  });

  it("未作答统计：无选择/空文本/空位全空都算未答", () => {
    const questions = [
      makeQuestion({
        type: "single_choice",
        questionId: "javaweb:single_choice:001",
        options: [
          { optionId: "o1", text: "甲" },
          { optionId: "o2", text: "乙" },
        ],
        answer: "o1",
      }),
      makeQuestion({
        type: "short_answer",
        questionId: "javaweb:short_answer:001",
        rubric: [{ pointId: "p1", text: "要点", score: 5 }],
      }),
      makeQuestion({
        type: "fill_blank",
        questionId: "javaweb:fill_blank:001",
        stem: "填 {{b1}} 与 {{b2}}",
        blanks: [
          { blankId: "b1", accepted: ["甲"] },
          { blankId: "b2", accepted: ["乙"] },
        ],
      }),
    ];
    const paper: ExamPaper = {
      templateId: "t",
      bankId: "javaweb",
      title: "t",
      seed: 1,
      items: questions.map((q) => ({ sectionId: "s", questionId: q.questionId, maxScore: 1 })),
      optionOrders: {},
      questionRevisions: Object.fromEntries(questions.map((q) => [q.questionId, q.revision])),
      totalScore: 3,
    };
    let s = createExamSession({ paper, sessionId: "e-1", now: NOW });
    s = setExamAnswer(s, questions[1]!.questionId, "   ", NOW);
    s = setExamAnswer(s, questions[2]!.questionId, { b1: "", b2: "" }, NOW);
    expect(unansweredQuestionIds(s, questions)).toEqual([
      questions[0]!.questionId,
      questions[1]!.questionId,
      questions[2]!.questionId,
    ]);

    s = setExamAnswer(s, questions[2]!.questionId, { b1: "甲", b2: "" }, NOW);
    expect(unansweredQuestionIds(s, questions)).toEqual([
      questions[0]!.questionId,
      questions[1]!.questionId,
    ]);
  });

  it("导航不越界", () => {
    let s = createExamSession({ paper: makePaper(), sessionId: "e-1", now: NOW });
    s = examGoPrev(s, NOW);
    expect(s.cursor).toBe(0);
    s = moveExamTo(s, 999, NOW);
    expect(s.cursor).toBe(19);
    s = examGoNext(s, NOW);
    expect(s.cursor).toBe(19);
  });
});
