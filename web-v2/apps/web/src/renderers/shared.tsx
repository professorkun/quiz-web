import { RichText } from "../components/RichText";
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
  /** 预览态显式查看答案：显示正确选项，但仍不接受作答 */
  readonly reveal?: boolean;
  /** 正确选项的 optionId，提交后用于高亮 */
  readonly correctIds: readonly string[];
  readonly onToggle: (optionId: string) => void;
}

/** 单选与多选共用的选项区：字母仅由下标生成，点击回传的是 optionId */
export function ChoiceOptions(props: ChoiceOptionsProps): React.ReactElement {
  const correct = new Set(props.correctIds);
  const selected = new Set(props.selected);
  const showAnswer = props.locked || props.reveal === true;
  return (
    <div className="opts" role={props.multiple ? "group" : "radiogroup"}>
      {props.options.map((option, index) => {
        const isSelected = selected.has(option.optionId);
        const isCorrect = correct.has(option.optionId);
        const cls = [
          "optbtn",
          isSelected ? "sel" : "",
          showAnswer && isCorrect ? "ok" : "",
          showAnswer && isSelected && !isCorrect ? "no" : "",
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
            {isSelected ? (
              <span className="opt-tick">
                <IconCheck size={16} />
              </span>
            ) : null}
            {showAnswer && isCorrect ? (
              <span className="mark">
                <IconCheck size={16} />
                正确答案
              </span>
            ) : null}
            {showAnswer && isSelected && !isCorrect ? (
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

/**
 * 查看答案开关（V2.1 · R2）。
 *
 * 放在选项框上方，而不是页面头部：用户的视线停留在题目上，
 * 开关离得越近，越不会误以为「点了就提交」。快捷键提示一并给出。
 */
export function RevealBar(props: {
  readonly open: boolean;
  readonly onToggle?: () => void;
}): React.ReactElement | null {
  if (props.onToggle === undefined) return null;
  return (
    <div className="reveal-bar">
      <button type="button" className="btn ghost sm" onClick={props.onToggle} aria-expanded={props.open}>
        {props.open ? "收起答案" : "查看答案"}
      </button>
      <span className="muted">空格键也可切换 · 查看答案不会产生作答记录</span>
    </div>
  );
}

/** 解析区块：只在显式查看答案时出现，避免预览态泄露答案（历史缺陷） */
export function Explanation(props: {
  readonly text: string | undefined;
  readonly open: boolean;
}): React.ReactElement | null {
  if (!props.open || props.text === undefined || props.text.trim() === "") return null;
  return (
    <div className="explanation reveal-explanation">
      <div className="ref-head">解析</div>
      <RichText text={props.text} />
    </div>
  );
}
