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
  ExamTemplateSectionSchema,
  ExamTemplateSchema,
  BankManifestSchema,
  AttemptModeSchema,
  AttemptSchema,
  QuestionProgressSchema,
  PracticeSessionSchema,
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
  ExamTemplateSection,
  ExamTemplate,
  BankManifest,
  AttemptMode,
  Attempt,
  QuestionProgress,
  PracticeSession,
} from "./schema.js";

export { makeQuestionId, parseQuestionId, nextSeq, padSeq } from "./ids.js";
export type { ParsedQuestionId } from "./ids.js";

export { canonicalize, computeRevision } from "./revision.js";

export { ValidationCode, validateBankPackage } from "./validate.js";
export type { ValidationIssue, BankPackage, ValidateResult } from "./validate.js";
