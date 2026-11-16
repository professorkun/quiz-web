/**
 * hash 路由（S3 · T3-3）。
 *
 * 不上 react-router：五个固定入口、没有嵌套路由、没有 loader，
 * 一个 20 行的 hash 解析就够。`base: "./"` 的静态产物也能直接双击打开，
 * 换成 history 路由就得配服务器 fallback，反而给"断网可用"添麻烦。
 */

export const ROUTES = ["learn", "banks", "practice", "review", "me"] as const;
export type Route = (typeof ROUTES)[number];

export const ROUTE_LABEL: Record<Route, string> = {
  learn: "学习",
  banks: "题库",
  practice: "刷题",
  review: "复习",
  me: "我的",
};

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "").split("?")[0] ?? "";
  const found = ROUTES.find((route) => route === raw);
  return found ?? "learn";
}

export function navigate(route: Route): void {
  if (globalThis.location.hash !== `#/${route}`) globalThis.location.hash = `#/${route}`;
}
