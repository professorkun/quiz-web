// @vitest-environment jsdom
/**
 * 应用级集成用例（S3 验收 A/B/F 的机器证据）。
 *
 * 这里跑的是**真组件 + 真存储实现**（内存键值，同一份仓储代码），
 * 只把 IndexedDB 换成内存——因为 jsdom 没有 IndexedDB，而换掉实现层
 * 就测不到"页面 → 仓储 → 键值"这条链。
 *
 * 覆盖：五入口可达、空状态有引导、游客闭环（作答→错题→收藏）、筛选与搜索、
 * 记录不串库。
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { chemistryBank } from "@quiz/content";
import type { BankContent } from "@quiz/core";
import type { Clock } from "@quiz/platform";
import { createPlatform, MemoryKeyValueStore } from "@quiz/platform-web";

import { App } from "./App";
import { ROUTE_LABEL, type Route } from "./router";

const clock: Clock = { now: () => new Date("2026-11-16T09:00:00.000Z") };

/** 第二个题库：只是换 bankId 的一份小库，用来验证"切库不串记录" */
function otherBank(): BankContent {
  const prefix = "other";
  return {
    manifest: {
      schemaVersion: 1,
      bankId: prefix,
      title: "对照题库",
      questionCount: 1,
      topics: [{ topicId: `${prefix}:topic:a`, bankId: prefix, name: "对照", order: 0 }],
      examTemplates: [],
      createdAt: "2026-11-16T00:00:00.000Z",
    },
    questions: [
      {
        schemaVersion: 1,
        bankId: prefix,
        questionId: `${prefix}:single_choice:001`,
        revision: "0000000000ff",
        topicIds: [`${prefix}:topic:a`],
        stem: "对照题库里的唯一一题",
        legacyKeys: [],
        type: "single_choice",
        options: [
          { optionId: "a", text: "甲" },
          { optionId: "b", text: "乙" },
        ],
        answer: "a",
      },
    ],
    knowledge: [],
  };
}

async function setup() {
  const kv = new MemoryKeyValueStore();
  const builtinBanks = [chemistryBank, otherBank()];
  const platform = createPlatform({ kv, builtinBanks, clock });
  // 固定"原序 + 每题一轮"，让用例能确定自己点的是哪一道题
  await platform.settings.savePractice("chem", {
    order: "sequential",
    topicIds: [],
    types: [],
    limit: 1,
    onlyUnseen: false,
    onlyUnmastered: false,
    mode: "practice",
  });
  const view = render(<App platform={platform} builtinBanks={builtinBanks} />);
  return { kv, platform, view };
}

async function go(route: Route): Promise<void> {
  const buttons = await screen.findAllByRole("button", { name: ROUTE_LABEL[route] });
  fireEvent.click(buttons[0]!);
  await waitFor(() => expect(globalThis.location.hash).toBe(`#/${route}`));
}

beforeEach(() => {
  globalThis.location.hash = "#/learn";
});

afterEach(() => {
  cleanup();
});

describe("五入口", () => {
  it("每个入口都能进入并有实质内容", async () => {
    await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });

    await go("banks");
    expect(await screen.findByRole("heading", { name: "题库", level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "知识讲义" })).toBeTruthy();

    await go("practice");
    expect(await screen.findByRole("heading", { name: /刷题/ })).toBeTruthy();

    await go("review");
    expect(await screen.findByRole("heading", { name: /复习/ })).toBeTruthy();

    await go("me");
    expect(await screen.findByRole("heading", { name: "我的", level: 1 })).toBeTruthy();
    expect(screen.getByText("数据导入导出")).toBeTruthy();
  });

  it("新用户看到的是引导而不是白屏", async () => {
    await setup();
    expect(await screen.findByText(/还没有任何记录/)).toBeTruthy();

    await go("review");
    // S4 起默认视图是「到期复习」
    expect(await screen.findByText(/现在没有到期的题/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /错题（0）/ }));
    expect(await screen.findByText(/还没有错题/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /收藏（0）/ }));
    expect(await screen.findByText(/还没有收藏/)).toBeTruthy();
  });
});

