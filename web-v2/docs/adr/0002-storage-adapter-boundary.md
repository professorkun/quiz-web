# ADR-0002 · 存储与平台适配器边界

- 状态：**已采纳（Accepted）** 2026-11-16
- 日期：2026-11-16
- 相关：`02-S1` 验收 §C「静态扫描确认 `core` 未 import React / Dexie / wx.* / DOM API」

---

## 背景

旧版把三种东西搅在一个 `template.html` 里：**数据契约（题库结构）**、**业务逻辑（判分/组卷）**、**运行环境（DOM、`localStorage`、WorkBuddy 云 SDK）**。

由此产生两个已经发生的后果：

1. 换题库要改业务源码（`POINTS`、7 个知识点、`buildPaper()` 的卷面结构全写死在页面里）
2. 无法单测——判分逻辑与 `innerHTML` 渲染绑在一起，只能靠人点页面

未来还要落三端：Web（React+Dexie）、Android（S8）、微信小程序 2MB 主包限制（S9）。如果 `core` 里有一行 `window` 或 `wx.*`，三端就是三份分叉代码。

## 决策

按"依赖只能向内"分层，边界用**目录 + 静态扫描**双重保证：

```
apps/web      ──→ platform/web    ──→ platform（接口）  ──→ core（纯函数）
                                  └→ platform 的 IndexedDB / 云 SDK 实现
```

| 层 | 允许 | 禁止 | 理由 |
| --- | --- | --- | --- |
| `core` | 纯 TS、Zod、纯函数 | React、DOM API、`localStorage`、Dexie、`wx.*`、`fetch`、`Date.now()` 直接用于业务判定 | 必须能在 Node 里单测；必须三端复用 |
| `platform` | 定义接口：`QuestionStore`、`ProgressStore`、`AuthAdapter`、`Clock` | 包含题型/判分/组卷的业务规则 | 换存储不换逻辑 |
| `platform/web` | IndexedDB / 云 SDK / 浏览器 API | 同上 | Web 端实现 |
| `apps/web` | React、路由、渲染、事件 | 直接读写 IndexedDB（必须经 `platform`） | 渲染可替换 |

**`Clock` 必须注入**，不直接用 `Date.now()`。否则"最近 7 天复习"这类统计无法测试，也无法在小程序里统一时区。

**内容不从代码里取**：`core` 不 import 任何题库内容。内容由 `packages/content/*` 提供，通过参数传入。这样"换题库只换配置"才是真的。

## 如何强制执行（不靠自觉）

1. **ESLint 规则**：`core` 目录禁 `no-restricted-imports`（react、dexie、zustand…）+ 禁 `no-restricted-globals`（window、document、localStorage、wx）
2. **CI 静态扫描**：`grep -rE "from ['\"](react|dexie)" packages/core` 必须为空；`grep -rE "\b(window|document|localStorage|wx\.)" packages/core` 必须为空
3. **Node 单测**：`core` 的 Vitest 用例在 `environment: 'node'` 下跑。只要有一行 DOM 依赖，测试直接失败——比扫描更硬

第 3 条是最有效的：**测试环境本身就是边界检查**。

## 备选方案与不选的理由

| 方案 | 为什么不选 |
| --- | --- |
| 全放一个包，靠命名区分 | 旧版就是这么做的，已经证明会烂在一起 |
| 用 React Context 当"适配器" | 把边界绑死在 React 上，S8/S9 无法复用 |
| 为每端各写一套业务逻辑 | 三份判分规则必然分叉，错题统计口径会不一致 |

## 后果

**好处**：判分/组卷可在 Node 里测；三端复用同一份 `core`；换存储（云 → 本地 → 小程序缓存）只实现接口。

**代价**：初期代码量增加（接口 + 两套实现）；`Clock`/`Store` 注入让调用链变长，写起来不如"直接 `localStorage.getItem`"顺手。这个代价是**故意付的**——旧版那 43 条错题和 91 条掌握记录的串号风险，正是"图顺手"的代价。
