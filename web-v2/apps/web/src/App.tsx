/**
 * 应用入口（S3 · T3-3）：平台装配 → 五入口路由 → 页面。
 *
 * 页面是纯消费者：只知道 `usePlatform()` 和 `navigate()`，
 * 不知道 IndexedDB、也不知道题库文件从哪来。这样 S6 换成云端存储、
 * S8 打包成 App 时，页面一行都不用改。
 */

import { useEffect, useState } from "react";

import type { BankContent } from "@quiz/core";
import type { Platform } from "@quiz/platform";

import { BanksPage } from "./features/banks/BanksPage";
import { ExamPage } from "./features/exam/ExamPage";
import { LearnPage } from "./features/learn/LearnPage";
import { MePage } from "./features/me/MePage";
import { PracticePage } from "./features/practice/PracticePage";
import { ReviewPage } from "./features/review/ReviewPage";
import { EmptyState } from "./features/welcome/EmptyState";
import { PlatformProvider, usePlatform } from "./platform/PlatformProvider";
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

  useEffect(() => {
    const onHashChange = (): void => setRoute(parseRoute(globalThis.location.hash));
    globalThis.addEventListener("hashchange", onHashChange);
    return () => globalThis.removeEventListener("hashchange", onHashChange);
  }, []);

  // 空壳守卫：没有任何题库时只显示导入引导，不进入任何依赖 activeBank 的功能页。
  // 导入成功后 reloadBanks 会更新 banks，这里自动切到正常界面。
  if (banks.length === 0) return <EmptyState />;

  return (
    <AppShell
      route={route}
      onNavigate={(next) => {
        navigate(next);
        setRoute(next);
      }}
    >
      {renderRoute(route)}
    </AppShell>
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
