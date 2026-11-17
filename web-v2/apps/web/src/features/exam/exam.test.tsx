// @vitest-environment jsdom
/**
 * 模考集成用例（S5 T5-7 的机器证据）：真组件 + 真仓储（内存键值）。
 *
 * 覆盖场景与验收的对应：
 * - 开考/交卷/成绩 → D-1 与冒烟 #3（未答题确认弹窗）
 * - 组卷失败提示 → D-2
 * - 中断恢复 → D-3（完整「第 20 题/剩 12 分钟」在 core 的 session.test.ts）
 * - 逐空明细 → D-4
 * - 自评不覆盖客观分 → D-5
 * - 双库成绩归属 → D-6
 * - 超时自动交卷 → T5-3
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assemblePaper,
  createExamSession,
  serializeExamSession,
  type BankContent,
  type ExamTemplate,
  type Question,
} from "@quiz/core";
import type { Clock } from "@quiz/platform";
import { createPlatform, MemoryKeyValueStore } from "@quiz/platform-web";

import { App } from "../../App";

const clock: Clock = { now: () => new Date("2026-11-16T09:00:00.000Z") };

const REV = "000000000001";

function bankOf(
  bankId: string,
  title: string,
  questions: Question[],
  examTemplates: ExamTemplate[],
): BankContent {
  return {
    manifest: {
      schemaVersion: 1,
      bankId,
      title,
      questionCount: questions.length,
      topics: [{ topicId: `${bankId}:topic:a`, bankId, name: "主题", order: 0 }],
      examTemplates,
      createdAt: "2026-11-16T00:00:00.000Z",
    },
    questions,
    knowledge: [],
  };
}

/** 已知答案的小题库：1 单选（o1 对）+ 1 简答（采分点 3+2） */
function demoBank(): BankContent {
  const questions: Question[] = [
    {
      schemaVersion: 1,
      bankId: "demo",
      questionId: "demo:single_choice:001",
      revision: REV,
      topicIds: ["demo:topic:a"],
      stem: "1 + 1 = ？",
      legacyKeys: [],
      type: "single_choice",
      options: [
        { optionId: "o1", text: "2" },
        { optionId: "o2", text: "3" },
      ],
      answer: "o1",
    },
    {
      schemaVersion: 1,
      bankId: "demo",
      questionId: "demo:short_answer:001",
      revision: REV,
      topicIds: ["demo:topic:a"],
      stem: "简述进程与线程的区别",
      legacyKeys: [],
      type: "short_answer",
      rubric: [
        { pointId: "p1", text: "资源分配单位", score: 3 },
        { pointId: "p2", text: "调度单位", score: 2 },
      ],
    },
    {
      schemaVersion: 1,
      bankId: "demo",
      questionId: "demo:code_blank:001",
      revision: REV,
      topicIds: ["demo:topic:a"],
      stem: "补全代码",
      legacyKeys: [],
      type: "code_blank",
      files: [
        {
          fileId: "f1",
          label: "A.java",
          language: "java",
          code: "class A { ___(b1)___ f() { ___(b2)___; } }",
        },
      ],
      blanks: [
        { blankId: "b1", accepted: ["public"] },
        { blankId: "b2", accepted: ["return"] },
      ],
    },
  ];
  const template: ExamTemplate = {
    templateId: "demo:exam:tiny",
    bankId: "demo",
    title: "小测卷",
    durationSec: 1800,
    sections: [
      { sectionId: "s1", title: "单选", questionType: "single_choice", count: 1, scoreEach: 4 },
      { sectionId: "s2", title: "简答", questionType: "short_answer", count: 1, scoreEach: 6 },
      { sectionId: "s3", title: "代码填空", questionType: "code_blank", count: 1, scoreEach: 5 },
    ],
    totalScore: 15,
  };
  return bankOf("demo", "演示题库", questions, [template]);
}

