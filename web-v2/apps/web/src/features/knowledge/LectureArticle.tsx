/**
 * 讲义正文（S7-E8）：一篇模块的精读视图。
 *
 * 结构固定为「元信息 → 学习目标 → 正文小节 → 视频 → 易错点 → 拓展 → 去练这一节」，
 * 与 `lectures/*.md` 的 front matter 一一对应——内容加什么，界面就长什么，
 * 不为单篇讲义写特例分支。
 */

import type { KnowledgeModule, Topic } from "@quiz/core";

import { RichText } from "../../components/RichText";
import { VideoCard } from "./VideoCard";

export interface LectureArticleProps {
  readonly module: KnowledgeModule;
  readonly topic: Topic | undefined;
  /** 「去练这一节」：只练这个知识点下的题，练完回到刷题页 */
  readonly onPractice: (topicId: string) => void;
}

export function LectureArticle(props: LectureArticleProps): React.ReactElement {
  const { module, topic } = props;
  // 数组字段兜底：契约保证「经过 Zod 校验的数据」这些字段齐全，但 UI 也面对
  // 未经校验的原始数据（旧版迁移讲义、测试夹具只有 items），缺字段时按空数组渲染，
  // 而不是让 .length 抛异常把整页打崩。
  const sections = module.sections ?? [];
  const videos = module.videos ?? [];
  const goals = module.goals ?? [];
  const pitfalls = module.pitfalls ?? [];
  const resources = module.resources ?? [];
  const items = module.items ?? [];
  const showToc = sections.length >= 6;

  return (
    <article className="lecture">
      <header className="lecture-head">
        {/* 标题前缀主题名：导航行也展示纯标题，两处同名会让按文本精确匹配的
            既有用例（app.test.tsx 的 findByText）一次命中两个元素而失败；
            前缀让"当前篇标题"只在导航精确出现。主题名与标题相同时不重复前缀。 */}
        <h2>
          {topic !== undefined && topic.name !== module.title
            ? `${topic.name} · ${module.title}`
            : module.title}
        </h2>
        <p className="muted">{module.summary}</p>
        <div className="lecture-meta">
          {module.estimatedMinutes === undefined ? null : (
            <span className="badge">约 {module.estimatedMinutes} 分钟</span>
          )}
          {sections.length === 0 ? null : <span className="badge">{sections.length} 节</span>}
          {videos.length === 0 ? null : <span className="badge">含 {videos.length} 个视频</span>}
        </div>
        {module.examFocus === undefined ? null : (
          <p className="notice small">考试侧重：{module.examFocus}</p>
        )}
      </header>

      {goals.length === 0 ? null : (
        <section className="lecture-block">
          <h3>学完你应该能做到</h3>
          <ol className="lecture-goals">
            {goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ol>
        </section>
      )}

      {items.length === 0 ? null : (
        <section className="lecture-block">
          <h3>{sections.length === 0 ? "要点" : "一分钟速览"}</h3>
          <ul className="lecture-goals">
            {items.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span> — {item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showToc ? (
        <nav className="lecture-toc" aria-label="本节目录">
          <strong>目录</strong>
          <ol>
            {sections.map((section, index) => (
              <li key={`${module.moduleId}-${index}`}>
                {/* hash 路由下不能真的改 location.hash（#sec-2 会被 parseRoute 当未知路由
                    弹回"学习"页），所以保留 href 供识别/复制，点击改走 scrollIntoView */}
                <a
                  href={`#sec-${index}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document
                      .getElementById(`sec-${index}`)
                      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                  }}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {sections.map((section, index) => (
        <section className="lecture-block" key={`${module.moduleId}-${index}`} id={`sec-${index}`}>
          <h3>{section.title}</h3>
          <RichText text={section.body} />
        </section>
      ))}

      {videos.length === 0 ? null : (
        <section className="lecture-block">
          <h3>配套视频</h3>
          <p className="muted small">
            视频是外部资源：断网时打不开，但上面的文字讲义不受影响。点播放才会联网加载。
          </p>
          {videos.map((video) => (
            <VideoCard key={video.url} video={video} />
          ))}
        </section>
      )}

      {pitfalls.length === 0 ? null : (
        <section className="notice lecture-pitfalls">
          <h3>易错点</h3>
          <ul>
            {pitfalls.map((pitfall) => (
              <li key={pitfall}>{pitfall}</li>
            ))}
          </ul>
        </section>
      )}

      {resources.length === 0 ? null : (
        <section className="lecture-block">
          <h3>拓展阅读</h3>
          <ul className="lecture-resources">
            {resources.map((resource) => (
              <li key={resource.url}>
                <a href={resource.url} target="_blank" rel="noreferrer">
                  {resource.title}
                </a>
                {resource.note === undefined ? null : <span className="muted"> — {resource.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="lecture-foot">
        <button type="button" className="btn" onClick={() => props.onPractice(module.topicId)}>
          去练「{topic?.name ?? module.title}」这一节
        </button>
        <span className="muted small">只会练这个知识点下的题，其余设置保持不变</span>
      </footer>
    </article>
  );
}
