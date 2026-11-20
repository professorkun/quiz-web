// @vitest-environment jsdom
/**
 * T2-8 验收：Markdown / 代码块 / KaTeX 正确渲染，且 XSS 注入用例不执行脚本。
 *
 * 判定不只看字符串，还把清洗后的 HTML 真正插进 DOM，检查没有脚本标签、
 * 没有 on* 事件属性、没有 javascript: 链接。
 */

import { describe, expect, it } from "vitest";

import { loadHighlighter } from "./highlighter";
import { loadKatex, makeMathRenderer } from "./math";
import { scanMath } from "./mathScan";
import { renderRichText } from "./renderRichText";

interface AttackCase {
  readonly id: string;
  readonly input: string;
  readonly forbidden: readonly RegExp[];
}

const ATTACKS: readonly AttackCase[] = [
  {
    id: "<script>",
    input: "题干 <script>alert(1)</script> 结束",
    forbidden: [/<script/i],
  },
  {
    id: "img onerror",
    input: '<img src=x onerror=alert(1)>',
    forbidden: [/onerror/i, /<img/i],
  },
  {
    id: "javascript: 链接",
    input: "[点我](javascript:alert(1))",
    forbidden: [/javascript\s*:/i, /onclick/i],
  },
  {
    id: "大小写混淆 javascript:",
    input: '<a href="JaVaScRiPt:alert(1)">链接</a>',
    forbidden: [/javascript\s*:/i],
  },
  {
    id: "svg onload",
    input: '<svg onload=alert(1)><g></g></svg>',
    forbidden: [/onload/i, /<svg/i],
  },
  {
    id: "iframe",
    input: '<iframe src="javascript:alert(1)"></iframe>',
    forbidden: [/<iframe/i, /javascript\s*:/i],
  },
  {
    id: "style 里的 javascript:",
    input: '<div style="background:url(javascript:alert(1))">文本</div>',
    forbidden: [/javascript\s*:/i],
  },
  {
    id: "事件属性 + 未知协议",
    input: '<p onclick="alert(1)" data-x="1">段落</p>',
    forbidden: [/onclick/i, /data-x/i],
  },
];

function assertSafeDom(html: string): void {
  const container = document.createElement("div");
  container.innerHTML = html;
  expect(container.querySelectorAll("script, iframe, object, embed, svg, img, form, input").length).toBe(0);
  for (const element of Array.from(container.querySelectorAll("*"))) {
    for (const attr of Array.from(element.attributes)) {
      expect(attr.name.toLowerCase()).not.toMatch(/^on/);
      if (attr.name.toLowerCase() === "href") {
        expect(attr.value).not.toMatch(/^\s*javascript\s*:/i);
      }
    }
  }
}

describe("安全富文本渲染", () => {
  it("8 类 XSS 注入用例：清洗后不含危险串，DOM 里没有可执行脚本", () => {
    for (const attack of ATTACKS) {
      const html = renderRichText(attack.input);
      for (const pattern of attack.forbidden) {
        expect(html, `${attack.id} 命中 ${String(pattern)}`).not.toMatch(pattern);
      }
      assertSafeDom(html);
    }
  });

  it("Markdown 正确渲染：粗体、列表、链接保留安全 href", () => {
    const html = renderRichText("**重点** 与 [文档](https://example.com/a)");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain('href="https://example.com/a"');
  });

  it("代码块高亮：注入高亮器后生成 code.hljs，且代码内容被转义", async () => {
    const highlight = await loadHighlighter();
    const html = renderRichText("```js\nconst x = \"<script>\";\n```", { highlight });
    expect(html).toContain("<pre>");
    expect(html).toContain('class="hljs');
    expect(html).not.toContain("<script>");
  });

  it("未注入高亮器时先输出纯文本代码（首帧，不阻塞）", () => {
    const html = renderRichText("```js\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("const x = 1;");
    expect(html).not.toContain('class="hljs');
  });

  it("LaTeX 正确渲染：注入 KaTeX 后内联与行间都出公式", async () => {
    const math = makeMathRenderer(await loadKatex());
    const inline = renderRichText("公式 \\(x^2\\) 结束", { inline: true, math });
    expect(inline).toContain("katex");
    const display = renderRichText("$$E=mc^2$$", { math });
    expect(display).toContain("katex-display");
  });

  it("未注入 KaTeX 时公式原样输出（首帧契约，不丢内容）", () => {
    const html = renderRichText("公式 \\(x^2\\) 结束", { inline: true });
    expect(html).toContain("x^2");
    expect(html).not.toContain("katex");
  });

  it("不误伤 JSP EL 表达式 ${...}：按内容约定只认 \\(...\\) 与 $$...$$", () => {
    const html = renderRichText("路径 ${pageContext.request.contextPath} 结束", { inline: true });
    expect(html).toContain("${pageContext.request.contextPath}");
    expect(html).not.toContain("katex");
  });

  it("行内 $x^2$：注入 KaTeX 后渲染公式", async () => {
    const math = makeMathRenderer(await loadKatex());
    const html = renderRichText("由 $x^2$ 可得", { inline: true, math });
    expect(html).toContain("katex");
    expect(scanMath("由 $x^2$ 可得").hasMath).toBe(true);
  });

  it("${pageContext.request.contextPath}：原样输出，且不触发 KaTeX 加载", () => {
    const source = "路径 ${pageContext.request.contextPath} 结束";
    expect(scanMath(source).hasMath).toBe(false);
    const html = renderRichText(source, { inline: true });
    expect(html).toContain("${pageContext.request.contextPath}");
    expect(html).not.toContain("katex");
  });

  it("$5 and $10：结尾 $ 前是空格，守卫拦下，不当公式", () => {
    const source = "价格 $5 and $10";
    expect(scanMath(source).hasMath).toBe(false);
    const html = renderRichText(source, { inline: true });
    expect(html).toContain("$5 and $10");
    expect(html).not.toContain("katex");
  });

  it("$$E=mc^2$$：仍按块级公式渲染", async () => {
    const math = makeMathRenderer(await loadKatex());
    const html = renderRichText("$$E=mc^2$$", { math });
    expect(html).toContain("katex-display");
    expect(scanMath("$$E=mc^2$$").spans[0]?.displayMode).toBe(true);
  });

  it("$a+b$：无空格行内公式仍渲染", async () => {
    const math = makeMathRenderer(await loadKatex());
    const html = renderRichText("$a+b$", { inline: true, math });
    expect(html).toContain("katex");
  });

  it("反引号代码里的 $a$ 不渲染，也不触发加载", () => {
    const inlineCode = "执行 `$a$` 即可";
    expect(scanMath(inlineCode).hasMath).toBe(false);
    expect(renderRichText(inlineCode, { inline: true })).not.toContain("katex");

    const fenced = "```\nconst s = \"$a$\";\n```";
    expect(scanMath(fenced).hasMath).toBe(false);
    expect(renderRichText(fenced)).not.toContain("katex");
  });

  it("inline 模式不产生块级标签，可安全嵌在题干片段里", () => {
    const html = renderRichText("**加粗** 片段", { inline: true });
    expect(html).not.toMatch(/<(p|pre|div)\b/i);
    expect(html).toContain("<strong>");
  });

  it("空串与纯文本输入不产生异常", () => {
    expect(renderRichText("", { inline: true })).toBe("");
    expect(renderRichText("普通题干", { inline: true })).toContain("普通题干");
  });
});
