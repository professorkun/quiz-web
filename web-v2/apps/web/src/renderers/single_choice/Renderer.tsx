import type { Question } from "@quiz/core";

import { orderedOptions } from "../order";
import { ChoiceOptions, Explanation, RevealBar } from "../shared";
import type { RendererProps } from "../types";

type SingleChoice = Extract<Question, { type: "single_choice" }>;

/** 单选：作答存 optionId，与 A/B/C/D 展示字母无关 */
export default function SingleChoiceRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as SingleChoice;
  const options = orderedOptions(q.options, props.optionOrder);
  const selected = typeof props.answer === "string" ? [props.answer] : [];
  const revealing = props.reveal === true;
  return (
    <div>
      {props.preview === true ? (
        <RevealBar open={revealing} onToggle={props.onToggleReveal} />
      ) : null}
      <ChoiceOptions
        options={options}
        multiple={false}
        selected={selected}
        locked={props.locked}
        readOnly={props.preview === true}
        reveal={revealing}
        correctIds={revealing ? [q.answer] : []}
        onToggle={(optionId) => props.onChange(optionId)}
      />
      <Explanation text={q.explanation} open={revealing} />
    </div>
  );
}
