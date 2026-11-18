import { describe, expect, it } from "vitest";

import { parseMediaSource } from "./media.js";

describe("讲义视频源解析（S7-E8）", () => {
  it("B 站完整链接：拿得到 BV 号，并生成站外播放器地址", () => {
    const source = parseMediaSource("https://www.bilibili.com/video/BV1Y7411K7zz?p=3");
    expect(source.kind).toBe("bilibili");
    expect(source.id).toBe("BV1Y7411K7zz");
    expect(source.embedUrl).toContain("bvid=BV1Y7411K7zz");
    expect(source.embedUrl).toContain("page=3");
    expect(source.needsNetwork).toBe(true);
    expect(source.nativeVideo).toBe(false);
  });

  it("裸 BV 号也能解析：讲义里少抄一截链接是最常见的写法", () => {
    const source = parseMediaSource("BV1Vf4y127N5");
    expect(source.kind).toBe("bilibili");
    expect(source.watchUrl).toBe("https://www.bilibili.com/video/BV1Vf4y127N5");
  });

  it("av 号走 aid 参数，而不是硬塞进 bvid", () => {
    const source = parseMediaSource("https://www.bilibili.com/video/av69742084");
    expect(source.kind).toBe("bilibili");
    expect(source.id).toBe("av69742084");
    expect(source.embedUrl).toContain("aid=69742084");
    expect(source.embedUrl).not.toContain("bvid=");
  });

  it("B 站短链不硬猜：解析不出 BV 就降级成普通网页", () => {
    const source = parseMediaSource("https://b23.tv/abc123");
    expect(source.kind).toBe("page");
    expect(source.embedUrl).toBeNull();
    expect(source.reason).toBeNull();
  });

  it("YouTube 三种写法都归一成同一个 11 位 id", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      const source = parseMediaSource(url);
      expect(source.kind).toBe("youtube");
      expect(source.id).toBe("dQw4w9WgXcQ");
      expect(source.embedUrl).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
  });

  it("直链 mp4 走原生播放器，且 query 不影响扩展名判断", () => {
    const source = parseMediaSource("https://cdn.example.com/lesson1.mp4?token=abc");
    expect(source.kind).toBe("file");
    expect(source.nativeVideo).toBe(true);
    expect(source.embedUrl).toBe("https://cdn.example.com/lesson1.mp4?token=abc");
  });

  it("相对路径算本地文件：不联网也能播", () => {
    const source = parseMediaSource("./media/servlet-lifecycle.webm");
    expect(source.kind).toBe("file");
    expect(source.needsNetwork).toBe(false);
  });

  it("m3u8 判为 HLS，不假装原生可播", () => {
    const source = parseMediaSource("https://example.com/live/master.m3u8");
    expect(source.kind).toBe("hls");
    expect(source.nativeVideo).toBe(false);
  });

  it("普通网页只给跳转，不内嵌", () => {
    const source = parseMediaSource("https://tomcat.apache.org/");
    expect(source.kind).toBe("page");
    expect(source.embedUrl).toBeNull();
    expect(source.watchUrl).toBe("https://tomcat.apache.org/");
  });

  it("拒绝脚本协议与空地址，并给出人能看懂的原因", () => {
    expect(parseMediaSource("javascript:alert(1)").kind).toBe("invalid");
    expect(parseMediaSource("data:text/html,<script>1</script>").kind).toBe("invalid");
    expect(parseMediaSource("   ").reason).toBe("视频地址为空");
    expect(parseMediaSource("随便写点什么").reason).toContain("既不是");
  });

  it("分不清就是分不清：不把乱码当成可播源", () => {
    const source = parseMediaSource("https://www.bilibili.com/");
    expect(source.kind).toBe("invalid");
    expect(source.reason).toContain("BV 号");
  });
});
