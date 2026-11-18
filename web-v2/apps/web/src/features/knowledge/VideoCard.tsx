/**
 * 讲义视频卡（S7-E8）。
 *
 * 三条设计取向：
 * 1. **点开才加载**：站外 iframe 一加载就会发请求、种 Cookie。讲义是"断网也能读"的东西，
 *    不能在用户只是翻页时就去连 B 站。所以先给一张卡片，点了才挂 iframe。
 * 2. **不猜**：能不能播由 `parseMediaSource` 判定（core 里可单测），组件只按 `kind` 分支。
 * 3. **失败要说清**：解析不出来就把 `reason` 直接显示，不做一个永远转圈的黑框。
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { parseMediaSource, type KnowledgeVideo } from "@quiz/core";

export interface VideoCardProps {
  readonly video: KnowledgeVideo;
}

export function VideoCard(props: VideoCardProps): React.ReactElement {
  const source = useMemo(() => parseMediaSource(props.video.url), [props.video.url]);
  const [activated, setActivated] = useState(false);
  /** B-4：断网时点播放要说清"需联网"，而不是挂一个永远加载不完的框 */
  const [netHint, setNetHint] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startSec = props.video.startSec ?? 0;
  useEffect(() => {
    const el = videoRef.current;
    if (el === null || startSec <= 0) return;
    const jump = (): void => {
      if (Number.isFinite(el.duration) && startSec < el.duration) el.currentTime = startSec;
    };
    el.addEventListener("loadedmetadata", jump);
    return () => el.removeEventListener("loadedmetadata", jump);
  }, [startSec]);

  if (source.kind === "invalid") {
    return (
      <div className="notice small">
        视频「{props.video.title ?? props.video.url}」地址无法识别：{source.reason}
      </div>
    );
  }

  const title = props.video.title ?? source.provider;

  return (
    <figure className="video-card">
      {netHint === null ? null : (
        <p className="notice small" role="status">
          {netHint}
        </p>
      )}
      {source.kind === "file" || source.kind === "hls" ? (
        <>
          <video
            ref={videoRef}
            className="video-frame"
            controls
            preload="metadata"
            playsInline
            src={source.embedUrl ?? undefined}
            onError={() => {
              if (source.needsNetwork && globalThis.navigator?.onLine === false) {
                setNetHint("当前断网，这个视频需要联网才能加载。文字讲义不受影响，可继续阅读。");
              } else {
                setNetHint("视频加载失败：可能是地址失效或网络问题，可点「原站打开」试试。");
              }
            }}
          >
            你的浏览器不支持 video 标签，请
            <a href={source.watchUrl ?? "#"}>直接打开视频</a>。
          </video>
          {source.kind === "hls" ? (
            <p className="muted small">
              HLS 流在 Safari 可直接播放；Chrome / Firefox 需要额外播放引擎，建议改用 mp4 直链。
            </p>
          ) : null}
        </>
      ) : source.embedUrl === null ? (
        <a className="video-placeholder" href={source.watchUrl ?? "#"} target="_blank" rel="noreferrer">
          <span className="video-play">↗</span>
          <span>
            在{source.provider}打开
            <span className="muted small">（该站点不允许内嵌，只能跳转）</span>
          </span>
        </a>
      ) : activated ? (
        <iframe
          className="video-frame"
          src={source.embedUrl}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <button
          type="button"
          className="video-placeholder"
          onClick={() => {
            // B-4：断网点播放给"需联网"提示，不挂 iframe（挂了也只会转圈）
            if (source.needsNetwork && globalThis.navigator?.onLine === false) {
              setNetHint("当前断网，这个视频需要联网才能播放。文字讲义不受影响，可继续阅读。");
              return;
            }
            setNetHint(null);
            setActivated(true);
          }}
        >
          <span className="video-play">▶</span>
          <span>
            播放「{title}」
            <span className="muted small">（{source.provider}，点击后联网加载）</span>
          </span>
        </button>
      )}

      <figcaption>
        <strong>{title}</strong>
        {props.video.note === undefined ? null : <span className="muted"> · {props.video.note}</span>}
        {source.watchUrl === null ? null : (
          <>
            {" · "}
            <a href={source.watchUrl} target="_blank" rel="noreferrer">
              原站打开
            </a>
          </>
        )}
      </figcaption>
    </figure>
  );
}
