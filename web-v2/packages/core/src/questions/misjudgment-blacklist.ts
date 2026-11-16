/**
 * 已知误判黑名单（T2-3 固化的用例集，方案 §8「规则清单化 + 用例固化」）。
 *
 * 来源：旧版 `_build/template.html:429` 的 `blankOk()` 与 `:421` 的 `norm()`。
 * 每条都记录旧版实际会给出的结果，便于 T2-9 做逐条行为对照。
 * 「黑名单为空」的验收含义 = 下表每条 `expected` 都与新版实际判定一致。
 */

export interface MisjudgmentCase {
  readonly id: string;
  /** 标准答案写法（accepted 数组） */
  readonly accepted: readonly string[];
  /** 学习者输入 */
  readonly given: string;
  /** 新版应给出的结果 */
  readonly expected: boolean;
  /** 旧版 blankOk 实际给出的结果（用于证明这确实是误判） */
  readonly legacy: boolean;
  /** 误判类别 */
  readonly kind: "错判为对" | "对判为错";
  readonly why: string;
}

export const MISJUDGMENT_BLACKLIST: readonly MisjudgmentCase[] = [
  {
    id: "FW-01",
    accepted: ["Servlet"],
    given: "Ｓｅｒｖｌｅｔ",
    expected: true,
    legacy: false,
    kind: "对判为错",
    why: "旧版 norm() 不转全角字母，全角输入被判错（验收场景 3）",
  },
  {
    id: "SC-01",
    accepted: ["Servlet"],
    given: "ervlet",
    expected: false,
    legacy: true,
    kind: "错判为对",
    why: "包含式匹配把缺首字母的错答判对",
  },
  {
    id: "SC-02",
    accepted: ["HttpServletRequest"],
    given: "Request",
    expected: false,
    legacy: true,
    kind: "错判为对",
    why: "只写类名片段也算对，实际未答出完整类",
  },
  {
    id: "SC-03",
    accepted: ["ResultSet"],
    given: "esult",
    expected: false,
    legacy: true,
    kind: "错判为对",
    why: "两个字符以上的任意子串都能蒙对",
  },
  {
    id: "SC-04",
    accepted: ["getSession()"],
    given: "Session",
    expected: false,
    legacy: true,
    kind: "错判为对",
    why: "方法名片段被当作完整 API 调用",
  },
  {
    id: "SC-05",
    accepted: ["insert"],
    given: "sert",
    expected: false,
    legacy: true,
    kind: "错判为对",
    why: "SQL 关键字只写后缀也算对",
  },
  {
    id: "SC-06",
    accepted: ["web.xml"],
    given: "xml",
    expected: false,
    legacy: true,
    kind: "错判为对",
    why: "配置文件名只写扩展名也算对",
  },
  {
    id: "SC-07",
    accepted: ["@WebServlet"],
    given: "Web",
    expected: false,
    legacy: true,
    kind: "错判为对",
    why: "注解名只写中间片段也算对",
  },
  {
    id: "SH-01",
    accepted: ["true"],
    given: "ru",
    expected: false,
    legacy: true,
    kind: "错判为对",
    why: "恰好 2 个字符即触发包含式匹配（旧版下限 nu.length>=2）",
  },
];
