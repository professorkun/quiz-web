import type { Option } from "@quiz/core";

import { optionLetter } from "./letters";

export interface ChoiceOptionsProps {
  readonly options: readonly Option[];
  readonly multiple: boolean;
  /** 已选中的 optionId（单选最多一个） */
  readonly selected: readonly string[];
  readonly locked: boolean;
  /** 正确选项的 optionId，提交后用于高亮 */
  readonly correctIds: readonly string[];
  readonly onToggle: (optionId: string) => void;
}

/** 单选与多选共用的选项区：字母仅由下标生成，点击回传的是 optionId */
export function ChoiceOptions(props: ChoiceOptionsProps): React.ReactElement {
  const correct = new Set(props.correctIds);
  const selected = new Set(props.selected);
  return (
    <div className="opts" role={props.multiple ? "group" : "radiogroup"}>
      {props.options.map((option, index) => {
        const isSelected = selected.has(option.optionId);
        const isCorrect = correct.has(option.optionId);
        const cls = [
          "optbtn",
          isSelected ? "sel" : "",
          props.locked && isCorrect ? "ok" : "",
          props.locked && isSelected && !isCorrect ? "no" : "",
          props.locked ? "dis" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={option.optionId}
            type="button"
            className={cls}
            aria-pressed={isSelected}
            disabled={props.locked}
            onClick={() => props.onToggle(option.optionId)}
          >
            <span className="k">{optionLetter(index)}</span>
            <span className="txt">{option.text}</span>
            {props.locked && isCorrect ? <span className="mark">✓ 正确</span> : null}
            {props.locked && isSelected && !isCorrect ? <span className="mark">✕ 你的选择</span> : null}
          </button>
        );
      })}
    </div>
  );
}
