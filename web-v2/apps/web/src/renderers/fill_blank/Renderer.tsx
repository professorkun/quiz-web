import type { Question } from "@quiz/core";

import { RichText } from "../../components/RichText";
import { Explanation, RevealBar } from "../shared";
import type { RendererProps } from "../types";
import { splitStem } from "./stem";

type FillBlank = Extract<Question, { type: "fill_blank" }>;

/** 普通填空：题干里的 {{blankId}} 就地变成输入框，作答按 blankId 存，不按出现顺序存 */
export default function FillBlankRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as FillBlank;
  const answers =
    props.answer !== undefined &&
    typeof props.answer === "object" &&
    !Array.isArray(props.answer)
      ? (props.answer as Readonly<Record<string, string>>)
      : {};
  const known = new Map(q.blanks.map((b) => [b.blankId, b]));
  const revealing = props.reveal === true;

  return (
    <div>
      {props.preview === true ? (
        <RevealBar open={revealing} onToggle={props.onToggleReveal} />
      ) : null}
      <div className="stem-with-blanks">
        {splitStem(q.stem).map((part, index) => {
          if (part.kind === "text") {
            return <RichText key={`t${index}`} text={part.text} inline />;
          }
          const blank = known.get(part.blankId);
          if (blank === undefined) {
            return <RichText key={`x${index}`} text={`{{${part.blankId}}}`} inline />;
          }
          const detail = props.grade?.details?.find((d) => d.key === part.blankId);
          // 预览态没有判分明细：查看答案时直接展示该空的全部可接受写法
          const showAccepted = revealing || (props.locked && detail?.correct === false);
          const cls = [
            "blankin",
            props.locked && detail ? (detail.correct ? "ok" : "no") : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <span className="blank-wrap" key={part.blankId}>
              <input
                className={cls}
                aria-label={`空 ${part.blankId}`}
                autoComplete="off"
                spellCheck={false}
                disabled={props.locked}
                value={answers[part.blankId] ?? ""}
                onChange={(event) =>
                  props.onChange({ ...answers, [part.blankId]: event.target.value })
                }
              />
              {showAccepted ? (
                <span className="mark">答案：{blank.accepted.join(" / ")}</span>
              ) : null}
            </span>
          );
        })}
      </div>
      <Explanation text={q.explanation} open={revealing} />
    </div>
  );
}
