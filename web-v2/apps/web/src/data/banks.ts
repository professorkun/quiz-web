/**
 * 内置题库注册表（S3 · T3-10）。
 *
 * 这里**只做装配**，不做任何题库专属逻辑：没有 `if (bankId === "javaweb")`，
 * 也没有"如果是化学就换个渲染器"。新增一个内置题库 = 在这里加一行 + 放一份内容文件。
 *
 * 真正"零代码改动"的接入方式是导入题库包（T3-9）：用户拖入 JSON 就能多一个库，
 * 那条路径完全不经过本文件。
 */

import {
  validateBankPackage,
  type BankContent,
  type BankManifest,
  type KnowledgeModule,
  type Question,
} from "@quiz/core";
import { chemistryBank } from "@quiz/content";

import knowledgeJson from "../../../../packages/content/javaweb-final/knowledge.json";
import manifestJson from "../../../../packages/content/javaweb-final/manifest.json";
import questionsJson from "../../../../packages/content/javaweb-final/questions.json";

function loadJavawebBank(): BankContent {
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
  return {
    manifest,
    questions: result.questions,
    knowledge: knowledgeJson as unknown as KnowledgeModule[],
  };
}

/** 顺序即侧栏与切换器的展示顺序 */
export const BUILTIN_BANKS: readonly BankContent[] = [loadJavawebBank(), chemistryBank];
