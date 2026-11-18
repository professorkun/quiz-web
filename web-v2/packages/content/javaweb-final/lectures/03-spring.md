---
moduleId: javaweb:kb:spring
topicId: javaweb:topic:spring
title: Spring
summary: IOC 不是"把 new 交给框架"这么简单——它解决的是"改一个实现类要动几处代码"的问题。
minutes: 30
examFocus: 选择/填空高频：IOC 与 DI 的定义、两种注入的标签、Bean 作用域、四个派生注解、@Autowired 与 @Resource 的区别。
goals:
  - 用自己的话说清 IOC 与 DI 的区别，而不是把两个词当同义词背
  - 能写 setter 注入与构造器注入两套配置，并说清 `<property>` 与 `<constructor-arg>` 各自对应什么
  - 能列出 singleton 与 prototype 的差别，并说出各自适用的对象
  - 能解释 @Autowired 按类型、@Resource 按名称，以及类型冲突时怎么补 @Qualifier
  - 能说出 AOP 五个概念的含义，以及 JDK 动态代理与 CGLIB 的分工
  - 能列出 @Transactional 失效的三种常见情形
pitfalls:
  - 构造器注入必须用 constructor-arg，写成 property 不生效
  - prototype 每次 getBean 都是新对象，singleton 才是同一个
  - @Autowired 按类型找不到时会报错，required=false 才会留空
  - @Transactional 加在 private 方法或同类内部调用上不生效（代理没经过）
  - 同一接口有多个实现时，只用 @Autowired 会因"候选不唯一"启动失败
videos:
  - 尚硅谷 Spring5 框架教程（合集） | https://www.bilibili.com/video/BV1Vf4y127N5 | IOC 容器与注解开发讲得最细，AOP 部分看后半段
resources:
  - Spring Framework 官方文档 · Core Container | https://docs.spring.io/spring-framework/reference/core.html | Bean 生命周期、作用域的权威说明
---

## 这一节解决什么问题

不用 Spring 时，一个 Service 依赖 Dao 是这样写的：

```java
public class UserService {
    private UserDao dao = new UserDaoImpl();   // 写死了具体实现
}
```

想换成 `UserDaoMyBatisImpl`，就要改这一行、重新编译。依赖一多，改动会像链条一样扩散。Spring 的做法是：**对象不在代码里 new，而是由容器创建好、按需注入**。于是"换实现"变成"改配置（或改一个注解）"。

这就是 IOC 与 DI 要解决的问题，也是这一章所有细节（标签、作用域、注解）的来处。

## 一分钟速览

| 主题 | 必须记住的内容 |
| --- | --- |
| IOC | 控制反转：对象的创建权从代码交给容器 |
| DI | 依赖注入：容器把依赖塞进对象（IOC 的实现方式） |
| 两种注入 | setter 注入（`<property>`）、构造器注入（`<constructor-arg>`） |
| ref / value | `ref` 引用另一个 Bean，`value` 赋基本类型或字符串 |
| 作用域 | `singleton`（默认）、`prototype`、`request`、`session`、`application` |
| 四个派生注解 | `@Component` / `@Service` / `@Repository` / `@Controller` |
| 两个注入注解 | `@Autowired` 按类型、`@Resource` 按名称 |
| AOP | 把日志、事务这类横切逻辑从业务代码里抽出去 |

## IOC 与 DI：一个说"谁管创建"，一个说"怎么给"

| 概念 | 全称 | 回答的问题 | 变化前后 |
| --- | --- | --- | --- |
| IOC | Inversion of Control 控制反转 | 对象的**创建权**归谁 | 代码 `new` → 容器创建 |
| DI | Dependency Injection 依赖注入 | 依赖**怎么进去** | 构造方法/`set` 主动传 → 容器反射注入 |

关系一句话：**IOC 是目标，DI 是手段**。说"用了 IOC"通常意味着"用了 DI"，但它们是两个不同层次的词，简答题分开写才拿满分。

