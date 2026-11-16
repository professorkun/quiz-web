/**
 * 填空归一化规则表与匹配（T2-3）。
 *
 * 设计原则（方案 §8）：**规则清单化 + 用例固化，不接受"再放宽一点"式修补**。
 * 旧版 `blankOk()` 有一条 `nb.indexOf(nu) >= 0 && nu.length >= 2` 的包含式宽松匹配，
 * 会把 "ervlet" 判成 "Servlet" 的正确写法；同时 `norm()` 不处理全角字母，
 * 又把 "Ｓｅｒｖｌｅｔ" 判成错。两头都误判。
 *
 * 本实现只做「精确等价」，所有等价变换都在 `NORMALIZE_RULES` 里列清楚，
 * 规则编号 N1–N8 与 `docs/reports/t2-3-normalization-rules.md` 一一对应。
 */

export interface NormalizeRule {
  readonly id: string;
  readonly description: string;
  readonly apply: (input: string) => string;
}

/** N1：全角 ASCII（U+FF01–FF5E）与全角空格 → 半角 */
function foldFullwidth(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

export const NORMALIZE_RULES: readonly NormalizeRule[] = [
  { id: "N1", description: "全角 ASCII / 全角空格 → 半角", apply: foldFullwidth },
  { id: "N2", description: "大小写折叠", apply: (s) => s.toLowerCase() },
  { id: "N3", description: "去除所有空白", apply: (s) => s.replace(/[\s\u3000]/g, "") },
  { id: "N4", description: "去除中英文引号与反引号", apply: (s) => s.replace(/[`"'“”‘’]/g, "") },
  {
    id: "N5",
    description: "中文标点折叠：；→; ，、→,",
    apply: (s) => s.replace(/；/g, ";").replace(/[，、]/g, ","),
  },
  {
    id: "N6",
    description: "自闭合标签等价：<x/> ≡ <x>（旧版真实缺陷修复，保留）",
    apply: (s) => s.replace(/\/>/g, ">"),
  },
  { id: "N7", description: "去除尾部句号／点号", apply: (s) => s.replace(/[。.]+$/g, "") },
];

/**
 * N8：多答案分隔。
 *
 * 只用 `|` / `｜` 分隔 `accepted` 中的多个等价写法。
 * **不按 `/`、`;`、`,` 拆**——题库答案里 `<jsp:include page="" />`、
 * `<url-pattern>/x</url-pattern>`、`Class.forName()` 都含这些字符，
 * 自动拆分会把合法代码答案拆碎（这正是"放宽一点"式修补最容易踩的坑）。
 * 多答案的首选承载方式是 S1 契约里的 `accepted` 数组本身。
 */
export const ACCEPTED_SEPARATOR = /[|｜]/;

export function splitAccepted(raw: string): readonly string[] {
  return raw
    .split(ACCEPTED_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 按规则清单归一化；规则顺序即执行顺序，不允许调用方插入临时特判 */
export function normalizeAnswer(input: unknown): string {
  let value = String(input ?? "");
  for (const rule of NORMALIZE_RULES) {
    value = rule.apply(value);
  }
  return value;
}

/**
 * 与某个空的 accepted 列表比对。
 * - 空输入永不判对
 * - 只做精确等价，**没有包含式匹配**
 * - 每个 accepted 写法可再用 `|` 拆成多个等价变体
 */
export function matchesAccepted(given: unknown, accepted: readonly string[]): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  return accepted.some((raw) =>
    splitAccepted(String(raw ?? "")).some((variant) => normalizeAnswer(variant) === g),
  );
}

/** 作答可以是 `{ blankId: 文本 }`，也可能被误传成数组/字符串，统一收敛 */
export function asAnswerRecord(answer: unknown): Record<string, unknown> {
  return answer !== null && typeof answer === "object" && !Array.isArray(answer)
    ? (answer as Record<string, unknown>)
    : {};
}
