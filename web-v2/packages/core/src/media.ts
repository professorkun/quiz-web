/**
 * 讲义视频源解析（S7-E8）：纯函数，Node 里可测，不碰 DOM 与网络。
 *
 * 为什么要把「一个 URL 字符串」解析成结构：讲义是内容，播放器是 UI。
 * 如果让播放器自己 `if (url.includes("bilibili"))`，那么每加一个站点就要改组件，
 * 而且这类判断没法单测。这里把判断收进 core，UI 只按 `kind` 分支渲染。
 *
 * 安全底线：`javascript:` / `data:` / `vbscript:` 一律判为非法，
 * 不因为"内容是我们自己写的"就放宽——题库支持用户导入，内容不总是可信的。
 */

export type MediaKind =
  /** 可直接用原生 `<video>` 播的文件（mp4/webm/ogv/m4v/mov） */
  | "file"
  /** HLS 播放列表（Chrome/Firefox 需 hls.js，Safari 原生支持） */
  | "hls"
  /** B 站：站外播放器 iframe 可嵌，需联网 */
  | "bilibili"
  /** YouTube：nocookie 域名嵌入，需联网 */
  | "youtube"
  /** 普通网页：不内嵌，只给"去原站看" */
  | "page"
  /** 空串、非法协议、认不出来的东西 */
  | "invalid";

export interface MediaSource {
  readonly kind: MediaKind;
  /** 站点/形态的中文名，用于按钮与提示文案 */
  readonly provider: string;
  /** 规范化后的"去原站看"地址；invalid 时为 null */
  readonly watchUrl: string | null;
  /** 内嵌播放地址；`page` 与 `invalid` 为 null */
  readonly embedUrl: string | null;
  /** 解析出的标识：BV 号 / av 号 / YouTube id / HLS 地址 */
  readonly id: string | null;
  /** 是否可用原生 `<video>`：只有 file 为 true，hls 由组件再判浏览器能力 */
  readonly nativeVideo: boolean;
  /** 是否必须联网才能播：相对路径的本地文件为 false */
  readonly needsNetwork: boolean;
  /** 判为 invalid 时的原因，UI 直接展示，不要让用户猜 */
  readonly reason: string | null;
}

const FILE_EXTENSIONS = ["mp4", "webm", "ogv", "ogg", "m4v", "mov"] as const;
const BV_PATTERN = /BV[0-9A-Za-z]{10}/;
const AV_PATTERN = /\bav(\d{1,12})\b/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function invalid(reason: string): MediaSource {
  return {
    kind: "invalid",
    provider: "无法识别",
    watchUrl: null,
    embedUrl: null,
    id: null,
    nativeVideo: false,
    needsNetwork: false,
    reason,
  };
}

function hasUnsafeScheme(raw: string): boolean {
  return /^\s*(javascript|data|vbscript|file)\s*:/i.test(raw);
}

/** 取扩展名（忽略 query 与 hash），统一小写 */
function extensionOf(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0] ?? "";
  const dot = clean.lastIndexOf(".");
  return dot < 0 ? "" : clean.slice(dot + 1).toLowerCase();
}

function isAbsoluteHttp(raw: string): boolean {
  return /^https?:\/\//i.test(raw);
}

/** 相对路径（`./media/a.mp4`、`media/a.mp4`、`/media/a.mp4`）视为随包分发的本地文件 */
function isRelativePath(raw: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(raw);
}

/**
 * 不依赖 `URL`：`core` 的 tsconfig 刻意不引 DOM / Node 类型（ADR-0002 的"平台无关"）。
 * 这里只需要两个参数，用正则比引 `lib: dom` 划算——引了就等于承认 core 可以碰浏览器 API。
 */
function queryParam(raw: string, name: string): string | null {
  const match = new RegExp(`[?&]${name}=([^&#]+)`, "i").exec(raw);
  return match?.[1] ?? null;
}

function pathSegments(raw: string): string[] {
  const noHash = raw.split("#")[0] ?? "";
  const noQuery = noHash.split("?")[0] ?? "";
  return noQuery.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").split("/").filter(Boolean);
}

