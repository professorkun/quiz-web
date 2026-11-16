/**
 * T2-7：会话恢复与修订冲突（对应方案 §6-E 场景 1 / 2 / 4）。
 *
 * 所有断言都针对「序列化 → 反序列化」后的对象，模拟真实刷新，
 * 而不是直接比较内存里的同一个引用。
 */

import { describe, expect, it } from "vitest";

import { computeRevision } from "../revision.js";
import type { Question } from "../schema.js";
import { BANK_ID, makeMixedQuestions } from "./fixtures.js";
import {
  createSession,
  goNext,
  moveTo,
  setAnswer,
  setSelfRating,
  submitCurrent,
} from "./engine.js";
import { restoreSession, serializeSession } from "./session.js";
import type { AnswerValue, PracticeConfig, SessionSnapshot } from "./types.js";

const questions = makeMixedQuestions();
const NOW = "2026-11-16T20:00:00.000Z";
const config: PracticeConfig = { bankId: BANK_ID, order: "sequential", seed: 7 };

function rightAnswer(q: Question): AnswerValue {
  switch (q.type) {
    case "single_choice":
      return q.answer;
    case "multiple_choice":
      return q.answer;
    case "true_false":
      return q.answer;
    case "fill_blank":
      return Object.fromEntries(q.blanks.map((b) => [b.blankId, b.accepted[0] ?? ""]));
    case "code_blank":
      return Object.fromEntries(q.blanks.map((b) => [b.blankId, b.accepted[0] ?? ""]));
    case "short_answer":
      return "参考答案要点";
  }
}

/** 已答到第 7 题、第 3 题答错、第 1 题答对并带自评记录的会话 */
function answeredSession(): SessionSnapshot {
  let s = createSession({ questions, config, sessionId: "s-1", now: NOW });
  for (let i = 0; i < 7; i++) {
    const qid = s.questionIds[i]!;
    const q = questions.find((x) => x.questionId === qid)!;
    s = setAnswer(s, qid, i === 2 ? "错误答案" : rightAnswer(q), `t${i}`);
    s = submitCurrent(s, questions, `t${i}`);
    if (i < 6) s = goNext(s, `t${i}`);
  }
  return s;
}