三种获取对象的方式对比：

| 方式 | 谁创建 | 换实现要改哪 | 缺点 |
| --- | --- | --- | --- |
| 直接 `new` | 业务代码 | 改业务代码、重新编译 | 耦合最紧 |
| 简单工厂 | 工厂类 | 改工厂类 | 工厂会膨胀成巨型 switch |
| IOC 容器 | 容器 | 改配置或注解 | 需要理解容器规则（本章成本） |

## 两种注入方式

### setter 注入（属性注入）

前提：类里有 setter。

```xml
<bean id="userDao" class="com.shop.dao.UserDaoImpl"/>

<bean id="userService" class="com.shop.service.UserServiceImpl">
  <property name="userDao" ref="userDao"/>          <!-- 引用另一个 Bean -->
  <property name="pageSize" value="10"/>           <!-- 基本类型/字符串 -->
</bean>
```

```java
public class UserServiceImpl {
    private UserDao userDao;
    private int pageSize;
    public void setUserDao(UserDao userDao) { this.userDao = userDao; }
    public void setPageSize(int pageSize) { this.pageSize = pageSize; }
}
```

### 构造器注入

前提：类里有对应参数的构造方法。

```xml
<bean id="userService" class="com.shop.service.UserServiceImpl">
  <constructor-arg name="userDao" ref="userDao"/>
  <constructor-arg name="pageSize" value="10"/>
</bean>
```

`<constructor-arg>` 的定位属性有三种写法，考试可能问"参数名不保留时怎么办"：

| 写法 | 示例 | 适用 |
| --- | --- | --- |
| `name` | `<constructor-arg name="userDao" .../>` | 编译时保留了参数名（推荐） |
| `index` | `<constructor-arg index="0" .../>` | 参数名丢失时按位置 |
| `type` | `<constructor-arg type="int" .../>` | 有重载、靠类型区分 |

### 两种方式怎么选

| 对比项 | setter 注入 | 构造器注入 |
| --- | --- | --- |
| 依赖是否可缺 | 可以（不注入就是 null） | 不行（必须给，否则创建失败） |
| 能否注入 final 字段 | 不能 | 能 |
| 循环依赖 | 能解开（先建后填） | 解不开（构造时就要对方） |
| 推荐场景 | 可选依赖、配置项 | 必需依赖（Spring 官方推荐） |

## ref 与 value：别混

```xml
<property name="userDao" ref="userDao"/>     <!-- ref：值是另一个 Bean 的 id -->
<property name="pageSize" value="10"/>       <!-- value：值是字面量 -->
<property name="tags">
  <list><value>a</value><value>b</value></list>   <!-- 集合用 list/map/set/props -->
</property>
```

判断规则很简单：**值要指向容器里的另一个 bean → `ref`；值本身就是要赋的数据 → `value`**。

## Bean 的常用属性与作用域

```xml
<bean id="userService"
      class="com.shop.service.UserServiceImpl"
      scope="singleton"
      init-method="init"
      destroy-method="close"
      lazy-init="false"/>
```

| 属性 | 作用 | 考点 |
| --- | --- | --- |
| `id` | 容器内唯一标识 | `ref` 引的就是它；不写时默认用类名首字母小写 |
| `class` | 全限定类名 | 类必须有无参构造（反射用） |
| `scope` | 作用域 | 见下表 |
| `init-method` | 初始化方法 | 属性注入**之后**执行 |
| `destroy-method` | 销毁方法 | 只对 singleton 生效 |
| `lazy-init` | 是否延迟创建 | `true` 时第一次 `getBean` 才创建 |

