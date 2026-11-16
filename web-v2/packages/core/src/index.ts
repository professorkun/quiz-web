export {
  SCHEMA_VERSION,
  QuestionIdSchema,
  QuestionTypeSchema,
  RevisionSchema,
  OptionSchema,
  BlankSchema,
  SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema,
  TrueFalseQuestionSchema,
  FillBlankQuestionSchema,
  CodeFileSchema,
  CodeBlankSlotSchema,
  CodeBlankQuestionSchema,
  RubricPointSchema,
  ShortAnswerQuestionSchema,
  QuestionSchema,
  TopicSchema,
  KnowledgeItemSchema,
  KnowledgeModuleSchema,
  ExamTemplateSectionSchema,
  ExamTemplateSchema,
  BankManifestSchema,
  AttemptModeSchema,
  AttemptSchema,
  QuestionProgressSchema,
  PracticeSessionSchema,
  ErrorCauseSchema,
  FavoriteEntrySchema,
  PracticeSettingsSchema,
  AppSettingsSchema,
  LearningSnapshotSchema,
} from "./schema.js";

export type {
  QuestionType,
  Option,
  Blank,
  CodeFile,
  CodeBlankSlot,
  RubricPoint,
  Question,
  Topic,
  KnowledgeItem,
  KnowledgeModule,
  ExamTemplateSection,
  ExamTemplate,
  BankManifest,
  AttemptMode,
  Attempt,
  QuestionProgress,
  PracticeSession,
  FavoriteEntry,
  PracticeSettings,
  AppSettings,
  LearningSnapshot,
  BankContent,
} from "./schema.js";

export { makeQuestionId, parseQuestionId, nextSeq, padSeq } from "./ids.js";
export type { ParsedQuestionId } from "./ids.js";

export { canonicalize, computeRevision, fnv1a32 } from "./revision.js";

export { gradeQuestion, normalizeAnswer, matchesAccepted, asAnswerRecord } from "./grade.js";
export type { GradeResult, GradeDetail, AnswerKind } from "./grade.js";

// 题型扩展点（T2-1）：装配清单必须在包入口被 import，确保注册表总是已初始化
import "./questions/index.js";
export { BUILTIN_QUESTION_TYPES } from "./questions/index.js";
export {
  gradeAnswer,
  registerQuestionType,
  unregisterQuestionType,
  getQuestionType,
  hasQuestionType,
  listQuestionTypes,
  validateQuestionShape,
} from "./questions/registry.js";
export { defineQuestionType } from "./questions/types.js";
export type {
  AnyQuestionTypeDefinition,
  QuestionTypeDefinition,
  QuestionOf,
} from "./questions/types.js";

// 代码填空结构解析（T2-4）：渲染层只消费结构，不得重排
export {
  buildCodeStructure,
  checkCodeBlankStructure,
  blankDetailMap,
} from "./questions/code_blank/structure.js";
export type {
  CodeBlankQuestion,
  CodeStructure,
  CodeFileView,
  CodeSegment,
  CodeStructureIssue,
} from "./questions/code_blank/structure.js";

// 简答自评（T2-5）：档位与分数是 core 的纯函数，UI 只回传档位
export {
  SELF_RATING_LEVELS,
  makeSelfRating,
  rubricMaxScore,
  selfRatingFraction,
  isSelfRatingLevel,
} from "./questions/short_answer/selfRating.js";
export type {
  SelfRatingLevel,
  SelfRating,
  ShortAnswerQuestion,
} from "./questions/short_answer/selfRating.js";

// 练习引擎与会话恢复（T2-6 / T2-7）
export {
  rngFrom,
  deriveSeed,
  shuffleWith,
  selectQuestions,
  buildOptionOrders,
  createSession,
  currentQuestionId,
  isAnswered,
  sessionResult,
  setAnswer,
  setSelfRating,
  submitCurrent,
  moveTo,
  goNext,
  goPrev,
  serializeSession,
  restoreSession,
  SESSION_VERSION,
} from "./practice/index.js";
export type {
  SessionResult,
  AnswerValue,
  PracticeOrder,
  PracticeConfig,
  SessionSnapshot,
  CreateSessionInput,
  PreservedRecord,
  RestoreResult,
} from "./practice/index.js";

export { ValidationCode, validateBankPackage } from "./validate.js";
export type { ValidationIssue, BankPackage, ValidateResult } from "./validate.js";

// 作答事件构造（S3/T4-1）：事件不可变，首次标记从历史推断
export { buildAttempt, isFirstAttemptFor } from "./records/attempt.js";
export type { BuildAttemptInput } from "./records/attempt.js";

// 复习状态机与调度（S4 T4-2 / T4-3）：时钟口径见 ADR-0006
export {
  ERROR_CAUSES,
  ERROR_CAUSE_LABEL,
  DEFAULT_REVIEW_CONFIG,
  INITIAL_REVIEW_STATE,
  addHours,
  isDue,
  isDueAt,
  isIndependentReview,
  reduceReview,
  replayReview,
  eventOf,
  dueQuestionIds,
} from "./review/index.js";
export type {
  ErrorCause,
  ReviewStatus,
  ReviewState,
  ReviewConfig,
  ReviewEvent,
} from "./review/index.js";

// 统计（S4 T4-7）：全部指标由 Attempt 现算，没有计数缓存
export { computeStats } from "./stats/index.js";
export type { Stats, StatsInput, Rate } from "./stats/index.js";
