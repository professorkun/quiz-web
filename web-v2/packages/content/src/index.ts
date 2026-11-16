/**
 * 题库内容包（T1-4 会在这里生成 `javaweb-final`）。
 *
 * 当前只放**结构与路径约定**，不放任何题目内容：
 * 内容必须以 JSON/TS 资源形式落盘，再由迁移器生成，绝不能手写进业务代码——
 * 旧版把 7 个知识点、讲义、卷面结构全写在 template.html 里，换一门课就得改源码。
 */

import type { BankManifest, ExamTemplate, KnowledgeModule, Question, Topic } from "@quiz/core";

/** 一份题库包在磁盘上的形状（迁移器的输出契约） */
export interface BankPackageFiles {
  readonly manifest: BankManifest;
  readonly questions: readonly Question[];
  readonly topics: readonly Topic[];
  readonly examTemplates: readonly ExamTemplate[];
  /** 知识讲义（T1-7 从旧 POINTS 抽出），与 topics 一一对应 */
  readonly knowledge: readonly KnowledgeModule[];
  /** 旧键 → 新 ID 的冻结映射（ADR-0001），迁移时一次生成、人工确认后入库 */
  readonly legacyMap: Readonly<Record<string, string>>;
}

export const JAVAWeb_FINAL_BANK_ID = "javaweb" as const;

export { migrateLegacyBank, LEGACY_TYPE_TO_NEW, TOPIC_SLUGS } from "./migrate.js";
export type {
  MigrationIssue,
  MigrationOptions,
  MigrationResult,
  MigrationStats,
} from "./migrate.js";
export type { LegacyDataJson, LegacyQuestion } from "./legacy.js";

/** 第二学科题库（S3 · T3-10）：验证"换学科不改业务代码" */
export { chemistryBank } from "./banks/chemistry.js";
