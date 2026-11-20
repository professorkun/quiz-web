/**
 * docx 草稿解析（V2.2 · R1.3 / T-08）。
 *
 * 设计取向：
 * 1. **先出草稿，再逐题确认**：Word 排版千奇百怪，任何"自动全收"都会把
 *    页眉、页码、答案串题当成题目；所以解析结果永远标置信度，由人勾选。
 * 2. **不伪造答案**：认不出答案的题只报问题、不生成 Question——宁可少收一题，
 *    也不把「答案：略」塞成正确答案。
 * 3. **产物必须过 core 的契约**：每道题都用 `QuestionSchema` 验过才进草稿，
 *    确认导入时整包仍会被 `validateBankPackage` 再验一次。
 */

import {
  KnowledgeModuleSchema,
  QuestionSchema,
  SCHEMA_VERSION,
  computeRevision,
  type BankContent,
  type KnowledgeModule,
  type Question,
  type QuestionType,
} from "@quiz/core";
import { strFromU8, unzipSync } from "fflate";

import { BANK_FILE_KIND } from "../snapshot.js";
import { extractBlocks, type DocBlock } from "./extract.js";

export interface DocxOption {
  readonly optionId: string;
  readonly text: string;
}

export interface DocxQuestionDraft {
  /** 1 起，用于勾选与导出 */
  readonly index: number;
  /** 卷面题号；识别不到时为 null */
  readonly number: number | null;
  readonly stem: string;
  readonly options: readonly DocxOption[];
  readonly answerLabel: string;
  readonly type: QuestionType | null;
  /** high = 结构与答案都认出来了；low = 需要人工处理（不可导入） */
  readonly confidence: "high" | "low";
  readonly problems: readonly string[];
  /** 已通过契约校验的成品；low 必为 null */
  readonly question: Question | null;
}

export interface DocxDraftStats {
  readonly totalQuestions: number;
  readonly parsed: number;
  readonly highConfidence: number;
  readonly knowledgeSections: number;
  /** 解析到的表格行数（跨页表格按行累计） */
  readonly tableRows: number;
}

export interface DocxDraft {
  readonly bankId: string;
  readonly title: string;
  readonly questions: readonly DocxQuestionDraft[];
  readonly knowledge: readonly KnowledgeModule[];
  readonly stats: DocxDraftStats;
}

export interface ParseDocxOptions {
  /** 原文件名：用于推导 bankId 与标题（.docx 不保证含标题） */
  readonly fileName?: string;
}

/* --------------------------------------------------------------- 解压 */

const DOCUMENT_XML = "word/document.xml";

function readDocumentXml(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("无法解压：这不是有效的 .docx（旧版 .doc 或扫描件请先另存为 .docx）");
  }
  const entry = files[DOCUMENT_XML];
  if (entry === undefined) {
    throw new Error("不是 Word 文档：压缩包里缺少 word/document.xml");
  }
  return strFromU8(entry);
}

/* -------------------------------------------------------------- 行规则 */

interface RawQuestion {
  readonly number: number;
  readonly stem: string[];
  readonly options: Map<string, string>;
  readonly explanation: string[];
  readonly problems: string[];
  answer: string | null;
}

const CN_START = /^第\s*(\d{1,3})\s*题\s*[.、．:：]?\s*(.*)$/;
const NUM_START = /^(\d{1,3})\s*[.、．)）]\s*(?!\d)(.*)$/;
const BRACKET_START = /^[\[［]\s*(\d{1,3})\s*[\]］]\s*(.*)$/;
const OPTION_LINE = /^[（(]?([A-Ha-h])[)）.、．:：]\s*(.*)$/;
const ANSWER_LINE = /^(?:【答案】|参考答案\s*[:：]?|正确答案\s*[:：]?|答案\s*[:：])\s*(.*)$/;
const EXPLAIN_LINE = /^(?:【解析】|解析\s*[:：]|答案解析\s*[:：])\s*(.*)$/;

function startNumber(line: string): { number: number; rest: string } | null {
  const cn = CN_START.exec(line);
  if (cn?.[1] !== undefined) return { number: Number(cn[1]), rest: cn[2] ?? "" };
  const bracket = BRACKET_START.exec(line);
  if (bracket?.[1] !== undefined) return { number: Number(bracket[1]), rest: bracket[2] ?? "" };
  const num = NUM_START.exec(line);
  if (num?.[1] !== undefined) return { number: Number(num[1]), rest: num[2] ?? "" };
  return null;
}

