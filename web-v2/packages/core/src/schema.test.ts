import { describe, expect, it } from "vitest";

import {
  SCHEMA_VERSION,
  QuestionSchema,
  computeRevision,
  makeQuestionId,
  nextSeq,
  parseQuestionId,
  validateBankPackage,
  type Question,
} from "./index.js";

const base = (over: Record<string, unknown>) => ({
  schemaVersion: SCHEMA_VERSION,
  bankId: "javaweb",
  revision: computeRevision(over),
  topicIds: ["javaweb:topic:jsp"],
  stem: "题干",
  ...over,
});

describe("题目 ID（ADR-0001）", () => {
  it("生成与解析可往返", () => {
    const id = makeQuestionId("javaweb", "single_choice", 1);
    expect(id).toBe("javaweb:single_choice:001");
    expect(parseQuestionId(id)).toEqual({ bankId: "javaweb", type: "single_choice", seq: 1 });
  });

  it("拒绝畸形 ID，而不是猜", () => {
    expect(() => parseQuestionId("javaweb:001")).toThrow();
    expect(() => parseQuestionId("javaweb:single_choice:abc")).toThrow();
    expect(() => parseQuestionId(":single_choice:001")).toThrow();
  });

  it("分配新序号时取最大值 +1，不复用已删除的编号", () => {
    const ids = ["javaweb:single_choice:001", "javaweb:single_choice:007"];
    expect(nextSeq(ids, "javaweb", "single_choice")).toBe(8);
    // 另一个题型互不干扰
    expect(nextSeq(ids, "javaweb", "true_false")).toBe(1);
  });
});

describe("修订号", () => {
  it("键顺序不同但内容相同 → 同号", () => {
    expect(computeRevision({ a: 1, b: 2 })).toBe(computeRevision({ b: 2, a: 1 }));
  });

  it("改一个字符 → 换号（改错别字必须被发现）", () => {
    expect(computeRevision({ stem: "题干" })).not.toBe(computeRevision({ stem: "题千" }));
  });

  it("undefined 字段不参与计算", () => {
    expect(computeRevision({ a: 1, b: undefined })).toBe(computeRevision({ a: 1 }));
  });
});

