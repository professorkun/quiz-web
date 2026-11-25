// KaTeX / highlight.js 的样式跟随各自 JS 懒加载（math.ts / highlighter.ts），
// 首屏不为「可能用不到」的公式与代码高亮付 CSS 渲染阻塞成本。
import "./styles.css";
import "./styles/motion.css";

import { createRoot } from "react-dom/client";

import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
