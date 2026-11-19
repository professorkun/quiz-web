/**
 * 题库云备份（登录后）：把题库包 JSON 存到当前用户的云存储目录，换设备后可恢复。
 *
 * 只经 `cloud.storage`（运行时固定 bucket + `userPath` 按用户隔离），
 * 不新建数据库表，也不改五表契约。
 */

import type { BankContent } from "@quiz/core";
import { exportBankJson, parseBankJson } from "@quiz/data";

import { cloud } from "./client";

interface StorageFile {
  readonly name: string;
  readonly updated_at: string | null;
}

interface BucketLike {
  upload(
    path: string,
    body: string,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<{ data: unknown; error: unknown }>;
  list(
    prefix?: string,
    options?: { limit?: number },
  ): Promise<{ data: readonly StorageFile[] | null; error: unknown }>;
  download(path: string): PromiseLike<{ data: Blob | null; error: unknown }>;
}

const storage = cloud.storage as unknown as {
  from(): BucketLike;
  userPath(userId: string, relativePath: string): string;
};

const DIR = "quiz-banks";

function messageOf(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m !== "") return m;
  }
  return fallback;
}

export interface CloudBankEntry {
  /** 展示名（去掉 .json 后缀，通常是 bankId） */
  readonly name: string;
  /** 云端完整路径，恢复时原样传回 */
  readonly path: string;
  readonly updatedAt: string | null;
}

function dirPrefix(userId: string): string {
  return storage.userPath(userId, DIR).replace(/\/+$/, "");
}

export function cloudBankPath(userId: string, bankId: string): string {
  return storage.userPath(userId, `${DIR}/${bankId}.json`);
}

/** 上传/覆盖当前用户的某个题库备份 */
export async function uploadBankToCloud(userId: string, bank: BankContent): Promise<void> {
  const result = await storage.from().upload(cloudBankPath(userId, bank.manifest.bankId), exportBankJson(bank), {
    contentType: "application/json",
    upsert: true,
  });
  if (result.error) throw new Error(messageOf(result.error, "上传题库失败"));
}

/** 列出当前用户已备份的题库 */
export async function listCloudBanks(userId: string): Promise<readonly CloudBankEntry[]> {
  const prefix = dirPrefix(userId);
  const result = await storage.from().list(prefix, { limit: 100 });
  if (result.error) throw new Error(messageOf(result.error, "读取云端题库列表失败"));
  const files = result.data ?? [];
  return files
    .filter((file) => file.name.endsWith(".json"))
    .map((file) => ({
      name: file.name.replace(/\.json$/, ""),
      path: `${prefix}/${file.name}`,
      updatedAt: file.updated_at,
    }));
}

/** 下载并校验一份云端题库 */
export async function downloadBankFromCloud(path: string): Promise<BankContent> {
  const result = await storage.from().download(path);
  if (result.error) throw new Error(messageOf(result.error, "下载云端题库失败"));
  if (result.data === null) throw new Error("云端题库文件为空");

  const parsed = parseBankJson(await result.data.text());
  if (!parsed.ok || parsed.value === null) {
    throw new Error(`云端题库文件校验失败：${parsed.issues[0]?.message ?? "格式不符合题库包契约"}`);
  }
  return parsed.value;
}
