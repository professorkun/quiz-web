import { configure } from "@testing-library/dom";

/**
 * 路由分包后，页面在首次导航时动态加载。
 * 全量并行测试时 CPU 竞争会让 lazy chunk 偶尔超过默认 1000ms 的等待窗口，
 * 这里把异步查询上限放宽到 5s；真实回归（页面报错/白屏）依然会失败。
 */
configure({ asyncUtilTimeout: 5000 });
