/**
 * 平台上下文（S3 · T3-3 的装配层）。
 *
 * 唯一职责：把「存储 + 题库 + 当前题库 + 变更计数」交给页面。
 * 页面因此不需要知道 IndexedDB、也不需要自己 new 一个仓储。
 *
 * `version` 是刻意的土办法：任何写操作后 +1，页面凭它重新拉数据。
 * 比引一个状态库便宜，也比"各页面自己 emit 事件"更难写错——
 * 数据只有一份真源（存储），页面只是它的投影。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { BankContent } from "@quiz/core";
import type { AuthAdapter, Platform } from "@quiz/platform";
import { createWebPlatform } from "@quiz/platform-web";

import { createLocalAuthAdapter } from "../account/localAuth";
import { accountDbName, copyGuestDataIfEmpty } from "../account/userStorage";
import { cloudAuth, createCloudAuthAdapter } from "../cloud/auth";
import { isCloudOrigin } from "../cloud/config";
import { BUILTIN_BANKS, EMPTY_BANK_PLACEHOLDER } from "../data/banks";

export interface PendingSession {
  readonly questionIds: readonly string[];
  readonly mode: "practice" | "review";
  /** 从哪个入口发起，用于练习页的返回文案 */
  readonly origin: string;
}

interface ContextValue {
  readonly platform: Platform;
  /** 持久化降级原因；null 表示正常 */
  readonly degraded: string | null;
  readonly banks: readonly BankContent[];
  readonly activeBank: BankContent;
  readonly version: number;
  readonly toast: string | null;
  selectBank(bankId: string): Promise<void>;
  reloadBanks(): Promise<void>;
  /** 写操作后调用，通知其它页面重新取数 */
  bump(): void;
  showToast(message: string): void;
  dismissToast(): void;
  readonly pendingSession: PendingSession | null;
  startCustomSession(questionIds: readonly string[], mode: "practice" | "review", origin?: string): void;
  consumePendingSession(): void;
}

const PlatformContext = createContext<ContextValue | null>(null);

interface State {
  readonly platform: Platform;
  readonly banks: readonly BankContent[];
  /** null = 尚无题库可选（空壳态）。持久化时也存 null——契约禁止空字符串 ID */
  readonly activeBankId: string | null;
  readonly degraded: string | null;
}

async function loadBank(platform: Platform, bankId: string): Promise<BankContent | null> {
  const manifest = await platform.banks.getManifest(bankId);
  if (manifest === null) return null;
  const [questions, knowledge, passages] = await Promise.all([
    platform.banks.listQuestions(bankId),
    platform.banks.listKnowledge(bankId),
    platform.banks.listPassages(bankId),
  ]);
  return { manifest, questions, knowledge, passages };
}

async function loadBanks(platform: Platform): Promise<readonly BankContent[]> {
  const ids = await platform.banks.listBankIds();
  const loaded: BankContent[] = [];
  for (const id of ids) {
    const bank = await loadBank(platform, id);
    if (bank !== null) loaded.push(bank);
  }
  return loaded;
}

