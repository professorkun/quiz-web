#!/usr/bin/env node
/**
 * T2-9 对账：用**真实题库的 143 个空位**验证旧版纯逻辑迁移没有引入回归。
 *
 * 三组数字：
 * 1. 原样输入（标准答案自己）→ 新旧都必须判对，回归数必须 0；
 * 2. 全角变体 → 旧版判错、新版判对，属有意改进（N1）；
 * 3. 子串变体 → 旧版误判为对、新版判错，属有意收紧（取消包含式匹配）。
 *
 * 用法：node scripts/verify-legacy-parity.mjs（需先 pnpm build）
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { matchesAccepted } from "../packages/core/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const bankPath = join(here, "..", "packages", "content", "javaweb-final", "questions.json");
const questions = JSON.parse(readFileSync(bankPath, "utf8"));

/** 旧版 `_build/template.html:421` norm()，逐字复刻 */
function legacyNorm(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .replace(/[`"'“”‘’]/g, "")
    .replace(/；/g, ";")
    .replace(/，/g, ",")
    .replace(/、/g, ",")
    .replace(/\/>/g, ">")
    .replace(/[。.]$/g, "");
}

/** 旧版 `_build/template.html:429` blankOk()，逐字复刻 */
function legacyBlankOk(user, ans) {
  const nu = legacyNorm(user);
  if (!nu) return false;
  const nb = legacyNorm(ans);
  return nb === nu || (nb.indexOf(nu) >= 0 && nu.length >= 2);
}

const toFullwidth = (s) =>
  s
    .replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
    .replace(/ /g, "\u3000");

/** 取答案的一个 ≥2 字符子串，模拟旧版会误判成的错答 */
const substringsOf = (ans) => {
  const norm = legacyNorm(ans);
  const plain = norm.replace(/[^\p{L}\p{N}]/gu, "");
  if (plain.length >= 4) return [plain.slice(1, plain.length - 1)];
  if (plain.length === 3) return [plain.slice(0, 2)];
  return [];
};

let blanks = 0;
let sameOk = 0;
let regressed = 0;
let fullwidthImproved = 0;
let substringTightened = 0;
const failures = [];

for (const q of questions) {
  if (q.type !== "fill_blank" && q.type !== "code_blank") continue;
  for (const blank of q.blanks) {
    const ans = blank.accepted[0];
    if (typeof ans !== "string") continue;
    blanks += 1;

    // 1) 原样输入
    const oldOk = legacyBlankOk(ans, ans);
    const newOk = matchesAccepted(ans, blank.accepted);
    if (oldOk && newOk) sameOk += 1;
    if (oldOk && !newOk) {
      regressed += 1;
      failures.push({ questionId: q.questionId, blankId: blank.blankId, kind: "原样输入被判错", ans });
    }

    // 2) 全角变体
    const fw = toFullwidth(ans);
    if (fw !== ans) {
      const oldFw = legacyBlankOk(fw, ans);
      const newFw = matchesAccepted(fw, blank.accepted);
      if (!oldFw && newFw) fullwidthImproved += 1;
      if (oldFw && !newFw) {
        regressed += 1;
        failures.push({ questionId: q.questionId, blankId: blank.blankId, kind: "全角变体被判错", ans: fw });
      }
    }

    // 3) 子串变体（旧版包含式匹配会误判为对）
    for (const sub of substringsOf(ans)) {
      if (legacyBlankOk(sub, ans) && !matchesAccepted(sub, blank.accepted)) {
        substringTightened += 1;
      }
    }
  }
}

console.log("真实题库空位对账（填空 54 + 代码填空 89）");
console.log(`  空位总数                 ${blanks}`);
console.log(`  原样输入新旧都判对       ${sameOk}`);
console.log(`  全角变体：旧错新对       ${fullwidthImproved}（有意改进 N1）`);
console.log(`  子串变体：旧对新错       ${substringTightened}（有意收紧，取消包含匹配）`);
console.log(`  回归（新版判错）         ${regressed}`);

if (regressed > 0 || sameOk !== blanks) {
  console.error("\nFAIL  旧逻辑迁移存在回归：");
  for (const f of failures.slice(0, 20)) {
    console.error(`  ${f.questionId} ${f.blankId} ${f.kind}  answer=${JSON.stringify(f.ans)}`);
  }
  process.exitCode = 1;
} else {
  console.log("\nPASS  143/143 原样输入判对；差异全部属于已登记的有意变更");
}
