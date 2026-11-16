#!/usr/bin/env node
/**
 * 抽取知识讲义（T1-7）：旧 `template.html` 里的 `POINTS` 常量 → `knowledge.json`。
 *
 * 为什么单独写脚本而不是手抄：`POINTS` 是一个 JS 对象字面量（键名没引号），
 * 手抄 7 个模块几十条要点必然出错且无法复核。这里用 Node 直接求值这个数组，
 * 再转成契约格式，**内容零改动、只换承载形式**。
 *
 * 用法：node scripts/extract-knowledge.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TOPIC_SLUGS } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const templatePath = join(repoRoot, "_build", "template.html");
const outPath = join(here, "..", "javaweb-final", "knowledge.json");

const html = readFileSync(templatePath, "utf8");

const start = html.indexOf("const POINTS = [");
if (start < 0) throw new Error("在 template.html 里找不到 `const POINTS = [`");

// 从 `[` 开始做括号配对，字符串内的括号要跳过
const openIndex = html.indexOf("[", start);
let depth = 0;
let end = -1;
let inString = null;
for (let i = openIndex; i < html.length; i++) {
  const ch = html[i];
  if (inString) {
    if (ch === "\\") i += 1;
    else if (ch === inString) inString = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === "`") {
    inString = ch;
    continue;
  }
  if (ch === "[") depth += 1;
  if (ch === "]") {
    depth -= 1;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
if (end < 0) throw new Error("POINTS 数组的括号没有闭合");

const literal = html.slice(openIndex, end + 1);
// eslint-disable-next-line no-new-func
const points = new Function(`return (${literal});`)();

if (!Array.isArray(points) || points.length === 0) throw new Error("POINTS 解析结果不是非空数组");

const knowledge = points.map((p) => {
  const slug = TOPIC_SLUGS[p.k];
  if (!slug) throw new Error(`知识点「${p.k}」不在 TOPIC_SLUGS 映射里，需先补映射`);
  return {
    moduleId: `javaweb:kb:${slug}`,
    topicId: `javaweb:topic:${slug}`,
    title: p.k,
    summary: p.desc,
    items: p.items.map((it) => ({ title: it.t, detail: it.d })),
    pitfalls: Array.isArray(p.pits) ? p.pits : [],
  };
});

writeFileSync(outPath, `${JSON.stringify(knowledge, null, 2)}\n`, "utf8");

const itemCount = knowledge.reduce((n, k) => n + k.items.length, 0);
const pitCount = knowledge.reduce((n, k) => n + k.pitfalls.length, 0);
console.log(`知识模块 ${knowledge.length} 个；要点 ${itemCount} 条；易错点 ${pitCount} 条 → ${outPath}`);
