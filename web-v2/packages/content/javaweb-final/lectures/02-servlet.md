---
moduleId: javaweb:kb:servlet
topicId: javaweb:topic:servlet
title: Servlet
summary: 容器的"打工人"：生命周期、单实例多线程、转发与重定向、会话管理，这四件事几乎每次都考。
minutes: 35
examFocus: 简答必考"生命周期"与"转发与重定向的区别"；选择常考 url-pattern 匹配优先级与 load-on-startup。
goals:
  - 能默写 Servlet 生命周期的四个阶段，并说清每个阶段执行几次、由谁调用
  - 能解释"单实例多线程"为什么会引发线程安全问题，并给出三种可行的处理方式
  - 能写出 web.xml 与注解两种注册方式，并说出 url-pattern 四种写法的匹配优先级
  - 能从请求行、请求头、请求体三个角度区分 forward 与 redirect，并说清什么时候必须用哪个
  - 能说清 Cookie 与 Session 的区别，以及 JSESSIONID 是怎么在两次请求间传递的
pitfalls:
  - doPost 里复用 doGet 要写 doGet(request, response)，两个参数别漏
  - destroy 不要拼成 destory
  - Filter 放行必须写 chain.doFilter(request, response)，漏了请求就断了
  - init 只执行一次，别把"每次请求都要做的事"写进去
  - 重定向后 request 作用域失效，之前 setAttribute 的数据取不到
videos:
  - 尚硅谷 JavaWeb 全套教程 · Servlet 部分 | https://www.bilibili.com/video/BV1Y7411K7zz | 生命周期与转发/重定向有专门的对比演示
resources:
  - Jakarta Servlet 规范 | https://jakarta.ee/specifications/servlet/ | url-pattern 匹配规则以规范原文为准
---

## 这一节解决什么问题

Web 基础那章说"容器按 url-pattern 找到 Servlet"，这一章就回答：**Servlet 是什么、容器怎么管它、它怎么读写请求与响应**。

Servlet 是全课程的地基。SpringMVC 的 `DispatcherServlet`、Spring 的 `ContextLoaderListener`、Filter 链，全部是 Servlet 规范的产物。这一章糊涂，后面框架只能靠背。

## 一分钟速览

| 主题 | 必须记住的内容 |
| --- | --- |
| 继承关系 | `Servlet` 接口 → `GenericServlet` 抽象类 → `HttpServlet` 抽象类 |
| 生命周期 | 构造 → `init` → `service` → `destroy`；前两步各一次，`service` 每次请求 |
| 实例数 | 一个 Servlet 在容器里**只有一个实例**，多线程并发处理请求 |
| 注册 | `@WebServlet` 注解 或 `web.xml` 的 `servlet` + `servlet-mapping` |
| 匹配优先级 | 精确 > 最长路径 > 扩展名 > 默认 `/` |
| 转发 | 一次请求，地址栏不变，能带 `request` 属性，可进 WEB-INF |
| 重定向 | 两次请求，地址栏变，不能带 `request` 属性，不能进 WEB-INF |
| 会话 | Cookie 存 JSESSIONID，Session 存服务端 |

## 接口体系：为什么平时只继承 HttpServlet

```
Servlet（接口：init / service / destroy / getServletConfig / getServletInfo）
   ↑
GenericServlet（抽象类：把 init、destroy、config 都实现好了，只留 service 抽象）
   ↑
HttpServlet（抽象类：按请求方法把 service 拆成 doGet / doPost / doPut / doDelete ...）
```

- 直接实现 `Servlet` 接口：五个方法都要自己写，其中 `init` 还必须把 `ServletConfig` 存起来，否则拿不到初始化参数。
- 继承 `GenericServlet`：只需实现 `service`，与协议无关。
- 继承 `HttpServlet`：只需重写需要的 `doXxx`，`service` 已经按 `request.getMethod()` 分派好了。**这是实际做法**。

`HttpServlet.service()` 的分派逻辑大致是：

```java
protected void service(HttpServletRequest req, HttpServletResponse resp) {
    String method = req.getMethod();
    if ("GET".equals(method))       doGet(req, resp);
    else if ("POST".equals(method)) doPost(req, resp);
    // ... PUT / DELETE / HEAD / OPTIONS / TRACE
    else resp.sendError(405);       // 没有对应 doXxx 就 405
}
```

