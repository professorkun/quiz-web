import type { Question } from "@quiz/core";

import { orderedOptions } from "../order";
import { ChoiceOptions, Explanation, RevealBar } from "../shared";
import type { RendererProps } from "../types";

type MultipleChoice = Extract<Question, { type: "multiple_choice" }>;

/** 多选：作答存 optionId[]，切换顺序不影响判分 */
export default function MultipleChoiceRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as MultipleChoice;
  const options = orderedOptions(q.options, props.optionOrder);
  const selected = Array.isArray(props.answer) ? props.answer.map(String) : [];
  const revealing = props.reveal === true;
  const toggle = (optionId: string): void => {
    const next = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
    props.onChange(next);
  };
  return (
    <div>
      {props.preview === true ? (
        <RevealBar open={revealing} onToggle={props.onToggleReveal} />
      ) : null}
      <ChoiceOptions
        options={options}
        multiple
        selected={selected}
        locked={props.locked}
        readOnly={props.preview === true}
        reveal={revealing}
        correctIds={revealing ? q.answer : []}
        onToggle={toggle}
      />
      <Explanation text={q.explanation} open={revealing} />
    </div>
  );
}
