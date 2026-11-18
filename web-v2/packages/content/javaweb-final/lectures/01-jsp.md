---
moduleId: javaweb:kb:jsp
topicId: javaweb:topic:jsp
title: JSP
summary: JSP 不是"另一种语言"，它是 Servlet 的另一种写法——把九个内置对象、三个指令、七个动作一次说透。
minutes: 30
examFocus: 填空与选择的绝对高频区：四大作用域顺序、九大内置对象、三个指令、七个动作标签、静态包含与动态包含的区别。
goals:
  - 能说清 JSP 从 .jsp 到 .class 的翻译过程，以及为什么第一次访问比后面慢
  - 能默写九大内置对象与四大作用域，并说出查找顺序
  - 能区分 page/include/taglib 三个指令的属性与用途
  - 能写出 useBean + setProperty 的三种赋值写法，并说出 property="*" 的前提
  - 能用 EL 从一个作用域里取值，并解释找不到时为什么不报错
pitfalls:
  - getProperty 只有 name 和 property 两个属性，没有 value，也没有结束标签
  - property="*" 要求表单 name 与 Bean 属性名完全一致，否则那个属性拿不到值
  - exception 对象只在 isErrorPage="true" 的页面里能用
  - <%@ include %> 是编译期合并成一个文件；<jsp:include> 是运行期分别执行再拼结果
  - <%! %> 里声明的是成员变量（所有请求共享），不是局部变量，常被误用成计数器
videos:
  - 尚硅谷 JavaWeb 全套教程 · JSP 部分 | https://www.bilibili.com/video/BV1Y7411K7zz | 内置对象与 EL 表达式讲得最细，跳着看对应集即可
resources:
  - Jakarta Server Pages 规范 | https://jakarta.ee/specifications/pages/ | 想知道"九大内置对象是规范规定的吗"就查这里
---

## 这一节解决什么问题

用 Servlet 写页面长这样：

```java
out.println("<html><body>");
out.println("<h1>" + user.getName() + "</h1>");
out.println("</body></html>");
```

HTML 是字符串，改一次页面要重新编译 Java。JSP 反过来：**你写 HTML，需要动态的地方插一段 Java**。所以 JSP 的定位是"以页面为主、代码为辅"的模板技术。

考试考得很细，但真正难的不是背，而是理解一件事：**JSP 最终会被翻译成一个 Servlet**。理解了这句，九大内置对象为什么不用 `new`、`out` 从哪来、`page` 是什么，全部有了答案。

## 一分钟速览

| 主题 | 必须记住的内容 |
| --- | --- |
| 本质 | JSP = 翻译后的 Servlet，最终跑的还是 `_jspService` |
| 脚本元素 | `<%! %>` 声明、`<% %>` 脚本片段、`<%= %>` 表达式 |
| 注释 | `<%-- --%>` 不发给浏览器；`<!-- -->` 会发给浏览器 |
| 内置对象 | 9 个：request、response、session、application、out、pageContext、config、page、exception |
| 作用域 | 4 个，由小到大：page → request → session → application |
| 指令 | 3 个：page、include、taglib |
| 动作 | 7 个：include、forward、useBean、setProperty、getProperty、param、plugin |
| EL | `${}`，找不到属性输出空串，不抛异常 |

## JSP 是怎么跑起来的

第一次访问 `list.jsp` 时，Tomcat 要做四件事：

1. **翻译**：把 `list.jsp` 转成一个 Java 类 `list_jsp.java`，类里只有一个方法 `_jspService(HttpServletRequest, HttpServletResponse)`。
2. **编译**：用 JDK 把 `.java` 编译成 `list_jsp.class`。
3. **加载实例化**：由容器 `new` 出实例，调用 `jspInit()`。
4. **服务**：每次请求调用 `_jspService()`，请求结束不销毁。

之后再来请求，前两步不再执行，直接用现成的实例——**这就是"第一次访问慢"的原因**。改了 JSP 文件后容器会重新翻译编译，所以开发时改完刷新就能看到效果。

对照 Servlet 的生命周期，你会发现完全一样：`init` → `service` → `destroy`，只是 JSP 把 `service` 换成了 `_jspService`，并且 `init`/`destroy` 叫 `jspInit`/`jspDestroy`。

### 三种脚本元素

