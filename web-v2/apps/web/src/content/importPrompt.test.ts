import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { IMPORT_PROMPT_V2, IMPORT_PROMPT_VERSION } from "@quiz/content";

/**
 * 提示词与 README 的一致性（V2.1 · R1.4）。
 *
 * 提示词是「给 AI 的契约」，README 是「给人看的位置」。两份一旦漂移，
 * 用户会照着旧提示词生成被新校验器拒绝的包——这是最难自查的一类事故。
 */
const readme = readFileSync(new URL("../../../../../README.md", import.meta.url), "utf8");

describe("提示词 v2（R1.4）", () => {
  it("版本标注为 v2", () => {
    expect(IMPORT_PROMPT_VERSION).toBe("v2");
    expect(IMPORT_PROMPT_V2).toContain("v2");
  });

  it("README §3 与常量逐字一致", () => {
    expect(readme).toContain(IMPORT_PROMPT_V2);
  });

  it("覆盖讲义规范、三向关联、课程链接纪律与自检清单", () => {
    expect(IMPORT_PROMPT_V2).toContain("knowledge 讲义");
    expect(IMPORT_PROMPT_V2).toContain("三向关联");
    expect(IMPORT_PROMPT_V2).toContain("只挂课程链接是合法形态");
    expect(IMPORT_PROMPT_V2).toContain("输出前自检清单");
  });

  it("英语题型映射齐全，且明确不导入听力", () => {
    for (const type of [
      "single_choice",
      "multiple_choice",
      "true_false",
      "fill_blank",
      "short_answer",
    ]) {
      expect(IMPORT_PROMPT_V2).toContain(type);
    }
    expect(IMPORT_PROMPT_V2).toContain("听力题不导入");
  });
});
