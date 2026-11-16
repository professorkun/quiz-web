/**
 * 代码填空结构解析（T2-4）。
 *
 * 真实题库有两个坑，决定了这里不能按「出现顺序」编号：
 * 1. 同一 blankId 会在代码里出现多次（一个答案填多处）：5 题共 89 个定义空位、97 处标记；
 * 2. 代码里的出现顺序与 q.blanks 定义顺序并不总一致（如 2-7/2-8 互换、5-18 前置）。
 *
 * 因此：**身份永远取 blankId，顺序永远取 q.blanks 定义顺序**；
 * 代码文本只做「切成 code / blank 段」，不排序、不去重、不重排文件。
 * 放在 `core` 是为了让渲染层拿不到"重新编号"的机会（S2 §8 风险条目）。
 */

import type { Question } from "../../schema.js";

export type CodeBlankQuestion = Extract<Question, { type: "code_blank" }>;

export interface CodeSegment {
  readonly kind: "code" | "blank";
  readonly fileId: string;
  /** 文件内段序号，只用于 React key；**不是**答案身份 */
  readonly index: number;
  readonly text?: string;
  readonly blankId?: string;
}

export interface CodeFileView {
  readonly fileId: string;
  readonly label: string;
  readonly language: string;
  readonly code: string;
  readonly solutionCode?: string;
  readonly segments: readonly CodeSegment[];
}

export interface CodeStructure {
  readonly files: readonly CodeFileView[];
  /** 按 q.blanks 定义顺序，稳定且唯一：判分、输入列表、会话都只认这个 */
  readonly blankIdsInOrder: readonly string[];
  /** 标记在代码中出现的总次数（可大于唯一空位数） */
  readonly slotCount: number;
  readonly uniqueBlankCount: number;
}

export interface CodeStructureIssue {
  readonly code: "MISSING_MARKER" | "UNDEFINED_BLANK" | "FILE_MISMATCH";
  readonly message: string;
  readonly blankId?: string;
  readonly fileId?: string;
}

const MARKER = /___\(([^)]+)\)___/g;

export function buildCodeStructure(question: CodeBlankQuestion): CodeStructure {
  let slotCount = 0;
  const files: CodeFileView[] = question.files.map((file) => {
    const segments: CodeSegment[] = [];
    let last = 0;
    let index = 0;
    for (const match of file.code.matchAll(MARKER)) {
      const at = match.index ?? 0;
      if (at > last) {
        segments.push({
          kind: "code",
          fileId: file.fileId,
          index: index++,
          text: file.code.slice(last, at),
        });
      }
      segments.push({
        kind: "blank",
        fileId: file.fileId,
        index: index++,
        blankId: match[1] ?? "",
      });
      slotCount += 1;
      last = at + match[0].length;
    }
    if (last < file.code.length) {
      segments.push({
        kind: "code",
        fileId: file.fileId,
        index: index++,
        text: file.code.slice(last),
      });
    }
    return {
      fileId: file.fileId,
      label: file.label,
      language: file.language,
      code: file.code,
      solutionCode: file.solutionCode,
      segments,
    };
  });

  return {
    files,
    blankIdsInOrder: question.blanks.map((b) => b.blankId),
    slotCount,
    uniqueBlankCount: question.blanks.length,
  };
}

/** 结构对账：定义与标记一一可定位，且 fileId 一致。供导入校验与 89 空位对账脚本使用 */
export function checkCodeBlankStructure(
  question: CodeBlankQuestion,
): readonly CodeStructureIssue[] {
  const issues: CodeStructureIssue[] = [];
  const defined = new Map(question.blanks.map((b) => [b.blankId, b.fileId]));
  const seen = new Map<string, string>();

  for (const file of question.files) {
    for (const match of file.code.matchAll(MARKER)) {
      const blankId = match[1] ?? "";
      const expectedFile = defined.get(blankId);
      if (expectedFile === undefined) {
        issues.push({
          code: "UNDEFINED_BLANK",
          message: `文件 ${file.fileId} 中的空位 ${blankId} 没有对应答案`,
          blankId,
          fileId: file.fileId,
        });
        continue;
      }
      if (expectedFile !== file.fileId) {
        issues.push({
          code: "FILE_MISMATCH",
          message: `空位 ${blankId} 定义在 ${expectedFile}，却出现在 ${file.fileId}`,
          blankId,
          fileId: file.fileId,
        });
      }
      seen.set(blankId, file.fileId);
    }
  }

  for (const b of question.blanks) {
    if (!seen.has(b.blankId)) {
      issues.push({
        code: "MISSING_MARKER",
        message: `空位 ${b.blankId} 在代码中找不到标记 ___(${b.blankId})___`,
        blankId: b.blankId,
        fileId: b.fileId,
      });
    }
  }
  return issues;
}

/** 按 blankId 汇总每个空位的对错明细，供渲染层定位到具体空位 */
export function blankDetailMap(
  details: readonly { readonly key: string; readonly correct: boolean | null }[] | undefined,
): ReadonlyMap<string, boolean | null> {
  return new Map((details ?? []).map((d) => [d.key, d.correct]));
}
