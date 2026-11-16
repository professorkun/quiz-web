#!/usr/bin/env node
/**
 * T1-6 dry-run：旧学习记录 → 新契约，只出报告，不写库。
 *
 * 输入两边都来自磁盘：
 * - `.workbuddy/tmp/legacy-export.json`（由 `tools/export_server.py` + 同源导出页生成）
 * - `packages/content/javaweb-final/*.json`（迁移器产物）
 *
 * 用法：node packages/data/scripts/dryrun-legacy.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { dryRunLegacyRecords } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const exportPath = join(repoRoot, ".workbuddy", "tmp", "legacy-export.json");
const contentDir = join(repoRoot, "web-v2", "packages", "content", "javaweb-final");
const outPath = join(repoRoot, "web-v2", "docs", "reports", "t1-6-dryrun.md");

if (!existsSync(exportPath)) {
  console.error(`找不到导出文件：${exportPath}`);
  console.error("先运行：python3 tools/export_server.py，并在同源页面打开 tools/export-legacy-records.html");
  process.exit(1);
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const raw = readJson(exportPath);
const questions = readJson(join(contentDir, "questions.json"));
const templates = readJson(join(contentDir, "examTemplates.json"));
const legacyMap = readJson(join(contentDir, "legacy-map.json"));

const payload = {
  exportedAt: raw.exportedAt,
  mastery: raw.tables?.quiz_mastery ?? [],
  wrongs: raw.tables?.wrong_questions ?? [],
  exams: raw.tables?.exam_records ?? [],
};

const { attempts, progress, report } = dryRunLegacyRecords(payload, legacyMap, questions, templates);

const pct = (x) => `${(x * 100).toFixed(2)}%`;
const list = (items, render) => (items.length ? items.map(render).join("\n") : "无");

const wrongCountSum = payload.wrongs.reduce((n, r) => n + Math.max(1, r.wrong_count ?? 1), 0);

const md = `# T1-6 · 旧学习记录 dry-run 报告

> 由 \`web-v2/packages/data/scripts/dryrun-legacy.mjs\` 生成，请勿手改。
> 数据来源：云端导出 \`.workbuddy/tmp/legacy-export.json\`（导出时间 \`${raw.exportedAt ?? "未知"}\`）。
> **本报告不写库**，仅证明旧记录能被映射，并暴露需要人工决策的地方。

## 一、映射率

| 指标 | 值 |
| --- | --- |
| 掌握的题目（quiz_mastery） | ${report.totals.mastery} 行 |
| 错题（wrong_questions） | ${report.totals.wrongs} 行（按 wrong_count 展开为 ${wrongCountSum} 条作答事件） |
| 模考（exam_records） | ${report.totals.exams} 场，含 ${report.totals.examItems} 条题目级明细 |
| 涉及的旧键总数 | ${report.totals.legacyKeys} |
| **成功映射的旧键** | **${report.mappedKeys}** |
| **映射率** | **${pct(report.mappingRate)}**（验收要求 100%） |

## 二、产出的候选数据（未入库）

| 项 | 值 |
| --- | --- |
| 合成 Attempt 总数 | ${attempts.length} |
| 按模式分布 | ${Object.entries(report.attemptsByMode).map(([k, v]) => `${k}=${v}`).join(" / ")} |
| 由 Attempt 重算出的 Progress 条目 | ${progress.length} |
| 其中已掌握 | ${progress.filter((p) => p.mastered).length} |
| 其中仍有错题记录 | ${progress.filter((p) => p.wrongCount > 0).length} |

## 三、未映射 / 冲突 / 丢弃

**未映射（legacy-map 里没有的旧键）**

${list(report.unmapped, (i) => `- \`${i.legacyKey}\`（${i.source}）：${i.reason}`)}

**冲突（有映射但题库里找不到题）**

${list(report.conflicts, (i) => `- \`${i.legacyKey}\`（${i.source}）：${i.reason}`)}

**丢弃（源数据本身不完整）**

${list(report.dropped, (i) => `- \`${i.legacyKey}\`（${i.source}）：${i.reason}`)}

## 四、只能推断的字段（必须让用户知道）

${list(report.estimated, (e) => `- ${e}`)}

具体规则：

1. \`quiz_mastery\` 只有「做对过」这一事实 → 合成 1 条 \`correct=true\`，**弃用 \`isFirstAttempt\`（一律记 false）**，避免虚增首次正确率
2. \`wrong_questions\` 有 \`wrong_count\` → 按次数展开成等量的 \`correct=false\` 事件，保证「累计错 N 次」不失真
3. \`exam_records.detail\` 只有每题得分 → 满分判 \`true\`、0 分判 \`false\`、**部分分记 \`null\`**（多半是主观题自评，不能断言对错）
4. 所有缺失时间戳统一落 \`1970-01-01\`，并靠 \`importedFrom\` 标明来源，不与真实作答混淆

## 五、结论

${report.mappingRate >= 1 && report.conflicts.length === 0 ? "**通过**：映射率 100%、无冲突。旧记录可以整体迁入新契约，且每条数据都带来源标记。" : "**未通过**：存在未映射或冲突项，需人工确认后再迁。"}
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, md, "utf8");

console.log(`映射率 ${pct(report.mappingRate)}（${report.mappedKeys}/${report.totals.legacyKeys}）`);
console.log(`Attempt ${attempts.length}；Progress ${progress.length}；未映射 ${report.unmapped.length}、冲突 ${report.conflicts.length}、丢弃 ${report.dropped.length}`);
console.log(`报告：${outPath}`);
