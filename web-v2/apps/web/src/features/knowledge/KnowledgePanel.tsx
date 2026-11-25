/**
 * 知识讲义面板（S7-E8）：左侧模块目录 + 右侧单篇精读。
 *
 * 之前是一个展开即全部渲染的 `<details>` 列表，7 篇一起展开后既长又没有导航，
 * 且正文一长就变成"无限长的一页"。改成一次只读一篇 + 目录常驻后，
 * "我现在在学第几节、还剩几节"才有答案。
 *
 * 阅读位置记在组件状态里即可：不写进学习记录。看讲义不是考试事件，
 * 写进 Attempt/Progress 反而会污染正确率统计口径。
 */

import { useMemo, useState } from "react";

import type { KnowledgeModule, Topic } from "@quiz/core";

import { LectureArticle } from "./LectureArticle";

export interface KnowledgePanelProps {
  readonly modules: readonly KnowledgeModule[];
  readonly topics: readonly Topic[];
  readonly onPractice: (topicId: string) => void;
  /**
   * 阅读位置的持久化前缀（一般传 bankId）。
   * 只存"当前在读哪一篇"这一条 UI 状态，不碰任何学习记录（A-7）。
   */
  readonly storageKey?: string;
}

const SELECTED_KEY = "quiz:lecture:selected";

function readSelected(storageKey: string | undefined): string | null {
  if (storageKey === undefined) return null;
  try {
    return globalThis.sessionStorage?.getItem(`${SELECTED_KEY}:${storageKey}`) ?? null;
  } catch {
    return null;
  }
}

function writeSelected(storageKey: string | undefined, moduleId: string): void {
  if (storageKey === undefined) return;
  try {
    globalThis.sessionStorage?.setItem(`${SELECTED_KEY}:${storageKey}`, moduleId);
  } catch {
    /* 隐私模式下存不了也无所谓：回落到第一篇即可 */
  }
}

export function KnowledgePanel(props: KnowledgePanelProps): React.ReactElement {
  const topicMap = useMemo(() => {
    const map = new Map<string, Topic>();
    for (const topic of props.topics) map.set(topic.topicId, topic);
    return map;
  }, [props.topics]);

  // 按 manifest 的 order 排，而不是按数组顺序：换了题库包也不会乱序
  const ordered = useMemo(() => {
    const list = [...props.modules];
    list.sort((a, b) => {
      const oa = topicMap.get(a.topicId)?.order ?? Number.MAX_SAFE_INTEGER;
      const ob = topicMap.get(b.topicId)?.order ?? Number.MAX_SAFE_INTEGER;
      return oa === ob ? a.title.localeCompare(b.title, "zh-CN") : oa - ob;
    });
    return list;
  }, [props.modules, topicMap]);

  // 首次挂载时读回上次选中的篇（A-4：刷新后仍在同一篇）；记录不在列表里就回第一篇
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    readSelected(props.storageKey),
  );
  const current =
    ordered.find((m) => m.moduleId === selectedId) ?? ordered[0];

  if (current === undefined) {
    return <p className="muted">这份题库还没配知识讲义。</p>;
  }

  return (
    <div className="lecture-layout">
      <nav className="lecture-nav" aria-label="讲义目录">
        {ordered.map((module, index) => {
          const topic = topicMap.get(module.topicId);
          const on = module.moduleId === current.moduleId;
          return (
            <button
              key={module.moduleId}
              type="button"
              className={on ? "lecture-nav-item on" : "lecture-nav-item"}
              aria-current={on ? "true" : undefined}
              onClick={() => {
                setSelectedId(module.moduleId);
                writeSelected(props.storageKey, module.moduleId);
                // 切篇后回到正文顶部，避免从上一篇的中段开始读
                document.getElementById("lecture-scroll")?.scrollTo?.({ top: 0 });
                globalThis.scrollTo?.({ top: 0, behavior: "auto" });
              }}
            >
              <span className="lecture-nav-seq">{index + 1}</span>
              <span className="lecture-nav-main">
                <span className="lecture-nav-title">{module.title}</span>
                <span className="muted small">
                  {topic?.name ?? ""}
                  {module.estimatedMinutes === undefined ? "" : ` · ${module.estimatedMinutes} 分钟`}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="lecture-scroll" id="lecture-scroll">
        {/* key 变化即重挂载，让切篇动效跟随「换篇」而不是每次页面渲染都播 */}
        <div className="motion-lecture" key={current.moduleId}>
          <LectureArticle
            module={current}
            topic={topicMap.get(current.topicId)}
            onPractice={props.onPractice}
          />
        </div>
      </div>
    </div>
  );
}
