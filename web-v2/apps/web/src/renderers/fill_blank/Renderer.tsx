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
          // 查看答案时答案直接进输入框；只有练习答错才在框旁保留对照，避免答案出现两次
          const showAccepted = !revealing && props.locked && detail?.correct === false;
          const cls = [
            "blankin",
            props.locked && detail ? (detail.correct ? "ok" : "no") : "",
            revealing ? "revealed" : "",
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
                value={revealing ? (blank.accepted[0] ?? "") : (answers[part.blankId] ?? "")}
                title={
                  revealing && blank.accepted.length > 1
                    ? `其他写法：${blank.accepted.slice(1).join(" / ")}`
                    : undefined
                }
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
