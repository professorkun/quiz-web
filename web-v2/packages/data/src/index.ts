/**
 * 迁移与派算层。
 *
 * - `computeProgress`：由不可变 Attempt 重算进度（唯一统计入口）
 * - `dryRunLegacyRecords`：旧学习记录 → 新契约的模拟转换，只出报告不写库（T1-6）
 */

export { computeProgress } from "./progress.js";
export { dryRunLegacyRecords } from "./legacy-records.js";
export type {
  DryRunResult,
  DryRunReport,
  DryRunIssue,
  LegacyRecordsExport,
  LegacyMasteryRow,
  LegacyWrongRow,
  LegacyExamRow,
} from "./legacy-records.js";
