# JavaWeb 期末 · 全题型题库

> 五种题型全覆盖：选择 62 题、判断 45 题、填空 27 题、简答 8 题、应用 5 套代码（90 个空位）。
>
> 用法：客观题靠重复刷（看到题干就知道答案），简答靠背要点条数，应用题靠记代码骨架。每章都是"先做题、后看答案"的排布；填空与简答另给了完整版与挖空版，遮住完整版即可自测。

## 0　题型与分值

| 题型 | 题量 | 分值 | 本册收录 | 拿分方式 |
|---|---|---|---|---|
| 选择题 | 15 | 30 | 62 题 | 靠重复刷，看到题干就知道答案 |
| 判断题 | 10 | 10 | 45 题 | 抓"只执行一次""返回什么""能不能"这类字眼 |
| 填空题 | 5 | 10 | 27 题 | 背准拼写与关键字 |
| 简答题 | 4 | 20 | 8 题 | 按要点分条写，4~5 条 |
| 应用题 | 4 | 30 | 5 套代码 | 记骨架 + 关键标签/方法 |

闭卷考试，题型顺序为选择、判断、填空、简答、应用。客观题 50 分覆盖面最广但题都不难；简答 20 分按条给分；应用 30 分是代码填空，不是从零手写。

## 0.1　考点 → 题号索引（查漏用）

| 考点 | 页码 | 选择 | 判断 | 填空 | 简答 |
|---|---|---|---|---|---|
| B/S 与 C/S、Maven | — | 1、2 | — | — | — |
| JSP 三种脚本元素 | — | 3、4 | 3 | 5 | — |
| JSP 九大内置对象 | P53 | 8、9、10、11 | 9、11 | 4 | 2 |
| 四大作用域 | — | 9 | 9、11 | — | — |
| JSP 动作标签 | P42 | 5、6、7、12、13 | 4、6、9、10 | 3、6 | 1 |
| 静态包含 vs 动态包含 | — | 12 | 6 | 3 | 1 |
| Servlet 三个步骤 | — | 19、23 | — | 7 | — |
| Servlet 生命周期与单实例多线程 | — | 16、17、18 | 12、16、19 | 8、9 | — |
| web.xml 与 @WebServlet 配置 | — | 23、24 | 19 | — | — |
| request / response 常用方法 | — | 15、25 | 7、18 | 9 | — |
| Filter 过滤器 | — | 22 | 13、15 | — | — |
| JDBC 五步 | P82 | 26 | 20 | 10 | 3 |
| Statement 两个 execute | P81 | 27、28 | 22 | — | 4 |
| PreparedStatement 与防注入 | — | 29 | 23 | 11 | — |
| ResultSet | — | 28 | 21 | 12 | — |
| Spring 两大核心 IoC / AOP | — | 30、31、35 | — | — | 5 |
| Spring 框架特点 | P141 | — | 24、25、29 | — | 5 |
| 属性注入 vs 构造器注入 | P151、156 | 32、33 | 27、30、31 | 13、14 | 6 |
| Bean 作用域与 @Component / `<bean>` | — | — | 26、28 | 15、21 | — |
| DispatcherServlet | P185 | 36 | 32、35 | — | 7 |
| SpringMVC 常用注解 | P189 | 37、38、43 | 34 | — | 8 |
| ModelAndView / 视图解析器 | — | 39、40、41、42 | 33 | 16 | 7 |
| MyBatis 全局配置 | — | 44、45、49、51 | — | 18 | — |
| MyBatis 四标签 | — | 46、47 | — | 20 | — |
| namespace / resultType / parameterType | — | 50 | — | 17 | — |
| `#{}` 与 `${}` | — | 48 | 38 | — | — |
| SqlSession 与执行流程 | — | — | 37 | 19 | — |
| ORM 概念 | — | — | 36 | — | — |
| JSP 注册 / 登录 | — | — | — | — | 应用 1、2 |
| Servlet 计数器 | — | — | — | — | 应用 3 |
| SpringMVC 参数传递 | — | — | — | — | 应用 4 |
| MyBatis 配置与映射 | — | — | — | — | 应用 5 |
| JSP page 指令各属性 | — | 52、53 | 45 | 23 | — |
| Servlet 的 load-on-startup 与 url-pattern 写法 | — | 54、55 | — | — | — |
| getParameterValues 与多值参数 | — | 56 | — | — | — |
| ServletConfig 与 ServletContext 的区别 | — | 57 | — | — | — |
| Spring Bean 作用域 prototype | — | 58 | — | — | — |
| @Autowired / @Resource 注入方式 | — | 59 | 44 | — | — |
| @ResponseBody / @RequestBody | — | 60 | — | 24 | — |
| SpringMVC 三大组件 | — | — | — | 25 | 7 |
| MyBatis `<mappers>` 的 package 扫描 | — | 61 | — | — | — |
| dataSource 的三种 type | — | 62 | 43 | 27 | — |
| MyBatis 执行流程中的类 | — | — | 42 | 26 | — |
| exception 内置对象的使用条件 | — | — | 39 | — | — |
| forward 与 sendRedirect 能访问的范围 | — | — | 40 | — | — |
| Model / ModelMap 传参 | — | — | 41 | — | — |
| session 与上下文路径 | — | — | — | 22 | — |

---

## 一　选择题（62 题，考试出 15 题）

### 1.1 结论打底：先通读这张表

| 模块 | 必须记死的话 |
|---|---|
| Web | B/S 客户端只需浏览器；C/S 要装专用软件。Maven 管依赖与构建，Tomcat 是 Servlet 容器。 |
| JSP 脚本 | `<%! %>` 声明（成员）、`<% %>` 片段（局部）、`<%= %>` 表达式（输出）、`<%-- --%>` 注释。 |
| 内置对象 | request、response、session、application、out、page、pageContext、config、exception（九个，connection 不是）。 |
| 作用域 | page < request < session < application。 |
| 动作标签 | include、forward、param、useBean、setProperty、getProperty、plugin（`<%@ include %>` 是指令不是动作）。 |
| Servlet | 单实例多线程；init/destroy 各一次，service 每请求一次；继承 HttpServlet 即间接实现接口；可多个 url-pattern。 |
| 配置 | `@WebServlet` 属性是 name 和 urlPatterns；web.xml 靠 servlet-name 关联。 |
| JDBC | 加载驱动 → 建连接 → 执行 SQL → 取结果 → 逆序关闭；executeQuery 返回 ResultSet，executeUpdate 返回 int。 |
| Spring | IoC + AOP；属性注入 `<property>` 靠 set、要无参构造；构造器注入 `<constructor-arg>` 靠有参构造；ref 引 bean、value 给普通值；Bean 默认 singleton；getBean 取 Bean。 |
| SpringMVC | DispatcherServlet 接收分发；HandlerMapping 找、ViewResolver 解析；@Controller / @RequestMapping / @PathVariable；`return "redirect:/x"` 重定向；setViewName 设视图、addObject 存数据。 |
| MyBatis | 半自动 ORM；mybatis-config.xml 配 environments（dataSource 四属性）+ mappers；四标签；`#{}` 防注入；元素顺序不可调换。 |

### 1.2 原题（分模块连排，做完再看 1.3）

**A　Web 基础与 JSP（1-15）**

1. 下列关于 B/S 架构的描述，错误的是（　　）
A. 客户端只需安装浏览器即可访问系统　B. 客户端需要安装专用软件　C. 业务逻辑都在服务器端处理　D. 便于系统的维护和升级

2. 在 Java Web 开发中，用于管理项目依赖并进行项目构建的工具是（　　）
A. Maven　B. Tomcat　C. MySQL　D. Eclipse

3. 在 JSP 页面中写 `<%! int count = 0; %>`，其作用是（　　）
A. 向页面输出 count 的值　B. 声明一个成员变量　C. 定义一个方法内的局部变量　D. 引入一个 Java 包

4. 在 JSP 页面中声明变量和方法应使用的标识符是（　　）
A. `<% %>`　B. `<%! %>`　C. `<%= %>`　D. `<%-- --%>`

5. 下列选项中，不属于 JSP 动作标签的是（　　）
A. `<jsp:include>`　B. `<jsp:forward>`　C. `<jsp:useBean>`　D. `<%@ include %>`

6. 用于获取 Bean 属性的动作是（　　）
A. `<jsp:getProperty>`　B. `<jsp:setProperty>`　C. `<jsp:useBean>`　D. `<jsp:forward>`

7. JSP 中 `<jsp:setProperty name="user" property="*" />` 的含义是（　　）
A. 把 user 对象的所有属性输出到页面　B. 把请求中与 user 属性同名的参数全部赋值给 user　C. 创建 id 为 user 的对象　D. 删除 user 对象的所有属性

8. 下列选项中，代表会话、保存用户一次浏览器会话数据的内置对象是（　　）
A. session　B. request　C. application　D. out

9. 在 JSP 中，request 与 session 的区别在于（　　）
A. request 覆盖一次请求，session 覆盖一次会话　B. request 覆盖一次会话，session 覆盖一次请求　C. 两者都覆盖整个应用　D. 两者只在当前页面有效

10. 要在页面上输出 request 作用域中名为 msg 的数据，下列写法正确的是（　　）
A. `<%= msg %>`　B. `${msg}`　C. `<jsp:getProperty name="msg"/>`　D. `<% msg %>`

11. 下列不属于 JSP 内置对象的是（　　）
A. out　B. application　C. config　D. connection

12. 关于 `<%@ include file="" %>` 静态包含，说法正确的是（　　）
A. 运行时引入被包含页面　B. 编译阶段把两个 JSP 合并成一个文件再翻译　C. 可以传递参数给被包含页面　D. 被包含页面会单独翻译成一个 Servlet

13. 下列动作标签中，能够在服务器内部把请求转发到另一页面的是（　　）
A. `<jsp:include>`　B. `<jsp:forward>`　C. `<jsp:useBean>`　D. `<jsp:param>`

14. 下列关于 JavaBean 规范的说法，不正确的是（　　）
A. 必须是 public 类　B. 必须提供无参的构造方法　C. 属性必须声明为 public，以便直接访问　D. 属性一般声明为 private，通过 getter 和 setter 访问

15. 以下哪个方法可以在 request 对象中设置属性？（　　）
A. getAttribute()　B. getParameter()　C. setAttribute()　D. setParameter()

**B　Servlet（16-25）**

16. Servlet 生命周期中，只会执行一次的方法是（　　）
A. service()　B. doGet()　C. init() 和 destroy()　D. doPost()

17. 下列选项中，不属于 Servlet 生命周期方法的是（　　）
A. init()　B. service()　C. destroy()　D. main()

18. 关于 Servlet 的工作方式，下列说法正确的是（　　）
A. 每次请求都会创建一个新的 Servlet 实例　B. 容器中通常只有一个实例，多个请求由多个线程并发处理　C. init() 方法在每次请求时都会被调用　D. Servlet 只能实现 Servlet 接口，不能继承 HttpServlet

19. 下列关于 Servlet 和 JSP 的说法，错误的是（　　）
A. JSP 页面会被容器翻译成 Servlet 源代码再编译运行　B. Servlet 输出页面需要使用 response 输出 HTML　C. JSP 页面中不能编写 Java 代码　D. Servlet 擅长业务逻辑处理，JSP 擅长页面展示输出

