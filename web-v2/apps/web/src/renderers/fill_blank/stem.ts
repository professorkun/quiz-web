/** 把 `{{blankId}}` 占位符切成「文本 / 空位」片段，不做任何重排（S2 §8 风险：空位结构丢失） */
export type StemPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "blank"; readonly blankId: string };

export function splitStem(stem: string): readonly StemPart[] {
  const parts: StemPart[] = [];
  const pattern = /\{\{([^{}]+)\}\}/g;
  let last = 0;
  for (const match of stem.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ kind: "text", text: stem.slice(last, at) });
    parts.push({ kind: "blank", blankId: match[1] ?? "" });
    last = at + match[0].length;
  }
  if (last < stem.length) parts.push({ kind: "text", text: stem.slice(last) });
  return parts;
}
