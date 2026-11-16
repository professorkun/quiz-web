# -*- coding: utf-8 -*-
"""把题库 Markdown 解析成网页用的 JSON。"""
import io, json, os, re, sys

# 题库源文件固定在 _build 的上一级目录，随工程整体搬移不用改路径
PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "JavaWeb期末全题型题库.md")
text = io.open(PATH, encoding="utf-8").read()
lines = text.split("\n")


def section(start, end):
    i = next(k for k, l in enumerate(lines) if l.startswith(start))
    j = next(k for k, l in enumerate(lines) if k > i and l.startswith(end))
    return lines[i + 1:j]


def strip_md(s):
    s = s.replace("**", "").replace("`", "")
    s = re.sub(r"\_\{?\\?\}?", "", s)
    return s.strip()


def clean(s):
    """去掉 markdown 强调/反引号，但保留 <jsp:...> 之类代码。"""
    return s.replace("**", "").replace("`", "").strip()


# ---------- 选择题 ----------
def parse_choice():
    body = section("### 1.2 原题", "### 1.3 答案与解析")
    ans = {}
    for l in section("### 1.3 答案与解析", "## 二"):
        m = re.match(r"^\| (\d+) \| ([A-D]) \| (.+?) \|$", l)
        if m:
            ans[int(m.group(1))] = (m.group(2), m.group(3))
    out, cur, in_opts = [], None, False
    for l in body:
        l = l.rstrip()
        if not l.strip():
            continue
        if re.match(r"^\*\*[A-G]　", l.strip()):      # 分组小标题，跳过
            continue
        m = re.match(r"^(\d+)\. (.+)$", l)
        if m and not l.startswith("A."):
            if cur:
                out.append(cur)
            cur = {"type": "choice", "no": int(m.group(1)), "stem": clean(m.group(2)), "options": []}
            in_opts = False
            continue
        if cur is None:
            continue
        if re.match(r"^A\. ", l.strip()):
            in_opts = True
            parts = [p.strip() for p in re.split(r"(?=[A-D]\. )", l.strip()) if p.strip()]
            for p in parts:
                mm = re.match(r"^([A-D])\. (.+)$", p)
                if mm:
                    cur["options"].append({"key": mm.group(1), "text": clean(mm.group(2))})
            continue
        if not in_opts:                              # 选项之前的续行属于题干
            cur["stem"] = (cur["stem"] + "\n" + clean(l)).strip()
    if cur:
        out.append(cur)
    for q in out:
        a = ans.get(q["no"])
        q["answer"] = a[0] if a else ""
        q["analysis"] = clean(a[1]) if a else ""
    return out


# ---------- 判断题 ----------
def parse_judge():
    body = section("### 2.2 原题", "### 2.3 答案与解析")
    ans = {}
    for l in section("### 2.3 答案与解析", "## 三"):
        m = re.match(r"^\| (\d+) \| ([√×]) \| (.+?) \|$", l)
        if m:
            ans[int(m.group(1))] = (m.group(2), m.group(3))
    out = []
    for l in body:
        m = re.match(r"^(\d+)\. (.+)$", l.rstrip())
        if m:
            n = int(m.group(1))
            a = ans.get(n, ("", ""))
            out.append({"type": "judge", "no": n, "stem": clean(m.group(2)),
                        "answer": a[0], "analysis": clean(a[1])})
    return out


# ---------- 填空题 ----------
def parse_blank():
    body = section("### 3.1 完整版", "### 3.2 挖空版")
    meta = {}
    for l in section("### 3.3 答案", "## 四"):
        m = re.match(r"^\| (\d+) \| (.+?) \| (.+?) \|$", l)
        if m:
            meta[int(m.group(1))] = (m.group(2), m.group(3))
    out = []
    for l in body:
        m = re.match(r"^(\d+)\. (.+)$", l.rstrip())
        if not m:
            continue
        n, raw = int(m.group(1)), m.group(2)
        bolds = re.findall(r"\*\*(.+?)\*\*", raw)
        stem = re.sub(r"\*\*(.+?)\*\*", "\u0000", raw)
        stem = clean(stem).replace("\u0000", "{{BLANK}}")
        ans, hint = meta.get(n, ("", ""))
        out.append({"type": "blank", "no": n, "stem": stem,
                    "blanks": [clean(b) for b in bolds],
                    "answer": clean(ans), "hint": clean(hint),
                    "analysis": clean(hint)})
    return out


