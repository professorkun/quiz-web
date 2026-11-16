/**
 * 旧版数据结构（只读）。
 *
 * 字段刻意写成「尽量宽」：旧 `data.json` 是解析脚本的输出，没有 schemaVersion，
 * 也没有稳定 ID。迁移器要能容忍它的历史形态，但不能假装它比实际更规整。
 */

export interface LegacyOption {
  key: string;
  text: string;
}

export interface LegacyCodeBlock {
  label: string;
  lang: string;
  text: string;
}

export type LegacyQuestion =
  | {
      type: "choice";
      no: number;
      stem: string;
      options: LegacyOption[];
      answer: string;
      analysis?: string;
      kp?: string;
    }
  | {
      type: "judge";
      no: number;
      stem: string;
      answer: string;
      analysis?: string;
      kp?: string;
    }
  | {
      type: "blank";
      no: number;
      stem: string;
      blanks: string[];
      answer: string;
      hint?: string;
      analysis?: string;
      kp?: string;
    }
  | {
      type: "short";
      no: number;
      stem: string;
      points: string[];
      analysis?: string;
      answer?: string;
      kp?: string;
    }
  | {
      type: "app";
      no: number;
      stem: string;
      code: LegacyCodeBlock[];
      blankCode: LegacyCodeBlock[];
      answer: [string, string][];
      analysis?: string;
      kp?: string;
    };

export interface LegacyDataJson {
  meta?: { title?: string; sub?: string };
  questions: LegacyQuestion[];
}

/** 旧知识点名 → 新 topicId 的固定映射（旧版 7 类，写死是好事：迁移期不允许漂移） */
export const TOPIC_SLUGS: Readonly<Record<string, string>> = {
  "Web 基础": "web_base",
  JSP: "jsp",
  Servlet: "servlet",
  Spring: "spring",
  SpringMVC: "springmvc",
  MyBatis: "mybatis",
  JDBC: "jdbc",
};

/** 旧类型名 → 新题型（`app` 拆成 code_blank，`blank` 不再是「代码填空」） */
export const LEGACY_TYPE_TO_NEW = {
  choice: "single_choice",
  judge: "true_false",
  blank: "fill_blank",
  short: "short_answer",
  app: "code_blank",
} as const;