export function PlatformProvider(props: {
  readonly children: React.ReactNode;
  /** 测试或其它端可注入现成平台（跳过 IndexedDB 装配） */
  readonly platform?: Platform;
  readonly builtinBanks?: readonly BankContent[];
  /** 存储不可用的原因（注入平台时由调用方给出），显示为顶部横幅 */
  readonly storageWarning?: string;
}): React.ReactElement {
  const injected = props.platform;
  const builtinBanks = props.builtinBanks ?? BUILTIN_BANKS;
  const storageWarning = props.storageWarning;
  // 认证适配器只创建一次：本机账号（静态部署）或应用云账号（正式发布域名）
  const auth = useMemo<AuthAdapter>(
    () => (isCloudOrigin() ? createCloudAuthAdapter() : createLocalAuthAdapter()),
    [],
  );
  const [state, setState] = useState<State | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null);
  /** 登录账号变化时 +1，触发按账号重新装配数据库 */
  const [bootToken, setBootToken] = useState(0);
  const currentUserId = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    // 存储类提示要能被读到，所以给足 6 秒；不做自动消失的"闪一下"
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async (): Promise<void> => {
      try {
        setFailure(null);
        // OAuth 回调要在任何守卫之前处理；失败不阻塞启动（退回本地游客模式）
        if (injected === undefined && isCloudOrigin()) {
          await cloudAuth.handleCallback().catch(() => null);
        }
        // 先确定当前账号：每个账号使用独立数据库，游客用默认库
        const user = injected === undefined ? await auth.getUser() : null;
        const userId = user?.userId ?? null;
        currentUserId.current = userId;
        if (injected === undefined && userId !== null) {
          // 账号库首次使用且为空时，把游客数据搬进来，避免登录后题库"消失"
          await copyGuestDataIfEmpty(userId);
        }
        const created =
          injected === undefined
            ? await createWebPlatform({
                builtinBanks,
                auth,
                ...(userId === null ? {} : { dbName: accountDbName(userId) }),
              })
            : { platform: injected, degraded: null as string | null };
        const platform = created.platform;
        // 注入平台时允许调用方带入"存储不可用"的说明（测试、S6 云同步失败都走这条）
        const degraded = storageWarning ?? created.degraded;
        const banks = await loadBanks(platform);
        // 无题库也算合法状态：主界面照常进入，由首页提供导入入口。
        // 用户导入题库后，reloadBanks 会把新题库带进界面。

        const settings = await platform.settings.getApp();
        const known = banks.some((b) => b.manifest.bankId === settings.activeBankId);
        // 空壳态没有题库可选时必须落 null 而不是空串：AppSettingsSchema 禁止空字符串，
        // 写 "" 会让下一次启动读设置直接判「结构不符合契约」，整个应用卡死在无法启动。
        const activeBankId = known ? settings.activeBankId : (banks[0]?.manifest.bankId ?? null);

        if (!known && banks.length > 0) {
          // 没有题库时不写 activeBankId（空字符串不是合法值），等首次导入后再落库
          await platform.settings.saveApp({
            ...settings,
            activeBankId,
            updatedAt: new Date().toISOString(),
          });
        }
        if (cancelled) return;
        setState({ platform, banks, activeBankId, degraded });
        if (degraded !== null) showToast(degraded);
      } catch (cause) {
        if (cancelled) return;
        setFailure(cause instanceof Error ? cause.message : String(cause));
      }
    };

    void boot();
    return () => {
      cancelled = true;
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    };
  }, [showToast, injected, builtinBanks, storageWarning, auth, bootToken]);

  // 登录 / 退出后按新账号重新装配存储；游客与各账号之间的数据互不影响
  useEffect(() => {
    if (injected !== undefined) return;
    return auth.onAuthStateChange((user) => {
      const next = user?.userId ?? null;
      if (next === currentUserId.current) return;
      currentUserId.current = next;
      setState(null);
      setFailure(null);
      setPendingSession(null);
      setBootToken((token) => token + 1);
    });
  }, [auth, injected]);

  const selectBank = useCallback(
    async (bankId: string) => {
      if (state === null) return;
      const next = state.banks.find((b) => b.manifest.bankId === bankId);
      if (next === undefined) return;
      setState({ ...state, activeBankId: bankId });
      const settings = await state.platform.settings.getApp();
      await state.platform.settings.saveApp({
        ...settings,
        activeBankId: bankId,
        updatedAt: new Date().toISOString(),
      });
      setVersion((v) => v + 1);
    },
    [state],
  );

  const reloadBanks = useCallback(async () => {
    if (state === null) return;
    const banks = await loadBanks(state.platform);
    const activeBankId = banks.some((b) => b.manifest.bankId === state.activeBankId)
      ? state.activeBankId
      : (banks[0]?.manifest.bankId ?? state.activeBankId);
    setState({ ...state, banks, activeBankId });
    setVersion((v) => v + 1);
  }, [state]);

  const value = useMemo<ContextValue | null>(() => {
    if (state === null) return null;
    const activeBank =
      state.banks.find((b) => b.manifest.bankId === state.activeBankId) ??
      state.banks[0] ??
      EMPTY_BANK_PLACEHOLDER;
    return {
      platform: state.platform,
      degraded: state.degraded,
      banks: state.banks,
      activeBank,
      version,
      toast,
      selectBank,
      reloadBanks,
      bump: () => setVersion((v) => v + 1),
      showToast,
      dismissToast: () => setToast(null),
      pendingSession,
      startCustomSession: (questionIds, mode, origin = "复习") =>
        setPendingSession({ questionIds, mode, origin }),
      consumePendingSession: () => setPendingSession(null),
    };
  }, [state, version, toast, pendingSession, selectBank, reloadBanks, showToast]);

  if (failure !== null) {
    return (
      <div className="wrap">
        <div className="card">
          <h1>无法启动</h1>
          <div className="notice" style={{ whiteSpace: "pre-wrap" }}>
            {failure}
          </div>
          <p className="muted">
            如果提示"本地数据来自更新版本"，说明这个浏览器里存着新版本写的数据。
            请先用新版本打开并导出备份，不要用旧版本继续写入。
          </p>
          <button type="button" className="btn" onClick={() => globalThis.location.reload()}>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (value === null) {
    return (
      <div className="wrap">
        <p className="muted">正在准备题库与本地存储…</p>
      </div>
    );
  }

  return <PlatformContext.Provider value={value}>{props.children}</PlatformContext.Provider>;
}

export function usePlatform(): ContextValue {
  const value = useContext(PlatformContext);
  if (value === null) throw new Error("usePlatform 必须在 PlatformProvider 内使用");
  return value;
}
