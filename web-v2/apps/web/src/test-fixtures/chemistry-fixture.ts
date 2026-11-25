/**
 * 测试夹具题库：高中化学基础（15 题，4 种题型）。
 *
 * 空壳化后产品本身不含任何内置题库；这份题库只存在于测试目录，
 * 供应用级集成用例验证「多题库切换 / 判分 / 讲义 / 模考」等链路。
 * 它只依赖 @quiz/core 的契约，不依赖任何产品内容包，可被任意替换。
 */

import {
  SCHEMA_VERSION,
  computeRevision,
  type BankContent,
  type ExamTemplate,
  type Question,
} from "@quiz/core";

const BANK_ID = "chem";

const TOPICS = [
  { topicId: "chem:topic:matter", bankId: BANK_ID, name: "物质的组成与分类", order: 0 },
  { topicId: "chem:topic:reaction", bankId: BANK_ID, name: "化学反应", order: 1 },
  { topicId: "chem:topic:solution", bankId: BANK_ID, name: "溶液与酸碱盐", order: 2 },
] as const;

interface Draft extends Record<string, unknown> {
  readonly type: Question["type"];
  readonly questionId: string;
  readonly topicIds: readonly string[];
}

function q(draft: Draft): Question {
  const { questionId, ...rest } = draft;
  return {
    schemaVersion: SCHEMA_VERSION,
    bankId: BANK_ID,
    questionId,
    revision: computeRevision({ questionId, bankId: BANK_ID, ...rest }),
    legacyKeys: [],
    ...rest,
  } as unknown as Question;
}

