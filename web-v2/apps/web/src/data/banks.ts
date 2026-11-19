/**
 * 内置题库注册表。
 *
 * 预置题库在这里注册，随应用一起编译、无需导入即可使用；
 * 用户仍可通过「我的 → 数据导入导出」导入其它题库包，导入后自动持久化到本机。
 */

import { SCHEMA_VERSION, type BankContent } from "@quiz/core";

import { sqlServerBank } from "./sqlserverBank";

/** 顺序即侧栏与切换器的展示顺序 */
export const BUILTIN_BANKS: readonly BankContent[] = [sqlServerBank];

/**
 * 空壳占位题库：仅用于在「尚无题库」时满足 ContextValue.activeBank 的非空类型约束。
 * 它绝不会被当成真实题库渲染——没有题库时首页展示导入入口，其余入口提示先导入。
 * 一旦用户导入真实题库，占位即被替换。
 */
export const EMPTY_BANK_PLACEHOLDER: BankContent = {
  manifest: {
    schemaVersion: SCHEMA_VERSION,
    bankId: "__empty__",
    title: "（暂无题库）",
    questionCount: 0,
    topics: [{ topicId: "__empty__:topic", bankId: "__empty__", name: "待导入", order: 0 }],
    examTemplates: [],
    createdAt: "1970-01-01T00:00:00.000Z",
  },
  questions: [],
  knowledge: [],
};
