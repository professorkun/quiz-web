/**
 * 安全富文本渲染管线（T2-8），纯函数，可单测。
 *
 * 顺序：公式占位 → Markdown（含代码高亮）→ 还原公式 → **一次性** DOMPurify 清洗。
 * 所有来自题库的 HTML 都必须经过最后这一道清洗，业务代码不得自己注入 HTML。
 *
 * 公式约定：行间 `$$...$$`、内联 `\(...\)`。
 * **刻意不支持 `$...$`**：题库题干里有 `${pageContext.request.contextPath}` 这类
 * JSP EL 表达式，按 `$` 配对会把它们当成公式切碎。这是一条有真实依据的内容约定。
 */

import DOMPurifyFactory from "dompurify";
import hljs from "highlight.js";
import katex from "katex";
import { marked, Renderer } from "marked";

export interface RichTextRenderOptions {
  /** 只渲染行内内容（填空题干片段、采分点），不产生 <p>/<pre> 块 */
  readonly inline?: boolean;
  /** 注入 window，便于 Node/jsdom 测试；浏览器默认取全局 */
  readonly window?: Window;
}

interface PurifyLike {
  sanitize(dirty: string, config: Record<string, unknown>): string;
  addHook?: (
    name: string,
    cb: (node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) => void,
  ) => void;
}

const MATH_PREFIX = "QZMATH7f3a";
const MATH_SUFFIX = "TOKEN";
const MATH_PATTERN = new RegExp(`${MATH_PREFIX}(\\d+)${MATH_SUFFIX}`, "g");

/** 严格白名单：只允许排版类标签；脚本、事件属性、外链协议一律不给过 */
const PURIFY_CONFIG: Record<string, unknown> = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "b", "i", "u", "s", "del", "mark",
    "code", "pre", "span", "div", "ul", "ol", "li", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6", "hr", "sup", "sub",
    "table", "thead", "tbody", "tr", "th", "td", "a",
  ],
  ALLOWED_ATTR: ["class", "href", "title", "style", "aria-hidden", "aria-label", "role", "target", "rel"],
  FORBID_TAGS: [
    "script", "style", "iframe", "object", "embed", "form", "input",
    "textarea", "button", "svg", "math", "link", "meta", "base", "img",
  ],
  FORBID_ATTR: [
    "onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur",
    "onchange", "onsubmit", "srcdoc", "formaction",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  RETURN_TRUSTED_TYPE: false,
};

let cached: { win: Window; purify: PurifyLike } | undefined;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPurify(win: Window): PurifyLike {
  if (cached?.win === win) return cached.purify;
  // DOMPurify 3.x：浏览器里默认导出是已绑定实例，Node 里是工厂函数，两种都兼容
  const factory = DOMPurifyFactory as unknown as ((w: Window) => PurifyLike) | PurifyLike;
  const purify = typeof factory === "function" ? factory(win) : factory;
  // 第二道防线：即使 URI 白名单将来被放宽，属性值里出现 javascript:/expression()
  // 也直接丢掉整个属性（覆盖 style="background:url(javascript:...)" 这类变体）
  purify.addHook?.("uponSanitizeAttribute", (_node, data) => {
    if (/javascript\s*:|vbscript\s*:|expression\s*\(/i.test(data.attrValue)) {
      data.keepAttr = false;
    }
  });
  cached = { win, purify };
  return purify;
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      trust: false, // 禁止 \href、\includegraphics 等可注入 URL 的命令
      strict: false,
      output: "html",
    });
  } catch {
    return escapeHtml(tex);
  }
}

/** 先把公式换成占位符，避免 LaTeX 里的 `_`、`{` 被 Markdown 吃掉 */
function extractMath(source: string): { text: string; math: string[] } {
  const math: string[] = [];
  const token = (html: string): string => {
    const i = math.push(html) - 1;
    return `${MATH_PREFIX}${i}${MATH_SUFFIX}`;
  };
  let text = source.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) =>
    `\n\n${token(renderMath(tex, true))}\n\n`,
  );
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex: string) =>
    token(renderMath(tex, false)),
  );
  return { text, math };
}

function makeRenderer(): Renderer {
  const renderer = new Renderer();
  renderer.code = ({ text, lang }) => {
    const language = (lang ?? "").split(/\s+/)[0] ?? "";
    const highlighted =
      language !== "" && hljs.getLanguage(language) !== undefined
        ? hljs.highlight(text, { language, ignoreIllegals: true }).value
        : escapeHtml(text);
    return `<pre><code class="hljs language-${escapeHtml(language || "text")}">${highlighted}</code></pre>`;
  };
  return renderer;
}

const RENDERER = makeRenderer();

/**
 * 把题库文本渲染成**已清洗**的 HTML 字符串。
 * 没有 DOM 环境时降级为纯转义文本（宁可不渲染，也不能输出未清洗内容）。
 */
export function renderRichText(source: string, options: RichTextRenderOptions = {}): string {
  const win = options.window ?? (typeof window === "undefined" ? undefined : window);
  if (win === undefined) return escapeHtml(source);

  const { text, math } = extractMath(source);
  const markedOptions = { renderer: RENDERER, async: false as const, breaks: true, gfm: true };
  const parsed = options.inline === true
    ? marked.parseInline(text, markedOptions)
    : marked(text, markedOptions);
  const withMath = String(parsed).replace(
    MATH_PATTERN,
    (_m, index: string) => math[Number(index)] ?? "",
  );
  return getPurify(win).sanitize(withMath, PURIFY_CONFIG);
}
