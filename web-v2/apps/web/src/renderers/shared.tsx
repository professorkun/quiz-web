import type { Option } from "@quiz/core";

import { IconCheck, IconClose } from "../ui/icons";
import { optionLetter } from "./letters";

export interface ChoiceOptionsProps {
  readonly options: readonly Option[];
  readonly multiple: boolean;
  /** 已选中的 optionId（单选最多一个） */
  readonly selected: readonly string[];
  readonly locked: boolean;
  /** 只读预览：禁用但不降透明度，也不显示对错标记 */
  readonly readOnly?: boolean;
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
          props.locked && props.readOnly !== true && isCorrect ? "ok" : "",
          props.locked && props.readOnly !== true && isSelected && !isCorrect ? "no" : "",
          props.locked && props.readOnly !== true ? "dis" : "",
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
            {props.locked && props.readOnly !== true && isCorrect ? (
              <span className="mark">
                <IconCheck size={16} />
                正确答案
              </span>
            ) : null}
            {props.locked && props.readOnly !== true && isSelected && !isCorrect ? (
              <span className="mark">
                <IconClose size={16} />
                你的选择
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
