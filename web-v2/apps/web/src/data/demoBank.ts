/**
 * 六题型演示题库（12 道，每类 2 道）。
 *
 * 为什么需要它：真实 JavaWeb 题库里**没有多选题**（S1 分布 62/45/27/8/5 与旧版一致），
 * 而 S2 的 G2-1 要求「6/6 题型可作答并判分」。这份夹具只用于 `?demo=1` 手测与集成测试，
 * 不进入任何题库包、不写学习记录，也不算"多题库切换 UI"。
 */

import {
  SCHEMA_VERSION,
  computeRevision,
  validateBankPackage,
  type BankPackage,
  type BankManifest,
  type Question,
} from "@quiz/core";

const BANK_ID = "demo";

interface Draft extends Record<string, unknown> {
  readonly type: string;
  readonly questionId: string;
}

function question(draft: Draft): Question {
  const { questionId, ...rest } = draft;
  return {
    schemaVersion: SCHEMA_VERSION,
    bankId: BANK_ID,
    questionId,
    topicIds: ["demo:topic:basic"],
    revision: computeRevision({ questionId, ...rest }),
    legacyKeys: [],
    ...rest,
  } as unknown as Question;
}

const TOPICS = [
  { topicId: "demo:topic:basic", bankId: BANK_ID, name: "基础", order: 0 },
  { topicId: "demo:topic:advanced", bankId: BANK_ID, name: "进阶", order: 1 },
];

