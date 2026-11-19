/**
 * SQL Server 期末全题型题库（80 题）。
 *
 * 内容来源：《SQLServer期末全题型题库》——单选 35、填空 20、简答 8、
 * 应用（手写 SQL 补全）14、综合（E-R 设计）3。
 *
 * 只在这里做「静态内容 → 站内契约」的装配：题目身份、题型分段、知识点归属
 * 与 revision 都在本文件生成；判分、渲染、存储一律走既有链路，不新增业务分支。
 */

import {
  SCHEMA_VERSION,
  computeRevision,
  validateBankPackage,
  type BankContent,
  type BankManifest,
  type Question,
} from "@quiz/core";

const BANK_ID = "sqlserver";

const TOPIC = {
  basics: "sqlserver:topic:basics",
  env: "sqlserver:topic:env",
  tsql: "sqlserver:topic:tsql",
  objects: "sqlserver:topic:objects",
  ops: "sqlserver:topic:ops",
  design: "sqlserver:topic:design",
} as const;

const TOPICS = [
  { topicId: TOPIC.basics, bankId: BANK_ID, name: "01 基础概念", order: 0 },
  { topicId: TOPIC.env, bankId: BANK_ID, name: "02 SQL Server 环境", order: 1 },
  { topicId: TOPIC.tsql, bankId: BANK_ID, name: "03 T-SQL 编程", order: 2 },
  { topicId: TOPIC.objects, bankId: BANK_ID, name: "04 数据库对象", order: 3 },
  { topicId: TOPIC.ops, bankId: BANK_ID, name: "05 运维与安全", order: 4 },
  { topicId: TOPIC.design, bankId: BANK_ID, name: "06 综合设计", order: 5 },
] as const;

type Draft = Record<string, unknown>;

function id(type: string, seq: number): string {
  return `${BANK_ID}:${type}:${String(seq).padStart(3, "0")}`;
}

/** 统一补齐 schemaVersion / bankId / revision / legacyKeys，内容字段由调用方给出 */
function q(questionId: string, type: Question["type"], topicIds: readonly string[], body: Draft): Question {
  return {
    schemaVersion: SCHEMA_VERSION,
    bankId: BANK_ID,
    questionId,
    type,
    topicIds,
    revision: computeRevision({ questionId, type, topicIds, ...body }),
    legacyKeys: [],
    ...body,
  } as unknown as Question;
}

function choice(
  seq: number,
  topic: string,
  stem: string,
  options: readonly [string, string, string, string],
  answer: "A" | "B" | "C" | "D",
  explanation: string,
): Question {
  const optionIds = ["o1", "o2", "o3", "o4"] as const;
  return q(id("single_choice", seq), "single_choice", [topic], {
    stem,
    options: options.map((text, i) => ({ optionId: optionIds[i]!, text })),
    answer: optionIds["ABCD".indexOf(answer)]!,
    explanation,
  });
}

function blank(blankId: string, ...accepted: string[]): { blankId: string; accepted: string[] } {
  return { blankId, accepted };
}

function fill(
  seq: number,
  topic: string,
  stem: string,
  blanks: ReturnType<typeof blank>[],
  explanation: string,
): Question {
  return q(id("fill_blank", seq), "fill_blank", [topic], { stem, blanks, explanation });
}

function short(
  seq: number,
  topic: string,
  stem: string,
  rubric: readonly (readonly [string, number])[],
  explanation: string,
): Question {
  return q(id("short_answer", seq), "short_answer", [topic], {
    stem,
    rubric: rubric.map(([text, score], i) => ({ pointId: `p${i + 1}`, text, score })),
    explanation,
  });
}

function code(
  seq: number,
  stem: string,
  codeText: string,
  solutionCode: string,
  blanks: readonly (readonly [string, string, ...string[]])[],
  explanation: string,
): Question {
  return q(id("code_blank", seq), "code_blank", [TOPIC.tsql], {
    stem,
    files: [{ fileId: "f1", label: "SQL", language: "sql", code: codeText, solutionCode }],
    blanks: blanks.map(([blankId, ...accepted]) => ({ blankId, fileId: "f1", accepted })),
    explanation,
  });
}

/* ------------------------------------------------------------ 单项选择题 */