function parseOption(line: string): { letter: string; text: string } | null {
  const match = OPTION_LINE.exec(line);
  if (match?.[1] === undefined) return null;
  if ((match[2] ?? "").trim() === "") return null;
  return { letter: match[1].toUpperCase(), text: (match[2] ?? "").trim() };
}

/** 一行里并排写了多个选项（`A.甲 B.乙 C.丙`）时拆开 */
function splitInlineOptions(line: string): string[] {
  if (parseOption(line) === null) return [line];
  const parts = line.split(/(?=\s[（(]?[B-Hb-h][)）.、．:：]\s*)/g);
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

function asBoolean(answer: string): boolean | null {
  const value = answer.replace(/\s+/g, "").toLowerCase();
  if (["对", "正确", "√", "✓", "是", "true", "t"].includes(value)) return true;
  if (["错", "错误", "×", "✗", "否", "false", "f"].includes(value)) return false;
  return null;
}

/** 只接受「纯字母」答案（B / AC / A,C）；夹带解释文字时退回取首个字母 */
function answerLetters(answer: string): string[] {
  const compact = answer.replace(/[\s,，、;；]/g, "").toUpperCase();
  if (/^[A-H]+$/.test(compact)) return [...new Set(compact.split(""))];
  const leading = /^[（(]?([A-H])[)）.、．:：]?/.exec(answer.trim().toUpperCase());
  return leading?.[1] === undefined ? [] : [leading[1]];
}

/* ------------------------------------------------------------ 表格展开 */

function expandTableRow(block: DocBlock): string[] {
  const cells = (block.cells ?? []).map((cell) => cell.trim());
  if (cells.length === 0) return [block.text];
  const first = cells[0] ?? "";
  // 表头行不是题目
  if (/^(?:题号|序号|编号|no\.?)$/i.test(first)) return [];
  if (/^\d{1,3}$/.test(first)) {
    const rest = cells.slice(1);
    const head = rest.shift() ?? "";
    return [`${first}. ${head}`, ...rest];
  }
  // 单列表格：整格可能是一个完整题行，按同一套行规则再拆
  return cells;
}

/* ------------------------------------------------------------------ 切题 */

function flush(raws: RawQuestion[], current: RawQuestion | null): void {
  if (current !== null) raws.push(current);
}

function collect(blocks: readonly DocBlock[]): { raws: RawQuestion[]; pre: DocBlock[] } {
  const raws: RawQuestion[] = [];
  const pre: DocBlock[] = [];
  let current: RawQuestion | null = null;
  let mode: "stem" | "explain" = "stem";
  let started = false;

  for (const block of blocks) {
    // 中途出现的标题是分节，不是题干：收掉上一题，后面的内容等下一个题号
    if (block.heading !== null && current !== null) {
      flush(raws, current);
      current = null;
      mode = "stem";
    }
    const lines = block.kind === "table" ? expandTableRow(block) : block.text.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === "") continue;

      const start = startNumber(line);
      if (start !== null) {
        flush(raws, current);
        current = {
          number: start.number,
          stem: start.rest === "" ? [] : [start.rest],
          options: new Map<string, string>(),
          explanation: [],
          problems: [],
          answer: null,
        };
        mode = "stem";
        started = true;
        continue;
      }

      if (!started) {
        pre.push({ ...block, text: line });
        continue;
      }
      if (current === null) continue;

      const optionParts = splitInlineOptions(line);
      if (optionParts.every((part) => parseOption(part) !== null)) {
        for (const part of optionParts) {
          const option = parseOption(part);
          if (option === null) continue;
          if (current.options.has(option.letter)) {
            current.problems.push(`选项 ${option.letter} 重复出现，已保留第一次`);
          } else {
            current.options.set(option.letter, option.text);
          }
        }
        mode = "stem";
        continue;
      }

      const answer = ANSWER_LINE.exec(line);
      if (answer !== null) {
        current.answer = (answer[1] ?? "").trim();
        continue;
      }

      const explain = EXPLAIN_LINE.exec(line);
      if (explain !== null) {
        mode = "explain";
        const text = (explain[1] ?? "").trim();
        if (text !== "") current.explanation.push(text);
        continue;
      }

      if (mode === "explain") current.explanation.push(line);
      else current.stem.push(line);
    }
  }
  flush(raws, current);
  return { raws, pre };
}

