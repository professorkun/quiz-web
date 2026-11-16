# -*- coding: utf-8 -*-
"""旧版（JavaWeb 题库）自检脚本 —— 本地与 CI 共用，无第三方依赖。

检查的是"这次提交能不能被信任"，不是"功能好不好用"：
  1. 必需文件与两条副本（根目录 / 发布目录）是否齐全且一致
  2. 数据基线：147 题、62/45/27/8/5、唯一空位编号 89、每个标记都有答案
  3. 产物完整性：数据与 SDK 真被内联进 HTML，占位符无残留
  4. 结构冒烟：六个 Tab 与关键元素仍在（防止模板被误删改）
  5. 无外部资源加载（防止 CDN 失效导致云端未连接）
  6. 敏感信息：只允许客户端 publishableKey，禁止令牌/私钥/手机号
  7. JS 语法：抽取全部内联脚本交给 node --check

行为级六项冒烟（搜题、组卷、判分、错题重做、续刷）不在这里跑，
它是 S0 阶段门禁的人工项，证据见 `迁移与验证报告.md` §四。
退出码：0 全绿；1 有失败项。
"""
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILS = []
WARNS = []


def ok(msg):
    print("PASS   " + msg)


def bad(msg, detail=""):
    FAILS.append(msg)
    print("FAIL   " + msg + (("  → " + detail) if detail else ""))


def warn(msg):
    WARNS.append(msg)
    print("WARN   " + msg)


def read(path):
    with io.open(path, encoding="utf-8") as f:
        return f.read()