| 写法 | 名称 | 翻译后落在哪 | 典型用途 |
| --- | --- | --- | --- |
| `<%! int count = 0; %>` | 声明 | 类的**成员变量/方法** | 定义成员变量或辅助方法（很少用） |
| `<% int i = 0; %>` | 脚本片段 | `_jspService` **方法体内**的局部变量 | 写循环、判断等逻辑 |
| `<%= user.getName() %>` | 表达式 | `out.print(...)` 的参数 | 输出一个值，**结尾不能加分号** |

三个坑：

- `<%= %>` 里的值会被 `out.print` 输出；写 `<%= name; %>` 编译报错（多了分号）。
- `<%! %>` 的变量是**所有请求共享**的成员变量，用它做计数器会遇到并发问题。
- 脚本片段里可以写 `if/for`，但**不能在里面再嵌套 HTML 以外的 JSP 指令**（语法层面不允许）。

### 注释的三种写法

```jsp
<%-- JSP 注释：翻译时被丢掉，浏览器源码里看不到 --%>
<!-- HTML 注释：会原样发给浏览器，用户右键就能看到 -->
<% // Java 注释：写在脚本片段里，同样不会输出 %>
```

安全提示：**调试信息、内部路径不要写在 HTML 注释里**，它会随响应体发到客户端。

## 九大内置对象

"内置"的意思是：不用 `new`、不用声明，直接写名字就能用。原因是容器在 `_jspService` 里已经把它们声明成了局部变量，你的代码被原样塞进这个方法体内。

| 对象 | 类型 | 作用 |
| --- | --- | --- |
| `request` | `HttpServletRequest` | 一次请求：取参数、存属性、转发 |
| `response` | `HttpServletResponse` | 一次响应：写内容、设头、重定向 |
| `session` | `HttpSession` | 一次会话：存登录状态 |
| `application` | `ServletContext` | 整个应用：全局配置、全局计数 |
| `out` | `JspWriter` | 输出到响应（带缓冲） |
| `pageContext` | `PageContext` | 页面上下文：取其它八个对象、操作四个作用域 |
| `config` | `ServletConfig` | 读当前 JSP 的初始化参数 |
| `page` | `Object` | 当前页面实例，等价于 `this` |
| `exception` | `Throwable` | 只有 `isErrorPage="true"` 的页面才有 |

记忆口诀按顺序背：**req resp sess app out pageContext config page exception**——从"请求响应"到"会话应用"，再到"输出、上下文、配置"，最后两个是"页面本身"和"异常"。

`pageContext` 是最特殊的一个：它能拿到其它八个。

```jsp
<%= pageContext.getRequest() %>
<%= pageContext.getSession() %>
<%= pageContext.getServletContext() %>
<% pageContext.setAttribute("msg", "ok", PageContext.SESSION_SCOPE); %>
```

## 四大作用域

| 作用域 | 对应对象 | 存活范围 | 典型用途 |
| --- | --- | --- | --- |
| page | `pageContext` | 当前 JSP 页面（当前请求内） | 页面内部临时变量 |
| request | `request` | 一次请求，转发后仍在 | 控制器传给视图的数据 |
| session | `session` | 一次会话（默认 30 分钟不活动失效） | 登录用户信息、购物车 |
| application | `application` | 整个应用从启动到关闭 | 全局配置、在线人数 |

**范围由小到大，查找顺序也是由小到大**：`page → request → session → application`。EL 表达式找属性就是这个顺序，找到就停。

一条必须记住的因果关系：

- `forward` 是**一次请求**，`request` 作用域的数据能带到目标页面 → 所以控制器给视图传数据用 `request`。
- `redirect` 是**两次请求**，第一次的 `request` 已经销毁 → 所以重定向后拿不到 `request` 里的数据，要改用 `session` 或查询串。

```jsp
<% request.setAttribute("msg", "登录成功"); %>
<jsp:forward page="/WEB-INF/jsp/main.jsp"/>   <%-- main.jsp 里能取到 msg --%>
```

## 三个指令

指令的语法是 `<%@ 指令名 属性="值" %>`，在**翻译期**生效。

### page 指令

```jsp
<%@ page language="java" contentType="text/html;charset=UTF-8"
         pageEncoding="UTF-8" import="java.util.*,com.shop.model.User"
         session="true" errorPage="/error.jsp" isErrorPage="false" %>
```

