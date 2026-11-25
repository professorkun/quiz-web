/**
 * 按账号隔离的本地数据库。
 *
 * 每个账号使用独立的 IndexedDB 数据库，刷题进度、错题、收藏、练习会话、
 * 导入题库与偏好设置全部落在自己的库里——切换账号即切换整套学习数据。
 *
 * 未登录（游客）继续使用原有的默认库 `quiz-web`。
 * 账号首次登录且自己的库为空时，把游客库的数据复制过去，避免"登录后题库不见了"。
 */

import { openIndexedDbStore } from "@quiz/platform-web";

const USER_DB_PREFIX = "quiz-web-user-";
/** 未登录（游客）使用的默认库 */
const GUEST_DB_NAME = "quiz-web";

/** 只带有元信息、没有真实数据的键 */
function isMetaKey(key: string): boolean {
  return key.startsWith("__meta__") || key === "__probe__";
}

/** 账号对应的数据库名（只保留安全字符，避免异常 ID 生成怪名字） */
export function accountDbName(userId: string): string {
  return `${USER_DB_PREFIX}${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/**
 * 把 sourceDbName 的数据整体复制到 targetDbName。
 *
 * 目标库已有实际数据时跳过并返回 0（不覆盖、不合并）；
 * 返回实际复制的键数量，便于迁移后给用户一个明确结果。
 */
export async function copyDataBetweenDbs(
  sourceDbName: string,
  targetDbName: string,
): Promise<number> {
  const source = await openIndexedDbStore({ dbName: sourceDbName });
  const target = await openIndexedDbStore({ dbName: targetDbName });
  if ((await target.keys()).some((key) => !isMetaKey(key))) return 0;

  let copied = 0;
  for (const key of (await source.keys()).filter((item) => !isMetaKey(item))) {
    const value = await source.get(key);
    if (value !== null) {
      await target.set(key, value);
      copied += 1;
    }
  }
  return copied;
}

/**
 * 账号库没有实际数据时，把游客库的键值整体复制过来（题库、进度、设置一并搬运）。
 * 游客库不可用或账号库已有数据时静默跳过，不阻塞登录。
 */
export async function copyGuestDataIfEmpty(userId: string): Promise<void> {
  try {
    await copyDataBetweenDbs(GUEST_DB_NAME, accountDbName(userId));
  } catch {
    // 迁移失败不影响登录：账号仍会以空库启动
  }
}
