#!/usr/bin/env node
/**
 * 由 Markdown 源生成讲义 JSON（S7-E8）。
 *
 * 为什么不再直接手写 `knowledge.json`：
 * 1. 讲义正文有大段代码与表格，塞进 JSON 字符串后 `\n` 满屏，改一个字要数转义；
 * 2. 仓库既有纪律是"内容只改 Markdown，产物重新生成"（README §2 第 2 条），
 *    HTML 这么做，讲义也该这么做；
 * 3. 生成时能顺手跑一遍契约校验，缺 `moduleId`、视频地址为空这类错误当场报出来。
 *
 * 源文件：`javaweb-final/lectures/NN-<slug>.md`，格式见该目录的 README.md。
 * 产物：`javaweb-final/knowledge.json`（生成物，请勿手改）。
 *
 * 【独立性】（W2-4）本脚本不 import `@quiz/core`：
 *   W2 与 W1 并行开发，本窗口不等待 W1 的 dist。校验逻辑按 G0 冻结契约
 *   （parallel-contract.md §2 媒体行为表 / §3 错误格式 / §4.1 front matter 与切节规则）
 *   在本文件内自带一份等价实现；合并期由 INT 再用 W1 的 validateKnowledgeModules 复验一次（W2-3）。
 *   本地校验与 W1 契约保持同一语义，但不是同一份代码——改契约须走变更单并同步这里。
 *
 * 用法：node scripts/build-knowledge.mjs（web-v2 根目录：pnpm knowledge:build）
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bankDir = join(here, "..", "javaweb-final");
const lecturesDir = join(bankDir, "lectures");
const outPath = join(bankDir, "knowledge.json");
const manifestPath = join(bankDir, "manifest.json");

/** 只认识简单的「键: 值」与「键: 后面跟 - 列表」，够用且不需要引依赖 */
function parseFrontMatter(raw, file) {
  if (!raw.startsWith("---\n")) throw new Error(`${file}: 缺少 front matter（首行必须是 ---）`);
  const end = raw.indexOf("\n---", 4);
  if (end < 0) throw new Error(`${file}: front matter 没有闭合的 ---`);
  const block = raw.slice(4, end);
  const body = raw.slice(end + 4).replace(/^\n+/, "");

  const meta = {};
  let currentList = null;
  for (const line of block.split("\n")) {
    if (line.trim() === "") continue;
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem !== null && currentList !== null) {
      currentList.push(listItem[1].trim());
      continue;
    }
    const pair = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (pair === null) throw new Error(`${file}: 看不懂 front matter 这一行 → ${line}`);
    const [, key, value] = pair;
    if (value === "") {
      currentList = [];
      meta[key] = currentList;
    } else {
      currentList = null;
      meta[key] = value.trim();
    }
  }
  return { meta, body };
}

/** 按二级标题切小节；`##` 之前的内容（导语）不算小节，直接丢弃并提示 */
function splitSections(body, file) {
  const lines = body.split("\n");
  const sections = [];
  let current = null;
  const preamble = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current !== null) sections.push(current);
      current = { title: line.slice(3).trim(), lines: [] };
      continue;
    }
    if (current === null) preamble.push(line);
    else current.lines.push(line);
  }
  if (current !== null) sections.push(current);

  const trimmedPreamble = preamble.join("\n").trim();
  if (trimmedPreamble !== "") {
    console.warn(`  ! ${file}: 第一个 ## 之前有 ${trimmedPreamble.length} 字导语，不会被收录`);
  }
  return sections
    .map((s) => ({ title: s.title, body: s.lines.join("\n").trim() }))
    .filter((s) => s.body !== "");
}

/** `标题 | 地址 | 说明` 三段的简写，比 YAML 对象少一半符号 */
function parseTriples(list, file, kind) {
  return (list ?? []).map((line) => {
    const [title, url, note] = line.split("|").map((part) => part.trim());
    if (url === undefined || url === "") throw new Error(`${file}: ${kind}「${line}」缺少地址`);
    return {
      title: title === "" ? undefined : title,
      url,
      ...(note === undefined || note === "" ? {} : { note }),
    };
  });
}

/* ------------------------------------------------------------------ *
 * 本地契约校验（G0 §3 错误格式 / §4.1），不 import @quiz/core（W2-4）
 * ------------------------------------------------------------------ */

