# T2-3 · 填空归一化规则清单与已知误判黑名单

- 日期：2026-11-16
- 代码：`packages/core/src/questions/normalize.ts`（`NORMALIZE_RULES`）、`misjudgment-blacklist.ts`、`normalization.test.ts`
- 旧版基线：`_build/template.html:421` `norm()`、`:429` `blankOk()`
- 数据基线：`packages/content/javaweb-final/questions.json` — 27 道填空、54 个空、5 道代码填空 89 个空

---

## 1. 为什么必须清单化

旧版 `blankOk()` 为了"对学习者友好"加了一条包含式匹配：

```js
return nb === nu || (nb.indexOf(nu) >= 0 && nu.length >= 2);
```

它的真实效果是：**只要输入是标准答案的任意 ≥2 字符子串，就算对**。`"ervlet"` 判 `"Servlet"` 对、`"xml"` 判 `"web.xml"` 对、`"ru"` 判 `"true"` 对。这属于方案 §6-F 明确禁止的「为了让填空更宽松而吞掉真实错答，且未记录规则」。

反过来，旧版 `norm()` 不处理全角字母，`"Ｓｅｒｖｌｅｔ"` 会被判错——这是「应为对却判错」。两头都坏。

S2 的处置不是"再调一调阈值"，而是：**取消包含式匹配，改精确等价；所有等价变换逐条列进清单，每条配用例**。

## 2. 归一化规则（按顺序执行）

输入与标准答案走**完全相同**的变换链，变换后精确比较。

| 编号 | 规则 | 例子 | 来源 |
| --- | --- | --- | --- |
| N1 | 全角 ASCII（U+FF01–FF5E）与全角空格 → 半角 | `Ｓｅｒｖｌｅｔ` → `Servlet` | **新增**，修旧版「应为对却判错」 |
| N2 | 大小写折叠 | `POOLED` ≡ `pooled` | 旧版 `norm()` |
| N3 | 去除所有空白 | `" servlet "` → `servlet` | 旧版 `norm()` |
| N4 | 去除中英文引号与反引号 | `<%@ include file="" %>` ≡ `<%@ include file= %>` | 旧版 `norm()` |
| N5 | 中文标点折叠 `；→;`、`，、→,` | `；` ≡ `;` | 旧版 `norm()` |
| N6 | 自闭合标签等价 `<x/>` ≡ `<x>` | `<jsp:include page="" />` ≡ `<jsp:include page="">` | 旧版真实缺陷修复，**保留** |
| N7 | 去除尾部句号／点号 | `Servlet.` → `Servlet` | 旧版 `[。.]$`，放宽为多次 |
| N8 | 多答案分隔（仅作用于 `accepted`） | `Servlet\|HttpServlet` 拆成两个等价写法 | **新增**，见下方约束 |

### N8 的硬约束

只用 `|` / `｜` 拆分 `accepted`。**不按 `/`、`;`、`,` 拆**：题库里 `<jsp:include page="" />`、`<url-pattern>/x</url-pattern>`、`Class.forName()` 都含这些字符，自动拆分会把合法代码答案拆碎。多答案的首选承载方式仍是 S1 契约里的 `accepted` 数组本身。

实测数据：54 个填空空的 `accepted` 数组长度全部为 1，说明当前题库**没有**依赖分隔写法的答案；N8 是为将来内容扩展预留的显式规则，不是对现有数据的猜测。

## 3. 已知误判黑名单

`misjudgment-blacklist.ts` 固化 9 条，每条记录旧版实际结果、新版期望结果与原因，测试逐条断言「新版判定 === expected」且「残留数 = 0」。

| ID | 标准答案 | 输入 | 旧版 | 新版 | 类别 |
| --- | --- | --- | --- | --- | --- |
| FW-01 | `Servlet` | `Ｓｅｒｖｌｅｔ` | ✗ | ✓ | 对判为错 |
| SC-01 | `Servlet` | `ervlet` | ✓ | ✗ | 错判为对 |
| SC-02 | `HttpServletRequest` | `Request` | ✓ | ✗ | 错判为对 |
| SC-03 | `ResultSet` | `esult` | ✓ | ✗ | 错判为对 |
| SC-04 | `getSession()` | `Session` | ✓ | ✗ | 错判为对 |
| SC-05 | `insert` | `sert` | ✓ | ✗ | 错判为对 |
| SC-06 | `web.xml` | `xml` | ✓ | ✗ | 错判为对 |
| SC-07 | `@WebServlet` | `Web` | ✓ | ✗ | 错判为对 |
| SH-01 | `true` | `ru` | ✓ | ✗ | 错判为对 |

验收场景 3 的 " servlet " 与 "Ｓｅｒｖｌｅｔ" 均由 N1–N3 判为正确；`normalization.test.ts` 中另有专门用例。

## 4. 与旧版的行为差异登记（交 T2-9 复核）

| 变更 | 旧版 | 新版 | 是否有意 |
| --- | --- | --- | --- |
| 包含式匹配 | 有（`indexOf >= 0 && len >= 2`） | **取消** | 是，方案 §6-F 禁止 |
| 全角字母 | 不处理 | 转半角 | 是，修验收场景 3 |
| 尾部句号 | 只去 1 个 | 去连续多个 | 是，低风险 |
| `accepted` 多写法 | 无 | 支持 `\|` 分隔 | 是，规则显式 |
| 其余 N2–N6 | 一致 | 一致 | 行为不变 |

**不接受**任何"针对具体题目加个 if"或"再放宽一点"的修补。新增规则必须：先在清单里登记编号 → 补用例 → 复核黑名单不反弹。

## 5. 如何重跑

```bash
pnpm --filter @quiz/core test -- normalization
```

期望：`normalization.test.ts` 全绿，且「黑名单内 9 条已知误判，新版判定逐条等于 expected（0 条残留）」通过。
