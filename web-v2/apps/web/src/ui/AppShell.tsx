/**
 * 应用壳（S3 · T3-3 / 美化 C-04）：桌面分组侧栏 + 平板图标栏 + 移动底部导航。
 *
 * 断点：≥1280 216px；1024–1279 200px；861–1023 72px 图标栏；<860 底部导航。
 * 页面只是 children，壳不关心当前业务。
 */

import { useEffect, useState } from "react";

import { PwaUpdateBar } from "../pwa";
import { ROUTES, ROUTE_LABEL, type Route } from "../router";
import { usePlatform } from "../platform/PlatformProvider";
import {
  IconBook,
  IconClose,
  IconExam,
  IconLayers,
  IconPencil,
  IconReview,
  IconUser,
  type IconProps,
} from "./icons";

interface AppShellProps {
  readonly route: Route;
  readonly onNavigate: (route: Route) => void;
  readonly children: React.ReactNode;
}

const NAV_ICON: Record<Route, (props: IconProps) => React.ReactElement> = {
  learn: IconBook,
  banks: IconLayers,
  practice: IconPencil,
  exam: IconExam,
  review: IconReview,
  me: IconUser,
};

/** 分组：学习·题库·刷题 ｜ 模考·复习 ｜ 我的 */
const NAV_GROUPS: readonly (readonly Route[])[] = [
  ["learn", "banks", "practice"],
  ["exam", "review"],
  ["me"],
];

export function AppShell(props: AppShellProps): React.ReactElement {
  const { platform, activeBank, banks, degraded, toast, dismissToast, version } = usePlatform();
  const [touched, setTouched] = useState(0);

  useEffect(() => {
    if (banks.length === 0) {
      setTouched(0);
      return;
    }
    let cancelled = false;
    void platform.progress
      .listByBank(activeBank.manifest.bankId)
      .then((rows) => {
        if (!cancelled) setTouched(rows.length);
      })
      .catch(() => {
        if (!cancelled) setTouched(0);
      });
    return () => {
      cancelled = true;
    };
  }, [platform, activeBank.manifest.bankId, banks.length, version]);

  const total = activeBank.questions.length;
  const percent = total === 0 ? 0 : Math.min(100, Math.round((touched / total) * 100));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-mark brand-mark-on-light"
            src="./brand/logo-16.svg"
            alt=""
            width={34}
            height={34}
          />
          <img
            className="brand-mark brand-mark-on-dark"
            src="./brand/logo-reverse.svg"
            alt=""
            width={34}
            height={34}
          />
          <div>
            <div className="brand-title">题斋</div>
            <div className="brand-sub">
              {banks.length === 0 ? "尚未导入题库" : activeBank.manifest.title}
            </div>
          </div>
        </div>

        <nav className="nav" aria-label="主导航">
          {NAV_GROUPS.map((group, index) => (
            <div className="nav-group" key={index}>
              {group.map((route) => {
                const Icon = NAV_ICON[route];
                return (
                  <button
                    key={route}
                    type="button"
                    className={route === props.route ? "navitem on" : "navitem"}
                    aria-current={route === props.route ? "page" : undefined}
                    title={ROUTE_LABEL[route]}
                    onClick={() => props.onNavigate(route)}
                  >
                    <Icon />
                    <span className="nav-label">{ROUTE_LABEL[route]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          {banks.length === 0 ? (
            <div>还没有题库</div>
          ) : (
            <>
              <div>
                {banks.length} 个题库 · {touched}/{total} 题
              </div>
              <div
                className="mini-progress"
                role="progressbar"
                aria-label="当前题库练习进度"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={touched}
              >
                <i style={{ width: `${percent}%` }} />
              </div>
            </>
          )}
          {degraded === null ? null : <div className="notice small">记录只存在内存中：{degraded}</div>}
        </div>
      </aside>

      <main className="content">
        <PwaUpdateBar />
        {degraded === null ? null : (
          <div className="notice banner">
            {degraded}。当前仍可继续作答，但关闭页面后这些记录会丢失；
            建议先排除隐私模式或清理空间，或导出备份后再继续。
          </div>
        )}

        {props.children}
      </main>

      <nav className="bottomnav" aria-label="主导航">
        {ROUTES.map((route) => {
          const Icon = NAV_ICON[route];
          return (
            <button
              key={route}
              type="button"
              className={route === props.route ? "bottomitem on" : "bottomitem"}
              aria-current={route === props.route ? "page" : undefined}
              onClick={() => props.onNavigate(route)}
            >
              <Icon size={20} />
              <span>{ROUTE_LABEL[route]}</span>
            </button>
          );
        })}
      </nav>

      {toast === null ? null : (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="btn ghost" onClick={dismissToast}>
            <IconClose size={16} />
            知道了
          </button>
        </div>
      )}
    </div>
  );
}
