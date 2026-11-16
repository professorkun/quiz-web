import {
  SELF_RATING_LEVELS,
  makeSelfRating,
  rubricMaxScore,
  type Question,
  type SelfRatingLevel,
} from "@quiz/core";

import { RichText } from "../../components/RichText";
import type { RendererProps } from "../types";

type ShortAnswer = Extract<Question, { type: "short_answer" }>;

const LABEL: Readonly<Record<SelfRatingLevel, string>> = {
  full: "全对",
  half: "一半",
  none: "没答对",
};

/**
 * 简答：作答原文存在 `answer`，自评档位存在 `selfRating`，两者互不相干。
 * 自评按钮就在本组件里、随组件一起挂载，不存在旧版"整页扫描才绑得上"的漏绑风险。
 */
export default function ShortAnswerRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as ShortAnswer;
  const text = typeof props.answer === "string" ? props.answer : "";
  const maxScore = rubricMaxScore(q);
  const current = props.selfRating?.level;

  return (
    <div className="short-answer">
      <textarea
        className="answer-text"
        aria-label="简答作答"
        placeholder="写下你的答案要点，提交后对照参考答案自评…"
        value={text}
        disabled={props.locked}
        onChange={(event) => props.onChange(event.target.value)}
      />

      {props.locked ? (
        <>
          <div className="ref-answer">
            <div className="ref-head">
              参考答案 · {q.rubric.length} 个采分点 · 合计 {Math.round(maxScore * 100) / 100} 分
            </div>
            <ol>
              {q.rubric.map((point) => (
                <li key={point.pointId}>
                  <RichText text={point.text} inline />（{point.score} 分）
                </li>
              ))}
            </ol>
            {q.explanation ? <RichText text={q.explanation} className="explanation" /> : null}
          </div>

          <div className="self-eval" role="group" aria-label="自评档位">
            <span className="self-label">对照答案自评：</span>
            {SELF_RATING_LEVELS.map((level) => {
              const rating = makeSelfRating(level, maxScore);
              return (
                <button
                  key={level}
                  type="button"
                  className={["self-btn", current === level ? "on" : "", level].filter(Boolean).join(" ")}
                  aria-pressed={current === level}
                  onClick={() => props.onSelfRating?.(level)}
                >
                  {LABEL[level]} {Math.round(rating.score * 100) / 100} 分
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
