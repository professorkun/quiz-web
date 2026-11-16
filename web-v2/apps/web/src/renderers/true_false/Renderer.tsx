import type { Question } from "@quiz/core";

import type { RendererProps } from "../types";

type TrueFalse = Extract<Question, { type: "true_false" }>;

/** 固定「正确 / 错误」两项，不洗牌（ADR-0003）；作答存布尔值，不存 √/× */
const ITEMS = [
  { value: true, label: "√ 正确" },
  { value: false, label: "× 错误" },
] as const;

export default function TrueFalseRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as TrueFalse;
  const selected = typeof props.answer === "boolean" ? props.answer : undefined;
  return (
    <div className="tf" role="radiogroup">
      {ITEMS.map((item) => {
        const isSelected = selected === item.value;
        const isCorrect = q.answer === item.value;
        const cls = [
          "tfb",
          isSelected ? "sel" : "",
          props.locked && isCorrect ? "ok" : "",
          props.locked && isSelected && !isCorrect ? "no" : "",
          props.locked ? "dis" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={item.label}
            type="button"
            className={cls}
            aria-pressed={isSelected}
            disabled={props.locked}
            onClick={() => props.onChange(item.value)}
          >
            {item.label}
            {props.locked && isCorrect ? <span className="mark"> ✓ 正确</span> : null}
          </button>
        );
      })}
    </div>
  );
}