看到 405 就回来读这段：**不是路径错了，是方法没实现**。

## 生命周期：四个阶段，两种次数

| 阶段 | 谁调用 | 执行次数 | 你的代码一般写什么 |
| --- | --- | --- | --- |
| 构造（`new`） | 容器 | 1 次 | 什么都不写（不要在这里碰 `ServletConfig`） |
| `init(ServletConfig)` | 容器 | 1 次 | 读初始化参数、建连接池 |
| `service(req, resp)` | 容器（每次请求） | N 次 | 业务处理（实际写 `doGet`/`doPost`） |
| `destroy()` | 容器（应用卸载/关闭时） | 1 次 | 关资源、刷缓冲 |

三条推论，考试就考这些：

1. **`init` 只执行一次**，所以适合做"全局只做一遍"的事：读配置、初始化连接池。
2. **`service` 每次都执行**，所以别在 `service` 里读配置文件。
3. **`destroy` 不一定被调用**——进程被强杀、断电都不会调。所以关键数据要"写一次落一次"，不能指望在 `destroy` 里补写。

```java
public class HelloServlet extends HttpServlet {
    private String appName;

    @Override
    public void init() {                       // 无参版本，内部会调用带参版本
        appName = getServletConfig().getInitParameter("appName");   // 只读一次
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.setContentType("text/html;charset=UTF-8");
        resp.getWriter().print("应用名：" + appName);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        doGet(req, resp);      // 复用：两个参数都要传
    }

    @Override
    public void destroy() {
        // 关连接池等
    }
}
```

## 单实例多线程：这是 Servlet 最重要的一个设计

容器对每个 Servlet **只创建一个实例**，所有请求由不同线程并发调用同一个实例的 `service`。好处是省内存、不用反复创建；代价是**成员变量会被并发读写**。

```java
public class BadServlet extends HttpServlet {
    private int count = 0;          // ✘ 所有请求共享

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
        count++;                    // 两个线程同时读到同一个值 → 结果少算
        resp.getWriter().print(count);
    }
}
```

四种处理方式，按推荐程度排序：

| 做法 | 是否推荐 | 说明 |
| --- | --- | --- |
| 只用方法内局部变量 | ★ 首选 | 局部变量在栈上，每个线程一份，天然安全 |
| 用 `request`/`session` 存状态 | ★ 首选 | 状态跟着作用域走，而不是跟着实例走 |
| 用 `AtomicInteger` / 加锁 | 视情况 | 计数器确实要全局时用，注意锁粒度 |
| 用 `ThreadLocal` | 谨慎 | 能解决但容易内存泄漏，用完必须 `remove()` |

一条经验：**Servlet 的成员变量只放"初始化后不再变"的东西**（如读好的配置），会变的状态一律放作用域里。

## 两种注册方式

### 方式一：注解（Servlet 3.0+）

```java
@WebServlet(
    urlPatterns = {"/hello", "/hi/*"},
    initParams = {@WebInitParam(name = "appName", value = "shop")},
    loadOnStartup = 1
)
public class HelloServlet extends HttpServlet { ... }
```

### 方式二：web.xml

```xml
<servlet>
  <servlet-name>hello</servlet-name>
  <servlet-class>com.shop.web.HelloServlet</servlet-class>
  <init-param>
    <param-name>appName</param-name>
    <param-value>shop</param-value>
  </init-param>
  <load-on-startup>1</load-on-startup>
</servlet>

<servlet-mapping>
  <servlet-name>hello</servlet-name>
  <url-pattern>/hello</url-pattern>
</servlet-mapping>
```

对比：

| 对比项 | 注解 | web.xml |
| --- | --- | --- |
| 写法 | 与类写在一起，短 | 集中在配置文件 |
| 改映射 | 要改代码、重新编译 | 只改配置 |
| 适用 | 开发期、映射固定的场景 | 需要运维期调整、或第三方 Servlet |

**两者同时存在时**：`web.xml` 的 `metadata-complete="true"` 会让注解失效；同名 Servlet 以 `web.xml` 为准。考试若问"注解和 web.xml 冲突听谁的"，答"web.xml 优先"。

### url-pattern 四种写法与优先级