const SINGLE_CHOICE: readonly Question[] = [
  choice(
    1,
    TOPIC.basics,
    "数据库系统与文件系统的本质区别是（　）。",
    [
      "数据可共享",
      "数据结构化，数据具有较高的独立性",
      "数据库系统数据量更大",
      "文件管理更方便",
    ],
    "B",
    "文件系统冗余大、独立性弱；DBMS 整体结构化且靠三级模式两级映像获得数据独立性。讲义 2.1 强调「最本质优势是数据独立性」，真题把它与「数据结构化」合并成 B。",
  ),
  choice(
    2,
    TOPIC.basics,
    "关系规范化中的插入操作异常是指（　）。",
    [
      "不该删除的数据被删除",
      "不该插入的数据被插入",
      "应该删除的数据未被删除",
      "应该插入的数据未被插入",
    ],
    "D",
    "插入异常 = 该插的数据插不进去（如新生未选课导致整条学生记录录不进去）。讲义 2.5。注意与「删除异常」「更新异常」区分。",
  ),
  choice(
    3,
    TOPIC.basics,
    "若关系 R 中有属性集 A，且 A 能唯一标识每个元组且不含多余属性，则 A 称为（　）。",
    ["超键", "候选键", "外键", "连接键"],
    "B",
    "候选键 = 能唯一标识元组且不含多余属性 = 最小超键。讲义 2.3。",
  ),
  choice(
    4,
    TOPIC.env,
    "关于 SQL Server 实例，下列说法错误的是（　）。",
    [
      "一台计算机可以安装多个命名实例",
      "一台计算机只能有一个默认实例",
      "每个实例是独立的服务器环境",
      "一台计算机上可以安装多个默认实例",
    ],
    "D",
    "一台机器可装多个实例，但默认实例只能有一个（MSSQLSERVER），其余必须是命名实例；实例之间互相独立。讲义 3.1。",
  ),
  choice(
    5,
    TOPIC.objects,
    "关于聚集索引，下列说法正确的是（　）。",
    [
      "一个表可以建多个聚集索引",
      "聚集索引决定数据的物理存储顺序",
      "聚集索引不影响查询性能",
      "主键不能创建聚集索引",
    ],
    "B",
    "聚集索引决定物理存储顺序，一张表只能一个；非聚集索引不改变物理顺序，可建多个。讲义 5.1。",
  ),
  choice(
    6,
    TOPIC.objects,
    "唯一索引的作用是（　）。",
    [
      "加快范围查询",
      "对数据进行物理排序",
      "保证索引键所包含的列的取值不能重复",
      "减少索引的存储空间",
    ],
    "C",
    "UNIQUE 索引保证索引键值不重复；物理排序是聚集索引的事，加快查询是索引的通用效果而非唯一索引特有。讲义 5.1。",
  ),
  choice(
    7,
    TOPIC.objects,
    "关于视图，下列说法错误的是（　）。",
    [
      "视图是虚表，只存储定义",
      "视图可以简化用户查询",
      "所有视图都一定能更新基表",
      "视图可以提供安全性",
    ],
    "C",
    "只有单表、不含聚合 / 分组 / DISTINCT / UNION 等的视图才能更新基表，含 GROUP BY 的视图不可更新。讲义 5.2。",
  ),
  choice(
    8,
    TOPIC.objects,
    "当执行 CREATE TABLE、DROP TABLE 等语句时，触发的是（　）。",
    ["DML 触发器", "DDL 触发器", "登录触发器", "事务触发器"],
    "B",
    "DDL 触发器响应 CREATE / ALTER / DROP；DML 触发器响应 INSERT / UPDATE / DELETE。讲义 5.5。",
  ),
  choice(
    9,
    TOPIC.objects,
    "关于多语句表值函数，下列说法正确的是（　）。",
    ["只能返回单个值", "返回一个表变量", "不能带参数", "等价于存储过程"],
    "B",
    "多语句表值函数用 RETURNS @t TABLE(...) 定义，返回的是填充好的表变量；标量函数才返回单值。讲义 5.4。",
  ),
  choice(
    10,
    TOPIC.objects,
    "关闭游标使用的命令是（　）。",
    ["OPEN", "FETCH", "CLOSE", "DEALLOCATE"],
    "C",
    "CLOSE 关闭但不释放内存，DEALLOCATE 才释放；FETCH 提取行，OPEN 打开。讲义 5.6。",
  ),
  choice(
    11,
    TOPIC.env,
    "SQL Server 中，GRANT 语句用于（　）。",
    ["收回权限", "授予权限", "创建登录", "删除用户"],
    "B",
    "GRANT 授权、REVOKE 收回、DENY 拒绝（优先级最高）。讲义 3.5。",
  ),
  choice(
    12,
    TOPIC.env,
    "在 SQL Server 的系统数据库中，记录实例范围的元数据（如登录账户）、端点、链接服务器和系统配置设置，一旦不可用则 SQL Server 无法启动的是（　）。",
    ["master", "model", "msdb", "tempdb"],
    "A",
    "master 记录实例级元数据，损坏则 SQL Server 无法启动；model 是模板、msdb 存 Agent 作业、tempdb 重启重建。讲义 3.2。",
  ),
  choice(
    13,
    TOPIC.env,
    "SQL Server 数据库管理系统将权限分为（　）三种类型。",
    [
      "对象权限、语句权限和隐含权限",
      "读权限、写权限和执行权限",
      "服务器权限、数据库权限和表权限",
      "系统权限、用户权限和角色权限",
    ],
    "A",
    "对象权限（表 / 视图 / 列）、语句权限（CREATE / BACKUP 等）、隐含权限（角色自带）。讲义 3.5。",
  ),
  choice(
    14,
    TOPIC.basics,
    "三级模式结构中，视图属于（　）。",
    ["外模式", "模式", "内模式", "存储模式"],
    "A",
    "外模式 = 子模式 / 用户模式 = 视图；模式 = 基本表；内模式 = 存储文件与索引。讲义 2.2。",
  ),
  choice(
    15,
    TOPIC.basics,
    "一个关系可以有几个候选键、几个主键（　）。",
    [
      "一个候选键、多个主键",
      "多个候选键、一个主键",
      "多个候选键、多个主键",
      "一个候选键、一个主键",
    ],
    "B",
    "候选键可有多个，主键是从中选定的一个，一张表只能有一个主键。讲义 2.3。",
  ),
  choice(
    16,
    TOPIC.basics,
    "关于超键与候选键的关系，正确的是（　）。",
    [
      "候选键可能含有多余属性",
      "超键一定不含多余属性",
      "候选键是最小的超键",
      "超键是候选键的子集",
    ],
    "C",
    "候选键 ⊆ 超键，候选键是不含多余属性的最小超键。讲义 2.3。",
  ),
  choice(
    17,
    TOPIC.basics,
    "外键的取值规则是（　）。",
    [
      "一律不能为空",
      "必须在本表内唯一",
      "要么为空，要么等于被参照表中某个主键值",
      "必须与本表主键取值相同",
    ],
    "C",
    "参照完整性：外键值要么为 NULL，要么等于被参照表中已存在的主键值。讲义 2.4。",
  ),
  choice(
    18,
    TOPIC.tsql,
    "下列聚合函数中，不忽略 NULL 的是（　）。",
    ["COUNT(*)", "COUNT(列名)", "SUM(列名)", "AVG(列名)"],
    "A",
    "COUNT(*) 统计行数，不忽略 NULL；COUNT(列名) / SUM / AVG / MAX / MIN 都忽略 NULL。讲义 4.6。",
  ),
  choice(
    19,
    TOPIC.objects,
    "一张表最多可以建立（　）。",
    [
      "1 个聚集索引、1 个非聚集索引",
      "多个聚集索引、多个非聚集索引",
      "1 个聚集索引、多个非聚集索引",
      "多个聚集索引、1 个非聚集索引",
    ],
    "C",
    "聚集索引每表仅 1 个，非聚集索引可多个。讲义 5.1、9.1 第 8 条。",
  ),
  choice(
    20,
    TOPIC.objects,
    "在表上尚无聚集索引时创建主键，默认自动创建（　）。",
    ["唯一非聚集索引", "聚集索引", "全文索引", "列存储索引"],
    "B",
    "建主键时若表上还没有聚集索引，会自动创建聚集索引。讲义 5.1、8 第 8 条。",
  ),
  choice(
    21,
    TOPIC.objects,
    "聚集索引的叶子节点存放的是（　）。",
    ["指向数据行的指针", "数据页本身（数据行）", "只有索引键值", "事务日志记录"],
    "B",
    "聚集索引叶子节点就是数据页；非聚集索引叶子节点存指向数据行的指针。讲义 5.1。",
  ),
  choice(
    22,
    TOPIC.objects,
    "关于视图，正确的是（　）。",
    [
      "视图在数据库中存放一份数据副本",
      "视图只存定义，数据仍存放在基本表中",
      "视图必然提高查询速度",
      "删除视图会连带删除基表数据",
    ],
    "B",
    "视图是虚表，数据库只存那条 SELECT 定义，数据在基本表里。讲义 5.2。",
  ),
  choice(
    23,
    TOPIC.objects,
    "下列视图中，不能通过它更新基表数据的是（　）。",
    [
      "单表、不含聚合的简单视图",
      "含 GROUP BY 的视图",
      "只包含部分列的单表视图",
      "带 WITH CHECK OPTION 的单表视图",
    ],
    "B",
    "含 GROUP BY / DISTINCT / 聚合 / UNION / TOP / 计算列的视图不可更新。讲义 5.2。",
  ),
  choice(
    24,
    TOPIC.objects,
    "DDL 触发器响应的语句是（　）。",
    ["INSERT / UPDATE / DELETE", "SELECT", "CREATE / ALTER / DROP", "GRANT / REVOKE"],
    "C",
    "DDL 触发器维护服务器级、数据库级安全，响应 CREATE / ALTER / DROP。讲义 5.5、8 第 12 条。",
  ),
  choice(
    25,
    TOPIC.objects,
    "INSTEAD OF 触发器的执行特点是（　）。",
    [
      "先执行原 DML 语句，成功后再执行触发器",
      "不执行原 DML 语句，只执行触发器内容",
      "只能响应 DELETE",
      "不能建在视图上",
    ],
    "B",
    "INSTEAD OF 是前触发型：原 DML 根本不执行，直接跑触发器内容。讲义 5.5。",
  ),
  choice(
    26,
    TOPIC.objects,
    "执行 UPDATE 时，inserted / deleted 临时表分别存放（　）。",
    ["旧值 / 新值", "新值 / 旧值", "都存新值", "都存旧值"],
    "B",
    "UPDATE = deleted + inserted：deleted 存旧值，inserted 存新值。讲义 5.5。",
  ),
  choice(
    27,
    TOPIC.objects,
    "游标 FETCH 成功取到一行的判断标志是（　）。",
    ["@@FETCH_STATUS = 0", "@@FETCH_STATUS = -1", "@@ROWCOUNT = 1", "@@ERROR = 0"],
    "A",
    "@@FETCH_STATUS = 0 成功；-1 失败或超出结果集；-2 行已不存在。讲义 5.6。",
  ),
  choice(
    28,
    TOPIC.objects,
    "游标五步法的正确顺序是（　）。",
    [
      "OPEN → DECLARE → FETCH → DEALLOCATE → CLOSE",
      "DECLARE → OPEN → FETCH → CLOSE → DEALLOCATE",
      "DECLARE → FETCH → OPEN → CLOSE → DEALLOCATE",
      "OPEN → FETCH → CLOSE → DEALLOCATE → DECLARE",
    ],
    "B",
    "DECLARE → OPEN → FETCH → CLOSE → DEALLOCATE，顺序不能乱。讲义 5.6。",
  ),
  choice(
    29,
    TOPIC.env,
    "Windows 身份验证模式的特点是（　）。",
    [
      "需要单独输入 SQL Server 账号和密码",
      "由 Windows 验证身份，登录时无需另输密码",
      "只允许非 Windows 客户端连接",
      "必须先执行 CREATE LOGIN 建账号",
    ],
    "B",
    "Windows 模式由 Windows 验证、SQL Server 直接信任，不用另输密码；混合模式才多开一扇门。讲义 3.4、简答 4。",
  ),
  choice(
    30,
    TOPIC.env,
    "db_owner 数据库角色自带的权限属于（　）。",
    ["对象权限", "语句权限", "隐含权限", "列级权限"],
    "C",
    "隐含权限来自角色身份，如 db_owner、sysadmin；不是 GRANT 授出的对象 / 语句权限。讲义 3.5。",
  ),
  choice(
    31,
    TOPIC.ops,
    "下列恢复模式中，不能做事务日志备份的是（　）。",
    ["简单恢复模式", "完整恢复模式", "大容量日志恢复模式", "以上三种都支持日志备份"],
    "A",
    "简单恢复模式自动截断日志，不支持也不需要日志备份；完整 / 大容量日志支持。讲义 6.2。",
  ),
  choice(
    32,
    TOPIC.ops,
    "差异备份的基点是（　）。",
    ["上一次差异备份", "上一次日志备份", "最近一次完整备份", "数据库创建时刻"],
    "C",
    "差异备份基于最近一次完整备份，不是上一次差异备份；还原时「完整 + 最新差异」两份即可。讲义 6.1。",
  ),
  choice(
    33,
    TOPIC.tsql,
    "表达式 年龄 < ALL (子查询) 等价于（　）。",
    [
      "小于子查询结果中的最小值",
      "小于子查询结果中的最大值",
      "小于结果中的某一个值",
      "不等于结果中的任何一个值",
    ],
    "A",
    "< ALL = 小于最小值（等价于 < (SELECT MIN(...))）；< SOME 才是小于最大值。讲义 4.9。",
  ),
  choice(
    34,
    TOPIC.tsql,
    "关于 WHERE 与 HAVING，正确的是（　）。",
    [
      "WHERE 分组后筛组，HAVING 分组前筛行",
      "两者作用相同，可以互换",
      "WHERE 不能含聚合函数，HAVING 可以",
      "HAVING 可以直接使用 SELECT 定义的列别名",
    ],
    "C",
    "WHERE 分组前筛行、不能含聚合；HAVING 分组后筛组、可用聚合，且不能用 SELECT 别名。讲义 4.4、4.7。",
  ),
  choice(
    35,
    TOPIC.basics,
    "关于删除异常，正确的是（　）。",
    [
      "删除异常就是误删数据的操作失误",
      "删除异常指不该删的数据被连带删掉，是模式设计缺陷",
      "删除异常只在 3NF 中出现",
      "建立索引即可消除删除异常",
    ],
    "B",
    "删除异常是「连带删掉了不该删的数据」，属模式设计缺陷，靠模式分解（规范化）解决，不是操作失误。讲义 2.5、13.1。",
  ),
];

