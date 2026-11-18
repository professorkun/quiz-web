/**
 * 迁移与派算层。
 *
 * - `computeProgress`：由不可变 Attempt 重算进度（唯一统计入口）
 * - `recomputeProgress`：全量事件重算，导入后与 S4 对账共用
 * - `dryRunLegacyRecords`：旧学习记录 → 新契约的模拟转换，只出报告不写库（T1-6）
 * - `snapshot`：学习记录与题库包的导入导出（T3-9）
 * - `recompute`：进度重算与对账（S4 T4-8）
 */

export { computeProgress, recomputeProgress } from "./progress.js";
export { verifyBank, recomputeBank } from "./recompute.js";
export type { ReconcileReport } from "./recompute.js";
export { dryRunLegacyRecords } from "./legacy-records.js";
export { migrateLegacyToV2 } from "./migrate-v2.js";
export type {
  MigrationV2Input,
  MigrationV2Result,
  MigrationV2Report,
  LegacyDrillRow,
} from "./migrate-v2.js";
export {
  LEARNING_FILE_KIND,
  BANK_FILE_KIND,
  SNAPSHOT_VERSION,
  exportLearningJson,
  parseLearningJson,
  exportBankJson,
  parseBankJson,
  mergeLearning,
  applyLearningSnapshot,
} from "./snapshot.js";
export type { ImportIssue, ParseResult, MergeStats, MergeResult } from "./snapshot.js";
export type {
  DryRunResult,
  DryRunReport,
  DryRunIssue,
  LegacyRecordsExport,
  LegacyMasteryRow,
  LegacyWrongRow,
  LegacyExamRow,
} from "./legacy-records.js";
