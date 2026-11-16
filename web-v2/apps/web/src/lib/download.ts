/**
 * 文本文件下载。
 *
 * 不引文件库：一个 Blob + 一个临时 <a> 就够，而且它是唯一能保证
 * "导出的是我在内存里校验过的那份字符串"的做法（序列化与下载不分两步）。
 */

export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Safari 需要一帧之后才认这个 URL；立刻 revoke 会导致下载空文件
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function todayStamp(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
