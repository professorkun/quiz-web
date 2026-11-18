/**
 * 题库内容包：空壳态，不含任何内置题库内容。
 *
 * 内容由用户导入的题库包提供——走 core 的 parseBankJson 校验、data 的
 * platform.banks.saveImportedBank 持久化。本包只保留「一份题库包在磁盘上的形状」
 * 这一通用结构契约，供导入/导出链路参考；不内置 javaweb-final / chemistry 等任何具体题库。
 */

import type { BankManifest, ExamTemplate, KnowledgeModule, Question, Topic } from "@quiz/core";

/** 一份题库包在磁盘上的形状（导入/导出的结构契约） */
export interface BankPackageFiles {
  readonly manifest: BankManifest;
  readonly questions: readonly Question[];
  readonly topics: readonly Topic[];
  readonly examTemplates: readonly ExamTemplate[];
  /** 知识讲义，与 topics 对应 */
  readonly knowledge: readonly KnowledgeModule[];
  /** 旧键 → 新 ID 的冻结映射（迁移场景才用；空壳态一般为空对象） */
  readonly legacyMap: Readonly<Record<string, string>>;
}
