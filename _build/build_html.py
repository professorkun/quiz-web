# -*- coding: utf-8 -*-
"""把 template.html + data.json + cloud-sdk.js 合成单文件网页，同时写入发布目录。

云 SDK 直接内联进 HTML，不再依赖 cdn.jsdelivr.net —— 微信/移动网络里 CDN 拉不到
会导致 window.WorkBuddyCloud 缺失，页面就报「云端未连接」。
同时把 SDK 另存一份 sdk.js 到发布目录，作为运行时兜底。
"""
import io, os, shutil

BASE = os.path.dirname(os.path.abspath(__file__))          # .../_build
ROOT = os.path.dirname(BASE)                                # .../JavaWeb期末复习

tpl = io.open(os.path.join(BASE, "template.html"), encoding="utf-8").read()
data = io.open(os.path.join(BASE, "data.json"), encoding="utf-8").read()
sdk = io.open(os.path.join(BASE, "cloud-sdk.js"), encoding="utf-8").read()

# 内联 JSON / JS 里出现 </script> 会提前闭合
data = data.replace("</", "<\\/")
sdk_safe = sdk.replace("</script", "<\\/script")

out = tpl.replace("/*__DATA__*/", data).replace(
    "<!--__SDK__-->", "<script>\n" + sdk_safe + "\n</script>")
assert "<!--__SDK__-->" not in out, "SDK 占位未被替换"

targets = [os.path.join(ROOT, "JavaWeb期末题库.html"),
           os.path.join(ROOT, "题库网页", "index.html")]
for t in targets:
    d = os.path.dirname(t)
    if not os.path.isdir(d):
        os.makedirs(d)
    io.open(t, "w", encoding="utf-8").write(out)
    shutil.copyfile(os.path.join(BASE, "cloud-sdk.js"), os.path.join(d, "sdk.js"))
    print("wrote", t, round(os.path.getsize(t) / 1024, 1), "KB (+ sdk.js 兜底)")