20. 下列说法中，正确的是（　　）
A. Servlet 中不能同时重写 doGet 和 doPost 方法　B. Servlet 必须直接或间接实现 Servlet 接口　C. Servlet 只能在 web.xml 中配置　D. Servlet 每处理一次请求就会创建一个新实例

21. 下列方法中，能够把请求转发到另一个资源、且地址栏不变的是（　　）
A. response.sendRedirect("a.jsp")　B. request.getRequestDispatcher("a.jsp").forward(request, response)　C. response.sendError(500)　D. request.getParameter("a")

22. Filter 接口中用于执行过滤逻辑的方法是（　　）
A. init()　B. doFilter()　C. destroy()　D. service()

23. 在 Servlet 配置中，使用注解配置时，下列哪种写法是正确的（　　）
A. `@WebServlet(name = "HelloServlet", url = "/HelloServlet")`　B. `@WebServlet("HelloServlet")`　C. `@WebServlet(name = "HelloServlet", urlPatterns = {"/HelloServlet"})`　D. `@WebServlet(servletName = "HelloServlet", urlPatterns = {"/HelloServlet"})`

24. 在 web.xml 中配置 Servlet 时，`<servlet>` 与 `<servlet-mapping>` 通过什么关联（　　）
A. 相同的 `<servlet-class>`　B. 相同的 `<servlet-name>`　C. 相同的 `<url-pattern>`　D. 相同的 `<load-on-startup>`

25. Servlet 中获取表单参数值应使用的方法是（　　）
A. request.getAttribute("name")　B. request.getParameter("name")　C. response.getParameter("name")　D. request.getParameterValues("name")

**C　JDBC（26-29）**

26. JDBC 操作数据库的正确顺序是（　　）
①创建 Statement　②加载驱动　③关闭资源　④建立连接　⑤执行 SQL 并处理结果
A. ②④①⑤③　B. ②①④⑤③　C. ④②①③⑤　D. ②④⑤①③

27. Statement 的 executeUpdate() 方法的返回值类型是（　　）
A. ResultSet　B. int　C. boolean　D. void

28. 执行查询 SQL 后，用于存放返回数据的对象是（　　）
A. Connection　B. Statement　C. ResultSet　D. DriverManager

29. JDBC 中，用于执行预编译 SQL 语句的对象是（　　）
A. Connection　B. PreparedStatement　C. ResultSet　D. DriverManager

**D　Spring（30-35）**

30. Spring 框架的两大核心思想是（　　）
A. IoC 和 AOP　B. MVC 和 JDBC　C. Servlet 和 JSP　D. ORM 和 XML

31. IoC（控制反转）的含义是（　　）
A. 由程序员手动创建和管理对象　B. 将对象的创建和依赖关系的管理交给 Spring 容器　C. 反转程序的执行顺序　D. 由数据库管理对象

32. 在 Spring 配置文件中，实现构造器注入应使用的元素是（　　）
A. `<property>`　B. `<constructor-arg>`　C. `<bean>`　D. `<import>`

33. Spring 中，若某属性没有提供 set 方法，则不能使用下列哪种注入方式（　　）
A. 属性（setter）注入　B. 构造器注入　C. 注解注入　D. 以上都不能

34. 在 Spring 框架中，使用 ApplicationContext 对象获取 Bean 对象的方法是（　　）
A. getClass()　B. getBean()　C. getPojo()　D. getObject()

35. Spring 中，AOP 主要解决的问题是（　　）
A. 把日志、事务、权限等横切逻辑从业务代码中抽离　B. 实现页面跳转　C. 管理数据库连接池　D. 把 Java 对象映射成数据库表

**E　SpringMVC（36-43）**

36. 在 Spring MVC 中，负责统一接收并分发请求的核心组件是（　　）
A. DispatcherServlet　B. HandlerMapping　C. ViewResolver　D. Controller

37. 下列关于 @RequestMapping 说法，错误的是（　　）
A. @RequestMapping 只能写在方法上，不能写在控制器类上　B. 可以通过 method 属性限定允许的 HTTP 请求方式　C. 建立请求 URL 与控制器方法之间的映射关系　D. @PostMapping 等价于 @RequestMapping(method = RequestMethod.POST)

38. 在 SpringMVC 中，@Controller 注解作用是（　　）
A. 将类标识为业务层组件　B. 将类标识为控制器组件　C. 用于数据持久层类上　D. 用来做依赖注入

39. 关于 MVC 中视图（View）的职责，说法正确的是（　　）
A. 接收浏览器请求，调用业务代码　B. 封装数据，处理数据库交互　C. 展示数据，渲染页面给用户　D. 编写业务逻辑

40. Spring MVC 使用哪个关键字设定重定向？（　　）
A. redirect　B. sendRedirect　C. forward　D. findForward

41. 在 SpringMVC 中，控制器方法返回 ModelAndView 对象，若要设置跳转页面名称，使用哪个方法（　　）
A. setViewName()　B. addObject()　C. setAttribute()　D. put()

42. 在 Spring MVC 中，用于把处理结果和视图一起返回给 DispatcherServlet 的类是（　　）
A. ModelAndView　B. HttpServletRequest　C. HttpSession　D. ViewResolver

43. 下列注解中，用于获取 URL 路径中占位符值（如 /user/1 中的 1）的是（　　）
A. @RequestParam　B. @PathVariable　C. @ResponseBody　D. @ModelAttribute

**F　MyBatis（44-51）**

44. MyBatis 的核心配置文件通常是（　　）
A. mybatis-config.xml　B. web.xml　C. pom.xml　D. applicationContext.xml

45. 下列关于 MyBatis 的说法，错误的是（　　）
A. MyBatis 是半自动持久层框架　B. 支持 XML 映射和注解两种方式开发 SQL　C. 配置文件中元素的先后顺序可以随意调整　D. 通过创建 SqlSessionFactory 来创建 SqlSession 对象

46. 在 MyBatis 映射文件中，用于执行数据库插入操作的标签是（　　）
A. `<select>`　B. `<insert>`　C. `<update>`　D. `<delete>`

47. MyBatis 映射文件中，用于执行查询语句的元素是（　　）
A. `<query>`　B. `<select>`　C. `<find>`　D. `<get>`

48. MyBatis 中，能够有效防止 SQL 注入的占位符写法是（　　）
A. `${name}`　B. `#{name}`　C. `@{name}`　D. `&{name}`

49. MyBatis 全局配置文件 mybatis-config.xml 中，配置数据库连接信息（driver、url、username、password）的元素是（　　）
A. `<environments>` 下的 `<dataSource>`　B. `<mappers>`　C. `<select>`　D. `<settings>`

50. MyBatis 映射文件中，namespace 的作用是（　　）
A. 指定数据库名　B. 唯一标识这个映射文件，通常与 Mapper 接口全限定名一致　C. 指定返回结果类型　D. 指定 SQL 语句的 ID

51. 关于 MyBatis 的 `<transactionManager type="JDBC" />`，下列说法正确的是（　　）
A. 表示使用 JDBC 的方式管理事务（提交、回滚）　B. 表示使用连接池　C. 表示数据库类型是 MySQL　D. 表示开启二级缓存

**G　补充题（52-62）**

52. JSP 的 page 指令中，用于导入 Java 包（如 `java.util.*`）的属性是（　　）
A. import　B. package　C. include　D. contentType

53. JSP 的 page 指令中 `isErrorPage="true"` 的作用是（　　）
A. 指定出错时跳转到当前页　B. 声明当前页是错误处理页，可以使用 exception 内置对象　C. 关闭当前页的 session　D. 设置页面的字符编码

54. 在 web.xml 中配置 `<load-on-startup>1</load-on-startup>` 的作用是（　　）
A. 让服务器启动时就创建 Servlet 实例并调用 init　B. 设置 Servlet 的访问路径　C. 指定请求方式　D. 设置会话超时时间

55. `<url-pattern>` 写成 `*.do` 表示（　　）
A. 精确匹配 /do　B. 扩展名匹配，所有以 .do 结尾的请求都交给该 Servlet　C. 拦截所有请求　D. 匹配根路径

56. request.getParameterValues("hobby") 的返回值类型是（　　）
A. String　B. String[]　C. Object　D. java.util.List

57. 下列选项中，用于获取当前 Web 应用初始化参数（web.xml 中 `<context-param>`）的对象是（　　）
A. config（ServletConfig）　B. application（ServletContext）　C. session　D. pageContext

58. Spring Bean 的作用域中，每次从容器获取都创建新实例的是（　　）
A. singleton　B. prototype　C. request　D. session

59. Spring 中，@Autowired 注解默认按什么方式注入依赖（　　）
A. 按名称　B. 按类型　C. 按声明顺序　D. 按 bean 的 id

60. SpringMVC 中，把方法返回值直接写入响应体、不走视图解析的注解是（　　）
A. @RequestBody　B. @ResponseBody　C. @RequestParam　D. @ModelAttribute

61. MyBatis 的 `<mappers>` 中，用于批量扫描整个包下映射文件的元素是（　　）
A. `<mapper resource="">`　B. `<package name="">`　C. `<scan>`　D. `<import>`

62. MyBatis 的 dataSource 中，不使用连接池的 type 取值是（　　）
A. POOLED　B. UNPOOLED　C. JNDI　D. NONE

### 1.3 答案与解析