/* ------------------------------------------------------------- 填空题 */

const FILL_BLANK: readonly Question[] = [
  fill(
    1,
    TOPIC.basics,
    "每个关系表都必须有主键，且主键必须 {{b1}}、{{b2}}。",
    [blank("b1", "非空"), blank("b2", "唯一")],
    "实体完整性靠主键：非空、唯一。",
  ),
  fill(
    2,
    TOPIC.env,
    "SQL Server 的主数据文件扩展名是 {{b1}}，一个数据库中有且仅有 {{b2}} 个。",
    [blank("b1", ".mdf"), blank("b2", "1", "一")],
    "mdf 主、ndf 次、ldf 日志。",
  ),
  fill(
    3,
    TOPIC.tsql,
    "查询中先过滤行再分组，应使用 {{b1}} 子句过滤，再用 {{b2}} 子句分组。",
    [blank("b1", "WHERE"), blank("b2", "GROUP BY")],
    "先筛行，再分组。",
  ),
  fill(
    4,
    TOPIC.tsql,
    "LIKE 中匹配任意多个字符的通配符是 {{b1}}，匹配单个字符的是 {{b2}}。",
    [blank("b1", "%"), blank("b2", "_")],
    "百分号多，下划线一。",
  ),
  fill(
    5,
    TOPIC.objects,
    "创建视图使用 {{b1}} 语句，删除视图使用 {{b2}} 语句。",
    [blank("b1", "CREATE VIEW"), blank("b2", "DROP VIEW")],
    "改视图是 ALTER VIEW。",
  ),
  fill(
    6,
    TOPIC.objects,
    "一张表最多可以有 {{b1}} 个聚集索引、{{b2}} 个非聚集索引。",
    [blank("b1", "1", "一"), blank("b2", "多个")],
    "聚集索引每表一个。",
  ),
  fill(
    7,
    TOPIC.objects,
    "游标提取当前行的语句是 {{b1}}，判断是否取到行用全局变量 {{b2}}。",
    [blank("b1", "FETCH"), blank("b2", "@@FETCH_STATUS")],
    "取到行时值为 0。",
  ),
  fill(
    8,
    TOPIC.objects,
    "标量函数的返回类型由 {{b1}} 关键字指定，表值函数返回的是 {{b2}}。",
    [blank("b1", "RETURNS"), blank("b2", "表")],
    "一个值 vs 一张表。",
  ),
  fill(
    9,
    TOPIC.objects,
    "INSTEAD OF 触发器执行时，{{b1}} 原 DML 语句。",
    [blank("b1", "不执行")],
    "INSTEAD OF 顶替原语句。",
  ),
  fill(
    10,
    TOPIC.ops,
    "差异备份备份的是自最近一次 {{b1}} 备份以来发生变化的全部内容。",
    [blank("b1", "完整")],
    "基点不是上一次差异备份。",
  ),
  fill(
    11,
    TOPIC.ops,
    "三种恢复模式中，{{b1}} 恢复模式不需要日志备份。",
    [blank("b1", "简单")],
    "简单模式自动截断日志。",
  ),
  fill(
    12,
    TOPIC.tsql,
    "CREATE DATABASE 语句中，数据文件段以 {{b1}} 开头，日志文件段以 {{b2}} 开头，两段缺一不可。",
    [blank("b1", "ON PRIMARY"), blank("b2", "LOG ON")],
    "两段式建库。",
  ),
  fill(
    13,
    TOPIC.tsql,
    "数据库文件的初始大小用 {{b1}} 指定，每次增长量用 {{b2}} 指定（可写具体值或百分比）。",
    [blank("b1", "SIZE"), blank("b2", "FILEGROWTH")],
    "物理名必须加单引号。",
  ),
  fill(
    14,
    TOPIC.objects,
    "关闭游标用 {{b1}}，释放游标占用的资源用 {{b2}}，两者不可互换。",
    [blank("b1", "CLOSE"), blank("b2", "DEALLOCATE")],
    "关闭 ≠ 释放。",
  ),
  fill(
    15,
    TOPIC.objects,
    "触发器内部由系统维护的两张临时表是 {{b1}} 和 {{b2}}；UPDATE 时前者存新值、后者存旧值。",
    [blank("b1", "inserted"), blank("b2", "deleted")],
    "UPDATE = deleted + inserted。",
  ),
  fill(
    16,
    TOPIC.ops,
    "完整备份、差异备份、事务日志备份对应的语句关键字分别是 {{b1}}、{{b2}}、{{b3}}。",
    [blank("b1", "BACKUP DATABASE"), blank("b2", "WITH DIFFERENTIAL"), blank("b3", "BACKUP LOG")],
    "差异备份带 WITH DIFFERENTIAL。",
  ),
  fill(
    17,
    TOPIC.ops,
    "还原数据库用 {{b1}}，还原日志用 {{b2}}；连续还原时中间步骤要带 WITH NORECOVERY。",
    [blank("b1", "RESTORE DATABASE"), blank("b2", "RESTORE LOG")],
    "最后一步 WITH RECOVERY。",
  ),
  fill(
    18,
    TOPIC.ops,
    "授权、收回、拒绝三个关键字依次是 {{b1}}、{{b2}}、{{b3}}，其中优先级最高的是 {{b4}}。",
    [blank("b1", "GRANT"), blank("b2", "REVOKE"), blank("b3", "DENY"), blank("b4", "DENY")],
    "DENY > GRANT > 未授权（继承）。",
  ),
  fill(
    19,
    TOPIC.env,
    "创建服务器级登录名用 {{b1}}，创建数据库级用户用 {{b2}}，两者作用域不同。",
    [blank("b1", "CREATE LOGIN"), blank("b2", "CREATE USER")],
    "服务器级 / 数据库级。",
  ),
  fill(
    20,
    TOPIC.tsql,
    "取当前日期时间用系统函数 {{b1}}，取当前年份要写成 {{b2}}，函数一律不加引号。",
    [blank("b1", "GETDATE()"), blank("b2", "YEAR(GETDATE())")],
    "函数不加引号。",
  ),
];