# ---------- 简答题 ----------
def parse_short():
    body = section("### 4.1 完整版", "### 4.2 挖空版")
    out, cur = [], None
    for l in body:
        s = l.rstrip()
        m = re.match(r"^\*\*(\d+)\. (.+?)\*\*$", s)
        if m:
            if cur:
                out.append(cur)
            cur = {"type": "short", "no": int(m.group(1)), "stem": clean(m.group(2)), "points": []}
            continue
        if cur is not None and s.strip():
            cur["points"].append(clean(s.strip()))
    if cur:
        out.append(cur)
    hints = {}
    for l in section("### 4.3 答案", "### 4.4"):
        m = re.match(r"^\| (\d+) \| (.+?) \|$", l)
        if m:
            hints[int(m.group(1))] = clean(m.group(2))
    for q in out:
        q["analysis"] = hints.get(q["no"], "")
        q["answer"] = "\n".join(q["points"])
    return out


# ---------- 应用题 ----------
def parse_app():
    out = []
    starts = [k for k, l in enumerate(lines) if re.match(r"^### 5\.\d ", l)]
    for idx, i in enumerate(starts):
        end = starts[idx + 1] if idx + 1 < len(starts) else next(
            k for k, l in enumerate(lines) if k > i and l.startswith("## 六"))
        block = lines[i:end]
        title = re.sub(r"^5\.\d+\s*", "", block[0][4:].strip())
        item = {"type": "app", "no": idx + 1, "stem": title, "code": [], "blankCode": [],
                "answer": [], "analysis": ""}
        mode, label, buf, lang = None, "", None, ""
        k = 1
        while k < len(block):
            s = block[k]
            if s.startswith("**一、原代码"):
                mode = "code"
            elif s.startswith("**二、填空版"):
                mode = "blankCode"
            elif s.startswith("**三、答案"):
                mode = "ans"
            elif s.startswith("易错点："):
                item["analysis"] = clean(s[4:])
            elif re.match(r"^\*（\d+）", s):
                label = clean(s.strip("*"))
            elif s.startswith("```"):
                lang = s[3:].strip()
                buf = []
                k += 1
                while k < len(block) and not block[k].startswith("```"):
                    buf.append(block[k])
                    k += 1
                if mode == "code":
                    item["code"].append({"label": label, "lang": lang, "text": "\n".join(buf)})
                elif mode == "blankCode":
                    item["blankCode"].append({"label": label, "lang": lang, "text": "\n".join(buf)})
            elif mode == "ans" and s.startswith("|"):
                cells = [c.strip() for c in s.strip().strip("|").split("|")]
                if len(cells) >= 4 and re.match(r"^\d+-\d+$", cells[0]):
                    item["answer"].append([clean(cells[0]), clean(cells[1])])
                    if cells[2] and re.match(r"^\d+-\d+$", cells[2]):
                        item["answer"].append([clean(cells[2]), clean(cells[3])])
            k += 1
        item["answer"].sort(key=lambda kv: (int(kv[0].split("-")[0]), int(kv[0].split("-")[1])))
        out.append(item)
    return out


