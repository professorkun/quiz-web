/**
 * KaTeX 懒加载（P3 体积治理）。
 *
 * 公式不是每道题都有，但 KaTeX 约 76 KB gzip——首屏不带它。
 * RichText 首帧按原文渲染，`loadKatex()` 完成后重渲染一次（两帧）。
 */

export type MathRenderer = (tex: string, displayMode: boolean) => string | null;

let pending: Promise<typeof import("katex")> | null = null;

export function loadKatex(): Promise<typeof import("katex")> {
  // 样式与 JS 一起懒加载：公式没出现时，KaTeX 的字体与规则不参与首屏渲染
  pending ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(
    ([module]) => module,
  );
  return pending;
}

export function makeMathRenderer(katexModule: typeof import("katex")): MathRenderer {
  const katex = katexModule.default;
  return (tex, displayMode) => {
    try {
      return katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        trust: false, // 禁止 \href、\includegraphics 等可注入 URL 的命令
        strict: false,
        output: "html",
      });
    } catch {
      return null;
    }
  };
}