/* ------------------------------------------------------------- 简答题 */

const SHORT_ANSWER: readonly Question[] = [
  short(
    1,
    TOPIC.objects,
    "索引可能带来哪些额外开销？",
    [
      ["存储开销：索引本身占用额外磁盘空间，索引越多占用越大。", 2],
      ["维护开销：对表做插入、删除、修改时，DBMS 必须同步维护索引，从而降低数据更新速度。", 2],
      ["两个方面都要答到：「占空间」和「拖慢增删改」，只答一个最多一半分。", 1],
    ],
    "口诀：空间 + 维护。",
  ),
  short(
    2,
    TOPIC.objects,
    "使用存储过程有哪些优点？",
    [
      ["允许模块化程序设计：一次创建、编译后存放在数据库中，可多次调用，便于共享与维护。", 1],
      ["改善性能：首次执行时编译并缓存执行计划，后续调用直接复用，不必重复解析编译。", 1],
      ["减少网络流量：客户端只需传过程名和参数，不必把成百上千行 SQL 传过去。", 1],
      ["可作为安全机制使用：只授予执行存储过程的权限，不授予直接访问基表的权限。", 1],
    ],
    "口诀：模块、性能、流量、安全。",
  ),
  short(
    3,
    TOPIC.objects,
    "用户自定义函数如何分类？标量函数与表值函数有什么区别？",
    [
      ["用户自定义函数分标量函数和表值函数两类；表值函数又分内联表值函数和多语句表值函数。", 2],
      ["返回值不同：标量函数返回单个数据值；表值函数返回一张表。", 1],
      ["调用位置不同：标量函数可出现在 SELECT 列表、WHERE 等表达式位置；表值函数只能放在 FROM 子句后当表用。", 1],
      ["定义方式不同：标量用 RETURNS 数据类型；内联表值用 RETURNS TABLE AS RETURN (SELECT …)；多语句表值用 RETURNS @t TABLE(…)。", 1],
    ],
    "口诀：一个值 vs 一张表。",
  ),
  short(
    4,
    TOPIC.env,
    "SQL Server 有哪两种身份验证模式？区别是什么？",
    [
      ["两种模式：Windows 身份验证模式和混合模式（SQL Server 和 Windows 身份验证模式）。", 1],
      ["Windows 身份验证：只允许 Windows 授权账户连接，由 Windows 验证身份、SQL Server 直接信任；登录时不需要单独输入用户名和密码，适合域环境和内网客户端。", 2],
      ["混合模式：既允许 Windows 用户，也允许非 Windows 用户用 SQL Server 自己的账号密码连接；需要单独 CREATE LOGIN 建账号，适合非 Windows 客户端和跨网访问。", 2],
    ],
    "一句话：混合模式比 Windows 模式多提供了一种非 Windows 用户的登录方式。",
  ),
  short(
    5,
    TOPIC.ops,
    "三种备份方式各有什么特点？恢复模式与日志备份是什么关系？",
    [
      ["完整数据库备份：备份全部数据和部分日志，是差异备份和日志备份的基点；耗时最长、占空间最大。", 2],
      ["差异数据库备份：只备份自最近一次完整备份以来的全部变化；还原时先还原完整备份，再还原最新差异备份。", 2],
      ["事务日志备份：只备份事务日志记录，文件最小；结合完整备份可恢复到某一时间点。", 2],
      ["恢复模式有简单、完整、大容量日志三种；简单恢复模式不支持也不需要日志备份，完整和大容量日志恢复模式支持日志备份。", 2],
    ],
    "得分要点：三种备份名称 + 各自特点 + 三种恢复模式 + 「简单模式不需要日志备份」。",
  ),
  short(
    6,
    TOPIC.objects,
    "视图有哪四个作用？为什么含 GROUP BY 的视图不能更新基表？",
    [
      ["简化复杂查询：把多表连接封装起来。", 1],
      ["提高安全性：只暴露部分行 / 列。", 1],
      ["提高逻辑独立性：基表结构变化只改视图定义。", 1],
      ["提供多个视角：不同用户看同一份数据的不同侧面。", 1],
      ["视图不存数据，更新视图实际是翻译回基本表；含 GROUP BY / DISTINCT / 聚合 / UNION / TOP / 计算列 / 子查询时，视图的一行可能对应基表的多行，无法反推到某一行，因此不可更新。", 2],
      ["加 WITH CHECK OPTION 可限制插入 / 更新的数据必须满足视图定义条件。", 1],
    ],
    "四个作用：简化、安全、逻辑独立、多视角。",
  ),
  short(
    7,
    TOPIC.basics,
    "什么是数据冗余与三类异常？为什么说「因为有异常，所以才有规范化」？",
    [
      ["数据冗余：同一数据重复存放，浪费空间且容易不一致。", 1],
      ["插入异常：该插的数据插不进去（新生未选课，无法录入学生记录）。", 1],
      ["删除异常：不该删的数据被连带删掉（删掉最后一条选课记录，学生姓名、系别也没了）。", 1],
      ["更新异常：同一数据重复存储，改一处漏一处。", 1],
      ["这些异常都由不合适的数据依赖和模式设计缺陷引起，操作层面无法根治，因此要用模式分解（规范化）逐步消除。", 2],
      ["1NF 属性不可再分，2NF 消除非主属性对码的部分函数依赖，3NF 消除传递函数依赖；分解原则是无损连接 + 保持函数依赖。删除异常 ≠ 删除错误。", 2],
    ],
    "异常来自设计缺陷，靠规范化解决，不是操作失误。",
  ),
  short(
    8,
    TOPIC.objects,
    "AFTER 触发器与 INSTEAD OF 触发器有何区别？UPDATE 时 inserted / deleted 各存什么？",
    [
      ["AFTER（后触发型）：先执行原 INSERT / UPDATE / DELETE，成功后再跑触发器；发现违规用 ROLLBACK 撤回，最常用。", 2],
      ["INSTEAD OF（前触发型）：原 DML 语句根本不执行，直接执行触发器内容，由它自己决定是否、如何完成操作；常用于更新不可更新视图。", 2],
      ["UPDATE 时 inserted 存修改后的新值，deleted 存修改前的旧值；INSERT 时 inserted 存新行、deleted 为空；DELETE 时 inserted 为空、deleted 存被删行。", 2],
      ["DML 触发器管增删改，DDL 触发器管 CREATE / ALTER / DROP；触发器里不要写会产生结果集的 SELECT。", 1],
    ],
    "口诀：UPDATE = deleted + inserted。",
  ),
];

