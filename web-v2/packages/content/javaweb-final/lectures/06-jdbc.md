---
moduleId: javaweb:kb:jdbc
topicId: javaweb:topic:jdbc
title: JDBC
summary: 五步流程是骨架，PreparedStatement 是重点——这一章几乎所有题都在问"为什么不用 Statement"。
minutes: 26
examFocus: 简答常考"JDBC 操作数据库的步骤"与"PreparedStatement 相比 Statement 的好处"；应用常考手写一段带参数查询并正确关闭资源。
goals:
  - 能默写 JDBC 五步流程，并说出每一步用到的接口
  - 能写出一段完整的查询代码，资源关闭顺序正确
  - 能用"万能密码"这个例子解释 SQL 注入，并说清 PreparedStatement 为什么能防住
  - 能区分 executeQuery、executeUpdate、execute 三个方法的返回值
  - 能手动控制事务：关自动提交 → 执行多条 → 提交或回滚
pitfalls:
  - 关闭顺序与打开相反：ResultSet → Statement → Connection
  - 用字符串拼 SQL 会被注入，参数一律走 ? 占位
  - setString 的下标从 1 开始，不是 0
  - 只 close 外层、Connection 没关会耗尽连接池
  - executeUpdate 返回的是影响行数，不是查询结果集
videos:
  - 尚硅谷 JDBC 核心技术（合集） | https://www.bilibili.com/video/BV1eJ411c7rf | 五步流程与 SQL 注入演示很直观
resources:
  - Oracle JDBC 基础教程 | https://docs.oracle.com/javase/tutorial/jdbc/basics/ | 接口语义以官方为准
---

## 这一节解决什么问题

Java 程序要读写数据库，但不同数据库（MySQL、Oracle、SQL Server）的通信协议完全不同。如果每换一个数据库就重写一遍访问代码，成本不可接受。

JDBC 的做法是**定一套接口，各数据库厂商提供驱动实现**。你的代码只依赖 `java.sql.*` 里的接口，运行时由驱动接管——这就是"面向接口编程"最典型的例子，也是它出现在这门课里的原因。

## 一分钟速览

| 主题 | 必须记住的内容 |
| --- | --- |
| 五步 | 加载驱动 → 建立连接 → 创建语句对象 → 执行 SQL → 关闭资源 |
| 三个接口 | `Connection`、`Statement`/`PreparedStatement`、`ResultSet` |
| 查询 | `executeQuery` 返回 `ResultSet` |
| 增删改 | `executeUpdate` 返回影响行数 |
| 防注入 | 用 `?` 占位 + `setXxx(下标从 1 开始)` |
| 事务 | `setAutoCommit(false)` → 多条 SQL → `commit()` / `rollback()` |
| 关闭顺序 | 与打开相反：`ResultSet` → `Statement` → `Connection` |

## 五步流程与完整代码

```java
public User findById(long id) {
    String url = "jdbc:mysql://localhost:3306/shop?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai";
    Connection conn = null;
    PreparedStatement ps = null;
    ResultSet rs = null;
    try {
        // 1. 加载驱动（JDBC 4.0 之后可省略，驱动会通过 SPI 自动注册）
        Class.forName("com.mysql.cj.jdbc.Driver");

        // 2. 建立连接
        conn = DriverManager.getConnection(url, "root", "123456");

        // 3. 创建语句对象（用 ? 占位，不要拼字符串）
        ps = conn.prepareStatement("select id, user_name, age from t_user where id = ?");

        // 4. 执行 SQL：下标从 1 开始
        ps.setLong(1, id);
        rs = ps.executeQuery();

        // 5. 处理结果
        if (rs.next()) {
            User user = new User();
            user.setId(rs.getLong("id"));
            user.setUserName(rs.getString("user_name"));
            user.setAge(rs.getInt("age"));
            return user;
        }
        return null;
    } catch (ClassNotFoundException | SQLException e) {
        throw new RuntimeException("查询用户失败", e);
    } finally {
        // 6. 关闭资源：后开的先关，每个都单独 try
        close(rs);
        close(ps);
        close(conn);
    }
}
```

同样的逻辑，用 try-with-resources 会短很多（JDBC 4.1 起 `Connection` 实现了 `AutoCloseable`）：

```java
try (Connection conn = DriverManager.getConnection(url, user, pwd);
     PreparedStatement ps = conn.prepareStatement(SQL)) {
    ps.setLong(1, id);
    try (ResultSet rs = ps.executeQuery()) {
        return rs.next() ? mapRow(rs) : null;
    }
}
```

### 五个步骤各自的考点

