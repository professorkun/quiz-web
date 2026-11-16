#!/usr/bin/env node
/**
 * 迁移脚本（T1-4）：旧 `_build/data.json` → `packages/content/javaweb-final/`。
 *
 * 这个文件只做 IO：读源、调纯函数、写产物。逻辑全在 `../dist/migrate.js` 里，
 * 所以同一份输入重复执行必然得到同一份输出（幂等）。
 *
 * 用法：node scripts/migrate-legacy.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { migrateLegacyBank } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const sourcePath = join(repoRoot, "_build", "data.json");
const outDir = join(here, "..", "javaweb-final");

const writeJson = (name, value) => {
  writeFileSync(join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const raw = JSON.parse(readFileSync(sourcePath, "utf8"));
const result = migrateLegacyBank(raw, { sourceTag: "legacy-javaweb-20261116" });

mkdirSync(outDir, { recursive: true });
writeJson("manifest.json", result.manifest);
writeJson("topics.json", result.topics);
writeJson("examTemplates.json", result.examTemplates);
writeJson("questions.json", result.questions);
writeJson("legacy-map.json", result.legacyMap);

const { stats, issues } = result;
const byType = Object.entries(stats.byType)
  .map(([k, v]) => `${k}=${v}`)
  .join(" / ");

const report = [
  "# javaweb-final 迁移报告",
  "",
  "> 由 `web-v2/packages/content/scripts/migrate-legacy.mjs` 生成，请勿手改。",
  "",
  "| 项 | 值 |",
  "| --- | --- |",
  `| 源文件 | \`_build/data.json\` |`,
  `| 题数 | ${stats.total} |`,
  `| 题型分布 | ${byType} |`,
  `| 代码填空唯一空位 | ${stats.codeBlankSlots} |`,
  `| 知识点 | ${stats.topicCount} |`,
  `| legacy 映射条数 | ${Object.keys(result.legacyMap).length} |`,
  `| 迁移问题 | ${issues.length} |`,
  "",
  issues.length
    ? ["## 迁移问题清单", "", ...issues.map((i) => `- \`${i.code}\` ${i.where ?? ""} ${i.message}`)].join("\n")
    : "## 迁移问题清单\n\n无。",
  "",
].join("\n");

writeFileSync(join(outDir, "REPORT.md"), report, "utf8");

console.log(`题数 ${stats.total}；${byType}`);
console.log(`代码填空唯一空位 ${stats.codeBlankSlots}；知识点 ${stats.topicCount}；legacy 映射 ${Object.keys(result.legacyMap).length}`);
console.log(`迁移问题 ${issues.length}`);
if (issues.length) {
  for (const i of issues.slice(0, 20)) console.log(`  - ${i.code} ${i.where ?? ""} ${i.message}`);
  process.exitCode = 1;
}
