---
moduleId: javaweb:kb:mybatis
topicId: javaweb:topic:mybatis
title: MyBatis
summary: 把 SQL 写回 XML，把样板代码交给框架——核心就三件事：三个对象、四个标签、#{} 与 ${} 的区别。
minutes: 28
examFocus: 简答常考"#{} 与 ${} 的区别"与"MyBatis 的优缺点"；填空常考核心对象名、四个映射标签、dataSource 三种类型。
goals:
  - 能说清 SqlSessionFactoryBuilder / SqlSessionFactory / SqlSession 各自的生命周期与职责
  - 能写出完整的最小配置：environments + mappers，并解释 transactionManager 与 dataSource
  - 能说清 #{} 与 ${} 在编译方式、防注入、适用场景上的三点差异
  - 能区分 resultType 与 resultMap，并说出什么情况下必须用 resultMap
  - 能写出 if / where / foreach 三个最常用的动态 SQL 标签
pitfalls:
  - 四个标签名就是增删改查的英文单词，拼错启动就报错
  - mappers 里可以用 <package name="..."/> 批量扫描接口
  - SqlSession 不是线程安全的，用完必须 close，不要做成成员变量
  - ${} 是字符串拼接，能被注入，只允许用于表名、列名、排序字段（且要白名单校验）
  - resultType 与 resultMap 不能同时写
resources:
  - MyBatis 3 官方文档（中文） | https://mybatis.org/mybatis-3/zh_CN/index.html | 配置项与动态 SQL 标签的权威清单
---

## 这一节解决什么问题

用 JDBC 查一张表，代码要写成这样：

```java
Connection conn = null; PreparedStatement ps = null; ResultSet rs = null;
try {
    conn = DriverManager.getConnection(url, user, pwd);
    ps = conn.prepareStatement("select id, name from user where id = ?");
    ps.setLong(1, id);
    rs = ps.executeQuery();
    if (rs.next()) { /* 手工把每一列塞进对象 */ }
} catch (SQLException e) { ... } finally { /* 三层关闭，顺序还不能错 */ }
```

真正有价值的信息只有两行：**SQL 语句**和**结果怎么映射成对象**。其余全是样板。MyBatis 的定位就是：**SQL 你自己写，样板交给它**。

这也是它和 Hibernate 这类全自动 ORM 的根本区别——SQL 可控，适合需要优化语句的国内项目。

## 一分钟速览

| 主题 | 必须记住的内容 |
| --- | --- |
| 三个核心对象 | `SqlSessionFactoryBuilder` → `SqlSessionFactory` → `SqlSession` |
| 配置两块 | `environments`（事务管理器 + 数据源）、`mappers`（映射文件在哪） |
| 四个映射标签 | `select`、`insert`、`update`、`delete` |
| 两个类型 | `parameterType` 入参、`resultType` 返回 |
| 取值的两种写法 | `#{}` 预编译占位防注入；`${}` 字符串拼接 |
| 动态 SQL | `if`、`where`、`set`、`foreach`、`choose` |
| 缓存 | 一级缓存（SqlSession 内，默认开）、二级缓存（Mapper 级，需配置） |

## 三个核心对象与它们的生命周期

| 对象 | 作用 | 生命周期 | 建议 |
| --- | --- | --- | --- |
| `SqlSessionFactoryBuilder` | 读配置，建工厂 | 用完即可丢 | 只在启动时用一次 |
| `SqlSessionFactory` | 生产 `SqlSession` | 应用级，一个应用一个 | 做成单例 |
| `SqlSession` | 执行 SQL、管事务 | 一次会话 | **不能共享，用完必须 `close()`** |

```java
// 1. 读配置
InputStream in = Resources.getResourceAsStream("mybatis-config.xml");
// 2. 建工厂（builder 用完就丢）
SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(in);
// 3. 开会话，执行，关闭
try (SqlSession session = factory.openSession()) {
    UserMapper mapper = session.getMapper(UserMapper.class);
    User user = mapper.findById(3L);
    session.commit();          // 增删改必须提交，否则不生效
}
```