# ---------- 知识点 ----------
RULES = [
    ("JSP", ["jsp", "内置对象", "page 指令", "动作标签", "动作是", "javabean", "el 表达式",
             "${", "pagecontext", "usebean", "getproperty", "setproperty", "jsp:include", "jsp:forward",
             "jsp:param", "include 指令", "静态包含", "动态包含", "四大作用域", "page 作用域",
             "session 作用域", "request 作用域"]),
    ("SpringMVC", ["springmvc", "spring mvc", "dispatcherservlet", "modelandview", "viewresolver",
                   "handlermapping", "handleradapter", "requestmapping", "@controller", "pathvariable",
                   "@requestparam", "@responsebody", "@requestbody", "redirect:", "视图解析", "前端控制器"]),
    ("MyBatis", ["mybatis", "mapper", "sqlsession", "namespace", "resulttype", "parametertype",
                 "datasource", "environments", "pooled", "#{", "orm", "transactionmanager"]),
    ("JDBC", ["jdbc", "statement", "resultset", "connection", "executeupdate", "executequery",
              "preparedstatement", "drivermanager", "class.forname", "分页", "limit"]),
    ("Servlet", ["servlet", "filter", "web.xml", "doget", "dopost", "url-pattern", "servlet-name",
                 "load-on-startup", "webservlet", "getparameter", "getsession", "getcontextpath",
                 "setcharacterencoding", "sendredirect", "senderror", "生命周期"]),
    ("Spring", ["spring", "bean", "ioc", "aop", "注入", "component", "autowired", "resource",
                "constructor-arg", "property", "singleton", "prototype", "applicationcontext", "解耦"]),
    ("Web 基础", ["b/s", "c/s", "maven", "tomcat", "mvc", "动态网页", "静态网页", "web 服务器"]),
]


def kp_of(q):
    def s(v):
        return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    if q["type"] == "app":
        return {1: "JSP", 2: "JSP", 3: "Servlet", 4: "SpringMVC", 5: "MyBatis"}[q["no"]]
    stem = s(q.get("stem", "")).lower()
    full = stem + " " + s(q.get("answer", "")) + " " + s(q.get("analysis", "")).lower()
    for blob in (stem, full):
        for name, keys in RULES:
            for k in keys:
                if k in blob:
                    return name
    return "Web 基础"


choice = parse_choice()
judge = parse_judge()
blank = parse_blank()
short = parse_short()
app = parse_app()

groups = {"选择": [], "判断": [], "填空": [], "简答": [], "应用": []}
groups["选择"] = choice
groups["判断"] = judge
groups["填空"] = blank
groups["简答"] = short
groups["应用"] = app

allq = choice + judge + blank + short + app
for q in allq:
    q["kp"] = kp_of(q)

data = {
    "meta": {"title": "JavaWeb 期末题库", "sub": "选择 62 · 判断 45 · 填空 27 · 简答 8 · 应用 5"},
    "questions": allq,
}
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
io.open(OUT, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))

from collections import Counter
print("选择", len(choice), "判断", len(judge), "填空", len(blank), "简答", len(short), "应用", len(app))
print("知识点分布", Counter(q["kp"] for q in allq))
print("选择题无答案", [q["no"] for q in choice if not q["answer"]])
print("判断题无答案", [q["no"] for q in judge if not q["answer"]])
print("填空无答案", [q["no"] for q in blank if not q["answer"]])
print("填空空数统计", Counter(q["stem"].count("{{BLANK}}") for q in blank))
print("例题", json.dumps(choice[0], ensure_ascii=False)[:300])
print("填空例", json.dumps(blank[2], ensure_ascii=False)[:300])
print("简答例", json.dumps(short[0], ensure_ascii=False)[:300])
print("应用例", json.dumps({k: (v if not isinstance(v, list) else v[:1]) for k, v in app[0].items()},
                        ensure_ascii=False)[:400])

# 校验：选项里用到 ①②③④⑤ 的，题干必须给出对应说明，否则这题做不了
bad = []
for q in choice + judge:
    syms = set(re.findall(r"[①②③④⑤⑥]", " ".join(o["text"] for o in q.get("options", [])) or q["stem"]))
    miss = [s for s in syms if s not in q["stem"]]
    if miss:
        bad.append((q["no"], "".join(sorted(miss)), q["stem"][:40]))
print("题干缺符号说明", bad if bad else "无")
