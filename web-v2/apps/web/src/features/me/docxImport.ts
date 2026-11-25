/**
 * Word 文件入口（V2.2 · T-08）。
 *
 * `@quiz/data/docx` 一律**动态 import**：解析器与 fflate 只进独立 chunk，
 * 不进首屏主包（验收 A7 的主包 ≤5 KB 增幅）。
 */

import type { BankContent } from "@quiz/core";
import type { DocxDraft } from "@quiz/data/docx";

const WORKER_TIMEOUT_MS = 20_000;

async function parseInline(bytes: Uint8Array, fileName: string): Promise<DocxDraft> {
  const mod = await import("@quiz/data/docx");
  return mod.parseDocx(bytes, { fileName });
}

function parseInWorker(bytes: Uint8Array, fileName: string): Promise<DocxDraft> {
  return new Promise<DocxDraft>((resolve, reject) => {
    const worker = new Worker(new URL("./docxWorker.ts", import.meta.url), { type: "module" });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("Word 解析超时：文档可能过大，请拆分后重试"));
    }, WORKER_TIMEOUT_MS);

    const finish = (): void => {
      clearTimeout(timer);
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<{ ok: boolean; draft?: DocxDraft; error?: string }>) => {
      finish();
      if (event.data.ok && event.data.draft !== undefined) resolve(event.data.draft);
      else reject(new Error(event.data.error ?? "Word 解析失败"));
    };
    worker.onerror = () => {
      finish();
      reject(new Error("Word 解析线程异常"));
    };

    // 不 transfer：Worker 失败时要能退回主线程再解析一次
    worker.postMessage({ bytes: bytes.buffer, fileName });
  });
}

/** 优先 Worker；环境不支持（或线程起不来）时退回主线程，功能不降级 */
export async function parseDocxFile(file: File): Promise<DocxDraft> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (typeof Worker === "undefined") return parseInline(bytes, file.name);
  try {
    return await parseInWorker(bytes, file.name);
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Word 解析超时")) throw cause;
    return parseInline(bytes, file.name);
  }
}

export async function buildDocxBank(
  draft: DocxDraft,
  indexes: readonly number[],
): Promise<BankContent> {
  const mod = await import("@quiz/data/docx");
  return mod.buildBankFromDraft(draft, indexes);
}

export async function docxDraftJson(
  draft: DocxDraft,
  indexes: readonly number[],
): Promise<string> {
  const mod = await import("@quiz/data/docx");
  return mod.exportDraftJson(draft, indexes);
}
