/**
 * 题目修订号（ADR-0001）。
 *
 * `revision` 是**内容指纹**，不是身份：改题干/选项/答案/解析都应该变，
 * 改题型展示顺序、改 JSON 键顺序不应该变。
 *
 * 实现是纯函数、零依赖的 FNV-1a（双通道拼成 48 bit），刻意**不用** `crypto`：
 * - `core` 必须能在 Node / Web / 小程序三端跑，而 `crypto.subtle` 是异步的，
 *   会把一个纯函数的修订号计算变成 async，污染所有调用方
 * - 这里只需要「内容一变就几乎一定变」，不需要抗碰撞的密码学强度
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** 供 `practice/random.ts` 复用同一套哈希派生子种子（ADR-0003），不引入第二种算法 */
export function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function toHex8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}

/**
 * 规范化序列化：对象键按字典序排列，数组保持顺序，undefined 字段被丢弃。
 * 这是「同样内容 → 同样字符串」的唯一保证。
 */
export function canonicalize(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [k, val] of entries) out[k] = walk(val);
    return out;
  };
  return JSON.stringify(walk(value));
}

/**
 * 计算修订号，返回 12 位小写十六进制。
 *
 * 只应传入「影响题目含义」的字段；`questionId` / `legacyKeys` 这类身份信息
 * 不参与计算，否则重命名映射表会连修订号一起改掉。
 */
export function computeRevision(content: unknown): string {
  const text = canonicalize(content);
  const a = fnv1a32(text, FNV_OFFSET);
  const b = fnv1a32(text, (FNV_OFFSET ^ 0x9e3779b9) >>> 0);
  const c = fnv1a32(`${text.length}`, FNV_OFFSET);
  return (toHex8(a) + toHex8(b)).slice(0, 11) + (c & 0xf).toString(16);
}
