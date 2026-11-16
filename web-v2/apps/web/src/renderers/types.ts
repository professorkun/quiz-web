import type {
  AnswerValue,
  GradeResult,
  Question,
  SelfRating,
  SelfRatingLevel,
} from "@quiz/core";
export type { AnswerValue, SelfRating, SelfRatingLevel } from "@quiz/core";

/**
 * 渲染器统一契约（ADR-0004）。
 *
 * 渲染器只做两件事：把题目画出来、把用户操作变成 AnswerValue 交给上层。
 * **判分、洗牌、会话序列化一律不在这里**——那是 core 的事。
 */
export interface RendererProps {
  readonly question: Question;
  /** 当前作答。undefined = 未作答 */
  readonly answer: AnswerValue | undefined;
  /** 该题的 optionId 展示顺序，由会话快照提供；刷新后必须完全一致 */
  readonly optionOrder: readonly string[] | undefined;
  /** 已提交后禁止再改 */
  readonly locked: boolean;
  /** 已提交时的判分结果（由 core 算出，页面不自己算） */
  readonly grade: GradeResult | undefined;
  readonly selfRating: SelfRating | undefined;
  readonly onChange: (answer: AnswerValue) => void;
  readonly onSelfRating: ((level: SelfRatingLevel) => void) | undefined;
}
