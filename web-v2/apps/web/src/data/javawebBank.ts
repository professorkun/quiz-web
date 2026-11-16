/**
 * 真实题库包加载（`javaweb-final`）。
 *
 * 加载即校验：`validateBankPackage` 不通过就直接抛错并在页面上显示，
 * 绝不让"少了几道题"的包静默进练习（S1 验收 §B 的硬要求）。
 * 147 题 / 89 空位是 S1 锁定的数字，改动会在这里立刻暴露。
 */

import {
  validateBankPackage,
  type BankManifest,
  type BankPackage,
  type Question,
} from "@quiz/core";

import manifestJson from "../../../../packages/content/javaweb-final/manifest.json";
import questionsJson from "../../../../packages/content/javaweb-final/questions.json";

export function loadJavawebBank(): BankPackage {
  const manifest = manifestJson as unknown as BankManifest;
  const questions = questionsJson as unknown as Question[];
  const result = validateBankPackage({ manifest, questions });
  if (!result.ok) {
    const head = result.issues
      .slice(0, 6)
      .map((issue) => `· ${issue.code} ${issue.path ?? ""} ${issue.message}`)
      .join("\n");
    throw new Error(`题库包校验失败（共 ${result.issues.length} 项）：\n${head}`);
  }
  return { manifest, questions: result.questions };
}
