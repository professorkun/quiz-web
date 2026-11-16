# ADR-0005 · 存储接口用键值抽象，不暴露 IndexedDB 特性

- 状态：**已采纳（Accepted）** 2026-11-16
- 日期：2026-11-16
- 相关：`04-S3` §3「`StorageAdapter` 接口方法集」、§5 交付物「存储接口 ADR」、§8 风险「存储接口被 Dexie 特性绑架」

---

## 背景

S3 要给游客提供本地持久化。候选实现是 Dexie（IndexedDB 包装），但接口一旦照着 Dexie 的形状设计，就会连带把下面这些东西泄漏到业务层：

- 游标（`each`、`offset`、`limit`）
- 索引与复合索引（`[bankId+questionId]`）
- 事务边界（`db.transaction("rw", ...)`）

这三样在 Web 端很自然，但：

1. **小程序没有 IndexedDB**，只有 `wx.storage`（单键 1MB / 总量 10MB，无索引、无事务）。接口若有游标，S9 就得重写接口 → 三端逻辑分叉（R-12）。
2. **未来接云**（S6）时，游标语义与网络分页语义不同，接口若已固化游标，云端实现会变成"假装有游标"。
3. **测试成本**：接口带索引/事务，单测就必须拉起 IndexedDB，Node 环境跑不了——而 ADR-0002 已经把"Node 里能测"定为硬约束。

同时 S3 要求「业务代码不直接 import Dexie，只通过适配器访问存储」。所以真正要设计的不是"如何包一层 Dexie"，而是**业务到底需要哪几种查询**。

## 决策

**接口只表达业务查询，不表达存储机制。**

| 业务需要 | 接口方法 | 不采用 |
| --- | --- | --- |
| 取本库全部作答事件 | `attempts.listByBank(bankId)` | `where("bankId").equals(id).toArray()` |
| 取某题历史 | `attempts.listByQuestion(bankId, qid)` | 复合索引 + 游标 |
| 追加事件 | `attempts.append(attempt)` | `put` / `bulkPut`（后者会覆盖） |
| 取本库进度 | `progress.listByBank(bankId)` | 按 `mastered` 索引过滤 |
| 收藏 | `favorites.add/remove/has/listByBank` | 在 Progress 上挂 `favorite` 布尔 |
| 设置 | `settings.getApp/saveApp/getPractice/savePractice` | 一张 `settings` 表 + 任意查询 |
| 存储健康度 | `platform.info()` | 直接读 `navigator.storage.estimate()` |

**实现方式**：底层只要求一个键值能力（`get / set / delete / keys(prefix)`），仓储在它上面拼装。这样：

- Web 端实现用 IndexedDB 的 `getAllKeys` + `IDBKeyRange` 做前缀扫描，**索引/游标全部留在实现内部**；
- 单测用内存实现，Node 直接跑，不需要 `fake-indexeddb`；
- 小程序端只需把键值能力换成 `wx.getStorage/setStorage/removeStorage`，仓储代码一行不改；
- 云端口径是"按库拉取全量再本地过滤"或"服务端按库查询"，接口形状不变。

**筛选、排序、分页放在上层**（页面或 `core` 的纯函数里），因为它们属于业务口径；一旦下沉到存储层，三端就会出现三套筛选规则。

## 备选方案与不选的理由

| 方案 | 为什么不选 |
| --- | --- |
| 直接暴露 Dexie 的 `Table<Attempt>` | 业务层立刻开始写 `where/orderBy`，S9 必然重写；且违反 S3 验收 E |
| 只做一个 `get/set` 大对象（整库一个 JSON） | 每次作答重写全量，题量上来后写入放大；且并发写会互相覆盖 |
| 接口带事务 | 小程序无事务；为了"看起来严谨"引入一个三端只有一端能实现的保证 |
| 引入 `fake-indexeddb` 做单测 | 能测实现，测不出业务口径；且多一个依赖只为了模拟浏览器 |

## 后果

**好处**

- 业务只认识 `bankId / questionId` 两种坐标，串库风险在接口层就被"查询必带库"堵住（S3 R「记录串库」的直接对策）。
- 单测在 Node 里跑的是**同一份仓储代码**，不是替身。
- 换端只换键值实现。

**代价**

- "取本库全部作答"是全量加载，题量到几千条时要靠上层缓存。当前 147 题、单用户，量级不构成问题；S6 接云时再按需加分页查询（新增方法，不改旧方法）。
- 前缀扫描比索引查询慢一个量级，但它跑在 `getAllKeys` 上，本地仍是毫秒级。

## 强制执行

1. `packages/platform/src` 静态扫描：不得出现 `IDBDatabase`、`Dexie`、`cursor`、`transaction` 字样。
2. `packages/platform/web` 之外的任何包不得 import `idb` / `dexie`。
3. 仓储单测在 `environment: "node"` 下跑，用内存键值实现——实现层若偷偷依赖浏览器，测试直接红（同 ADR-0002 第 3 条）。
