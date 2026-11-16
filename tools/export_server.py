#!/usr/bin/env python3
"""一次性导出服务器：静态托管仓库根目录 + 接收导出页 POST 的 JSON。

为什么需要它：云端数据只能从「已登录的同源页面」读出来，而浏览器无法直接把
读取结果写到磁盘。所以这里让页面把 JSON POST 回来，落到 .workbuddy/tmp/ 下
（该目录被 .gitignore 忽略，不会入库）。

用法：python3 tools/export_server.py [port]
"""

import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO_ROOT, ".workbuddy", "tmp")
OUT_FILE = os.path.join(OUT_DIR, "legacy-export.json")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_ROOT, **kwargs)

    def do_POST(self):
        if self.path != "/save":
            self.send_error(404, "only /save")
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 32 * 1024 * 1024:
            self.send_error(400, "bad length")
            return
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            self.send_error(400, f"invalid json: {exc}")
            return
        os.makedirs(OUT_DIR, exist_ok=True)
        with open(OUT_FILE, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        body = json.dumps({"path": OUT_FILE}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        print(f"[saved] {OUT_FILE}")

    def log_message(self, fmt, *args):
        print("[http]", fmt % args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"serving {REPO_ROOT} at http://127.0.0.1:{port}")
    print(f"export target: {OUT_FILE}")
    server.serve_forever()


if __name__ == "__main__":
    main()
