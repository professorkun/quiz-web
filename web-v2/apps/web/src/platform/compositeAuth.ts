/**
 * 组合认证适配器：账号密码（后端数据库）优先，其次是应用云登录。
 *
 * 两套登录体系各自有独立会话；对页面只暴露一个 `AuthAdapter`：
 * - `getUser` 按顺序取第一个有效用户；
 * - 任一体系登录 / 退出都会通知页面重新装配账号数据库；
 * - `signOut` 清空全部会话，避免退出后另一套会话又把用户"登"回去。
 */

import type { AuthAdapter, AuthUser } from "@quiz/platform";

export function createCompositeAuthAdapter(adapters: readonly AuthAdapter[]): AuthAdapter {
  return {
    async getUser(): Promise<AuthUser | null> {
      for (const adapter of adapters) {
        const user = await adapter.getUser();
        if (user !== null && !user.isAnonymous) return user;
      }
      return null;
    },

    onAuthStateChange(listener) {
      const unsubscribes = adapters.map((adapter) => adapter.onAuthStateChange(listener));
      return () => {
        for (const unsubscribe of unsubscribes) unsubscribe();
      };
    },

    async signOut(): Promise<void> {
      for (const adapter of adapters) {
        await adapter.signOut().catch(() => undefined);
      }
    },
  };
}
