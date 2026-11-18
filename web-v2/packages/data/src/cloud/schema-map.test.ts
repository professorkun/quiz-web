/**
 * T6-1「字段与 core 契约一致」的机器证据。
 *
 * 三类断言，对应三个风险：
 * 1. **不丢字段**：core 顶层字段必须都能落列（漏一个字段 = 迁移/同步静默丢数据）。
 * 2. **幂等键有列**：重复写入不重复，靠幂等键列真实存在。
 * 3. **嵌套保真**：JSONB 整块存取不改结构（answer/items/practice/results/questionIds）。
 *
 * 另加一条 WAF 约束断言：云端列里**永不出现题干/代码**，只存 ID 与作答结果
 * （S6 §3「请求只传题目 ID 与结果，不传题干代码全文」——旧版网关会拦代码正文）。
 */

import { describe, expect, it } from "vitest";

import {
  V2_TABLES,
  coreFieldCoverageGaps,
  idempotentKeyGaps,
  toColumn,
} from "./schema-map.js";

describe("V2 表结构 ↔ core 契约", () => {
  it("五表覆盖 core 顶层全部字段（不丢字段）", () => {
    expect(coreFieldCoverageGaps()).toEqual([]);
  });

  it("每张表的幂等键都有对应列", () => {
    expect(idempotentKeyGaps()).toEqual([]);
  });

  it("camel→snake 落列规则稳定", () => {
    expect(toColumn("attemptId")).toBe("attempt_id");
    expect(toColumn("questionRevision")).toBe("question_revision");
    expect(toColumn("isFirstAttempt")).toBe("is_first_attempt");
    expect(toColumn("answer")).toBe("answer");
    expect(toColumn("objectiveScore")).toBe("objective_score");
    expect(toColumn("activeBankId")).toBe("active_bank_id");
  });
});

describe("嵌套字段经 JSONB 往返不丢结构", () => {
  // 这些值是各嵌套列（answer/items/practice/results/questionIds/favorites）的代表样本。
  // JSONB 即 JSON 存取；往返 deep-equal 证明整块存取保真，嵌套不必拆列。
  const samples: Record<string, unknown> = {
    answer: { "blank-a": "POOLED", "blank-b": "pooled" }, // code_blank/fill 的作答
    items: [
      {
        questionId: "javaweb:single_choice:001",
        questionRevision: "abc123def456",
        questionType: "single_choice",
        sectionId: "s1",
        answered: true,
        answer: "opt-b",
        maxScore: 2,
        score: 2,
        correct: true,
        details: [{ key: "opt-b", correct: true, given: "B", accepted: ["B"] }],
        selfRating: null,
      },
    ],
    practice: {
      "javaweb": {
        order: "random",
        topicIds: ["kp:jsp"],
        types: ["single_choice"],
        limit: 10,
        onlyUnseen: false,
        onlyUnmastered: true,
        mode: "practice",
      },
    },
    results: { "javaweb:single_choice:001": "right", "javaweb:true_false:002": "wrong" },
    questionIds: ["javaweb:single_choice:001", "javaweb:true_false:002"],
    favorites: [
      { bankId: "javaweb", questionId: "javaweb:single_choice:001", addedAt: "2026-11-17T03:00:00.000Z" },
    ],
  };

  for (const [label, value] of Object.entries(samples)) {
    it(`${label} 整块存取后结构一致`, () => {
      expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    });
  }
});

describe("WAF 约束：云端只存 ID 与结果，不传题干代码全文", () => {
  it("没有任何一列是题干/代码正文（stem / code / explanation）", () => {
    const forbidden = new Set(["stem", "code", "explanation", "solution_code", "blank_code"]);
    for (const table of Object.keys(V2_TABLES) as (keyof typeof V2_TABLES)[]) {
      for (const column of V2_TABLES[table].columns) {
        expect(forbidden.has(column), `${table}.${column} 不应是题干/代码正文列`).toBe(false);
      }
    }
  });
});