| 属性 | 作用 | 常见考点 |
| --- | --- | --- |
| `language` | 脚本语言，固定 `java` | 只有一个合法值 |
| `contentType` | 响应类型与编码 | 决定浏览器怎么解析 |
| `pageEncoding` | 源文件本身的编码 | 与 `contentType` 的 charset 一致最稳 |
| `import` | 导包 | **唯一可以在同一页面出现多次的 page 属性** |
| `session` | 是否自动创建 session | 设 `false` 后不能用 `session` 对象，省资源 |
| `errorPage` | 出错时跳到哪个页面 | 值要写应用内路径 |
| `isErrorPage` | 本页是否为错误处理页 | 为 `true` 才能用 `exception` |

### include 指令（静态包含）

```jsp
<%@ include file="header.jsp" %>
```

**翻译期**把被包含文件的内容**原样拼进当前文件**，最终只生成一个 `.java`。所以两个文件共享同一个 `request`、同一个变量作用域，被包含文件里不能重复声明同名变量。

### taglib 指令

```jsp
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<c:forEach var="u" items="${users}">...</c:forEach>
```

引入标签库，`uri` 指向库的标识，`prefix` 是你给它的短名字。JSTL 是"用标签代替脚本片段"的标准做法。

### 静态包含 vs 动态包含

这是简答题的常客，必须能列成表格：

| 对比项 | `<%@ include %>`（静态） | `<jsp:include>`（动态） |
| --- | --- | --- |
| 发生时机 | 翻译期 | 请求运行期 |
| 生成几个文件 | 合并成一个 `.java` | 各自独立编译，运行时再合结果 |
| 能否传参 | 不能单独传参 | 可用 `<jsp:param>` 传参 |
| 变量共享 | 共享，注意重名 | 不共享（各自独立的 `_jspService`） |
| 适用场景 | 页头页脚这类纯静态片段 | 内容会变化、或需要独立传参的片段 |

## 七个动作标签

动作标签是 `<jsp:xxx>`，在**运行期**执行。

| 标签 | 作用 | 关键属性 |
| --- | --- | --- |
| `<jsp:include>` | 动态包含 | `page` |
| `<jsp:forward>` | 请求转发 | `page` |
| `<jsp:useBean>` | 查找或创建 Bean | `id`、`class`、`scope` |
| `<jsp:setProperty>` | 给 Bean 赋值 | `name`、`property`、`value`/`param` |
| `<jsp:getProperty>` | 取 Bean 属性并输出 | `name`、`property` |
| `<jsp:param>` | 给包含/转发传参 | `name`、`value` |
| `<jsp:plugin>` | 下载插件执行 Applet | 已过时，知道名字即可 |

### JavaBean 规范与 useBean

能被容器当作 Bean 的类必须满足：**public 类 + 有无参构造 + 属性私有 + 提供 get/set**。容器是靠反射创建实例、靠 setter 注入值的，少一条都不行。

```jsp
<jsp:useBean id="user" class="com.shop.model.User" scope="request" />
```

三个属性的含义：

- `id`：在**当前页面**里使用的变量名，同时也是存进作用域的属性名。
- `class`：全限定类名。**没有 `type` 之外的第四种写法**，也不存在 `value` 属性。
- `scope`：`page`（默认）/ `request` / `session` / `application`。

`useBean` 的语义是"**有就取，没有就建**"：先去 `scope` 指定的作用域按 `id` 找，找到就直接用，找不到才 `new` 一个并存进去。

### setProperty 的三种写法

```jsp
<%-- 1. 按请求参数自动赋值：表单字段名与属性名一致时最省事 --%>
<jsp:setProperty name="user" property="*" />

<%-- 2. 指定某个属性取哪个请求参数 --%>
<jsp:setProperty name="user" property="userName" param="username" />

<%-- 3. 直接给固定值 --%>
<jsp:setProperty name="user" property="age" value="18" />
```

`property="*"` 的两个前提，考判断题时几乎必考：

1. 表单里的 `name` 必须与 Bean 的属性名**完全一致**（大小写也算），不一致的属性会保持默认值，而且**不报错**。
2. 请求参数的类型要能转成属性类型。字符串转 `int` 失败会抛 500。

### getProperty 没有 value

```jsp
<jsp:getProperty name="user" property="userName" />
```

它只做一件事：调用 `getUserName()` 并把返回值输出。所以：

- 属性只有 `name` 与 `property`，**没有 `value`**；
- **没有结束标签**，不能写成 `</jsp:getProperty>`；
- 输出内容不会被转义，属性里带 HTML 会原样生效（XSS 风险点）。

