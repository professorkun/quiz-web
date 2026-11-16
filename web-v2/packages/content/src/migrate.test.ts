import { readFileSync } from "node:fs";

import { validateBankPackage } from "@quiz/core";
import { describe, expect, it } from "vitest";

import { migrateLegacyBank } from "./migrate.js";
import type { LegacyDataJson } from "./legacy.js";

const sourceUrl = new URL("../../../../_build/data.json", import.meta.url);
const raw = JSON.parse(readFileSync(sourceUrl, "utf8")) as LegacyDataJson;

const run = (input: LegacyDataJson = raw) => migrateLegacyBank(input, { sourceTag: "test-tag" });

describe("T1-4 迁移：数量对账", () => {
  const result = run();

  it("题量 147，分布 62 / 45 / 27 / 8 / 5", () => {
    expect(result.stats.total).toBe(147);
    expect(result.stats.byType).toEqual({
      single_choice: 62,
      true_false: 45,
      fill_blank: 27,
      short_answer: 8,
      code_blank: 5,
    });
  });

  it("代码填空唯一空位 89（不是字面标记数 97）", () => {
    expect(result.stats.codeBlankSlots).toBe(89);
    const markers = result.questions
      .filter((q) => q.type === "code_blank")
      .flatMap((q) => q.files.flatMap((f) => [...f.code.matchAll(/___\(([^)]+)\)___/g)]));
    expect(markers.length).toBeGreaterThan(89); // 同一空位在多处出现，字面数更多
  });

  it("知识点 7 类，legacy 映射 147 条且一一对应", () => {
    expect(result.stats.topicCount).toBe(7);
    const values = Object.values(result.legacyMap);
    expect(values.length).toBe(147);
    expect(new Set(values).size).toBe(147); // 无一对多
  });

  it("迁移零问题", () => {
    expect(result.issues).toEqual([]);
  });
});

describe("T1-4 迁移：契约合法性", () => {
  it("产物能通过 validateBankPackage", () => {
    const result = run();
    const check = validateBankPackage({ manifest: result.manifest, questions: result.questions });
    expect(check.issues).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it("每个空位都能在代码里定位（标记 ↔ 答案双向对齐）", () => {
    const result = run();
    for (const q of result.questions) {
      if (q.type !== "code_blank") continue;
      for (const b of q.blanks) {
        const file = q.files.find((f) => f.fileId === b.fileId);
        expect(file, `${q.questionId} 缺文件 ${b.fileId}`).toBeDefined();
        expect(file?.code.includes(`___(${b.blankId})___`)).toBe(true);
      }
    }
  });
});

describe("T1-4 迁移：幂等与身份稳定（ADR-0001 判据）", () => {
  it("同一输入连续跑两次，输出逐字节一致", () => {
    const a = JSON.stringify(run());
    const b = JSON.stringify(run());
    expect(a).toBe(b);
  });

  it("在题库里**插入**一道新题，已有 147 条的 questionId 全部不变", () => {
    const before = run();
    const beforeIds = before.questions.map((q) => q.questionId);

    // 模拟「在 Markdown 里插一道选择题」：追加到源数据末尾，并重新编号占用一个新 no
    const patched: LegacyDataJson = {
      ...raw,
      questions: [
        ...raw.questions,
        {
          type: "choice",
          no: 999,
          stem: "新插入的题目",
          options: [
            { key: "A", text: "甲" },
            { key: "B", text: "乙" },
          ],
          answer: "A",
          kp: "JSP",
        },
      ],
    };
    const after = run(patched);
    const afterIds = after.questions.slice(0, before.questions.length).map((q) => q.questionId);

    expect(after.stats.total).toBe(148);
    expect(afterIds).toEqual(beforeIds); // 关键：已有 ID 一个都没动
    // 新题拿到的是该题型的下一个序号，而不是复用别人的
    expect(after.questions[after.questions.length - 1]?.questionId).toBe("javaweb:single_choice:063");
  });

  it("改一道题的解析：ID 不变、revision 变", () => {
    const before = run();
    const target = raw.questions.findIndex((q) => q.type === "choice");
    const original = raw.questions[target] as Extract<LegacyDataJson["questions"][number], { type: "choice" }>;

    const patched: LegacyDataJson = {
      ...raw,
      questions: raw.questions.map((q, i) =>
        i === target ? { ...original, analysis: `${original.analysis ?? ""}（新增一行解析）` } : q,
      ),
    };
    const after = run(patched);

    const beforeQ = before.questions.find((q) => q.legacyKeys.includes(`choice-${original.no}`));
    const afterQ = after.questions.find((q) => q.legacyKeys.includes(`choice-${original.no}`));

    expect(afterQ?.questionId).toBe(beforeQ?.questionId);
    expect(afterQ?.revision).not.toBe(beforeQ?.revision);
  });

  it("不参与含义的字段变化不触发 revision：知识点改标", () => {
    const before = run();
    const target = raw.questions.findIndex((q) => q.type === "judge");
    const original = raw.questions[target] as Extract<LegacyDataJson["questions"][number], { type: "judge" }>;

    const patched: LegacyDataJson = {
      ...raw,
      questions: raw.questions.map((q, i) => (i === target ? { ...original, kp: "Spring" } : q)),
    };
    const after = run(patched);

    const beforeQ = before.questions.find((q) => q.legacyKeys.includes(`judge-${original.no}`));
    const afterQ = after.questions.find((q) => q.legacyKeys.includes(`judge-${original.no}`));

    expect(afterQ?.revision).toBe(beforeQ?.revision);
    expect(afterQ?.topicIds).not.toEqual(beforeQ?.topicIds);
  });
});