/* --------------------------------------------------------- 应用题（补全） */

const CODE_BLANK: readonly Question[] = [
  code(
    1,
    "创建数据库，数据库名为 StudentDB，数据文件逻辑名 StudentDB_data，存放在 D:\\data 目录下，初始大小 10MB，自动增长每次 5MB；日志文件初始大小 5MB，自动增长每次 10%。补全创建语句。",
    String.raw`___(b1)___
ON PRIMARY (
    ___(b2)___ ,
    FILENAME = 'D:\data\StudentDB.mdf',
    SIZE = 10MB,
    ___(b3)___ )
LOG ON (
    NAME = 'StudentDB_log',
    FILENAME = 'D:\data\StudentDB_log.ldf',
    ___(b4)___ ,
    FILEGROWTH = 10% );`,
    String.raw`CREATE DATABASE StudentDB
ON PRIMARY (
    NAME = StudentDB_data,
    FILENAME = 'D:\data\StudentDB.mdf',
    SIZE = 10MB,
    FILEGROWTH = 5MB )
LOG ON (
    NAME = 'StudentDB_log',
    FILENAME = 'D:\data\StudentDB_log.ldf',
    SIZE = 5MB,
    FILEGROWTH = 10% );`,
    [
      ["b1", "CREATE DATABASE StudentDB"],
      ["b2", "NAME = StudentDB_data", "NAME=StudentDB_data"],
      ["b3", "FILEGROWTH = 5MB", "FILEGROWTH=5MB"],
      ["b4", "SIZE = 5MB", "SIZE=5MB"],
    ],
    "建库必须写 ON PRIMARY（数据文件段）和 LOG ON（日志文件段）两段；两段写法完全对称，上下对照即可补空。逻辑名可不加引号，物理路径必须加单引号且带扩展名。",
  ),
  code(
    2,
    "创建教师表 teacher：工号 tno(char(6)，主键)、姓名 tname(varchar(10)，非空)、性别 tsex(定长字符串长度 2，只能取 '男' 或 '女')、职称 title(varchar(10)，默认 '讲师')、入职年份 tgrade(整型，默认为当前年份)、工资 salary(int，要求大于 0)。补全建表语句。",
    String.raw`CREATE TABLE teacher (
    tno char(6)       ___(b1)___ ,
    tname varchar(10) ___(b2)___ ,
    tsex char(2)      ___(b3)___ ,
    title varchar(10) ___(b4)___ ,
    tgrade int        ___(b5)___ ,
    salary int        ___(b6)___
);`,
    String.raw`CREATE TABLE teacher (
    tno char(6)       PRIMARY KEY,
    tname varchar(10) NOT NULL,
    tsex char(2)      CHECK (tsex IN ('男','女')),
    title varchar(10) DEFAULT '讲师',
    tgrade int        DEFAULT YEAR(GETDATE()),
    salary int        CHECK(salary > 0)
);`,
    [
      ["b1", "PRIMARY KEY"],
      ["b2", "NOT NULL"],
      ["b3", "CHECK (tsex IN ('男','女'))", "CHECK(tsex IN ('男','女'))"],
      ["b4", "DEFAULT '讲师'"],
      ["b5", "DEFAULT YEAR(GETDATE())"],
      ["b6", "CHECK(salary > 0)", "CHECK (salary > 0)"],
    ],
    "按题干逐条对号入座：主键 → PRIMARY KEY、不能为空 → NOT NULL、只能取… → CHECK…IN、默认为… → DEFAULT、大于 0 → CHECK(列名 > 0)。取当前年份用 YEAR(GETDATE())，函数不加引号。",
  ),
  code(
    3,
    "数据库中有三个关系 S(SNO,SNAME,AGE,SEX,DEPT)、C(CNO,CNAME,TEACHER,SMESTER)、SC(SNO,CNO,GRADE)。给计算机系所有女生的课程成绩加 6 分。补全 SQL 语句。",
    String.raw`UPDATE SC
SET ___(b1)___
FROM ___(b2)___
WHERE ___(b3)___
  AND ___(b4)___ ;`,
    String.raw`UPDATE SC
SET GRADE = GRADE + 6
FROM S JOIN SC ON S.SNO = SC.SNO
WHERE SEX = '女' AND DEPT = '计算机系';`,
    [
      ["b1", "GRADE = GRADE + 6", "GRADE=GRADE+6"],
      ["b2", "S JOIN SC ON S.SNO = SC.SNO", "S JOIN SC ON S.SNO=SC.SNO"],
      ["b3", "SEX = '女'", "SEX='女'"],
      ["b4", "DEPT = '计算机系'", "DEPT='计算机系'"],
    ],
    "跨表更新骨架是 UPDATE 目标表 SET … FROM 目标表 JOIN 来源表 ON 连接条件 WHERE 筛选条件。必须写 FROM + JOIN，否则 WHERE 里引用的 S 不在 UPDATE 作用域内。",
  ),
  code(
    4,
    "查询每个系学生的平均年龄，筛选出平均年龄大于 20 岁的系和对应平均年龄，并按平均年龄升序排列。补全 SQL 语句。",
    String.raw`SELECT DEPT, ___(b1)___
FROM S
___(b2)___
___(b3)___
ORDER BY ___(b4)___ ;`,
    String.raw`SELECT DEPT, AVG(AGE) AS 平均年龄
FROM S
GROUP BY DEPT
HAVING AVG(AGE) > 20
ORDER BY AVG(AGE) ASC;`,
    [
      ["b1", "AVG(AGE)"],
      ["b2", "GROUP BY DEPT"],
      ["b3", "HAVING AVG(AGE) > 20", "HAVING AVG(AGE)>20"],
      ["b4", "AVG(AGE)"],
    ],
    "「每个系」→ GROUP BY；「平均年龄大于 20」是对组的过滤，必须用 HAVING 且不能用 SELECT 别名；ORDER BY 最后执行，升序 ASC 可省略。",
  ),
  code(
    5,
    "设数据库中有三个关系：学生表 S(SNO, NAME, AGE, SEX, DEPT)、课程表 C(CNO,CNAME,TEACHER,CREDIT,SEMESTER)、选课表 SC(SNO,CNO,GRADE)。查询「信息管理系」学生的最大年龄和平均年龄。补全 SQL 语句。",
    String.raw`SELECT ___(b1)___
FROM ___(b2)___
WHERE ___(b3)___ ;`,
    String.raw`SELECT MAX(AGE) AS 最大年龄, AVG(AGE) AS 平均年龄
FROM S
WHERE DEPT = '信息管理系';`,
    [
      ["b1", "MAX(AGE),AVG(AGE)", "MAX(AGE), AVG(AGE)"],
      ["b2", "S"],
      ["b3", "DEPT='信息管理系'", "DEPT = '信息管理系'"],
    ],
    "单表聚合、没有分组，所以筛选条件写 WHERE 而不是 HAVING；MAX / AVG 都忽略 NULL，AVG 的分母是非空 AGE 的条数。",
  ),
  code(
    6,
    "查询所选课程的平均成绩大于信息管理系全体学生的平均成绩的学生学号、姓名及平均成绩。表结构同第 3 题。补全 SQL 语句。",
    String.raw`SELECT ___(b1)___
FROM S JOIN SC ON S.SNO = SC.SNO
___(b2)___
HAVING ___(b3)___ > ( ___(b4)___ );`,
    String.raw`SELECT S.SNO, NAME, AVG(GRADE) AS 平均成绩
FROM S JOIN SC ON S.SNO = SC.SNO
GROUP BY S.SNO, NAME
HAVING AVG(GRADE) > (
    SELECT AVG(GRADE) FROM S JOIN SC ON S.SNO = SC.SNO
    WHERE DEPT = '信息管理系');`,
    [
      ["b1", "S.SNO, NAME, AVG(GRADE)", "S.SNO,NAME,AVG(GRADE)"],
      ["b2", "GROUP BY S.SNO,NAME", "GROUP BY S.SNO, NAME"],
      ["b3", "AVG(GRADE)"],
      [
        "b4",
        "SELECT AVG(GRADE) FROM S JOIN SC ON S.SNO=SC.SNO WHERE DEPT='信息管理系'",
        "SELECT AVG(GRADE) FROM S JOIN SC ON S.SNO = SC.SNO WHERE DEPT = '信息管理系'",
      ],
    ],
    "SELECT 里的非聚合列（S.SNO、NAME）必须全部写进 GROUP BY；HAVING 里要重复写 AVG(GRADE)，不能用别名；括号内是标量子查询，返回单值才能用 > 比较。",
  ),
  code(
    7,
    "编写一个「后触发器」，限定 S 表（学生表）中年龄的取值范围为 16–40。补全触发器语句。",
    String.raw`CREATE TRIGGER tri_age
ON ___(b1)___
AS
BEGIN
    IF EXISTS ( ___(b2)___ WHERE ___(b3)___ )
        ROLLBACK TRANSACTION;
END;`,
    String.raw`CREATE TRIGGER tri_age
ON S AFTER INSERT, UPDATE
AS
BEGIN
    IF EXISTS (SELECT * FROM INSERTED WHERE AGE NOT BETWEEN 16 AND 40)
        ROLLBACK TRANSACTION;
END;`,
    [
      ["b1", "S AFTER INSERT, UPDATE", "S AFTER INSERT,UPDATE"],
      ["b2", "SELECT * FROM INSERTED", "SELECT * FROM inserted"],
      ["b3", "AGE NOT BETWEEN 16 AND 40", "AGE NOT BETWEEN 16 AND 40"],
    ],
    "AFTER 是「先执行原 SQL，再检查，违规用 ROLLBACK 撤回」；INSERT / UPDATE 的新值在 inserted 表，所以检查它即可；BETWEEN 是闭区间，取反写 NOT BETWEEN。",
  ),
  code(
    8,
    "查询选修了 'C001' 课程的学生的学号和成绩，要求这些学生的成绩大于所有选修了 'C002' 课程的学生的成绩。补全 SQL 语句。",
    String.raw`SELECT SNO, GRADE
FROM SC
WHERE GRADE > ___(b1)___
  AND ___(b2)___ ;`,
    String.raw`SELECT SNO, GRADE FROM SC
WHERE GRADE > ALL (SELECT GRADE FROM SC WHERE CNO = 'C002')
  AND CNO = 'C001';`,
    [
      ["b1", "ALL ( SELECT GRADE FROM SC WHERE CNO = 'C002')", "ALL (SELECT GRADE FROM SC WHERE CNO = 'C002')"],
      ["b2", "CNO = 'C001'", "CNO='C001'"],
    ],
    "「大于所有」= > ALL = 大于结果中的最大值，等价于 > (SELECT MAX(GRADE) …)；「大于其中某一个」才用 > SOME / ANY。",
  ),
  code(
    9,
    "查询年龄比计算机系所有学生年龄都小的经济管理系学生的姓名和年龄，并按年龄降序排列。表结构：S(SNO,SNAME,AGE,SEX,DEPT)。补全 SQL 语句。",
    String.raw`SELECT ___(b1)___
FROM S
WHERE AGE < ALL ( ___(b2)___ )
  AND ___(b3)___
___(b4)___ ;`,
    String.raw`SELECT SNAME, AGE FROM S
WHERE AGE < ALL (SELECT AGE FROM S WHERE DEPT = '计算机系')
  AND DEPT = '经济管理系'
ORDER BY AGE DESC;`,
    [
      ["b1", "SNAME, AGE", "SNAME,AGE"],
      ["b2", "SELECT AGE FROM S WHERE DEPT = '计算机系'", "SELECT AGE FROM S WHERE DEPT='计算机系'"],
      ["b3", "DEPT = '经济管理系'", "DEPT='经济管理系'"],
      ["b4", "ORDER BY AGE DESC"],
    ],
    "「比……都小」= < ALL = 小于最小值；< SOME 才是小于最大值。ORDER BY 必须写在 WHERE 之后，降序用 DESC。",
  ),
  code(
    10,
    "创建数据库 TeachingDB，主数据文件逻辑名 TeachingDB_data，物理路径 D:\\data\\TeachingDB.mdf，初始大小 10MB，每次增长 5MB；日志文件逻辑名 TeachingDB_log，物理路径 D:\\data\\TeachingDB_log.ldf，初始大小 5MB，按 10% 增长。补全创建语句。",
    String.raw`___(b1)___ TeachingDB
ON PRIMARY (
    NAME = ___(b2)___ ,
    FILENAME = ___(b3)___ ,
    SIZE = 10MB,
    FILEGROWTH = ___(b4)___
)
LOG ON (
    NAME = 'TeachingDB_log',
    FILENAME = 'D:\data\TeachingDB_log.ldf',
    SIZE = 5MB,
    FILEGROWTH = 10%
);`,
    String.raw`CREATE DATABASE TeachingDB
ON PRIMARY (
    NAME = 'TeachingDB_data',
    FILENAME = 'D:\data\TeachingDB.mdf',
    SIZE = 10MB,
    FILEGROWTH = 5MB,
    MAXSIZE = 500MB
)
LOG ON (
    NAME = 'TeachingDB_log',
    FILENAME = 'D:\data\TeachingDB_log.ldf',
    SIZE = 5MB,
    FILEGROWTH = 10%
);`,
    [
      ["b1", "CREATE DATABASE"],
      ["b2", "'TeachingDB_data'", "TeachingDB_data"],
      ["b3", "'D:\\data\\TeachingDB.mdf'", "D:\\data\\TeachingDB.mdf"],
      ["b4", "5MB"],
    ],
    "填空四大件 ON PRIMARY、NAME、FILENAME、SIZE / FILEGROWTH；上下两段互相对照即可补出。与第 1 题是同一模板，只有库名和增长量不同。",
  ),
  code(
    11,
    "创建教师表：教师编号为主键，姓名不能为空，性别只能取「男」或「女」，职称默认为「讲师」，入职年份默认为当前年份，月薪必须大于 0。补全建表语句。",
    String.raw`CREATE TABLE 教师 (
    教师编号 char(6)       ___(b1)___ ,
    姓名     varchar(20)   ___(b2)___ ,
    性别     char(2)       ___(b3)___ ,
    职称     varchar(10)   ___(b4)___ ,
    入职年份 int           ___(b5)___ ,
    月薪     decimal(8,2)  ___(b6)___
);`,
    String.raw`CREATE TABLE 教师 (
    教师编号  char(6)      PRIMARY KEY,
    姓名      varchar(20)  NOT NULL,
    性别      char(2)      CHECK (性别 IN ('男','女')),
    职称      varchar(10)  DEFAULT '讲师',
    入职年份  int          DEFAULT YEAR(GETDATE()),
    月薪      decimal(8,2) CHECK (月薪 > 0)
);`,
    [
      ["b1", "PRIMARY KEY"],
      ["b2", "NOT NULL"],
      ["b3", "CHECK (性别 IN ('男','女'))", "CHECK(性别 IN ('男','女'))"],
      ["b4", "DEFAULT '讲师'"],
      ["b5", "DEFAULT YEAR(GETDATE())"],
      ["b6", "CHECK (月薪 > 0)", "CHECK(月薪 > 0)"],
    ],
    "四个高频坑：DEFAULT GETDATE() 不加引号、取年份套 YEAR()；CHECK 括号里必须带列名；字符串 / 日期常量用单引号；外键被参照列必须是主键或 UNIQUE 且父表先建。",
  ),
  code(
    12,
    "统计各系的学生人数和平均年龄，只显示人数不少于 3 人的系，按人数从多到少排序。表 S(学号, 姓名, 性别, 年龄, 系别)。补全 SQL 语句。",
    String.raw`SELECT 系别,
       COUNT(*)   AS 人数,
       AVG(年龄)  AS 平均年龄
FROM S
___(b1)___
___(b2)___
___(b3)___ ;`,
    String.raw`SELECT 系别, COUNT(*) AS 人数, AVG(年龄) AS 平均年龄
FROM S
GROUP BY 系别
HAVING COUNT(*) >= 3
ORDER BY 人数 DESC;`,
    [
      ["b1", "GROUP BY 系别", "GROUP BY 系别"],
      ["b2", "HAVING COUNT(*) >= 3", "HAVING COUNT(*)>=3"],
      ["b3", "ORDER BY 人数 DESC", "ORDER BY COUNT(*) DESC", "ORDER BY 人数 DESC（或 ORDER BY COUNT(*) DESC）"],
    ],
    "「各系 / 每个」= 分组；「人数不少于 3」是对组的过滤 → HAVING COUNT(*) >= 3，不能写 HAVING 人数 >= 3（别名还没产生）；「从多到少」= DESC。",
  ),
  code(
    13,
    "查询年龄小于「信息管理系」所有学生年龄的学生信息。补全 SQL 语句。",
    String.raw`SELECT *
FROM S
WHERE 年龄 ___(b1)___ (SELECT 年龄 FROM S WHERE 系别 = '信息管理系');`,
    String.raw`SELECT * FROM S
WHERE 年龄 < ALL (SELECT 年龄 FROM S WHERE 系别 = '信息管理系');`,
    [["b1", "< ALL", "<ALL"]],
    "「小于所有」= 小于最小值，等价于 年龄 < (SELECT MIN(年龄) …)。若题干是「小于其中某一个」，才用 < SOME / ANY（小于最大值）。",
  ),
  code(
    14,
    "把「计算机系」学生选修「数据库」课程的成绩各加 5 分（最高不超过 100）。表 S(学号, 姓名, 性别, 年龄, 系别)、C(课程号, 课程名, 学分)、SC(学号, 课程号, 成绩)。补全 SQL 语句。",
    String.raw`UPDATE SC
SET 成绩 = ___(b1)___
FROM SC
JOIN S ON ___(b2)___
JOIN C ON ___(b3)___
WHERE S.系别 = '计算机系' AND C.课程名 = '数据库';`,
    String.raw`UPDATE SC
SET 成绩 = CASE WHEN 成绩 + 5 > 100 THEN 100 ELSE 成绩 + 5 END
FROM SC
JOIN S ON SC.学号 = S.学号
JOIN C ON SC.课程号 = C.课程号
WHERE S.系别 = '计算机系' AND C.课程名 = '数据库';`,
    [
      [
        "b1",
        "CASE WHEN 成绩 + 5 > 100 THEN 100 ELSE 成绩 + 5 END",
        "CASE WHEN 成绩+5>100 THEN 100 ELSE 成绩+5 END",
        "成绩 + 5",
        "成绩+5",
      ],
      ["b2", "SC.学号 = S.学号", "SC.学号=S.学号"],
      ["b3", "SC.课程号 = C.课程号", "SC.课程号=C.课程号"],
    ],
    "两个 JOIN 的连接条件分别用两表的同名主键字段相等；上限用 CASE WHEN 而不是额外 WHERE（WHERE 会把超过上限的行排除掉）。没有上限要求时直接写 成绩 + 5。",
  ),
];