function parseBilibili(raw: string, page: number | null): MediaSource {
  const bv = BV_PATTERN.exec(raw)?.[0] ?? null;
  const av = bv === null ? AV_PATTERN.exec(raw)?.[1] ?? null : null;
  if (bv === null && av === null) {
    return invalid("看起来是 B 站链接，但没找到 BV 号或 av 号");
  }
  const pageParam = page !== null && page > 0 ? `&page=${page}` : "";
  const embedUrl =
    bv !== null
      ? `https://player.bilibili.com/player.html?bvid=${bv}${pageParam}&autoplay=0&danmaku=0&high_quality=1`
      : `https://player.bilibili.com/player.html?aid=${av}${pageParam}&autoplay=0&danmaku=0&high_quality=1`;
  const idPart = bv !== null ? bv : `av${av}`;
  return {
    kind: "bilibili",
    provider: "哔哩哔哩",
    watchUrl:
      bv !== null
        ? `https://www.bilibili.com/video/${bv}${page !== null && page > 0 ? `?p=${page}` : ""}`
        : `https://www.bilibili.com/video/av${av}${page !== null && page > 0 ? `?p=${page}` : ""}`,
    embedUrl,
    id: idPart,
    nativeVideo: false,
    needsNetwork: true,
    reason: null,
  };
}

function parseYoutube(id: string): MediaSource {
  return {
    kind: "youtube",
    provider: "YouTube",
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    id,
    nativeVideo: false,
    needsNetwork: true,
    reason: null,
  };
}

/**
 * 把一个视频地址解析成可渲染的播放源。
 *
 * 支持的写法（讲义里直接填这些即可）：
 * - `https://cdn.example.com/lesson1.mp4`（直链，原生播放）
 * - `./media/lesson1.mp4`（随包分发的相对路径，不算联网）
 * - `https://example.com/live/master.m3u8`（HLS）
 * - `https://www.bilibili.com/video/BV1Y7411K7zz?p=3` 或 `BV1Y7411K7zz`
 * - `https://youtu.be/<11 位 id>` / `https://www.youtube.com/watch?v=<id>`
 * - 其它 http(s) 链接 → `page`，只给跳转
 */
export function parseMediaSource(raw: string, options: { readonly page?: number } = {}): MediaSource {
  const text = raw.trim();
  if (text === "") return invalid("视频地址为空");
  if (hasUnsafeScheme(text)) return invalid("不允许 javascript:/data: 这类地址");

  const lower = text.toLowerCase();

  if (lower.includes("bilibili.com") || lower.includes("b23.tv")) {
    // b23.tv 短链需要联网跳转才能拿到 BV 号，离线解析不出来 → 当普通网页
    if (lower.includes("b23.tv")) {
      return {
        kind: "page",
        provider: "哔哩哔哩（短链）",
        watchUrl: text,
        embedUrl: null,
        id: null,
        nativeVideo: false,
        needsNetwork: true,
        reason: null,
      };
    }
    const page = options.page ?? Number(queryParam(text, "p") ?? "0");
    return parseBilibili(text, Number.isFinite(page) && page > 0 ? page : null);
  }

  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    const v = queryParam(text, "v");
    const lastSegment = pathSegments(text).pop() ?? "";
    const candidate = v ?? lastSegment;
    if (YOUTUBE_ID.test(candidate)) return parseYoutube(candidate);
    return invalid("YouTube 链接里没有 11 位视频 id");
  }

  // 裸 BV 号 / 裸 av 号：讲义里最省事的写法，也兜住其它站点的 B 站转发链接
  if (BV_PATTERN.test(text) || AV_PATTERN.test(text)) {
    return parseBilibili(text, options.page ?? null);
  }

  if (isAbsoluteHttp(text)) {
    const ext = extensionOf(text);
    if (ext === "m3u8") {
      return {
        kind: "hls",
        provider: "HLS 流",
        watchUrl: text,
        embedUrl: text,
        id: text,
        nativeVideo: false,
        needsNetwork: true,
        reason: null,
      };
    }
    if ((FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      return {
        kind: "file",
        provider: "视频直链",
        watchUrl: text,
        embedUrl: text,
        id: text,
        nativeVideo: true,
        needsNetwork: true,
        reason: null,
      };
    }
    return {
      kind: "page",
      provider: "网页",
      watchUrl: text,
      embedUrl: null,
      id: null,
      nativeVideo: false,
      needsNetwork: true,
      reason: null,
    };
  }

  if (isRelativePath(text)) {
    const ext = extensionOf(text);
    if ((FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      return {
        kind: "file",
        provider: "本地视频",
        watchUrl: text,
        embedUrl: text,
        id: text,
        nativeVideo: true,
        needsNetwork: false,
        reason: null,
      };
    }
    if (ext === "m3u8") {
      return {
        kind: "hls",
        provider: "HLS 流",
        watchUrl: text,
        embedUrl: text,
        id: text,
        nativeVideo: false,
        needsNetwork: true,
        reason: null,
      };
    }
  }

  return invalid("既不是可播放的视频直链，也不是可识别的站点链接");
}
