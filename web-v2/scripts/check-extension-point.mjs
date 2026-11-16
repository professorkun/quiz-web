#!/usr/bin/env node
/**
 * 扩展点静态检查（ADR-0004 / T2-1 完成判据）。
 *
 * 单测能证明"注册假题型能分派"，证明不了"页面里没偷偷写 if/else"。
 * 所以这里用机器扫：页面一旦出现按题型的硬分派，CI 直接红。
 *
 * 用法：node scripts/check-extension-point.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const webSrc = join(repo, "apps", "web", "src");
const coreSrc = join(repo, "packages", "core", "src");
const renderersDir = join(webSrc, "renderers");
const richTextPath = join(webSrc, "components", "RichText.tsx");

const BUILTIN = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "code_blank",
  "short_answer",
];

let failed = 0;
const note = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed += 1;
};

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir, exts = [".ts", ".tsx"]) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

const webFiles = walk(webSrc);

// 1) 页面/组件不得按题型硬分派
const HARD_DISPATCH = [
  /\b(?:q|question|current|cur|item|def)\.type\s*===?\s*["']/,
  /\bswitch\s*\([^)]*\.type\s*\)/,
  new RegExp(`\\bcase\\s*["'](?:${BUILTIN.join("|")})["']\\s*:`),
];
const dispatchHits = [];
for (const file of webFiles) {
  const code = stripComments(readFileSync(file, "utf8"));
  for (const re of HARD_DISPATCH) {
    const hit = code.match(re);
    if (hit) dispatchHits.push(`${relative(repo, file)} → ${hit[0]}`);
  }
}
note(
  dispatchHits.length === 0,
  `apps/web 无按题型硬分派${dispatchHits.length ? `：\n      ${dispatchHits.join("\n      ")}` : `（扫描 ${webFiles.length} 个文件）`}`,
);

// 2) 页面不得直接调用判分器（判分一律走 core 的练习引擎）
const GRADER_CALL = /\b(?:gradeQuestion|gradeAnswer|normalizeAnswer|matchesAccepted)\s*\(/;
const graderHits = webFiles.filter((f) => GRADER_CALL.test(stripComments(readFileSync(f, "utf8"))));
note(
  graderHits.length === 0,
  `apps/web 不直接判分${graderHits.length ? `：${graderHits.map((f) => relative(repo, f)).join(", ")}` : ""}`,
);

// 3) 公共判分入口不得回到 switch 分派
const gradeSrc = stripComments(readFileSync(join(coreSrc, "grade.ts"), "utf8"));
note(!/switch\s*\([^)]*\.type\s*\)/.test(gradeSrc), "core/grade.ts 不再包含 switch(q.type)");

// 4) Schema 成员数 = 装配清单条数 = 渲染器目录数
const schemaSrc = readFileSync(join(coreSrc, "schema.ts"), "utf8");
const enumBlock = schemaSrc.match(/QuestionTypeSchema\s*=\s*z\.enum\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
const schemaTypes = [...enumBlock.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
const indexSrc = readFileSync(join(coreSrc, "questions", "index.ts"), "utf8");
const listBlock = indexSrc.match(/BUILTIN_QUESTION_TYPES[^=]*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
const registered = [...listBlock.matchAll(/(\w+Definition)/g)].map((m) => m[1]);
note(
  schemaTypes.length === 6 && registered.length === 6,
  `Schema 6 成员 / 装配清单 ${registered.length} 条（Schema 实际 ${schemaTypes.length}）`,
);

// 分块实施期间允许渲染器逐步补齐；一旦练习页 App.tsx 出现（已集成），自动转为严格
const integrated = existsSync(join(webSrc, "App.tsx"));
if (existsSync(renderersDir)) {
  const dirs = readdirSync(renderersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const missing = BUILTIN.filter((t) => !dirs.includes(t));
  if (dirs.length === 6 && missing.length === 0) {
    note(true, `渲染器目录 6/6（${dirs.join(", ")}）`);
  } else if (integrated) {
    note(false, `渲染器目录 ${dirs.length}/6，缺 ${missing.join(", ")}`);
  } else {
    console.log(`SKIP  渲染器 ${dirs.length}/6（分块实施中，集成后自动严格）`);
  }
} else {
  console.log("SKIP  apps/web/src/renderers 尚未集成（T2-1 阶段允许）");
}

// 5) 安全渲染唯一入口：dangerouslySetInnerHTML 只允许出现在 RichText 组件
if (existsSync(richTextPath)) {
  const dirty = webFiles.filter(
    (f) => f !== richTextPath && /dangerouslySetInnerHTML/.test(stripComments(readFileSync(f, "utf8"))),
  );
  note(dirty.length === 0, `富文本注入唯一入口${dirty.length ? `：${dirty.map((f) => relative(repo, f)).join(", ")}` : ""}`);
}

if (failed === 0) {
  console.log("\n结论：扩展点干净");
} else {
  console.log(`\n结论：${failed} 项不符合扩展点约束`);
  process.exitCode = 1;
}