| 题 | 答 | 一句话解析 |
|---|---|---|
| 1 | B | B/S 客户端只要浏览器，装专用软件是 C/S。 |
| 2 | A | Maven 管依赖与构建；Tomcat 是容器、MySQL 是库、Eclipse 是 IDE。 |
| 3 | B | `<%! %>` 声明的内容进入 Servlet 类体成为成员；`<% %>` 才是方法内局部。 |
| 4 | B | 四种标识符按"声明 / 片段 / 输出 / 注释"记。 |
| 5 | D | `<%@ include %>` 是 include 指令（编译期静态包含），不属于动作标签。 |
| 6 | A | get 取、set 设、useBean 创建/查找，三件套一组。 |
| 7 | B | `property="*"` 自动匹配全部同名参数，所以表单 name 要与属性一致。 |
| 8 | A | session 一次会话，常存登录状态。 |
| 9 | A | request 一次请求、转发能带走、重定向带不走；session 一次会话（默认 30 分钟）。 |
| 10 | B | `${msg}` 是 EL，按 page→request→session→application 依次查找；`<%= %>` 只能取页面内 Java 变量。 |
| 11 | D | connection 是 JDBC 连接对象，要自己创建，九个内置对象里没有它。 |
| 12 | B | 指令包含：编译期合并源码、只生成一个 Servlet、不能传参。 |
| 13 | B | `<jsp:forward>` 服务器内部跳转，地址栏不变；include 是包含、param 是传参。 |
| 14 | C | JavaBean 三规范：public 类 + 无参构造 + 属性 private 配 getter/setter。 |
| 15 | C | setAttribute 存域属性、getAttribute 取；getParameter 取请求参数，没有 setParameter。 |
| 16 | C | 构造 1 次、init 1 次、service 每次、destroy 1 次。 |
| 17 | D | main() 是普通 Java 程序入口，与 Servlet 无关。 |
| 18 | B | 单实例多线程，所以成员变量（如计数器的 hitCount）有线程安全问题。 |
| 19 | C | JSP 里当然能写 Java（脚本片段、表达式），只是不推荐。 |
| 20 | B | 继承 HttpServlet 即间接实现 Servlet 接口；两个 do 可同重写、可用注解、单实例。 |
| 21 | B | forward 一次请求、地址栏不变、能访问 WEB-INF；sendRedirect 是二次请求。 |
| 22 | B | Filter：init 初始化、doFilter 过滤（放行调 chain.doFilter）、destroy 销毁。 |
| 23 | C | 属性名是 name 和 urlPatterns，不是 url、也不是 servletName。 |
| 24 | B | 两处 servlet-name 必须完全一致，容器靠它把路径映射到类。 |
| 25 | B | getParameter 取表单/URL 参数返回 String；getAttribute 取域属性返回 Object。 |
| 26 | A | 正确顺序：②加载驱动 → ④建立连接 → ①创建 Statement → ⑤执行 SQL 并处理结果 → ③关闭资源。驱动必须先加载，资源必须最后关闭。 |
| 27 | B | executeUpdate 返回 int 影响行数；executeQuery 返回 ResultSet。 |
| 28 | C | 用 rs.next() 移游标、getXxx 取值。 |
| 29 | B | PreparedStatement 用 ? 占位、预编译、可防注入。 |
| 30 | A | IoC 解决对象创建与解耦，AOP 解决日志事务等横切逻辑。 |
| 31 | B | 控制权从"程序自己 new"反转给"容器创建并注入"。 |
| 32 | B | `<property>` 是 setter 注入；`<constructor-arg>` 才靠有参构造。 |
| 33 | A | 属性注入的原理就是调 setXxx()，没有 set 方法就注不进去。 |
| 34 | B | `ctx.getBean("userService")` 或 `ctx.getBean(UserService.class)`。 |
| 35 | A | AOP 抽离横切关注点；D 是 ORM 的职责。 |
| 36 | A | DispatcherServlet 接收分发；HandlerMapping 只找、ViewResolver 只解析。 |
| 37 | A | 类和方法上都能写，类上相当于加一级路径前缀。 |
| 38 | B | @Controller 控制层、@Service 业务层、@Repository 持久层，本质都是 @Component。 |
| 39 | C | Model 封装数据业务、View 展示渲染、Controller 接收调度。 |
| 40 | A | `return "redirect:/login.jsp"`；`forward:` 是转发；不加前缀走解析器。 |
| 41 | A | setViewName 设视图名，addObject 存数据，这两个别写反。 |
| 42 | A | ModelAndView 同时带模型与视图，交给 DispatcherServlet 再转 ViewResolver。 |
| 43 | B | @PathVariable 配 `@RequestMapping("/user/{id}")` 取路径值；@RequestParam 取 ? 后参数。 |
| 44 | A | mybatis-config.xml 配数据源、事务、映射文件位置。 |
| 45 | C | 元素顺序固定：properties→settings→typeAliases→environments→mappers。 |
| 46 | B | 四标签与 SQL 一一对应，拼写必须准（别写 updata、selete）。 |
| 47 | B | 查询用 select，通常还要写 resultType 或 resultMap。 |
| 48 | B | `#{}` 预编译成 `?`，参数由 JDBC 安全设置，能防注入。 |
| 49 | A | 层级：environments → environment → transactionManager + dataSource → 四个 property。 |
| 50 | B | namespace + id 共同定位一条 SQL；接口代理时 namespace 必须等于接口全限定名。 |
| 51 | A | 事务用 transactionManager，连接池是 dataSource 的 type="POOLED"，别混。 |
| 52 | A | page 指令的 import 相当于 Java 的 import，多个包可用逗号分隔或写多个 import 属性。 |
| 53 | B | 只有 isErrorPage="true" 的页面才有 exception 对象；跳错页是 errorPage 属性，别混。 |
| 54 | A | 数字越小越早创建；配了它，服务器启动时就实例化并调 init，而不是等第一次请求。 |
| 55 | B | `/xxx` 精确匹配、`*.do` 扩展名匹配、`/` 拦截全部（含静态资源）。 |
| 56 | B | 一个名字对应多个值（复选框）时返回 String[]，单值用 getParameter 返回 String。 |
| 57 | B | context-param 是应用级参数，用 application（ServletContext）取；init-param 是 Servlet 级，用 config 取。 |
| 58 | B | singleton 默认、prototype 每次新建，另有 request、session。 |
| 59 | B | @Autowired 按类型，@Resource 按名称——两者最本质的区别。 |
| 60 | B | @ResponseBody 写响应体；@RequestBody 读请求体，方向相反别混。 |
| 61 | B | `<package name="com.mapper"/>` 扫描整包，等价于逐个写 `<mapper resource="">`。 |
| 62 | B | POOLED 连接池、UNPOOLED 直连不用池、JNDI 用容器数据源。 |

---

## 二　判断题（45 题，考试出 10 题）

### 2.1 三种常见陷阱

| 陷阱 | 例题 | 破法 |
|---|---|---|
| 说反了 | 12「多实例单线程」、22「executeQuery 用于增删改」、27「构造器注入用 property」 | 把正版默一遍，反的就是答案 |
| 绝对化 | 9「scope 只能 page」、34「@RequestMapping 只能写方法」、37「只能引入一个映射」 | 找反例：scope 四个值、两处都能写、可多个 mapper |
| 张冠李戴 | 33「视图解析器直接渲染」、15「Filter 也能拦 JSP/HTML」（这条是对的，别慌） | 分清谁负责哪一步 |

### 2.2 原题（正确画 √，错误画 ×）

**A　Web 基础与 JSP（1-11）**

1. 动态网页就是页面上带有动画、轮播图、滚动特效的网页。
2. MVC 模式的主要目的是实现数据、业务逻辑和界面展示的分离。
3. JSP 注释 `<%-- --%>` 会出现在客户端浏览器的页面源代码中。
4. 使用 `<jsp:forward>` 转发后，浏览器地址栏中的 URL 不会改变。
5. JSP 页面第一次被访问时会被翻译成 Servlet 源文件并编译成 class 文件，之后再访问直接执行。
6. `<jsp:include>` 动作属于编译期静态包含，被包含页面的源码会原样合并进来。
7. 使用 forward 转发后，浏览器地址栏会变成目标页面的地址。
8. JSP 的 page 指令中 contentType 用于设置响应的内容类型和字符编码，可以避免中文乱码。
9. `<jsp:useBean>` 的 scope 属性只能取 page。
10. `<jsp:param>` 可以单独使用，不必嵌在其他标签中。
11. session 作用域中的数据在浏览器关闭后会立即从服务器端销毁。

**B　Servlet（12-19）**

12. Servlet 是多实例单线程运行的，因此不存在线程安全问题。
13. 过滤器（Filter）可以在请求到达 Servlet 之前对其进行拦截和处理。
14. HttpServlet 的 doPost() 方法用于处理 POST 请求。
15. 过滤器不仅可以拦截 Servlet 的请求，还可以拦截 JSP、HTML 等其他 Web 资源的请求。
16. 每次请求到达时，Servlet 容器都会调用一次 service() 方法。
17. Servlet 的 destroy() 方法在服务器关闭或应用卸载时调用，可用于释放资源。
18. response.sendRedirect() 之后，原 request 作用域中的数据仍然可以在新页面取到。
19. 一个 Servlet 类可以实现多个 url-pattern，即多个访问路径映射到同一个 Servlet。

**C　JDBC（20-23）**

20. 使用 JDBC 访问数据库时，第一步是执行 SQL 语句。
21. MySQL 中使用 limit 关键字可以实现分页查询。
22. Statement 的 executeQuery() 方法用于执行增删改操作，返回受影响的行数。
23. JDBC 中关闭资源时应按 Connection → Statement → ResultSet 的顺序关闭。

**D　Spring（24-31）**

24. Spring 是一个重量级的框架，使用它必须编写大量代码。
25. Spring 支持声明式事务管理，不用手动编写事务提交、回滚代码。
26. singleton 是 Spring Bean 默认作用域，整个容器只有一个对象实例。
27. 构造器注入时，配置文件中使用 `<property>` 标签指定构造函数参数。
28. ApplicationContext 是 BeanFactory 的子接口，功能更强大。
29. Spring 是侵入式框架，业务类必须继承框架提供的父类才能被管理。
30. Spring 的属性注入依赖 set 方法，构造器注入依赖有参构造方法。
31. Spring 的属性注入要求类中提供无参构造方法。

**E　SpringMVC（32-35）**

32. Spring MVC 是 Spring 框架的子框架，主要用于 Web 网页开发。
33. 视图解析器可以直接将 ModelAndView 渲染为 HTML 页面返回给用户。
34. Spring MVC 中，@RequestMapping 只能写在方法上。
35. DispatcherServlet 需要在 web.xml 中配置，通常把 url-pattern 配成 /，让所有请求先经过它。

**F　MyBatis（36-38）**

36. ORM 框架将数据库表数据与 Java 对象进行映射。
37. 一个 MyBatis 配置文件中只能引入一个映射文件。
38. MyBatis 中 `${}` 与 `#{}` 的作用完全等价，可以互相替换。

**G　补充题（39-45）**

39. 只有 page 指令中 `isErrorPage="true"` 的页面才能使用 exception 内置对象。
40. forward 转发可以访问 WEB-INF 目录下的资源，sendRedirect 重定向不能。
41. SpringMVC 中除了返回 ModelAndView，也可以用 Model 或 ModelMap 存数据、方法返回 String 视图名。
42. MyBatis 映射文件中 parameterType 必须显式写出，不能省略。
43. MyBatis 的 dataSource 配置中，type="POOLED" 表示使用连接池。
44. Spring 中 @Resource 默认按名称注入，@Autowired 默认按类型注入。
45. JSP 的 page 指令中 `session="false"` 表示当前页面不创建 session 对象。

### 2.3 答案与解析

