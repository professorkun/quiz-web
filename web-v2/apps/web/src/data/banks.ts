/**
 * 内置题库注册表。
 *
 * 空壳态：产品本身不内置任何题库。用户通过「我的 → 数据导入导出」拖入题库包
 * （T3-9 的 parseBankJson → platform.banks.saveImportedBank）即可新增题库，
 * 导入后自动持久化到本机、可在「题库」页切换。
 *
 * 这里导出空数组，是为了保留「内置题库」这个装配位——后续若要预置某套题库，
 * 只需在此注册；不预置时应用仍可正常启动、导入、使用。
 */

import { SCHEMA_VERSION, type BankContent } from "@quiz/core";

/** 顺序即侧栏与切换器的展示顺序；当前为空壳，无预置题库 */
export const BUILTIN_BANKS: readonly BankContent[] = [];

/**
 * 空壳占位题库：仅用于在「尚无题库」时满足 ContextValue.activeBank 的非空类型约束。
 * 它绝不会被渲染——App 守卫会在 banks 为空时显示导入引导页，不进入任何功能页。
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
