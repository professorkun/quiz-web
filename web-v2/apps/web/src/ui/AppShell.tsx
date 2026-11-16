/**
 * 应用壳（S3 · T3-3）：桌面左侧导航 + 移动底部导航，中间是当前页面。
 *
 * 为什么不用"手机卡片拉宽"的做法：题库页需要并排看筛选与列表，
 * 桌面端把它拉成一条 860px 的竖条，等于把 60% 的屏幕留白。
 */

import { ROUTES, ROUTE_LABEL, type Route } from "../router";
import { usePlatform } from "../platform/PlatformProvider";

interface AppShellProps {
  readonly route: Route;
  readonly onNavigate: (route: Route) => void;
  readonly children: React.ReactNode;
}

export function AppShell(props: AppShellProps): React.ReactElement {
  const { activeBank, banks, degraded, toast, dismissToast } = usePlatform();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">题</span>
          <div>
            <div className="brand-title">通用刷题</div>
            <div className="muted">{activeBank.manifest.title}</div>
          </div>
        </div>

        <nav className="nav" aria-label="主导航">
          {ROUTES.map((route) => (
            <button
              key={route}
              type="button"
              className={route === props.route ? "navitem on" : "navitem"}
              aria-current={route === props.route ? "page" : undefined}
              onClick={() => props.onNavigate(route)}
            >
              {ROUTE_LABEL[route]}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="muted">
            {banks.length} 个题库 · {activeBank.questions.length} 题
          </div>
          {degraded === null ? null : (
            <div className="notice small" style={{ marginTop: 8 }}>
              记录只存在内存中：{degraded}
            </div>
          )}
        </div>
      </aside>

      <main className="content">
        {degraded === null ? null : (
          <div className="notice banner">
            本地存储不可用（{degraded}）。当前可以继续作答，但关闭页面后记录会丢失；
            建议先排除隐私模式或清理空间。
          </div>
        )}

        {props.children}
      </main>

      <nav className="bottomnav" aria-label="主导航">
        {ROUTES.map((route) => (
          <button
            key={route}
            type="button"
            className={route === props.route ? "bottomitem on" : "bottomitem"}
            onClick={() => props.onNavigate(route)}
          >
            {ROUTE_LABEL[route]}
          </button>
        ))}
      </nav>

      {toast === null ? null : (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="btn ghost" onClick={dismissToast}>
            知道了
          </button>
        </div>
      )}
    </div>
  );
}