| 作用域 | 实例个数 | 什么时候用 |
| --- | --- | --- |
| `singleton` | 容器内 1 个（默认） | 无状态的 Service、Dao |
| `prototype` | 每次 `getBean` 都新建 | 有状态的 Bean（如一次请求的上下文对象） |
| `request` | 每个请求 1 个 | Web 环境 |
| `session` | 每个会话 1 个 | Web 环境，如登录用户 |
| `application` | 每个应用 1 个 | Web 环境，等价于 `ServletContext` |

**默认是 singleton，这条必考**。很多"为什么我的成员变量被串了"的问题，根因就是 singleton 里存了请求级状态。

### Bean 生命周期（简化五步）

```
实例化（无参构造） → 属性注入 → 初始化（init-method / @PostConstruct）
   → 使用 → 销毁（destroy-method / @PreDestroy，仅 singleton）
```

如果实现了 `BeanPostProcessor`，会在初始化前后各插一段——AOP 代理就是在这里生成的。这部分了解即可，简答题写到"五步 + 初始化前后有后置处理器"就够。

## 注解开发

### 四个派生注解

XML 里写 `<bean>` 太啰嗦，注解的做法是"打标记 + 开扫描"：

```xml
<context:component-scan base-package="com.shop"/>
```

| 注解 | 语义 | 一般加在哪 |
| --- | --- | --- |
| `@Component` | 通用组件 | 不好归类时用 |
| `@Service` | 业务层 | Service 实现类 |
| `@Repository` | 持久层 | Dao 实现类（还能把数据库异常转成 Spring 的统一异常） |
| `@Controller` | 控制层 | SpringMVC 的 Controller |

**四者功能上等价**（都是把类注册进容器），只是语义分层。@Controller 在 SpringMVC 里还会被额外识别为处理器。

```java
@Service("userService")     // 不写名字时默认 userServiceImpl
public class UserServiceImpl implements UserService {
    @Autowired
    private UserDao userDao;
}
```

### @Autowired 与 @Resource

| 对比项 | `@Autowired` | `@Resource` |
| --- | --- | --- |
| 来源 | Spring 提供 | JDK（`javax.annotation` / `jakarta.annotation`） |
| 默认策略 | 按**类型** | 按**名称**，找不到再按类型 |
| 可否指定名称 | 配合 `@Qualifier("userDaoMysql")` | 直接用 `@Resource(name="userDaoMysql")` |
| 找不到时 | 默认抛异常，`required=false` 才留空 | 抛异常 |
| 放在哪 | 字段、setter、构造器 | 字段、setter |

同一接口有多个实现时的标准写法：

```java
@Service
public class UserServiceImpl implements UserService {
    @Autowired
    @Qualifier("userDaoMysql")     // 类型不唯一时用名称收窄
    private UserDao userDao;
}
```

**纯注解配置**（零 XML）：

```java
@Configuration
@ComponentScan("com.shop")
public class AppConfig {
    @Bean
    public DataSource dataSource() { ... }     // 方法返回值就是 Bean，方法名是 id
}
```

```java
ApplicationContext ctx = new AnnotationConfigApplicationContext(AppConfig.class);
UserService service = ctx.getBean(UserService.class);
```

## AOP：横切逻辑不该散落在业务里

日志、事务、权限校验，每个方法入口都要来一遍。如果每个 Service 方法里都写 `log.info(...)`，业务代码会被淹没。AOP 把它们抽成"切面"，在编译或运行时织入。

| 概念 | 含义 |
| --- | --- |
| 连接点（JoinPoint） | 所有"可以被增强"的点，Spring AOP 里就是方法调用 |
| 切点（Pointcut） | 真正被选中的那批连接点（用表达式描述） |
| 通知（Advice） | 增强做什么：前置、后置、异常、最终、环绕 |
| 切面（Aspect） | 切点 + 通知的组合 |
| 织入（Weaving） | 把切面应用到目标对象、生成代理的过程 |

```java
@Aspect
@Component
public class LogAspect {
    @Around("execution(* com.shop.service..*(..))")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        Object result = pjp.proceed();                  // 调用原方法
        System.out.println(pjp.getSignature() + " 耗时 " + (System.currentTimeMillis() - start));
        return result;
    }
}
```

