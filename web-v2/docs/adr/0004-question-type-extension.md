# ADR-0004 · 题型扩展点：新增题型只加一个目录

- 状态：**S2 实施基线**（2026-11-16 定稿并落地；阶段验收时由项目负责人确认）
- 日期：2026-11-16
- 相关：`项目规划/03-S2` T2-1 / §5 / §8「题型扩展仍要改页面」、ADR-0002、`_build/template.html:702`（旧 `pAnswerArea`）、`:1658`（旧 `drillBody`）、`:902`（旧 `bindSelfEval`）

---

## 背景

旧版每加一种题型要改多少处？数一下 `template.html`：`pAnswerArea`（作答区）、`bindPaper`（事件绑定）、`gradePaper`（判分）、`drillBody`（刷题区）、`drillFb`（反馈）、`bindSelfEval`（自评）、`countUnanswered`（未答计数）——按 `q.type` 分支至少 7 处，而且分散在 1600 行的单文件里。旧版注释里还留着一次真实故障：

> `/* 自评按钮散落在各题卡（#pr{idx}）里，交卷后必须整页统一绑定，只扫成绩卡（#scoreArea）会一个都绑不到 —— 主观题 50 分将永远加不上 */`

S1 把数据契约抽出来了，但 `grade.ts` 仍是一个 `switch (q.type)`。若 S2 直接照这个形状往页面里写渲染，**每加一种题型就要同时改判分入口、练习页、反馈区、会话序列化**——阶段风险表里「加第 3 种题型时改了 5 个文件」就会原样重演。

## 决策

一种题型的全部知识收进**一个目录 + 一个注册项**，公共代码只认 `type` 查表，不写 `if/else`。

### 三段式

| 段 | 位置 | 内容 |
| --- | --- | --- |
| **Schema** | `packages/core/src/schema.ts` 的判别联合成员 | 该题型必填/可选字段，S1 已定稿 |
| **Grader** | `packages/core/src/questions/<type>/definition.ts` | `defineQuestionType({ type, label, schema, answerKind, shuffleOptions, selfAssess, grade })`，`grade` 是纯函数 |
| **Renderer** | `apps/web/src/renderers/<type>/Renderer.tsx` | React 组件，只负责收集作答，不含任何判分规则 |

`answerKind` / `shuffleOptions` / `selfAssess` 是**声明式元数据**：练习引擎据此决定如何洗牌、如何序列化作答、是否显示自评档位，而不是在页面里判断题型。

### 两个唯一入口

```ts
// core：判分只查表
gradeAnswer(question, answer, maxScore)
  → getQuestionType(question.type).grade(...)

// web：渲染器自动发现（Vite import.meta.glob，无需手工清单）
const modules = import.meta.glob("./**/Renderer.tsx", { eager: true });
```

`packages/core/src/questions/index.ts` 是**唯一装配点**（六个内置题型各一行）。它是 core 的组装文件，**不是页面文件**；`apps/web` 侧连装配清单都没有。

### 新增第七种题型的步骤

1. `packages/core/src/schema.ts`：给 `QuestionTypeSchema` 加成员、写该题型 Zod Schema、加进判别联合；`validate.ts` 的 `TYPE_KEYS` 补字段白名单。
   ⚠️ 这一步是**数据契约变更**，按 S2 §10 属容差外，必须在 `00` §9 变更登记，不能悄悄加。
2. `packages/core/src/questions/<new_type>/definition.ts`：一个 `defineQuestionType({...})`，含纯函数 `grade`。
3. `packages/core/src/questions/index.ts`：装配清单加一行（唯一需要改动的已有文件）。
4. `apps/web/src/renderers/<new_type>/Renderer.tsx`：一个组件，由 glob 自动发现。
5. `definition.test.ts`：正反例单测。

**不需要改**：练习页、练习引擎、会话序列化与恢复、安全渲染组件、判分入口、任何 `if/else`。核心不变式是 `apps/web` 里不出现 `q.type === ...`。

## 为什么 Schema 层不能"零改动"

Node 包没有模块自动发现能力，`core` 又禁一切 IO（ADR-0002），所以装配清单必须显式写。但更重要的是：新增题型意味着**新增一种数据契约**，它本来就应该是可审查、需要登记的显式变更，而不是"放个文件就自动生效"的隐式行为。把这一步藏起来，等于把 S1 辛苦建立的类型安全又丢掉。

所以本 ADR 的准确表述是：**新增题型 = 加两个目录 + 在契约与装配清单各登记一行；页面零改动**。T2-1 的完成判据（不改任何页面文件）成立，且不谎称"只加一个文件"。

## 强制手段

- `packages/core/src/questions/registry.test.ts` 注册一个契约外的假题型 `demo_rating`，真实走一遍 `gradeAnswer` 分派——只断言"六个内置都在"证明不了扩展点。
- `web-v2/scripts/check-extension-point.mjs` 静态扫描：`apps/web/src` 不得出现按题型的硬分派、不得直接调用判分器；`grade.ts` 不得出现 `switch (q.type)`；Schema 成员数 = 装配清单条数 = 渲染器目录数。
- 重复注册不同实现直接抛错，不允许"改了却不生效"的静默覆盖。

## 后果

**正面**：题型规则各自归位，Node 下可单测；Web 页面与题型数量解耦；未来 Android / 小程序复用同一份 `core` 注册表，只需各写一层渲染器（R-12）。

**代价**：多一层间接调用；`registry` 是模块级可变状态，靠"重复注册同一对象合法、不同实现抛错"约束，测试中可 `unregisterQuestionType` 清理。

**明确不做**：不做插件热加载、不做运行时动态题型、不改 S1 的六类判别联合语义。
