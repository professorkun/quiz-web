import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * `base: "./"` 是刻意的：构建产物不依赖任何 CDN / 云端，
 * 放在任意静态目录（含离线本地服务）都能跑，满足 S2「无云依赖、断网可练习」。
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
