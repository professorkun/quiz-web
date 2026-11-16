/**
 * 富文本**唯一**渲染入口（T2-8）。
 *
 * 业务代码一律只用这个组件；本文件是 `apps/web` 里唯一允许使用
 * `dangerouslySetInnerHTML` 的地方，由 `scripts/check-extension-point.mjs` 强制。
 * 传给它的 HTML 已经过 `richText.ts` 的 Markdown/高亮/公式 + DOMPurify 严格清洗。
 */

import { useMemo } from "react";

import { renderRichText } from "./renderRichText";

export interface RichTextProps {
  readonly text: string;
  readonly className?: string;
  /** 行内片段（填空题干、采分点）：不产生块级标签，可安全嵌在 <p>/<li> 里 */
  readonly inline?: boolean;
}

export function RichText(props: RichTextProps): React.ReactElement {
  const html = useMemo(
    () => renderRichText(props.text, { inline: props.inline }),
    [props.text, props.inline],
  );
  const className = ["rich-text", props.className].filter(Boolean).join(" ");
  const injected = { __html: html } as const;

  return props.inline === true ? (
    <span className={className} dangerouslySetInnerHTML={injected} />
  ) : (
    <div className={className} dangerouslySetInnerHTML={injected} />
  );
}
