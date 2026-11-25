/**
 * Word 解析 Worker（V2.2 · T-08）。
 *
 * 解析（解压 + XML 扫描）全部在这里跑，主线程只收结果——
 * 这是验收 A7「解析不阻塞主线程」的落地方式。
 * 解析器本身不依赖 DOM，所以能在 Worker 里用。
 */

import { parseDocx } from "@quiz/data/docx";

interface ParseRequest {
  readonly bytes: ArrayBuffer;
  readonly fileName: string;
}

type ParseResponse =
  | { readonly ok: true; readonly draft: unknown }
  | { readonly ok: false; readonly error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null;
  postMessage: (message: ParseResponse) => void;
};

scope.onmessage = (event) => {
  try {
    const draft = parseDocx(new Uint8Array(event.data.bytes), { fileName: event.data.fileName });
    scope.postMessage({ ok: true, draft });
  } catch (cause) {
    scope.postMessage({
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
};