/* -------------------------------------------------------------- 归一化 */

function emptyQuestionId(bankId: string, type: QuestionType, seq: number): string {
  return `${bankId}:${type}:${String(seq).padStart(3, "0")}`;
}

function normalize(
  raw: RawQuestion,
  bankId: string,
  index: number,
): DocxQuestionDraft {
  const problems = [...raw.problems];
  const stem = raw.stem.join("\n").trim();
  const explanation = raw.explanation.join("\n").trim();
  const answerRaw = raw.answer?.trim() ?? "";
  const optionEntries = [...raw.options.entries()].sort(([a], [b]) => a.localeCompare(b));
  const letterToId = new Map<string, string>(
    optionEntries.map(([letter], position) => [letter, `o${position + 1}`]),
  );
  const options: DocxOption[] = optionEntries.map(([, text], position) => ({
    optionId: `o${position + 1}`,
    text,
  }));

  if (stem === "") problems.push("题干为空");

  const boolean = answerRaw === "" ? null : asBoolean(answerRaw);
  let type: QuestionType | null = null;
  let answerPayload: unknown = null;
  let questionStem = stem;
  const fillBlanks: { blankId: string; accepted: string[] }[] = [];

  if (options.length >= 2) {
    if (boolean !== null) problems.push("这是选择题，但答案写成了对/错");
    const letters = answerRaw === "" ? [] : answerLetters(answerRaw);
    const ids = letters
      .map((letter) => letterToId.get(letter))
      .filter((id): id is string => id !== undefined);
    if (answerRaw === "") {
      problems.push("缺少答案");
    } else if (ids.length === 0) {
      problems.push(`答案「${answerRaw}」无法对应到选项 ${optionEntries.map(([l]) => l).join("/")}`);
    } else if (ids.length > 1) {
      type = "multiple_choice";
      answerPayload = ids;
    } else {
      type = "single_choice";
      answerPayload = ids[0];
    }
  } else if (boolean !== null) {
    type = "true_false";
    answerPayload = boolean;
  } else if (answerRaw !== "") {
    const marker = /_{3,}|（\s*）|\(\s*\)/g;
    const markerCount = (stem.match(marker) ?? []).length;
    if (markerCount > 0) {
      let counter = 0;
      questionStem = stem.replace(marker, () => `{{b${(counter += 1)}}}`);
      const accepted = answerRaw.split(/\s*[/／;；]\s*/).filter((part) => part !== "");
      fillBlanks.push(
        ...Array.from({ length: counter }, (_, i) => ({
          blankId: `b${i + 1}`,
          accepted: accepted.length > 0 ? accepted : [answerRaw],
        })),
      );
      type = "fill_blank";
      answerPayload = fillBlanks;
    } else {
      const points = answerRaw
        .split(/[;；\n]+/)
        .map((part) => part.trim())
        .filter((part) => part !== "");
      type = "short_answer";
      answerPayload = (points.length > 0 ? points : [answerRaw]).map((text, i) => ({
        pointId: `r${i + 1}`,
        text,
        score: 1,
      }));
    }
  } else {
    problems.push("缺少答案");
  }

  let question: Question | null = null;
  if (type !== null && problems.length === 0) {
    const base = {
      schemaVersion: SCHEMA_VERSION,
      questionId: emptyQuestionId(bankId, type, index),
      bankId,
      revision: computeRevision({ stem: questionStem, type, answer: answerPayload, explanation }),
      topicIds: [`${bankId}:topic:001`],
      stem: questionStem,
      legacyKeys: [],
      ...(explanation === "" ? {} : { explanation }),
    };

    const candidate =
      type === "single_choice"
        ? { ...base, type, options, answer: answerPayload }
        : type === "multiple_choice"
          ? { ...base, type, options, answer: answerPayload }
          : type === "true_false"
            ? { ...base, type, answer: answerPayload }
            : type === "fill_blank"
              ? { ...base, type, blanks: fillBlanks }
              : { ...base, type, rubric: answerPayload };

    const parsed = QuestionSchema.safeParse(candidate);
    if (parsed.success) question = parsed.data;
    else for (const issue of parsed.error.issues) problems.push(issue.message);
  }

  return {
    index,
    number: raw.number,
    stem: questionStem,
    options,
    answerLabel:
      boolean !== null
        ? boolean
          ? "正确"
          : "错误"
        : answerRaw === ""
          ? "（无）"
          : answerRaw,
    type,
    confidence: question !== null && problems.length === 0 ? "high" : "low",
    problems,
    question,
  };
}

