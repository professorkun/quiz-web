import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { IMPORT_PROMPT_V3, IMPORT_PROMPT_VERSION } from "@quiz/content";

/**
 * 提示词与 README 的一致性（V2.1 · R1.4 / V2.4 · R4-2）。
 *
 * 提示词是「给 AI 的契约」，README 是「给人看的位置」。两份一旦漂移，
 * 用户会照着旧提示词生成被新校验器拒绝的包——这是最难自查的一类事故。
 *
 * 比对前统一换行符：Windows 检出时 README 是 CRLF，而模板字面量里的 CRLF
 * 按语言规范会被规范成 LF。不统一的话，这条断言在 Windows 上必挂、在 CI 上却绿，
 * 变成"只在本机能复现"的假故障。
 */
const normalize = (text: string): string => text.replace(/\r\n/g, "\n");
const readme = normalize(readFileSync(new URL("../../../../../README.md", import.meta.url), "utf8"));

describe("提示词 v3（R1.4 / R4-2）", () => {
  it("版本标注为 v3", () => {
    expect(IMPORT_PROMPT_VERSION).toBe("v3");
    expect(IMPORT_PROMPT_V3).toContain("v3");
  });

  it("README §3 与常量逐字一致", () => {
    expect(readme).toContain(IMPORT_PROMPT_V3);
  });

  it("覆盖讲义规范、三向关联、课程链接纪律与自检清单", () => {
    expect(IMPORT_PROMPT_V3).toContain("knowledge 讲义");
    expect(IMPORT_PROMPT_V3).toContain("三向关联");
    expect(IMPORT_PROMPT_V3).toContain("只挂课程链接是合法形态");
    expect(IMPORT_PROMPT_V3).toContain("输出前自检清单");
  });

  it("覆盖 passages 与 cloze 的契约", () => {
    expect(IMPORT_PROMPT_V3).toContain("passages 共享材料");
    expect(IMPORT_PROMPT_V3).toContain("cloze 完形 / 选词 / 七选五");
    expect(IMPORT_PROMPT_V3).toContain("reuseOptions");
    expect(IMPORT_PROMPT_V3).toContain("有 cloze 就必须至少有一篇 passages");
  });

  it("英语题型映射齐全，且明确不导入听力", () => {
    for (const type of [
      "single_choice",
      "multiple_choice",
      "true_false",
      "fill_blank",
      "short_answer",
      "cloze",
    ]) {
      expect(IMPORT_PROMPT_V3).toContain(type);
    }
    expect(IMPORT_PROMPT_V3).toContain("听力题不导入");
  });
});
