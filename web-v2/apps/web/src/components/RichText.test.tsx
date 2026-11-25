// @vitest-environment jsdom
/**
 * RichText 两帧渲染的组件级证据（P3）。
 *
 * 这里验证的不只是「公式能渲染」，还包括「不该渲染的别渲染」：
 * 行内 $ 的判定与 renderRichText 共用 scanMath，JSP EL 不应触发 KaTeX。
 */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RichText } from "./RichText";

afterEach(cleanup);

describe("RichText 公式两帧（P3）", () => {
  it("行内 $x^2$：第二帧渲染 KaTeX", async () => {
    const { container } = render(<RichText text="由 $x^2$ 可得" inline />);
    await waitFor(() => {
      expect(container.querySelector(".katex")).not.toBeNull();
    });
  });

  it("JSP EL 不触发公式：保持原文输出", async () => {
    const source = "路径 ${pageContext.request.contextPath} 结束";
    const { container } = render(<RichText text={source} inline />);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("${pageContext.request.contextPath}");
  });
});
