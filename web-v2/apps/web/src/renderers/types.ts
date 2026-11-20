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
  /** 只读预览：禁止作答，默认不展示正确答案/解析（题库页预览用） */
  readonly preview?: boolean;
  /**
   * 查看答案（V2.1 · R2）：在预览态下显式展开答案与解析。
   * **不是作答**：课程要求题库页看答案不能产生作答记录与进度。
   */
  readonly reveal?: boolean;
  /** 展开/收起答案的回调；由页面持有状态，渲染器只负责画按钮 */
  readonly onToggleReveal?: () => void;
  /** 已提交时的判分结果（由 core 算出，页面不自己算） */
  readonly grade: GradeResult | undefined;
  readonly selfRating: SelfRating | undefined;
  readonly onChange: (answer: AnswerValue) => void;
  readonly onSelfRating: ((level: SelfRatingLevel) => void) | undefined;
}