/* ------------------------------------------------- 综合题（E-R 与关系模式） */

const DESIGN: readonly Question[] = [
  short(
    9,
    TOPIC.design,
    "某商业公司数据库中有三个实体集：「商店」（商店编号、商店名、地址等）、「商品」（商品号、商品名、规格、单价等）、「职工」（职工编号、姓名、性别、业绩等）。商店与商品间存在「销售」联系：每个商店可销售多种商品，每种商品也可放在多个商店销售，每个商店销售一种商品要记录「月销售量」；商店与职工间存在「聘用」联系：一个商店聘用多名职工，一名职工只在一个商店工作，聘用要记录「聘期」和「月薪」。要求：① 画出 E-R 图（含实体、属性、联系及基数，主键属性加下划线）；② 转换为关系模式，并标注主键与外键。",
    [
      ["画出三个实体（商店、商品、职工），主键商店编号、商品号、职工编号加下划线。", 2],
      ["商店—商品「销售」标 m:n；商店—职工「聘用」标 1:n，基数标注正确。", 2],
      ["联系属性齐全：销售挂「月销售量」，聘用挂「聘期」「月薪」。", 2],
      ["职工表并入商店编号、聘期、月薪，商店编号作外键（1:n 合并到 n 端，不单独建表）。", 2],
      ["销售表 (商店编号, 商品号) 为复合主键，两者同时是外键，月销售量为普通属性。", 2],
    ],
    "1:n 的「聘用」并进 n 端（职工表）；m:n 的「销售」必须单独成表，两端主键组成复合主键。常见扣分点：主键忘画下划线、连线忘标 1/n/m、联系属性漏画、m:n 新表主键只写一个字段。",
  ),
  short(
    10,
    TOPIC.design,
    "某医院有若干科室，每个科室有科室编号、科室名称、联系电话；每位医生有医生编号、姓名、职称，且只属于一个科室；每位病人有病历号、姓名、性别、年龄；一位医生可以为多位病人看病，一位病人也可以找多位医生就诊，就诊时需要记录就诊日期和诊断结果。要求画 E-R 图并转关系模式（标注主键外键）。",
    [
      ["画出三个实体（科室、医生、病人），主键科室编号、医生编号、病历号加下划线。", 2],
      ["科室—医生为 1:n（属于），医生—病人为 m:n（就诊），基数标注正确。", 2],
      ["「就诊」联系上挂「就诊日期」「诊断结果」两个属性。", 2],
      ["医生表并入科室编号作外键（1:n 合并到 n 端）。", 2],
      ["就诊表 (医生编号, 病历号) 为复合主键，两者同时是外键。", 2],
    ],
    "转换四句话：每个实体一个关系模式；1:n 合并到 n 端；m:n 必须单独建表、主键取两端组合；联系自身属性放进 m:n 新表。若同一病人可多次找同一医生就诊，主键要加「就诊日期」。",
  ),
  short(
    11,
    TOPIC.design,
    "某图书馆有若干出版社，每个出版社有社号、社名；每种图书有书号、书名、单价，且只由一个出版社出版；每位读者有读者证号、姓名、电话；一位读者可以借阅多种图书，一种图书也可以被多位读者借阅，借阅时要记录借阅日期。要求画 E-R 图并转关系模式（标注主键外键）。",
    [
      ["画出三个实体（出版社、图书、读者），主键社号、书号、读者证号加下划线。", 2],
      ["出版社—图书为 1:n（出版），读者—图书为 m:n（借阅），基数标注正确。", 2],
      ["「借阅」联系上挂「借阅日期」属性。", 2],
      ["图书表并入社号作外键（1:n 合并到 n 端）。", 2],
      ["借阅表 (读者证号, 书号) 为复合主键，两者同时是外键。", 2],
    ],
    "出版社—图书 1:n，读者—图书 m:n；借阅必须单独建表，主键取 (读者证号, 书号)。若同一读者可多次借阅同一本书，主键要加「借阅日期」。",
  ),
];