/** G0 §2 媒体行为表的本地最小实现：只判"能否被 W1 解析器识别"，不构造 DOM URL */
function mediaKind(raw) {
  const s = raw.trim();
  if (s === "") return "invalid";
  if (/^(javascript|data|vbscript|file):/i.test(s)) return "invalid";
  // B 站：完整链接的 BV/av 号，或裸 BV/av 号
  // 注意先判「看着像 B 站但无 BV/av 号」→ invalid（G0 §2 补充边界）
  if (/bilibili\.com/i.test(s) && !/(BV[0-9A-Za-z]{10}|av\d+)/i.test(s)) return "invalid";
  if (/(?:bilibili\.com\/video\/)?(BV[0-9A-Za-z]{10}|av\d+)/i.test(s)) return "bilibili";
  if (/^https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|shorts\/)[A-Za-z0-9_-]{11}/i.test(s)
    || /^https?:\/\/youtu\.be\/[A-Za-z0-9_-]{11}/i.test(s)) return "youtube";
  if (/\.m3u8(?:[?#].*)?$/i.test(s)) return "hls";
  if (/\.(mp4|webm|ogv|ogg|m4v|mov)(?:[?#].*)?$/i.test(s)) return "file";
  if (/^\.{0,2}\//.test(s) && !/:\/\//.test(s)) return "file"; // 相对路径随包文件
  if (/^https?:\/\//i.test(s)) return "page"; // 含 b23.tv 短链：普通网页，不内嵌
  return "invalid";
}

/**
 * 与 W1 validateKnowledgeModules 同语义的本地校验；返回带 path 的 issue 列表。
 * 変更契约须走 G0 变更单并同步 src/knowledge.test.ts 的本地校验。
 */
function validateLocally(modules, topicIds) {
  const issues = [];
  const add = (path, message) => issues.push({ path, message });
  const nonEmptyStr = (v) => typeof v === "string" && v.trim() !== "";

  if (!Array.isArray(modules)) {
    add("knowledge", "knowledge 必须是数组");
    return issues;
  }

  const seenModuleIds = new Set();
  modules.forEach((m, i) => {
    const p = `knowledge[${i}]`;
    for (const key of ["moduleId", "topicId", "title", "summary"]) {
      if (!nonEmptyStr(m[key])) add(`${p}.${key}`, "必填字段");
    }
    for (const key of ["items", "pitfalls", "goals", "sections", "videos", "resources"]) {
      if (!Array.isArray(m[key])) add(`${p}.${key}`, "必须是数组");
    }
    if (seenModuleIds.has(m.moduleId)) add(`${p}.moduleId`, `moduleId 重复：${m.moduleId}`);
    else seenModuleIds.add(m.moduleId);
    if (nonEmptyStr(m.topicId) && !topicIds.has(m.topicId)) {
      add(`${p}.topicId`, `topicId 不在 manifest.topics 中：${m.topicId}`);
    }
    // 语义约束：items 与 sections 不得同时为空
    if (Array.isArray(m.items) && Array.isArray(m.sections)
      && m.items.length === 0 && m.sections.length === 0) {
      add(p, `讲义「${m.title}」既没有要点（items）也没有正文（sections）`);
    }
    (m.sections ?? []).forEach((s, j) => {
      if (!nonEmptyStr(s.title)) add(`${p}.sections.${j}.title`, "小节标题不能为空");
      if (!nonEmptyStr(s.body)) add(`${p}.sections.${j}.body`, "小节正文不能为空");
    });
    (m.videos ?? []).forEach((v, j) => {
      if (!nonEmptyStr(v.url)) add(`${p}.videos.${j}.url`, "必填字段");
      else if (mediaKind(v.url) === "invalid") add(`${p}.videos.${j}.url`, `视频地址无法被解析器识别：${v.url}`);
    });
    (m.resources ?? []).forEach((r, j) => {
      if (!nonEmptyStr(r.title)) add(`${p}.resources.${j}.title`, "必填字段");
      if (!nonEmptyStr(r.url)) add(`${p}.resources.${j}.url`, "必填字段");
    });
    if (m.estimatedMinutes !== undefined
      && !(Number.isInteger(m.estimatedMinutes) && m.estimatedMinutes > 0)) {
      add(`${p}.estimatedMinutes`, "必须是正整数");
    }
    if (m.examFocus !== undefined && !nonEmptyStr(m.examFocus)) {
      add(`${p}.examFocus`, "不能为空字符串");
    }
  });
  return issues;
}

const files = readdirSync(lecturesDir)
  .filter((name) => name.endsWith(".md") && name !== "README.md")
  .sort();

if (files.length === 0) throw new Error("lectures/ 下没有讲义源文件");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const topicIds = new Set((manifest.topics ?? []).map((t) => t.topicId));

const modules = [];
const moduleFiles = []; // 与 modules 一一对应，仅供报错定位，不进产物
for (const file of files) {
  const raw = readFileSync(join(lecturesDir, file), "utf8");
  const { meta, body } = parseFrontMatter(raw, file);
  for (const required of ["moduleId", "topicId", "title", "summary"]) {
    if (typeof meta[required] !== "string" || meta[required].trim() === "") {
      throw new Error(`${file}: front matter 缺少必填项 ${required}`);
    }
  }
  const sections = splitSections(body, file);
  if (sections.length === 0) throw new Error(`${file}: 正文里没有 ## 小节`);

  modules.push({
    moduleId: meta.moduleId,
    topicId: meta.topicId,
    title: meta.title,
    summary: meta.summary,
    items: [],
    pitfalls: meta.pitfalls ?? [],
    goals: meta.goals ?? [],
    sections,
    videos: parseTriples(meta.videos, file, "视频"),
    resources: parseTriples(meta.resources, file, "资源"),
    ...(meta.minutes === undefined ? {} : { estimatedMinutes: Number(meta.minutes) }),
    ...(meta.examFocus === undefined ? {} : { examFocus: meta.examFocus }),
  });
  moduleFiles.push(file);
}

const issues = validateLocally(modules, topicIds);
if (issues.length > 0) {
  for (const issue of issues) {
    const idx = /^knowledge\[(\d+)\]/.exec(issue.path);
    const where = idx ? `（${moduleFiles[Number(idx[1])]}）` : "";
    console.error(`× [SCHEMA_INVALID] ${issue.path}: ${issue.message}${where}`);
  }
  process.exit(1);
}

writeFileSync(outPath, `${JSON.stringify(modules, null, 2)}\n`, "utf8");

const sectionCount = modules.reduce((n, m) => n + m.sections.length, 0);
const charCount = modules.reduce(
  (n, m) => n + m.sections.reduce((k, s) => k + s.body.length, 0),
  0,
);
const videoCount = modules.reduce((n, m) => n + m.videos.length, 0);
console.log(
  `讲义 ${modules.length} 篇 / ${sectionCount} 节 / 正文 ${(charCount / 1000).toFixed(1)}k 字 / 视频 ${videoCount} 条 → ${outPath}`,
);
