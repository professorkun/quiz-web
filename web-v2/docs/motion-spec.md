# 动效规格（motion-spec）

配套文件：`apps/web/src/styles/motion.css`。组件只允许写 `var(--d-*)`；
每个动效类上方必须标注档位；`prefers-reduced-motion` 下全部关闭。
**高频档 > 160ms 直接打回。**

| 场景 | 档位 | 属性 | 时长变量 | 降级 |
| --- | --- | --- | --- | --- |
| 路由切页 | 低频 | opacity、translateY(4px) | `--d-emphasis`（240ms） | reduce / 旧浏览器直接显示 |
| 题目切换 | 高频 | opacity | `--d-fast`（120ms） | 直接切换 |
| 答案展开 | 高频 | opacity、translateY(-2px) | `--d-base`（160ms） | 直接展开 |
| hover-press | 高频 | transform: scale(0.985) | `--d-press`（80ms） | 无缩放 |
| 筛选抽屉 | 中频 | opacity、translateY(8px) | `--d-base`（160ms） | 直接出现 |
| 讲义切篇 | 高频 | opacity | `--d-fast`（120ms） | 直接切换 |
| 导航指示条 | 高频 | transform: scaleY | `--d-base`（160ms） | 直接显示竖条 |
| Toast | 低频 | opacity、translateY(6px) | `--d-emphasis`（240ms） | 直接出现/消失 |
| 骨架 | 循环 | background-position | `--d-slow × 4`（1280ms） | 静态灰块 |
| Logo 首屏 | 低频 | opacity、scale(0.96→1) | `--d-slow`（320ms） | 直接显示 |
| 交卷 | 低频 | opacity、scale(0.99→1) | `--d-emphasis`（240ms） | 直接显示成绩 |

## 评审三条

1. 每个动效类上方有 `/* 档位：… */` 注释。
2. 时长必须是 `var(--d-*)`，不得出现裸 `120ms` 这类写法。
3. `prefers-reduced-motion: reduce` 必须有覆盖，且覆盖后功能不依赖动画。