/* -------------------------------------------------------------- 组装 */

const QUESTIONS: readonly Question[] = [
  ...SINGLE_CHOICE,
  ...FILL_BLANK,
  ...SHORT_ANSWER,
  ...CODE_BLANK,
  ...DESIGN,
];

const MANIFEST: BankManifest = {
  schemaVersion: SCHEMA_VERSION,
  bankId: BANK_ID,
  title: "SQL Server 期末全题型题库",
  subject: "SQL Server 数据库应用技术",
  questionCount: QUESTIONS.length,
  topics: [...TOPICS],
  examTemplates: [
    {
      templateId: "sqlserver:exam:final",
      bankId: BANK_ID,
      title: "SQL Server 期末模拟卷（100 分）",
      sections: [
        {
          sectionId: "single",
          title: "一、单项选择题（15 题 × 1 分）",
          questionType: "single_choice",
          count: 15,
          scoreEach: 1,
        },
        {
          sectionId: "fill",
          title: "二、填空题（15 题 × 1 分）",
          questionType: "fill_blank",
          count: 15,
          scoreEach: 1,
        },
        {
          sectionId: "short",
          title: "三、简答题（5 题 × 4 分）",
          questionType: "short_answer",
          count: 5,
          scoreEach: 4,
          filter: {
            topicIds: [TOPIC.basics, TOPIC.env, TOPIC.tsql, TOPIC.objects, TOPIC.ops],
          },
        },
        {
          sectionId: "app",
          title: "四、应用题（5 题 × 8 分）",
          questionType: "code_blank",
          count: 5,
          scoreEach: 8,
        },
        {
          sectionId: "design",
          title: "五、综合题（2 题 × 5 分）",
          questionType: "short_answer",
          count: 2,
          scoreEach: 5,
          filter: { topicIds: [TOPIC.design] },
        },
      ],
      totalScore: 100,
    },
  ],
  createdAt: "2026-11-19T00:00:00.000Z",
};

const VALIDATED = validateBankPackage({ manifest: MANIFEST, questions: QUESTIONS });

if (!VALIDATED.ok) {
  const detail = VALIDATED.issues.map((issue) => `${issue.path ?? ""} ${issue.message}`).join("\n");
  throw new Error(`内置题库 SQLServer 校验失败：\n${detail}`);
}

export const sqlServerBank: BankContent = {
  manifest: MANIFEST,
  questions: VALIDATED.questions,
  knowledge: [],
};
