import { describe, expect, it } from "vitest";

import { KnowledgeModuleSchema, validateKnowledgeModules } from "./index.js";

const legacy = {
  moduleId: "javaweb:kb:jsp",
  topicId: "javaweb:topic:jsp",
  title: "JSP",
  summary: "内置对象、指令、动作标签",
  items: [{ title: "四个作用域", detail: "page / request / session / application" }],
  pitfalls: ["getProperty 没有 value 属性"],
};

describe("讲义契约（S7-E8）", () => {
  it("旧形态（只有 items）继续合法，新字段补空数组而不是 undefined", () => {
    const parsed = KnowledgeModuleSchema.parse(legacy);
    expect(parsed.sections).toEqual([]);
    expect(parsed.videos).toEqual([]);
    expect(parsed.goals).toEqual([]);
    expect(parsed.resources).toEqual([]);
    expect(parsed.estimatedMinutes).toBeUndefined();
  });

  it("可带正文小节与视频，视频只存地址不存文件", () => {
    const parsed = KnowledgeModuleSchema.parse({
      ...legacy,
      estimatedMinutes: 25,
      examFocus: "填空高频：九个内置对象",
      goals: ["说清四个作用域的范围"],
      sections: [{ title: "四个作用域", body: "| 作用域 | 范围 |\n| --- | --- |" }],
      videos: [
        {
          url: "https://www.bilibili.com/video/BV1Y7411K7zz?p=5",
          title: "JSP 内置对象",
          note: "从第 5 集开始看",
          startSec: 0,
        },
      ],
      resources: [{ title: "Jakarta Server Pages 规范", url: "https://jakarta.ee/" }],
    });
    expect(parsed.videos[0]?.url).toContain("BV1Y7411K7zz");
    expect(parsed.sections[0]?.title).toBe("四个作用域");
  });

  it("视频缺 url 直接判不合法，不会渲染出一个空播放器", () => {
    const result = KnowledgeModuleSchema.safeParse({
      ...legacy,
      videos: [{ title: "没有地址的视频" }],
    });
    expect(result.success).toBe(false);
  });

  it("validateKnowledgeModules：空讲义被拒并定位到第几篇", () => {
    const result = validateKnowledgeModules([
      legacy,
      { moduleId: "javaweb:kb:empty", topicId: "javaweb:topic:jsp", title: "空壳", summary: "没有内容" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.modules).toHaveLength(1);
    expect(result.issues[0]?.path).toBe("knowledge[1]");
    expect(result.issues[0]?.message).toContain("空壳");
  });

  it("validateKnowledgeModules：非数组不猜，直接报错", () => {
    const result = validateKnowledgeModules({});
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toBe("knowledge");
  });
});
