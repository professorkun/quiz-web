/**
 * T2-3 验收：归一化规则清单 + 已知误判黑名单全部规避。
 *
 * 这里刻意把「旧版会怎么做」写成可执行函数 `legacyBlankOk`，
 * 而不是靠文档里的一句"旧版比较宽松"——行为对照必须能重跑（T2-9）。
 */

import { describe, expect, it } from "vitest";

import {
  ACCEPTED_SEPARATOR,
  NORMALIZE_RULES,
  matchesAccepted,
  normalizeAnswer,
  splitAccepted,
} from "./normalize.js";
import { MISJUDGMENT_BLACKLIST } from "./misjudgment-blacklist.js";

/** 旧版 `_build/template.html:421` norm()，原样复刻，仅用于对照 */
function legacyNorm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .replace(/[`"'“”‘’]/g, "")
    .replace(/；/g, ";")
    .replace(/，/g, ",")
    .replace(/、/g, ",")
    .replace(/\/>/g, ">")
    .replace(/[。.]$/g, "");
}

/** 旧版 `:429` blankOk()，原样复刻 */
function legacyBlankOk(user: string, ans: string): boolean {
  const nu = legacyNorm(user);
  if (!nu) return false;
  const nb = legacyNorm(ans);
  return nb === nu || (nb.indexOf(nu) >= 0 && nu.length >= 2);
}

describe("填空题归一化规则清单", () => {
  it("规则编号连续、无重复，且每条都有可读说明", () => {
    expect(NORMALIZE_RULES.map((r) => r.id)).toEqual(["N1", "N2", "N3", "N4", "N5", "N6", "N7"]);
    for (const rule of NORMALIZE_RULES) expect(rule.description.length).toBeGreaterThan(3);
  });

  it("N1 全角转半角：Ｓｅｒｖｌｅｔ 与 servlet 归一化后相同", () => {
    expect(normalizeAnswer("Ｓｅｒｖｌｅｔ")).toBe("servlet");
    expect(normalizeAnswer("Ｓｅｒｖｌｅｔ")).toBe(normalizeAnswer(" servlet "));
  });

  it("N6 自闭合标签等价、N4 去引号：题库真实答案可判对", () => {
    expect(normalizeAnswer('<jsp:include page="" />')).toBe(
      normalizeAnswer('<jsp:include page="">'),
    );
    expect(normalizeAnswer("<a/>")).toBe(normalizeAnswer("<a>"));
  });

  it("N8 多答案分隔只认 | ，不误拆含 / 与引号的代码答案", () => {
    expect(ACCEPTED_SEPARATOR.test("｜")).toBe(true);
    expect(splitAccepted("Servlet｜servlet-api|HttpServlet")).toEqual([
      "Servlet",
      "servlet-api",
      "HttpServlet",
    ]);
    expect(matchesAccepted("servlet-api", ["Servlet|servlet-api"])).toBe(true);
    const code = '<url-pattern>/x</url-pattern>';
    expect(splitAccepted(code)).toEqual([code]);
    expect(matchesAccepted(code, [code])).toBe(true);
  });

  it("空输入永不判对", () => {
    expect(matchesAccepted("", ["A"])).toBe(false);
    expect(matchesAccepted("   ", ["A"])).toBe(false);
    expect(matchesAccepted(null, ["A"])).toBe(false);
  });
});

describe("已知误判黑名单（应全部规避）", () => {
  it("黑名单每条记录的旧版结果确实与期望相反，证明它们是真实误判", () => {
    for (const c of MISJUDGMENT_BLACKLIST) {
      expect(legacyBlankOk(c.given, c.accepted[0] ?? ""), `${c.id} 旧版行为记录`).toBe(c.legacy);
      expect(c.legacy, `${c.id} 必须是一条误判`).not.toBe(c.expected);
    }
  });

  it("黑名单内 9 条已知误判，新版判定逐条等于 expected（0 条残留）", () => {
    const residual = MISJUDGMENT_BLACKLIST.filter(
      (c) => matchesAccepted(c.given, c.accepted) !== c.expected,
    );
    expect(residual.map((c) => c.id)).toEqual([]);
  });

  it("不通过放宽松规则来修：归一化后必须精确相等，不含 indexOf 式包含匹配", () => {
    for (const c of MISJUDGMENT_BLACKLIST.filter((x) => x.kind === "错判为对")) {
      const g = normalizeAnswer(c.given);
      const a = normalizeAnswer(c.accepted[0] ?? "");
      expect(g, c.id).not.toBe(a);
      expect(a.includes(g), c.id).toBe(true); // 旧版正是因为这句才判对
    }
  });
});
