/**
 * 应用入口（S3 · T3-3）：平台装配 → 五入口路由 → 页面。
 *
 * 页面是纯消费者：只知道 `usePlatform()` 和 `navigate()`，
 * 不知道 IndexedDB、也不知道题库文件从哪来。这样 S6 换成云端存储、
 * S8 打包成 App 时，页面一行都不用改。
 */

import { lazy, Suspense, useEffect, useState } from "react";

import type { BankContent } from "@quiz/core";
import type { Platform } from "@quiz/platform";

import { LearnPage } from "./features/learn/LearnPage";
import { EmptyState } from "./features/welcome/EmptyState";

/**
 * 路由分包（P3 体积治理）：首屏只带「学习」页，其余入口按需加载。
 * 用 `.then(m => ({ default: m.XxxPage }))` 适配命名导出，避免改页面模块的导出形状。
 */
const BanksPage = lazy(() =>
  import("./features/banks/BanksPage").then((m) => ({ default: m.BanksPage })),
);
const PracticePage = lazy(() =>
  import("./features/practice/PracticePage").then((m) => ({ default: m.PracticePage })),
);
const ExamPage = lazy(() =>
  import("./features/exam/ExamPage").then((m) => ({ default: m.ExamPage })),
);
const ReviewPage = lazy(() =>
  import("./features/review/ReviewPage").then((m) => ({ default: m.ReviewPage })),
);
const MePage = lazy(() => import("./features/me/MePage").then((m) => ({ default: m.MePage })));
import { PlatformProvider, usePlatform } from "./platform/PlatformProvider";
import { useAutoSync } from "./cloud/useAutoSync";
import { navigate, parseRoute, type Route } from "./router";
import { AppShell } from "./ui/AppShell";

function renderRoute(route: Route): React.ReactElement {
  switch (route) {
    case "banks":
      return <BanksPage />;
    case "practice":
      return <PracticePage />;
    case "exam":
      return <ExamPage />;
    case "review":
      return <ReviewPage />;
    case "me":
      return <MePage />;
    case "learn":
    default:
      return <LearnPage />;
  }
}

function Shell(): React.ReactElement {
  const { banks } = usePlatform();
  const [route, setRoute] = useState<Route>(() => parseRoute(globalThis.location.hash));

  // 云账号登录后自动同步（匿名 / 非云域名直接跳过；失败不阻塞刷题）
  useAutoSync();

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseRoute(globalThis.location.hash));
    globalThis.addEventListener("hashchange", onHashChange);
    return () => globalThis.removeEventListener("hashchange", onHashChange);
  }, []);

  // 没有题库时也进入主界面：首页内提供导入入口，「我的」仍可登录与导入，
  // 其余入口提示先导入。导入成功后 reloadBanks 会更新 banks，自动切到正常首页。
  const content =
    banks.length === 0 ? (
      route === "me" ? (
        <MePage />
      ) : route === "learn" ? (
        <EmptyState />
      ) : (
        <NoBankState />
      )
    ) : (
      renderRoute(route)
    );

  return (
    <AppShell
      route={route}
      onNavigate={(next) => {
        navigate(next);
        setRoute(next);
      }}
    >
      <div className="motion-page" key={route}>
        <Suspense fallback={null}>{content}</Suspense>
      </div>
    </AppShell>
  );
}

/** 无题库时访问非首页入口：引导回首页导入，而不是渲染半残的功能页 */
function NoBankState(): React.ReactElement {
  return (
    <div className="page">
      <section className="card">
        <h2>还没有题库</h2>
        <p className="muted">先回首页导入一份题库包，再使用这个入口。</p>
        <button type="button" className="btn" onClick={() => navigate("learn")}>
          去首页导入题库
        </button>
      </section>
    </div>
  );
}

export function App(
  props: {
    /** 集成测试注入现成平台；生产环境不传，由 Provider 自己装配 IndexedDB */
    readonly platform?: Platform;
    readonly builtinBanks?: readonly BankContent[];
    /** 存储不可用说明（注入平台时使用） */
    readonly storageWarning?: string;
  } = {},
): React.ReactElement {
  return (
    <PlatformProvider
      {...(props.platform === undefined ? {} : { platform: props.platform })}
      {...(props.builtinBanks === undefined ? {} : { builtinBanks: props.builtinBanks })}
      {...(props.storageWarning === undefined ? {} : { storageWarning: props.storageWarning })}
    >
      <Shell />
    </PlatformProvider>
  );
}
