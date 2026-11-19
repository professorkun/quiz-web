import type { Question } from "@quiz/core";

import { orderedOptions } from "../order";
import { ChoiceOptions } from "../shared";
import type { RendererProps } from "../types";

type SingleChoice = Extract<Question, { type: "single_choice" }>;

/** 单选：作答存 optionId，与 A/B/C/D 展示字母无关 */
export default function SingleChoiceRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as SingleChoice;
  const options = orderedOptions(q.options, props.optionOrder);
  const selected = typeof props.answer === "string" ? [props.answer] : [];
  return (
    <ChoiceOptions
      options={options}
      multiple={false}
      selected={selected}
      locked={props.locked}
      readOnly={props.preview === true}
      correctIds={props.preview === true ? [] : [q.answer]}
      onToggle={(optionId) => props.onChange(optionId)}
    />
  );
}