| 步 | 做什么 | 常见错法 |
| --- | --- | --- |
| 1 加载驱动 | `Class.forName("com.mysql.cj.jdbc.Driver")` | 用旧版类名 `com.mysql.jdbc.Driver`（MySQL 8 已废弃，会警告） |
| 2 建立连接 | `DriverManager.getConnection(url, user, pwd)` | URL 少写时区参数，MySQL 8 会报时区错误 |
| 3 创建语句 | `conn.prepareStatement(sql)` | 用 `createStatement()` 然后拼字符串 |
| 4 执行 | `executeQuery` / `executeUpdate` | 查询用 `executeUpdate`，抛异常 |
| 5 处理结果 | `while (rs.next())` 逐行取 | 忘了 `next()` 先调一次，直接 `getString` 报错 |
| 6 关闭 | 逆序、逐个 try | 只关 `Connection`，`ResultSet` 泄漏 |

### 连接 URL 的格式

```
jdbc:mysql://主机:端口/数据库名?参数1=值1&参数2=值2
```

三个常用参数：

| 参数 | 作用 |
| --- | --- |
| `useUnicode=true&characterEncoding=utf8` | 指定客户端编码，防止中文乱码 |
| `serverTimezone=Asia/Shanghai` | MySQL 8 必须，否则时区报错 |
| `useSSL=false` | 本地开发关掉 SSL，避免警告 |

## 三个核心接口

| 接口 | 职责 | 谁创建 |
| --- | --- | --- |
| `Connection` | 一个数据库连接，管事务 | `DriverManager` 或连接池 |
| `Statement` / `PreparedStatement` | 承载并执行 SQL | `conn.createStatement()` / `conn.prepareStatement()` |
| `ResultSet` | 查询结果集，像游标一样逐行前进 | `executeQuery()` 返回 |

`ResultSet` 的两个要点：

- 初始时游标在**第一行之前**，必须先 `rs.next()` 才能读第一行。
- 取值可以按列名 `rs.getString("user_name")`，也可以按下标 `rs.getString(2)`。**按列名更稳**（列顺序变了不会错），但列名写错要到运行时才发现。

## Statement 与 PreparedStatement

这是本章最重要的一张表。

| 对比项 | `Statement` | `PreparedStatement` |
| --- | --- | --- |
| SQL 形式 | 每次拼完整字符串 | 带 `?` 占位的预编译 SQL |
| 编译 | 每次执行都编译 | **一次编译，多次执行** |
| SQL 注入 | 有风险 | **防得住**（参数不会被当 SQL 解析） |
| 参数类型 | 只能拼字符串，日期/数字要自己转 | `setInt`/`setString`/`setDate` 类型安全 |
| 可读性 | 拼接长了完全没法维护 | SQL 结构清晰 |
| 执行效率 | 循环执行时反复编译 | 批量与重复执行更快 |
| 二进制数据 | 不能直接处理 | `setBinaryStream` 可以 |

### 注入是怎么发生的

```java
// ✘ 错误写法
String sql = "select * from t_user where user_name='" + name + "' and password='" + pwd + "'";
```

输入 `name = "admin' -- "`、密码随便填，拼出来是：

```sql
select * from t_user where user_name='admin' -- ' and password='xxx'
```

`--` 之后全被注释掉，条件只剩用户名 → **不需要密码就能登录**。这就是"万能密码"。

```java
// ✔ 正确写法
String sql = "select * from t_user where user_name=? and password=?";
PreparedStatement ps = conn.prepareStatement(sql);
ps.setString(1, name);
ps.setString(2, pwd);
```

`?` 的位置由数据库预编译成参数位，用户输入**永远只是值**，不可能变成 SQL 结构。这是 PreparedStatement 防注入的本质——不是"转义做得更细"，而是"值根本不参与语法解析"。

## 执行方法怎么选

| 方法 | 返回 | 用于 |
| --- | --- | --- |
| `executeQuery()` | `ResultSet` | `select` |
| `executeUpdate()` | `int`（影响行数） | `insert` / `update` / `delete` |
| `execute()` | `boolean`（是否有结果集） | 不确定语句类型时（很少用） |

一条常见错误：调用 `executeUpdate()` 执行 `select`，会抛 `SQLException: Can not issue executeUpdate() for SELECTs`。

## 事务：手动控制的四步

JDBC 默认**每条 SQL 自动提交**，所以两次更新之间出错，前一条已经生效了。要保证"要么全成功、要么全失败"，必须关掉自动提交：

