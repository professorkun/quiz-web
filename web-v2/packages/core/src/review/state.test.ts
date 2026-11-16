/**
 * 复习状态机与调度（S4 G4-2、§6-B 的机器证据）。
 *
 * 用例按"状态迁移表 + 时间旅行"组织，不测实现细节：
 * 只断言"给定事件序列，状态与下次到期时间应该是什么"。
 * 这样以后重写实现（比如换成分数式）也照样能验规则。
 */

import { describe, expect, it } from "vitest";

import {
  addHours,
  dueQuestionIds,
  DEFAULT_REVIEW_CONFIG,
  INITIAL_REVIEW_STATE,
  isDue,
  isIndependentReview,
  reduceReview,
  replayReview,
  type ReviewEvent,
  type ReviewState,
} from "./index.js";
import type { Attempt } from "../schema.js";

const T0 = "2026-11-16T09:00:00.000Z";
const plus = (iso: string, hours: number): string => addHours(iso, hours);

const ev = (correct: boolean | null, at: string, sessionId = "s-1"): ReviewEvent => ({
  correct,
  submittedAt: at,
  sessionId,
});

/** 把事件序列折叠成状态 */
const fold = (events: readonly ReviewEvent[]): ReviewState =>
  events.reduce<ReviewState>((state, e) => reduceReview(state, e), INITIAL_REVIEW_STATE);

describe("状态迁移表", () => {
  it("new + 答错 → learning，连续答对归零，次日再复习", () => {
    const state = fold([ev(false, T0)]);
    expect(state.status).toBe("learning");
    expect(state.streak).toBe(0);
    expect(state.nextReviewAt).toBe("2026-11-17T09:00:00.000Z");
  });

  it("learning + 重做答对 → reviewing，3 天后再复习（不立即移出错题）", () => {
    const state = fold([ev(false, T0), ev(true, plus(T0, 24), "s-2")]);
    expect(state.status).toBe("reviewing");
    expect(state.streak).toBe(1);
    expect(state.nextReviewAt).toBe(plus(plus(T0, 24), 72));
  });

  it("reviewing 到期答对 → 再 7 天", () => {
    const t1 = plus(T0, 24);
    const t2 = plus(t1, 72);
    const state = fold([ev(false, T0), ev(true, t1, "s-2"), ev(true, t2, "s-3")]);
    expect(state.status).toBe("reviewing");
    expect(state.streak).toBe(2);
    expect(state.nextReviewAt).toBe(plus(t2, 168));
  });

  it("连续 3 次独立答对 → mastered，不再排期", () => {
    const t1 = plus(T0, 24);
    const t2 = plus(t1, 72);
    const t3 = plus(t2, 168);
    const state = fold([
      ev(false, T0),
      ev(true, t1, "s-2"),
      ev(true, t2, "s-3"),
      ev(true, t3, "s-4"),
    ]);
    expect(state.status).toBe("mastered");
    expect(state.streak).toBe(3);
    expect(state.nextReviewAt).toBeNull();
  });

  it("mastered 再答错 → 回落 learning，重新 1 天", () => {
    const t1 = plus(T0, 24);
    const t2 = plus(t1, 72);
    const t3 = plus(t2, 168);
    const state = fold([
      ev(false, T0),
      ev(true, t1, "s-2"),
      ev(true, t2, "s-3"),
      ev(true, t3, "s-4"),
      ev(false, plus(t3, 200), "s-5"),
    ]);
    expect(state.status).toBe("learning");
    expect(state.streak).toBe(0);
    expect(state.nextReviewAt).toBe(plus(plus(t3, 200), 24));
  });

  it("mastered 再答对 → 保持 mastered（不重新排期）", () => {
    const t1 = plus(T0, 24);
    const t2 = plus(t1, 72);
    const t3 = plus(t2, 168);
    const state = fold([
      ev(false, T0),
      ev(true, t1, "s-2"),
      ev(true, t2, "s-3"),
      ev(true, t3, "s-4"),
      ev(true, plus(t3, 500), "s-9"),
    ]);
    expect(state.status).toBe("mastered");
    expect(state.nextReviewAt).toBeNull();
  });

  it("首次就答对不进复习流程（不制造待复习噪音）", () => {
    const state = fold([ev(true, T0)]);
    expect(state.status).toBe("new");
    expect(state.nextReviewAt).toBeNull();
  });

  it("主观题未自评（correct = null）不推进也不惩罚", () => {
    const before = fold([ev(false, T0)]);
    const after = reduceReview(before, ev(null, plus(T0, 24), "s-2"));
    expect(after).toEqual(before);
  });
});

