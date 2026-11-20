/**
 * docx → 文本块（V2.2 · R1.3 / T-08）。
 *
 * 为什么不用 DOMParser：解析要放进 Worker（验收 A7：不阻塞主线程），
 * 而 `DOMParser` 并不在 Worker 全局作用域里。所以这里用一个**只认
 * WordprocessingML 子集**的轻量扫描器：段落 / 表格 / 样式 / 加粗 / 换行。
 *
 * 只做「按文档顺序摊平」，切题规则不在这里（`parse.ts` 负责）。
 */

export interface DocBlock {
  readonly kind: "paragraph" | "table";
  readonly text: string;
  /** 段落样式 ID（如 Heading1 / 1）；表格行为 null */
  readonly style: string | null;
  /** 标题层级：1/2/3…；正文为 null */
  readonly heading: number | null;
  readonly bold: boolean;
  /** 表格行才有的单元格文本 */
  readonly cells?: readonly string[];
}

interface ParagraphState {
  text: string;
  style: string | null;
  outline: number | null;
  bold: boolean;
}

interface TableState {
  rows: string[][];
  row: string[] | null;
  cell: string[] | null;
}

interface ScopeState {
  table: TableState | null;
  captured: string | null;
}

const TAG = /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;

function localName(tag: string): string {
  const index = tag.lastIndexOf(":");
  return (index === -1 ? tag : tag.slice(index + 1)).toLowerCase();
}

function attrVal(attrs: string): string | null {
  const match = /(?:^|\s)(?:[\w.-]+:)?val\s*=\s*"([^"]*)"/i.exec(attrs);
  return match?.[1] ?? null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&");
}

/**
 * 标题层级识别：中文模板常用样式 ID `1`~`9`，英文模板用 `Heading1`；
 * 还有的只给 `outlineLvl`（0 起）。
 */
function headingLevel(styleId: string | null, outline: number | null): number | null {
  if (styleId !== null) {
    const normalized = styleId.trim().toLowerCase();
    const match = /^(?:heading|标题)\s*([1-9])$/.exec(normalized);
    if (match?.[1] !== undefined) return Number(match[1]);
    if (/^[1-9]$/.test(normalized)) return Number(normalized);
  }
  if (outline !== null && Number.isFinite(outline) && outline >= 0 && outline <= 8) {
    return outline + 1;
  }
  return null;
}

function paragraphBlock(paragraph: ParagraphState): DocBlock {
  return {
    kind: "paragraph",
    text: paragraph.text.replace(/\t+$/g, "").trim(),
    style: paragraph.style,
    heading: headingLevel(paragraph.style, paragraph.outline),
    bold: paragraph.bold,
  };
}

export function extractBlocks(xml: string): DocBlock[] {
  const source = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const blocks: DocBlock[] = [];
  const scope: ScopeState = { table: null, captured: null };

  let paragraph: ParagraphState | null = null;
  let cellParagraphs: string[] | null = null;

  const appendText = (text: string): void => {
    if (paragraph !== null) paragraph.text += text;
  };

  TAG.lastIndex = 0;
  let match = TAG.exec(source);
  while (match !== null) {
    const [, closing, tagName, attrs = "", selfClosing, textNode] = match;
    if (textNode !== undefined) {
      if (scope.captured !== null) scope.captured += decodeEntities(textNode);
    } else if (tagName !== undefined) {
      const local = localName(tagName);
      const isClosing = closing === "/";
      const isSelfClosing = selfClosing === "/";

      if (isClosing) {
        if (local === "t") {
          if (scope.captured !== null) {
            appendText(scope.captured);
            scope.captured = null;
          }
        } else if (local === "p") {
          if (paragraph !== null) {
            if (cellParagraphs !== null) {
              const text = paragraph.text.trim();
              if (text !== "") cellParagraphs.push(text);
            } else {
              blocks.push(paragraphBlock(paragraph));
            }
            paragraph = null;
          }
        } else if (local === "tc") {
          if (scope.table !== null && scope.table.row !== null) {
            const text = (cellParagraphs ?? []).join(" ").trim();
            scope.table.row.push(text);
          }
          cellParagraphs = null;
        } else if (local === "tr") {
          if (scope.table !== null && scope.table.row !== null) {
            scope.table.rows.push(scope.table.row);
            scope.table.row = null;
          }
        } else if (local === "tbl") {
          if (scope.table !== null) {
            for (const cells of scope.table.rows) {
              blocks.push({
                kind: "table",
                text: cells.filter((cell) => cell !== "").join(" ｜ "),
                style: null,
                heading: null,
                bold: false,
                cells,
              });
            }
            scope.table = null;
          }
        }
      } else if (local === "p") {
        paragraph = { text: "", style: null, outline: null, bold: false };
        if (isSelfClosing) {
          if (cellParagraphs === null) blocks.push(paragraphBlock(paragraph));
          paragraph = null;
        }
      } else if (paragraph !== null) {
        if (local === "pstyle") {
          paragraph.style = attrVal(attrs);
        } else if (local === "outlinelvl") {
          const value = attrVal(attrs);
          const parsed = value === null ? Number.NaN : Number(value);
          paragraph.outline = Number.isNaN(parsed) ? null : parsed;
        } else if (local === "b") {
          const value = attrVal(attrs);
          paragraph.bold = value === null || !["0", "false", "off"].includes(value.toLowerCase());
        } else if (local === "t") {
          scope.captured = "";
        } else if (local === "tab") {
          appendText("\t");
        } else if (local === "br" || local === "cr") {
          appendText("\n");
        }
      }

      if (local === "tbl" && !isClosing && scope.table === null) {
        scope.table = { rows: [], row: null, cell: null };
      } else if (local === "tr" && !isClosing && scope.table !== null) {
        scope.table.row = [];
      } else if (local === "tc" && !isClosing && scope.table !== null) {
        scope.table.cell = [];
        cellParagraphs = [];
      }

      if (isSelfClosing && local === "t") {
        // `<w:t/>` 空文本
        scope.captured = null;
      }
    }
    match = TAG.exec(source);
  }

  return blocks;
}