const QUESTIONS: readonly Question[] = [
  q({
    type: "single_choice",
    questionId: "chem:single_choice:001",
    topicIds: ["chem:topic:matter"],
    stem: "下列物质中属于纯净物的是：",
    tags: ["chem:tag:basics"],
    difficulty: "easy",
    options: [
      { optionId: "a", text: "空气" },
      { optionId: "b", text: "冰水混合物" },
      { optionId: "c", text: "食盐水" },
      { optionId: "d", text: "粗盐" },
    ],
    answer: "b",
    explanation: "冰与水是同一种物质的两个状态，属纯净物；空气、食盐水、粗盐都是混合物。",
  }),
  q({
    type: "single_choice",
    questionId: "chem:single_choice:002",
    topicIds: ["chem:topic:matter"],
    stem: "决定元素种类的是原子的：",
    tags: ["chem:tag:basics", "chem:tag:exam"],
    difficulty: "medium",
    options: [
      { optionId: "a", text: "质子数" },
      { optionId: "b", text: "中子数" },
      { optionId: "c", text: "电子数" },
      { optionId: "d", text: "相对原子质量" },
    ],
    answer: "a",
    explanation: "元素的本质区别是核内质子数（核电荷数）不同。",
  }),
  q({
    type: "single_choice",
    questionId: "chem:single_choice:003",
    topicIds: ["chem:topic:reaction"],
    stem: "下列变化中属于化学变化的是：",
    options: [
      { optionId: "a", text: "冰雪融化" },
      { optionId: "b", text: "铁生锈" },
      { optionId: "c", text: "玻璃破碎" },
      { optionId: "d", text: "酒精挥发" },
    ],
    answer: "b",
    explanation: "有新物质生成才是化学变化；铁生锈生成了铁的氧化物。",
  }),
  q({
    type: "single_choice",
    questionId: "chem:single_choice:004",
    topicIds: ["chem:topic:solution"],
    stem: "常温下某溶液的 pH = 3，该溶液呈：",
    options: [
      { optionId: "a", text: "酸性" },
      { optionId: "b", text: "中性" },
      { optionId: "c", text: "碱性" },
      { optionId: "d", text: "无法判断" },
    ],
    answer: "a",
    explanation: "pH < 7 呈酸性，pH = 7 中性，pH > 7 碱性。",
  }),
  q({
    type: "multiple_choice",
    questionId: "chem:multiple_choice:001",
    topicIds: ["chem:topic:matter"],
    stem: "下列性质中属于化学性质的有：",
    options: [
      { optionId: "a", text: "可燃性" },
      { optionId: "b", text: "密度" },
      { optionId: "c", text: "氧化性" },
      { optionId: "d", text: "熔点" },
    ],
    answer: ["a", "c"],
    explanation: "可燃性、氧化性需通过化学变化表现，属化学性质；密度、熔点是物理性质。",
  }),
  q({
    type: "multiple_choice",
    questionId: "chem:multiple_choice:002",
    topicIds: ["chem:topic:reaction"],
    stem: "关于催化剂，下列说法正确的有：",
    options: [
      { optionId: "a", text: "能改变反应速率" },
      { optionId: "b", text: "反应前后质量不变" },
      { optionId: "c", text: "反应前后化学性质不变" },
      { optionId: "d", text: "能增加生成物的质量" },
    ],
    answer: ["a", "b", "c"],
    explanation: "催化剂只改变速率，不改变生成物总量，反应前后质量与化学性质均不变。",
  }),
  q({
    type: "multiple_choice",
    questionId: "chem:multiple_choice:003",
    topicIds: ["chem:topic:solution"],
    stem: "下列关于溶液的说法正确的有：",
    options: [
      { optionId: "a", text: "溶液是均一的" },
      { optionId: "b", text: "溶液是稳定的" },
      { optionId: "c", text: "溶液一定是无色的" },
      { optionId: "d", text: "溶液是混合物" },
    ],
    answer: ["a", "b", "d"],
    explanation: "溶液是均一、稳定的混合物；颜色不是判断标准，如硫酸铜溶液呈蓝色。",
  }),
  q({
    type: "true_false",
    questionId: "chem:true_false:001",
    topicIds: ["chem:topic:matter"],
    stem: "由同种元素组成的物质一定是单质。",
    answer: false,
    explanation: "氧气（O₂）与臭氧（O₃）混合，只含氧元素却是混合物。",
  }),
  q({
    type: "true_false",
    questionId: "chem:true_false:002",
    topicIds: ["chem:topic:solution"],
    stem: "溶液一定是均一、稳定的混合物。",
    answer: true,
  }),
  q({
    type: "true_false",
    questionId: "chem:true_false:003",
    topicIds: ["chem:topic:reaction"],
    stem: "燃烧一定需要氧气参与。",
    answer: false,
    explanation: "镁在二氧化碳中也能燃烧，燃烧不一定有氧气参与。",
  }),
  q({
    type: "fill_blank",
    questionId: "chem:fill_blank:001",
    topicIds: ["chem:topic:matter"],
    stem: "水的化学式为 {{f1}}。",
    blanks: [{ blankId: "f1", accepted: ["H2O", "h2o", "H₂O"] }],
    explanation: "一个水分子由两个氢原子和一个氧原子构成。",
  }),
  q({
    type: "fill_blank",
    questionId: "chem:fill_blank:002",
    topicIds: ["chem:topic:matter"],
    stem: "空气中体积分数约为 78% 的气体是 {{f1}}。",
    blanks: [{ blankId: "f1", accepted: ["氮气", "N2", "n2", "N₂"] }],
    explanation: "空气成分按体积：氮气约 78%、氧气约 21%。",
  }),
  q({
    type: "fill_blank",
    questionId: "chem:fill_blank:003",
    topicIds: ["chem:topic:solution"],
    stem: "酸与碱发生中和反应，生成盐和 {{f1}}。",
    blanks: [{ blankId: "f1", accepted: ["水", "H2O", "h2o"] }],
    explanation: "中和反应的实质是 H⁺ + OH⁻ → H₂O。",
  }),
  q({
    type: "fill_blank",
    questionId: "chem:fill_blank:004",
    topicIds: ["chem:topic:reaction"],
    stem: "铁在氧气中燃烧生成四氧化三铁，其化学式为 {{f1}}。",
    blanks: [{ blankId: "f1", accepted: ["Fe3O4", "fe3o4", "Fe₃O₄"] }],
    explanation: "3Fe + 2O₂ 点燃 → Fe₃O₄。",
  }),
];