describe("时间旅行（S4 §6-F-2 的精确断言）", () => {
  it("T 答错 → T+1 答对 → T+4 → T+11", () => {
    const t0 = "2026-11-16T09:00:00.000Z";
    const t1 = "2026-11-17T09:00:00.000Z";
    const t2 = "2026-11-20T09:00:00.000Z";
    const t3 = "2026-11-27T09:00:00.000Z";

    const s1 = reduceReview(INITIAL_REVIEW_STATE, ev(false, t0));
    expect(s1.nextReviewAt).toBe(t1);

    const s2 = reduceReview(s1, ev(true, t1, "s-2"));
    expect(s2.nextReviewAt).toBe(t2);

    const s3 = reduceReview(s2, ev(true, t2, "s-3"));
    expect(s3.nextReviewAt).toBe(t3);

    const s4 = reduceReview(s3, ev(true, t3, "s-4"));
    expect(s4.status).toBe("mastered");
  });

  it("跨零点不会提前到期：23:50 答错，次日 00:10 仍未到期", () => {
    const late = "2026-11-16T23:50:00.000Z";
    const state = fold([ev(false, late)]);
    expect(state.nextReviewAt).toBe("2026-11-17T23:50:00.000Z");
    expect(isDue(state, "2026-11-17T00:10:00.000Z")).toBe(false);
    expect(isDue(state, "2026-11-17T23:49:59.000Z")).toBe(false);
    expect(isDue(state, "2026-11-17T23:50:00.000Z")).toBe(true);
  });
});

describe("独立复习的判定（§8 风险：同会话连点）", () => {
  it("同一会话在到期时刻连点，只计第一次", () => {
    const t1 = plus(T0, 24);
    const s1 = fold([ev(false, T0)]);
    const s2 = reduceReview(s1, ev(true, t1, "s-2"));
    expect(s2.streak).toBe(1);

    const due = s2.nextReviewAt!;
    const s3 = reduceReview(s2, ev(true, due, "s-2")); // 同一会话
    expect(s3.streak).toBe(1);
    expect(s3.nextReviewAt).toBe(s2.nextReviewAt);
  });

  it("未到期就重做答对，不推进（但也不归零）", () => {
    const t1 = plus(T0, 24);
    const s1 = reduceReview(INITIAL_REVIEW_STATE, ev(false, T0));
    const s2 = reduceReview(s1, ev(true, t1, "s-2"));

    const early = reduceReview(s2, ev(true, plus(t1, 1), "s-3"));
    expect(early.streak).toBe(1);
    expect(early.nextReviewAt).toBe(s2.nextReviewAt);
  });

  it("learning 状态不受独立性限制：答错后重做答对立即进入复习计划", () => {
    const s1 = fold([ev(false, T0, "same")]);
    const s2 = reduceReview(s1, ev(true, plus(T0, 1), "same"));
    expect(s2.status).toBe("reviewing");
    expect(s2.streak).toBe(1);
  });

  it("isIndependentReview 只对 reviewing 生效", () => {
    const learning = fold([ev(false, T0)]);
    expect(isIndependentReview(learning, ev(true, plus(T0, 24), "s-2"))).toBe(false);
  });

  it("复习中答错 → 连续归零、回到待复习、次日重排（S4 场景 3）", () => {
    const t1 = plus(T0, 24);
    const t2 = plus(t1, 72);
    const s3 = fold([ev(false, T0), ev(true, t1, "s-2"), ev(true, t2, "s-3")]);
    expect(s3.streak).toBe(2);

    const t3 = s3.nextReviewAt!;
    const after = reduceReview(s3, ev(false, t3, "s-4"));
    expect(after.status).toBe("learning");
    expect(after.streak).toBe(0);
    expect(after.nextReviewAt).toBe(plus(t3, 24));
  });
});