五种通知：`@Before`、`@AfterReturning`、`@AfterThrowing`、`@After`（finally 语义）、`@Around`（最强，能改参数与返回值）。

**底层代理**：

| 目标类 | 用的代理 |
| --- | --- |
| 实现了接口 | JDK 动态代理（基于接口） |
| 没有接口 | CGLIB（生成子类） |

这条解释了"为什么注入时建议用接口类型"：用 JDK 代理时，容器里放的是代理对象，只能按接口取。

## 声明式事务

```java
@Service
public class OrderService {
    @Transactional(propagation = Propagation.REQUIRED, rollbackFor = Exception.class)
    public void createOrder(Order order) {
        orderDao.insert(order);
        stockDao.decrease(order.getProductId());    // 抛异常 → 整个方法回滚
    }
}
```

| 属性 | 常用值 | 说明 |
| --- | --- | --- |
| `propagation` | `REQUIRED`（默认）、`REQUIRES_NEW` | 有事务就加入 / 总是新建 |
| `isolation` | `DEFAULT`、`READ_COMMITTED` | 隔离级别 |
| `rollbackFor` | `Exception.class` | 默认只回滚 `RuntimeException` 与 `Error` |
| `readOnly` | `true` | 查询用，可优化 |

**默认只回滚运行时异常**，这是最常被踩的一条：受检异常（如 `IOException`）不会触发回滚，必须显式 `rollbackFor`。

四种"加了注解却不生效"的情形：

| 情形 | 原因 |
| --- | --- |
| 加在 `private`/`static`/`final` 方法上 | 代理无法重写该方法 |
| 同类内部方法互相调用 | 调用没经过代理对象 |
| 异常被 `catch` 掉没抛出 | 切面感知不到失败 |
| 类没被容器管理（没加 `@Service` 等） | 根本没生成代理 |

## Spring 在全栈里的位置

```
浏览器
  → DispatcherServlet（SpringMVC：接请求、找 Controller）
    → Controller（参数绑定、调 Service）
      → Service（业务、@Transactional 事务边界）
        → Dao / Mapper（JDBC 或 MyBatis）
          → 数据库
```

Spring 负责的是：**把这条链上的对象都创建好、按依赖注入、在 Service 层套上事务与切面**。SpringMVC 负责 Web 层，MyBatis 负责持久层，三者靠 Spring 的容器串起来。

## 考试怎么考

| 题型 | 常见问法 | 答题要点 |
| --- | --- | --- |
| 选择 | "默认作用域是什么" | singleton |
| 选择 | "构造器注入用哪个标签" | `<constructor-arg>` |
| 填空 | "IOC 的全称是 ____" | Inversion of Control |
| 判断 | "@Autowired 按名称注入" | 错，按类型；按名称是 @Resource |
| 简答 | "IOC 与 DI 的关系" | IOC 是目标（创建权转移），DI 是实现方式 |
| 简答 | "两种注入方式的区别" | 依赖是否可缺、能否 final、循环依赖 |
| 应用 | 写 XML 把 Dao 注入 Service | `<property name="..." ref="..."/>` 别写成 value |
| 应用 | 用注解实现一个 Service 并注入 Dao | `@Service` + `@Autowired`（或 `@Resource`） |

## 自测清单

1. `<property name="userDao" value="userDao"/>` 会怎样？错在哪？
2. singleton 的 Bean 里放了一个 `List<String>` 成员变量用来存当前请求数据，会发生什么？
3. 两个类实现同一个接口，容器里有俩 Bean，`@Autowired` 注入时会怎样？怎么修？
4. `@Transactional` 加在 Service 的 `private` 方法上为什么不生效？
5. 目标类没有实现任何接口，Spring AOP 用什么生成代理？
6. 为什么"构造器注入解不开循环依赖"？
