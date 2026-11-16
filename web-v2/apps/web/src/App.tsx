import { useEffect, useState } from "react";

import type { BankPackage } from "@quiz/core";

import { demoBank } from "./data/demoBank";
import { loadJavawebBank } from "./data/javawebBank";
import { PracticePage } from "./ui/PracticePage";

/**
 * 应用壳（S2 只做练习页，不做导航/首页/题库页——那是 S3）。
 * 需要六题型手测时访问 `?demo=1`，切换为演示题库（不算多题库切换 UI）。
 */
export function App(): React.ReactElement {
  const [bank, setBank] = useState<BankPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setBank(loadJavawebBank());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  if (error !== null) {
    return (
      <div className="wrap">
        <div className="card">
          <div className="notice" style={{ whiteSpace: "pre-wrap" }}>
            题库加载失败：{error}
          </div>
        </div>
      </div>
    );
  }

  if (bank === null) {
    return (
      <div className="wrap">
        <p className="muted">正在校验题库包…</p>
      </div>
    );
  }

  const demo =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1";

  return <PracticePage bank={demo ? demoBank : bank} />;
}