describe("全量重放（G4-4 的等式）", () => {
  const attempt = (
    id: string,
    at: string,
    correct: boolean | null,
    sessionId: string,
  ): Attempt => ({
    attemptId: id,
    bankId: "javaweb",
    questionId: "javaweb:single_choice:001",
    questionRevision: "000000000001",
    mode: "review",
    isFirstAttempt: id === "a-1",
    startedAt: at,
    submittedAt: at,
    answer: "a",
    correct,
    score: correct === true ? 5 : 0,
    maxScore: 5,
    sessionId,
  });

  it("replay 与逐次 reduce 结果一致", () => {
    const t1 = plus(T0, 24);
    const t2 = plus(t1, 72);
    const attempts = [
      attempt("a-1", T0, false, "s-1"),
      attempt("a-2", t1, true, "s-2"),
      attempt("a-3", t2, true, "s-3"),
    ];
    const replayed = replayReview(attempts);
    const folded = attempts
      .map((a) => ev(a.correct, a.submittedAt, a.sessionId ?? null))
      .reduce<ReviewState>((state, e) => reduceReview(state, e), INITIAL_REVIEW_STATE);

    expect(replayed).toEqual(folded);
    expect(replayed.streak).toBe(2);
  });

  it("乱序输入按提交时间重排后再折叠", () => {
    const t1 = plus(T0, 24);
    const ordered = [attempt("a-1", T0, false, "s-1"), attempt("a-2", t1, true, "s-2")];
    const shuffled = [ordered[1]!, ordered[0]!];
    expect(replayReview(shuffled)).toEqual(replayReview(ordered));
  });

  it("空历史得到初始状态", () => {
    expect(replayReview([])).toEqual(INITIAL_REVIEW_STATE);
  });
});

describe("到期列表", () => {
  it("只含到期的 learning/reviewing，不含 mastered 与未到期", () => {
    const t1 = plus(T0, 24);
    const due = fold([ev(false, T0)]); // next = T+1
    const notYet = {
      ...fold([ev(false, T0)]),
      nextReviewAt: plus(T0, 100), // 还没到
    };
    const mastered = {
      ...fold([ev(false, T0)]),
      status: "mastered" as const,
      nextReviewAt: null,
    };

    const ids = dueQuestionIds(
      [
        { questionId: "q-due", state: due },
        { questionId: "q-later", state: notYet },
        { questionId: "q-mastered", state: mastered },
        { questionId: "q-new", state: INITIAL_REVIEW_STATE },
      ],
      t1,
    );
    expect(ids).toEqual(["q-due"]);
  });
});

describe("配置化（改规则不改数据）", () => {
  it("改间隔天数只影响之后的排期", () => {
    const short = { intervalsHours: [1, 2, 3] as const, masteryStreak: 2 };
    const s1 = reduceReview(INITIAL_REVIEW_STATE, ev(false, T0), short);
    expect(s1.nextReviewAt).toBe(plus(T0, 1));

    const s2 = reduceReview(s1, ev(true, plus(T0, 1), "s-2"), short);
    expect(s2.nextReviewAt).toBe(plus(plus(T0, 1), 2));

    const s3 = reduceReview(s2, ev(true, plus(plus(T0, 1), 2), "s-3"), short);
    expect(s3.status).toBe("mastered"); // masteryStreak = 2
  });

  it("默认配置就是 1/3/7 天、3 次独立答对", () => {
    expect(DEFAULT_REVIEW_CONFIG.intervalsHours).toEqual([24, 72, 168]);
    expect(DEFAULT_REVIEW_CONFIG.masteryStreak).toBe(3);
  });
});
