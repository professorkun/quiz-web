import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";
import "./styles.css";

import { createRoot } from "react-dom/client";

import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
