import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test-setup.ts"],
    // 路由懒加载 + 全量并行时，个别用例的首次 chunk 加载可能超过默认 5s
    testTimeout: 15_000,
  },
});