| 题 | 答 | 解析 |
|---|---|---|
| 1 | × | 动态网页指内容由服务器动态生成、可与数据库交互，与有没有动画无关。 |
| 2 | √ | Model 数据业务、View 展示、Controller 调度，目的就是解耦。 |
| 3 | × | JSP 注释翻译阶段就丢弃，不发给浏览器；会出现在源码的是 HTML 注释 `<!-- -->`。 |
| 4 | √ | 转发是服务器内部行为，一次请求，地址栏不变。 |
| 5 | √ | 这正是 JSP 第一次访问慢、之后变快的原因；JSP 本质就是 Servlet。 |
| 6 | × | `<jsp:include>` 是运行期动态包含；编译期静态包含是 `<%@ include %>` 指令。 |
| 7 | × | 转发地址栏不变，只有重定向才变。 |
| 8 | √ | 典型写法 `contentType="text/html; charset=UTF-8"`；POST 取参前还要 setCharacterEncoding。 |
| 9 | × | scope 可取 page、request、session、application 四个值，默认 page。 |
| 10 | × | `<jsp:param>` 只能作为 include 或 forward 的子元素，用于给目标页面传参。 |
| 11 | × | 关浏览器只是会话 Cookie 失效，服务端 session 仍在，要到超时或 invalidate() 才销毁。 |
| 12 | × | 说反了：单实例多线程，成员变量被多线程共享，恰恰有线程安全问题。 |
| 13 | √ | doFilter 在到达目标资源前执行，常用于登录校验、统一编码。 |
| 14 | √ | GET→doGet，POST→doPost，表单 method="post" 走 doPost。 |
| 15 | √ | url-pattern 配 `/*` 时 Servlet、JSP、HTML、图片都经过它。 |
| 16 | √ | service 每请求一次，并按请求方式分发给 doGet/doPost；一次的只有 init 和 destroy。 |
| 17 | √ | destroy 只执行一次，典型用于关连接、停线程、存统计。 |
| 18 | × | 重定向是二次请求，得到新 request，原域数据丢失；要保留用 forward 或放 session。 |
| 19 | √ | web.xml 可写多个 url-pattern 指向同一 servlet-name，注解可写 `@WebServlet({"/a","/b"})`。 |
| 20 | × | 第一步加载驱动 Class.forName，然后建连接、建 Statement，才执行 SQL。 |
| 21 | √ | `select * from user limit 起始下标, 每页条数`，下标从 0 开始。 |
| 22 | × | 说反了：executeQuery 查询返回 ResultSet；executeUpdate 增删改返回 int。 |
| 23 | × | 应逆序关闭：ResultSet → Statement → Connection，后打开的先关。 |
| 24 | × | Spring 是轻量级、非侵入式，普通 POJO 加注解或配置即可。 |
| 25 | √ | XML 或 @Transactional 声明即可，由 AOP 织入事务逻辑。 |
| 26 | √ | 作用域有 singleton（默认）、prototype、request、session。 |
| 27 | × | 构造器注入用 `<constructor-arg>`，`<property>` 是属性注入用的。 |
| 28 | √ | 额外提供国际化、事件发布、资源加载等能力。 |
| 29 | × | 非侵入式，POJO 加注解或配置即可，不必继承或实现框架类。 |
| 30 | √ | 属性注入：无参构造 + setXxx()；构造器注入：有参构造直接传依赖。 |
| 31 | √ | 先调无参构造创建对象，再 set 赋值；写了有参构造就必须补回无参构造。 |
| 32 | √ | Spring 是基础容器，SpringMVC 是它 Web 层的 MVC 实现。 |
| 33 | × | 解析器只把逻辑视图名拼成真实路径，渲染由视图（如 JSP）完成。 |
| 34 | × | 类和方法上都能写；类上相当于加一级路径前缀，如 /user + /login。 |
| 35 | √ | 它就是前端控制器，配 `/` 表示拦截所有请求，还要配 contextConfigLocation。 |
| 36 | √ | 一行记录 ↔ 一个对象，一个字段 ↔ 一个属性；MyBatis 属半自动 ORM。 |
| 37 | × | `<mappers>` 下可写多个 `<mapper>`，也可用 `<package>` 批量扫描。 |
| 38 | × | `#{}` 预编译防注入；`${}` 字符串拼接有注入风险，只在动态表名/列名时用。 |
| 39 | √ | exception 只有错误页可用，这也是 page 指令 isErrorPage 存在的意义。 |
| 40 | √ | 转发是服务器内部行为，能访问 WEB-INF；重定向由浏览器发起，访问不到 WEB-INF。 |
| 41 | √ | 三种写法：ModelAndView、Model/ModelMap + String、直接往 request 放数据。 |
| 42 | × | 可省略，MyBatis 会按传入对象类型自动推断；省略后不同类型要小心。 |
| 43 | √ | POOLED 即连接池；UNPOOLED 不用池，JNDI 用容器提供的数据源。 |
| 44 | √ | @Autowired 按类型（同名冲突时配合 @Qualifier），@Resource 按名称。 |
| 45 | √ | 默认 session="true" 会自动创建 session；设为 false 则页面上不能用 session 对象。 |

---

## 三　填空题（27 题，考试出 5 题）

### 3.1 完整版（原句带答案，通读三遍）

**A　Web 与 JSP**

1. **Web**（万维网）是一种基于超文本和 HTTP 的、全球性的、动态交互的、跨平台的分布式图形信息系统。
2. `<%= 6 > 2 ? (8 > 3 ? "A" : "B") : "C" %>` 的输出结果是 **A**。
3. JSP 中实现"包含"的两种方式：编译期静态包含用指令 **`<%@ include file="" %>`**，运行期动态包含用动作标签 **`<jsp:include page="" />`**。
4. JSP 九大内置对象中，代表整个 Web 应用、服务器关闭才失效的是 **application**（ServletContext）；代表当前页面上下文、可获取其他内置对象的是 **pageContext**（PageContext）。
5. JSP 三种脚本元素中，声明成员变量或方法用 **`<%! %>`**，编写局部代码用 **`<% %>`**，输出表达式用 **`<%= %>`**。
6. `<jsp:useBean>` 的三个属性是 **id**、**class**、**scope**。

**B　Servlet**

7. 开发一个 Servlet 需要三个步骤：继承 **HttpServlet** 类、重写 doGet 和 doPost 方法、通过注解 **@WebServlet** 或 web.xml 配置访问路径。
8. Servlet 的生命周期分为初始化阶段、**服务阶段**（处理请求阶段）和销毁阶段三个阶段。
9. Servlet 处理 GET 请求重写 **doGet** 方法，处理 POST 请求重写 **doPost** 方法；通常后者内部直接调用前者。

**C　JDBC**

10. JDBC 中加载数据库驱动使用 **Class.forName()** 方法，建立连接使用 **DriverManager** 类的 getConnection() 方法。
11. PreparedStatement 接口中，使用 **?** 作为 SQL 语句的参数占位符，通过 **setXxx()** 方法为占位符赋值。
12. 执行查询 SQL 后，存放查询返回数据的对象是 **ResultSet**。

**D　Spring**

13. Spring 中依赖注入的两种常用方式是 **属性（setter）** 注入和 **构造器** 注入；前者在 XML 中使用 property 元素，后者使用 **constructor-arg** 元素。
14. Spring 依赖注入中，注入引用类型使用 **ref** 属性，注入普通值使用 **value** 属性。
15. Spring 中，**@Component** 注解用于将类标识为 Bean，交给 Spring 容器管理。

**E　SpringMVC**

16. Spring MVC 的视图解析器通过配置 **prefix**（前缀）和 **suffix**（后缀）两个属性，把逻辑视图名拼成真实路径。

**F　MyBatis**

17. MyBatis 映射文件中，parameterType 用于指定 **传入参数的类型（入参类型）**，resultType 用于指定 **查询结果封装成的类型（结果类型）**。
18. MyBatis 全局配置中，数据源的四项配置是 driver、url、**username**、**password**。
19. MyBatis 的核心处理类是 **SqlSession**。
20. MyBatis 映射文件中，用于增删改查的四个元素分别是 **insert**、**delete**、**update**、**select**。
21. 在 Spring 配置文件中，使用 **`<bean>`** 标签定义 Bean。

**G　补充题（22-27）**

22. request 对象中获取当前会话对象的方法是 **getSession()**；获取项目根路径（上下文路径）的方法是 **getContextPath()**。
23. JSP 的 page 指令中，导入 Java 包用 **import** 属性；声明当前页为错误处理页用 **isErrorPage** 属性；出错时跳转到指定页面用 **errorPage** 属性。
24. SpringMVC 中，把请求参数绑定到方法形参的注解是 **@RequestParam**；取 URL 路径占位符值的注解是 **@PathVariable**。
25. SpringMVC 的三个核心组件：负责查找处理器的是 **HandlerMapping**，负责调用处理器的是 **HandlerAdapter**，负责解析视图名的是 **ViewResolver**。
26. MyBatis 中构建 SqlSessionFactory 的类是 **SqlSessionFactoryBuilder**，从工厂获取 SqlSession 的方法是 **openSession()**。
27. MyBatis 的 dataSource 中，type 取 **POOLED** 表示使用连接池，取 **UNPOOLED** 表示不使用连接池。

### 3.2 挖空版（遮住 3.1，自己填）

**A　Web 与 JSP**

1. \_\_\_\_\_\_ 是一种基于超文本和 HTTP 的、全球性的、动态交互的、跨平台的分布式图形信息系统。
2. `<%= 6 > 2 ? (8 > 3 ? "A" : "B") : "C" %>` 的输出结果是 \_\_\_\_\_\_。
3. JSP 中实现"包含"的两种方式：编译期静态包含用指令 \_\_\_\_\_\_，运行期动态包含用动作标签 \_\_\_\_\_\_。
4. JSP 九大内置对象中，代表整个 Web 应用、服务器关闭才失效的是 \_\_\_\_\_\_；代表当前页面上下文、可获取其他内置对象的是 \_\_\_\_\_\_。
5. JSP 三种脚本元素中，声明成员变量或方法用 \_\_\_\_\_\_，编写局部代码用 \_\_\_\_\_\_，输出表达式用 \_\_\_\_\_\_。
6. `<jsp:useBean>` 的三个属性是 \_\_\_\_\_\_、\_\_\_\_\_\_、\_\_\_\_\_\_。

**B　Servlet**

7. 开发一个 Servlet 需要三个步骤：继承 \_\_\_\_\_\_ 类、重写 doGet 和 doPost 方法、通过注解 \_\_\_\_\_\_ 或 web.xml 配置访问路径。
8. Servlet 的生命周期分为初始化阶段、\_\_\_\_\_\_ 和销毁阶段三个阶段。
9. Servlet 处理 GET 请求重写 \_\_\_\_\_\_ 方法，处理 POST 请求重写 \_\_\_\_\_\_ 方法。

**C　JDBC**

10. JDBC 中加载数据库驱动使用 \_\_\_\_\_\_ 方法，建立连接使用 \_\_\_\_\_\_ 类的 getConnection() 方法。
11. PreparedStatement 接口中，使用 \_\_\_\_\_\_ 作为 SQL 语句的参数占位符，通过 \_\_\_\_\_\_ 方法为占位符赋值。
12. 执行查询 SQL 后，存放查询返回数据的对象是 \_\_\_\_\_\_。

**D　Spring**

13. Spring 中依赖注入的两种常用方式是 \_\_\_\_\_\_ 注入和 \_\_\_\_\_\_ 注入；前者在 XML 中使用 property 元素，后者使用 \_\_\_\_\_\_ 元素。
14. Spring 依赖注入中，注入引用类型使用 \_\_\_\_\_\_ 属性，注入普通值使用 \_\_\_\_\_\_ 属性。
15. Spring 中，\_\_\_\_\_\_ 注解用于将类标识为 Bean，交给 Spring 容器管理。

**E　SpringMVC**

16. Spring MVC 的视图解析器通过配置 \_\_\_\_\_\_ 和 \_\_\_\_\_\_ 两个属性，把逻辑视图名拼成真实路径。

**F　MyBatis**