function drafts(): Question[] {
  const list: Question[] = [];

  for (let i = 1; i <= 2; i++) {
    list.push(
      question({
        type: "single_choice",
        questionId: `demo:single_choice:${String(i).padStart(3, "0")}`,
        stem: i === 1 ? "下列哪个是 HTTP 的默认端口？" : "JSP 最终会被容器转换成什么？",
        options: [
          { optionId: "o1", text: i === 1 ? "80" : "HTML" },
          { optionId: "o2", text: i === 1 ? "443" : "Servlet" },
          { optionId: "o3", text: i === 1 ? "8080" : "JavaScript" },
          { optionId: "o4", text: i === 1 ? "21" : "CSS" },
        ],
        answer: "o2",
        explanation: i === 1 ? "HTTP 默认 80，HTTPS 才是 443。" : "JSP 会先翻译成 Servlet 再编译。",
      }),
    );
  }

  for (let i = 1; i <= 2; i++) {
    list.push(
      question({
        type: "multiple_choice",
        questionId: `demo:multiple_choice:${String(i).padStart(3, "0")}`,
        stem: i === 1 ? "以下哪些属于 HTTP 请求方法？（多选）" : "以下哪些是 JSP 内置对象？（多选）",
        options: [
          { optionId: "o1", text: i === 1 ? "GET" : "request" },
          { optionId: "o2", text: i === 1 ? "POST" : "session" },
          { optionId: "o3", text: i === 1 ? "SEND" : "socket" },
          { optionId: "o4", text: i === 1 ? "DELETE" : "application" },
        ],
        answer: i === 1 ? ["o1", "o2", "o4"] : ["o1", "o2", "o4"],
        explanation: "多选判分只看 optionId 集合，与选项展示顺序无关。",
      }),
    );
  }

  list.push(
    question({
      type: "true_false",
      questionId: "demo:true_false:001",
      stem: "Servlet 实例默认由容器创建单例，多个请求共享同一个实例。",
      answer: true,
      explanation: "容器默认单实例多线程，所以成员变量要考虑线程安全。",
    }),
    question({
      type: "true_false",
      questionId: "demo:true_false:002",
      stem: "JSP 中的 <%= %> 用于声明 Java 方法。",
      answer: false,
      explanation: "<%! %> 才是声明，<%= %> 是输出表达式。",
    }),
  );

  list.push(
    question({
      type: "fill_blank",
      questionId: "demo:fill_blank:001",
      stem: "JDBC 连接池的两种标准配置是 {{b1}} 与 {{b2}}。",
      blanks: [
        { blankId: "b1", accepted: ["POOLED"] },
        { blankId: "b2", accepted: ["UNPOOLED"] },
      ],
      explanation: "POOLED 用连接池，UNPOOLED 每次新建连接。",
    }),
    question({
      type: "fill_blank",
      questionId: "demo:fill_blank:002",
      stem: "Servlet 处理 GET 请求的方法是 {{b1}}。",
      blanks: [{ blankId: "b1", accepted: ["doGet", "doGet()"] }],
      explanation: "GET 对应 doGet，POST 对应 doPost。",
    }),
  );

  list.push(
    question({
      type: "code_blank",
      questionId: "demo:code_blank:001",
      stem: "补全一个最小 Servlet 类声明与注解。",
      files: [
        {
          fileId: "f1",
          label: "HelloServlet.java",
          language: "java",
          code: '@WebServlet("/hello")\npublic class HelloServlet extends ___(1-1)___ {\n    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {\n        resp.getWriter().write("hi");\n    }\n}',
          solutionCode:
            '@WebServlet("/hello")\npublic class HelloServlet extends HttpServlet {\n    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {\n        resp.getWriter().write("hi");\n    }\n}',
        },
      ],
      blanks: [{ blankId: "1-1", fileId: "f1", accepted: ["HttpServlet"] }],
      explanation: "所有 Servlet 都要继承 HttpServlet。",
    }),
    question({
      type: "code_blank",
      questionId: "demo:code_blank:002",
      stem: "补全 web.xml 中的 Servlet 映射（两处空位）。",
      files: [
        {
          fileId: "f1",
          label: "web.xml",
          language: "xml",
          code: "<servlet>\n  <servlet-name>hello</servlet-name>\n  <servlet-class>___(1-1)___</servlet-class>\n</servlet>\n<servlet-mapping>\n  <servlet-name>hello</servlet-name>\n  <url-pattern>___(1-2)___</url-pattern>\n</servlet-mapping>",
        },
      ],
      blanks: [
        { blankId: "1-1", fileId: "f1", accepted: ["com.demo.HelloServlet"] },
        { blankId: "1-2", fileId: "f1", accepted: ["/hello"] },
      ],
      explanation: "servlet-class 写全限定类名，url-pattern 以 / 开头。",
    }),
  );

  list.push(
    question({
      type: "short_answer",
      questionId: "demo:short_answer:001",
      stem: "简述 Servlet 生命周期三个阶段。",
      rubric: [
        { pointId: "p1", text: "init：容器创建实例后调用一次", score: 2 },
        { pointId: "p2", text: "service：每次请求调用，分派到 doGet/doPost", score: 2 },
        { pointId: "p3", text: "destroy：容器关闭或卸载时调用一次", score: 1 },
      ],
      explanation: "初始化一次、服务多次、销毁一次。",
    }),
    question({
      type: "short_answer",
      questionId: "demo:short_answer:002",
      stem: "简述 session 与 cookie 的区别。",
      rubric: [
        { pointId: "p1", text: "session 存在服务器端，cookie 存在客户端", score: 2 },
        { pointId: "p2", text: "session 依赖 JSESSIONID 关联，cookie 可被禁用", score: 2 },
        { pointId: "p3", text: "session 生命周期由容器管理，cookie 可设过期时间", score: 1 },
      ],
      explanation: "一个在服务端、一个在客户端。",
    }),
  );

  return list;
}

const QUESTIONS = drafts();

const MANIFEST: BankManifest = {
  schemaVersion: SCHEMA_VERSION,
  bankId: BANK_ID,
  title: "六题型演示题库",
  subject: "演示",
  questionCount: QUESTIONS.length,
  topics: TOPICS,
  examTemplates: [],
  createdAt: "2026-11-16T00:00:00.000Z",
};

const VALIDATED = validateBankPackage({ manifest: MANIFEST, questions: QUESTIONS });

export const demoBank: BankPackage = VALIDATED.ok
  ? { manifest: MANIFEST, questions: VALIDATED.questions }
  : { manifest: MANIFEST, questions: QUESTIONS };

/** 夹具自身必须合法；不合法时让测试立刻红，而不是带着坏数据手测 */
export const demoBankIssues = VALIDATED.issues;
