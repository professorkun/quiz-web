#!/usr/bin/env node
/**
 * T2-4 对账：用真实题库包验证「89 个空位结构可渲染、可定位、顺序稳定」。
 *
 * 直接调用 `core` 编译产物的结构解析器（不是另写一遍正则），
 * 这样对账通过就意味着渲染层拿到的结构是对的。
 *
 * 用法：node scripts/verify-code-blanks.mjs（需先 pnpm build）
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCodeStructure, checkCodeBlankStructure } from "../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const bankPath = join(here, "..", "packages", "content", "javaweb-final", "questions.json");
const questions = JSON.parse(readFileSync(bankPath, "utf8"));
const codeBlanks = questions.filter((q) => q.type === "code_blank");

let unique = 0;
let slots = 0;
let issues = 0;
let files = 0;

console.log("题目".padEnd(30), "文件", "定义空位", "标记处", "结构问题");
for (const q of codeBlanks) {
  const structure = buildCodeStructure(q);
  const found = checkCodeBlankStructure(q);
  unique += structure.uniqueBlankCount;
  slots += structure.slotCount;
  files += structure.files.length;
  issues += found.length;
  console.log(
    q.questionId.padEnd(30),
    String(structure.files.length).padEnd(4),
    String(structure.uniqueBlankCount).padEnd(8),
    String(structure.slotCount).padEnd(6),
    String(found.length),
  );
  for (const issue of found) console.log(`   ${issue.code}  ${issue.message}`);
}

console.log(`\n合计：${codeBlanks.length} 题 / ${files} 个代码块 / ${unique} 个定义空位 / ${slots} 处标记 / ${issues} 个结构问题`);

// 89 是 S1 迁移报告锁定的数字；标记数 > 89 是内容结构决定的（同一空位填多处），不是丢空
if (unique !== 89 || issues !== 0 || codeBlanks.length !== 5) {
  console.error("FAIL  代码填空结构对账未通过");
  process.exitCode = 1;
} else {
  console.log("PASS  89 个空位全部可定位，多代码块结构完整，顺序以 blankId 定义为准");
}
