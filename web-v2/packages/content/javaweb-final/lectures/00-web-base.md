---
moduleId: javaweb:kb:web_base
topicId: javaweb:topic:web_base
title: Web 基础
summary: 从地址栏回车到页面出现，中间到底发生了什么——把后面六章要用到的名词先立住。
minutes: 20
examFocus: 选择题常考 GET/POST 差异、常见状态码、WEB-INF 可见性；简答常问"一次请求的完整流程"。
goals:
  - 能完整复述一次 HTTP 请求从浏览器到 Tomcat 再到响应的七步，并指出每步由谁负责
  - 能说清 GET 与 POST 在参数位置、长度、缓存、幂等性上的差别，而不是只背"一个在 URL 一个在 body"
  - 能解释为什么 WEB-INF 下的页面浏览器直接访问不到，而转发可以
  - 能用 MVC 给一个登录功能划出三层各自该写什么
pitfalls:
  - 表单 method 不写默认是 GET，中文参数容易乱码，且会被浏览器历史记录
  - 重定向（302）访问不到 WEB-INF 下的页面，只有服务器内部转发可以
  - 8080 是 Tomcat 默认端口，不是 HTTP 的默认端口（HTTP 是 80）
  - 状态码 302 是"临时跳转"，301 是"永久跳转"，考试常拿来设陷阱
resources:
  - MDN · HTTP 概述 | https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Overview | 报文结构、方法、状态码的权威速查
  - RFC 9110 · HTTP 语义 | https://www.rfc-editor.org/rfc/rfc9110.html | 想知道"规范原文怎么写的"时查这里
---

## 这一节解决什么问题

后面六章（JSP、Servlet、JDBC、Spring、SpringMVC、MyBatis）看起来是六个互不相干的框架，其实都在回答同一个问题：**一个 HTTP 请求进来，谁接住它、谁处理它、谁把结果写回去**。

这一节不写代码，只做一件事：把这条链路上的名词全部立住。名词不清楚，后面每学一个框架都会卡在"这东西站在链路的哪一段"。

## 一分钟速览

| 概念 | 一句话 | 后面哪一章会用到 |
| --- | --- | --- |
| B/S 架构 | 客户端只要浏览器，升级只改服务器 | 全部章节的前提 |
| 静态资源 | 文件里写死什么就返回什么 | Tomcat 直接返回，不经过 Java 代码 |
| 动态资源 | 由程序现场生成，可以查库、可以随参数变化 | Servlet / JSP / Controller |
| 请求（Request） | 浏览器发出去的一包数据：方法、地址、头、体 | `HttpServletRequest` |
| 响应（Response） | 服务器回过来的一包数据：状态码、头、体 | `HttpServletResponse` |
| 容器（Container） | 管 Servlet 生老病死、管请求分发的那个程序 | Tomcat，Servlet 章的主角 |
| 上下文路径 | 应用在容器里的前缀，如 `/shop` | 所有路径拼接 |
| MVC | 模型管数据、视图管展示、控制器管调度 | SpringMVC 章的主线 |

## 从地址栏回车到页面出现

把浏览器地址栏输入 `http://localhost:8080/shop/user/list` 之后发生的事拆成七步。**这七步是本章唯一必须按顺序背下来的东西**，因为每一章都是在这条链上插一个环节。

1. **域名解析**：`localhost` 直接被系统解析成 `127.0.0.1`，不查 DNS。
2. **建立 TCP 连接**：浏览器向 `127.0.0.1:8080` 发起三次握手（HTTPS 还要多一步 TLS 握手）。
3. **拼 HTTP 请求报文**：浏览器按 HTTP 协议把"我要什么"写成文本，第一行是请求行。
4. **Tomcat 接住请求**：`Connector` 负责监听端口、解析报文，把字节流转成 `HttpServletRequest` 对象。
5. **找到该谁处理**：Tomcat 按"上下文路径 + 路径"找到对应的 Web 应用，再按 `url-pattern` 找到 Servlet（或交给 JSP、交给 SpringMVC 的 `DispatcherServlet`）。
6. **业务处理**：Java 代码执行——可能查数据库、可能调用别的服务，最终把数据放进 `request` / `Model` 里。
7. **写响应**：容器把 `HttpServletResponse` 里的状态码、响应头、响应体序列化成字节流发回去，浏览器解析并渲染。

一句话记法：**解析地址 → 连端口 → 发报文 → 容器拆包 → 找 Servlet → 跑业务 → 回响应**。

## B/S 与 C/S

| 对比项 | B/S（Browser/Server） | C/S（Client/Server） |
| --- | --- | --- |
| 客户端 | 浏览器，装好即用 | 需要安装专门的客户端程序 |
| 升级维护 | 只改服务器，用户刷新即生效 | 每台机器都要重新分发安装 |
| 跨平台 | 天然跨平台，有浏览器就能跑 | 要分别做 Windows / macOS / 移动端 |
| 交互体验 | 受浏览器能力限制 | 可以调用本地硬件、体验更接近原生 |
| 典型例子 | 教务系统、电商网站 | 微信客户端、大型网游 |

