/**
 * 富文本**唯一**渲染入口（T2-8 / P3 体积治理）。
 *
 * 业务代码一律只用这个组件；本文件是 `apps/web` 里唯一允许使用
 * `dangerouslySetInnerHTML` 的地方，由 `scripts/check-extension-point.mjs` 强制。
 *
 * 首帧只渲染 Markdown 与纯文本：KaTeX / highlight.js 都是动态 import，
 * 检测到公式或代码块才加载，加载完成后重渲染一次（两帧），首屏不背这两个大包。
 */

import { useEffect, useMemo, useState } from "react";

import { loadHighlighter, type Highlighter } from "./highlighter";
import { loadKatex, makeMathRenderer, type MathRenderer } from "./math";
import { scanMath } from "./mathScan";
import { renderRichText } from "./renderRichText";

export interface RichTextProps {
  readonly text: string;
  readonly className?: string;
  /** 行内片段（填空题干、采分点）：不产生块级标签，可安全嵌在 <p>/<li> 里 */
  readonly inline?: boolean;
}

const CODE_PATTERN = /```/;

export function RichText(props: RichTextProps): React.ReactElement {
  // 与 renderRichText 共用 scanMath：JSP EL、代码块里的 $ 不会触发 77 KB 下载
  const needsMath = useMemo(() => scanMath(props.text).hasMath, [props.text]);
  const needsCode = useMemo(() => CODE_PATTERN.test(props.text), [props.text]);

  const [math, setMath] = useState<MathRenderer | null>(null);
  const [highlight, setHighlight] = useState<Highlighter | null>(null);

  useEffect(() => {
    if (!needsMath) return;
    let cancelled = false;
    void loadKatex()
      .then((module) => {
        if (!cancelled) setMath(() => makeMathRenderer(module));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needsMath]);

  useEffect(() => {
    if (!needsCode) return;
    let cancelled = false;
    void loadHighlighter()
      .then((renderer) => {
        if (!cancelled) setHighlight(() => renderer);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needsCode]);

  const html = useMemo(
    () =>
      renderRichText(props.text, {
        inline: props.inline,
        ...(math === null ? {} : { math }),
        ...(highlight === null ? {} : { highlight }),
      }),
    [props.text, props.inline, math, highlight],
  );

  const className = ["rich-text", props.className].filter(Boolean).join(" ");
  const injected = { __html: html } as const;
  // 等公式到位时先按原文占高，避免替换瞬间跳版（CLS）
  const pending = needsMath && math === null ? { "data-math": "pending" } : {};

  return props.inline === true ? (
    <span className={className} {...pending} dangerouslySetInnerHTML={injected} />
  ) : (
    <div className={className} {...pending} dangerouslySetInnerHTML={injected} />
  );
}