def md5(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


# ---------- 1. 文件齐全 ----------
def check_files():
    required = [
        "JavaWeb期末全题型题库.md",
        "JavaWeb期末题库.html",
        "sdk.js",
        "_build/build_json.py",
        "_build/build_html.py",
        "_build/template.html",
        "_build/cloud-sdk.js",
        "_build/data.json",
        "题库网页/index.html",
        "题库网页/sdk.js",
    ]
    missing = [p for p in required if not os.path.isfile(os.path.join(ROOT, p))]
    if missing:
        bad("必需文件齐全", "缺 " + "、".join(missing))
        return False
    ok("必需文件齐全（10 项）")

    # 根目录 sdk.js 是构建兜底，方案 §2.2 明确"保留，不当冗余删除"
    a = md5(os.path.join(ROOT, "sdk.js"))
    b = md5(os.path.join(ROOT, "_build/cloud-sdk.js"))
    c = md5(os.path.join(ROOT, "题库网页/sdk.js"))
    if a == b == c:
        ok("sdk.js 三处一致（根目录 / _build / 发布目录）")
    else:
        bad("sdk.js 三处应完全一致", "根%s _build%s 发布%s" % (a[:8], b[:8], c[:8]))

    h1 = md5(os.path.join(ROOT, "JavaWeb期末题库.html"))
    h2 = md5(os.path.join(ROOT, "题库网页/index.html"))
    if h1 == h2:
        ok("发布产物两份一致（md5 %s…）" % h1[:8])
    else:
        bad("JavaWeb期末题库.html 与 题库网页/index.html 应完全相同", "%s vs %s" % (h1[:8], h2[:8]))
    return True


# ---------- 2. 数据基线 ----------
EXPECTED_COUNT = {"choice": 62, "judge": 45, "blank": 27, "short": 8, "app": 5}
NAME = {"choice": "选择", "judge": "判断", "blank": "填空", "short": "简答", "app": "应用"}
BLANK_MARK = re.compile(r"___\((\d+-\d+)\)___")


def check_data():
    data = json.loads(read(os.path.join(ROOT, "_build/data.json")))
    qs = data["questions"]
    got = {}
    for q in qs:
        got[q["type"]] = got.get(q["type"], 0) + 1

    if len(qs) == sum(EXPECTED_COUNT.values()) and got == EXPECTED_COUNT:
        ok("题量基线 147 题，分布 " + " / ".join(
            "%s %d" % (NAME[k], v) for k, v in EXPECTED_COUNT.items()))
    else:
        bad("题量基线不符",
            "实际共 %d，分布 %s；期望 147，%s" % (
                len(qs), {NAME.get(k, k): v for k, v in sorted(got.items())},
                {NAME[k]: v for k, v in EXPECTED_COUNT.items()}))

    # 答案缺失：四类客观/半客观题都不允许空答案
    no_ans = []
    for q in qs:
        if q["type"] in ("choice", "judge", "blank"):
            if not str(q.get("answer", "")).strip():
                no_ans.append("%s-%s" % (q["type"], q["no"]))
        elif q["type"] in ("short", "app"):
            if not q.get("answer"):
                no_ans.append("%s-%s" % (q["type"], q["no"]))
    if no_ans:
        bad("每道题都必须有答案", "缺答案 " + "、".join(no_ans[:10]))
    else:
        ok("每道题都有答案（含简答参考答案、应用题答案表）")

    # 代码空位：89 = 唯一编号数；标记必须都能在答案表里找到
    apps = [q for q in qs if q["type"] == "app"]
    marks, ans_ids, orphans = [], set(), []
    for q in apps:
        text = "".join(t["text"] for t in q["blankCode"])
        ids = BLANK_MARK.findall(text)
        marks.extend(ids)
        ans_ids.update(a[0] for a in q["answer"])
        for i in ids:
            if i not in {a[0] for a in q["answer"]}:
                orphans.append("%s#%s" % (q["no"], i))
    uniq = sorted(set(marks))
    if len(uniq) == 89:
        ok("代码空位：唯一编号 89 个（字面标记 %d 处，重复属跨文件复用）" % len(marks))
    else:
        bad("代码空位唯一编号应为 89", "实际 %d" % len(uniq))

    if orphans:
        bad("每个空位标记都必须有答案", "无答案 " + "、".join(orphans[:10]))
    else:
        ok("每个空位标记都能在答案表找到条目")
    return data


# ---------- 3. 产物完整性 ----------
def check_inline(data):
    html = read(os.path.join(ROOT, "JavaWeb期末题库.html"))
    raw = read(os.path.join(ROOT, "_build/data.json"))
    sdk = read(os.path.join(ROOT, "_build/cloud-sdk.js"))

    if raw.replace("</", "<\\/") in html:
        ok("data.json 已内联进 HTML（与源文件一致）")
    else:
        bad("HTML 内联数据与 _build/data.json 不一致", "产物被手改过，或没重新构建")

    if sdk.replace("</script", "<\\/script") in html:
        ok("cloud-sdk.js 已内联进 HTML（与源文件一致）")
    else:
        bad("HTML 内联 SDK 与 _build/cloud-sdk.js 不一致")

    if "__DATA__" in html or "__SDK__" in html:
        bad("占位符残留", "/*__DATA__*/ 或 <!--__SDK__--> 未被替换")
    else:
        ok("占位符无残留")
    return html


# ---------- 4. 结构冒烟 ----------
def check_structure(html):
    tabs = ["bank", "drill", "exam", "wrong", "kb", "me"]
    miss = [t for t in tabs if ('data-tab="%s"' % t) not in html]
    if miss:
        bad("六个 Tab 齐全", "缺 " + "、".join(miss))
    else:
        ok("六个 Tab 齐全（题库 / 刷题 / 模考 / 错题 / 知识 / 我的）")

    ids = ["app", "submit", "start", "tm", "kw", "scoreArea", "redoList", "dresume"]
    miss = [i for i in ids if ('id="%s"' % i) not in html]
    if miss:
        bad("关键元素齐全", "缺 #" + " #".join(miss))
    else:
        ok("关键元素齐全（#app #submit #start #tm #kw #scoreArea #redoList #dresume）")


# ---------- 5. 无外部资源加载 ----------
def check_no_external(html):
    pat = re.compile(r"<(script|img|iframe|link)\b[^>]*\b(src|href)\s*=\s*[\"']\s*https?://", re.I)
    hits = pat.findall(html)
    if hits:
        bad("不应有外部资源加载（微信/移动网络拉不到会白屏）",
            "命中 %d 处，如 %s" % (len(hits), hits[0]))
    else:
        ok("无外部资源加载（脚本与 SDK 全部内联）")


# ---------- 6. 敏感信息 ----------
def check_secrets():
    token = re.compile(r"(ghp_|gho_|ghu_|github_pat_|sk-|wbsk_)[A-Za-z0-9_\-]{16,}")
    priv = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")
    phone = re.compile(r"(?<![0-9])1[3-9][0-9]{9}(?![0-9])")

    targets = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", ".workbuddy", "node_modules")]
        for f in files:
            if f.endswith((".md", ".html", ".js", ".json", ".py", ".yml", ".yaml")):
                targets.append(os.path.join(base, f))

    hits_t, hits_p, hits_phone = [], [], []
    for p in targets:
        rel = os.path.relpath(p, ROOT).replace("\\", "/")
        try:
            text = read(p)
        except UnicodeDecodeError:
            continue
        if token.search(text):
            hits_t.append(rel)
        if priv.search(text):
            hits_p.append(rel)
        if phone.search(text):
            hits_phone.append(rel)

    if hits_t:
        bad("不应有访问令牌", "命中 " + "、".join(hits_t[:6]))
    if hits_p:
        bad("不应有私钥", "命中 " + "、".join(hits_p[:6]))
    if hits_phone:
        bad("不应有手机号", "命中 " + "、".join(hits_phone[:6]))
    if not (hits_t or hits_p or hits_phone):
        ok("无访问令牌 / 私钥 / 手机号（扫描 %d 个文本文件）" % len(targets))


# ---------- 7. JS 语法 ----------
def check_js_syntax(html):
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        bad("需要 node 才能做 JS 语法检查", "本机/CI 未找到 node")
        return

    blocks = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)
    if not blocks:
        bad("未找到内联脚本", "模板结构可能被改动")
        return

    tmpdir = tempfile.mkdtemp(prefix="legacy-js-")
    failed = []
    for i, code in enumerate(blocks):
        p = os.path.join(tmpdir, "inline-%d.js" % i)
        with io.open(p, "w", encoding="utf-8") as f:
            f.write(code)
        r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
        if r.returncode != 0:
            head = (r.stderr or "").strip().splitlines()[:3]
            failed.append("第 %d 段：%s" % (i + 1, " / ".join(head)))
    if failed:
        bad("内联 JS 语法检查通过", "；".join(failed))
    else:
        ok("内联 JS 语法检查通过（%d 段）" % len(blocks))


def main():
    print("=" * 64)
    print("旧版自检 · " + ROOT)
    print("=" * 64)
    if check_files():
        data = check_data()
        html = check_inline(data)
        check_structure(html)
        check_no_external(html)
        check_secrets()
        check_js_syntax(html)
    print("-" * 64)
    if FAILS:
        print("结论：不通过，%d 项失败" % len(FAILS))
        for f in FAILS:
            print("  · " + f)
        return 1
    print("结论：全部通过%s" % ("（%d 条提醒）" % len(WARNS) if WARNS else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