describe("游客闭环", () => {
  it("答错一题后进入错题列表，收藏独立保留", async () => {
    const { platform } = await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });

    await go("practice");
    fireEvent.click(await screen.findByRole("button", { name: "开始练习" }));

    // 第一题（chem:single_choice:001，正确答案是"冰水混合物"）故意选错
    await screen.findByText(/下列物质中属于纯净物的是/);
    fireEvent.click(screen.getByText("空气"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));

    expect(await screen.findByText(/答错了/)).toBeTruthy();

    // 作答事件已落库，且只追加一条
    await waitFor(async () => {
      const history = await platform.attempts.listByQuestion("chem", "chem:single_choice:001");
      expect(history).toHaveLength(1);
      expect(history[0]?.correct).toBe(false);
      expect(history[0]?.isFirstAttempt).toBe(true);
      expect(history[0]?.mode).toBe("practice");
    });

    // 收藏当前题
    fireEvent.click(screen.getByRole("button", { name: "☆ 收藏" }));
    expect(await screen.findByRole("button", { name: "★ 已收藏" })).toBeTruthy();

    await go("review");
    expect(await screen.findByRole("tab", { name: /错题（1）/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /错题（1）/ }));
    expect(await screen.findByText(/错 1 次/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /收藏（1）/ }));
    expect(await screen.findByText(/收藏于/)).toBeTruthy();
  });

  it("提交后重算进度，错题数可被学习页读到", async () => {
    const { platform } = await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("practice");
    fireEvent.click(await screen.findByRole("button", { name: "开始练习" }));
    await screen.findByText(/下列物质中属于纯净物的是/);
    fireEvent.click(screen.getByText("空气"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));

    await waitFor(async () => {
      const progress = await platform.progress.listByBank("chem");
      expect(progress).toHaveLength(1);
      expect(progress[0]?.wrongCount).toBe(1);
    });

    await go("learn");
    // 学习页的错题 KPI 应为 1（不是靠内存状态，而是重新从存储取数）
    const kpi = await screen.findByText("错题", { selector: ".kpi-label" });
    expect(within(kpi.parentElement as HTMLElement).getByText("1")).toBeTruthy();
  });
});

describe("题库页", () => {
  it("按状态筛掉未做题，搜索无结果时给提示", async () => {
    await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("banks");

    expect(await screen.findByText(/命中 14 题/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "答对过" }));
    expect(await screen.findByText(/命中 0 题/)).toBeTruthy();
    expect(await screen.findByText(/没有符合条件的题目/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "清空筛选" }));
    const input = screen.getByLabelText("搜索题干");
    fireEvent.change(input, { target: { value: "不存在的关键词" } });
    expect(await screen.findByText(/命中 0 题/)).toBeTruthy();

    fireEvent.change(input, { target: { value: "纯净物" } });
    expect(await screen.findByText(/命中 1 题/)).toBeTruthy();
  });

  it("切换题库后当前库有明确标识", async () => {
    await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("banks");

    const sw = await screen.findByRole("button", { name: /对照题库（1）/ });
    fireEvent.click(sw);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /对照题库（1）/ }).className).toContain("on"),
    );
    expect(await screen.findByText(/命中 1 题/)).toBeTruthy();
  });
});

describe("跨库隔离", () => {
  it("在化学库答错不会污染对照题库的错题数", async () => {
    const { platform } = await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("practice");
    fireEvent.click(await screen.findByRole("button", { name: "开始练习" }));
    await screen.findByText(/下列物质中属于纯净物的是/);
    fireEvent.click(screen.getByText("空气"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));

    await waitFor(async () => {
      expect(await platform.progress.listByBank("chem")).toHaveLength(1);
    });
    expect(await platform.progress.listByBank("other")).toHaveLength(0);

    await go("banks");
    fireEvent.click(await screen.findByRole("button", { name: /对照题库（1）/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /对照题库（1）/ }).className).toContain("on"),
    );
    await go("review");
    fireEvent.click(await screen.findByRole("tab", { name: /错题（0）/ }));
    expect(await screen.findByText(/还没有错题/)).toBeTruthy();
  });
});

/**
 * S3 验收补测（对比 04-S3 §6 后发现的三处"有实现、无用例"）。
 *
 * 这三条不是锦上添花：
 * - 设置恢复与刷新恢复是"关掉浏览器再回来还在"的核心承诺；
 * - 存储不可用的提示如果不显示，隐私模式用户会以为记录存住了；
 * - 讲义随库切换是"通用"的最后一环（换学科得换讲义）。
 */
