# 题斋 V2.1–V2.3 验收记录

- 日期：2026-11-20
- 分支：`feat/v2.1`
- 命令：`cd web-v2 && pnpm verify`
- 结果：边界/扩展点/构建/测试全绿（core 206、data 44、platform-web 30、web 103）

## A1–E3 清单

| 编号 | 验收项 | 结果 | 证据 |
| --- | --- | --- | --- |
| A1 | 只含课程链接的讲义可导入 | ✅ | `packages/core/src/validate.test.ts`「只含课程链接的讲义可导入」 |
| A2 | 讲义报错为中文且带字段路径 | ✅ | `validate.test.ts`「Zod 报错为中文，并带字段路径」等 3 条 |
| A3 | JSON 主位、Word 带 Beta | ✅ | [import-panel.jpg](evidence/import-panel.jpg) + `BankImportPanel.test.tsx` |
| A4 | 提示词 v2 产物零错误导入 | ✅ | `importPrompt.test.ts`（README 逐字一致）+ `docx.test.ts`「草稿导出再导入零错误」 |
| A5 | 带 tags/difficulty 的题库可导入 | ✅ | `validate.test.ts`「带 tags / difficulty 的题库可导入」 |
| A6 | 20 题 docx 识别 ≥ 90% | ✅ 20/20 | `apps/web/src/content/docx.test.ts` |
| A7 | 解析不阻塞主线程、主包 +≤5KB | ✅ | Worker 解析（`docxWorker.ts`）；当时主包 gzip 298.76→300.75 KB（+1.99 KB） |
| B1 | 每题独立查看答案，6 型均可见 | ✅ | `all-renderers.test.tsx` 6 条 reveal 用例 |
| B2 | 不产生作答记录，键盘可操作 | ✅ | `app.test.tsx`「查看答案不产生作答记录，J/K 在筛选结果内连续翻题」 |
| B3 | J/K 可翻看、末题有提示 | ✅ | 同上（含「已经是筛选结果的第一题」边界） |
| C1 | 题库可导入可删除，确认框列四类条数 | ✅ | `app.test.tsx`「删除导入题库…」；`DeleteBankDialog` |
| C2 | 删除后 8 类键清空，当前库切换 | ✅ | `platform.test.ts`「八个键类全部清空，当前库自动切到剩余题库」 |
| D1 | 6 种英语题型映射导入并可筛选 | ✅ | `importPrompt.test.ts` 映射断言 + `app.test.tsx`「按标签筛选」 |
| D2 | 无任何听力入口 | ✅ | `apps/web/src` 检索 `听力/audio/listening`：仅提示词测试断言「不导入听力」 |
| E1 | 题斋名称与 Logo 全站一致 | ✅ | [app-booted.jpg](evidence/app-booted.jpg)、[me-page.jpg](evidence/me-page.jpg)（真实浏览器） |
| E2 | 11 条动效按档、reduce 下无动画 | ✅ | [motion-spec.md](motion-spec.md) + `styles/motion.css`（档位注释、变量时长、reduce 覆盖） |
| E3 | Lighthouse ≥ 90，JS/CSS 在预算内 | ✅ 98 | [lighthouse-mobile.json](evidence/lighthouse-mobile.json) |

## E3 实测

移动端模拟（`lighthouse@12`，`form-factor=mobile`，`throttling-method=simulate`，本地静态服务开启 gzip + hashed 资源长缓存）：

| 指标 | 结果 |
| --- | --- |
| Performance | **98** |
| FCP / LCP | 1.8 s / 2.0 s |
| TBT | 0 ms |
| CLS | **0** |
| 首屏 JS（index gzip） | 73.29 KB（≤280） |
| 首屏 CSS（gzip） | 8.18 KB（≤25；KaTeX / highlight 样式随各自 JS 懒加载） |

说明：若静态服务不开启 gzip/缓存，Performance 会掉到 81（FCP 3.6 s）——这是服务器配置问题，不是产物超预算；部署时需开启压缩与静态资源缓存。

## 16px favicon

[favicon-16-upscaled.png](evidence/favicon-16-upscaled.png) 是把 `brand/logo-16.svg` 按 16px 栅格化后放大 10 倍的像素图：印面、折角与「斋」字均可辨认，**无需**切换到 `logo-16-plain.svg`。

## 未覆盖 / 待真机

- **中端安卓真机 + 4× CPU 节流**：本机只有 Chrome 模拟节流，未做真机帧率与滚动实测。
- **多设备截屏**：6 个渲染器的查看答案以自动化用例取证，未逐型截屏。
- **安装态 PWA**：改名后已安装用户可能看到两个图标；`start_url` 未变，数据不丢，发布说明中已告知重装。