const KNOWLEDGE = [
  {
    moduleId: "chem:knowledge:matter",
    topicId: "chem:topic:matter",
    title: "物质的分类",
    summary: "先分清混合物与纯净物，再看纯净物由几种元素组成。",
    items: [
      { title: "混合物", detail: "由两种或两种以上物质组成，如空气、食盐水。" },
      { title: "纯净物", detail: "只由一种物质组成，如冰水混合物、蒸馏水。" },
      { title: "单质与化合物", detail: "纯净物按元素种类分为单质（一种元素）和化合物（多种元素）。" },
    ],
    pitfalls: ["由同种元素组成的不一定是单质：O₂ 与 O₃ 混合仍是混合物。"],
  },
  {
    moduleId: "chem:knowledge:reaction",
    topicId: "chem:topic:reaction",
    title: "化学反应的基本特征",
    summary: "判断化学变化的唯一标准是有没有新物质生成。",
    items: [
      { title: "化学变化", detail: "有新物质生成，常伴随发光、放热、变色、产生气体或沉淀。" },
      { title: "催化剂", detail: "改变反应速率，反应前后质量和化学性质都不变。" },
    ],
    pitfalls: ["发光放热不一定是化学变化，如灯泡发光。", "燃烧不一定需要氧气，镁可在 CO₂ 中燃烧。"],
  },
  {
    moduleId: "chem:knowledge:solution",
    topicId: "chem:topic:solution",
    title: "溶液与酸碱盐",
    summary: "溶液是均一、稳定的混合物；pH 是酸碱性的标尺。",
    items: [
      { title: "溶液的特征", detail: "均一、稳定、混合物；溶质可以是固体、液体或气体。" },
      { title: "pH", detail: "pH < 7 酸性，pH = 7 中性，pH > 7 碱性。" },
      { title: "中和反应", detail: "酸与碱反应生成盐和水。" },
    ],
    pitfalls: ["溶液不一定无色，如硫酸铜溶液呈蓝色。"],
  },
] as const;

/**
 * 小测模板（S5 · T5-9）：10 题 / 50 分 / 30 分钟。
 * 与 JavaWeb 期末卷的题型数量、每题分值、筛选范围、时长四项全部不同——
 * G5-1「新增第二个模板不改代码」的实证；填空题限定两个主题，验证筛选范围生效。
 */
const EXAM_TEMPLATE: ExamTemplate = {
  templateId: "chem:exam:quiz",
  bankId: BANK_ID,
  title: "化学小测（10 题）",
  durationSec: 1800,
  sections: [
    { sectionId: "q1", title: "单选题", questionType: "single_choice", count: 3, scoreEach: 5 },
    { sectionId: "q2", title: "多选题", questionType: "multiple_choice", count: 2, scoreEach: 5 },
    { sectionId: "q3", title: "判断题", questionType: "true_false", count: 2, scoreEach: 5 },
    {
      sectionId: "q4",
      title: "填空题（物质与溶液）",
      questionType: "fill_blank",
      count: 3,
      scoreEach: 5,
      filter: { topicIds: ["chem:topic:matter", "chem:topic:solution"] },
    },
  ],
  totalScore: 50,
};

export const chemistryBank: BankContent = {
  manifest: {
    schemaVersion: SCHEMA_VERSION,
    bankId: BANK_ID,
    title: "高中化学基础",
    subject: "化学",
    questionCount: QUESTIONS.length,
    topics: TOPICS.map((t) => ({ ...t })),
    examTemplates: [EXAM_TEMPLATE],
    createdAt: "2026-11-16T00:00:00.000Z",
  },
  questions: QUESTIONS,
  knowledge: KNOWLEDGE.map((m) => ({
    ...m,
    items: m.items.map((i) => ({ ...i })),
    pitfalls: [...m.pitfalls],
    // W1 契约 Zod 输出类型为必填（.default([]) 只作用于解析输入），
    // 直接构造类型对象必须显式给出；化学题库暂无讲义正文/视频/拓展位，留空数组。
    goals: [],
    sections: [],
    videos: [],
    resources: [],
  })),
};