17. MyBatis 映射文件中，parameterType 用于指定 \_\_\_\_\_\_，resultType 用于指定 \_\_\_\_\_\_。
18. MyBatis 全局配置中，数据源的四项配置是 driver、url、\_\_\_\_\_\_、\_\_\_\_\_\_。
19. MyBatis 的核心处理类是 \_\_\_\_\_\_。
20. MyBatis 映射文件中，用于增删改查的四个元素分别是 \_\_\_\_\_\_、\_\_\_\_\_\_、\_\_\_\_\_\_、\_\_\_\_\_\_。
21. 在 Spring 配置文件中，使用 \_\_\_\_\_\_ 标签定义 Bean。

**G　补充题（22-27）**

22. request 对象中获取当前会话对象的方法是 \_\_\_\_\_\_；获取项目根路径（上下文路径）的方法是 \_\_\_\_\_\_。
23. JSP 的 page 指令中，导入 Java 包用 \_\_\_\_\_\_ 属性；声明当前页为错误处理页用 \_\_\_\_\_\_ 属性；出错时跳转到指定页面用 \_\_\_\_\_\_ 属性。
24. SpringMVC 中，把请求参数绑定到方法形参的注解是 \_\_\_\_\_\_；取 URL 路径占位符值的注解是 \_\_\_\_\_\_。
25. SpringMVC 的三个核心组件：负责查找处理器的是 \_\_\_\_\_\_，负责调用处理器的是 \_\_\_\_\_\_，负责解析视图名的是 \_\_\_\_\_\_。
26. MyBatis 中构建 SqlSessionFactory 的类是 \_\_\_\_\_\_，从工厂获取 SqlSession 的方法是 \_\_\_\_\_\_。
27. MyBatis 的 dataSource 中，type 取 \_\_\_\_\_\_ 表示使用连接池，取 \_\_\_\_\_\_ 表示不使用连接池。

### 3.3 答案

| 题 | 答案 | 关键提醒 |
|---|---|---|
| 1 | Web（万维网） | 关键词：超文本、HTTP、分布式、跨平台。 |
| 2 | A | 外层 6>2 真取前段，内层 8>3 真取 A；嵌套三元从内向外看。 |
| 3 | `<%@ include file="" %>`；`<jsp:include page="" />` | 前者编译期、一个 Servlet、不能传参；后者运行期、能传参。 |
| 4 | application；pageContext | 名字和类型一起写更稳：ServletContext / PageContext。 |
| 5 | `<%! %>`；`<% %>`；`<%= %>` | 记"声明 / 片段 / 输出"。 |
| 6 | id、class、scope | class 写全限定类名（带包），scope 默认 page。 |
| 7 | HttpServlet；@WebServlet | 注解属性是 urlPatterns；web.xml 靠 servlet-name 关联。 |
| 8 | 服务阶段 | init → service（再分 doGet/doPost）→ destroy。 |
| 9 | doGet；doPost | 参数都是 (HttpServletRequest, HttpServletResponse)，都要 throws。 |
| 10 | Class.forName()；DriverManager | `Class.forName("com.mysql.jdbc.Driver")`；url 形如 jdbc:mysql://localhost:3306/库名。 |
| 11 | `?`；setXxx() | 下标从 1 开始：`pstmt.setString(1, name)`。 |
| 12 | ResultSet | rs.next() 移游标，getString("name") / getInt(1) 取值。 |
| 13 | 属性（setter）；构造器；constructor-arg | 属性注入靠 set 方法，构造器注入靠有参构造。 |
| 14 | ref；value | ref 指向另一个 bean 的 id，value 给普通值。 |
| 15 | @Component | @Controller / @Service / @Repository 都是它的语义细分，还要配 component-scan。 |
| 16 | prefix；suffix | `prefix=/WEB-INF/jsp/`、`suffix=.jsp` → 返回 "loginSuccess" 拼成 /WEB-INF/jsp/loginSuccess.jsp。 |
| 17 | 入参类型；结果类型 | 一进一出，别互换。 |
| 18 | username；password | 四项固定是 driver、url、username、password，少一个连不上。 |
| 19 | SqlSession | 读配置 → SqlSessionFactoryBuilder → SqlSessionFactory → openSession() → SqlSession。 |
| 20 | insert、delete、update、select | 别写 updata、selete。 |
| 21 | `<bean>` | `<bean id="userService" class="com.service.UserServiceImpl"/>`。 |
| 22 | getSession()；getContextPath() | 前者取 HttpSession，后者取形如 /项目名的根路径。 |
| 23 | import；isErrorPage；errorPage | 三个都是 page 指令属性：导包、声明自己是错误页、出错时跳到哪页。 |
| 24 | @RequestParam；@PathVariable | 前者取 ? 后参数（可设 required、defaultValue），后者取路径占位符。 |
| 25 | HandlerMapping；HandlerAdapter；ViewResolver | 一个"找"、一个"调"、一个"解析"，三者别混。 |
| 26 | SqlSessionFactoryBuilder；openSession() | 顺序：读配置 → Builder 建 Factory → openSession() 得 SqlSession。 |
| 27 | POOLED；UNPOOLED | 另有 JNDI，表示用容器提供的数据源。 |

---

## 四　简答题（8 题，抽 4 题，每题 5 分）

### 4.1 完整版（标准答案，先背熟）

**1. 请简述 JSP 的动作标签及其功能。（P42）**

① 包含标签 `<jsp:include>`：用于在当前页面中包含静态或动态资源；
② 转发标签 `<jsp:forward>`：将当前请求转发到可以处理这个请求的文件上；
③ 参数标签 `<jsp:param>`：用于设置和传递参数；
④ 创建 Bean 标签 `<jsp:useBean>`：用于寻找和初始化 JavaBean 组件；
⑤ 设置属性值标签 `<jsp:setProperty>`：用于设置 JavaBean 组件的值；
⑥ 获取属性值标签 `<jsp:getProperty>`：用于获取 JavaBean 组件的值，将值插入 output 中；
⑦ `<jsp:plugin>`：用于在生成的 HTML 页面中包含 Applet 和 JavaBean 对象。

**2. JSP 的内置对象有哪些？并作简要描述。（P53）**

① request：HttpServletRequest 类的实例；
② response：HttpServletResponse 类的实例；
③ out：PrintWriter 类的实例，用于把结果输出至网页上；
④ session：HttpSession 类的实例；
⑤ application：ServletContext 类的实例，与应用上下文有关；
⑥ config：ServletConfig 类的实例；
⑦ pageContext：PageContext 类的实例，提供对 JSP 页面所有对象以及命名空间的访问；
⑧ page：类似于 Java 类中的 this 关键字；
⑨ exception：Exception 类的对象，代表 JSP 页面发生错误时所对应的异常对象。

**3. 请简述 JDBC 访问数据库的五个步骤。（P82-84）**

① 加载 JDBC 驱动程序；
② 建立数据库连接；
③ 执行 SQL 语句；
④ 获取查询结果；
⑤ 关闭连接。

**4. 请说明 Statement 执行 SQL 语句的两个方法。（P81）**

insert、update 和 delete 语句调用 executeUpdate(String sql) 方法；
select 语句调用 executeQuery(String sql) 方法。

**5. 请简述 Spring 框架的特点。（P141）**

① 便于解耦，简化开发；
② 便于集成各类优秀框架；
③ 降低了 Java EE API 的使用难度；
④ 便于程序测试；
⑤ 支持 AOP 编程；
⑥ 支持声明式事务管理。

**6. Spring 中依赖注入的两种常用方式是什么？（P151、156）**

① Bean 的属性注入（setter 注入）；
② Bean 的构造函数注入（构造器注入）。

**7. Spring MVC 的接口 DispatcherServlet 的主要作用是什么？（P185）**

DispatcherServlet 是 Spring MVC 提供的前端控制器，主要作用是接收请求并响应结果，相当于转发器与中央处理器。Spring MVC 的所有请求都经过 DispatcherServlet 统一分发；在分发给 Controller 之前，需要借助 Spring MVC 提供的 HandlerMapping 定位到具体的 Controller。

**8. Spring MVC 常用的注解有哪些？（P189）**

① @Controller；② @RequestMapping；③ @PathVariable；④ @RequestParam；⑤ @RequestBody；⑥ @ModelAttribute；⑦ @SessionAttributes。

### 4.2 挖空版（只留骨架，关键词自己补）

**1. JSP 动作标签**
① 包含标签 \_\_\_\_\_\_：用于在当前页面中包含静态或动态资源；
② 转发标签 \_\_\_\_\_\_：将当前请求转发到可以处理这个请求的文件上；
③ \_\_\_\_\_\_ 标签：用于设置和传递参数；
④ \_\_\_\_\_\_ 标签：用于寻找和初始化 \_\_\_\_\_\_ 组件；
⑤ \_\_\_\_\_\_ 标签：用于给 JavaBean 组件 \_\_\_\_\_\_；
⑥ \_\_\_\_\_\_ 标签：用于 \_\_\_\_\_\_ JavaBean 组件的值，将值插入 \_\_\_\_\_\_ 中；
⑦ \_\_\_\_\_\_：用于在生成的 HTML 页面中包含 Applet 和 JavaBean 对象。

**2. JSP 九大内置对象**
① \_\_\_\_\_\_：HttpServletRequest 类的实例；
② \_\_\_\_\_\_：HttpServletResponse 类的实例；
③ out：\_\_\_\_\_\_ 类的实例，用于把结果输出至网页上；
④ \_\_\_\_\_\_：HttpSession 类的实例；
⑤ application：\_\_\_\_\_\_ 类的实例，与应用上下文有关；
⑥ config：\_\_\_\_\_\_ 类的实例；
⑦ pageContext：\_\_\_\_\_\_ 类的实例，提供对 JSP 页面所有对象以及命名空间的访问；
⑧ \_\_\_\_\_\_：类似于 Java 类中的 this 关键字；
⑨ exception：\_\_\_\_\_\_ 类的对象，代表 JSP 页面发生错误时所对应的异常对象。

**3. JDBC 五步**
① \_\_\_\_\_\_ 驱动程序；② \_\_\_\_\_\_ 数据库连接；③ \_\_\_\_\_\_ SQL 语句；④ 获取 \_\_\_\_\_\_ 结果；⑤ \_\_\_\_\_\_ 连接。

**4. Statement 两个方法**
insert、update 和 delete 语句调用 \_\_\_\_\_\_(String sql) 方法；select 语句调用 \_\_\_\_\_\_(String sql) 方法。

**5. Spring 框架特点（六条）**
① 便于 \_\_\_\_\_\_，简化开发；② 便于 \_\_\_\_\_\_ 各类优秀框架；③ 降低了 \_\_\_\_\_\_ API 的使用难度；④ 便于 \_\_\_\_\_\_；⑤ 支持 \_\_\_\_\_\_ 编程；⑥ 支持 \_\_\_\_\_\_ 事务管理。

**6. 依赖注入两种方式**
① Bean 的 \_\_\_\_\_\_ 注入（\_\_\_\_\_\_ 注入）；② Bean 的 \_\_\_\_\_\_ 注入（\_\_\_\_\_\_ 注入）。