**`SqlSession` 线程不安全**这条要单独记：它内部持有 `Connection` 与一级缓存，两个线程共用一个会串数据。所以绝不能写成 Servlet 的成员变量。

一条常被忽略的事实：**MyBatis 默认不自动提交**。`openSession()` 等价于 `openSession(false)`，增删改后不 `commit()` 数据库里什么都没有——这是"代码没报错但数据没进去"的最常见原因。

## 配置文件：两块，缺一不可

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE configuration PUBLIC "-//mybatis.org//DTD Config 3.0//EN"
        "https://mybatis.org/dtd/mybatis-3-config.dtd">
<configuration>
  <properties resource="db.properties"/>

  <settings>
    <setting name="mapUnderscoreToCamelCase" value="true"/>   <!-- user_name → userName -->
    <setting name="logImpl" value="STDOUT_LOGGING"/>          <!-- 把 SQL 打到控制台 -->
  </settings>

  <typeAliases>
    <package name="com.shop.model"/>       <!-- 之后 resultType 可只写 User -->
  </typeAliases>

  <environments default="dev">
    <environment id="dev">
      <transactionManager type="JDBC"/>
      <dataSource type="POOLED">
        <property name="driver" value="${db.driver}"/>
        <property name="url" value="${db.url}"/>
        <property name="username" value="${db.username}"/>
        <property name="password" value="${db.password}"/>
      </dataSource>
    </environment>
  </environments>

  <mappers>
    <package name="com.shop.mapper"/>      <!-- 批量扫描：接口与同名 XML 同包同名时最省事 -->
  </mappers>
</configuration>
```

### transactionManager 的两种类型

| 类型 | 含义 |
| --- | --- |
| `JDBC` | 直接用 `Connection` 的 `commit`/`rollback`，**独立使用时选它** |
| `MANAGED` | 把事务交给容器（如 Spring），自己不管提交 |

与 Spring 整合后，事务由 Spring 的 `DataSourceTransactionManager` 管，MyBatis 这边一般写 `MANAGED` 或不写。

### dataSource 的三种类型

| 类型 | 含义 | 适用 |
| --- | --- | --- |
| `UNPOOLED` | 每次请求新建连接，用完关掉 | 学习、极低频场景 |
| `POOLED` | 内置连接池 | 单机项目默认选择 |
| `JNDI` | 从容器（Tomcat）取数据源 | 部署在 JavaEE 容器里、由容器统一管连接 |

## 映射文件：四个标签

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "https://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.shop.mapper.UserMapper">

  <select id="findById" parameterType="long" resultType="User">
    select id, user_name, age from t_user where id = #{id}
  </select>

  <insert id="insert" parameterType="User" useGeneratedKeys="true" keyProperty="id">
    insert into t_user(user_name, age) values(#{userName}, #{age})
  </insert>

  <update id="updateAge">
    update t_user set age = #{age} where id = #{id}
  </update>

  <delete id="deleteById" parameterType="long">
    delete from t_user where id = #{id}
  </delete>
</mapper>
```

| 属性 | 作用 | 备注 |
| --- | --- | --- |
| `id` | 语句唯一标识 | **必须与 Mapper 接口的方法名一致**，否则调用时报"找不到语句" |
| `parameterType` | 入参类型 | 可省略，MyBatis 能推断 |
| `resultType` | 单条结果的类型 | 与 `resultMap` **二选一** |
| `useGeneratedKeys` + `keyProperty` | 回填自增主键 | 插入后对象的 `id` 才有值 |
| `namespace` | 命名空间 | 接口开发时**必须写接口全限定名** |

**四个标签名拼错会直接导致启动失败**（DTD 校验），这也是最容易发现的错误——反而是"namespace 写错"更隐蔽，报错信息是"Invalid bound statement"。

## #{} 与 ${}：这一节的最高频考点

