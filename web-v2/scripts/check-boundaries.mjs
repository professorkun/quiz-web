#!/usr/bin/env node
/**
 * 边界扫描（ADR-0002 的强制执行手段之一）。
 *
 * 检查 `packages/core` 是否偷偷引入了平台相关能力。为什么要机器查：
 * 人写代码时会"就这一次"地 reference 一下 window，然后边界就烂了——
 * 旧版正是这样一步步把数据契约、业务逻辑和 DOM 搅在一起的。
 *
 * 用法：node scripts/check-boundaries.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const coreSrc = join(repo, "packages", "core", "src");

const RULES = [
  { name: "禁止框架依赖", re: /from\s+["'](react|react-dom|vue|dexie|zustand|@tanstack\/[^"']+)["']/ },
  { name: "禁止浏览器全局", re: /\b(window|document|localStorage|sessionStorage|navigator|indexedDB)\b/ },
  { name: "禁止小程序 API", re: /\bwx\.\w+/ },
  { name: "禁止直接网络请求", re: /\bfetch\s*\(/ },
  { name: "禁止 Node IO", re: /from\s+["']node:(fs|path|http|crypto)["']/ },
];

/** 注释里出现这些词是合法的（说明为什么不用），所以先剥掉注释再查 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

let failed = 0;
const files = walk(coreSrc);
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const code = stripComments(raw);
  for (const rule of RULES) {
    const hit = code.match(rule.re);
    if (hit) {
      failed += 1;
      console.log(`FAIL  ${relative(repo, file)}  ${rule.name}：命中「${hit[0]}」`);
    }
  }
}

// 反向检查：core 的依赖里不允许出现平台包
const pkg = JSON.parse(readFileSync(join(repo, "packages", "core", "package.json"), "utf8"));
for (const name of Object.keys(pkg.dependencies ?? {})) {
  if (!["zod"].includes(name)) {
    failed += 1;
    console.log(`FAIL  packages/core 依赖了不允许的包：${name}`);
  }
}

if (failed === 0) {
  console.log(`PASS  边界干净（扫描 ${files.length} 个 core 源文件，依赖仅 zod）`);
} else {
  console.log(`\n结论：${failed} 项越界`);
  process.exitCode = 1;
}
