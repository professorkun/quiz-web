/**
 * docx 导入子入口（V2.2 · T-08）。
 *
 * 单独出一个 `@quiz/data/docx` 子路径，是为了让 web 侧可以
 * `await import("@quiz/data/docx")`：fflate 与解析器只进独立 chunk，
 * 不抬高首屏主包（验收 A7 的 ≤5 KB 增幅）。
 */

export { parseDocx, buildBankFromDraft, exportDraftJson } from "./parse.js";
export type {
  DocxDraft,
  DocxDraftStats,
  DocxOption,
  DocxQuestionDraft,
  ParseDocxOptions,
} from "./parse.js";