| 对比项 | `#{}` | `${}` |
| --- | --- | --- |
| 底层实现 | 预编译，转成 `?` 占位符 | 字符串直接拼进 SQL |
| 是否防注入 | **防**（值不会被当 SQL 解析） | **不防**（值会被当 SQL 的一部分） |
| 类型处理 | 自动按参数类型设置 | 全部按字符串拼 |
| 适用场景 | 绝大多数取值场景 | 表名、列名、排序字段等**标识符** |
| 示例 | `where id = #{id}` → `where id = ?` | `order by ${column}` → `order by age` |

```java
// 用户输入 "1 or 1=1"
// #{id} → where id = ? ，参数整体作为值，查不到 → 安全
// ${id} → where id = 1 or 1=1 ，整表返回 → 被注入
```

那什么时候不得不用 `${}`？只有**标识符位置**：`order by ${sortField}`、`select * from ${tableName}`。这时必须自己做白名单：

```java
private static final Set<String> ALLOWED_SORT = Set.of("age", "user_name", "id");

if (!ALLOWED_SORT.contains(sortField)) throw new IllegalArgumentException("非法排序字段");
```

一句能写进简答的话：**能用 `#{}` 就用 `#{}`；必须用 `${}` 时必须白名单校验。**

## resultType 与 resultMap

```xml
<!-- resultType：列名与属性名一致（或开了驼峰映射）时最省事 -->
<select id="findById" resultType="User">
  select id, user_name, age from t_user where id = #{id}
</select>

<!-- resultMap：列名与属性名不一致、或要做关联映射时必须用 -->
<resultMap id="userMap" type="User">
  <id property="id" column="id"/>
  <result property="userName" column="user_name"/>
  <result property="age" column="age"/>
</resultMap>

<select id="findById2" resultMap="userMap">
  select id, user_name, age from t_user where id = #{id}
</select>
```

| 对比项 | `resultType` | `resultMap` |
| --- | --- | --- |
| 写法成本 | 低（写个类名） | 高（逐列映射） |
| 自动映射 | 靠列名 = 属性名或驼峰配置 | 显式指定，不依赖约定 |
| 能否处理关联 | 不能 | 能（`association` / `collection`） |
| 何时必须用 | — | 列名与属性名不一致且不想开驼峰、一对一/一对多、需要类型转换 |

### 关联映射

```xml
<!-- 一个用户属于一个部门：association -->
<resultMap id="userWithDept" type="User">
  <id property="id" column="id"/>
  <result property="userName" column="user_name"/>
  <association property="dept" javaType="Dept">
    <id property="id" column="d_id"/>
    <result property="deptName" column="d_name"/>
  </association>
</resultMap>

<!-- 一个部门有多个用户：collection -->
<resultMap id="deptWithUsers" type="Dept">
  <id property="id" column="id"/>
  <result property="deptName" column="dept_name"/>
  <collection property="users" ofType="User">
    <id property="id" column="u_id"/>
    <result property="userName" column="u_name"/>
  </collection>
</resultMap>
```

两者都支持嵌套查询（`select` 属性）与嵌套结果（子标签）。嵌套查询能配 `fetchType="lazy"` 实现延迟加载，但会带来 N+1 查询问题——写报告时说明"延迟加载省了带宽、可能多了往返"就够。

## 动态 SQL：四个够用的标签

```xml
<select id="search" parameterType="UserQuery" resultType="User">
  select id, user_name, age from t_user
  <where>
    <if test="keyword != null and keyword != ''">
      and user_name like concat('%', #{keyword}, '%')
    </if>
    <if test="minAge != null">
      and age &gt;= #{minAge}
    </if>
    <if test="ids != null and ids.size() > 0">
      and id in
      <foreach collection="ids" item="it" open="(" separator="," close=")">
        #{it}
      </foreach>
    </if>
  </where>
  order by id desc
</select>
```

| 标签 | 作用 | 注意 |
| --- | --- | --- |
| `<if test="...">` | 条件拼接 | `test` 里写 OGNL 表达式，字符串判空要判 `!= ''` |
| `<where>` | 自动加 `where`，并去掉开头多余的 `and`/`or` | 比手写 `where 1=1` 干净 |
| `<set>` | 自动加 `set`，并去掉末尾多余的逗号 | 更新语句必备 |
| `<foreach>` | 遍历集合拼 `in (...)` | 三个属性必写：`collection`、`item`、`separator` |
| `<choose>/<when>/<otherwise>` | 多分支，等价 `switch` | 只命中一个分支 |

