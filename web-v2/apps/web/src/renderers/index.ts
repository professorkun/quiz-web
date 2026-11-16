import type { ComponentType } from "react";

import type { RendererProps } from "./types";

/**
 * 渲染器自动发现（ADR-0004）。
 *
 * 新增题型只要放一个 `<type>/Renderer.tsx`，这里和所有页面文件都不用改。
 * 若这里改成手写清单，扩展点就退化成"每加一个题型改一处"，
 * `check-extension-point.mjs` 会把这种情况拦下来。
 */
const modules = import.meta.glob<{ default: ComponentType<RendererProps> }>(
  "./**/Renderer.tsx",
  { eager: true },
);

const registry: Record<string, ComponentType<RendererProps>> = {};
for (const [path, mod] of Object.entries(modules)) {
  const match = /^\.\/([^/]+)\/Renderer\.tsx$/.exec(path);
  if (match?.[1] !== undefined && mod.default !== undefined) {
    registry[match[1]] = mod.default;
  }
}

export const rendererRegistry: Readonly<Record<string, ComponentType<RendererProps>>> = registry;

export function getRenderer(type: string): ComponentType<RendererProps> {
  const renderer = registry[type];
  if (renderer === undefined) {
    throw new Error(
      `题型「${type}」没有渲染器，请新增 apps/web/src/renderers/${type}/Renderer.tsx`,
    );
  }
  return renderer;
}

export function listRendererTypes(): readonly string[] {
  return Object.keys(registry).sort();
}
