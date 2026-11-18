---
moduleId: javaweb:kb:springmvc
topicId: javaweb:topic:springmvc
title: SpringMVC
summary: 一个 DispatcherServlet 串起九个组件——把"请求怎么找到方法、结果怎么变成页面"讲成一条能背下来的流水线。
minutes: 32
examFocus: 简答几乎必考"SpringMVC 执行流程"；选择常考三大组件职责、@RequestBody 与 @ResponseBody 的方向、url-pattern 写 / 与 /* 的区别。
goals:
  - 能按顺序复述一次请求在 SpringMVC 里的完整流转，并指出每一步由哪个组件负责
  - 能说清 HandlerMapping、HandlerAdapter、ViewResolver 三者的分工，而不是笼统说"都是框架做的"
  - 能写出接收普通参数、路径变量、JSON 请求体的三种 Controller 方法
  - 能解释 String 返回值、ModelAndView、@ResponseBody 三者的区别
  - 能说清为什么 url-pattern 要写 / 而不是 /*，以及静态资源怎么放行
pitfalls:
  - @ResponseBody 是写响应体，@RequestBody 是读请求体，方向相反，最容易记混
  - url-pattern 写 /* 会把 JSP 也拦住，应该写 /
  - 返回值 String 时默认当视图名解析，想直接返回字符串内容必须加 @ResponseBody
  - 视图解析器的 prefix 已经含 /WEB-INF/，Controller 里再写一遍会拼出双份路径
  - 拦截器的 preHandle 返回 false 就中断，且 postHandle 不会执行
resources:
  - Spring Framework 官方文档 · Web MVC | https://docs.spring.io/spring-framework/reference/web/webmvc.html | 组件职责与流程的权威描述
---

## 这一节解决什么问题

Servlet 章里，一个功能要写一个 Servlet，然后在 `web.xml` 里配一条映射。功能一多，Servlet 类就爆炸，且每个类里都要重复写编码、取参、转发。

SpringMVC 的做法是：**只留一个 Servlet（DispatcherServlet）接所有请求**，再由它按注解把请求分派给普通方法。一个 Controller 类里可以放十个方法，对应十个 URL。这就是"前端控制器"模式。

## 一分钟速览

| 主题 | 必须记住的内容 |
| --- | --- |
| 核心 | DispatcherServlet 是唯一入口，负责调度，不干具体活 |
| 三大组件 | HandlerMapping（找谁）、HandlerAdapter（怎么调）、ViewResolver（怎么解析视图） |
| 两个基础注解 | `@Controller` 声明控制器、`@RequestMapping` 映射路径 |
| 参数注解 | `@RequestParam` 取参数、`@PathVariable` 取路径、`@RequestBody` 读请求体 |
| 返回值 | String = 视图名；ModelAndView = 数据 + 视图；`@ResponseBody` = 直接写响应体 |
| 视图解析器 | `prefix + 返回值 + suffix` |
| 静态资源 | `url-pattern` 写 `/`，再配 `<mvc:resources>` 或默认 Servlet 放行 |
| 拦截器 | `preHandle` / `postHandle` / `afterCompletion` |

## 三大组件：各自只干一件事

| 组件 | 职责 | 一句话记法 |
| --- | --- | --- |
| `HandlerMapping` | 按 URL 找到该由哪个方法处理 | **找谁** |
| `HandlerAdapter` | 按方法签名调用它（绑定参数、转换返回值） | **怎么调** |
| `ViewResolver` | 把逻辑视图名解析成真正的视图对象 | **怎么显示** |

为什么"找谁"和"怎么调"要拆成两个组件？因为处理器可以是注解方法，也可以是实现 `Controller` 接口的类。映射规则与调用方式是两个独立变化的维度，拆开后新增一种处理器类型不用改映射逻辑。

## 执行流程：十一步

这张表建议按顺序背，考试写简答就照这个顺序写，每一步点出责任方。

| 步 | 发生什么 | 责任方 |
| --- | --- | --- |
| 1 | 浏览器发出请求，被 `DispatcherServlet` 接住 | 前端控制器 |
| 2 | 拿 URL 去问 `HandlerMapping`：这个请求归谁 | DispatcherServlet |
| 3 | 返回 `HandlerExecutionChain`（处理器方法 + 拦截器链） | HandlerMapping |
| 4 | 找一个能调这个处理器的 `HandlerAdapter` | DispatcherServlet |
| 5 | 依次执行拦截器 `preHandle` | 拦截器 |
| 6 | `HandlerAdapter` 做参数绑定并调用 Controller 方法 | HandlerAdapter |
| 7 | Controller 返回 `ModelAndView`（或视图名） | Controller |
| 8 | 执行拦截器 `postHandle` | 拦截器 |
| 9 | `ViewResolver` 把视图名解析成 `View` | 视图解析器 |
| 10 | 渲染视图（把模型数据填进去），写回响应 | View |
| 11 | 执行拦截器 `afterCompletion` | 拦截器 |

一条推论：**`postHandle` 在渲染之前执行，所以它还能改 `ModelAndView`；`afterCompletion` 在渲染之后，改不了了。**

## 配置：web.xml 与 springmvc.xml

```xml
<!-- web.xml：把 DispatcherServlet 挂到 / 上 -->
<servlet>
  <servlet-name>dispatcher</servlet-name>
  <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
  <init-param>
    <param-name>contextConfigLocation</param-name>
    <param-value>classpath:springmvc.xml</param-value>
  </init-param>
  <load-on-startup>1</load-on-startup>
</servlet>

<servlet-mapping>
  <servlet-name>dispatcher</servlet-name>
  <url-pattern>/</url-pattern>       <!-- 注意：是 /，不是 /* -->
</servlet-mapping>
```

```xml
<!-- springmvc.xml -->
<context:component-scan base-package="com.shop.web"/>
<mvc:annotation-driven/>            <!-- 开启注解驱动：注册注解需要的处理器映射与适配器 -->

<bean class="org.springframework.web.servlet.view.InternalResourceViewResolver">
  <property name="prefix" value="/WEB-INF/jsp/"/>
  <property name="suffix" value=".jsp"/>
</bean>
```

### 为什么 url-pattern 写 `/` 而不是 `/*`

| 写法 | 拦什么 | 后果 |
| --- | --- | --- |
| `/` | 所有请求，但**不拦 JSP**（JSP 交给容器自带的 JspServlet） | 正确做法 |
| `/*` | 所有请求，**连 JSP 也拦** | 访问 `.jsp` 时又进 DispatcherServlet，找不到处理器 → 404 |

这条在考试里以"页面 404 但 Controller 没错"的形式出现，根因往往就是写成了 `/*`。

### 视图解析器：prefix + 返回值 + suffix

```java
@Controller
public class UserController {
    @RequestMapping("/user/list")
    public String list(Model model) {
        model.addAttribute("users", userService.findAll());
        return "userList";        // 实际视图：/WEB-INF/jsp/userList.jsp
    }
}
```

三个容易错的地方：

1. 返回值写 `"userList.jsp"` 会变成 `/WEB-INF/jsp/userList.jsp.jsp`。
2. 返回值写 `"/WEB-INF/jsp/userList.jsp"` 会拼成双份前缀。**要绕过解析器就用 `forward:` / `redirect:` 前缀**。
3. `redirect:` 是两次请求，`model` 里的数据会丢；`forward:` 是一次请求，数据还在。

## 参数绑定：六种常见写法

| 场景 | 写法 | 说明 |
| --- | --- | --- |
| 同名简单参数 | `public String f(String name, Integer age)` | 参数名与请求参数名一致即自动绑定 |
| 改名/必填 | `@RequestParam("user_name") String name` | 可加 `required=false`、`defaultValue` |
| 路径变量 | `@PathVariable Long id` | 配合 `@RequestMapping("/user/{id}")` |
| POJO | `public String f(User user)` | 表单字段名与属性名一致即自动封装 |
| JSON 请求体 | `@RequestBody User user` | 前端 `Content-Type: application/json` |
| 请求头/Cookie | `@RequestHeader`、`@CookieValue` | 取请求头与 Cookie |

```java
@Controller
@RequestMapping("/user")
public class UserController {

    // GET /user/3
    @GetMapping("/{id}")
    public String detail(@PathVariable Long id, Model model) {
        model.addAttribute("user", userService.findById(id));
        return "userDetail";
    }

    // POST /user（JSON 请求体）
    @PostMapping
    @ResponseBody
    public Result<User> create(@RequestBody User user) {
        userService.save(user);
        return Result.ok(user);        // 直接写 JSON，不走视图解析
    }

    // GET /user/search?keyword=x&page=2
    @GetMapping("/search")
    public String search(@RequestParam(defaultValue = "") String keyword,
                         @RequestParam(defaultValue = "1") int page,
                         Model model) {
        model.addAttribute("page", userService.search(keyword, page));
        return "userList";
    }
}
```

两条绑定规则值得单独记：

- **简单类型（String、包装类、日期）用 `@RequestParam` 更稳**，因为参数名依赖编译时保留（`-parameters`），拿不到名就会报错。
- **中文乱码要在进入 Controller 之前解决**，标准做法是配 `CharacterEncodingFilter`（`forceEncoding=true`），而不是在每个方法里写 `setCharacterEncoding`。

## 返回值：三种形态

| 返回类型 | 语义 | 是否需要视图解析 | 典型用途 |
| --- | --- | --- | --- |
| `String` | 逻辑视图名 | 需要 | 返回页面 |
| `ModelAndView` | 数据 + 视图名 | 需要 | 既传数据又指定页面 |
| `void` | 自己往 `response` 写 | 不需要 | 手写输出（少用） |
| 任意对象 + `@ResponseBody` | 序列化为 JSON/XML 写入响应体 | 不需要 | 前后端分离接口 |

```java
@RequestMapping("/report")
public ModelAndView report() {
    ModelAndView mv = new ModelAndView();
    mv.setViewName("report");
    mv.addObject("rows", reportService.rows());
    return mv;
}

@RequestMapping("/api/count")
@ResponseBody
public int count() { return userService.count(); }    // 响应体直接是 12，不是页面
```

**`@ResponseBody` 与 `@RequestBody` 的方向**：一个写出（response body），一个读入（request body）。记不住就记"Response 对应响应"，方向自然对。

## 静态资源：为什么 css/js 会 404

把 `url-pattern` 写成 `/` 后，所有请求都进 DispatcherServlet，包括 `/css/app.css`。它找不到对应处理器，于是 404。两种解法：

```xml
<!-- 解法一：交给容器的默认 Servlet 处理 -->
<mvc:default-servlet-handler/>

<!-- 解法二：显式指定哪些路径当静态资源 -->
<mvc:resources mapping="/css/**" location="/css/"/>
<mvc:resources mapping="/js/**"  location="/js/"/>
```

两者区别：`default-servlet-handler` 是"我处理不了就退回给 Tomcat"；`mvc:resources` 是"这些路径明确由我按静态文件返回"。前者省事，后者可控（能配缓存时间）。

## 拦截器：三个方法，一条顺序

```java
public class LoginInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse resp, Object handler)
            throws Exception {
        if (req.getSession().getAttribute("loginUser") == null) {
            resp.sendRedirect(req.getContextPath() + "/login");
            return false;                 // 中断：后续拦截器、Controller、postHandle 都不执行
        }
        return true;                      // 放行
    }
}
```

| 方法 | 执行时机 | 常用来做 |
| --- | --- | --- |
| `preHandle` | Controller 之前 | 登录校验、权限判断（返回 `false` 即中断） |
| `postHandle` | Controller 之后、渲染之前 | 往 `ModelAndView` 里补公共数据 |
| `afterCompletion` | 渲染之后 | 清理资源、记录耗时 |

与 Filter 的区别（常考）：

| 对比项 | Filter | Interceptor |
| --- | --- | --- |
| 规范来源 | Servlet 规范 | SpringMVC 提供 |
| 作用范围 | 所有请求（含静态资源、JSP） | 只拦进 DispatcherServlet 的请求 |
| 能否拿到处理器方法 | 不能 | 能（`handler` 参数） |
| 能否用 Spring 的 Bean | 默认不能（容器管理） | 能（本身是 Spring Bean） |

## RESTful 风格

```java
@RestController                       // = @Controller + @ResponseBody
@RequestMapping("/api/users")
public class UserApiController {

    @GetMapping("/{id}")              // 查
    public User get(@PathVariable Long id) { return userService.findById(id); }

    @PostMapping                      // 增
    public User create(@RequestBody User user) { return userService.save(user); }

    @PutMapping("/{id}")              // 改
    public User update(@PathVariable Long id, @RequestBody User user) { ... }

    @DeleteMapping("/{id}")           // 删
    public void delete(@PathVariable Long id) { userService.delete(id); }
}
```

核心思想：**用 URL 表示资源，用 HTTP 方法表示动作**。`/api/users/3` 这个地址，GET 是查、PUT 是改、DELETE 是删——URL 里不出现动词。

## 考试怎么考

| 题型 | 常见问法 | 答题要点 |
| --- | --- | --- |
| 简答 | "SpringMVC 的执行流程" | 按十一步写，点出 DispatcherServlet / HandlerMapping / HandlerAdapter / ViewResolver |
| 选择 | "哪个组件负责解析视图名" | ViewResolver |
| 选择 | "`url-pattern` 应该写" | `/` |
| 判断 | "`@RequestBody` 是往响应体写数据" | 错，那是 `@ResponseBody` |
| 填空 | "视图解析器由 ____ 和 ____ 拼成" | prefix、suffix |
| 应用 | 写一个接收路径变量并返回 JSON 的方法 | `@GetMapping("/{id}")` + `@PathVariable` + `@ResponseBody` |
| 应用 | 写一个登录拦截器 | 实现 `HandlerInterceptor`，`preHandle` 返回 `false` 中断 |

## 自测清单

1. Controller 返回 `"userList"`，视图解析器 prefix 是 `/WEB-INF/jsp/`，最终访问的文件路径是什么？
2. 为什么 `url-pattern` 写 `/*` 会导致 JSP 打不开？
3. `@RequestParam` 与 `@PathVariable` 分别从哪里取数据？
4. `redirect:` 和 `forward:` 前缀分别对应 Servlet 的哪两个 API？各自的 `model` 数据还在吗？
5. 拦截器 `preHandle` 返回 `false` 后，`postHandle` 与 `afterCompletion` 还会执行吗？
6. 静态资源 404，有哪两种标准解法？