JavaWeb 这门课默认是 B/S：服务端用 Java 写，客户端只交一个浏览器。

## URL 的每一段都有名字

```
http://localhost:8080/shop/user/list?id=3#top
└┬─┘   └───┬───┘ └┬─┘ └─┬─┘ └────┬────┘ └──┬──┘ └┬┘
协议     主机     端口  上下文路径   资源路径    查询串  片段
```

- **协议**：`http` 默认端口 80，`https` 默认端口 443。写 `:8080` 是因为 Tomcat 默认不用 80。
- **上下文路径（Context Path）**：应用名。部署到 `webapps/shop` 就自动是 `/shop`；部署成 `ROOT` 时为空串。
- **资源路径**：容器拿它去匹配 `url-pattern`，这一段的匹配规则是 Servlet 章的重点。
- **查询串**：`?` 之后，`key=value` 用 `&` 连接。这就是 GET 传参的位置。
- **片段**：`#` 之后，**根本不会发给服务器**，只在浏览器内部用于锚点跳转。

在 JSP/Servlet 里拿这些值：

```java
request.getContextPath();      // /shop
request.getRequestURI();       // /shop/user/list
request.getRequestURL();       // http://localhost:8080/shop/user/list
request.getQueryString();      // id=3
request.getParameter("id");    // 3（GET 查查询串，POST 查请求体）
```

## HTTP 请求报文长什么样

```
POST /shop/user/login HTTP/1.1          ← 请求行：方法 路径 协议版本
Host: localhost:8080                     ← 请求头：一行一个键值对
Content-Type: application/x-www-form-urlencoded
Content-Length: 27
Cookie: JSESSIONID=8A3F...               ← 会话靠它带上来
                                         ← 空行：头和体的分界，必须有
username=admin&password=123              ← 请求体
```

### GET 与 POST 的真实差别

| 对比项 | GET | POST |
| --- | --- | --- |
| 参数位置 | URL 查询串 | 请求体 |
| 长度限制 | 受 URL 长度限制（浏览器与服务器各有上限） | 基本不受限，适合上传 |
| 书签/历史 | 会被记录，能被收藏 | 不会 |
| 缓存 | 可被浏览器与代理缓存 | 默认不缓存 |
| 幂等性 | 幂等（查一百次结果一样） | 非幂等（提交一百次可能建一百条） |
| 表单默认值 | `method` 不写时**就是 GET** | 要显式写 `method="post"` |
| 典型用途 | 查询、翻页、搜索 | 登录、下单、上传文件 |

考试常见问法："GET 能传多少数据？"——标准答案是"受 URL 长度限制，不同浏览器与服务器上限不同，规范本身没有规定上限"。**不要答"1024 字节"**，那是以讹传讹。

另一个高频陷阱：**"POST 比 GET 安全"这句话不全对**。POST 只是不把参数暴露在地址栏和日志里；明文 HTTP 下抓包一样能看见，真正的安全靠 HTTPS。

## HTTP 响应报文与状态码

```
HTTP/1.1 302 Found                      ← 状态行：协议版本 状态码 原因短语
Location: /shop/user/list                ← 响应头
Content-Type: text/html;charset=UTF-8
Content-Length: 0
                                         ← 空行
                                         ← 响应体（302 通常为空）
```

| 状态码 | 含义 | 什么时候会见到 |
| --- | --- | --- |
| 200 | 成功 | 正常返回页面或 JSON |
| 302 | 临时重定向 | 登录成功后 `sendRedirect` 跳首页 |
| 304 | 资源未修改 | 浏览器带了 `If-Modified-Since`，服务器让它用缓存 |
| 400 | 请求有语法错误 | 参数格式不对 |
| 403 | 禁止访问 | 权限不足 |
| 404 | 资源不存在 | 路径写错、Servlet 没映射上 |
| 405 | 方法不允许 | 只写了 `doPost`，却用 GET 访问 |
| 500 | 服务器内部错误 | Java 代码抛了没接住的异常 |

**405 是排错时的关键线索**：看到 405，直接去看是不是只实现了 `doPost` 而访问方式是 GET。

## 静态资源与动态资源

| 类型 | 谁生成 | 例子 | 处理者 |
| --- | --- | --- | --- |
| 静态资源 | 本来就存在磁盘上 | `.html`、`.css`、`.js`、`.jpg` | Tomcat 内置的 DefaultServlet 直接读文件返回 |
| 动态资源 | 请求来了才现场生成 | `.jsp`、Servlet 映射的路径 | JSP 引擎或你的 Servlet |

判断依据是**有没有交给程序处理**，不是看扩展名。`index.html` 也可能被映射给某个 Servlet，那时它就是动态的。

## Tomcat 的目录结构与部署

