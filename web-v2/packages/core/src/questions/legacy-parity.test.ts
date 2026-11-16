/**
 * T2-9：旧版纯逻辑迁移的行为对照（旧版函数原样复刻在测试里）。
 *
 * 为什么把旧代码抄进测试：协议明确禁止"让 AI 猜旧版行为"。
 * 只有把 `norm()` / `blankOk()` / `shuffle()` / `withOpts()` / 自评三档
 * 逐字复刻成可执行函数，差异才不是一句"应该一样"。
 *
 * 三条结论：
 * - **一致**：大小写、空白、引号、中文标点、自闭合标签、三档自评分值、洗牌算法形状；
 * - **有意差异**：全角字母（新版转半角）、包含式匹配（新版取消）、
 *   多尾句号（新版全部去掉）、选项身份（新版只用 optionId）；
 * - **回归 0**：真实题库 143 个空位原样输入，新旧判定全部为对。
 */

import { describe, expect, it } from "vitest";

import { gradeAnswer } from "./registry.js";
import "./index.js";
import { MISJUDGMENT_BLACKLIST } from "./misjudgment-blacklist.js";
import { matchesAccepted, normalizeAnswer } from "./normalize.js";
import { buildCodeStructure, type CodeBlankQuestion } from "./code_blank/structure.js";
import { makeSelfRating } from "./short_answer/selfRating.js";
import { createSession } from "../practice/engine.js";
import { makeQuestion } from "../practice/fixtures.js";
import { rngFrom, shuffleWith } from "../practice/random.js";

/* ---------------- 旧版实现，逐字复刻，仅用于对照 ---------------- */