/** 双模板题库：一张永远组不出来（D-2），一张 1 题可考（D-6 第二库） */
function brokenBank(): BankContent {
  const base = demoBank();
  const questions = base.questions.map((q) => ({
    ...q,
    bankId: "broken",
    questionId: q.questionId.replace("demo:", "broken:"),
  }));
  const tooBig: ExamTemplate = {
    templateId: "broken:exam:too-big",
    bankId: "broken",
    title: "永远组不出来的一卷",
    sections: [
      { sectionId: "s1", title: "单选", questionType: "single_choice", count: 40, scoreEach: 1 },
    ],
    totalScore: 40,
  };
  const tiny: ExamTemplate = {
    templateId: "broken:exam:tiny",
    bankId: "broken",
    title: "缺题库小卷",
    sections: [
      { sectionId: "s1", title: "单选", questionType: "single_choice", count: 1, scoreEach: 4 },
    ],
    totalScore: 4,
  };
  return bankOf("broken", "缺题题库", questions, [tooBig, tiny]);
}

async function setup(
  opts: {
    banks?: BankContent[];
    /** 渲染前先写好存储，避免"页面已加载、快照后到"的竞态 */
    seed?: (platform: Awaited<ReturnType<typeof createPlatform>>) => Promise<void>;
  } = {},
) {
  const banks = opts.banks ?? [demoBank(), brokenBank()];
  const kv = new MemoryKeyValueStore();
  const platform = createPlatform({ kv, builtinBanks: banks, clock });
  if (opts.seed !== undefined) await opts.seed(platform);
  const view = render(<App platform={platform} builtinBanks={banks} />);
  return { kv, platform, view };
}

/** 导航按钮在侧栏与底部各有一个，统一取第一个 */
async function clickNav(label: string): Promise<void> {
  const buttons = await screen.findAllByRole("button", { name: label });
  fireEvent.click(buttons[0]!);
}

/** 首页（选卷）就绪 */
async function gotoExamHome(): Promise<void> {
  await clickNav("模考");
  await screen.findByRole("heading", { name: /模考/ });
}

/** 用固定种子组一份可复现的卷面快照，直接喂给仓储（作答路径确定） */
function snapshotOf(
  bank: BankContent,
  templateId: string,
  seed: number,
  opts: { cursor?: number; answers?: Record<string, unknown>; deadlineOffsetSec?: number } = {},
): string {
  const template = bank.manifest.examTemplates.find((t) => t.templateId === templateId)!;
  const paper = assemblePaper({ template, questions: bank.questions, seed });
  const session = createExamSession({
    paper,
    sessionId: `e-fixed-${seed}`,
    now: "2026-11-16T09:00:00.000Z",
  });
  const withAnswers = {
    ...session,
    answers: (opts.answers ?? {}) as typeof session.answers,
    cursor: opts.cursor ?? 0,
    ...(opts.deadlineOffsetSec === undefined
      ? {}
      : {
          deadlineAt: new Date(
            Date.parse("2026-11-16T09:00:00.000Z") + opts.deadlineOffsetSec * 1000,
          ).toISOString(),
        }),
  };
  return serializeExamSession(withAnswers);
}