| 写法 | 名称 | 匹配的例子 |
| --- | --- | --- |
| `/hello` | 精确匹配 | 只有 `/hello` |
| `/user/*` | 路径匹配 | `/user/list`、`/user/a/b` |
| `*.do` | 扩展名匹配 | `/a/b/x.do`（**不能写成 `/*.do`**） |
| `/` | 默认匹配 | 所有没被更具体的规则匹配到的请求 |

优先级从高到低：**精确 > 最长路径 > 扩展名 > 默认**。同一优先级有多个匹配时，路径匹配取最长的那条。

两个容易错的点：

- `/*` 和 `/` 不是一回事：`/*` 会拦住包括 JSP 在内的**所有**请求，`/` 只兜底。
- 扩展名匹配不能带路径前缀，`/user/*.do` 是非法写法。

### load-on-startup

```xml
<load-on-startup>1</load-on-startup>
```

- 配正整数：容器**启动时**就创建实例并调 `init`，数字越小越先加载。
- 不配或配负数：**第一次请求**才创建。

什么时候需要配？初始化很耗时（如加载大字典），希望启动时就做完，避免用户第一次访问卡住。

## 请求与响应：常用 API 一张表

| 想做的事 | 写法 |
| --- | --- |
| 取单个参数 | `request.getParameter("id")` |
| 取多值参数（复选框） | `request.getParameterValues("hobby")` |
| 存/取请求属性 | `request.setAttribute(k, v)` / `getAttribute(k)` |
| 取请求头 | `request.getHeader("User-Agent")` |
| 取客户端 IP | `request.getRemoteAddr()` |
| 取会话 | `request.getSession()` / `getSession(false)` |
| 转发 | `request.getRequestDispatcher("/a.jsp").forward(request, response)` |
| 设响应类型 | `response.setContentType("text/html;charset=UTF-8")` |
| 输出 | `response.getWriter().print(...)` |
| 重定向 | `response.sendRedirect(request.getContextPath() + "/list")` |
| 设状态码 | `response.setStatus(404)` |

`getSession()` 与 `getSession(false)` 的区别常考：前者**没有就创建**，后者**没有返回 `null`**。判断"是否已登录"时用 `getSession(false)`，避免给每个游客都建一个空会话。

## 转发与重定向：必须能背出表格

| 对比项 | forward（转发） | redirect（重定向） |
| --- | --- | --- |
| 请求次数 | 1 次 | 2 次 |
| 谁在跳 | 服务器内部 | 浏览器（收到 302 后再发一次） |
| 地址栏 | 不变 | 变成新地址 |
| `request` 作用域 | 保留 | 丢失 |
| 能否访问 WEB-INF | 能 | 不能 |
| 能否跨应用/跨站 | 不能 | 能 |
| API | `request.getRequestDispatcher(path).forward(req, resp)` | `response.sendRedirect(path)` |
| 典型场景 | 控制器 → 视图；表单校验失败回显 | 登录成功跳首页；提交后防重复提交（PRG） |

两个实践结论：

1. **控制器给页面传数据只能用 forward**（或在 session 里存）。这是"为什么登录失败要转发回登录页"的原因——错误提示存在 `request` 里。
2. **提交成功后要 redirect**（Post-Redirect-Get 模式）。否则用户按 F5 会重复提交一次订单。

```java
// 失败：转发，保留 msg
request.setAttribute("msg", "账号或密码错误");
request.getRequestDispatcher("/login.jsp").forward(request, response);

// 成功：重定向，避免刷新重复提交
response.sendRedirect(request.getContextPath() + "/user/list");
```

## ServletConfig 与 ServletContext

| 对比项 | ServletConfig | ServletContext |
| --- | --- | --- |
| 作用范围 | 一个 Servlet | 整个应用 |
| 怎么拿 | `getServletConfig()`（`GenericServlet` 里可直接调 `getInitParameter`） | `getServletContext()` 或 `request.getServletContext()` |
| 配置位置 | `<servlet>` 里的 `<init-param>` | `<context-param>`（在 `web.xml` 根下） |
| 典型内容 | 本 Servlet 的参数 | 数据库地址、全局开关、应用根路径 |

