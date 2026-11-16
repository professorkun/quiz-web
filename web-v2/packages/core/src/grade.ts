/**
 * 判分器雏形（T1-8 / S2 的基础）。
 *
 * 为什么现在就写：旧版的判分逻辑埋在 `template.html` 的事件处理里，
 * 无法单测、无法跨端复用。这里把「判定」抽成纯函数，页面只负责收集答案。
 *
 * 兼容旧版的容错口径（`norm()`）：忽略大小写、空白、引号、全角标点，
 * 以及 `<x/>` 与 `<x>` 的等价写法。这条规则来自旧版的真实缺陷修复，
 * 不是随手加的——填空答案常常是标签或代码，学习者写法差异很大。
 */

import type { Question } from "./schema.js";

export interface GradeResult {
  /** `null` 表示无法自动判定（主观题），必须由人自评 */
  readonly correct: boolean | null;
  readonly score: number;
  readonly maxScore: number;
}

export function normalizeAnswer(input: unknown): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .replace(/[`"'“”‘’]/g, "")
    .replace(/；/g, ";")
    .replace(/，/g, ",")
    .replace(/、/g, ",")
    .replace(/\/>/g, ">")
    .replace(/[。.]$/g, "");
}

function matchesAny(given: unknown, accepted: readonly string[]): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  return accepted.some((a) => normalizeAnswer(a) === g);
}

function asRecord(answer: unknown): Record<string, unknown> {
  return answer && typeof answer === "object" && !Array.isArray(answer)
    ? (answer as Record<string, unknown>)
    : {};
}

/**
 * @param maxScore 该题的满分；不给则按 1 分计（是否相等仍由 correct 表达）
 */
export function gradeQuestion(q: Question, answer: unknown, maxScore = 1): GradeResult {
  switch (q.type) {
    case "single_choice": {
      const correct = answer === q.answer;
      return { correct, score: correct ? maxScore : 0, maxScore };
    }
    case "multiple_choice": {
      const given = Array.isArray(answer) ? [...new Set(answer.map(String))].sort() : [];
      const want = [...new Set(q.answer)].sort();
      const correct = given.length === want.length && given.every((v, i) => v === want[i]);
      // 多选全对才给分：旧版也是这个口径，不做部分给分，避免与卷面分值模型冲突
      return { correct, score: correct ? maxScore : 0, maxScore };
    }
    case "true_false": {
      const correct = answer === q.answer;
      return { correct, score: correct ? maxScore : 0, maxScore };
    }
    case "fill_blank": {
      const given = asRecord(answer);
      let hit = 0;
      for (const blank of q.blanks) {
        if (matchesAny(given[blank.blankId], blank.accepted)) hit += 1;
      }
      const correct = hit === q.blanks.length;
      // 填空按空计分：旧版「1 空 1 分」，这里交给调用方传 maxScore 后按比例分
      const score = q.blanks.length === 0 ? 0 : (maxScore * hit) / q.blanks.length;
      return { correct, score, maxScore };
    }
    case "code_blank": {
      const given = asRecord(answer);
      let hit = 0;
      for (const blank of q.blanks) {
        if (matchesAny(given[blank.blankId], blank.accepted)) hit += 1;
      }
      const correct = hit === q.blanks.length;
      const score = q.blanks.length === 0 ? 0 : (maxScore * hit) / q.blanks.length;
      return { correct, score, maxScore };
    }
    case "short_answer":
      return { correct: null, score: 0, maxScore };
  }
}
