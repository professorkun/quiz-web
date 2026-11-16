/**
 * 按会话快照里的 optionId 顺序排列选项（ADR-0003）。
 *
 * 两条兜底规则很关键，都是为了「题目改版后会话仍可用」：
 * - order 里出现重复或已不存在的 optionId → 忽略，不让选项凭空多出来；
 * - order 里漏掉的选项（题目新增了选项）→ 追加到末尾，绝不静默丢选项。
 */
export function orderedOptions<T extends { readonly optionId: string }>(
  options: readonly T[],
  order: readonly string[] | undefined,
): readonly T[] {
  if (order === undefined || order.length === 0) return options;
  const byId = new Map(options.map((o) => [o.optionId, o] as const));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const id of order) {
    const option = byId.get(id);
    if (option !== undefined && !seen.has(id)) {
      out.push(option);
      seen.add(id);
    }
  }
  for (const option of options) {
    if (!seen.has(option.optionId)) out.push(option);
  }
  return out;
}