```xml
<context-param>
  <param-name>uploadPath</param-name>
  <param-value>/data/upload</param-value>
</context-param>
```

```java
String path = getServletContext().getInitParameter("uploadPath");
String realPath = getServletContext().getRealPath("/upload");   // 磁盘绝对路径
```

**最容易混的一道题**：`getInitParameter` 在 `ServletConfig` 上取的是 `init-param`，在 `ServletContext` 上取的是 `context-param`。同名不同源，别看错对象。

## 会话管理：Cookie 与 Session

HTTP 是**无状态**的：服务器不会记得上一次请求是谁发的。登录状态靠两个东西维持：

1. 服务器创建 `HttpSession`，把数据存在服务端，给它一个唯一 ID。
2. 服务器通过响应头 `Set-Cookie: JSESSIONID=xxx` 把 ID 交给浏览器；浏览器之后每次请求自动带 `Cookie: JSESSIONID=xxx`。

```java
// 登录成功
HttpSession session = request.getSession();
session.setAttribute("loginUser", user);
session.setMaxInactiveInterval(30 * 60);     // 30 分钟不活动即失效

// 后续请求
Object user = request.getSession(false).getAttribute("loginUser");

// 退出
session.invalidate();
```

| 对比项 | Cookie | Session |
| --- | --- | --- |
| 存储位置 | 浏览器 | 服务器内存（或持久化） |
| 安全性 | 低（用户可见可改） | 相对高（只暴露 ID） |
| 容量 | 单个约 4KB | 受服务器内存限制 |
| 生命周期 | 可设 `maxAge`，关浏览器是否失效看是否设了有效期 | 默认 30 分钟不活动失效，或调 `invalidate` |
| 跨设备 | 不共享 | 依赖 JSESSIONID，换浏览器就换会话 |

**如果浏览器禁用了 Cookie 怎么办**：容器支持 URL 重写，把 JSESSIONID 拼在地址上（`;jsessionid=xxx`）。调用 `response.encodeURL(url)` 由容器决定是否拼。这是简答题的常见追问。

## Filter 与 Listener（知道即可，但链式调用必须记）

Filter 在 Servlet 之前/之后插一段逻辑，典型用途是编码统一、登录拦截。

```java
@WebFilter("/*")
public class EncodingFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        request.setCharacterEncoding("UTF-8");
        response.setContentType("text/html;charset=UTF-8");
        chain.doFilter(request, response);      // ← 漏了这句，请求就断在这儿
    }
}
```

**`chain.doFilter` 是 Filter 的灵魂**：它表示"放行到下一个 Filter 或目标 Servlet"。不写这句，浏览器会一直等，页面白屏。这也解释了为什么"filter 里 return 之前必须放行"。

Listener 监听应用与会话的生命周期事件，最常用的是 `ServletContextListener`（启动时加载配置）与 `HttpSessionListener`（统计在线人数）。

## 考试怎么考

| 题型 | 常见问法 | 答题要点 |
| --- | --- | --- |
| 简答 | "Servlet 的生命周期" | 四阶段 + 各自执行次数 + 由容器调用 |
| 简答 | "转发与重定向的区别" | 至少写出请求次数、地址栏、request 作用域、能否进 WEB-INF 四项 |
| 选择 | "哪个 url-pattern 优先级最高" | 精确匹配 |
| 选择 | "load-on-startup 配 0 表示" | 启动时加载（0 和正整数都表示启动加载，数字越小越早） |
| 判断 | "Servlet 是多实例的" | 错，单实例多线程 |
| 应用 | 写一个处理登录的 Servlet | 编码 → 取参 → 校验 → session 存用户 → 重定向/转发 |
| 应用 | 写一个编码 Filter | `setCharacterEncoding` + `chain.doFilter` |

## 自测清单

1. `init` 里能拿到 `ServletConfig` 吗？构造函数里呢？
2. 两个线程同时访问一个只有成员变量计数器的 Servlet，最终计数会偏大还是偏小？为什么？
3. `@WebServlet("/user/*")` 能否匹配 `/user`（不带后面的路径）？
4. 登录失败要把错误信息带回页面，为什么必须用 forward？
5. 用户禁用 Cookie 后，Session 还能用吗？靠什么机制？
6. Filter 里忘了写 `chain.doFilter` 会发生什么？
