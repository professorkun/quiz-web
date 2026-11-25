import type { Question } from "@quiz/core";

import { RichText } from "../../components/RichText";
import { Explanation, RevealBar } from "../shared";
import type { RendererProps } from "../types";
import { splitStem } from "../fill_blank/stem";

type Cloze = Extract<Question, { type: "cloze" }>;

/**
 * 完形 / 选词 / 七选五（R4-2）。
 *
 * 材料由页面解析后传入（整卷只传一次）；题面里的 `{{b1}}` 就地换成选择器，
 * 词库顺序**不洗牌**——顺序本身是题面信息（ADR-0003 的同类约束）。
 * `reuseOptions=false` 时，已被别的空占用的词在选择器里禁用；判分仍会再拦一次。
 */
export default function ClozeRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as Cloze;
  const answers =
    props.answer !== undefined &&
    typeof props.answer === "object" &&
    !Array.isArray(props.answer)
      ? (props.answer as Readonly<Record<string, string>>)
      : {};
  const revealing = props.reveal === true;
  const known = new Map(q.blanks.map((blank) => [blank.blankId, blank]));
  const optionText = new Map(q.sharedOptions.map((option) => [option.optionId, option.text]));

  const usedOptionIds = new Set(
    Object.values(answers).filter((value) => typeof value === "string" && value !== ""),
  );

  const change = (blankId: string, optionId: string): void => {
    const next = { ...answers };
    if (optionId === "") delete next[blankId];
    else next[blankId] = optionId;
    props.onChange(next);
  };

  return (
    <div className="cloze">
      {props.preview === true ? (
        <RevealBar open={revealing} onToggle={props.onToggleReveal} />
      ) : null}

      {props.passage === undefined ? null : (
        <section className="cloze-passage">
          <h3>{props.passage.title}</h3>
          <RichText text={props.passage.body} />
          {props.passage.source === undefined ? null : (
            <p className="muted">来源：{props.passage.source}</p>
          )}
        </section>
      )}

      <div className="cloze-pool" aria-label="备选词">
        {q.sharedOptions.map((option) => {
          const used = q.reuseOptions === false && usedOptionIds.has(option.optionId);
          return (
            <span key={option.optionId} className="cloze-chip" data-used={used ? "true" : "false"}>
              {option.text}
            </span>
          );
        })}
      </div>

      <div className="stem-with-blanks cloze-stem">
        {splitStem(q.stem).map((part, index) => {
          if (part.kind === "text") {
            return <RichText key={`t${index}`} text={part.text} inline />;
          }
          const blank = known.get(part.blankId);
          if (blank === undefined) {
            return <RichText key={`x${index}`} text={`{{${part.blankId}}}`} inline />;
          }
          const detail = props.grade?.details?.find((item) => item.key === part.blankId);
          const state =
            props.locked && detail !== undefined
              ? detail.correct
                ? "ok"
                : "no"
              : revealing
                ? "ok"
                : undefined;
          const selected = answers[part.blankId] ?? "";
          const usedElsewhere = new Set(
            Object.entries(answers)
              .filter(([key, value]) => key !== part.blankId && typeof value === "string" && value !== "")
              .map(([, value]) => value),
          );

          return (
            <span className="cloze-blank" key={part.blankId}>
              <select
                className={["cloze-select", revealing ? "revealed" : ""].filter(Boolean).join(" ")}
                aria-label={`空 ${part.blankId}`}
                data-state={state}
                value={revealing ? blank.optionId : selected}
                disabled={props.locked || revealing}
                onChange={(event) => change(part.blankId, event.target.value)}
              >
                <option value="">请选择</option>
                {q.sharedOptions.map((option) => (
                  <option
                    key={option.optionId}
                    value={option.optionId}
                    disabled={q.reuseOptions === false && usedElsewhere.has(option.optionId)}
                  >
                    {option.text}
                  </option>
                ))}
              </select>
              {state === "no" && !revealing ? (
                <span className="mark">答案：{optionText.get(blank.optionId) ?? blank.optionId}</span>
              ) : null}
            </span>
          );
        })}
      </div>

      <p className="muted">
        共 {q.blanks.length} 空
        {q.reuseOptions === false ? " · 每个词只能使用一次" : " · 同一选项可重复使用"}
      </p>

      <Explanation text={q.explanation} open={revealing} />
    </div>
  );
}