**7. DispatcherServlet 的作用**
DispatcherServlet 是 Spring MVC 提供的 \_\_\_\_\_\_，主要作用是 \_\_\_\_\_\_ 并 \_\_\_\_\_\_，相当于 \_\_\_\_\_\_ 与中央处理器。所有请求都经过它 \_\_\_\_\_\_；在分发给 Controller 之前，需要借助 \_\_\_\_\_\_ 定位到具体的 Controller。

**8. SpringMVC 常用注解（七个）**
① \_\_\_\_\_\_；② \_\_\_\_\_\_；③ \_\_\_\_\_\_；④ \_\_\_\_\_\_；⑤ \_\_\_\_\_\_；⑥ \_\_\_\_\_\_；⑦ \_\_\_\_\_\_。

### 4.3 答案

| 题 | 答案 |
|---|---|
| 1 | ① `<jsp:include>`　② `<jsp:forward>`　③ `<jsp:param>`　④ `<jsp:useBean>`／JavaBean　⑤ `<jsp:setProperty>`／设值　⑥ `<jsp:getProperty>`／获取／output　⑦ `<jsp:plugin>` |
| 2 | ① request　② response　③ PrintWriter　④ session　⑤ ServletContext　⑥ ServletConfig　⑦ PageContext　⑧ page　⑨ Exception |
| 3 | ① 加载 JDBC　② 建立　③ 执行　④ 查询　⑤ 关闭 |
| 4 | executeUpdate；executeQuery |
| 5 | ① 解耦　② 集成　③ Java EE　④ 程序测试　⑤ AOP　⑥ 声明式 |
| 6 | ① 属性（setter）　② 构造函数（构造器） |
| 7 | 前端控制器；接收请求；响应结果；转发器；统一分发；HandlerMapping |
| 8 | @Controller、@RequestMapping、@PathVariable、@RequestParam、@RequestBody、@ModelAttribute、@SessionAttributes |

### 4.4 简答拿分模板

按 **"名称 + 原理/作用 + 关键元素名 + 要求/对比"** 四段写，每条后面补半句解释：

- 第 3、5 题是"列举型"，**条数就是分数**（JDBC 五条、Spring 六条），顺序照抄，别自己扩成七八条。
- 第 1、2 题是"名称+功能型"，**先写对名字再补一句作用**；九大内置对象连类型一起写更稳（out 写 PrintWriter 是教材口径，别写 JspWriter）。
- 第 4、6 题最容易只写一半：第 4 题必须补"executeUpdate 返回 int 影响行数 / executeQuery 返回 ResultSet"，第 6 题必须补"`<property>` 靠 set 方法、要求无参构造 / `<constructor-arg>` 靠有参构造"。
- 第 7 题四个关键词：前端控制器、接收请求并响应、统一分发、HandlerMapping 定位 Controller。
- 第 8 题是 **@RequestBody**（读请求体），不是 @ResponseBody（写响应体），方向相反最容易写错。

---

## 五　应用题（4 题 30 分，代码填空）

> 每题结构：**一、原代码（完整，先通读）→ 二、填空版（空号 `___(编号)___` 挖在代码里）→ 三、答案**。五套代码共 85 个空，另有 Filter、SqlSession 延伸 8 空。

### 5.1 应用题 1：用户注册程序 V1.0（JSP 动作标签）

**一、原代码（完整）**

*（1）User.java*

```java
// 包声明：类所在的包名；useBean 的 class 属性要写成"包名.类名"
package com.test;

// 实体类（JavaBean）：必须是 public，容器才能用反射创建它
public class User {

    // 属性 1：姓名，String 类型；private 封装，外部只能经 get/set 访问
    private String name;

    // 属性 2：密码，String 类型
    private String password;

    // 属性 3：年龄，基本类型 int（不是 Integer）
    private int age;

    // get 方法：返回类型与属性一致；方法名 = get + 首字母大写的属性名
    public String getName() { return name; }

    // set 方法：固定返回 void；this.name 用来区分"属性"和"同名参数"
    public void setName(String name) { this.name = name; }

    // 密码的 get，方法名必须叫 getPassword，与属性 password 对应
    public String getPassword() { return password; }

    // 密码的 set
    public void setPassword(String password) { this.password = password; }

    // int 属性的 get 返回 int
    public int getAge() { return age; }

    // 年龄的 set
    public void setAge(int age) { this.age = age; }
}
```

*（2）register.html*

```html
<!-- 表单开始：method 指定请求方式（表单默认就是 POST）；action 指定提交给哪个页面 -->
<form method="post" action="register.jsp">
    <table>
        <!-- 姓名框：type="text" 普通文本框；name 必须与 User 的属性名 name 完全一致 -->
        <tr><td>姓名:<input type="text" name="name" /></td></tr>

        <!-- 密码框：type="password" 输入内容显示为圆点，传过去的仍是明文 -->
        <tr><td>密码:<input type="password" name="password" /></td></tr>

        <!-- 年龄框：age 是 int，但表单传的都是字符串，由 setProperty 自动转成 int -->
        <tr><td>年龄:<input type="text" name="age" /></td></tr>

        <!-- 提交按钮：只有 type="submit" 才会提交表单；value 是按钮上的文字 -->
        <tr><td><input type="submit" value="注册" /></td></tr>
    </table>
</form>
<!-- 三个 name 与 User 的三个属性同名，这是后面 property="*" 能自动赋值的前提 -->
```

*（3）register.jsp*

```jsp
<%-- 第 1 行：page 指令。language 固定 java；contentType 定响应类型与编码，防中文乱码 --%>
<%@ page language="java" contentType="text/html; charset=UTF-8" %>

<%-- 第 2 行：创建/查找 JavaBean。id 变量名、class 全限定名、scope 作用域 --%>
<jsp:useBean id="user" class="com.test.User" scope="request" />

<%-- 第 3 行：一次性赋值。property="*" 表示把请求里所有同名参数全部设进 bean --%>
<jsp:setProperty name="user" property="*" />

<html>
<body>
    <h3>用户注册成功</h3>

    <%-- 第 4 行起：取值输出。name 填 useBean 的 id（user），property 填属性名 --%>
    姓名：<jsp:getProperty name="user" property="name" /><br>
    密码：<jsp:getProperty name="user" property="password" /><br>
    年龄：<jsp:getProperty name="user" property="age" />
</body>
</html>
<%-- 注意：getProperty 只有 name 和 property 两个属性，没有 value，也没有结束标签 --%>
```

**二、填空版**

*（1）User.java*

```java
package com.test;

public ___(1-1)___ User {
    ___(1-2)___ String name;
    private String password;
    private ___(1-3)___ age;

    public ___(1-4)___ getName() { return name; }
    public ___(1-5)___ setName(String name) { this.name = name; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public ___(1-6)___ getAge() { return age; }
    public void setAge(int age) { this.age = age; }
}
```

*（2）register.html*

```html
<form ___(1-7)___="post" ___(1-8)___="register.jsp">
    <table>
        <tr><td>姓名:<input type="text" ___(1-9)___="name" /></td></tr>
        <tr><td>密码:<input ___(1-10)___="password" name="password" /></td></tr>
        <tr><td>年龄:<input type="text" name="age" /></td></tr>
        <tr><td><input ___(1-11)___="submit" value="注册" /></td></tr>
    </table>
</form>
```

*（3）register.jsp*

```jsp
<%@ ___(1-12)___ language="java" ___(1-13)___="text/html; charset=UTF-8" %>
<___(1-14)___ ___(1-15)___="user" ___(1-16)___="com.test.User" ___(1-17)___="request" />
<___(1-18)___ name="user" ___(1-19)___="*" />
<html>
<body>
    <h3>用户注册成功</h3>
    姓名：<___(1-20)___ name="user" property="name" /><br>
    密码：<jsp:getProperty name="user" property="password" /><br>
    年龄：<jsp:getProperty name="user" property="age" />
</body>
</html>
```

**三、答案**

| 空号 | 答案 | 空号 | 答案 |
|---|---|---|---|
| 1-1 | `class` | 1-11 | `type` |
| 1-2 | `private` | 1-12 | `page` |
| 1-3 | `int` | 1-13 | `contentType` |
| 1-4 | `String` | 1-14 | `jsp:useBean` |
| 1-5 | `void` | 1-15 | `id` |
| 1-6 | `int` | 1-16 | `class` |
| 1-7 | `method` | 1-17 | `scope` |
| 1-8 | `action` | 1-18 | `jsp:setProperty` |
| 1-9 | `name` | 1-19 | `property` |
| 1-10 | `type` | 1-20 | `jsp:getProperty` |

易错点：`id` 是自己起的变量名（user），`class` 是全限定类名（带包 com.test），两个别填反；表单 `name` 必须与实体属性同名，`property="*"` 才能自动匹配。

---

### 5.2 应用题 2：用户登录程序 V1.0（JSP 内置对象）

**一、原代码（完整）**

*（1）index.jsp*

```jsp
<%-- page 指令：language 定脚本语言，contentType 定响应类型与编码 --%>
<%@ page language="java" contentType="text/html; charset=UTF-8" %>
<html>
<body>
    <%-- 表单：method 提交方式、action 交给谁处理 --%>
    <form name="form1" method="post" action="deal.jsp">

        <%-- 文本框：name="user" 就是后端 getParameter("user") 要的键名 --%>
        用户名：<input name="user" type="text" /><br>

        <%-- 密码框：注意这里的键名是 pwd，不是 password --%>
        密　码：<input name="pwd" type="password" /><br>

        <%-- 提交按钮：把表单数据发给 action 指定的页面 --%>
        <input type="submit" value="提交" />

        <%-- 重置按钮：清空表单，不提交 --%>
        <input type="reset" value="重置" />
    </form>
</body>
</html>
```

*（2）deal.jsp*

```jsp
<%@ page language="java" contentType="text/html; charset=UTF-8" %>
<html>
<body>
<%-- <% %> 是脚本片段，里面的 Java 代码会放进 service 方法里执行 --%>
<%
    // ① 设请求编码为 utf-8，解决 POST 中文乱码；必须写在取参数之前
    request.setCharacterEncoding("utf-8");

    // ② 取表单参数，返回 String；键名对应 input 的 name="user"
    String user = request.getParameter("user");

    // ③ 同理取密码，键名是 pwd
    String pwd  = request.getParameter("pwd");

    // ④ 判断：字符串比较用 equals，不能用 ==；&& 表示两个条件都要成立
    if (user.equals("admin") && pwd.equals("123")) {

        // ⑤ 成功：重定向到 success.jsp，浏览器会重新发请求，地址栏会变
        response.sendRedirect("success.jsp");

    } else {

        // ⑥ 失败：输出 500 状态码 + 提示文字，注意是两个参数
        response.sendError(500, "请输入正确的用户名和密码！");
    }
%>
</body>
</html>
```

**二、填空版**

*（1）index.jsp*

```jsp
<%@ page language="java" contentType="text/html; charset=UTF-8" %>
<html>
<body>
    <form name="form1" ___(2-1)___="post" ___(2-2)___="deal.jsp">
        用户名：<input ___(2-3)___="user" type="text" /><br>
        密　码：<input name="pwd" ___(2-4)___="password" /><br>
        <input type="submit" value="提交" />
        <input ___(2-5)___="reset" value="重置" />
    </form>
</body>
</html>
```