describe("会话序列化与恢复", () => {
  it("场景 1：刷新后仍在第 7 题，题序/选项序/已答状态逐项一致，第 3 题仍显示答错", () => {
    const before = answeredSession();
    const result = restoreSession(serializeSession(before), questions);

    expect(result.ok).toBe(true);
    expect(result.conflicts).toEqual([]);
    const after = result.session!;
    expect(after.cursor).toBe(6);
    expect(after.questionIds).toEqual(before.questionIds);
    expect(after.optionOrders).toEqual(before.optionOrders);
    expect(after.answers).toEqual(before.answers);
    expect(after.grades).toEqual(before.grades);
    expect(after.grades[before.questionIds[2]!]?.correct).toBe(false);
    expect(after.grades[before.questionIds[0]!]?.correct).toBe(true);
    expect(after.config.seed).toBe(before.config.seed);
  });

  it("同一种子两次创建会话的题序完全一致（ADR-0003 判定 1）", () => {
    const a = createSession({ questions, config: { ...config, order: "random", seed: 12345 }, sessionId: "a", now: NOW });
    const b = createSession({ questions, config: { ...config, order: "random", seed: 12345 }, sessionId: "b", now: NOW });
    expect(a.questionIds).toEqual(b.questionIds);
    expect(a.optionOrders).toEqual(b.optionOrders);
  });

  it("场景 2：作答记录只存 optionId，序列化结果里没有展示字母", () => {
    let s = createSession({ questions, config, sessionId: "s-2", now: NOW });
    const qid = questions[0]!.questionId;
    s = setAnswer(s, qid, "o2", NOW);
    const raw = serializeSession(s);
    const parsed = JSON.parse(raw) as SessionSnapshot;
    expect(parsed.answers[qid]).toBe("o2");
    expect(raw).not.toMatch(/:["']A["']/);
    expect(raw).not.toMatch(/:["']B["']/);
    expect(raw).not.toMatch(/:["']C["']/);
  });

  it("场景 4：某题 revision 1→2，恢复时提示、该题重答，其余题与已完成记录保留", () => {
    const before = answeredSession();
    const changedId = before.questionIds[2]!;
    const updated = questions.map((q) =>
      q.questionId === changedId
        ? { ...q, revision: computeRevision({ id: q.questionId, tag: 2 }) }
        : q,
    );
    const result = restoreSession(serializeSession(before), updated);

    expect(result.ok).toBe(true);
    expect(result.conflicts).toEqual([changedId]);
    expect(result.warnings.join("\n")).toMatch(/已更新/);
    const after = result.session!;
    expect(after.answers[changedId]).toBeUndefined();
    expect(after.grades[changedId]).toBeUndefined();
    expect(after.questionRevisions[changedId]).toBe(updated.find((q) => q.questionId === changedId)!.revision);
    // 其余题与已完成记录原样保留
    expect(after.questionIds).toEqual(before.questionIds);
    expect(after.cursor).toBe(before.cursor);
    expect(after.grades[before.questionIds[0]!]).toEqual(before.grades[before.questionIds[0]!]);
    expect(after.grades[before.questionIds[3]!]).toEqual(before.grades[before.questionIds[3]!]);
  });

  it("题目下线也算冲突，明确提示而不是静默错位", () => {
    const before = answeredSession();
    const removedId = before.questionIds[4]!;
    const shrunk = questions.filter((q) => q.questionId !== removedId);
    const result = restoreSession(serializeSession(before), shrunk);
    expect(result.conflicts).toContain(removedId);
    expect(result.warnings.join("\n")).toMatch(/已从题库下线/);
    expect(result.session!.grades[before.questionIds[0]!]).toEqual(before.grades[before.questionIds[0]!]);
  });

  it("选项集合变化：保留已有顺序、补齐新选项、只给警告", () => {
    const before = answeredSession();
    const qid = before.questionIds.find((id) => before.optionOrders[id] !== undefined)!;
    const broken: SessionSnapshot = {
      ...before,
      optionOrders: { ...before.optionOrders, [qid]: ["o1", "ghost"] },
    };
    const updated = questions.map((q) =>
      q.questionId === qid && "options" in q
        ? { ...q, options: [...q.options, { optionId: "o4", text: "丁" }] }
        : q,
    );
    const result = restoreSession(serializeSession(broken), updated);
    expect(result.warnings.join("\n")).toMatch(/选项有更新/);
    expect(result.session!.optionOrders[qid]).toEqual(["o1", "o2", "o3", "o4"]);
  });

  it("自评与作答分开存储，刷新后都能恢复", () => {
    let s = createSession({ questions, config, sessionId: "s-3", now: NOW });
    const short = questions.find((q) => q.type === "short_answer")!;
    s = moveTo(s, s.questionIds.indexOf(short.questionId), NOW);
    s = setAnswer(s, short.questionId, "我的原文", NOW);
    s = submitCurrent(s, questions, NOW);
    s = setSelfRating(s, short.questionId, "half", NOW);
    const after = restoreSession(serializeSession(s), questions).session!;
    expect(after.answers[short.questionId]).toBe("我的原文");
    expect(after.grades[short.questionId]?.correct).toBeNull();
    expect(after.selfRatings[short.questionId]).toEqual({ level: "half", score: 2.5, maxScore: 5 });
  });

  it("版本不兼容：提示会话已过期、不崩溃，已完成记录保留", () => {
    const before = answeredSession();
    const future = { ...before, version: 999 };
    const result = restoreSession(serializeSession(future as unknown as SessionSnapshot), questions);
    expect(result.ok).toBe(false);
    expect(result.session).toBeNull();
    expect(result.reason).toMatch(/已过期/);
    expect(result.preserved.length).toBe(7);
    expect(result.preserved[0]?.grade).toBeDefined();
  });

  it("损坏的 JSON 不会抛异常，给出可显示的提示", () => {
    const result = restoreSession("{不是 JSON", questions);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/已损坏/);
  });
});
