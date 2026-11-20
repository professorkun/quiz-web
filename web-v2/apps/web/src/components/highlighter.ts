/**
 * 代码高亮懒加载（P3 体积治理）。
 *
 * core + 6 种语言按需动态引入；没有代码块的题目永远不下载高亮器。
 * 与公式一样走两帧：先纯文本，拿到高亮器后重渲染。
 */

export type Highlighter = (code: string, language: string) => string | null;

let pending: Promise<Highlighter> | null = null;

export function loadHighlighter(): Promise<Highlighter> {
  pending ??= (async () => {
    // 主题样式随高亮器一起到达，首屏不为「没有代码块」的页面加载它
    void import("highlight.js/styles/github.css").catch(() => undefined);
    const [core, java, xml, sql, json, javascript, css] = await Promise.all([
      import("highlight.js/lib/core"),
      import("highlight.js/lib/languages/java"),
      import("highlight.js/lib/languages/xml"),
      import("highlight.js/lib/languages/sql"),
      import("highlight.js/lib/languages/json"),
      import("highlight.js/lib/languages/javascript"),
      import("highlight.js/lib/languages/css"),
    ]);
    const hljs = core.default;
    // 题库实际只用到 java/xml(jsp/html)/sql/json/js/css；全量引入约 800KB
    hljs.registerLanguage("java", java.default);
    hljs.registerLanguage("xml", xml.default);
    hljs.registerLanguage("html", xml.default);
    hljs.registerLanguage("jsp", xml.default);
    hljs.registerLanguage("sql", sql.default);
    hljs.registerLanguage("json", json.default);
    hljs.registerLanguage("javascript", javascript.default);
    hljs.registerLanguage("css", css.default);

    return (code, language) => {
      const lang = language.split(/\s+/)[0] ?? "";
      if (lang === "" || hljs.getLanguage(lang) === undefined) return null;
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    };
  })();
  return pending;
}
