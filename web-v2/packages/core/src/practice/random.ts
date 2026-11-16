/**
 * 可复现随机（ADR-0003 §1/§2）。
 *
 * 三个要点：
 * 1. PRNG 是纯函数，`core` 里没有 `Math.random()` / `Date.now()` / `crypto`；
 * 2. 按 namespace 派生独立子流，题序与每题选项序互不干扰；
 * 3. Fisher-Yates「从后往前」与旧版 shuffle 同形，便于 T2-9 行为对照。
 */

import { fnv1a32 } from "../revision.js";

const FNV_OFFSET = 0x811c9dc5;

/** mulberry32：32 位状态，输出 [0, 1) */
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 每处洗牌一条独立子流：加一道题不会让其它题的选项序漂移 */
export function deriveSeed(masterSeed: number, namespace: string): number {
  return (fnv1a32(namespace, FNV_OFFSET) ^ (masterSeed >>> 0)) >>> 0;
}

export function shuffleWith<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
