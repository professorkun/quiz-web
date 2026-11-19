import type { Question } from "@quiz/core";

import { orderedOptions } from "../order";
import { ChoiceOptions } from "../shared";
import type { RendererProps } from "../types";

type MultipleChoice = Extract<Question, { type: "multiple_choice" }>;

/** 多选：作答存 optionId[]，切换顺序不影响判分 */
export default function MultipleChoiceRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as MultipleChoice;
  const options = orderedOptions(q.options, props.optionOrder);
  const selected = Array.isArray(props.answer) ? props.answer.map(String) : [];
  const toggle = (optionId: string): void => {
    const next = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
    props.onChange(next);
  };
  return (
    <ChoiceOptions
      options={options}
      multiple
      selected={selected}
      locked={props.locked}
      readOnly={props.preview === true}
      correctIds={props.preview === true ? [] : q.answer}
      onToggle={toggle}
    />
  );
}
