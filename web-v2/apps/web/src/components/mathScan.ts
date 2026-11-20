/**
 * 公式扫描（P3 行内公式支持）。
 *
 * 原则：**先屏蔽、再配对**。不能用一个正则硬扫全文——题库里有
 * `${pageContext.request.contextPath}` 这类 JSP EL，也有代码块里的 `$a$`。
 * 屏蔽用等长占位（`\u0000`），偏移与原文一一对应，渲染时可直接按偏移还原。
 *
 * 支持：
 * - 行间 `$$...$$`
 * - 行内 `\(...\)`
 * - 行内 `$...$`（带守卫：不接 `{`/空白，结尾前非空白，结尾后不接数字）
 */

export interface MathSpan {
  /** 原文起点（含分隔符） */
  readonly start: number;
  /** 原文终点（不含） */
  readonly end: number;
  readonly tex: string;
  readonly displayMode: boolean;
}

export interface MathScan {
  readonly spans: readonly MathSpan[];
  readonly hasMath: boolean;
}

const FENCE = /```[\s\S]*?```|`[^`\n]*`/g;
const EL = /\$\{[^}\n]*\}/g;
const DISPLAY = /\$\$([\s\S]+?)\$\$/g;
const PAREN = /\\\(([\s\S]+?)\\\)/g;
/** `$` 后不接 `{` 或空白；内容无换行无 `$`；结尾前非空白、结尾后不接数字 */
const INLINE = /(?<!\\)\$(?!\{|\s)([^\n$]{1,200}?)(?<!\s)\$(?!\d)/g;

/** 把代码块 / 行内代码 / JSP EL 换成等长 NUL，保留偏移 */
export function maskMath(source: string): string {
  let masked = source;
  for (const pattern of [FENCE, EL]) {
    masked = masked.replace(pattern, (match) => "\u0000".repeat(match.length));
  }
  return masked;
}

function collect(
  source: string,
  masked: string,
  pattern: RegExp,
  displayMode: boolean,
  openLen: number,
  closeLen: number,
  out: MathSpan[],
): void {
  pattern.lastIndex = 0;
  let match = pattern.exec(masked);
  while (match !== null) {
    const tex = match[1];
    if (tex !== undefined && tex.trim() !== "") {
      out.push({
        start: match.index,
        end: match.index + match[0].length,
        // 内容从原文取：masked 只用于定位，不参与内容
        tex: source.slice(match.index + openLen, match.index + match[0].length - closeLen),
        displayMode,
      });
    }
    match = pattern.exec(masked);
  }
}

export function scanMath(source: string): MathScan {
  const masked = maskMath(source);
  const found: MathSpan[] = [];
  collect(source, masked, DISPLAY, true, 2, 2, found);
  collect(source, masked, PAREN, false, 2, 2, found);
  collect(source, masked, INLINE, false, 1, 1, found);

  // 先命中先占位：`$$...$$` 从 0 开始，优先于它内部可能被误判的行内公式
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const spans: MathSpan[] = [];
  let lastEnd = -1;
  for (const span of found) {
    if (span.start < lastEnd) continue;
    spans.push(span);
    lastEnd = span.end;
  }
  return { spans, hasMath: spans.length > 0 };
}