在 XML 里写 `<` 必须转义成 `&lt;`（或包在 `<![CDATA[ ]]>` 里），这是初学者最常见的语法错误。

## 缓存：一级与二级

| 级别 | 范围 | 默认 | 生效条件 |
| --- | --- | --- | --- |
| 一级缓存 | 同一个 `SqlSession` | 开启 | 同一会话内重复查同一语句与参数 |
| 二级缓存 | 同一个 `namespace`（Mapper） | 关闭 | 需在 mapper 里加 `<cache/>`，且实体可序列化 |

两级缓存的失效时机：任何增删改都会清空对应缓存；`session.clearCache()` 可手动清一级缓存。

一个必须知道的坑：**一级缓存是 `SqlSession` 级的，在 Spring 整合后每次查询往往是新会话，所以一级缓存经常"看起来没生效"**。想跨请求缓存只能用二级缓存或外部缓存（Redis）。

## Mapper 接口开发：为什么不写 Dao 实现类

```java
public interface UserMapper {
    User findById(Long id);
    int insert(User user);
    List<User> search(UserQuery query);
}
```

框架按四条约定生成实现（动态代理）：

| 约定 | 说明 |
| --- | --- |
| `namespace` = 接口全限定名 | 建立接口与 XML 的绑定 |
| 方法名 = 语句 `id` | 决定调哪条 SQL |
| 参数类型 = `parameterType` | 可省略，框架推断 |
| 返回值 = `resultType` / `resultMap` | 单条给对象，多条给 `List` |

违反任何一条，报错都是 `Invalid bound statement (not found)`。排错顺序：namespace 对不对 → 方法名与 id 是否一致 → XML 是否被 `mappers` 扫到 → XML 是否在 `resources` 下（Maven 默认不打包 `src/main/java` 里的 xml）。

## 与 Spring 整合后谁管什么

```xml
<bean id="sqlSessionFactory" class="org.mybatis.spring.SqlSessionFactoryBean">
  <property name="dataSource" ref="dataSource"/>
  <property name="mapperLocations" value="classpath:mapper/*.xml"/>
</bean>

<bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
  <property name="basePackage" value="com.shop.mapper"/>
</bean>
```

整合后三件事发生变化：

1. **`SqlSession` 不再自己开**，由 Spring 管理并与事务绑定（同一个事务里共用一个会话）。
2. **Mapper 接口直接注入**，不需要 `getMapper`。
3. **事务由 `@Transactional` 控制**，不用手工 `commit`。

## 考试怎么考

| 题型 | 常见问法 | 答题要点 |
| --- | --- | --- |
| 简答 | "`#{}` 与 `${}` 的区别" | 预编译 vs 拼接、防注入、适用场景，三点齐全 |
| 简答 | "MyBatis 的优点" | SQL 可控可优化、映射灵活、学习成本低于 Hibernate |
| 填空 | "MyBatis 的三个核心对象" | Builder / Factory / Session |
| 填空 | "dataSource 的三种类型" | UNPOOLED / POOLED / JNDI |
| 选择 | "哪个标签用于遍历集合" | `foreach` |
| 判断 | "`resultType` 与 `resultMap` 可以同时写" | 错 |
| 应用 | 写一个带条件与分页的查询 | `<where>` + `<if>` + `limit #{offset}, #{size}` |

## 自测清单

1. `SqlSessionFactory` 能不能每次请求都新建一个？为什么？
2. 增删改之后没 `commit()`，数据库里会有数据吗？
3. `order by #{column}` 会怎样？正确写法是什么？
4. 报 `Invalid bound statement`，按什么顺序排查？
5. 一级缓存为什么在 Spring 项目里常常"感觉不到"？
6. `association` 与 `collection` 分别对应什么关系？
