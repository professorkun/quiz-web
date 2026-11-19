import { blankDetailMap, buildCodeStructure, type Question } from "@quiz/core";

import type { RendererProps } from "../types";

type CodeBlank = Extract<Question, { type: "code_blank" }>;

/**
 * 代码填空：`core` 给什么结构就渲染什么结构，这里不排序、不去重、不重新编号。
 * 代码里同一 blankId 出现多次时，标记都指向同一个输入框（改一处，全部同步）。
 */
export default function CodeBlankRenderer(props: RendererProps): React.ReactElement {
  const q = props.question as CodeBlank;
  const structure = buildCodeStructure(q);
  const answers =
    props.answer !== undefined &&
    typeof props.answer === "object" &&
    !Array.isArray(props.answer)
      ? (props.answer as Readonly<Record<string, string>>)
      : {};
  const detail = blankDetailMap(props.grade?.details);

  return (
    <div className="code-blank">
      {structure.files.map((file) => (
        <details key={file.fileId} open className="code-file">
          <summary>{file.label}</summary>
          <pre className="code">
            <code>
              {file.segments.map((seg) =>
                seg.kind === "code" ? (
                  <span key={seg.index}>{seg.text}</span>
                ) : (
                  <span
                    key={seg.index}
                    className={[
                      "slot",
                      props.locked && detail.get(seg.blankId ?? "") === true ? "ok" : "",
                      props.locked && detail.get(seg.blankId ?? "") === false ? "no" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={`空位 ${seg.blankId ?? ""}`}
                  >
                    [{seg.blankId}]
                  </span>
                ),
              )}
            </code>
          </pre>
        </details>
      ))}

      <div className="muted">
        共 {structure.uniqueBlankCount} 个空位（代码里出现 {structure.slotCount} 处，同一编号填一次即可）
      </div>

      <div className="blank-list">
        {q.blanks.map((blank) => {
          const correct = detail.get(blank.blankId);
          return (
            <label className="blank-row" key={blank.blankId}>
              <span className="blank-no">[{blank.blankId}]</span>
              <input
                className={[
                  "blankin",
                  props.locked && correct === true ? "ok" : "",
                  props.locked && correct === false ? "no" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={`空位 ${blank.blankId}`}
                autoComplete="off"
                spellCheck={false}
                disabled={props.locked}
                value={answers[blank.blankId] ?? ""}
                onChange={(event) =>
                  props.onChange({ ...answers, [blank.blankId]: event.target.value })
                }
              />
              {props.locked && correct === false ? (
                <span className="mark">答案：{blank.accepted.join(" / ")}</span>
              ) : null}
            </label>
          );
        })}
      </div>

      {props.preview === true ? null : (
        <details className="solution">
          <summary>查看完整代码（答案版）</summary>
          {structure.files.map((file) => (
            <div key={file.fileId}>
              <div className="muted">{file.label}</div>
              <pre className="code">
                <code>{file.solutionCode ?? file.code}</code>
              </pre>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