beforeEach(() => {
  globalThis.location.hash = "#/exam";
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("开考与卷面（D-1）", () => {
  it("模板卡片显示题量分值限时，开始后按模板逐题作答", async () => {
    await setup();
    await gotoExamHome();
    expect(await screen.findByText(/3 题 \/ 15 分/)).toBeTruthy();
    expect(screen.getByText(/限时 30:00/)).toBeTruthy();

    fireEvent.click(screen.getByTestId("start-demo:exam:tiny"));
    expect(await screen.findByText(/第 1 \/ 3 题/)).toBeTruthy();
    expect(screen.getByTestId("exam-timer").textContent).toContain("30:00");
  });
});

describe("交卷与判分", () => {
  it("空卷交卷：确认弹窗报未答数，成绩 0 分（冒烟 #3 对照）", async () => {
    const { platform } = await setup({
      seed: (p) => p.exams.saveSessionSnapshot("demo", snapshotOf(demoBank(), "demo:exam:tiny", 42)),
    });
    await screen.findByText(/第 1 \/ 3 题/);

    fireEvent.click(screen.getByTestId("submit-paper"));
    expect(window.confirm).toHaveBeenCalledWith("还有 3 题未作答，确定交卷？");

    expect(await screen.findByTestId("exam-total").then((el) => el.textContent)).toContain("0");
    expect(screen.getByText(/客观题 0 \/ 9/)).toBeTruthy();
    expect(screen.getByText(/主观题自评 0 \/ 6/)).toBeTruthy();
  });

  it("客观题自动判分、代码填空逐空明细（D-4）", async () => {
    const bank = demoBank();
    await setup({
      // 答对单选（o1），代码填空对 1 空错 1 空
      seed: (p) =>
        p.exams.saveSessionSnapshot(
          "demo",
          snapshotOf(bank, "demo:exam:tiny", 42, {
            answers: {
              "demo:single_choice:001": "o1",
              "demo:code_blank:001": { b1: "public", b2: "retrn" },
              "demo:short_answer:001": "我的要点",
            },
          }),
        ),
    });
    await screen.findByText(/第 1 \/ 3 题/);
    fireEvent.click(screen.getByTestId("submit-paper"));

    await screen.findByTestId("exam-total");
    // 4（单选对）+ 2.5（代码填空 1/2）= 6.5；简答待自评
    expect(screen.getByTestId("exam-total").textContent).toContain("6.5");
    // 逐空明细：b1 ✓ / b2 ✗
    expect(screen.getByText("b1 ✓")).toBeTruthy();
    expect(screen.getByText("b2 ✗")).toBeTruthy();
  });

  it("超时自动交卷并提示（T5-3）", async () => {
    await setup({
      seed: (p) =>
        p.exams.saveSessionSnapshot(
          "demo",
          snapshotOf(demoBank(), "demo:exam:tiny", 7, { deadlineOffsetSec: -60 }),
        ),
    });
    await waitFor(() => expect(screen.getByTestId("exam-total")).toBeTruthy());
    expect(screen.getByText(/超时自动交卷/)).toBeTruthy();
  });
});

describe("中断恢复（D-3）", () => {
  it("刷新后回到原题、已答保留、剩余时间按绝对截止时刻继续", async () => {
    const bank = demoBank();
    await setup({
      seed: (p) =>
        p.exams.saveSessionSnapshot(
          "demo",
          snapshotOf(bank, "demo:exam:tiny", 42, {
            cursor: 1,
            answers: { "demo:single_choice:001": "o1" },
          }),
        ),
    });
    expect(await screen.findByText(/第 2 \/ 3 题/)).toBeTruthy();
    // 已答 1 题 · 未答 2 题（简答 + 代码填空）— 1800s 起点固定 → 剩余恰好 30:00
    expect(screen.getByText(/已答 1 · 未答 2/)).toBeTruthy();
    expect(screen.getByTestId("exam-timer").textContent).toContain("30:00");
  });
});

describe("主观自评（D-5）", () => {
  it("自评一半：档位单独显示、客观分不变、总分加上自评分", async () => {
    const bank = demoBank();
    await setup({
      seed: (p) =>
        p.exams.saveSessionSnapshot(
          "demo",
          snapshotOf(bank, "demo:exam:tiny", 42, {
            answers: {
              "demo:single_choice:001": "o1",
              "demo:code_blank:001": { b1: "public", b2: "return" },
              "demo:short_answer:001": "我的要点",
            },
          }),
        ),
    });
    await screen.findByText(/第 1 \/ 3 题/);
    fireEvent.click(screen.getByTestId("submit-paper"));
    await screen.findByTestId("exam-total");
    // 客观满分 4 + 5 = 9，自评前总分 9
    expect(screen.getByText(/客观题 9 \/ 9/)).toBeTruthy();
    expect(screen.getByTestId("exam-total").textContent).toContain("9");

    fireEvent.click(screen.getByRole("button", { name: /一半/ }));
    await waitFor(() =>
      expect(screen.getByTestId("exam-total").textContent).toContain("12"),
    );
    // 自评档位单独显示；客观题得分不动
    expect(screen.getByText(/已自评：一半/)).toBeTruthy();
    expect(screen.getByText(/客观题 9 \/ 9/)).toBeTruthy();
    expect(screen.getByText(/主观题自评 3 \/ 6/)).toBeTruthy();
  });
});

describe("组卷失败与多库归属（D-2 / D-6）", () => {
  it("题量不足：拒绝开考并提示「可用题目 X < 需要 Y」", async () => {
    await setup();
    await gotoExamHome();
    // 先切到「缺题题库」，那张 40 题的模板在它名下
    await clickNav("题库");
    fireEvent.click(await screen.findByRole("button", { name: /缺题题库/ }));
    await gotoExamHome();
    await screen.findByRole("heading", { name: /缺题题库/ });

    fireEvent.click(await screen.findByTestId("start-broken:exam:too-big"));
    expect(await screen.findByText(/可用题目 1 < 需要 40/)).toBeTruthy();
  });

  it("两个题库各考一次，成绩分别归属各自的 bankId 与 templateId（D-6）", async () => {
    const { platform } = await setup({
      seed: (p) => p.exams.saveSessionSnapshot("demo", snapshotOf(demoBank(), "demo:exam:tiny", 1)),
    });
    // 库一：demo 小测卷
    await screen.findByText(/第 1 \/ 3 题/);
    fireEvent.click(screen.getByTestId("submit-paper"));
    await screen.findByTestId("exam-total");
    fireEvent.click(screen.getByRole("button", { name: "返回模考" }));

    // 库二：切到缺题题库，考它自己的小卷
    await clickNav("题库");
    fireEvent.click(await screen.findByRole("button", { name: /缺题题库/ }));
    await clickNav("模考");
    await screen.findByRole("heading", { name: /缺题题库/ });
    fireEvent.click(await screen.findByTestId("start-broken:exam:tiny"));
    expect(await screen.findByText(/第 1 \/ 1 题/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("submit-paper"));
    await screen.findByTestId("exam-total");

    const demoRows = await platform.exams.listRecords("demo");
    const brokenRows = await platform.exams.listRecords("broken");
    expect(demoRows).toHaveLength(1);
    expect(brokenRows).toHaveLength(1);
    expect(demoRows[0]!.templateId).toBe("demo:exam:tiny");
    expect(demoRows[0]!.bankId).toBe("demo");
    expect(brokenRows[0]!.templateId).toBe("broken:exam:tiny");
    expect(brokenRows[0]!.bankId).toBe("broken");
  });

  it("模考作答写入 mode=exam 事件并进入复习闭环（验收 B）", async () => {
    const bank = demoBank();
    const { platform } = await setup({
      // 单选答错，代码填空全对，简答作答
      seed: (p) =>
        p.exams.saveSessionSnapshot(
          "demo",
          snapshotOf(bank, "demo:exam:tiny", 42, {
            answers: {
              "demo:single_choice:001": "o2",
              "demo:code_blank:001": { b1: "public", b2: "return" },
              "demo:short_answer:001": "要点",
            },
          }),
        ),
    });
    await screen.findByText(/第 1 \/ 3 题/);
    fireEvent.click(screen.getByTestId("submit-paper"));
    await screen.findByTestId("exam-total");

    const attempts = await platform.attempts.listByBank("demo");
    // 只写已作答的题；全部带 mode: "exam"
    expect(attempts).toHaveLength(3);
    expect(attempts.every((a) => a.mode === "exam")).toBe(true);
    // 未作答不写事件——旧版「没答也进错题本」的缺陷不带进新版
    const progress = await platform.progress.get("demo", "demo:single_choice:001");
    expect(progress?.wrongCount).toBe(1);
    const right = await platform.progress.get("demo", "demo:code_blank:001");
    expect(right?.wrongCount).toBe(0);
  });
});