*（2）deal.jsp*

```jsp
<%@ page language="java" contentType="text/html; charset=UTF-8" %>
<html>
<body>
<%
    request.___(2-6)___("utf-8");
    ___(2-8)___ user = request.___(2-7)___("user");
    String pwd = request.getParameter("pwd");

    if (user.___(2-9)___("admin") && pwd.equals("123")) {
        response.___(2-10)___("success.jsp");
    } else {
        response.___(2-11)___(500, "请输入正确的用户名和密码！");
    }
%>
</body>
</html>
```

**三、答案**

| 空号 | 答案 | 空号 | 答案 |
|---|---|---|---|
| 2-1 | `method` | 2-7 | `getParameter` |
| 2-2 | `action` | 2-8 | `String` |
| 2-3 | `name` | 2-9 | `equals` |
| 2-4 | `type` | 2-10 | `sendRedirect` |
| 2-5 | `type` | 2-11 | `sendError` |
| 2-6 | `setCharacterEncoding` | — | — |

易错点：`getParameter` 返回 String，没有该参数时是 null，先判 null 再 equals；`setCharacterEncoding` 必须写在所有取参数之前；`sendError` 是两个参数，`sendRedirect` 是一个。

---

### 5.3 应用题 3：网站计数器（Servlet）

**一、原代码（完整）**

*（1）PageHitCounter.java*

```java
// 包声明：这个 Servlet 放在 com.servlet 包下
package com.servlet;

// 异常类：方法签名里 throws 要用到
import java.io.IOException;

// 输出流类：往浏览器写内容用
import java.io.PrintWriter;

// Servlet 异常类，方法签名里要声明
import javax.servlet.ServletException;

// 注解类：用它配置访问路径，替代 web.xml
import javax.servlet.annotation.WebServlet;

// 父类：继承它才能直接重写 doGet / doPost
import javax.servlet.http.HttpServlet;

// 请求对象类型：doGet 的第一个参数
import javax.servlet.http.HttpServletRequest;

// 响应对象类型：doGet 的第二个参数
import javax.servlet.http.HttpServletResponse;

// 注解配置访问路径，必须以 / 开头；等价于 web.xml 里的 <url-pattern>
@WebServlet("/PageHitCounter")

// 继承 HttpServlet（不是 implements）；Servlet 是单实例、多线程的
public class PageHitCounter extends HttpServlet {

    // 成员变量，不是局部变量：所有请求共享它，计数才能一直累加
    private int hitCount;

    // 初始化方法：实例创建后调用一次，适合放初始值
    public void init() {
        // 计数器清零，写在这里只执行一次
        hitCount = 0;
    }

    // 处理 GET 请求；两个异常必须声明，少一个都编译不过
    public void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // 告诉浏览器返回的是 UTF-8 的 HTML，防中文乱码
        response.setContentType("text/html;charset=utf-8");

        // 取得输出流，用它往页面写内容
        PrintWriter out = response.getWriter();

        // 每访问一次加 1；因为是成员变量，所以是累加而不是每次从 1 开始
        hitCount++;

        // 把数字拼进 HTML 里输出
        out.print("<h1>网站访问次数：" + hitCount + "</h1>");
    }

    // 处理 POST 请求
    public void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // 表单是 POST 时也走同一套逻辑，直接转调 doGet
        doGet(request, response);
    }

    // 销毁方法：服务器关闭或应用卸载时调用一次
    public void destroy() {
        // 在这里释放资源（真实项目是关连接、停线程、存统计）
        System.out.println("Servlet销毁，释放资源");
    }
}
```

*（2）web.xml*

```xml
<!-- 第一块：声明"有一个 Servlet" -->
<servlet>
    <!-- 内部名字；与下面 mapping 里的必须一字不差 -->
    <servlet-name>PageHitCounter</servlet-name>
    <!-- 全限定类名：包名 + 类名 -->
    <servlet-class>com.servlet.PageHitCounter</servlet-class>
</servlet>

<!-- 第二块：建立"访问路径 → Servlet"的映射 -->
<servlet-mapping>
    <!-- 靠这个名字关联到上面那个 servlet -->
    <servlet-name>PageHitCounter</servlet-name>
    <!-- 浏览器访问的路径，必须 / 开头，精确匹配 -->
    <url-pattern>/PageHitCounter</url-pattern>
</servlet-mapping>
<!-- 可选：加 <load-on-startup>1</load-on-startup> 让启动就创建实例 -->
```

*（3）Filter（延伸）*

```java
// 注解配置拦截路径：/* 表示所有请求（Servlet、JSP、HTML、图片都过）
@WebFilter("/*")

// 实现 Filter 接口，注意是 implements，不是 extends
public class LoginFilter implements Filter {

    // 核心方法：每次请求经过过滤器时都会执行
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {

        // 这里做登录校验，不通过就跳转或直接 return，不再往下走
        // ...

        // 放行：把请求交给下一个过滤器或目标资源；不写这行请求就到不了 Servlet
        chain.doFilter(request, response);
    }
}
```

**二、填空版**

*（1）PageHitCounter.java*

```java
package com.servlet;

import java.io.IOException;
import java.io.PrintWriter;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

___(3-1)___("/PageHitCounter")
public class PageHitCounter ___(3-2)___ ___(3-3)___ {

    private ___(3-4)___ hitCount;

    public ___(3-5)___ init() {
        ___(3-6)___ = 0;
    }

    public void doGet(___(3-7)___ request, ___(3-8)___ response)
            throws ServletException, ___(3-9)___ {
        response.___(3-10)___("text/html;charset=utf-8");
        ___(3-11)___ out = response.___(3-12)___();
        ___(3-13)___++;
        out.___(3-14)___("<h1>网站访问次数：" + hitCount + "</h1>");
    }

    public void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        ___(3-15)___(request, response);
    }

    public void ___(3-16)___() {
        System.out.println("Servlet销毁，释放资源");
    }
}
```

*（2）web.xml*

```xml
<servlet>
    <servlet-name>PageHitCounter</servlet-name>
    <___(3-17)___>com.servlet.PageHitCounter</___(3-17)___>
</servlet>
<servlet-mapping>
    <servlet-name>PageHitCounter</servlet-name>
    <___(3-18)___>/PageHitCounter</___(3-18)___>
</servlet-mapping>
```

*（3）Filter（延伸）*

```java
@___(3-19)___("/*")
public class LoginFilter ___(3-20)___ Filter {

    public void ___(3-21)___(ServletRequest request, ServletResponse response,
                              FilterChain chain) throws IOException, ServletException {
        // 判断登录……
        chain.___(3-22)___(request, response);
    }
}
```

**三、答案**

| 空号 | 答案 | 空号 | 答案 |
|---|---|---|---|
| 3-1 | `@WebServlet` | 3-12 | `getWriter` |
| 3-2 | `extends` | 3-13 | `hitCount` |
| 3-3 | `HttpServlet` | 3-14 | `print` |
| 3-4 | `int` | 3-15 | `doGet` |
| 3-5 | `void` | 3-16 | `destroy` |
| 3-6 | `hitCount` | 3-17 | `servlet-class` |
| 3-7 | `HttpServletRequest` | 3-18 | `url-pattern` |
| 3-8 | `HttpServletResponse` | 3-19 | `@WebFilter` |
| 3-9 | `IOException` | 3-20 | `implements` |
| 3-10 | `setContentType` | 3-21 | `doFilter` |
| 3-11 | `PrintWriter` | 3-22 | `doFilter` |

易错点：`hitCount` 必须是成员变量，写成 doGet 里的局部变量每次请求都归零；`destroy()` 别拼成 `destory()`；Servlet 单实例多线程，成员变量被所有请求共用。

---

### 5.4 应用题 4：SpringMVC 参数传递

**一、原代码（完整）**

*（1）LoginController.java（客户端 → 服务端，实体接收）*

```java
// 类上注解：标识这是控制器，交给 Spring 容器管理（本质是 @Component）
@Controller

// 控制器类，不需要继承或实现任何框架接口
public class LoginController {

    // 方法上注解：把 /login 这个请求映射到本方法，所以表单的 action 写 login
    @RequestMapping("/login")

    // 形参写成实体类 User，SpringMVC 会按同名规则自动把表单参数 set 进去
    public String login(User u) {

        // 打印验证：能取到值说明封装成功（get 后缀与属性名一致）
        System.out.println("loginName:" + u.getLoginName());

        // 同理取密码
        System.out.println("password:" + u.getPassword());

        // 返回逻辑视图名，由视图解析器拼成 /WEB-INF/jsp/loginSuccess.jsp
        return "loginSuccess";
    }
}
```

*（2）login.jsp*

```jsp
<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<body>
    <h3>用户登录</h3>

    <%-- action="login" 对应控制器上的 @RequestMapping("/login")；method 指定提交方式 --%>
    <form action="login" method="post">

        <%-- 帐号框：name 与 User 的属性 loginName 同名，才能自动封装 --%>
        帐号:<input type="text" name="loginName"><br>

        <%-- 密码框：name 与属性 password 同名；用 text 也能传值，只是不明文遮住 --%>
        密码:<input type="text" name="password"><br>

        <%-- 提交按钮 --%>
        <input type="submit" value="登录">
    </form>
</body>
</html>
```

*（3）HelloController.java（服务端 → 客户端，ModelAndView）*

```java
// 实现 Controller 接口：SpringMVC 早期写法，一个类只处理一个请求
public class HelloController implements Controller {

    // 接口规定的方法名与参数，必须原样重写；返回值是 ModelAndView
    public ModelAndView handleRequest(HttpServletRequest request,
                                      HttpServletResponse response) {

        // 创建"模型 + 视图"的载体
        ModelAndView mv = new ModelAndView();

        // 存数据：key 是 msg，页面上就用 ${msg} 取
        mv.addObject("msg", "hello world!");

        // 设视图：这里写全路径，说明没有走视图解析器的前后缀
        mv.setViewName("/WEB-INF/jsp/hello.jsp");

        // 返回给 DispatcherServlet，由它解析视图并渲染
        return mv;
    }
}
```

*（4）hello.jsp*

```jsp
<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<body>
    <%-- EL 表达式：按 page→request→session→application 顺序找 msg 并输出 --%>
    ${msg}
</body>
</html>
```

*（5）web.xml（前端控制器）*

```xml
<servlet>
    <!-- 前端控制器的内部名字，下面 mapping 要用同名 -->
    <servlet-name>springmvc</servlet-name>

    <!-- SpringMVC 的核心类，全限定名要背准 -->
    <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>

    <!-- 初始化参数：告诉它 SpringMVC 的配置文件在哪 -->
    <init-param>
        <!-- 参数名固定写 contextConfigLocation，不能改 -->
        <param-name>contextConfigLocation</param-name>
        <!-- classpath: 表示从类路径（src 下）找 -->
        <param-value>classpath:springmvc.xml</param-value>
    </init-param>
</servlet>

<servlet-mapping>
    <!-- 与上面一致，才能关联起来 -->
    <servlet-name>springmvc</servlet-name>
    <!-- 单个 / 表示拦截所有请求（注意不是 /*） -->
    <url-pattern>/</url-pattern>
</servlet-mapping>
```