```java
Connection conn = null;
try {
    conn = DriverManager.getConnection(url, user, pwd);
    conn.setAutoCommit(false);                       // 1. 关自动提交

    try (PreparedStatement ps1 = conn.prepareStatement(
            "update t_account set balance = balance - ? where id = ?")) {
        ps1.setBigDecimal(1, amount);
        ps1.setLong(2, fromId);
        ps1.executeUpdate();
    }
    try (PreparedStatement ps2 = conn.prepareStatement(
            "update t_account set balance = balance + ? where id = ?")) {
        ps2.setBigDecimal(1, amount);
        ps2.setLong(2, toId);
        ps2.executeUpdate();
    }

    conn.commit();                                   // 2. 全成功才提交
} catch (SQLException e) {
    if (conn != null) conn.rollback();               // 3. 任何一步失败就回滚
    throw new RuntimeException("转账失败", e);
} finally {
    if (conn != null) {
        conn.setAutoCommit(true);                    // 4. 还原（连接池复用前必须做）
        conn.close();
    }
}
```

**第 4 步常被忘**：连接是池化复用的，不还原 `autoCommit` 会把"手动事务"状态带给下一个使用者。

ACID 四个特性（简答常问）：

| 特性 | 含义 | 由谁保证 |
| --- | --- | --- |
| 原子性 Atomicity | 要么全做，要么全不做 | `commit` / `rollback` |
| 一致性 Consistency | 事务前后数据满足约束 | 约束 + 业务逻辑 |
| 隔离性 Isolation | 并发事务互不干扰 | 隔离级别 + 锁 |
| 持久性 Durability | 提交后不丢 | 数据库日志 |

## 批处理：循环插入的加速开关

```java
conn.setAutoCommit(false);
try (PreparedStatement ps = conn.prepareStatement("insert into t_user(user_name, age) values(?, ?)")) {
    for (User u : users) {
        ps.setString(1, u.getUserName());
        ps.setInt(2, u.getAge());
        ps.addBatch();                     // 先攒着
        if (++count % 500 == 0) ps.executeBatch();   // 每 500 条发一次
    }
    ps.executeBatch();
    conn.commit();
}
```

两个配合项：`rewriteBatchedStatements=true`（MySQL 驱动参数，让批量真正合并成一条多值 insert）、合理的批大小（太大会撑爆内存或超过 `max_allowed_packet`）。

## 连接池：为什么不能每次 new 连接

建立一次 TCP 连接 + 认证，代价是毫秒级。高并发下"每请求一连接"会让数据库连接数瞬间打满。

| 方案 | 说明 |
| --- | --- |
| 无池（`DriverManager`） | 每次新建、用完销毁，只适合学习与脚本 |
| Druid | 阿里开源，带监控面板，国内项目常用 |
| HikariCP | Spring Boot 2 起的默认实现，性能最好 |
| C3P0 | 较早的实现，老项目里还能见到 |

池化的三个参数含义要能说清：`initialSize`（初始连接数）、`maxActive`（最大连接数）、`maxWait`（拿不到连接时最多等多久）。

## DAO 模式：把 SQL 关进一个类

```java
public interface UserDao {
    User findById(long id);
    List<User> findAll();
    int insert(User user);
}

public class UserDaoImpl implements UserDao {
    private final DataSource dataSource;          // 从外部注入，不在类里 new
    public UserDaoImpl(DataSource dataSource) { this.dataSource = dataSource; }
    // 每个方法内部完成"取连接 → 执行 → 关闭"
}
```

分层的价值在这一层最明显：Service 只调 `userDao.findById(3)`，完全不知道底层是 JDBC、MyBatis 还是别的。这也是后面 MyBatis 能"平滑替换 DAO 实现"的前提。

## 考试怎么考

| 题型 | 常见问法 | 答题要点 |
| --- | --- | --- |
| 简答 | "JDBC 操作数据库的步骤" | 五步，每步点出接口名 |
| 简答 | "PreparedStatement 的好处" | 预编译、防注入、类型安全、批量效率，四点 |
| 选择 | "`executeUpdate` 返回什么" | 影响行数（int） |
| 填空 | "`setString` 的下标从 ____ 开始" | 1 |
| 判断 | "关闭连接只需关 Connection" | 错，逆序关三个 |
| 应用 | 写一段按 id 查询并返回对象 | 五步 + 逆序关闭 + 用 `?` 占位 |
| 应用 | 写一段转账事务 | `setAutoCommit(false)` + `commit` + `rollback` |

## 自测清单

1. 为什么 `Class.forName` 之后驱动就被注册了？（提示：静态代码块）
2. `setString(0, x)` 会发生什么？
3. `executeQuery` 执行 `update` 语句会怎样？
4. 转账代码里忘了 `commit()`，数据库会是什么状态？
5. 连接池里归还连接前为什么要 `setAutoCommit(true)`？
6. 为什么"按列名取值"比"按下标取值"更安全？