## EL 表达式

EL 的作用是把"从作用域取值"这件事从 Java 代码变成一句表达式。

```jsp
${user.userName}          <%-- 等价于 pageContext.findAttribute("user").getUserName() --%>
${sessionScope.user}      <%-- 只在 session 里找 --%>
${param.id}               <%-- 等价于 request.getParameter("id") --%>
${empty list}             <%-- 空判断：null、空串、空集合都为 true --%>
${user.age + 1}           <%-- 可以直接做算术，字符串会自动转数字 --%>
```

### 查找顺序与"找不到"

`${user}` 会依次在 `page → request → session → application` 找 `user`，找到就返回，都找不到**输出空串，不抛异常**。这一点与脚本片段里的 `request.getAttribute("user").getName()` 形成鲜明对比——后者会抛 `NullPointerException`。

所以视图里用 EL 比用脚本片段稳，这是"JSP 里少写 Java 代码"的实际理由，不只是风格问题。

EL 的 11 个隐式对象（了解即可，前六个要熟）：

| 对象 | 作用 |
| --- | --- |
| `pageScope` / `requestScope` / `sessionScope` / `applicationScope` | 限定在某一个作用域查找 |
| `param` / `paramValues` | 请求参数（后者取数组） |
| `header` / `headerValues` | 请求头 |
| `cookie` | Cookie |
| `initParam` | 全局初始化参数（`context-param`） |
| `pageContext` | 页面上下文，可拿 `request`、`session` 等 |

### EL 的两个常见坑

1. **`${}` 不能嵌套**。要动态拼属性名，得用 `<c:set>` 中转。
2. **EL 里的 `+` 只有算术含义**，没有字符串拼接。`${"a" + "b"}` 会尝试把 `a` 转成数字而报错；拼字符串用 JSTL 的 `<c:out>` 或多个 `${}` 并列写。

## 一次完整的 JSP 页面

把上面的东西串起来，一个"用户列表"页面大致长这样：

```jsp
<%@ page contentType="text/html;charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<!DOCTYPE html>
<html>
<head><title>用户列表</title></head>
<body>
  <c:if test="${empty users}">
    <p>暂无数据</p>
  </c:if>

  <table>
    <c:forEach var="u" items="${users}" varStatus="st">
      <tr>
        <td>${st.index + 1}</td>
        <td><c:out value="${u.userName}" /></td>
        <td>${u.age}</td>
      </tr>
    </c:forEach>
  </table>
</body>
</html>
```

三个值得注意的选择：

- 用 `${}` 而不是 `<%= %>`：不写 Java，找不到也不崩。
- 用 `<c:out>` 而不是直接 `${}`：它会做 HTML 转义，防 XSS。
- 用 `<c:forEach>` 而不是 `<% for %>`：没有脚本片段，页面能被不懂 Java 的人改。

## 考试怎么考

| 题型 | 常见问法 | 答题要点 |
| --- | --- | --- |
| 填空 | "JSP 的九大内置对象是 ____" | 按顺序写完九个，别漏 `config` 和 `page` |
| 填空 | "四个作用域由小到大是 ____" | page → request → session → application |
| 选择 | "哪个指令用于引入标签库" | taglib |
| 选择 | "`<jsp:getProperty>` 有哪些属性" | 只有 name、property |
| 判断 | "`<%@ include %>` 是运行期包含" | 错，是翻译期 |
| 简答 | "静态包含与动态包含的区别" | 时机、生成文件数、能否传参、变量是否共享 |
| 简答 | "JSP 的执行过程" | 翻译 → 编译 → 实例化 → `_jspService` |
| 应用 | 给一段 JSP 找错 | 常见错：`<%=` 多了分号、`getProperty` 写了 value、`exception` 用在非错误页 |

## 自测清单

1. 为什么 JSP 里可以直接用 `out`，而普通 Java 类里不行？
2. `<%! int n = 0; n++; %>` 在并发访问下会发生什么？为什么？
3. `request.setAttribute("msg", "x")` 之后 `sendRedirect` 到另一个页面，`${msg}` 能取到吗？
4. `property="*"` 时表单字段名写成 `user_name`、Bean 属性名是 `userName`，会发生什么？
5. `<jsp:include page="a.jsp"><jsp:param name="id" value="1"/></jsp:include>`，`a.jsp` 里怎么取这个 `id`？