describe("S3 验收补测", () => {
  it("练习设置改完再进来仍在（按题库保存）", async () => {
    const { platform } = await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("practice");

    const twenty = await screen.findByRole("button", { name: "20 题" });
    fireEvent.click(twenty);
    await waitFor(() => expect(twenty.className).toContain("on"));

    cleanup();
    globalThis.location.hash = "#/learn";
    render(<App platform={platform} builtinBanks={[chemistryBank, otherBank()]} />);
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("practice");

    const again = await screen.findByRole("button", { name: "20 题" });
    await waitFor(() => expect(again.className).toContain("on"));
  });

  it("刷新（重新挂载）后回到同一题、同一进度", async () => {
    const { platform } = await setup();
    await platform.settings.savePractice("chem", {
      order: "sequential",
      topicIds: [],
      types: [],
      limit: 3,
      onlyUnseen: false,
      onlyUnmastered: false,
      mode: "practice",
    });

    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("practice");
    fireEvent.click(await screen.findByRole("button", { name: "开始练习" }));
    await screen.findByText(/下列物质中属于纯净物的是/);

    fireEvent.click(screen.getByText("空气"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findByText(/答错了/);
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    await screen.findByText(/第 2 \/ 3 题/);

    // 模拟"关掉浏览器再打开"：同一份存储、全新的组件树
    cleanup();
    globalThis.location.hash = "#/learn";
    render(<App platform={platform} builtinBanks={[chemistryBank, otherBank()]} />);
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("practice");

    expect(await screen.findByText(/第 2 \/ 3 题/)).toBeTruthy();
    // 恢复的是同一轮会话：题量仍是 3，且已作答的那条事件没有丢
    const history = await platform.attempts.listByQuestion("chem", "chem:single_choice:001");
    expect(history).toHaveLength(1);
    expect(screen.getByText(/第 2 \/ 3 题/)).toBeTruthy();
  });

  it("存储不可用时给出横幅与可读原因，而不是静默假装保存", async () => {
    const kv = new MemoryKeyValueStore();
    // 只让"探针写入"失败：模拟配额满/隐私模式下写入被拒
    const flaky: typeof kv = Object.create(kv) as typeof kv;
    const originalSet = kv.set.bind(kv);
    let probeCalls = 0;
    flaky.set = async (key: string, value: string) => {
      if (key.startsWith("__probe__")) {
        probeCalls += 1;
        throw new Error("QuotaExceededError");
      }
      return originalSet(key, value);
    };
    const platform = createPlatform({ kv: flaky, builtinBanks: [chemistryBank], clock });

    render(
      <App
        platform={platform}
        builtinBanks={[chemistryBank]}
        storageWarning="本地存储不可写（隐私模式），本次记录只保存在内存中"
      />,
    );

    const banners = await screen.findAllByText(/本地存储不可写/);
    expect(banners.length).toBeGreaterThan(0);
    await go("me");
    const notWritable = await screen.findAllByText(/不可写/);
    expect(notWritable.length).toBeGreaterThan(0);
    expect(probeCalls).toBeGreaterThan(0);
  });

  it("换题库时知识讲义跟着换，不残留上一个库的内容", async () => {
    await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("banks");

    expect(await screen.findByText("物质的分类")).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: /对照题库（1）/ }));
    expect(await screen.findByText(/这份题库还没配知识讲义/)).toBeTruthy();
    expect(screen.queryByText("物质的分类")).toBeNull();
  });

  it("题型 + 知识点 + 搜索可组合，结果与数据一致", async () => {
    await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("banks");

    // 填空题共 4 道
    fireEvent.click(await screen.findByRole("button", { name: /填空题（4）/ }));
    expect(await screen.findByText(/命中 4 题/)).toBeTruthy();

    // 再收窄到"物质的组成与分类"：水的化学式 + 空气成分（2 道）
    fireEvent.click(screen.getByRole("button", { name: "物质的组成与分类" }));
    expect(await screen.findByText(/命中 2 题/)).toBeTruthy();

    // 再叠加题干搜索：只剩"水的化学式"
    fireEvent.change(screen.getByLabelText("搜索题干"), { target: { value: "化学式" } });
    expect(await screen.findByText(/命中 1 题/)).toBeTruthy();
  });
});

/** S4 · T4-4/4-6/4-8 的界面证据 */
describe("S4 复习与对账", () => {
  it("复习页四个视图都可达且空状态有引导", async () => {
    await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("review");

    for (const label of ["到期复习（0）", "错题（0）", "收藏（0）", "已掌握（0）"]) {
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    }
    expect(await screen.findByText(/现在没有到期的题/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "已掌握（0）" }));
    expect(await screen.findByText(/还没有已掌握的题/)).toBeTruthy();
  });

  it("错因可标记，重新打开仍保留", async () => {
    const { platform } = await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("practice");
    fireEvent.click(await screen.findByRole("button", { name: "开始练习" }));
    await screen.findByText(/下列物质中属于纯净物的是/);
    fireEvent.click(screen.getByText("空气"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findByText(/答错了/);

    await go("review");
    fireEvent.click(await screen.findByRole("tab", { name: /错题（1）/ }));
    const select = await screen.findByLabelText("错因");
    fireEvent.change(select, { target: { value: "knowledge_gap" } });
    await waitFor(async () => {
      const rows = await platform.progress.listByBank("chem");
      expect(rows[0]?.errorCause).toBe("knowledge_gap");
    });

    cleanup();
    globalThis.location.hash = "#/learn";
    render(<App platform={platform} builtinBanks={[chemistryBank, otherBank()]} />);
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("review");
    fireEvent.click(await screen.findByRole("tab", { name: /错题（1）/ }));
    const reopened = (await screen.findByLabelText("错因")) as HTMLSelectElement;
    expect(reopened.value).toBe("knowledge_gap");
  });

  it("可以由事件重算并对账，页面给出差异数字", async () => {
    const { platform } = await setup();
    await screen.findByRole("heading", { name: "高中化学基础", level: 1 });
    await go("practice");
    fireEvent.click(await screen.findByRole("button", { name: "开始练习" }));
    await screen.findByText(/下列物质中属于纯净物的是/);
    fireEvent.click(screen.getByText("空气"));
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));
    await screen.findByText(/答错了/);

    await go("me");
    fireEvent.click(await screen.findByRole("button", { name: /由事件重算并对账/ }));
    expect(await screen.findByText(/重算后 1 条全部一致/)).toBeTruthy();
    expect((await platform.progress.listByBank("chem"))[0]?.status).toBe("learning");
  });
});