/** `_build/template.html:421` */
function legacyNorm(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .replace(/[`"'“”‘’]/g, "")
    .replace(/；/g, ";")
    .replace(/，/g, ",")
    .replace(/、/g, ",")
    .replace(/\/>/g, ">")
    .replace(/[。.]$/g, "");
}

/** `_build/template.html:429` */
function legacyBlankOk(user: string, ans: string): boolean {
  const nu = legacyNorm(user);
  if (!nu) return false;
  const nb = legacyNorm(ans);
  return nb === nu || (nb.indexOf(nu) >= 0 && nu.length >= 2);
}

/** `_build/template.html:408`，随机源改为注入以便对照 */
function legacyShuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** `_build/template.html:410`：选项重编号成 A/B/C/D，答案改写成展示字母 */
function legacyWithOpts(
  q: { options: { key: string; text: string }[]; answer: string },
  random: () => number,
): { options: { key: string; text: string; origin: string }[]; answer: string } {
  const KEYS = ["A", "B", "C", "D", "E", "F"];
  const arr = legacyShuffle(q.options, random);
  const pos = arr.findIndex((o) => o.key === q.answer);
  return {
    options: arr.map((o, i) => ({ key: KEYS[i] ?? "", text: o.text, origin: o.key })),
    answer: pos >= 0 ? (KEYS[pos] ?? q.answer) : q.answer,
  };
}

/** `_build/template.html:873` selfEval：data-v 为 1 / 0.5 / 0 */
function legacySelfScore(v: number, score: number): number {
  return v * score;
}

/* ---------------- 对照 ---------------- */

describe("旧版 norm() 与新版归一化", () => {
  const SAME = [
    "Servlet",
    " servlet ",
    "SERVLET",
    '"Servlet"',
    "Servlet。",
    "Servlet.",
    "<jsp:include page=\"\" />",
    "<jsp:include page=\"\">",
    "<a/>",
    "<a>",
    "a；b，c、d",
  ];

  it("规则内样例：新旧归一化结果逐条相同（11 条）", () => {
    for (const sample of SAME) {
      expect(normalizeAnswer(sample), sample).toBe(legacyNorm(sample));
    }
  });

  it("有意差异 1：全角字母，旧版不认、新版转半角", () => {
    expect(legacyNorm("Ｓｅｒｖｌｅｔ")).not.toBe(legacyNorm("Servlet"));
    expect(normalizeAnswer("Ｓｅｒｖｌｅｔ")).toBe(normalizeAnswer("Servlet"));
  });

  it("有意差异 2：多个尾部句号，旧版只去一个、新版全去", () => {
    expect(legacyNorm("Servlet..")).toBe("servlet.");
    expect(normalizeAnswer("Servlet..")).toBe("servlet");
  });
});

describe("旧版 blankOk() 与新版 matchesAccepted", () => {
  it("完全相等与大小写差异：新旧都判对", () => {
    for (const [given, ans] of [
      ["Servlet", "Servlet"],
      [" servlet ", "Servlet"],
      ["POOLED", "POOLED"],
      ["<jsp:include page=\"\">", "<jsp:include page=\"\" />"],
    ] as const) {
      expect(legacyBlankOk(given, ans), `${given} vs ${ans}`).toBe(true);
      expect(matchesAccepted(given, [ans]), `${given} vs ${ans}`).toBe(true);
    }
  });

  it("空输入：新旧都判错", () => {
    expect(legacyBlankOk("", "Servlet")).toBe(false);
    expect(matchesAccepted("", ["Servlet"])).toBe(false);
  });

  it("有意差异：包含式匹配被取消，黑名单 9 条全部不再误判", () => {
    for (const c of MISJUDGMENT_BLACKLIST) {
      const ans = c.accepted[0] ?? "";
      if (c.kind === "错判为对") {
        expect(legacyBlankOk(c.given, ans), c.id).toBe(true);
        expect(matchesAccepted(c.given, c.accepted), c.id).toBe(false);
      } else {
        expect(legacyBlankOk(c.given, ans), c.id).toBe(false);
        expect(matchesAccepted(c.given, c.accepted), c.id).toBe(true);
      }
    }
  });
});

describe("旧版 shuffle / withOpts 与新版可复现洗牌", () => {
  const items = ["o1", "o2", "o3", "o4", "o5", "o6"];

  it("算法同形：同一条随机序列下，旧 shuffle 与新 shuffleWith 结果逐项相同", () => {
    for (const seed of [1, 7, 20261116]) {
      expect(legacyShuffle(items, rngFrom(seed))).toEqual(shuffleWith(items, rngFrom(seed)));
    }
  });

  it("有意差异：旧版把答案改写成展示字母，新版答案始终是 optionId", () => {
    const legacy = legacyWithOpts(
      {
        options: [
          { key: "o1", text: "甲" },
          { key: "o2", text: "乙" },
          { key: "o3", text: "丙" },
        ],
        answer: "o2",
      },
      rngFrom(7),
    );
    expect(legacy.answer).toMatch(/^[A-F]$/); // 旧版：B 或 A/C
    expect(legacy.options.map((o) => o.origin)).toEqual(
      shuffleWith(["o1", "o2", "o3"], rngFrom(7)),
    );

    const question = makeQuestion({
      type: "single_choice",
      questionId: "javaweb:single_choice:001",
      stem: "x",
      options: [
        { optionId: "o1", text: "甲" },
        { optionId: "o2", text: "乙" },
        { optionId: "o3", text: "丙" },
      ],
      answer: "o2",
    });
    const session = createSession({
      questions: [question],
      config: { bankId: "javaweb", order: "sequential", seed: 7 },
      sessionId: "s",
      now: "2026-11-16T00:00:00.000Z",
    });
    // 新版：展示顺序是 optionId 数组，answer 不变，判分只认 optionId
    expect(session.optionOrders[question.questionId]?.slice().sort()).toEqual(["o1", "o2", "o3"]);
    expect(question.answer).toBe("o2");
    expect(gradeAnswer(question, "o2").correct).toBe(true);
    expect(gradeAnswer(question, legacy.answer).correct).toBe(false); // 展示字母不能当答案用
  });
});

describe("旧版自评三档与新版 selfRating", () => {
  it("分值一致：v=1 / 0.5 / 0 与 full / half / none 逐档相同", () => {
    const pairs: readonly [("full" | "half" | "none"), number][] = [
      ["full", 1],
      ["half", 0.5],
      ["none", 0],
    ];
    for (const [level, v] of pairs) {
      expect(makeSelfRating(level, 5).score).toBe(legacySelfScore(v, 5));
    }
  });
});

describe("旧版 hlCode 空位编号与新版结构解析", () => {
  it("空位出现顺序与编号逐项一致，重复出现也保留", () => {
    const code = "class ___(1-2)___ { ___(1-1)___ x; ___(1-1)___ y; }";
    const legacyIds = [...code.matchAll(/___\((\d+-\d+)\)___/g)].map((m) => m[1]);
    const question = makeQuestion({
      type: "code_blank",
      questionId: "javaweb:code_blank:001",
      stem: "x",
      files: [{ fileId: "f1", label: "A.java", language: "java", code }],
      blanks: [
        { blankId: "1-1", fileId: "f1", accepted: ["int"] },
        { blankId: "1-2", fileId: "f1", accepted: ["User"] },
      ],
    }) as CodeBlankQuestion;
    const structure = buildCodeStructure(question);
    const ids = structure.files.flatMap((f) =>
      f.segments.filter((s) => s.kind === "blank").map((s) => s.blankId),
    );
    expect(ids).toEqual(legacyIds);
    expect(ids).toEqual(["1-2", "1-1", "1-1"]);
  });
});

describe("真实题库样例（与 scripts/verify-legacy-parity.mjs 同口径）", () => {
  it("27 道填空题的关键样例：标准答案原样输入，新旧都判对", () => {
    // 从题库包抽样的 6 个真实答案，覆盖标签、方法名、全大写、含空格
    const samples: readonly [string, string][] = [
      ["Servlet", "Servlet"],
      ["POOLED", "POOLED"],
      ["<jsp:include page=\"\" />", "<jsp:include page=\"\" />"],
      ["Class.forName()", "Class.forName()"],
      ["@WebServlet", "@WebServlet"],
      ["<bean>", "<bean>"],
    ];
    for (const [given, ans] of samples) {
      expect(legacyBlankOk(given, ans), given).toBe(true);
      expect(matchesAccepted(given, [ans]), given).toBe(true);
    }
  });
});
