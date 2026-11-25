// @vitest-environment jsdom
/**
 * Word 导入（V2.2 · T-08）的机器证据。
 *
 * 夹具在测试里用 fflate 现场生成最小 .docx：不往仓库塞二进制，
 * 也保证用例能精确控制段落样式（Heading1/2）、表格与答案格式。
 */

import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { validateBankPackage } from "@quiz/core";
import { parseBankJson } from "@quiz/data";
import { buildBankFromDraft, exportDraftJson, parseDocx } from "@quiz/data/docx";

const NOW = "2026-11-20T00:00:00.000Z";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function para(text: string, style?: string, bold = false): string {
  const pPr = style === undefined ? "" : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`;
  const rPr = bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function table(rows: readonly (readonly string[])[]): string {
  const trs = rows
    .map((cells) => `<w:tr>${cells.map((text) => `<w:tc>${para(text)}</w:tc>`).join("")}</w:tr>`)
    .join("");
  return `<w:tbl>${trs}</w:tbl>`;
}

function makeDocx(parts: readonly string[]): Uint8Array {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join(
    "",
  )}<w:sectPr/></w:body></w:document>`;
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    "word/document.xml": strToU8(documentXml),
  });
}

function standardPaper(count: number): readonly string[] {
  const parts: string[] = [
    para("JavaWeb 复习讲义", "Heading1"),
    para("本节覆盖 Servlet 生命周期与 JSP 内置对象。"),
    para("考点提示", "Heading2"),
    para("先判断题型，再回忆对应章节。", undefined, true),
  ];
  for (let i = 1; i <= count; i += 1) {
    parts.push(para(`${i}. 第 ${i} 题：以下关于 Servlet 的说法正确的是？`));
    parts.push(para("A. 甲说法"));
    parts.push(para("B. 乙说法"));
    parts.push(para("C. 丙说法"));
    parts.push(para("D. 丁说法"));
    parts.push(para(`答案：${["A", "B", "C", "D"][i % 4]}`));
  }
  return parts;
}

describe("docx 解析（T-08）", () => {
  it("20 题标准卷识别 ≥ 90%，并逐题通过契约", () => {
    const draft = parseDocx(makeDocx(standardPaper(20)), { fileName: "javaweb.docx" });

    expect(draft.stats.totalQuestions).toBe(20);
    expect(draft.stats.parsed).toBe(20);
    expect(draft.stats.parsed / draft.stats.totalQuestions).toBeGreaterThanOrEqual(0.9);
    expect(draft.stats.highConfidence).toBe(20);
    expect(draft.questions.every((entry) => entry.type === "single_choice")).toBe(true);
    expect(draft.questions[0]?.stem).toContain("第 1 题");
    expect(draft.questions[0]?.options).toHaveLength(4);
  });

  it("Heading1/2 变成讲义小节，正文与加粗要点都保留", () => {
    const draft = parseDocx(makeDocx(standardPaper(2)), { fileName: "javaweb.docx" });
    expect(draft.stats.knowledgeSections).toBe(2);
    expect(draft.knowledge[0]?.sections[0]?.title).toBe("JavaWeb 复习讲义");
    expect(draft.knowledge[0]?.sections[0]?.body).toContain("Servlet 生命周期");
    expect(draft.knowledge[0]?.sections[1]?.body).toContain("**先判断题型");
  });

  it("表格卷：表头跳过，数字行按题目解析", () => {
    const parts = [
      para("表格卷", "Heading1"),
      table([
        ["题号", "题干", "选项 A", "选项 B", "答案"],
        ["1", "Java 的根类型是？", "A. Object", "B. String", "答案：A"],
        ["2", "JVM 的缩写是？", "A. Java Virtual Machine", "B. Joint VM", "答案：A"],
      ]),
    ];
    const draft = parseDocx(makeDocx(parts), { fileName: "table.docx" });
    expect(draft.stats.tableRows).toBe(3);
    expect(draft.stats.totalQuestions).toBe(2);
    expect(draft.questions.every((entry) => entry.question !== null)).toBe(true);
    expect(draft.questions[1]?.answerLabel).toBe("A");
  });

  it("多选 / 判断 / 填空 / 简答都能按规则归类", () => {
    const parts = [
      para("1. 以下哪些属于 JSP 内置对象？"),
      para("A. request"),
      para("B. response"),
      para("C. main"),
      para("答案：AB"),
      para("2. HTTP 是无状态协议。"),
      para("答案：对"),
      para("3. Servlet 的根元素是 ____。"),
      para("答案：<servlet>"),
      para("4. 简述 Servlet 的生命周期。"),
      para("答案：初始化；处理请求；销毁"),
    ];
    const draft = parseDocx(makeDocx(parts), { fileName: "mixed.docx" });
    expect(draft.questions.map((entry) => entry.type)).toEqual([
      "multiple_choice",
      "true_false",
      "fill_blank",
      "short_answer",
    ]);
    expect(draft.questions[0]?.answerLabel).toBe("AB");
    expect(draft.questions[2]?.stem).toContain("{{b1}}");
    expect(draft.questions.every((entry) => entry.question !== null)).toBe(true);
  });

  it("缺答案的题标为低置信度且不生成成品", () => {
    const parts = [para("1. 这道题没有答案。"), para("A. 甲"), para("B. 乙")];
    const draft = parseDocx(makeDocx(parts), { fileName: "bad.docx" });
    expect(draft.questions[0]?.confidence).toBe("low");
    expect(draft.questions[0]?.question).toBeNull();
    expect(draft.questions[0]?.problems.join()).toContain("缺少答案");
  });

  it("草稿导出与正式题库包同形：再导入零错误", () => {
    const draft = parseDocx(makeDocx(standardPaper(20)), { fileName: "javaweb.docx" });
    const indexes = draft.questions.map((entry) => entry.index);
    const json = exportDraftJson(draft, indexes);

    const parsed = parseBankJson(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.value?.questions).toHaveLength(20);
    expect(parsed.value?.manifest.bankId).toBe("javaweb");
    expect(parsed.value?.knowledge).toHaveLength(1);
  });

  it("只收勾选的题，并重新计算 questionCount", () => {
    const draft = parseDocx(makeDocx(standardPaper(5)), { fileName: "javaweb.docx" });
    const bank = buildBankFromDraft(draft, [1, 3, 5], NOW);
    expect(bank.manifest.questionCount).toBe(3);
    expect(bank.questions).toHaveLength(3);
    expect(validateBankPackage({ manifest: bank.manifest, questions: bank.questions }).ok).toBe(
      true,
    );
  });

  it("非 docx / 旧版 .doc 给出中文错误，而不是崩溃", () => {
    expect(() => parseDocx(new Uint8Array([1, 2, 3]))).toThrow(/无法解压/);
  });
});
