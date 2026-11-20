/*
 * Service Worker（S6 · T6-9）：离线可打开 + 静态资源缓存 + 更新提示。
 *
 * 策略：
 *  - 安装时预缓存应用外壳（导航入口、图标、manifest）。
 *  - 导航请求：网络优先，成功则回填缓存；断网回退到缓存的入口页。
 *  - 静态资源：缓存优先，未命中再取网络并回填。
 *  - 更新：新 SW 安装后等待，页面提示；用户确认后 postMessage SKIP_WAITING 立即接管。
 *
 * 只处理同源 GET，跨域与写请求一律放行。
 */
const CACHE = "quiz-shell-v2";
const SHELL = ["./", "./manifest.webmanifest", "./brand/logo-16.svg", "./brand/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {
        /* 任一外壳资源缺失不应让安装整体失败（例如子路径部署时 ./ 行为差异） */
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // 导航：网络优先 + 回填；断网回退到缓存的入口页
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./"))),
    );
    return;
  }

  // 静态资源：缓存优先 + 回填
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && (res.type === "basic" || res.type === "default")) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      });
    }),
  );
});