/* ---------------------------------------------------------------- 讲义 */

function buildKnowledge(pre: readonly DocBlock[], bankId: string): KnowledgeModule[] {
  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;
  for (const block of pre) {
    const text = block.text.trim();
    if (text === "") continue;
    if (block.heading !== null) {
      if (current !== null && current.body.length > 0) sections.push(current);
      current = { title: text, body: [] };
      continue;
    }
    if (current !== null) {
      current.body.push(block.bold && text.length < 48 ? `**${text}**` : text);
    }
  }
  if (current !== null && current.body.length > 0) sections.push(current);
  if (sections.length === 0) return [];

  // 走一次契约解析，把 items / pitfalls / videos 等默认值补齐（不手写默认）
  return [
    KnowledgeModuleSchema.parse({
      moduleId: `${bankId}:kb:001`,
      topicId: `${bankId}:topic:001`,
      title: sections[0]?.title ?? "讲义",
      sections: sections.map((section) => ({
        title: section.title,
        body: section.body.join("\n\n"),
      })),
    }),
  ];
}

/* ------------------------------------------------------------------ 入口 */

function sanitizeBankId(fileName: string | undefined): string {
  const base = (fileName ?? "").replace(/\.[^.]+$/, "").toLowerCase();
  const cleaned = base.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.length > 0 && cleaned.length <= 40 ? cleaned : "docx_draft";
}

function titleOf(fileName: string | undefined, sectionTitle: string | null): string {
  const base = (fileName ?? "").replace(/\.[^.]+$/, "").trim();
  if (base !== "") return base;
  return sectionTitle ?? "Word 导入题库";
}

export function parseDocx(bytes: Uint8Array, options: ParseDocxOptions = {}): DocxDraft {
  const xml = readDocumentXml(bytes);
  const blocks = extractBlocks(xml);
  const { raws, pre } = collect(blocks);
  const bankId = sanitizeBankId(options.fileName);
  const questions = raws.map((raw, position) => normalize(raw, bankId, position + 1));
  const knowledge = buildKnowledge(pre, bankId);
  const tableRows = blocks.filter((block) => block.kind === "table").length;

  return {
    bankId,
    title: titleOf(options.fileName, knowledge[0]?.title ?? null),
    questions,
    knowledge,
    stats: {
      totalQuestions: questions.length,
      parsed: questions.filter((question) => question.question !== null).length,
      highConfidence: questions.filter((question) => question.confidence === "high").length,
      knowledgeSections: knowledge.reduce((sum, module) => sum + module.sections.length, 0),
      tableRows,
    },
  };
}

/** 只收勾选且识别成功的题；一题都没有时抛错，不允许"导入一个空库" */
export function buildBankFromDraft(
  draft: DocxDraft,
  indexes: readonly number[],
  now: string = new Date().toISOString(),
): BankContent {
  const accepted = new Set(indexes);
  const questions = draft.questions
    .filter((entry) => accepted.has(entry.index) && entry.question !== null)
    .map((entry) => entry.question as Question);
  if (questions.length === 0) {
    throw new Error("没有可导入的题目：请至少勾选一道识别成功的题");
  }
  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      bankId: draft.bankId,
      title: draft.title,
      questionCount: questions.length,
      topics: [
        {
          topicId: `${draft.bankId}:topic:001`,
          bankId: draft.bankId,
          name: draft.knowledge[0]?.title ?? "Word 导入",
          order: 0,
        },
      ],
      examTemplates: [],
      createdAt: now,
    },
    questions,
    knowledge: draft.knowledge,
  };
}

/** 草稿导出：与正式题库包同形，确认前可以先落盘、再导入 */
export function exportDraftJson(draft: DocxDraft, indexes: readonly number[]): string {
  const bank = buildBankFromDraft(draft, indexes);
  return JSON.stringify(
    { kind: BANK_FILE_KIND, manifest: bank.manifest, questions: bank.questions, knowledge: bank.knowledge },
    null,
    2,
  );
}