*（6）springmvc.xml（扫描 + 视图解析器）*

```xml
<!-- 1. 开启注解扫描：Spring 只扫描这个包及其子包下带 @Controller 等注解的类 -->
<context:component-scan base-package="com.controller" />

<!-- 2. 配置视图解析器：把"逻辑视图名"拼成"真实路径" -->
<bean class="org.springframework.web.servlet.view.InternalResourceViewResolver">
    <!-- 前缀：返回 "loginSuccess" 时先拼上它 -->
    <property name="prefix" value="/WEB-INF/jsp/" />
    <!-- 后缀：再拼上它，最终得到 /WEB-INF/jsp/loginSuccess.jsp -->
    <property name="suffix" value=".jsp" />
</bean>
<!-- 配了前后缀后控制器只写视图名；若控制器自己写全路径，就别再配这两个属性 -->
```

**二、填空版**

*（1）LoginController.java*

```java
___(4-1)___
public class LoginController {

    ___(4-2)___("/login")
    public String login(___(4-3)___ u) {
        System.out.println("loginName:" + u.getLoginName());
        System.out.println("password:" + u.getPassword());
        return "___(4-4)___";
    }
}
```

*（2）login.jsp*

```jsp
<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<body>
    <h3>用户登录</h3>
    <form action="___(4-5)___" method="post">
        帐号:<input type="text" name="___(4-6)___"><br>
        密码:<input type="text" name="___(4-7)___"><br>
        <input type="submit" value="登录">
    </form>
</body>
</html>
```

*（3）HelloController.java*

```java
public class HelloController ___(4-8)___ Controller {

    public ___(4-9)___ handleRequest(HttpServletRequest request,
                                     HttpServletResponse response) {
        ___(4-10)___ mv = new ModelAndView();
        mv.___(4-11)___("msg", "hello world!");
        mv.___(4-12)___("/WEB-INF/jsp/hello.jsp");
        return mv;
    }
}
```

*（4）hello.jsp*

```jsp
<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<html>
<body>
    ___(4-13)___
</body>
</html>
```

*（5）web.xml*

```xml
<servlet>
    <servlet-name>springmvc</servlet-name>
    <servlet-class>___(4-14)___</servlet-class>
    <init-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>classpath:springmvc.xml</param-value>
    </init-param>
</servlet>
<servlet-mapping>
    <servlet-name>springmvc</servlet-name>
    <url-pattern>___(4-15)___</url-pattern>
</servlet-mapping>
```

*（6）springmvc.xml*

```xml
<context:component-scan ___(4-16)___="com.controller" />

<bean class="org.springframework.web.servlet.view.InternalResourceViewResolver">
    <property name="prefix" value="___(4-17)___" />
    <property name="suffix" value="___(4-18)___" />
</bean>
```

**三、答案**

| 空号 | 答案 | 空号 | 答案 |
|---|---|---|---|
| 4-1 | `@Controller` | 4-10 | `ModelAndView` |
| 4-2 | `@RequestMapping` | 4-11 | `addObject` |
| 4-3 | `User` | 4-12 | `setViewName` |
| 4-4 | `loginSuccess` | 4-13 | `${msg}` |
| 4-5 | `login` | 4-14 | `org.springframework.web.servlet.DispatcherServlet` |
| 4-6 | `loginName` | 4-15 | `/` |
| 4-7 | `password` | 4-16 | `base-package` |
| 4-8 | `implements` | 4-17 | `/WEB-INF/jsp/` |
| 4-9 | `ModelAndView` | 4-18 | `.jsp` |

易错点：表单 name 与实体属性必须同名，SpringMVC 才会自动 set；配了视图解析器后返回 `"loginSuccess"` 会拼成 `/WEB-INF/jsp/loginSuccess.jsp`，写全路径的就别再配前后缀；`addObject` 存数据、`setViewName` 设视图，别写反；DispatcherServlet 的 url-pattern 是单个 `/`，不是 `/*`。

---

### 5.5 应用题 5：MyBatis 配置与映射

**一、原代码（完整）**

*（1）mybatis-config.xml*

```xml
<!-- 根元素，整个文件只有这一个 -->
<configuration>

    <!-- 环境集合；default 指定默认用哪个环境，值是某个 environment 的 id -->
    <environments default="mysql">

        <!-- 一个环境：id 是它的名字，与上面的 default 对应 -->
        <environment id="mysql">

            <!-- 事务管理器：JDBC 表示用 JDBC 的 Connection 提交 / 回滚 -->
            <transactionManager type="JDBC" />

            <!-- 数据源：POOLED = 使用连接池（另有 UNPOOLED、JNDI） -->
            <dataSource type="POOLED">

                <!-- 驱动类名；MySQL 8.x 是 com.mysql.cj.jdbc.Driver -->
                <property name="driver"   value="com.mysql.jdbc.Driver" />

                <!-- 连接串：协议://主机:端口/库名 -->
                <property name="url"      value="jdbc:mysql://localhost:3306/mybatis" />

                <!-- 数据库用户名 -->
                <property name="username" value="root" />

                <!-- 数据库密码；四项缺一项都连不上 -->
                <property name="password" value="root" />
            </dataSource>
        </environment>
    </environments>

    <!-- 注册映射文件的位置，写在最后 -->
    <mappers>
        <!-- 按类路径写相对路径，用 / 分隔；漏注册会报 Invalid bound statement -->
        <mapper resource="com/mapper/UserMapper.xml" />
    </mappers>
</configuration>
<!-- 顺序不能调换：properties → settings → typeAliases → environments → mappers -->
```

*（2）UserMapper.xml*

```xml
<!-- 命名空间：通常等于 Mapper 接口的全限定名，全局唯一 -->
<mapper namespace="com.mapper.UserMapper">

    <!-- 查：select。resultType 指定"一行记录封装成什么对象" -->
    <select id="selectAllUsers" resultType="com.pojo.User">
        <!-- SQL 语句；查出的多行由 MyBatis 自动装成 List<User> -->
        select id, name, sex, age from user
    </select>

    <!-- 删：delete。只有一个 #{id} 参数，parameterType 可以省略 -->
    <delete id="deleteUserById">
        <!-- #{} 生成预编译占位符 ?，能防 SQL 注入 -->
        delete from user where id = #{id}
    </delete>

    <!-- 增：insert。parameterType 指定入参类型，这里是一个 User 对象 -->
    <insert id="addUser" parameterType="com.pojo.User">
        <!-- 三个列对应三个属性，一一对应 -->
        insert into user(name, sex, age) values(#{name}, #{sex}, #{age})
    </insert>

    <!-- 改：update。id 是这条 SQL 的唯一标识，与接口方法名一致 -->
    <update id="updateUserById" parameterType="com.pojo.User">
        update user set name = #{name}, sex = #{sex}, age = #{age} where id = #{id}
    </update>

</mapper>
<!-- 四个标签就是增删改查的英文单词：insert / delete / update / select -->
```

**二、填空版**

*（1）mybatis-config.xml*

```xml
<configuration>
    <___(5-1)___ default="mysql">
        <environment ___(5-2)___="mysql">
            <___(5-3)___ type="JDBC" />
            <dataSource ___(5-4)___="POOLED">
                <property name="___(5-5)___"   value="com.mysql.jdbc.Driver" />
                <property name="___(5-6)___"   value="jdbc:mysql://localhost:3306/mybatis" />
                <property name="___(5-7)___"   value="root" />
                <property name="___(5-8)___"   value="root" />
            </dataSource>
        </environment>
    </___(5-1)___>

    <___(5-9)___>
        <mapper ___(5-10)___="com/mapper/UserMapper.xml" />
    </___(5-9)___>
</configuration>
```

*（2）UserMapper.xml*

```xml
<mapper ___(5-11)___="com.mapper.UserMapper">

    <___(5-12)___ id="selectAllUsers" ___(5-13)___="com.pojo.User">
        select id, name, sex, age from user
    </___(5-12)___>

    <___(5-14)___ id="deleteUserById">
        delete from user where id = ___(5-18)___
    </___(5-14)___>

    <___(5-15)___ id="addUser" ___(5-16)___="com.pojo.User">
        insert into user(name, sex, age) values(#{name}, #{sex}, #{age})
    </___(5-15)___>

    <___(5-17)___ id="updateUserById" parameterType="com.pojo.User">
        update user set name = #{name}, sex = #{sex}, age = #{age} where id = #{id}
    </___(5-17)___>

</mapper>
```

**三、答案**

| 空号 | 答案 | 空号 | 答案 |
|---|---|---|---|
| 5-1 | `environments` | 5-10 | `resource` |
| 5-2 | `id` | 5-11 | `namespace` |
| 5-3 | `transactionManager` | 5-12 | `select` |
| 5-4 | `type` | 5-13 | `resultType` |
| 5-5 | `driver` | 5-14 | `delete` |
| 5-6 | `url` | 5-15 | `insert` |
| 5-7 | `username` | 5-16 | `parameterType` |
| 5-8 | `password` | 5-17 | `update` |
| 5-9 | `mappers` | 5-18 | `#{id}` |

**延伸：SqlSession**

| 空号 | 挖空处 | 答案 |
|---|---|---|
| 5-19 | MyBatis 的核心处理类（一次会话） | `SqlSession` |
| 5-20 | 通过工厂打开会话 `factory.___()` | `openSession` |
| 5-21 | 查一条记录 / 查多条记录 | `selectOne` / `selectList` |
| 5-22 | 增、删、改调用的方法（与映射标签同名） | `insert` / `update` / `delete` |

易错点：四标签拼写 `select`/`insert`/`update`/`delete`，别写 updata、selete；`resultType` 是结果类型、`parameterType` 是入参类型，别互换；用 `#{}` 不用 `${}`；配置元素顺序不能调换：properties → settings → typeAliases → environments → mappers。

---

## 六　考前 30 分钟速记

| 记什么 | 内容 |
|---|---|
| 作用域 | page < request < session < application；关浏览器 ≠ session 销毁。 |
| 转发 vs 重定向 | forward 一次请求、地址栏不变、能带 request；sendRedirect 二次请求、地址栏变、数据丢。 |
| 包含 | `<%@ include %>` 编译期静态；`<jsp:include>` 运行期动态。 |
| 生命周期 | 构造 1 次、init 1 次、service 每次、destroy 1 次；单实例多线程。 |
| JDBC 五步 | 加载驱动 → 建连接 → 执行 SQL → 取结果 → 逆序关闭。 |
| 两个 execute | executeUpdate→int；executeQuery→ResultSet。 |
| Spring | IoC（DI 是实现）+ AOP；`<property>` 靠 set、`<constructor-arg>` 靠有参构造；ref / value。 |
| SpringMVC | DispatcherServlet 接收分发、HandlerMapping 找、ViewResolver 解析（prefix + 名 + suffix）。 |
| MyBatis | 四标签 select/insert/update/delete；`#{}` 防注入；元素顺序不可调换。 |
| 应用题 | 两条通路：表单交给对象（useBean+setProperty / 实体形参 / parameterType）、对象交给页面（getProperty / ModelAndView+EL / resultType）。 |