describe("六类题型契约", () => {
  it("单选题：答案必须指向存在的 optionId", () => {
    const ok = QuestionSchema.safeParse(
      base({
        type: "single_choice",
        questionId: "javaweb:single_choice:001",
        options: [
          { optionId: "a", text: "POOLED" },
          { optionId: "b", text: "UNPOOLED" },
        ],
        answer: "a",
      }),
    );
    expect(ok.success).toBe(true);

    const bad = QuestionSchema.safeParse(
      base({
        type: "single_choice",
        questionId: "javaweb:single_choice:002",
        options: [{ optionId: "a", text: "POOLED" }],
        answer: "z",
      }),
    );
    expect(bad.success).toBe(false);
  });

  it("多选题：答案不得重复", () => {
    const parsed = QuestionSchema.safeParse(
      base({
        type: "multiple_choice",
        questionId: "javaweb:multiple_choice:001",
        options: [
          { optionId: "a", text: "A" },
          { optionId: "b", text: "B" },
        ],
        answer: ["a", "a"],
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it("判断题：answer 是布尔，不是 √/×", () => {
    const parsed = QuestionSchema.safeParse(
      base({ type: "true_false", questionId: "javaweb:true_false:001", answer: true }),
    );
    expect(parsed.success).toBe(true);
  });

  it("填空题：题干必须有对应的 {{blankId}} 占位符", () => {
    const ok = QuestionSchema.safeParse(
      base({
        type: "fill_blank",
        questionId: "javaweb:fill_blank:001",
        stem: "默认数据源类型是 {{b1}}",
        blanks: [{ blankId: "b1", accepted: ["POOLED"] }],
      }),
    );
    expect(ok.success).toBe(true);

    const bad = QuestionSchema.safeParse(
      base({
        type: "fill_blank",
        questionId: "javaweb:fill_blank:002",
        stem: "没有任何占位符",
        blanks: [{ blankId: "b1", accepted: ["POOLED"] }],
      }),
    );
    expect(bad.success).toBe(false);
  });

  it("代码填空：空位标记与答案必须双向对齐", () => {
    const okQ = base({
      type: "code_blank",
      questionId: "javaweb:code_blank:001",
      files: [
        {
          fileId: "f1",
          label: "web.xml",
          language: "xml",
          code: "<param-value>___(b1)___</param-value>",
        },
      ],
      blanks: [{ blankId: "b1", fileId: "f1", accepted: ["environments"] }],
    });
    expect(QuestionSchema.safeParse(okQ).success).toBe(true);

    // 代码里多一个标记却没有答案 → 必须拦（这正是旧版「空位无答案」的风险）
    const orphanMarker = base({
      type: "code_blank",
      questionId: "javaweb:code_blank:002",
      files: [
        {
          fileId: "f1",
          label: "web.xml",
          language: "xml",
          code: "___(b1)___ 与 ___(b2)___",
        },
      ],
      blanks: [{ blankId: "b1", fileId: "f1", accepted: ["x"] }],
    });
    expect(QuestionSchema.safeParse(orphanMarker).success).toBe(false);
  });

  it("简答题：采分点分值必须为正", () => {
    const parsed = QuestionSchema.safeParse(
      base({
        type: "short_answer",
        questionId: "javaweb:short_answer:001",
        rubric: [{ pointId: "p1", text: "说出 @Controller", score: 0 }],
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it("questionId 的题型段与 type 必须一致", () => {
    const parsed = QuestionSchema.safeParse(
      base({
        type: "true_false",
        questionId: "javaweb:single_choice:009",
        answer: true,
      }),
    );
    expect(parsed.success).toBe(false);
  });
});

describe("题库包校验", () => {
  const topic = { topicId: "javaweb:topic:jsp", bankId: "javaweb", name: "JSP" };
  const q1: Question = QuestionSchema.parse(
    base({ type: "true_false", questionId: "javaweb:true_false:001", answer: true }),
  ) as Question;

  const manifest = (over: Record<string, unknown> = {}) => ({
    schemaVersion: SCHEMA_VERSION,
    bankId: "javaweb",
    title: "JavaWeb 期末题库",
    questionCount: 1,
    topics: [topic],
    examTemplates: [],
    createdAt: "2026-11-16",
    ...over,
  });

  it("正常包通过", () => {
    const r = validateBankPackage({ manifest: manifest(), questions: [q1] });
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("重复题目 ID 被抓", () => {
    const r = validateBankPackage({ manifest: manifest({ questionCount: 2 }), questions: [q1, q1] });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("DUP_QUESTION_ID");
  });

  it("悬空 topicId 被抓", () => {
    const q: Question = QuestionSchema.parse(
      base({
        type: "true_false",
        questionId: "javaweb:true_false:002",
        answer: false,
        topicIds: ["javaweb:topic:不存在"],
      }),
    ) as Question;
    const r = validateBankPackage({ manifest: manifest(), questions: [q] });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("UNKNOWN_TOPIC");
  });

  it("同一旧键指向两道题 → 一对多，必须拦", () => {
    const a: Question = QuestionSchema.parse(
      base({
        type: "true_false",
        questionId: "javaweb:true_false:001",
        answer: true,
        legacyKeys: ["judge-1"],
      }),
    ) as Question;
    const b: Question = QuestionSchema.parse(
      base({
        type: "true_false",
        questionId: "javaweb:true_false:002",
        answer: false,
        legacyKeys: ["judge-1"],
      }),
    ) as Question;
    const r = validateBankPackage({ manifest: manifest({ questionCount: 2 }), questions: [a, b] });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("DUP_LEGACY_KEY");
  });

  it("题量与声明不符被抓", () => {
    const r = validateBankPackage({ manifest: manifest({ questionCount: 5 }), questions: [q1] });
    expect(r.issues.map((i) => i.code)).toContain("QUESTION_COUNT_MISMATCH");
  });
});