```
tomcat/
├── bin/           启动脚本（startup.bat / shutdown.sh）
├── conf/          server.xml（端口）、web.xml（全局配置）
├── lib/           容器自己的 jar，所有应用共享
├── logs/          日志
├── temp/          临时文件
└── webapps/       ← 应用放这里，目录名就是上下文路径
    └── shop/
        ├── index.jsp          浏览器可直接访问
        ├── css/ js/ img/      静态资源
        └── WEB-INF/           ← 受保护目录
            ├── web.xml        部署描述符
            ├── classes/       编译后的 .class
            └── lib/           本应用私有 jar
```

三个必须记住的点：

1. **`webapps/` 下的目录名 = 上下文路径**。把 `shop.war` 丢进去，Tomcat 自动解压成 `shop/`。
2. **`WEB-INF/classes` 与 `WEB-INF/lib` 是类路径**，你的 `.class` 和第三方 jar 放这儿。
3. **`WEB-INF` 下的任何文件，浏览器都访问不到**，只能由服务器内部转发过去。

### 为什么 WEB-INF 访问不到

这不是权限设置，是 **Servlet 规范写死的**：容器收到请求后，如果解析出的路径落在 `WEB-INF` 或 `META-INF` 下，必须直接返回 404，不交给任何资源处理。

所以正确的用法是：

```java
// ✔ 转发：服务器内部跳，能进 WEB-INF
request.getRequestDispatcher("/WEB-INF/jsp/list.jsp").forward(request, response);

// ✘ 重定向：让浏览器重新发一次请求，那个请求会被 404 拦掉
response.sendRedirect(request.getContextPath() + "/WEB-INF/jsp/list.jsp");
```

这么设计的价值：把 JSP 藏进 `WEB-INF` 后，用户**必须先经过 Servlet**才能看到页面，Controller 里的登录校验、参数校验就绕不过去。这是"页面不能被直接访问"的安全实践。

## MVC 三层，各写什么

| 层 | 职责 | 这一章对应实现 | 不该出现的东西 |
| --- | --- | --- | --- |
| Model（模型） | 数据结构 + 业务规则 + 数据访问 | JavaBean、Service、DAO | 不写 `request`、不拼 HTML |
| View（视图） | 只负责展示 | JSP、Thymeleaf | 不写 SQL、不写业务判断 |
| Controller（控制器） | 接请求、调业务、选视图 | Servlet、SpringMVC 的 Controller | 不写 SQL、不写大段 HTML |

拿"登录"举例，一次完整的调用链是：

```
浏览器 POST /login
   → LoginServlet（Controller）：取 username/password
   → UserService（Model）：校验账号密码、判断是否锁定
   → UserDao（Model）：select * from user where username=?
   → 成功：request.setAttribute("user", user); forward 到 /WEB-INF/jsp/main.jsp
   → 失败：request.setAttribute("msg", "账号或密码错误"); forward 回 login.jsp
```

**为什么视图要 forward 而不是 redirect**：`request` 作用域只在一次请求内有效，重定向是两次请求，放进去的 `msg` 会丢。这条规则在 Servlet 章还会再强调一次。

## 中文乱码：三个位置，三种解法

乱码的本质是**编码与解码用的字符集不一致**。Web 里有三个独立的环节：

| 环节 | 什么时候出错 | 解法 |
| --- | --- | --- |
| 请求体 | POST 表单里的中文变问号 | `request.setCharacterEncoding("UTF-8")`，必须在第一次 `getParameter` **之前** |
| 响应体 | 页面上的中文变问号 | `response.setContentType("text/html;charset=UTF-8")` |
| URL 查询串 | GET 传中文变乱码 | Tomcat 8 起默认 UTF-8，老版本要改 `server.xml` 的 `URIEncoding` |

一条容易踩的坑：`setCharacterEncoding` 只对**请求体**生效，对 URL 查询串无效；而且它**必须在读取参数之前调用**，因为参数一旦被解析就定型了。

## 考试怎么考

| 题型 | 常见问法 | 答题要点 |
| --- | --- | --- |
| 选择 | "以下哪个状态码表示重定向" | 302；301 是永久 |
| 选择 | "GET 与 POST 的区别" | 参数位置 + 长度限制 + 幂等性，三点都要有 |
| 判断 | "WEB-INF 下的 JSP 可以直接访问" | 错 |
| 填空 | "Tomcat 的默认端口是 ____" | 8080 |
| 简答 | "描述一次 HTTP 请求的完整流程" | 按七步写，每步点出责任方 |
| 简答 | "什么是 MVC，各层职责" | 三层 + 一条"不许跨层写"的约束 |

## 自测清单

不看资料，能全部答上来才算过：

1. 浏览器输入 `http://localhost:8080/shop/a/b?x=1` ，`getContextPath()`、`getRequestURI()`、`getParameter("x")` 各返回什么？
2. 只实现了 `doPost` 的 Servlet 被 GET 访问，返回哪个状态码？为什么？
3. 为什么 `sendRedirect` 到 `WEB-INF` 下的 JSP 会 404，而 `forward` 不会？
4. 表单不写 `method` 属性时用的是什么方法？会带来哪两个具体麻烦？
5. 一次登录请求里，`request.setAttribute` 放的数据，在重定向后的页面还能拿到吗？
