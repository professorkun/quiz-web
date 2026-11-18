#!/usr/bin/env node
/**
 * T6-5 · 迁移演练（隔离内存跑，不写云、不碰真实用户数据）。
 *
 * 输入：真实旧云导出 `.workbuddy/tmp/legacy-export.json` + 题库包。
 * 产出：`web-v2/docs/reports/t6-5-migration-rehearsal.md`（逐表对账 + 差异解释）。
 *
 * 用法：node packages/data/scripts/rehearse-migration.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { migrateLegacyToV2 } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const exportPath = join(repoRoot, ".workbuddy", "tmp", "legacy-export.json");
const contentDir = join(repoRoot, "web-v2", "packages", "content", "javaweb-final");
const outPath = join(repoRoot, "web-v2", "docs", "reports", "t6-5-migration-rehearsal.md");

if (!existsSync(exportPath)) {
  console.error(`找不到旧数据导出：${exportPath}`);
  process.exit(1);
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const raw = readJson(exportPath);
const questions = readJson(join(contentDir, "questions.json"));
const templates = readJson(join(contentDir, "examTemplates.json"));
const legacyMap = readJson(join(contentDir, "legacy-map.json"));

const tables = raw.tables ?? {};
const legacy = {
  exportedAt: raw.exportedAt,
  mastery: tables.quiz_mastery ?? [],
  wrongs: tables.wrong_questions ?? [],
  exams: tables.exam_records ?? [],
};
const drill = (tables.drill_progress ?? [])[0] ?? null;
const localDrill = raw.localStorage?.jw_drill_progress_v1 ?? null;

const result = migrateLegacyToV2({ legacy, drill, localDrill, legacyMap, questions, templates });
const r = result.report;

const wrongCountSum = legacy.wrongs.reduce((n, x) => n + Math.max(1, x.wrong_count ?? 1), 0);
const pct = (x) => `${(x * 100).toFixed(2)}%`;
const list = (items, render) => (items.length ? items.map(render).join("\n") : "无（0 项）");

const examOk = r.sources.exams === r.produced.examRecords;
const drillOk = r.sources.drill === r.produced.sessions;
const mappingOk = r.dryRun.mappingRate >= 1 && r.dryRun.unmapped.length === 0 && r.dryRun.conflicts.length === 0;

const md = `# T6-5 · 迁移演练报告（隔离内存，不写库）

> 由 \`web-v2/packages/data/scripts/rehearse-migration.mjs\` 生成，请勿手改。
> 数据来源：真实旧云导出 \`legacy-export.json\`（导出时间 \`${raw.exportedAt ?? "未知"}\`）。
> **本演练不写任何云库、不碰线上数据**；产出的是"若现在迁移会得到什么"的对账结果。

## 一、来源 → 产出（逐表）

| 旧来源 | 行数 | → V2 目标 | 产出 | 对账 |
| --- | --- | --- | --- | --- |
| quiz_mastery | ${r.sources.mastery} | attempts（correct=true）+ progress | 作为 attempts 来源，参与合并 | — |
| wrong_questions | ${r.sources.wrongs} | attempts（按 wrong_count 展开 correct=false） | 展开 ${wrongCountSum} 条作答事件 | — |
| exam_records | ${r.sources.exams} | exam_records_v2 | ${r.produced.examRecords} 条成绩 | ${examOk ? "✅ 一致" : "⚠️ 不一致"} |
| drill_progress（云 + 本地） | ${r.sources.drill} | practice_sessions | ${r.produced.sessions} 条会话 | ${drillOk ? "✅ 一致" : "⚠️ 不一致"} |

**合成结果**：attempts **${r.produced.attempts}** 条、progress **${r.produced.progress}** 条、exam_records_v2 **${r.produced.examRecords}** 条、practice_sessions **${r.produced.sessions}** 条。

## 二、旧键映射率

| 指标 | 值 |
| --- | --- |
| 涉及旧键总数 | ${r.dryRun.totals.legacyKeys} |
| 成功映射 | ${r.dryRun.mappedKeys} |
| **映射率** | **${pct(r.dryRun.mappingRate)}**（要求 100%） |
| 错题展开的作答事件 | ${wrongCountSum} |

## 三、未映射 / 冲突 / 丢弃

**未映射（legacy-map 无此旧键）**
${list(r.dryRun.unmapped, (i) => `- \`${i.legacyKey}\`（${i.source}）：${i.reason}`)}

**冲突（有映射但题库无此题）**
${list(r.dryRun.conflicts, (i) => `- \`${i.legacyKey}\`（${i.source}）：${i.reason}`)}

**丢弃（源数据本身不完整）**
${list([...r.dryRun.dropped, ...r.examIssues, ...r.drillIssues], (i) => `- \`${i.legacyKey}\`（${i.source}）：${i.reason}`)}

## 四、只能推断的字段（迁移后需让用户知道）

**本次因源数据缺失而临时兜底的推断**
${list(r.dryRun.estimated, (e) => `- ${e}`)}

**始终适用的推断规则（旧数据本就没有这些信息）**
- 模考旧数据只有每题得分、无作答原文 → 满分判对、0 分判错、部分分记 null（主观题自评）
- 续刷会话的 \`res\` 位串编码未完全确认：长度与题数一致时按 1=对/0=错 还原，否则标 unseen
- 所有缺失时间戳统一落 1970-01-01，并以 \`importedFrom\` 标明来源

## 五、结论

${mappingOk && examOk && drillOk
  ? `**通过**：映射率 ${pct(r.dryRun.mappingRate)}、无未映射/冲突；四类来源全部有对应产出（exam_records_v2 ${r.produced.examRecords}/${r.sources.exams}、sessions ${r.produced.sessions}/${r.sources.drill}）。差异项均为"源数据本来就没有的字段"（已在第四节列出），可解释、不需修。`
  : `**未通过**：存在未映射/冲突或数量不一致，需人工确认后再进 T6-6。`}

## 六、进入正式迁移（T6-6）前必须人工确认的点

1. **身份关联**：旧云端 owner（旧 auth uid）与新应用登录用户如何对应——迁移按"同一人的数据搬到他登录后的新 owner"处理，需确认。
2. **停写窗口**：迁移执行时旧版需短暂停写，窗口时长与时机由人定。
3. **观察期**：迁移后旧表只读保留，观察期内不清理。
4. \`res\` 位串、模考部分分的推断口径，作为"已知差异"接受还是另行校正。
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, md, "utf8");

console.log(`映射率 ${pct(r.dryRun.mappingRate)}（${r.dryRun.mappedKeys}/${r.dryRun.totals.legacyKeys}）`);
console.log(`attempts ${r.produced.attempts} / progress ${r.produced.progress} / exam_records_v2 ${r.produced.examRecords} / sessions ${r.produced.sessions}`);
console.log(`未映射 ${r.dryRun.unmapped.length} / 冲突 ${r.dryRun.conflicts.length} / 丢弃 ${r.dryRun.dropped.length + r.examIssues.length + r.drillIssues.length}`);
console.log(`报告：${outPath}`);
