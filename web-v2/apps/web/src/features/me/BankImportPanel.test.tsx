// @vitest-environment jsdom
/**
 * Word 导入的界面链路（V2.2 · T-08）。
 *
 * 解析器单测证明"认得出来"，这里证明"确认前不写入、勾哪题导哪题"。
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import type { Clock } from "@quiz/platform";
import { createPlatform, MemoryKeyValueStore } from "@quiz/platform-web";

import { PlatformProvider } from "../../platform/PlatformProvider";
import { BankImportPanel } from "./BankImportPanel";

const clock: Clock = { now: () => new Date("2026-11-20T09:00:00.000Z") };

function para(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function makeDocx(parts: readonly string[]): ArrayBuffer {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join(
    "",
  )}<w:sectPr/></w:body></w:document>`;
  const bytes = zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    "word/document.xml": strToU8(documentXml),
  });
  return bytes.buffer as ArrayBuffer;
}

afterEach(cleanup);

describe("Word 导入面板（T-08）", () => {
  it("识别后逐题确认：低置信度不可选，确认后只写入勾选的题", async () => {
    const platform = createPlatform({
      kv: new MemoryKeyValueStore(),
      builtinBanks: [],
      clock,
    });

    const { container } = render(
      <PlatformProvider platform={platform} builtinBanks={[]}>
        <BankImportPanel />
      </PlatformProvider>,
    );
    await screen.findByRole("heading", { name: "导入题库" });

    const input = container.querySelector('input[accept*=".docx"]');
    expect(input).not.toBeNull();
    const file = new File(
      [
        makeDocx([
          para("1. 以下哪个是 Servlet 的生命周期方法？"),
          para("A. init"),
          para("B. main"),
          para("答案：A"),
          para("2. 这道题没有答案。"),
          para("A. 甲"),
          para("B. 乙"),
        ]),
      ],
      "wordtest.docx",
      { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    );

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByText(/Word 识别结果/)).toBeTruthy();
    expect(screen.getByText(/可导入 1\/2 题/)).toBeTruthy();
    const second = screen.getByLabelText("选择第 2 题") as HTMLInputElement;
    expect(second.disabled).toBe(true);

    // 确认前不写入任何题库
    expect(await platform.banks.listBankIds()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: /确认导入所选（1 题）/ }));

    await waitFor(async () => {
      expect(await platform.banks.listBankIds()).toEqual(["wordtest"]);
    });
    expect(await platform.banks.listQuestions("wordtest")).toHaveLength(1);
  });
});
